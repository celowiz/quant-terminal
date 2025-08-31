from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class RRGConfig(BaseModel):
    """Configurações para cálculo do RRG"""
    benchmark_col: str = Field(default="^BVSP", description="Símbolo do benchmark")
    lookback_ratio: int = Field(default=10, ge=1, le=50, description="Janela para normalização do RS (semanas)")
    lookback_mom: int = Field(default=10, ge=1, le=50, description="Janela para momentum do RS-Ratio (semanas)")
    tail: int = Field(default=12, ge=1, le=52, description="Quantas semanas de trilha mostrar")
    use_ema: bool = Field(default=True, description="Usar EMA (True) ou SMA (False) para suavização")


class RRGPoint(BaseModel):
    """Um ponto no gráfico RRG"""
    date: datetime
    rs_ratio: float
    rs_momentum: float
    quadrant: str


class RRGAssetData(BaseModel):
    """Dados de um ativo para o RRG"""
    ticker: str
    points: List[RRGPoint]
    current_rs_ratio: float
    current_rs_momentum: float
    current_quadrant: str


class RRGResponse(BaseModel):
    """Resposta completa do endpoint RRG"""
    config: RRGConfig
    benchmark: str
    assets: List[RRGAssetData]
    date_range: dict
