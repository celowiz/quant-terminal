# Logs

Esta pasta contém os arquivos de log do sistema com rotação diária automática.

## Estrutura

```
logs/
├── DD-MM-YYYY.log          # Logs do dia (formato brasileiro)
├── 15-01-2025.log          # Exemplo: logs do dia 15/01/2025
├── 16-01-2025.log          # Exemplo: logs do dia 16/01/2025
└── ...
```

## Sistema de Logging

### Rotação Diária
- **Um arquivo por dia** no formato `DD-MM-YYYY.log`
- **Criação automática** de novos arquivos à meia-noite
- **Sem limite de tamanho** individual por arquivo
- **Retenção manual** (não há limpeza automática)

### Configuração
Definida em `backend/utils/logging_utils.py`:

```python
def setup_daily_rotating_logger(logger_name: str, log_dir: str) -> logging.Logger:
    # Configuração padrão do sistema
    # Formato: YYYY-MM-DD HH:MM:SS [LEVEL] module: message
    # Output: arquivo + console
```

### Formato Padrão
```
2025-01-15 10:30:15 [INFO] YahooFinanceExtractor: Iniciando coleta de dados para PETR4
2025-01-15 10:30:16 [DEBUG] YahooFinanceProvider: Conectando com Yahoo Finance
2025-01-15 10:30:17 [INFO] daily_flow: 247 registros coletados para PETR4
2025-01-15 10:30:18 [ERROR] YahooFinanceExtractor: Timeout ao coletar INVALID_TICKER
```

**Campos:**
- **Timestamp**: Data e hora completa (YYYY-MM-DD HH:MM:SS)
- **Level**: INFO, DEBUG, WARNING, ERROR, CRITICAL
- **Module**: Nome do módulo/classe que gerou o log
- **Message**: Mensagem descritiva da operação

## Níveis de Log

### DEBUG
Informações detalhadas para desenvolvimento e troubleshooting.
```
2025-01-15 10:30:15 [DEBUG] YahooProvider: Request para https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA
2025-01-15 10:30:16 [DEBUG] AssetDAO: Salvando asset PETR4 no banco TinyDB
```

### INFO
Operações normais e marcos importantes do sistema.
```
2025-01-15 10:30:15 [INFO] daily_flow: Pipeline diário iniciado
2025-01-15 10:30:20 [INFO] B3TickersExtractor: 156 tickers B3 coletados
2025-01-15 10:35:45 [INFO] daily_flow: Pipeline concluído com sucesso em 5m 30s
```

### WARNING
Situações que merecem atenção mas não impedem o funcionamento.
```
2025-01-15 10:30:15 [WARNING] YahooProvider: Ticker INVALID123 não encontrado
2025-01-15 10:30:16 [WARNING] WikipediaExtractor: Tabela S&P 500 pode estar desatualizada
```

### ERROR
Erros que impedem operações específicas mas não quebram o sistema.
```
2025-01-15 10:30:15 [ERROR] YahooProvider: Timeout ao buscar dados de PETR4 após 3 tentativas
2025-01-15 10:30:16 [ERROR] DatabaseConnection: Falha ao conectar com daily_prices.db
```

### CRITICAL
Erros graves que podem comprometer todo o sistema.
```
2025-01-15 10:30:15 [CRITICAL] daily_flow: Pipeline falhou completamente - disco cheio
2025-01-15 10:30:16 [CRITICAL] API: Servidor de banco de dados inacessível
```

## Principais Módulos que Logam

### Data Pipeline
- **daily_flow**: Orquestração do pipeline principal
- **YahooFinanceExtractor**: Coleta de dados do Yahoo Finance
- **B3TickersExtractor**: Coleta de tickers da B3
- **WikipediaExtractor**: Coleta de dados da Wikipedia

### Data Providers
- **YahooFinanceProvider**: Operações do provedor Yahoo Finance
- **DataProviderError**: Erros específicos de provedores

### Database
- **YahooAssetsDAO**: Operações no TinyDB de ativos
- **MarketDataDAO**: Operações no SQLite de preços
- **DatabaseConnection**: Conexões e transações

### API
- **FastAPI**: Requests HTTP e responses
- **Routers**: Operações específicas de cada endpoint
- **Middleware**: Logs de performance e segurança

## Monitoramento

### Acompanhamento em Tempo Real
```bash
# Logs do dia atual
tail -f backend/logs/$(date +%d-%m-%Y).log

# Filtrar por nível
tail -f backend/logs/$(date +%d-%m-%Y).log | grep ERROR

# Filtrar por módulo
tail -f backend/logs/$(date +%d-%m-%Y).log | grep "daily_flow"
```

### Análise de Logs
```bash
# Contar erros no dia
grep -c ERROR backend/logs/$(date +%d-%m-%Y).log

# Top 10 módulos que mais logam
grep -o '\[.*\] [^:]*' backend/logs/$(date +%d-%m-%Y).log | sort | uniq -c | sort -nr | head -10

# Buscar padrão específico
grep -i "timeout" backend/logs/$(date +%d-%m-%Y).log

# Estatísticas por nível
echo "=== Estatísticas de Log ==="
echo "DEBUG: $(grep -c DEBUG backend/logs/$(date +%d-%m-%Y).log)"
echo "INFO:  $(grep -c INFO backend/logs/$(date +%d-%m-%Y).log)"
echo "WARN:  $(grep -c WARNING backend/logs/$(date +%d-%m-%Y).log)"
echo "ERROR: $(grep -c ERROR backend/logs/$(date +%d-%m-%Y).log)"
```

