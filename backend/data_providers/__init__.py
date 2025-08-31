"""
Módulo de provedores de dados financeiros.

Este módulo contém a interface abstrata e implementações
para diferentes fontes de dados financeiros.
"""

from .base import IDataProvider, DataProviderError
from .yahoo_provider import YahooFinanceProvider

__all__ = [
    'IDataProvider',
    'DataProviderError', 
    'YahooFinanceProvider'
]

