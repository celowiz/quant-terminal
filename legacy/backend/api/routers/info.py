"""
Router de informações de ativos usando novo banco NoSQL.

Endpoint simplificado que acessa dados do Yahoo Finance
salvos no banco TinyDB.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sqlite3
from typing import Optional, Dict, Any, List

from ...config import DB_PATH_CADASTRO, DB_PATH_YAHOO_ASSETS
from ...data_pipeline.load.yahoo_assets_dao import YahooAssetsDAO


router = APIRouter()


class YahooAssetInfo(BaseModel):
    """Modelo para informações de ativo do Yahoo Finance."""
    ticker: str
    name: str
    asset_type: Optional[str] = None
    quote_type: Optional[str] = None
    currency: str
    exchange: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    market_cap: Optional[int] = None
    shares_outstanding: Optional[int] = None
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    volume: Optional[int] = None
    yahoo_info: Dict[str, Any] = {}


class TickerInfo(BaseModel):
    """Modelo consolidado de informações de ticker."""
    ticker: str
    found_in_cadastro: bool = False
    found_in_yahoo: bool = False
    cadastro_info: Optional[Dict[str, Any]] = None
    yahoo_info: Optional[YahooAssetInfo] = None


def get_yahoo_assets_info(ticker: str) -> Optional[YahooAssetInfo]:
    """
    Obtém informações do banco NoSQL de ativos do Yahoo Finance.
    
    Args:
        ticker: Ticker do ativo
        
    Returns:
        Informações do ativo ou None se não encontrado
    """
    try:
        dao = YahooAssetsDAO()
        asset = dao.get_asset_by_ticker(ticker)
        dao.close()
        
        if not asset:
            return None
        
        return YahooAssetInfo(
            ticker=asset.ticker,
            name=asset.name,
            asset_type=asset.asset_type,
            quote_type=asset.quote_type,
            currency=asset.currency,
            exchange=asset.exchange,
            sector=asset.sector,
            industry=asset.industry,
            country=asset.country,
            market_cap=asset.market_cap,
            shares_outstanding=asset.shares_outstanding,
            current_price=float(asset.current_price) if asset.current_price else None,
            previous_close=float(asset.previous_close) if asset.previous_close else None,
            day_high=float(asset.day_high) if asset.day_high else None,
            day_low=float(asset.day_low) if asset.day_low else None,
            volume=asset.volume,
            yahoo_info=asset.yahoo_info
        )
        
    except Exception as e:
        print(f"Erro ao acessar informações do Yahoo Finance para {ticker}: {e}")
        return None


def get_cadastro_info(ticker: str) -> Optional[Dict[str, Any]]:
    """
    Obtém informações do banco de cadastro.
    
    Args:
        ticker: Ticker do ativo
        
    Returns:
        Informações do cadastro ou None se não encontrado
    """
    try:
        with sqlite3.connect(DB_PATH_CADASTRO) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT * FROM tickers 
                WHERE UPPER(ticker) = ? OR UPPER(ticker) = ?
                LIMIT 1
            """, (ticker.upper(), f"{ticker.upper()}.SA"))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            return dict(row)
            
    except Exception as e:
        print(f"Erro ao acessar cadastro para {ticker}: {e}")
        return None


@router.get("/ticker/{ticker}", response_model=TickerInfo)
async def get_ticker_info(ticker: str):
    """
    Obtém informações consolidadas de um ticker.
    
    Busca informações tanto no banco de cadastro quanto
    no banco NoSQL do Yahoo Finance.
    """
    # Normalizar ticker
    ticker_clean = ticker.upper().strip()
    
    # Buscar no cadastro
    cadastro_info = get_cadastro_info(ticker_clean)
    
    # Buscar no Yahoo Finance
    yahoo_info = get_yahoo_assets_info(ticker_clean)
    
    # Se não encontrou em lugar nenhum
    if not cadastro_info and not yahoo_info:
        raise HTTPException(
            status_code=404, 
            detail=f"Ticker {ticker_clean} não encontrado nem no cadastro nem no Yahoo Finance"
        )
    
    return TickerInfo(
        ticker=ticker_clean,
        found_in_cadastro=cadastro_info is not None,
        found_in_yahoo=yahoo_info is not None,
        cadastro_info=cadastro_info,
        yahoo_info=yahoo_info
    )


@router.get("/yahoo/statistics")
async def get_yahoo_database_statistics():
    """
    Obtém estatísticas do banco NoSQL do Yahoo Finance.
    """
    try:
        dao = YahooAssetsDAO()
        stats = dao.get_statistics()
        dao.close()
        
        return {
            "status": "success",
            "statistics": stats
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter estatísticas: {str(e)}"
        )


