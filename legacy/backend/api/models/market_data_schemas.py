"""
Schemas para tabelas de dados de mercado.
"""

from datetime import datetime
from datetime import date as datetime_date
from typing import Optional
from decimal import Decimal

from pydantic import BaseModel, Field


class PriceDailyDB(BaseModel):
    """Schema para preços diários."""
    
    id: Optional[int] = Field(None, description="ID primário")
    asset_id: int = Field(..., description="FK para assets")
    ticker: str = Field(..., description="Símbolo do ticker")
    
    # Dados OHLCV
    date: datetime_date = Field(..., description="Data")
    open_price: Optional[Decimal] = Field(None, description="Preço de abertura")
    high_price: Optional[Decimal] = Field(None, description="Preço máximo") 
    low_price: Optional[Decimal] = Field(None, description="Preço mínimo")
    close_price: Optional[Decimal] = Field(None, description="Preço de fechamento")
    adj_close_price: Optional[Decimal] = Field(None, description="Preço ajustado")
    volume: Optional[int] = Field(None, description="Volume negociado")
    
    # Metadados
    source: str = Field("yahoo", description="Fonte dos dados")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "asset_id": 1,
                "ticker": "PETR4",
                "date": "2025-01-15",
                "open_price": 25.50,
                "high_price": 26.20,
                "low_price": 25.30,
                "close_price": 25.80,
                "adj_close_price": 25.80,
                "volume": 50000000
            }
        }


class PriceIntradayDB(BaseModel):
    """Schema para preços intraday."""
    
    id: Optional[int] = Field(None, description="ID primário")
    asset_id: int = Field(..., description="FK para assets")
    ticker: str = Field(..., description="Símbolo do ticker")
    
    # Dados OHLCV com timestamp
    timestamp: datetime = Field(..., description="Timestamp do preço")
    open_price: Optional[Decimal] = Field(None, description="Preço de abertura")
    high_price: Optional[Decimal] = Field(None, description="Preço máximo")
    low_price: Optional[Decimal] = Field(None, description="Preço mínimo")
    close_price: Optional[Decimal] = Field(None, description="Preço de fechamento")
    volume: Optional[int] = Field(None, description="Volume negociado")
    
    # Intervalo dos dados
    interval: str = Field("1m", description="Intervalo (1m, 5m, 1h, etc.)")
    
    # Metadados
    source: str = Field("yahoo", description="Fonte dos dados")
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True


class CorporateActionDB(BaseModel):
    """Schema para eventos corporativos."""
    
    id: Optional[int] = Field(None, description="ID primário")
    asset_id: int = Field(..., description="FK para assets")
    ticker: str = Field(..., description="Símbolo do ticker")
    
    # Informações do evento
    action_type: str = Field(..., description="Tipo do evento")
    announcement_date: datetime_date = Field(..., description="Data do anúncio")
    ex_date: Optional[datetime_date] = Field(None, description="Data ex-evento")
    record_date: Optional[datetime_date] = Field(None, description="Data de registro")
    payment_date: Optional[datetime_date] = Field(None, description="Data de pagamento")
    
    # Detalhes do evento
    value: Optional[Decimal] = Field(None, description="Valor (dividendo, split ratio, etc.)")
    currency: Optional[str] = Field(None, description="Moeda do valor")
    description: Optional[str] = Field(None, description="Descrição do evento")
    
    # Metadados
    source: str = Field("yahoo", description="Fonte dos dados")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "asset_id": 1,
                "ticker": "PETR4",
                "action_type": "dividend",
                "announcement_date": "2025-01-10",
                "ex_date": "2025-01-15",
                "payment_date": "2025-01-30",
                "value": 0.25,
                "currency": "BRL",
                "description": "Dividendo trimestral"
            }
        }