"""
Schemas para tabelas de referência e metadados.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SectorDB(BaseModel):
    """Schema para tabela de setores."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome do setor")
    code: Optional[str] = Field(None, description="Código do setor")
    description: Optional[str] = Field(None, description="Descrição")
    
    # Classificação
    classification_system: str = Field("gics", description="Sistema de classificação")
    parent_sector_id: Optional[int] = Field(None, description="FK para setor pai")
    
    # Metadados
    active: bool = Field(True, description="Se está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "name": "Energia",
                "code": "10",
                "description": "Empresas do setor energético",
                "classification_system": "gics"
            }
        }


class IndustryDB(BaseModel):
    """Schema para tabela de indústrias."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome da indústria")
    code: Optional[str] = Field(None, description="Código da indústria")
    description: Optional[str] = Field(None, description="Descrição")
    
    # Relacionamento com setor
    sector_id: int = Field(..., description="FK para setor")
    
    # Classificação
    classification_system: str = Field("gics", description="Sistema de classificação")
    
    # Metadados
    active: bool = Field(True, description="Se está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True


class ExchangeDB(BaseModel):
    """Schema para tabela de bolsas/mercados."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome da bolsa")
    code: str = Field(..., description="Código da bolsa")
    country: str = Field(..., description="País")
    timezone: str = Field(..., description="Fuso horário")
    
    # Horários de funcionamento
    market_open: Optional[str] = Field(None, description="Horário de abertura")
    market_close: Optional[str] = Field(None, description="Horário de fechamento")
    
    # Informações adicionais
    currency: str = Field(..., description="Moeda principal")
    website: Optional[str] = Field(None, description="Website oficial")
    mic_code: Optional[str] = Field(None, description="Código MIC ISO")
    
    # Metadados
    active: bool = Field(True, description="Se está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "name": "B3 - Brasil Bolsa Balcão",
                "code": "B3",
                "country": "Brasil",
                "timezone": "America/Sao_Paulo",
                "market_open": "10:00",
                "market_close": "17:00",
                "currency": "BRL",
                "mic_code": "BVMF"
            }
        }


class CurrencyListDB(BaseModel):
    """Schema para tabela de moedas."""
    
    id: Optional[int] = Field(None, description="ID primário")
    code: str = Field(..., description="Código ISO da moeda")
    name: str = Field(..., description="Nome da moeda")
    symbol: Optional[str] = Field(None, description="Símbolo da moeda")
    country: str = Field(..., description="País/região")
    
    # Informações adicionais
    decimal_places: int = Field(2, description="Casas decimais")
    is_crypto: bool = Field(False, description="Se é criptomoeda")
    is_fiat: bool = Field(True, description="Se é moeda fiduciária")
    
    # Metadados
    active: bool = Field(True, description="Se está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "code": "BRL",
                "name": "Real Brasileiro",
                "symbol": "R$",
                "country": "Brasil",
                "decimal_places": 2
            }
        }


class CountryDB(BaseModel):
    """Schema para tabela de países."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome do país")
    code_alpha2: str = Field(..., description="Código ISO Alpha-2")
    code_alpha3: str = Field(..., description="Código ISO Alpha-3")
    
    # Informações geográficas
    continent: str = Field(..., description="Continente")
    region: Optional[str] = Field(None, description="Região")
    capital: Optional[str] = Field(None, description="Capital")
    
    # Informações econômicas
    currency_code: str = Field(..., description="Código da moeda principal")
    timezone_main: str = Field(..., description="Fuso horário principal")
    
    # Metadados
    active: bool = Field(True, description="Se está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True


class HolidayDB(BaseModel):
    """Schema para tabela de feriados."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome do feriado")
    date: str = Field(..., description="Data do feriado (YYYY-MM-DD)")
    country_code: str = Field(..., description="Código do país")
    exchange_code: Optional[str] = Field(None, description="Código da bolsa afetada")
    
    # Tipo do feriado
    holiday_type: str = Field("public", description="Tipo do feriado")
    is_market_closed: bool = Field(True, description="Se o mercado fecha")
    
    # Metadados
    year: int = Field(..., description="Ano do feriado")
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "name": "Confraternização Universal",
                "date": "2025-01-01",
                "country_code": "BR",
                "exchange_code": "B3",
                "holiday_type": "public",
                "is_market_closed": True,
                "year": 2025
            }
        }


class DataSourceDB(BaseModel):
    """Schema para tabela de fontes de dados."""
    
    id: Optional[int] = Field(None, description="ID primário")
    name: str = Field(..., description="Nome da fonte")
    code: str = Field(..., description="Código da fonte")
    description: Optional[str] = Field(None, description="Descrição")
    
    # Configurações da fonte
    base_url: Optional[str] = Field(None, description="URL base da API")
    api_key_required: bool = Field(False, description="Se requer API key")
    rate_limit: Optional[int] = Field(None, description="Limite de requisições/minuto")
    
    # Capacidades
    supports_real_time: bool = Field(False, description="Suporta tempo real")
    supports_historical: bool = Field(True, description="Suporta histórico")
    supports_fundamentals: bool = Field(False, description="Suporta fundamentalista")
    
    # Status
    active: bool = Field(True, description="Se está ativo")
    last_check: Optional[datetime] = Field(None, description="Última verificação")
    status: str = Field("unknown", description="Status da fonte")
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True