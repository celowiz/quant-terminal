# Database

Esta pasta contém os bancos de dados SQLite e arquivos de dados do sistema.

## Estrutura

```
database/
├── daily_prices.db           # Banco principal com dados de preços
├── cadastro.db             # Cadastro de ativos e metadados
├── yahoo_assets.json       # Dados JSON dos ativos (TinyDB)
```

## Bancos de Dados

### daily_prices.db
Banco principal contendo dados históricos de preços organizados por ticker.

**Estrutura:**
- Uma **tabela por ticker** (ex: PETR4, AAPL, ^BVSP)
- Colunas padronizadas: `time`, `open`, `high`, `low`, `close`, `adj_close`, `volume`
- Índices otimizados para consultas por data
- Dados diários e intraday quando disponíveis

**Exemplo de consulta:**
```sql
SELECT * FROM PETR4 
WHERE time >= '2024-01-01' 
ORDER BY time DESC 
LIMIT 100;
```

### cadastro.db
Banco de cadastro com informações complementares de ativos.

**Tabelas principais:**
- **assets**: Registro básico de ativos
- **sectors**: Informações setoriais
- **exchanges**: Dados de bolsas de valores
- **metadata**: Metadados diversos

**Relacionamentos:**
- assets → sectors (classificação setorial)
- assets → exchanges (bolsa de negociação)

### yahoo_assets.json (TinyDB)
Banco NoSQL otimizado para performance contendo dados completos do Yahoo Finance.

**Vantagens do TinyDB:**
- **Performance superior** ao SQLite para dados JSON complexos
- **Schema flexível** para acomodar diferentes tipos de ativos
- **Consultas rápidas** por ticker
- **Sem overhead** de joins complexos

**Estrutura do documento:**
```json
{
  "ticker": "PETR4.SA",
  "name": "Petróleo Brasileiro S.A. - Petrobras",
  "currency": "BRL",
  "exchange": "SAO",
  "asset_type": "equity",
  "sector": "Energy",
  "industry": "Oil & Gas Integrated",
  "market_cap": 500000000000,
  "last_updated": "2024-01-15T10:30:00",
  "active": true
}
```

## Configuração

Os caminhos dos bancos são definidos em `backend/config.py`:

```python
# Bancos de dados
DB_PATH_DAILY_PRICES = "backend/database/daily_prices.db"           # Preços
DB_PATH_CADASTRO = "backend/database/cadastro.db"    # Cadastro
DB_PATH_YAHOO_ASSETS = "backend/database/yahoo_assets.json"  # TinyDB

```

## Manutenção

### Backup
```bash
# Backup dos bancos SQLite
cp backend/database/daily_prices.db backup/market_data_$(date +%Y%m%d).db
cp backend/database/cadastro.db backup/cadastro_$(date +%Y%m%d).db

# Backup do TinyDB
cp backend/database/yahoo_assets.json backup/yahoo_assets_$(date +%Y%m%d).json
```

### Limpeza
```bash
# Limpar todos os bancos (cuidado!)
uv run python -m backend.clear_databases

# Limpar apenas dados antigos
sqlite3 backend/database/daily_prices.db "DELETE FROM PETR4 WHERE time < '2023-01-01'"
```

### Vacuum (Otimização)
```bash
# Otimizar bancos SQLite
sqlite3 backend/database/daily_prices.db "VACUUM;"
sqlite3 backend/database/cadastro.db "VACUUM;"
```

## Performance

### Índices Recomendados
```sql
-- daily_prices.db (aplicar em cada tabela de ticker)
CREATE INDEX IF NOT EXISTS idx_time ON PETR4(time);
CREATE INDEX IF NOT EXISTS idx_date_range ON PETR4(time, close);

-- cadastro.db
CREATE INDEX IF NOT EXISTS idx_ticker ON assets(ticker);
CREATE INDEX IF NOT EXISTS idx_active ON assets(active);
```

### Estatísticas Típicas
- **daily_prices.db**: ~500MB (dados de 2+ anos)
- **cadastro.db**: ~500KB (metadados)
- **yahoo_assets.json**: ~50KB (dados atuais de ~650 ativos)

### Consultas Otimizadas
```sql
-- Busca eficiente por período
SELECT time, close FROM PETR4 
WHERE time BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY time;

-- Última cotação
SELECT * FROM PETR4 
ORDER BY time DESC 
LIMIT 1;

-- Estatísticas de volume
SELECT 
    AVG(volume) as avg_volume,
    MAX(volume) as max_volume,
    MIN(close) as min_price,
    MAX(close) as max_price
FROM PETR4 
WHERE time >= '2024-01-01';
```

## Migração

### Do Asset Factory para Novo Sistema
```python
# Script de migração (executado automaticamente)
from backend.data_pipeline.load.yahoo_assets_dao import YahooAssetsDAO
from backend.assets.base import Asset

# Migrar dados do SQLite antigo para TinyDB novo
dao = YahooAssetsDAO()
# ... código de migração
```

### Estrutura de Dados Antiga vs Nova
**Antiga (Asset Factory):**
- Múltiplas tabelas por tipo (equities, indices, currencies)
- Schema rígido com colunas específicas
- Joins complexos para consultas
- Performance limitada para dados JSON

**Nova (Asset Unificado):**
- Documento único por ativo no TinyDB
- Schema flexível para todos os tipos
- Consultas diretas sem joins
- Performance otimizada

## Monitoramento

### Tamanho dos Bancos
```bash
# Script para monitorar tamanho
du -sh backend/database/*
# daily_prices.db: 505MB
# cadastro.db: 448KB  
# yahoo_assets.json: 14KB
```

### Verificação de Integridade
```bash
# SQLite integrity check
sqlite3 backend/database/daily_prices.db "PRAGMA integrity_check;"
sqlite3 backend/database/cadastro.db "PRAGMA integrity_check;"
```

### Estatísticas de Uso
```sql
-- Contar tabelas no daily_prices.db
SELECT COUNT(*) as total_tables 
FROM sqlite_master 
WHERE type='table' AND name NOT LIKE 'sqlite_%';

-- Contar registros por ticker (top 10)
SELECT 
    name as ticker,
    (SELECT COUNT(*) FROM main.[||name||]) as record_count
FROM sqlite_master 
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY record_count DESC 
LIMIT 10;
```

## Troubleshooting

### Problemas Comuns

**Banco bloqueado:**
```bash
# Verificar processos usando o banco
lsof backend/database/daily_prices.db

# Forçar desbloqueio
sqlite3 backend/database/daily_prices.db ".timeout 30000"
```

**Corrupção de dados:**
```bash
# Dump e restauração
sqlite3 backend/database/daily_prices.db ".dump" > backup.sql
rm backend/database/daily_prices.db
sqlite3 backend/database/daily_prices.db < backup.sql
```

**TinyDB corrompido:**
```bash
# Backup e regeneração
cp backend/database/yahoo_assets.json backup/
# Executar pipeline para regenerar dados
uv run python -m backend.data_pipeline.daily_flow
```

### Logs de Diagnóstico
```bash
# Verificar logs de acesso aos bancos
grep "database" backend/logs/$(date +%d-%m-%Y).log

# Monitorar operações em tempo real
tail -f backend/logs/$(date +%d-%m-%Y).log | grep -E "(SELECT|INSERT|UPDATE|DELETE)"
```
