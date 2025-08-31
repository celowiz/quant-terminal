# Backend

Sistema de coleta, processamento e distribuição de dados financeiros usando uma arquitetura moderna baseada em Python, FastAPI e pipeline de dados automatizado.

## 🏗️ Arquitetura

```
backend/
├── 🌐 api/                    # API FastAPI
│   ├── models/               # Schemas Pydantic  
│   ├── routers/              # Endpoints organizados
│   └── main.py               # Aplicação principal
├── 📊 assets/                # Classes de ativos unificadas
├── 🔄 data_pipeline/         # Pipeline ETL completo
│   ├── assets/               # Configurações manuais
│   ├── extract/              # Extratores de dados
│   ├── load/                 # Persistência em banco
│   └── daily_flow.py         # Orquestrador principal
├── 📡 data_providers/        # Provedores de dados
├── 💾 database/              # Bancos de dados
├── 📝 logs/                  # Logs com rotação diária
├── 📈 notebooks/             # Análises e protótipos
├── 🧪 tests/                 # Scripts de validação
├── 🔧 utils/                 # Utilitários diversos
├── 📋 artifacts/             # Status e metadados
└── ⚙️ config.py              # Configurações centrais
```

## 🚀 Principais Funcionalidades

### Pipeline de Dados Automatizado
- **Coleta diária** de ~650 ativos (B3, S&P 500, commodities, moedas)
- **Múltiplas fontes**: Yahoo Finance, B3, Wikipedia, ANBIMA, BCB
- **Processamento paralelo** com rate limiting inteligente
- **Persistência otimizada** em SQLite + TinyDB
- **Monitoramento** completo com logs e métricas

### API REST Completa
- **FastAPI** com documentação automática
- **Endpoints especializados** por funcionalidade
- **Schemas validados** com Pydantic
- **Performance otimizada** com cache e queries eficientes

### Nova Arquitetura de Ativos
- **Classe Asset unificada** substituindo sistema complexo anterior
- **Schema flexível** para diferentes tipos de instrumentos
- **Integração nativa** com Yahoo Finance
- **Performance superior** sem overhead de classes específicas

## 📊 Dados Processados

| Categoria | Quantidade | Fonte Principal |
|-----------|------------|-----------------|
| **Ações B3** | ~150 tickers | B3 + Yahoo Finance |
| **S&P 500** | ~500 tickers | Wikipedia + Yahoo Finance |
| **Moedas** | ~20 pares | Yahoo Finance |
| **Commodities** | ~15 ativos | Yahoo Finance |
| **Índices** | ~10 principais | Yahoo Finance |
| **ETFs** | ~30 fundos | Yahoo Finance |

## 🔧 Como Executar

### Iniciar API (Desenvolvimento)
```bash
uv run uvicorn backend.api.main:app --reload --port 8000
```

### Executar Pipeline de Dados
```bash
# Pipeline completo
uv run python -m backend.data_pipeline.daily_flow

# Apenas setores B3
uv run python -m backend.data_pipeline.extract.update_ticker_sectors
```

### Executar Testes
```bash
# Todos os testes
uv run python backend/tests/test_yahoo_finance.py
uv run python backend/tests/test_wikipedia.py
uv run python backend/tests/test_read_market_db.py

# Teste específico
uv run python backend/tests/test_yahoo_finance.py
```

### Limpeza e Manutenção
```bash
# Limpar bancos de dados
uv run python -m backend.clear_databases

# Ver logs em tempo real
tail -f backend/logs/$(date +%d-%m-%Y).log

# Monitorar status do pipeline
cat backend/artifacts/daily_last_run.json | jq
```

## 🌐 API Endpoints

### Dados de Ativos
- `GET /` - Informações da API
- `GET /tickers/` - Lista de tickers disponíveis
- `GET /info/{ticker}` - Informações detalhadas (setor, fundamentals)
- `GET /prices/{ticker}` - Dados históricos OHLCV
- `GET /stats/{ticker}` - Estatísticas e métricas

### Pipeline e Monitoramento
- `POST /flows/daily/run` - Executar pipeline diário
- `GET /flows/daily/status` - Status da última execução
- `GET /rrg/` - Dados para Relative Rotation Graph

### Dados Especializados
- `GET /funds-flow/` - Fluxo de fundos ANBIMA
- `GET /name/{query}` - Busca por nome de ativo

## 💾 Bancos de Dados

### daily_prices.db (SQLite)
- **Dados históricos** de preços por ticker
- **Estrutura**: Uma tabela por ticker com colunas OHLCV
- **Tamanho típico**: ~500MB
- **Otimização**: Índices por data para consultas rápidas

### yahoo_assets.json (TinyDB)
- **Dados atuais** de ativos com schema flexível
- **Performance superior** para dados JSON complexos
- **Tamanho típico**: ~50KB
- **Vantagem**: Sem overhead de joins, consultas diretas

