"""
Schemas de banco de dados para armazenamento de ativos e dados de mercado.

Este módulo contém os schemas Pydantic para definir a estrutura
das tabelas do banco de dados SQLite. Agora simplificado para usar
apenas a classe Asset unificada.
"""

from .asset_schemas import AssetDB
from .market_data_schemas import (
    PriceDailyDB, PriceIntradayDB, CorporateActionDB
)
from .reference_schemas import (
    SectorDB, IndustryDB, ExchangeDB, CurrencyListDB
)

__all__ = [
    # Asset schema simplificado
    'AssetDB',
    
    # Market data schemas  
    'PriceDailyDB', 'PriceIntradayDB', 'CorporateActionDB',
    
    # Reference schemas
    'SectorDB', 'IndustryDB', 'ExchangeDB', 'CurrencyListDB'
]
