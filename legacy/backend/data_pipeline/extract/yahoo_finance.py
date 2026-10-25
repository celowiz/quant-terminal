"""
Extrator modernizado do Yahoo Finance usando nova arquitetura de ativos.

Este módulo substitui o yahoo_finance.py antigo, integrando com as
novas classes de ativos e data providers.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import pandas as pd

from ...assets.base import Asset, MarketData
from ...data_providers.yahoo_provider import YahooFinanceProvider


class YahooFinanceExtractor:
    """
    Extrator modernizado para dados do Yahoo Finance.
    
    Integra com a nova arquitetura de ativos, data providers e factory.
    """
    
    def __init__(self):
        """Inicializa o extrator."""
        self.provider = YahooFinanceProvider()
        self.provider.connect()
    
    def extract_asset_with_data(
        self, 
        ticker: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        **asset_kwargs
    ) -> Dict[str, Any]:
        """
        Extrai um ativo com seus dados de mercado.
        
        Args:
            ticker: Símbolo do ativo
            start_date: Data inicial para dados históricos
            end_date: Data final para dados históricos
            **asset_kwargs: Parâmetros adicionais para criação do ativo
            
        Returns:
            Dicionário com ativo e dados de mercado
        """
        try:
            # Obter informações do ativo do Yahoo Finance
            yahoo_info = self.provider.get_asset_info(ticker)
            
            # Criar ativo usando os dados do Yahoo Finance
            asset = Asset.from_yahoo_info(ticker, yahoo_info)
            
            # Obter dados históricos
            df_historical = self.provider.get_historical_data(
                ticker, start_date, end_date
            )
            
            # Obter último preço
            latest_price = self.provider.get_latest_price(ticker)
            
            # Converter para MarketData
            market_data = self.provider.to_market_data_list(df_historical)
            
            return {
                'asset': asset,
                'historical_data': df_historical,
                'market_data': market_data,
                'latest_price': latest_price,
                'yahoo_info': yahoo_info,
                'success': True,
                'error': None
            }
            
        except Exception as e:
            return {
                'asset': None,
                'historical_data': pd.DataFrame(),
                'market_data': [],
                'latest_price': None,
                'success': False,
                'error': str(e)
            }
    
    def extract_multiple_assets(
        self,
        tickers: List[str],
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        **asset_kwargs
    ) -> Dict[str, Dict[str, Any]]:
        """
        Extrai múltiplos ativos com dados.
        
        Args:
            tickers: Lista de tickers
            start_date: Data inicial
            end_date: Data final
            **asset_kwargs: Parâmetros para criação dos ativos
            
        Returns:
            Dicionário {ticker: resultado}
        """
        results = {}
        
        for ticker in tickers:
            result = self.extract_asset_with_data(
                ticker, start_date, end_date, **asset_kwargs
            )
            results[ticker] = result
        
        return results
    
    def get_yahoo_data(self, ticker: str) -> pd.DataFrame:
        """
        Função compatível com o script antigo.
        
        Mantém a mesma interface do yahoo_finance.py original
        para compatibilidade com código existente.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            DataFrame com dados históricos normalizados
        """
        try:
            return self.provider.get_historical_data(ticker)
        except Exception as e:
            print(f"Erro ao extrair dados do Yahoo Finance: {e}")
            return pd.DataFrame(columns=[
                'time', 'open', 'high', 'low', 'close', 'adj_close', 'volume'
            ])
    
    def analyze_ticker(self, ticker: str) -> Dict[str, Any]:
        """
        Analisa um ticker e retorna informações detalhadas.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Análise completa do ticker
        """
        try:
            yahoo_info = self.provider.get_asset_info(ticker)
            return {
                'ticker': ticker.upper(),
                'inferred_type': yahoo_info.get('asset_type', yahoo_info.get('quote_type', 'unknown').lower()),
                'provider_info': yahoo_info,
                'patterns_matched': [],
                'is_available': self.provider.is_available(ticker)
            }
        except Exception as e:
            return {
                'ticker': ticker.upper(),
                'inferred_type': 'unknown',
                'provider_info': {},
                'patterns_matched': [],
                'is_available': False,
                'error': str(e)
            }
    
    def create_asset_only(self, ticker: str, **kwargs) -> Optional[Asset]:
        """
        Cria apenas o objeto ativo sem dados de mercado.
        
        Args:
            ticker: Símbolo do ativo
            **kwargs: Parâmetros adicionais
            
        Returns:
            Objeto Asset ou None se erro
        """
        try:
            yahoo_info = self.provider.get_asset_info(ticker)
            # Mesclar kwargs com dados do Yahoo
            yahoo_info.update(kwargs)
            return Asset.from_yahoo_info(ticker, yahoo_info)
        except Exception as e:
            print(f"Erro ao criar ativo {ticker}: {e}")
            return None
    
    def get_asset_info(self, ticker: str) -> Dict[str, Any]:
        """
        Obtém informações do ativo do Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Dicionário com informações do ativo
        """
        try:
            return self.provider.get_asset_info(ticker)
        except Exception as e:
            print(f"Erro ao obter informações de {ticker}: {e}")
            return {}
    
    def is_ticker_available(self, ticker: str) -> bool:
        """
        Verifica se o ticker está disponível no Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            True se disponível, False caso contrário
        """
        return self.provider.is_available(ticker)
    
    def search_tickers(self, query: str) -> List[Dict[str, str]]:
        """
        Busca tickers baseado em uma consulta.
        
        Args:
            query: Termo de busca
            
        Returns:
            Lista de tickers encontrados
        """
        try:
            return self.provider.search_ticker(query)
        except Exception as e:
            print(f"Erro ao buscar tickers para '{query}': {e}")
            return []
    
    def extract_with_asset_classification(
        self,
        ticker: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Extrai dados com classificação automática do tipo de ativo.
        
        Args:
            ticker: Símbolo do ativo
            start_date: Data inicial
            end_date: Data final
            
        Returns:
            Resultado com classificação detalhada
        """
        # Análise do ticker
        analysis = self.analyze_ticker(ticker)
        
        # Extração com dados
        extraction_result = self.extract_asset_with_data(
            ticker, start_date, end_date
        )
        
        # Combinar resultados
        return {
            **extraction_result,
            'ticker_analysis': analysis,
            'inferred_type': analysis.get('inferred_type'),
            'patterns_matched': analysis.get('patterns_matched', []),
            'provider_classification': analysis.get('provider_info', {}).get('asset_type')
        }
    
    def get_supported_asset_types(self) -> List[str]:
        """
        Retorna tipos de ativos suportados.
        
        Returns:
            Lista de tipos suportados
        """
        return ['equity', 'index', 'currency', 'commodity', 'bond', 'option', 'etf']
    
    def disconnect(self) -> None:
        """Desconecta do provider."""
        self.provider.disconnect()
    
    def __del__(self):
        """Destrutor para garantir desconexão."""
        if hasattr(self, 'provider'):
            self.provider.disconnect()


