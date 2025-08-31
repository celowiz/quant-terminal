"""
Interface abstrata para provedores de dados financeiros.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, List, Dict, Any
import pandas as pd

from ..assets.base import MarketData


class DataProviderError(Exception):
    """Exceção personalizada para erros de data providers."""
    pass


class IDataProvider(ABC):
    """
    Interface abstrata para provedores de dados financeiros.
    
    Define os métodos que todos os provedores de dados devem implementar
    para garantir compatibilidade e intercambiabilidade.
    """
    
    def __init__(self, name: str, **config):
        """
        Inicializa o data provider.
        
        Args:
            name: Nome do provider
            **config: Configurações específicas do provider
        """
        self.name = name
        self.config = config
        self.is_connected = False
    
    @abstractmethod
    def connect(self) -> bool:
        """
        Estabelece conexão com a fonte de dados.
        
        Returns:
            True se conectado com sucesso, False caso contrário
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """
        Encerra conexão com a fonte de dados.
        """
        pass
    
    @abstractmethod
    def get_historical_data(
        self,
        ticker: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Obtém dados históricos para um ticker.
        
        Args:
            ticker: Símbolo do ativo
            start_date: Data inicial (opcional)
            end_date: Data final (opcional)
            interval: Intervalo dos dados (1d, 1h, etc.)
            
        Returns:
            DataFrame com colunas padronizadas: time, open, high, low, close, adj_close, volume
            
        Raises:
            DataProviderError: Se houver erro na obtenção dos dados
        """
        pass
    
    @abstractmethod
    def get_latest_price(self, ticker: str) -> Optional[float]:
        """
        Obtém o último preço disponível para um ticker.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Último preço ou None se não disponível
            
        Raises:
            DataProviderError: Se houver erro na obtenção do preço
        """
        pass
    
    @abstractmethod
    def get_asset_info(self, ticker: str) -> Dict[str, Any]:
        """
        Obtém informações básicas do ativo.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            Dicionário com informações do ativo (nome, moeda, bolsa, etc.)
            
        Raises:
            DataProviderError: Se houver erro na obtenção das informações
        """
        pass
    
    @abstractmethod
    def is_available(self, ticker: str) -> bool:
        """
        Verifica se o ticker está disponível no provider.
        
        Args:
            ticker: Símbolo do ativo
            
        Returns:
            True se disponível, False caso contrário
        """
        pass
    
    @abstractmethod
    def search_ticker(self, query: str) -> List[Dict[str, str]]:
        """
        Busca tickers baseado em uma consulta.
        
        Args:
            query: Termo de busca
            
        Returns:
            Lista de dicionários com informações dos tickers encontrados
            
        Raises:
            DataProviderError: Se houver erro na busca
        """
        pass
    
    def normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Normaliza um DataFrame para o formato padrão.
        
        Args:
            df: DataFrame original
            
        Returns:
            DataFrame normalizado com colunas padronizadas
        """
        if df.empty:
            return pd.DataFrame(columns=[
                'time', 'open', 'high', 'low', 'close', 'adj_close', 'volume'
            ])
        
        # Mapear colunas comuns
        column_mapping = {
            'Date': 'time',
            'Open': 'open', 
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Adj Close': 'adj_close',
            'Adjusted Close': 'adj_close',
            'Volume': 'volume'
        }
        
        # Renomear colunas se existirem
        df_normalized = df.copy()
        for old_col, new_col in column_mapping.items():
            if old_col in df_normalized.columns:
                df_normalized = df_normalized.rename(columns={old_col: new_col})
        
        # Garantir que a coluna time seja datetime
        if 'time' in df_normalized.columns:
            df_normalized['time'] = pd.to_datetime(df_normalized['time'])
        
        # Converter colunas numéricas
        numeric_columns = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
        for col in numeric_columns:
            if col in df_normalized.columns:
                df_normalized[col] = pd.to_numeric(df_normalized[col], errors='coerce')
        
        # Garantir presença das colunas obrigatórias
        required_columns = ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']
        for col in required_columns:
            if col not in df_normalized.columns:
                if col == 'time':
                    df_normalized[col] = pd.NaT
                else:
                    df_normalized[col] = float('nan')
        
        return df_normalized[required_columns]
    
    def to_market_data_list(self, df: pd.DataFrame) -> List[MarketData]:
        """
        Converte DataFrame normalizado para lista de MarketData.
        
        Args:
            df: DataFrame normalizado
            
        Returns:
            Lista de objetos MarketData
        """
        market_data_list = []
        
        for _, row in df.iterrows():
            try:
                # Converter time para datetime se for string
                time_value = row['time']
                if isinstance(time_value, str):
                    # Tentar diferentes formatos de data
                    try:
                        # Formato DD-MM-YYYY (Yahoo Finance brasileiro)
                        time_value = datetime.strptime(time_value, '%d-%m-%Y')
                    except ValueError:
                        try:
                            # Formato YYYY-MM-DD (ISO)
                            time_value = datetime.strptime(time_value, '%Y-%m-%d')
                        except ValueError:
                            try:
                                # Formato MM/DD/YYYY (US)
                                time_value = datetime.strptime(time_value, '%m/%d/%Y')
                            except ValueError:
                                # Se nenhum formato funcionar, usar pd.to_datetime como fallback
                                time_value = pd.to_datetime(time_value)
                elif pd.isna(time_value):
                    # Pular linhas com time inválido
                    continue
                
                market_data = MarketData(
                    time=time_value,
                    open=row['open'] if not pd.isna(row['open']) else None,
                    high=row['high'] if not pd.isna(row['high']) else None,
                    low=row['low'] if not pd.isna(row['low']) else None,
                    close=row['close'] if not pd.isna(row['close']) else None,
                    adj_close=row['adj_close'] if not pd.isna(row['adj_close']) else None,
                    volume=int(row['volume']) if not pd.isna(row['volume']) else None
                )
                market_data_list.append(market_data)
            except Exception as e:
                # Log do erro e continua processamento
                print(f"Erro ao converter linha para MarketData: {e}")
                continue
        
        return market_data_list
    
    def __str__(self) -> str:
        return f"DataProvider: {self.name} (Connected: {self.is_connected})"
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name='{self.name}', connected={self.is_connected})>"

