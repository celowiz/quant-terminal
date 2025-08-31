# Data Providers

Esta pasta contém os provedores de dados financeiros que implementam interfaces padronizadas para coleta de informações de diferentes fontes.

## Estrutura

```
data_providers/
├── base.py             # Interface base e classes abstratas
├── yahoo_provider.py   # Implementação para Yahoo Finance
└── __init__.py
```

## Arquitetura

### Interface Base (IDataProvider)
Definida em `base.py`, estabelece o contrato que todos os provedores devem seguir:

**Métodos principais:**
- `connect()`: Estabelece conexão com a fonte de dados
- `disconnect()`: Encerra conexão
- `get_historical_data()`: Obtém dados históricos OHLCV
- `get_latest_price()`: Último preço do ativo
- `get_asset_info()`: Informações detalhadas do ativo
- `is_available()`: Verifica se ticker está disponível
- `search_ticker()`: Busca tickers por termo

### Tratamento de Erros
- **DataProviderError**: Exceção específica para erros de providers
- Tratamento padronizado de timeouts e rate limits
- Logs detalhados para auditoria

## Yahoo Finance Provider

### Características
- Baseado na biblioteca `yfinance`
- Suporte a múltiplos tipos de ativos
- Normalização automática de dados
- Rate limiting inteligente
- Detecção automática de tipo de ativo

### Tipos de Ativos Suportados
- **Ações**: Stocks de qualquer bolsa
- **Índices**: Iniciados com '^' (^BVSP, ^GSPC)
- **Moedas**: Pares forex (USDBRL=X)
- **Commodities**: Futuros de commodities
- **ETFs**: Exchange Traded Funds
- **Criptomoedas**: Bitcoin, Ethereum, etc.

### Configurações
```python
provider = YahooFinanceProvider(
    timeout=10,        # Timeout das requisições
    session=None       # Sessão customizada (opcional)
)
```

### Uso

```python
from backend.data_providers.yahoo_provider import YahooFinanceProvider

# Inicializar provider
provider = YahooFinanceProvider()
provider.connect()

# Obter dados históricos
df = provider.get_historical_data(
    ticker="PETR4.SA",
    start_date=datetime(2023, 1, 1),
    end_date=datetime(2023, 12, 31),
    interval="1d"
)

# Obter informações do ativo
info = provider.get_asset_info("AAPL")
print(f"Nome: {info['long_name']}")
print(f"Setor: {info['sector']}")
print(f"Market Cap: {info['market_cap']}")

# Último preço
price = provider.get_latest_price("TSLA")
print(f"Último preço: ${price}")
```

## Normalização de Dados

### DataFrame Padronizado
Todos os provedores retornam DataFrames com colunas padronizadas:
- `time`: Data/hora (formato string DD-MM-YYYY)
- `open`: Preço de abertura
- `high`: Preço máximo
- `low`: Preço mínimo
- `close`: Preço de fechamento
- `adj_close`: Preço ajustado
- `volume`: Volume negociado

### Detecção de Tipo de Ativo
O Yahoo Provider inclui lógica para classificar automaticamente ativos:

```python
def _determine_asset_type(self, ticker: str, info: dict) -> str:
    # Índices começam com ^
    if ticker.startswith('^'):
        return 'index'
    
    # Moedas têm formato específico
    if '=' in ticker or len(ticker) == 6:
        return 'currency'
    
    # ETFs pelo quote_type
    if info.get('quoteType') == 'ETF':
        return 'etf'
    
    # Default: equity
    return 'equity'
```

## Extensibilidade

### Adicionando Novos Providers
Para adicionar uma nova fonte de dados:

1. **Herdar de IDataProvider**:
```python
class AlphaVantageProvider(IDataProvider):
    def __init__(self, api_key: str):
        super().__init__(name="Alpha Vantage")
        self.api_key = api_key
    
    def connect(self) -> bool:
        # Implementar conexão
        pass
    
    def get_historical_data(self, ticker: str, **kwargs) -> pd.DataFrame:
        # Implementar coleta de dados
        pass
```

2. **Registrar no `__init__.py`**:
```python
from .alpha_vantage_provider import AlphaVantageProvider

__all__ = ['YahooFinanceProvider', 'AlphaVantageProvider']
```

### Providers Futuros
Possíveis adições futuras:
- **Alpha Vantage**: Dados fundamentais detalhados
- **Quandl**: Dados econômicos e commodities
- **Bloomberg API**: Dados profissionais
- **B3 API**: Dados diretos da bolsa brasileira
- **CVM**: Dados regulatórios

## Performance e Rate Limiting

### Rate Limiting
- Implementação de delays entre requisições
- Retry automático com backoff exponencial
- Detecção de rate limits por provider

### Cache
- Cache local para evitar requisições repetidas
- TTL configurável por tipo de dado
- Invalidação inteligente de cache

### Threading
- Suporte a processamento paralelo
- Thread-safe para múltiplas requisições simultâneas
- Pool de conexões reutilizáveis

## Monitoramento

### Logs
Todos os providers geram logs detalhados:
```
2024-01-15 10:30:15 [INFO] YahooProvider: Conectado com sucesso
2024-01-15 10:30:16 [DEBUG] YahooProvider: Coletando PETR4.SA (1d, 30 dias)
2024-01-15 10:30:17 [INFO] YahooProvider: 30 registros coletados para PETR4.SA
```

### Métricas
- Tempo de resposta por requisição
- Taxa de sucesso/erro
- Volume de dados coletados
- Status de conexão