# Funções de conveniência para compatibilidade
def get_yahoo_data(ticker: str) -> pd.DataFrame:
    """
    Função de conveniência compatível com o script antigo.
    
    Args:
        ticker: Símbolo do ativo
        
    Returns:
        DataFrame com dados históricos
    """
    extractor = YahooFinanceExtractor()
    try:
        return extractor.get_yahoo_data(ticker)
    finally:
        extractor.disconnect()


def extract_asset_with_classification(ticker: str) -> Dict[str, Any]:
    """
    Função de conveniência para extrair ativo com classificação.
    
    Args:
        ticker: Símbolo do ativo
        
    Returns:
        Resultado da extração com classificação
    """
    extractor = YahooFinanceExtractor()
    try:
        return extractor.extract_with_asset_classification(ticker)
    finally:
        extractor.disconnect()


def analyze_multiple_tickers(tickers: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Analisa múltiplos tickers de uma vez.
    
    Args:
        tickers: Lista de tickers
        
    Returns:
        Dicionário com análises
    """
    extractor = YahooFinanceExtractor()
    try:
        results = {}
        for ticker in tickers:
            results[ticker] = extractor.analyze_ticker(ticker)
        return results
    finally:
        extractor.disconnect()


# Mantém compatibilidade com imports existentes
__all__ = [
    'YahooFinanceExtractor',
    'get_yahoo_data',
    'extract_asset_with_classification', 
    'analyze_multiple_tickers'
]

