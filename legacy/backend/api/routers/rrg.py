from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import sqlite3
import pandas as pd
import numpy as np
from scipy.signal import savgol_filter
from datetime import datetime

from ...config import DB_PATH_DAILY_PRICES
from ..models.rrg_schemas import RRGConfig, RRGResponse, RRGAssetData, RRGPoint

router = APIRouter()

# Ativos hardcoded inicialmente
DEFAULT_TICKERS = ['PETR4', 'VALE3', 'B3SA3', 'IDX_BVSP']


def classify_quadrant(rs_ratio: float, rs_momentum: float) -> str:
    """Classifica o quadrante baseado nos valores RS-Ratio e RS-Momentum"""
    if rs_ratio >= 100 and rs_momentum >= 100:
        return "Leading"
    elif rs_ratio < 100 and rs_momentum >= 100:
        return "Improving"
    elif rs_ratio < 100 and rs_momentum < 100:
        return "Lagging"
    else:
        return "Weakening"


def ma(x: pd.Series, window: int, use_ema: bool = True) -> pd.Series:
    """Calcula média móvel (EMA ou SMA)"""
    if use_ema:
        return x.ewm(span=window, adjust=False, min_periods=window).mean()
    else:
        return x.rolling(window, min_periods=window).mean()


def get_market_data(tickers: List[str]) -> pd.DataFrame:
    """Busca dados históricos do banco para os tickers especificados"""
    with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
        result = []
        for ticker in tickers:
            table = ticker.upper().replace('^', 'IDX_')  # Remove ^ do ^BVSP
            
            # Verifica se a tabela existe
            exists = pd.read_sql(
                "SELECT COUNT(1) AS n FROM sqlite_master WHERE type='table' AND name=?;",
                conn,
                params=(table,),
            )['n'].iloc[0] > 0
            
            if not exists:
                continue  # Pula se não encontrar a tabela
            
            # Lê dados históricos
            df = pd.read_sql(
                f"SELECT date, adj_close FROM '{table}' ORDER BY date;",
                conn
            )
            df = df.rename(columns={'adj_close': ticker})
            result.append(df)
        
        if not result:
            raise HTTPException(status_code=404, detail="Nenhum ticker encontrado no banco de dados")
        
        # Merge todos os DataFrames
        df_final = result[0]
        for df in result[1:]:
            df_final = pd.merge(df_final, df, on='date', how='outer')
        
        # Ordena e limpa
        df_final = df_final.sort_values('date').reset_index(drop=True).dropna()
        df_final['date'] = pd.to_datetime(df_final['date'])
        df_final.set_index('date', inplace=True)
        
        return df_final


def calculate_rrg(df: pd.DataFrame, config: RRGConfig) -> tuple:
    """Calcula os valores RRG baseado na configuração"""
    # Converter para semanal
    weekly = df.resample("W-FRI").last().dropna(how="all")
    weekly = weekly.ffill()
    
    # Verificar se benchmark existe
    if config.benchmark_col not in weekly.columns:
        raise HTTPException(
            status_code=400, 
            detail=f"Benchmark '{config.benchmark_col}' não encontrado nos dados"
        )
    
    # Ativos (exceto benchmark)
    assets = [c for c in weekly.columns if c != config.benchmark_col]
    if len(assets) == 0:
        raise HTTPException(status_code=400, detail="Nenhum ativo encontrado além do benchmark")
    
    # Calcular RS (Relative Strength)
    rs = weekly[assets].divide(weekly[config.benchmark_col], axis=0)
    
    # Calcular RS-Ratio
    rs_ma = ma(rs, config.lookback_ratio, use_ema=config.use_ema)
    rs_ratio = 100.0 * (rs / rs_ma)
    
    # Calcular RS-Momentum
    rs_ratio_shift = rs_ratio.shift(config.lookback_mom)
    rs_momentum = 100.0 * (rs_ratio / rs_ratio_shift)
    
    # Suavização com Savitzky-Golay
    try:
        rs_ratio = rs_ratio.apply(
            lambda x: pd.Series(
                savgol_filter(x.dropna(), min(5, len(x.dropna())), 2, mode="interp"),
                index=x.dropna().index
            ) if len(x.dropna()) >= 3 else x,
            raw=False
        )
        rs_momentum = rs_momentum.apply(
            lambda x: pd.Series(
                savgol_filter(x.dropna(), min(5, len(x.dropna())), 2, mode="interp"),
                index=x.dropna().index
            ) if len(x.dropna()) >= 3 else x,
            raw=False
        )
    except:
        # Se der erro na suavização, continua sem ela
        pass
    
    # Selecionar últimas semanas para trilha
    last_n = config.tail + 1
    rs_ratio_tail = rs_ratio.tail(last_n)
    rs_momentum_tail = rs_momentum.tail(last_n)
    
    return rs_ratio_tail, rs_momentum_tail, weekly.index