### Dashboard de Logs (Exemplo)
```bash
#!/bin/bash
# Script para dashboard simples
clear
echo "📊 Dashboard de Logs - $(date +%d/%m/%Y)"
echo "=========================================="

LOG_FILE="backend/logs/$(date +%d-%m-%Y).log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Arquivo de log não encontrado: $LOG_FILE"
    exit 1
fi

echo "📁 Arquivo: $LOG_FILE"
echo "📏 Tamanho: $(du -h $LOG_FILE | cut -f1)"
echo "🕐 Última modificação: $(stat -c %y $LOG_FILE)"
echo ""

echo "📈 Estatísticas por Nível:"
echo "  🔍 DEBUG:   $(grep -c '\[DEBUG\]' $LOG_FILE)"
echo "  ℹ️  INFO:    $(grep -c '\[INFO\]' $LOG_FILE)"
echo "  ⚠️  WARNING: $(grep -c '\[WARNING\]' $LOG_FILE)"
echo "  ❌ ERROR:   $(grep -c '\[ERROR\]' $LOG_FILE)"
echo "  🚨 CRITICAL:$(grep -c '\[CRITICAL\]' $LOG_FILE)"
echo ""

echo "🔥 Top 5 Módulos Ativos:"
grep -o '\[.*\] [^:]*' $LOG_FILE | cut -d' ' -f2 | sort | uniq -c | sort -nr | head -5
echo ""

echo "⏰ Últimas 5 Entradas:"
tail -5 $LOG_FILE
```

## Manutenção

### Limpeza de Logs Antigos
```bash
# Manter apenas últimos 30 dias
find backend/logs/ -name "*.log" -mtime +30 -delete

# Comprimir logs antigos (>7 dias)
find backend/logs/ -name "*.log" -mtime +7 -exec gzip {} \;

# Script de limpeza automática
cat > scripts/cleanup_logs.sh << 'EOF'
#!/bin/bash
cd backend/logs/

# Comprimir logs >7 dias
find . -name "*.log" -mtime +7 -exec gzip {} \;

# Deletar logs comprimidos >90 dias
find . -name "*.log.gz" -mtime +90 -delete

echo "Limpeza de logs concluída: $(date)"
EOF
```

### Rotação Manual
```bash
# Forçar criação de novo arquivo (util para testes)
mv backend/logs/$(date +%d-%m-%Y).log backend/logs/$(date +%d-%m-%Y).log.old
# O próximo log criará automaticamente um novo arquivo
```

### Backup de Logs
```bash
# Backup mensal
tar -czf backup/logs_$(date +%Y%m).tar.gz backend/logs/*.log

# Sincronizar com storage remoto
rsync -av backend/logs/ user@backup-server:/backups/quant-terminal/logs/
```

## Troubleshooting

### Problemas Comuns

**Logs não aparecem:**
```bash
# Verificar permissões
ls -la backend/logs/
chmod 755 backend/logs/
chmod 644 backend/logs/*.log

# Verificar configuração de logging
python -c "from backend.utils.logging_utils import setup_daily_rotating_logger; print('Config OK')"
```

**Arquivo muito grande:**
```bash
# Verificar tamanho
du -sh backend/logs/*.log

# Comprimir arquivo grande
gzip backend/logs/$(date +%d-%m-%Y).log
```

**Logs duplicados:**
```bash
# Verificar múltiplas instâncias
ps aux | grep -E "(uvicorn|python.*backend)"

# Verificar handlers duplicados no código
grep -r "addHandler" backend/
```

### Análise de Performance
```bash
# Operações mais lentas
grep -E "completed in|took|duration" backend/logs/$(date +%d-%m-%Y).log | sort -k4 -nr

# Requests mais frequentes (API)
grep "GET\|POST" backend/logs/$(date +%d-%m-%Y).log | cut -d' ' -f5 | sort | uniq -c | sort -nr

# Horários de pico
grep -o '^[^ ]* [^ ]*' backend/logs/$(date +%d-%m-%Y).log | cut -d' ' -f2 | cut -d: -f1 | sort | uniq -c
```

## Integração com Monitoramento

### Alertas
```bash
# Alertar em caso de muitos erros
ERROR_COUNT=$(grep -c ERROR backend/logs/$(date +%d-%m-%Y).log)
if [ $ERROR_COUNT -gt 10 ]; then
    echo "🚨 ALERTA: $ERROR_COUNT erros encontrados hoje" | mail -s "Quant Terminal Alert" admin@company.com
fi
```

### Métricas
```bash
# Gerar métricas para Prometheus/Grafana
cat > /tmp/quant_metrics.prom << EOF
# HELP quant_log_entries_total Total log entries by level
# TYPE quant_log_entries_total counter
quant_log_entries_total{level="error"} $(grep -c ERROR backend/logs/$(date +%d-%m-%Y).log)
quant_log_entries_total{level="warning"} $(grep -c WARNING backend/logs/$(date +%d-%m-%Y).log)
quant_log_entries_total{level="info"} $(grep -c INFO backend/logs/$(date +%d-%m-%Y).log)
EOF
```
