# Frontend (Next.js)

Aplicação Next.js (React + TypeScript + Tailwind) para o Terminal Quant.

## Scripts

- `npm run dev`: inicia Next em desenvolvimento (http://localhost:3000)
- `npm run build`: build de produção
- `npm start`: executa build

## Estrutura

- `src/app/` — App Router (páginas e rotas dinâmicas)
  - `/` — Home
  - `/gp` e `/gp/[ticker]`
  - `/gpc` e `/gpc/[ticker]`
- `src/components/` — componentes reutilizáveis (TopBar, Header, etc.)
- `src/pages/` — lógica de páginas reutilizada pelos wrappers do App Router

## Integração com API

- A API roda em `http://localhost:8000`
- Exemplos de endpoints usados:
  - `GET /tickers/`, `GET /name/{ticker}`
  - `GET /info/{ticker}`, `GET /prices/{ticker}`

## Rodando local

No PowerShell (Windows):
```
cd frontend
npm install
npm run dev
```