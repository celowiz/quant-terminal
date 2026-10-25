# Artifacts

Esta pasta contém artefatos de execução do pipeline de dados, incluindo status, metadados e informações de monitoramento.

## Estrutura

```
artifacts/
├── daily_last_run.json     # Status da última execução do pipeline
├── daily_dag.json          # Estrutura do DAG do pipeline
└── [outros artefatos]      # Futuros arquivos de controle
```

## Arquivos

### daily_last_run.json
Contém informações detalhadas sobre a última execução do pipeline diário.

**Estrutura típica:**
```json
{
  "flow_name": "daily_flow",
  "start_time": "2025-01-15T07:00:00",
  "end_time": "2025-01-15T07:15:23",
  "duration_seconds": 923,
  "status": "COMPLETED",
  "total_tasks": 8,
  "completed_tasks": 8,
  "failed_tasks": 0,
  "tasks": [
    {
      "name": "extract_b3_tickers",
      "status": "COMPLETED",
      "start_time": "2025-01-15T07:00:05",
      "end_time": "2025-01-15T07:02:15",
      "duration_seconds": 130,
      "message": "156 tickers B3 coletados"
    },
    {
      "name": "extract_sp500_tickers", 
      "status": "COMPLETED",
      "start_time": "2025-01-15T07:02:15",
      "end_time": "2025-01-15T07:04:30",
      "duration_seconds": 135,
      "message": "503 tickers S&P 500 coletados"
    }
  ],
  "statistics": {
    "tickers_processed": 659,
    "data_points_collected": 164750,
    "api_calls_made": 659,
    "errors_encountered": 0,
    "cache_hits": 23
  },
  "metadata": {
    "hostname": "prod-server-01",
    "python_version": "3.11.5",
    "backend_version": "1.0.0",
    "data_sources": ["yahoo_finance", "b3", "wikipedia"]
  }
}
```

**Campos principais:**
- **flow_name**: Nome do pipeline executado
- **timing**: Horários de início, fim e duração
- **status**: COMPLETED, FAILED, RUNNING, CANCELLED
- **tasks**: Detalhes de cada tarefa individual
- **statistics**: Métricas da execução
- **metadata**: Informações do ambiente

### daily_dag.json
Representa a estrutura do DAG (Directed Acyclic Graph) do pipeline.

**Estrutura típica:**
```json
{
  "dag_id": "daily_flow",
  "description": "Pipeline diário de coleta de dados financeiros",
  "schedule": "0 7 * * 1-5",
  "nodes": [
    {
      "id": "extract_tickers",
      "name": "Extrair Tickers",
      "type": "extract",
      "dependencies": [],
      "estimated_duration": 300
    },
    {
      "id": "fetch_yahoo_data",
      "name": "Buscar Dados Yahoo",
      "type": "extract", 
      "dependencies": ["extract_tickers"],
      "estimated_duration": 600
    },
    {
      "id": "save_to_database",
      "name": "Salvar no Banco",
      "type": "load",
      "dependencies": ["fetch_yahoo_data"],
      "estimated_duration": 180
    }
  ],
  "edges": [
    {"from": "extract_tickers", "to": "fetch_yahoo_data"},
    {"from": "fetch_yahoo_data", "to": "save_to_database"}
  ],
  "metadata": {
    "created_at": "2025-01-15T07:00:00",
    "total_nodes": 8,
    "total_edges": 7,
    "critical_path_duration": 1080
  }
}
```

## Uso dos Artefatos

### Monitoramento via API
Os artefatos são consumidos pelos endpoints de monitoramento:

```python
# backend/api/routers/flows.py
@router.get("/daily/status")
def get_daily_status():
    with open(STATUS_PATH) as f:
        return json.load(f)

@router.get("/daily/dag") 
def get_daily_dag():
    with open(DAG_PATH) as f:
        return json.load(f)
```

### Dashboard Web
Os dados são utilizados para construir dashboards de monitoramento:
- Status em tempo real do pipeline
- Métricas de performance histórica
- Visualização do DAG
- Alertas e notificações

### Análise de Performance
```bash
# Extrair durações das últimas execuções
jq '.duration_seconds' backend/artifacts/daily_last_run.json

# Analisar tasks mais lentas
jq '.tasks[] | {name: .name, duration: .duration_seconds} | select(.duration > 60)' backend/artifacts/daily_last_run.json

# Verificar taxa de sucesso
jq '.failed_tasks / .total_tasks' backend/artifacts/daily_last_run.json
```

## Configuração

Os caminhos são definidos em `backend/config.py`:

```python
# Diretórios/pastas de artefatos do pipeline
ARTIFACTS_DIR = str(BASE_DIR / 'artifacts')
STATUS_PATH = str(BASE_DIR / 'artifacts' / 'daily_last_run.json')
DAG_PATH = str(BASE_DIR / 'artifacts' / 'daily_dag.json')
```

## Geração Automática

### Status de Execução
Gerado automaticamente no final de cada execução do pipeline:

```python
# backend/data_pipeline/daily_flow.py
def save_execution_status(start_time, end_time, tasks, statistics):
    status_data = {
        "flow_name": "daily_flow",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": (end_time - start_time).total_seconds(),
        "status": "COMPLETED",
        "tasks": tasks,
        "statistics": statistics,
        # ...
    }
    
    with open(STATUS_PATH, 'w') as f:
        json.dump(status_data, f, indent=2)
```

