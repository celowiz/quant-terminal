# Assets

Esta pasta contém a implementação da nova arquitetura de ativos simplificada.

## Estrutura

```
assets/
└── base.py         # Classes Asset e MarketData unificadas
```

## Principais Classes

### Asset
Classe única simplificada que substitui as múltiplas classes de ativos específicos (Equity, Index, Currency, etc.) que existiam anteriormente.

**Características:**
- Armazena todas as informações vindas do Yahoo Finance
- Sem distinção de tipo específico de ativo
- Campos flexíveis para diferentes tipos de instrumentos
- Validação automática de ticker e moeda
- Método factory `from_yahoo_info()` para criação a partir de dados do Yahoo

**Campos principais:**
- `ticker`: Símbolo do ativo (sempre maiúsculo)
- `name`: Nome do ativo
- `currency`: Moeda de cotação
- `exchange`: Bolsa onde é negociado
- `asset_type`: Tipo inferido pelo Yahoo Finance
- `sector`, `industry`: Informações setoriais
- `market_cap`, `shares_outstanding`: Dados fundamentais
- `yahoo_info`: Dados completos do Yahoo Finance (JSON)

### MarketData
Estrutura para dados de mercado OHLCV (Open, High, Low, Close, Volume).

**Campos:**
- `time`: Timestamp do dado
- `open`, `high`, `low`, `close`: Preços OHLC
- `adj_close`: Preço ajustado
- `volume`: Volume negociado

## Vantagens da Nova Arquitetura

1. **Simplicidade**: Uma única classe para todos os tipos de ativos
2. **Flexibilidade**: Campos dinâmicos baseados nos dados do Yahoo Finance
3. **Performance**: Menos overhead de classes específicas
4. **Manutenibilidade**: Código mais simples e fácil de manter
5. **Extensibilidade**: Fácil adição de novos campos sem modificar estrutura

## Migração

A nova arquitetura substitui o sistema anterior de Asset Factory que tinha classes específicas para cada tipo de ativo. Todos os dados são agora armazenados na classe `Asset` unificada, com informações específicas mantidas no campo `yahoo_info`.

## Uso

```python
from backend.assets.base import Asset, MarketData

# Criar asset a partir de dados do Yahoo
yahoo_data = {...}  # Dados do Yahoo Finance
asset = Asset.from_yahoo_info("PETR4", yahoo_data)

# Atualizar asset
asset.update_from_yahoo(new_yahoo_data)

# Criar dados de mercado
market_data = MarketData(
    time=datetime.now(),
    open=Decimal("25.50"),
    high=Decimal("26.00"),
    low=Decimal("25.30"),
    close=Decimal("25.80"),
    volume=1000000
)
```
