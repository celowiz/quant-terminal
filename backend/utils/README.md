# Utils

Esta pasta contém utilitários e funções auxiliares utilizadas em todo o backend.

## Estrutura

```
utils/
├── anbima_funds_flow.py     # Processamento de dados de fluxo de fundos
├── feriados.py              # Lista de feriados nacionais da ANBIMA
├── graph_builder.py         # Construção de grafos para visualização
├── logging_utils.py         # Configuração de logging
├── prefect_client.py        # Cliente para monitoramento Prefect
├── technical_indicators.py  # Indicadores técnicos
├── transform.py             # Transformações de dados
└── __init__.py
```

## Módulos

### anbima_funds_flow.py
Processa dados de captação líquida de fundos de investimento da ANBIMA.

**Funcionalidades:**
- Download e parsing de arquivo Excel da ANBIMA
- Filtragem por classes de fundos de interesse
- Transformação para formato adequado à API
- Normalização de dados numéricos

**Classes de fundos processadas:**
- Renda Fixa
- Ações
- Multimercados
- Cambial
- Previdência
- ETF

**Uso:**
```python
from backend.utils.anbima_funds_flow import get_funds_flow_series

# Obter dados para API
data = get_funds_flow_series()
print(data['data_ref'])  # Data de referência
print(data['rows'])      # Dados por classe
```

### feriados.py
Obtém lista oficial de feriados nacionais da ANBIMA para cálculos de dias úteis.

**Funcionalidades:**
- Download automático da planilha Excel da ANBIMA
- Cache local para evitar downloads repetidos
- Parsing de datas em formato Excel
- Validação e ordenação de feriados

**Uso:**
```python
from backend.utils.feriados import get_brazilian_holidays

# Obter feriados
holidays = get_brazilian_holidays()
print(f"Total de feriados: {len(holidays)}")
print(f"Próximo feriado: {min(h for h in holidays if h > date.today())}")
```

### graph_builder.py
Constrói grafos interativos para visualização de pipelines e workflows.

**Funcionalidades:**
- Criação de grafos direcionados com pyvis
- Mapeamento de cores por status (sucesso, erro, executando)
- Tooltips informativos com duração e mensagens
- Configuração otimizada para visualização web

**Uso:**
```python
from backend.utils.graph_builder import build_graph

# Dados do pipeline
pipeline_data = {
    "task_runs": [
        {"name": "extract_tickers", "state": "COMPLETED", "duration": 45.2},
        {"name": "fetch_prices", "state": "RUNNING", "duration": None}
    ]
}

# Construir grafo
graph = build_graph(pipeline_data, edges=[("extract_tickers", "fetch_prices")])
graph.show("pipeline.html")
```

### logging_utils.py
Configuração padronizada de logging com rotação diária.

**Funcionalidades:**
- Logs com rotação diária automática
- Formato padronizado com timestamp e nível
- Output simultâneo para arquivo e console
- Configuração thread-safe

**Uso:**
```python
from backend.utils.logging_utils import setup_daily_rotating_logger

# Configurar logger
logger = setup_daily_rotating_logger("meu_modulo", "logs/")
logger.info("Operação iniciada")
logger.error("Erro encontrado")
```

### prefect_client.py
Cliente para monitoramento de workflows Prefect.

**Funcionalidades:**
- Busca de flows por nome
- Obtenção de estatísticas de execução
- Detalhes de task runs individuais
- Cálculo de durações e métricas

**Uso:**
```python
from backend.utils.prefect_client import get_pipeline_data

# Obter dados de um flow
data = get_pipeline_data("daily_flow")
print(f"Status: {data['state']}")
print(f"Duração total: {data['end_time'] - data['start_time']}")
```

### technical_indicators.py
Cálculo de indicadores técnicos usando pandas-ta.

**Indicadores disponíveis:**
- **MACD**: Moving Average Convergence Divergence
- **EMA**: Exponential Moving Average
- **SMA**: Simple Moving Average
- **RSI**: Relative Strength Index

**Uso:**
```python
from backend.utils.technical_indicators import add_all_indicators

# Adicionar indicadores a DataFrame de preços
df_with_indicators = add_all_indicators(
    df,
    macd_params={'fast': 12, 'slow': 26, 'signal': 9},
    ema_periods=[9, 21, 50],
    sma_periods=[20, 50, 200],
    rsi_period=14
)
```

### transform.py
Funções para transformação e limpeza de dados.

**Funcionalidades:**
- Limpeza de dados numéricos (NaN, infinitos)
- Normalização de símbolos de tickers
- Padronização de colunas de data
- Remoção de outliers (IQR, Z-score)
- Validação de dados OHLCV

**Uso:**
```python
from backend.utils.transform import (
    clean_numeric_data,
    normalize_ticker_symbols,
    validate_ohlc_data
)

# Limpar dados numéricos
df_clean = clean_numeric_data(df, ['open', 'high', 'low', 'close'])

# Normalizar tickers
tickers = normalize_ticker_symbols(['petr4', ' vale3 ', 'ITUB4'])
# Resultado: ['PETR4', 'VALE3', 'ITUB4']

# Validar dados OHLCV
validation = validate_ohlc_data(df)
if validation['is_valid']:
    print("Dados válidos!")
else:
    print(f"Erros encontrados: {validation['errors']}")
```

## Padrões de Desenvolvimento

### Logging
Todos os módulos seguem o padrão de logging:
```python
import logging
logger = logging.getLogger(__name__)

def my_function():
    logger.info("Operação iniciada")
    try:
        # Código da função
        logger.debug("Detalhes da operação")
    except Exception as e:
        logger.error(f"Erro na operação: {e}")
```

### Tratamento de Erros
- Exceptions específicas quando apropriado
- Logging detalhado de erros
- Graceful degradation quando possível
- Validação de entrada robusta

### Documentação
- Docstrings detalhadas para todas as funções
- Type hints para parâmetros e retorno
- Exemplos de uso nos docstrings
- README atualizado para cada módulo

### Testes
Cada utilitário deve ter testes correspondentes:
```python
def test_normalize_tickers():
    result = normalize_ticker_symbols(['petr4', ' VALE3 '])
    assert result == ['PETR4', 'VALE3']
```

## Dependências

### Principais
- **pandas**: Manipulação de DataFrames
- **numpy**: Operações numéricas
- **xlrd**: Leitura de arquivos Excel
- **pyvis**: Construção de grafos interativos
- **prefect**: Cliente para monitoramento
- **pandas-ta**: Indicadores técnicos

### Opcionais
- **scipy**: Métodos estatísticos avançados (Z-score)
- **yfinance**: Integração com Yahoo Finance

## Melhores Práticas

### Performance
- Use caching quando apropriado
- Evite operações custosas em loops
- Lazy loading para imports pesados
- Processamento vetorizado com pandas/numpy

### Manutenibilidade
- Funções pequenas e focadas
- Nomes descritivos e claros
- Separação de responsabilidades
- Configurações externalizadas

### Extensibilidade
- Interfaces bem definidas
- Parâmetros configuráveis
- Suporte a diferentes formatos de entrada
- Plugins e hooks quando necessário
