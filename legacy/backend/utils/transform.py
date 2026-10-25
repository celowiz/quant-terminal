"""
Utilitários para transformação de dados.

Este módulo contém funções auxiliares para transformação e limpeza
de dados durante o pipeline de ETL.
"""

import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional, Union
import logging
import re

logger = logging.getLogger(__name__)


def clean_ticker_for_database_key(ticker: str) -> str:
    """
    Limpa o ticker para usar como chave/nome de tabela tanto no SQLite quanto no TinyDB.
    Aplica as mesmas regras de limpeza para garantir consistência entre os bancos.
    
    Args:
        ticker: Ticker original
        
    Returns:
        Ticker limpo para usar como chave/nome de tabela
        
    Examples:
        >>> clean_ticker_for_database_key("PETR4.SA")
        'PETR4'
        >>> clean_ticker_for_database_key("^BVSP")
        'IDX_BVSP'
        >>> clean_ticker_for_database_key("BRL=X")
        'BRL_X'
        >>> clean_ticker_for_database_key("DX-Y.NYB")
        'DX_Y_NYB'
    """
    ticker_upper = ticker.upper().strip()
    
    # Remover .SA dos tickers brasileiros [[memory:7458106]]
    if ticker_upper.endswith('.SA'):
        ticker_upper = ticker_upper.replace('.SA', '')
    
    # Substituir caracteres especiais por underscores
    # SQLite não aceita ^ no início de nomes de tabela
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', ticker_upper)
    
    # Para índices como ^BVSP, prefixar com "IDX_"
    if ticker.startswith('^'):
        clean_name = f"IDX_{clean_name[1:]}"  # Remove o _ inicial criado pelo regex
    
    # Garantir que não comece com número
    if clean_name and clean_name[0].isdigit():
        clean_name = f"ticker_{clean_name}"
    
    return clean_name


def clean_numeric_data(df: pd.DataFrame, columns: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Limpa dados numéricos removendo valores inválidos e convertendo tipos.
    
    Args:
        df: DataFrame para limpeza
        columns: Lista de colunas para limpar (None = todas numéricas)
    
    Returns:
        DataFrame com dados limpos
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    df_clean = df.copy()
    
    for col in columns:
        if col in df_clean.columns:
            # Converter para numérico forçando erros para NaN
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
            
            # Remover infinitos
            df_clean[col] = df_clean[col].replace([np.inf, -np.inf], np.nan)
    
    logger.debug(f"Limpeza numérica concluída para {len(columns)} colunas")
    return df_clean


def normalize_ticker_symbols(tickers: Union[str, List[str]]) -> List[str]:
    """
    Normaliza símbolos de tickers para formato padrão.
    
    Args:
        tickers: Ticker ou lista de tickers para normalizar
    
    Returns:
        Lista de tickers normalizados (maiúsculas, sem espaços)
    """
    if isinstance(tickers, str):
        tickers = [tickers]
    
    normalized = []
    for ticker in tickers:
        if isinstance(ticker, str):
            # Converter para maiúsculas e remover espaços
            clean_ticker = ticker.strip().upper()
            if clean_ticker:
                normalized.append(clean_ticker)
        else:
            logger.warning(f"Ticker inválido ignorado: {ticker}")
    
    logger.debug(f"Normalizados {len(normalized)} tickers")
    return normalized


def standardize_date_columns(df: pd.DataFrame, date_columns: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Padroniza colunas de data para formato datetime.
    
    Args:
        df: DataFrame com colunas de data
        date_columns: Lista de colunas de data (None = auto-detectar)
    
    Returns:
        DataFrame com datas padronizadas
    """
    df_clean = df.copy()
    
    if date_columns is None:
        # Auto-detectar colunas que podem ser datas
        date_columns = []
        for col in df.columns:
            if any(word in col.lower() for word in ['date', 'time', 'created', 'updated']):
                date_columns.append(col)
    
    for col in date_columns:
        if col in df_clean.columns:
            try:
                df_clean[col] = pd.to_datetime(df_clean[col], errors='coerce')
                logger.debug(f"Coluna '{col}' convertida para datetime")
            except Exception as e:
                logger.warning(f"Erro ao converter coluna '{col}' para datetime: {e}")
    
    return df_clean


def remove_outliers(df: pd.DataFrame, column: str, method: str = 'iqr', factor: float = 1.5) -> pd.DataFrame:
    """
    Remove outliers de uma coluna numérica.
    
    Args:
        df: DataFrame com os dados
        column: Nome da coluna para análise
        method: Método para detecção ('iqr' ou 'zscore')
        factor: Fator multiplicador para o limite (default: 1.5 para IQR)
    
    Returns:
        DataFrame sem outliers
    """
    if column not in df.columns:
        logger.warning(f"Coluna '{column}' não encontrada")
        return df
    
    df_clean = df.copy()
    original_count = len(df_clean)
    
    if method == 'iqr':
        Q1 = df_clean[column].quantile(0.25)
        Q3 = df_clean[column].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - factor * IQR
        upper_bound = Q3 + factor * IQR
        
        df_clean = df_clean[
            (df_clean[column] >= lower_bound) & 
            (df_clean[column] <= upper_bound)
        ]
    
    elif method == 'zscore':
        from scipy import stats
        z_scores = np.abs(stats.zscore(df_clean[column].dropna()))
        df_clean = df_clean[z_scores < factor]
    
    removed_count = original_count - len(df_clean)
    logger.info(f"Removidos {removed_count} outliers da coluna '{column}' ({method})")
    
    return df_clean


def validate_ohlc_data(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Valida dados OHLC (Open, High, Low, Close) para inconsistências.
    
    Args:
        df: DataFrame com dados OHLC
    
    Returns:
        Dicionário com resultado da validação
    """
    validation_result = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'stats': {}
    }
    
    required_columns = ['open', 'high', 'low', 'close']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        validation_result['is_valid'] = False
        validation_result['errors'].append(f"Colunas faltando: {missing_columns}")
        return validation_result
    
    # Verificar se high >= low
    invalid_hl = df[df['high'] < df['low']]
    if not invalid_hl.empty:
        validation_result['warnings'].append(f"{len(invalid_hl)} registros com high < low")
    
    # Verificar se high é a máxima
    invalid_high = df[
        (df['high'] < df['open']) | 
        (df['high'] < df['close']) | 
        (df['high'] < df['low'])
    ]
    if not invalid_high.empty:
        validation_result['warnings'].append(f"{len(invalid_high)} registros com high inválido")
    
    # Verificar se low é a mínima
    invalid_low = df[
        (df['low'] > df['open']) | 
        (df['low'] > df['close']) | 
        (df['low'] > df['high'])
    ]
    if not invalid_low.empty:
        validation_result['warnings'].append(f"{len(invalid_low)} registros com low inválido")
    
    # Estatísticas
    validation_result['stats'] = {
        'total_records': len(df),
        'null_counts': df[required_columns].isnull().sum().to_dict(),
        'negative_values': (df[required_columns] < 0).sum().to_dict()
    }
    
    logger.info(f"Validação OHLC concluída - Válido: {validation_result['is_valid']}")
    return validation_result
