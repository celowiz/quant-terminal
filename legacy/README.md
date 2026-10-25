# Quant Monorepo

Coleta, processamento e visualização de dados financeiros.

## Estrutura

- `backend/` — ETL/ELT e API FastAPI
- `frontend/` — Frontend Next.js (React + TS + Tailwind)
- `backend/database/` — SQLite:
  - `daily_prices.db`: tabelas de preços (uma por ticker)
  - `cadastro.db`: cadastro de ativos, setores, etc.

## Requisitos

- Python 3.13+ (gerenciado por `uv`)
- Node.js 18+

## Como rodar (Windows PowerShell)

1) API FastAPI

```
uv run uvicorn backend.api.main:app --reload --port 8000
```

2) Frontend Next.js

```
cd frontend
npm install
npm run dev
```

3) Pipeline diário (ad hoc)

```
uv run -m backend.data_pipeline.flows.daily_flow
```

Ou use o `run_services.py` para iniciar API e frontend juntos:

```
uv run python run_services.py
```