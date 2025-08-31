# Data Pipeline

Esta pasta contém todo o pipeline de ETL (Extract, Transform, Load) para coleta e processamento de dados financeiros.

## Estrutura

```
data_pipeline/
├── assets/              # Configurações de ativos manuais
│   └── manual_assets.yaml
├── extract/             # Módulos de extração de dados
├── load/               # Módulos de persistência em banco
├── daily_flow.py       # Pipeline principal do Prefect
└── __init__.py
```

## Extract - Extração de Dados

Módulos para coleta de dados de diferentes fontes:

### Fontes de Dados
- **yahoo_finance.py**: Dados do Yahoo Finance (preços, informações)
- **b3_tickers.py**: Lista de tickers da B3
- **wikipedia_tickers.py**: Tickers S&P 500 da Wikipedia
- **b3_sectors.py**: Setores da B3
- **anbima.py**: Dados de fluxo de fundos da ANBIMA
- **bcb.py**: Dados do Banco Central
- **fred.py**: Dados do Federal Reserve (FRED)
- **manual_assets.py**: Carrega ativos do arquivo YAML

### Configuração Manual
O arquivo `assets/manual_assets.yaml` contém listas curadas de:
- Moedas (BRL, USD, EUR, etc.)
- Criptomoedas (BTC, ETH, etc.)
- Commodities (ouro, petróleo, etc.)
- Títulos de governo
- Índices internacionais
- ETFs

## Load - Persistência

Módulos para salvar dados nos bancos:

- **yahoo_assets_dao.py**: Persiste ativos no banco NoSQL (TinyDB)
- **market_data.py**: Salva dados de preços no SQLite
- **universe.py**: Gerencia universo de ativos

## Pipeline Principal

### daily_flow.py
Flow principal do Prefect que orquestra todo o processo de coleta de dados:

**Etapas:**
1. **Extração de Tickers**: Coleta tickers da B3, S&P 500 e lista manual
2. **Atualização de Setores**: Obtém informações setoriais da B3
3. **Coleta Yahoo Finance**: Busca dados de preços e informações dos ativos
4. **Persistência**: Salva dados nos bancos SQLite e TinyDB
5. **Logging**: Registra todas as operações

**Características:**
- Rate limiting para respeitar limites do Yahoo Finance
- Processamento paralelo com ThreadPoolExecutor
- Cache para evitar requisições repetidas
- Tratamento robusto de erros
- Logging detalhado para auditoria

## Configurações

O pipeline utiliza as configurações em `backend/config.py`:

```python
# Bancos de dados
DB_PATH_YAHOO_ASSETS    # TinyDB para ativos
DB_PATH_DAILY_PRICES    # SQLite para preços
DB_PATH_CADASTRO        # SQLite para cadastro

# Diretórios
LOG_DIR                 # Logs com rotação diária
ARTIFACTS_DIR           # Status e DAG do pipeline

# Yahoo Finance
YAHOO_TIMEOUT = 10      # Timeout das requisições
YAHOO_RETRIES = 3       # Tentativas em caso de erro
```

## Execução

### Via API
```bash
POST /flows/daily/run   # Executar pipeline
GET /flows/daily/status # Status da última execução
```

### Via Linha de Comando
```bash
# Executar pipeline completo
uv run python -m backend.data_pipeline.daily_flow

# Atualizar apenas setores
uv run python -m backend.data_pipeline.extract.update_ticker_sectors
```

## Monitoramento

O pipeline gera:
- **Logs diários**: `backend/logs/DD-MM-YYYY.log`
- **Status da execução**: `backend/artifacts/daily_last_run.json`
- **DAG da execução**: `backend/artifacts/daily_dag.json`

## Performance

Otimizações implementadas:
- Uso de TinyDB (NoSQL) para melhor performance vs SQLite complexo
- Processamento paralelo de requisições
- Cache de dados para evitar duplicações
- Rate limiting inteligente
- Conexões persistentes quando possível

## Dados Processados

O pipeline coleta e processa:
- **~500 tickers** S&P 500
- **~100 tickers** B3 principais
- **~50 ativos manuais** (moedas, commodities, etc.)
- **Dados históricos** de preços
- **Informações fundamentais** e setoriais
- **Metadados** de bolsas e classificações