@router.get("/yahoo/assets")
async def get_yahoo_assets(
    exchange: Optional[str] = None,
    sector: Optional[str] = None,
    asset_type: Optional[str] = None,
    limit: int = 100
):
    """
    Lista ativos do banco Yahoo Finance com filtros opcionais.
    """
    try:
        dao = YahooAssetsDAO()
        
        if exchange:
            assets = dao.get_assets_by_exchange(exchange)
        elif sector:
            assets = dao.get_assets_by_sector(sector)
        elif asset_type:
            assets = dao.get_assets_by_asset_type(asset_type)
        else:
            # Buscar todos e limitar
            all_tickers = dao.get_all_tickers()
            assets = []
            for i, ticker in enumerate(all_tickers[:limit]):
                asset = dao.get_asset_by_ticker(ticker)
                if asset:
                    assets.append(asset)
        
        dao.close()
        
        # Converter para dict
        assets_data = []
        for asset in assets[:limit]:
            assets_data.append({
                "ticker": asset.ticker,
                "name": asset.name,
                "asset_type": asset.asset_type,
                "exchange": asset.exchange,
                "sector": asset.sector,
                "industry": asset.industry,
                "country": asset.country,
                "market_cap": asset.market_cap,
                "current_price": float(asset.current_price) if asset.current_price else None
            })
        
        return {
            "status": "success",
            "count": len(assets_data),
            "assets": assets_data,
            "filters": {
                "exchange": exchange,
                "sector": sector,
                "asset_type": asset_type,
                "limit": limit
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar ativos: {str(e)}"
        )


@router.get("/yahoo/{ticker}/raw")
async def get_yahoo_raw_data(ticker: str):
    """
    Obtém dados brutos completos do Yahoo Finance para um ticker.
    """
    try:
        dao = YahooAssetsDAO()
        yahoo_data = dao.get_yahoo_data_by_ticker(ticker)
        dao.close()
        
        if not yahoo_data:
            raise HTTPException(
                status_code=404,
                detail=f"Dados do Yahoo Finance não encontrados para {ticker}"
            )
        
        return {
            "status": "success",
            "ticker": ticker.upper(),
            "yahoo_data": yahoo_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar dados brutos: {str(e)}"
        )


@router.get("/cadastro/statistics")
async def get_cadastro_statistics():
    """
    Obtém estatísticas do banco de cadastro.
    """
    try:
        with sqlite3.connect(DB_PATH_CADASTRO) as conn:
            cursor = conn.cursor()
            
            # Total de tickers
            cursor.execute("SELECT COUNT(*) as total FROM tickers")
            total = cursor.fetchone()[0]
            
            # Por fonte
            cursor.execute("""
                SELECT fonte, COUNT(*) as count 
                FROM tickers 
                GROUP BY fonte
            """)
            by_source = dict(cursor.fetchall())
            
            # Por tipo de ativo
            cursor.execute("""
                SELECT tipo_ativo, COUNT(*) as count 
                FROM tickers 
                GROUP BY tipo_ativo
            """)
            by_type = dict(cursor.fetchall())
            
            # Por setor (apenas onde setor não é nulo)
            cursor.execute("""
                SELECT setor, COUNT(*) as count 
                FROM tickers 
                WHERE setor IS NOT NULL AND TRIM(setor) != ''
                GROUP BY setor
                ORDER BY count DESC
                LIMIT 10
            """)
            top_sectors = dict(cursor.fetchall())
            
        return {
            "status": "success",
            "statistics": {
                "total_tickers": total,
                "by_source": by_source,
                "by_type": by_type,
                "top_sectors": top_sectors
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao obter estatísticas do cadastro: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    Verifica se os bancos de dados estão acessíveis.
    """
    status = {
        "status": "healthy",
        "databases": {}
    }
    
    # Testar cadastro
    try:
        with sqlite3.connect(DB_PATH_CADASTRO) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM tickers LIMIT 1")
            count = cursor.fetchone()[0]
            status["databases"]["cadastro"] = {"status": "ok", "ticker_count": count}
    except Exception as e:
        status["databases"]["cadastro"] = {"status": "error", "error": str(e)}
        status["status"] = "degraded"
    
    # Testar Yahoo Finance NoSQL
    try:
        dao = YahooAssetsDAO()
        stats = dao.get_statistics()
        dao.close()
        status["databases"]["yahoo_assets"] = {
            "status": "ok", 
            "asset_count": stats.get("total_assets", 0)
        }
    except Exception as e:
        status["databases"]["yahoo_assets"] = {"status": "error", "error": str(e)}
        status["status"] = "degraded"
    
    return status