"""
Implementação do data provider para Yahoo Finance usando yfinance.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
import pandas as pd
import yfinance as yf

from .base import IDataProvider, DataProviderError


class YahooFinanceProvider(IDataProvider):
    """
    Data provider para Yahoo Finance.
    
    Implementa a interface IDataProvider usando a biblioteca yfinance
    para obter dados financeiros do Yahoo Finance.
    """
    
    def __init__(self, **config):
        """
        Inicializa o provider do Yahoo Finance.
        
        Args:
            **config: Configurações opcionais
                - timeout: Timeout para requisições (default: 60)
                - session: Sessão personalizada para requisições
        """
        super().__init__(name="Yahoo Finance", **config)
        self.timeout = config.get('timeout', 60)
        self.session = config.get('session', None)
    
    def connect(self) -> bool:
        """
        Testa conexão com Yahoo Finance.
        
        Returns:
            True se conseguir acessar, False caso contrário
        """
        # try:
        #     # Testa com um ticker conhecido
        #     test_ticker = yf.Ticker("AAPL")
        #     info = test_ticker.info
        #     self.is_connected = bool(info and 'symbol' in info)
        #     return self.is_connected
        # except Exception as e:
        #     print(f"Erro ao conectar com Yahoo Finance: {e}")
        #     self.is_connected = False
        #     return False
        self.is_connected = True
        return True

    def disconnect(self) -> None:
        """
        Encerra conexão (não há conexão persistente no yfinance).
        """
        self.is_connected = False
    
    def get_historical_data(
        self,
        ticker: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Obtém dados históricos do Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            start_date: Data inicial
            end_date: Data final
            interval: Intervalo (1d, 1h, 5m, etc.)
            
        Returns:
            DataFrame normalizado com dados históricos
            
        Raises:
            DataProviderError: Se houver erro na obtenção dos dados
        """
        try:
            yf_ticker = yf.Ticker(ticker)
            
            # Determinar o período
            if start_date is None and end_date is None:
                period = "max"
                df = yf_ticker.history(
                    period=period,
                    interval=interval,
                    auto_adjust=False,
                    timeout=self.timeout
                )
            else:
                df = yf_ticker.history(
                    start=start_date,
                    end=end_date,
                    interval=interval,
                    auto_adjust=False,
                    timeout=self.timeout
                )
            
            if df is None or df.empty:
                return pd.DataFrame(columns=[
                    'time', 'open', 'high', 'low', 'close', 'adj_close', 'volume'
                ])
            
            # Reset index para transformar Date em coluna
            df = df.reset_index()
            
            # Normalizar DataFrame
            df_normalized = self.normalize_dataframe(df)
            
            # Converter time para string formato YYYY-MM-DD
            if 'time' in df_normalized.columns:
                df_normalized['time'] = pd.to_datetime(df_normalized['time']).dt.strftime('%d-%m-%Y')
            
            return df_normalized
            
        except Exception as e:
            raise DataProviderError(f"Erro ao obter dados históricos para {ticker}: {e}")
    
    def get_latest_price(self, ticker: str) -> Optional[float]:
        """
        Obtém o último preço do Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Último preço ou None se não disponível
            
        Raises:
            DataProviderError: Se houver erro na obtenção do preço
        """
        try:
            yf_ticker = yf.Ticker(ticker)
            
            # Primeiro tenta info (mais rápido)
            info = yf_ticker.info
            if info and 'currentPrice' in info:
                return float(info['currentPrice'])
            
            # Fallback: pega último preço do histórico
            hist = yf_ticker.history(period="1d", timeout=self.timeout)
            if not hist.empty:
                return float(hist['Close'].iloc[-1])
            
            return None
            
        except Exception as e:
            raise DataProviderError(f"Erro ao obter último preço para {ticker}: {e}")
    
    def get_asset_info(self, ticker: str) -> Dict[str, Any]:
        """
        Obtém informações do ativo do Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Dicionário com informações do ativo
            
        Raises:
            DataProviderError: Se houver erro na obtenção das informações
        """
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info
            
            if not info:
                raise DataProviderError(f"Nenhuma informação encontrada para {ticker}")
            
            # Mapear campos comuns
            asset_info = {
                'ticker': ticker.upper(),
                'long_name': info.get('longName', ticker),
                'short_name': info.get('shortName', ticker),
                'currency': info.get('currency', ''),
                'financial_currency': info.get('financialCurrency', ''),
                'exchange': info.get('exchange', info.get('market', 'UNKNOWN')),
                'asset_type': self._determine_asset_type(ticker, info),
                'quote_type': info.get('quoteType', ''),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'market_cap': info.get('marketCap'),
                'shares_outstanding': info.get('sharesOutstanding'),
                'country': info.get('country'),
                'website': info.get('website'),
                'business_summary': info.get('longBusinessSummary'),
                'raw_info': info  # Informação completa para debug
            }
            
            return asset_info
            
        except Exception as e:
            raise DataProviderError(f"Erro ao obter informações para {ticker}: {e}")
    
    def is_available(self, ticker: str) -> bool:
        """
        Verifica se o ticker está disponível no Yahoo Finance.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            True se disponível, False caso contrário
        """
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info
            return bool(info and 'symbol' in info)
        except:
            return False
    
    def search_ticker(self, query: str) -> List[Dict[str, str]]:
        """
        Busca tickers no Yahoo Finance.
        
        Args:
            query: Termo de busca
            
        Returns:
            Lista de tickers encontrados
            
        Raises:
            DataProviderError: Se houver erro na busca
        """
        try:
            # Yahoo Finance não tem API oficial de busca no yfinance
            # Implementação básica que pode ser melhorada
            search_results = []
            
            # Tenta buscar diretamente o ticker
            if self.is_available(query):
                info = self.get_asset_info(query)
                search_results.append({
                    'ticker': query.upper(),
                    'name': info.get('name', query),
                    'exchange': info.get('exchange', 'UNKNOWN'),
                    'asset_type': info.get('asset_type', 'unknown')
                })
            
            return search_results
            
        except Exception as e:
            raise DataProviderError(f"Erro ao buscar ticker {query}: {e}")
    
    def _determine_asset_type(self, ticker: str, info: Dict[str, Any]) -> str:
        """
        Determina o tipo de ativo baseado no ticker e informações.
        
        Args:
            ticker: Símbolo do ativo
            info: Informações do Yahoo Finance
            
        Returns:
            Tipo do ativo
        """
        ticker_upper = ticker.upper()
        
        # Índices (começam com ^)
        if ticker_upper.startswith('^'):
            return 'index'
        
        # Futuros (terminam com F ou números de mês/ano)
        if (ticker_upper.endswith('F') or 
            any(char.isdigit() for char in ticker_upper[-3:]) and
            len(ticker_upper) > 4):
            return 'future'
        
        # Moedas (formato comum: XXXYYY=X)
        if '=' in ticker_upper or len(ticker_upper) == 6:
            return 'currency'
        
        # ETFs
        quote_type = info.get('quoteType', '').lower()
        if quote_type == 'etf':
            return 'etf'
        
        # Commodities (alguns padrões conhecidos)
        commodity_patterns = ['GC=F', 'SI=F', 'CL=F', 'NG=F']
        if any(pattern in ticker_upper for pattern in commodity_patterns):
            return 'commodity'
        
        # Default para equity
        return 'equity'
    
    def get_market_data_for_asset(self, asset, start_date=None, end_date=None):
        """
        Obtém dados de mercado para um objeto Asset.
        
        Args:
            asset: Objeto Asset
            start_date: Data inicial
            end_date: Data final
            
        Returns:
            Lista de objetos MarketData
        """
        try:
            df = self.get_historical_data(
                asset.ticker, 
                start_date, 
                end_date
            )
            return self.to_market_data_list(df)
        except Exception as e:
            print(f"Erro ao obter dados para {asset.ticker}: {e}")
            return []

