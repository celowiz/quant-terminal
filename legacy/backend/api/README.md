# API

Esta pasta contém a API FastAPI que fornece os endpoints para comunicação entre o backend e frontend.

## Estrutura

```
api/
├── models/          # Schemas Pydantic para validação de dados
├── routers/         # Endpoints organizados por funcionalidade
└── main.py         # Aplicação FastAPI principal
```

## Principais Funcionalidades

### Models (Schemas)
- **asset_schemas.py**: Schema simplificado para ativos usando classe Asset unificada
- **market_data_schemas.py**: Schemas para dados de preços (diários, intraday, eventos corporativos)
- **reference_schemas.py**: Schemas para dados de referência (setores, bolsas, moedas, etc.)

### Routers (Endpoints)
- **flows.py**: Endpoints para execução e monitoramento do pipeline de dados
- **info.py**: Informações detalhadas de ativos (setor, fundamentals, etc.)
- **name.py**: Busca de nomes de ativos
- **prices.py**: Dados históricos de preços
- **stats.py**: Estatísticas e métricas de ativos
- **tickers.py**: Lista de tickers disponíveis
- **rrg.py**: Dados para Relative Rotation Graph
- **funds_flow.py**: Fluxo de fundos da ANBIMA

## Como executar

```bash
# Desenvolvimento
uv run uvicorn backend.api.main:app --reload --port 8000

# Produção
uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

## Endpoints principais

- `GET /` - Informações da API
- `GET /tickers/` - Lista de tickers disponíveis
- `GET /prices/{ticker}` - Dados históricos de preços
- `GET /info/{ticker}` - Informações detalhadas do ativo
- `GET /stats/{ticker}` - Estatísticas do ativo
- `POST /flows/daily/run` - Executar pipeline diário
- `GET /flows/daily/status` - Status da última execução

## Configurações

A API usa as configurações definidas em `backend/config.py` para:
- Caminhos dos bancos de dados
- Configurações de logging
- Parâmetros do Yahoo Finance