@router.get("/", response_model=RRGResponse)
def get_rrg(
    benchmark: str = Query(default="IDX_BVSP", description="Símbolo do benchmark"),
    lookback_ratio: int = Query(default=10, ge=1, le=50, description="Janela para normalização do RS"),
    lookback_mom: int = Query(default=10, ge=1, le=50, description="Janela para momentum do RS-Ratio"),
    tail: int = Query(default=12, ge=1, le=52, description="Semanas de trilha"),
    use_ema: bool = Query(default=True, description="Usar EMA para suavização"),
    tickers: Optional[str] = Query(default=None, description="Tickers separados por vírgula (opcional)")
) -> RRGResponse:
    """
    Endpoint para calcular e retornar dados do Relative Rotation Graph (RRG)
    """
    try:
        # Configuração
        config = RRGConfig(
            benchmark_col=benchmark,
            lookback_ratio=lookback_ratio,
            lookback_mom=lookback_mom,
            tail=tail,
            use_ema=use_ema
        )
        
        # Determinar tickers a usar
        if tickers:
            ticker_list = [t.strip().upper() for t in tickers.split(',')]
            # Adicionar benchmark se não estiver na lista
            if config.benchmark_col not in ticker_list:
                ticker_list.append(config.benchmark_col)
        else:
            ticker_list = DEFAULT_TICKERS.copy()
        
        # Buscar dados
        df = get_market_data(ticker_list)
        
        # Calcular RRG
        rs_ratio_tail, rs_momentum_tail, date_index = calculate_rrg(df, config)
        
        # Preparar resposta
        assets_data = []
        asset_tickers = [col for col in rs_ratio_tail.columns if col != config.benchmark_col]
        
        for ticker in asset_tickers:
            if ticker not in rs_ratio_tail.columns or ticker not in rs_momentum_tail.columns:
                continue
                
            # Extrair pontos para trilha
            points = []
            for i, date in enumerate(rs_ratio_tail.index):
                rs_ratio_val = rs_ratio_tail.loc[date, ticker]
                rs_momentum_val = rs_momentum_tail.loc[date, ticker]
                
                if pd.notna(rs_ratio_val) and pd.notna(rs_momentum_val):
                    quadrant = classify_quadrant(rs_ratio_val, rs_momentum_val)
                    points.append(RRGPoint(
                        date=date.to_pydatetime(),
                        rs_ratio=float(rs_ratio_val),
                        rs_momentum=float(rs_momentum_val),
                        quadrant=quadrant
                    ))
            
            if points:
                # Valores atuais (último ponto)
                current_point = points[-1]
                
                assets_data.append(RRGAssetData(
                    ticker=ticker,
                    points=points,
                    current_rs_ratio=current_point.rs_ratio,
                    current_rs_momentum=current_point.rs_momentum,
                    current_quadrant=current_point.quadrant
                ))
        
        # Range de datas
        date_range = {
            "start": rs_ratio_tail.index[0].isoformat() if len(rs_ratio_tail.index) > 0 else None,
            "end": rs_ratio_tail.index[-1].isoformat() if len(rs_ratio_tail.index) > 0 else None
        }
        
        return RRGResponse(
            config=config,
            benchmark=config.benchmark_col,
            assets=assets_data,
            date_range=date_range
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao calcular RRG: {str(e)}")


@router.get("/config", response_model=RRGConfig)
def get_default_config() -> RRGConfig:
    """Retorna a configuração padrão do RRG"""
    return RRGConfig()


@router.get("/tickers")
def get_available_tickers():
    """Retorna lista de tickers disponíveis no banco de dados"""
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            tables = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
                conn
            )
            return {"tickers": tables['name'].tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar tickers: {str(e)}")