### cadastro.db (SQLite)
- **Metadados** de ativos, setores, bolsas
- **Dados relacionais** complementares
- **Tamanho típico**: ~500KB

## 📈 Performance

### Otimizações Implementadas
- **TinyDB** para dados JSON vs SQLite complexo
- **Processamento paralelo** com ThreadPoolExecutor
- **Rate limiting** inteligente por provider
- **Cache** de dados para evitar requisições repetidas
- **Conexões persistentes** quando possível

### Métricas Típicas
- **Pipeline completo**: 5-15 minutos
- **Coleta por ticker**: 0.5-2 segundos
- **Consulta API**: 10-50ms
- **Taxa de sucesso**: >95%

## 🔍 Monitoramento

### Logs Estruturados
- **Rotação diária** automática
- **Níveis**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Formato padronizado** com timestamps
- **Módulos identificados** para troubleshooting

### Artefatos de Execução
- **Status detalhado** em `artifacts/daily_last_run.json`
- **Estrutura do DAG** em `artifacts/daily_dag.json`
- **Métricas de performance** e estatísticas
- **Metadados** de ambiente e configuração

### Dashboards e Alertas
- Status em tempo real via endpoints `/flows/daily/status`
- Métricas históricas para análise de tendências
- Alertas automáticos para falhas ou anomalias

## 🧪 Qualidade e Testes

### Validação Automática
- **Testes de integração** com provedores externos
- **Validação de dados** OHLCV
- **Verificação de integridade** do banco
- **Análise de performance** das consultas

### Tratamento de Erros
- **Rate limiting** respeitoso com APIs externas
- **Retry automático** com backoff exponencial
- **Graceful degradation** em falhas parciais
- **Logs detalhados** para debugging

## 🔧 Configuração

### Variáveis Principais (config.py)
```python
# Bancos de dados
DB_PATH_DAILY_PRICES = "backend/database/daily_prices.db"
DB_PATH_YAHOO_ASSETS = "backend/database/yahoo_assets.json"
DB_PATH_CADASTRO = "backend/database/cadastro.db"

# Diretórios
LOG_DIR = "backend/logs"
ARTIFACTS_DIR = "backend/artifacts"

# Yahoo Finance
YAHOO_TIMEOUT = 10          # Timeout das requisições
YAHOO_RETRIES = 3           # Tentativas em caso de erro
```

### Dependências Principais
- **FastAPI**: Framework web moderno
- **Pydantic**: Validação de dados
- **pandas**: Manipulação de DataFrames
- **yfinance**: Coleta de dados Yahoo Finance
- **TinyDB**: Banco NoSQL leve
- **Prefect**: Orquestração de workflows
- **SQLite**: Banco relacional embutido

## 🚀 Próximos Passos

### Melhorias Planejadas
- [ ] **Cache distribuído** com Redis
- [ ] **APIs adicionais** (Alpha Vantage, Quandl)
- [ ] **Processamento streaming** com Apache Kafka
- [ ] **Containerização** com Docker
- [ ] **CI/CD** automatizado
- [ ] **Monitoramento avançado** com Prometheus/Grafana

### Expansão de Dados
- [ ] **Dados fundamentais** detalhados
- [ ] **Options e derivativos**
- [ ] **Dados macroeconômicos** (BCB, FRED)
- [ ] **Notícias e sentiment** analysis
- [ ] **Dados ESG** e sustentabilidade

## 📚 Documentação Adicional

Cada pasta principal contém seu próprio README.md com detalhes específicos:

- [`api/README.md`](api/README.md) - Detalhes da API FastAPI
- [`assets/README.md`](assets/README.md) - Nova arquitetura de ativos
- [`data_pipeline/README.md`](data_pipeline/README.md) - Pipeline ETL completo
- [`data_providers/README.md`](data_providers/README.md) - Provedores de dados
- [`tests/README.md`](tests/README.md) - Scripts de validação
- [`utils/README.md`](utils/README.md) - Utilitários diversos
- [`database/README.md`](database/README.md) - Estrutura dos bancos
- [`logs/README.md`](logs/README.md) - Sistema de logging
- [`artifacts/README.md`](artifacts/README.md) - Artefatos de execução
- [`notebooks/README.md`](notebooks/README.md) - Análises e protótipos

## 🤝 Contribuição

### Padrões de Desenvolvimento
- **Type hints** obrigatórios em funções públicas
- **Docstrings** detalhadas com exemplos
- **Logging estruturado** para todas as operações
- **Testes automatizados** para novas funcionalidades
- **Validação de dados** robusta

### Estrutura de Commits
```
tipo(escopo): descrição

- feat: nova funcionalidade
- fix: correção de bug  
- docs: atualização de documentação
- perf: melhoria de performance
- refactor: refatoração de código
```