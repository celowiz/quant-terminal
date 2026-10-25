"""
Pacote de classes de ativos financeiros simplificado.

Implementa uma única classe Asset que armazena
todas as informações vindas do Yahoo Finance.
"""

from .base import Asset, MarketData


__all__ = [
    'Asset',
    'MarketData'
]

