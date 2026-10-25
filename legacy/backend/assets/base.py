"""
Classe simplificada Asset para todos os ativos financeiros.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class MarketData(BaseModel):
    """Estrutura para dados de mercado OHLCV."""
    time: datetime
    open: Optional[Decimal] = None
    high: Optional[Decimal] = None
    low: Optional[Decimal] = None
    close: Optional[Decimal] = None
    adj_close: Optional[Decimal] = None
    volume: Optional[int] = None
    
    class Config:
        validate_assignment = True


class Asset(BaseModel):
    """
    Classe única simplificada para todos os ativos financeiros.
    
    Armazena todas as informações vindas do Yahoo Finance,
    sem distinção de tipo específico de ativo.
    """
    
    # Identificação básica
    ticker: str = Field(..., description="Símbolo do ticker")
    name: str = Field(..., description="Nome do ativo")
    
    # Informações básicas do Yahoo Finance
    currency: str = Field(default="BRL", description="Moeda de cotação")
    exchange: str = Field(default="UNKNOWN", description="Bolsa/mercado onde é negociado")
    asset_type: Optional[str] = Field(None, description="Tipo do ativo segundo Yahoo Finance")
    quote_type: Optional[str] = Field(None, description="Tipo de cotação")
    
    # Informações financeiras básicas
    sector: Optional[str] = Field(None, description="Setor")
    industry: Optional[str] = Field(None, description="Indústria")
    market_cap: Optional[int] = Field(None, description="Valor de mercado")
    shares_outstanding: Optional[int] = Field(None, description="Ações em circulação")
    country: Optional[str] = Field(None, description="País")
    
    # Preços e volume
    current_price: Optional[Decimal] = Field(None, description="Preço atual")
    previous_close: Optional[Decimal] = Field(None, description="Fechamento anterior")
    day_high: Optional[Decimal] = Field(None, description="Máxima do dia")
    day_low: Optional[Decimal] = Field(None, description="Mínima do dia")
    volume: Optional[int] = Field(None, description="Volume")
    
    # Informações completas do Yahoo Finance
    yahoo_info: Dict[str, Any] = Field(default_factory=dict, description="Dados completos do Yahoo Finance")
    
    # Metadados
    active: bool = Field(default=True, description="Se o ativo está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    @field_validator('ticker')
    def ticker_must_be_uppercase(cls, v):
        """Garantir que o ticker seja em maiúsculas."""
        return v.upper().strip()
    
    @field_validator('currency')
    def currency_must_be_uppercase(cls, v):
        """Garantir que a moeda seja em maiúsculas."""
        return v.upper().strip()
    
    @field_validator('exchange')
    def exchange_must_be_uppercase(cls, v):
        """Garantir que a bolsa seja em maiúsculas."""
        return v.upper().strip()
    
    @classmethod
    def from_yahoo_info(cls, ticker: str, yahoo_data: Dict[str, Any]) -> 'Asset':
        """
        Cria um Asset a partir de dados do Yahoo Finance.
        
        Args:
            ticker: Símbolo do ticker
            yahoo_data: Dados do Yahoo Finance
            
        Returns:
            Instância do Asset
        """
        return cls(
            ticker=ticker,
            name=yahoo_data.get('long_name', yahoo_data.get('short_name', ticker)),
            currency=yahoo_data.get('currency', 'BRL'),
            exchange=yahoo_data.get('exchange', 'UNKNOWN'),
            asset_type=yahoo_data.get('asset_type', yahoo_data.get('quote_type', '').lower()),
            quote_type=yahoo_data.get('quote_type'),
            sector=yahoo_data.get('sector'),
            industry=yahoo_data.get('industry'),
            market_cap=yahoo_data.get('market_cap'),
            shares_outstanding=yahoo_data.get('shares_outstanding'),
            country=yahoo_data.get('country'),
            current_price=yahoo_data.get('current_price'),
            previous_close=yahoo_data.get('previous_close'),
            day_high=yahoo_data.get('day_high'),
            day_low=yahoo_data.get('day_low'),
            volume=yahoo_data.get('volume'),
            yahoo_info=yahoo_data
        )
    
    def update_from_yahoo(self, yahoo_data: Dict[str, Any]) -> None:
        """
        Atualiza Asset com novos dados do Yahoo Finance.
        
        Args:
            yahoo_data: Dados atualizados do Yahoo Finance
        """
        # Atualizar campos básicos
        if 'long_name' in yahoo_data or 'short_name' in yahoo_data:
            self.name = yahoo_data.get('long_name', yahoo_data.get('short_name', self.name))
        
        if 'currency' in yahoo_data:
            self.currency = yahoo_data['currency']
        
        if 'exchange' in yahoo_data:
            self.exchange = yahoo_data['exchange']
        
        # Atualizar informações financeiras
        for field in ['asset_type', 'quote_type', 'sector', 'industry', 'market_cap', 
                     'shares_outstanding', 'country', 'current_price', 'previous_close',
                     'day_high', 'day_low', 'volume']:
            if field in yahoo_data:
                setattr(self, field, yahoo_data[field])
        
        # Atualizar dados completos
        self.yahoo_info = yahoo_data
        self.updated_at = datetime.now()
    
    def to_dict(self) -> dict:
        """Converte o ativo para dicionário serializável em JSON."""
        data = self.model_dump()
        
        # Converter datetime para string para compatibilidade com JSON
        if 'created_at' in data and data['created_at']:
            data['created_at'] = data['created_at'].isoformat()
        if 'updated_at' in data and data['updated_at']:
            data['updated_at'] = data['updated_at'].isoformat()
            
        # Converter Decimal para float para compatibilidade com JSON
        for field in ['current_price', 'previous_close', 'day_high', 'day_low']:
            if field in data and data[field] is not None:
                data[field] = float(data[field])
        
        return data
    
    def __str__(self) -> str:
        asset_type = self.asset_type or 'UNKNOWN'
        return f"{asset_type.upper()}: {self.ticker} ({self.name})"
    
    def __repr__(self) -> str:
        return f"<Asset(ticker='{self.ticker}', name='{self.name}')>"

