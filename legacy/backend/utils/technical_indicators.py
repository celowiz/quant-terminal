"""
Utilitário para cálculo de indicadores técnicos.

Este módulo fornece funções para adicionar indicadores técnicos
comuns a DataFrames de preços usando a biblioteca pandas-ta.
"""

import pandas as pd
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def add_macd(df: pd.DataFrame, fast: int = 6, slow: int = 12, signal: int = 5) -> pd.DataFrame:
    """
    Adiciona indicador MACD (Moving Average Convergence Divergence) ao DataFrame.
    
    Args:
        df: DataFrame com coluna 'close'
        fast: Período da média móvel rápida (default: 6)
        slow: Período da média móvel lenta (default: 12)
        signal: Período da linha de sinal (default: 5)
    
    Returns:
        DataFrame com colunas MACD adicionadas
    """
    try:
        df.ta.macd(close='close', fast=fast, slow=slow, signal=signal, append=True)
        logger.debug(f"MACD adicionado - Fast: {fast}, Slow: {slow}, Signal: {signal}")
        return df
    except Exception as e:
        logger.error(f"Erro ao calcular MACD: {e}")
        return df


def add_ema(df: pd.DataFrame, period: int = 14, column: str = 'close') -> pd.DataFrame:
    """
    Adiciona Exponential Moving Average (EMA) ao DataFrame.
    
    Args:
        df: DataFrame com dados de preços
        period: Período da média móvel (default: 14)
        column: Nome da coluna para cálculo (default: 'close')
    
    Returns:
        DataFrame com coluna EMA adicionada
    """
    try:
        df.ta.ema(close=column, length=period, offset=None, append=True)
        logger.debug(f"EMA-{period} adicionada para coluna '{column}'")
        return df
    except Exception as e:
        logger.error(f"Erro ao calcular EMA: {e}")
        return df


def add_sma(df: pd.DataFrame, period: int = 14, column: str = 'close') -> pd.DataFrame:
    """
    Adiciona Simple Moving Average (SMA) ao DataFrame.
    
    Args:
        df: DataFrame com dados de preços
        period: Período da média móvel (default: 14)
        column: Nome da coluna para cálculo (default: 'close')
    
    Returns:
        DataFrame com coluna SMA adicionada
    """
    try:
        df.ta.sma(close=column, length=period, offset=None, append=True)
        logger.debug(f"SMA-{period} adicionada para coluna '{column}'")
        return df
    except Exception as e:
        logger.error(f"Erro ao calcular SMA: {e}")
        return df


def add_rsi(df: pd.DataFrame, period: int = 14, column: str = 'close') -> pd.DataFrame:
    """
    Adiciona Relative Strength Index (RSI) ao DataFrame.
    
    Args:
        df: DataFrame com dados de preços
        period: Período do RSI (default: 14)
        column: Nome da coluna para cálculo (default: 'close')
    
    Returns:
        DataFrame com coluna RSI adicionada
    """
    try:
        df.ta.rsi(close=column, length=period, offset=None, append=True)
        logger.debug(f"RSI-{period} adicionado para coluna '{column}'")
        return df
    except Exception as e:
        logger.error(f"Erro ao calcular RSI: {e}")
        return df


def add_all_indicators(df: pd.DataFrame, 
                      macd_params: Optional[dict] = None,
                      ema_periods: Optional[list] = None,
                      sma_periods: Optional[list] = None,
                      rsi_period: int = 14) -> pd.DataFrame:
    """
    Adiciona múltiplos indicadores técnicos de uma vez.
    
    Args:
        df: DataFrame com dados de preços
        macd_params: Parâmetros MACD {'fast': 6, 'slow': 12, 'signal': 5}
        ema_periods: Lista de períodos para EMA [9, 21, 50]
        sma_periods: Lista de períodos para SMA [20, 50, 200]
        rsi_period: Período para RSI (default: 14)
    
    Returns:
        DataFrame com todos os indicadores adicionados
    """
    logger.info("Adicionando múltiplos indicadores técnicos")
    
    # MACD
    if macd_params:
        df = add_macd(df, **macd_params)
    else:
        df = add_macd(df)
    
    # EMAs
    if ema_periods:
        for period in ema_periods:
            df = add_ema(df, period)
    
    # SMAs  
    if sma_periods:
        for period in sma_periods:
            df = add_sma(df, period)
    
    # RSI
    df = add_rsi(df, rsi_period)
    
    logger.info(f"Indicadores adicionados. DataFrame shape: {df.shape}")
    return df
