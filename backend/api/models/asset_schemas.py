"""
Schema simplificado para ativos - usando apenas classe Asset unificada.

Como agora usamos apenas a classe Asset que consolida todos os tipos,
mantemos apenas o schema básico para compatibilidade com a API.
"""

from datetime import datetime
from typing import Optional
from decimal import Decimal

from pydantic import BaseModel, Field


class AssetDB(BaseModel):
    """Schema simplificado para tabela de ativos usando classe Asset unificada."""
    
    id: Optional[int] = Field(None, description="ID primário")
    ticker: str = Field(..., description="Símbolo do ticker")
    name: str = Field(..., description="Nome do ativo")
    asset_type: Optional[str] = Field(None, description="Tipo do ativo")
    currency: str = Field(default="BRL", description="Moeda de cotação")
    exchange: str = Field(default="UNKNOWN", description="Bolsa/mercado")
    
    # Metadados
    active: bool = Field(True, description="Se o ativo está ativo")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "ticker": "PETR4",
                "name": "Petrobras PN",
                "asset_type": "equity",
                "currency": "BRL",
                "exchange": "B3"
            }
        }