### DAG Structure
Gerado uma vez na inicialização e atualizado quando há mudanças no pipeline:

```python
def generate_dag_structure():
    dag_data = {
        "dag_id": "daily_flow",
        "nodes": build_nodes(),
        "edges": build_edges(),
        "metadata": get_dag_metadata()
    }
    
    with open(DAG_PATH, 'w') as f:
        json.dump(dag_data, f, indent=2)
```

## Monitoramento e Alertas

### Scripts de Monitoramento
```bash
#!/bin/bash
# monitor_pipeline.sh - Verifica status do pipeline

STATUS_FILE="backend/artifacts/daily_last_run.json"

if [ ! -f "$STATUS_FILE" ]; then
    echo "❌ Arquivo de status não encontrado"
    exit 1
fi

STATUS=$(jq -r '.status' "$STATUS_FILE")
FAILED_TASKS=$(jq -r '.failed_tasks' "$STATUS_FILE")
DURATION=$(jq -r '.duration_seconds' "$STATUS_FILE")

echo "📊 Status do Pipeline: $STATUS"
echo "⏱️  Duração: ${DURATION}s"
echo "❌ Tasks falharam: $FAILED_TASKS"

if [ "$STATUS" != "COMPLETED" ] || [ "$FAILED_TASKS" -gt "0" ]; then
    echo "🚨 ALERTA: Pipeline com problemas!"
    # Enviar notificação
fi
```

### Métricas Históricas
```bash
# Coletar histórico de execuções
cat > collect_metrics.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d)
STATUS_FILE="backend/artifacts/daily_last_run.json"

if [ -f "$STATUS_FILE" ]; then
    # Extrair métricas chave
    DURATION=$(jq -r '.duration_seconds' "$STATUS_FILE")
    TICKERS=$(jq -r '.statistics.tickers_processed' "$STATUS_FILE")
    STATUS=$(jq -r '.status' "$STATUS_FILE")
    
    # Salvar no histórico
    echo "$DATE,$STATUS,$DURATION,$TICKERS" >> metrics_history.csv
fi
EOF
```

### Alertas Automáticos
```python
# alerts.py - Sistema de alertas
import json
import smtplib
from datetime import datetime, timedelta

def check_pipeline_health():
    with open('backend/artifacts/daily_last_run.json') as f:
        status = json.load(f)
    
    alerts = []
    
    # Verificar se pipeline rodou nas últimas 24h
    last_run = datetime.fromisoformat(status['end_time'])
    if datetime.now() - last_run > timedelta(days=1):
        alerts.append("Pipeline não executou nas últimas 24 horas")
    
    # Verificar se teve falhas
    if status['failed_tasks'] > 0:
        alerts.append(f"{status['failed_tasks']} tasks falharam")
    
    # Verificar duração anormal
    if status['duration_seconds'] > 3600:  # > 1 hora
        alerts.append("Pipeline demorou mais que o normal")
    
    # Enviar alertas se necessário
    if alerts:
        send_alerts(alerts)

def send_alerts(alerts):
    message = "🚨 Alertas do Quant Terminal:\n\n" + "\n".join(alerts)
    # Implementar envio (email, Slack, etc.)
```

## Histórico e Auditoria

### Versionamento de Artefatos
```bash
# Manter histórico de execuções
cp backend/artifacts/daily_last_run.json "backup/daily_run_$(date +%Y%m%d_%H%M).json"

# Rotação automática (manter últimos 30 dias)
find backup/ -name "daily_run_*.json" -mtime +30 -delete
```

### Análise de Tendências
```bash
# Analisar performance ao longo do tempo
echo "Data,Status,Duração,Tickers" > pipeline_trends.csv
for file in backup/daily_run_*.json; do
    DATE=$(basename "$file" .json | sed 's/daily_run_//' | sed 's/_/ /')
    STATUS=$(jq -r '.status' "$file")
    DURATION=$(jq -r '.duration_seconds' "$file")  
    TICKERS=$(jq -r '.statistics.tickers_processed // 0' "$file")
    echo "$DATE,$STATUS,$DURATION,$TICKERS" >> pipeline_trends.csv
done
```

## Troubleshooting

### Problemas Comuns

**Arquivo de status corrompido:**
```bash
# Verificar JSON válido
jq . backend/artifacts/daily_last_run.json

# Restaurar backup se necessário
cp backup/daily_run_latest.json backend/artifacts/daily_last_run.json
```

**Status não atualiza:**
```bash
# Verificar permissões
ls -la backend/artifacts/
chmod 644 backend/artifacts/*.json

# Verificar processo que escreve
ps aux | grep daily_flow
```

**DAG desatualizado:**
```bash
# Regenerar DAG
python -c "
from backend.data_pipeline.daily_flow import generate_dag_structure
generate_dag_structure()
print('DAG regenerado')
"
```

### Logs Relacionados
```bash
# Verificar logs de geração de artefatos
grep -i "artifact\|status\|dag" backend/logs/$(date +%d-%m-%Y).log

# Verificar erros na escrita
grep -i "error.*json\|failed.*write" backend/logs/$(date +%d-%m-%Y).log
```
