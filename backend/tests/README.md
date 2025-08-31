# Tests

Esta pasta contém os scripts de teste para validação das funcionalidades do backend.

## Estrutura

```
tests/
├── test_yahoo_finance.py         # Testes básicos do provedor Yahoo Finance
├── test_yahoo_finance_extended.py # Testes completos e estendidos do Yahoo Finance
├── test_wikipedia.py             # Testes do extrator Wikipedia
├── test_read_market_db.py        # Testes de leitura do banco de dados (legado)
├── test_market_database.py       # Testes completos do banco de dados de mercado
├── test_b3_sectors.py            # Testes do extrator de setores da B3
└── __init__.py
```

## Scripts de Teste

### test_yahoo_finance.py
Testa a funcionalidade completa do provedor Yahoo Finance.

**Funcionalidades testadas:**
- Conexão com Yahoo Finance
- Extração de dados históricos para múltiplos tickers
- Obtenção de informações de ativos
- Validação da estrutura de dados retornada
- Verificação de tipos de dados corretos

**Como executar:**
```bash
uv run python backend/tests/test_yahoo_finance.py
```

**Saída esperada:**
```
🚀 Iniciando testes do Yahoo Finance
============================================================

🔗 Testando conexão Yahoo Finance Provider...
✅ Conexão estabelecida com sucesso

📊 Testando extração de dados históricos...
  📈 Testando ticker: AAPL
    ✅ Sucesso! 252 registros coletados
    📅 Período: 15-01-2024 até 15-01-2025
  📈 Testando ticker: PETR4.SA
    ✅ Sucesso! 247 registros coletados
    📅 Período: 15-01-2024 até 15-01-2025

📋 Testando obtenção de informações do ativo...
  📊 Informações de AAPL:
    Nome: Apple Inc.
    Moeda: USD
    Bolsa: NMS
    Tipo: equity
    Setor: Technology
    Market Cap: 3,500,000,000,000
  ✅ Informações obtidas com sucesso

✅ Testes concluídos
```

### test_wikipedia.py
Testa a extração de tickers S&P 500 da Wikipedia.

**Funcionalidades testadas:**
- Requisição à página da Wikipedia
- Parsing correto da tabela S&P 500
- Validação da estrutura dos dados
- Verificação de consistência (duplicatas, formato)
- Análise de qualidade dos dados coletados

**Como executar:**
```bash
uv run python backend/tests/test_wikipedia.py
```

**Verificações realizadas:**
- Quantidade mínima de tickers (~500)
- Presença de campos obrigatórios
- Ausência de duplicatas
- Formato válido dos símbolos
- Consistência dos dados setoriais

### test_yahoo_finance_extended.py
Testa de forma completa e estendida todas as funcionalidades do Yahoo Finance.

**Funcionalidades testadas:**
- Dados históricos para diferentes tipos de ativos (ações, índices, crypto)
- Informações detalhadas de ativos (setor, indústria, market cap)
- Preços atuais e disponibilidade de tickers
- Validação de qualidade dos dados OHLCV
- Diferentes períodos temporais (1m, 3m, 6m, 1y, 2y)
- Tratamento de erros e casos extremos

**Como executar:**
```bash
uv run python backend/tests/test_yahoo_finance_extended.py
```

**Verificações avançadas:**
- Consistência temporal dos dados
- Validação de ranges de preços (High/Low)
- Verificação de gaps temporais
- Testes com diferentes moedas e mercados
- Análise de integridade para múltiplos tipos de ativos

### test_b3_sectors.py
Testa o extrator de classificação setorial da B3.

**Funcionalidades testadas:**
- Validação da URL do arquivo ZIP da B3
- Download e processamento do arquivo Excel
- Estrutura correta do DataFrame retornado
- Qualidade e integridade dos dados extraídos
- Presença de tickers conhecidos (PETR, VALE, ITUB, etc.)

**Como executar:**
```bash
uv run python backend/tests/test_b3_sectors.py
```

**Validações realizadas:**
- Verificação de valores nulos e duplicatas
- Formato válido dos tickers brasileiros
- Distribuição por setores e subsetores
- Mapeamento correto ticker → classificação setorial

### test_market_database.py
Testa de forma completa o banco de dados de mercado (substitui test_read_market_db.py).

**Funcionalidades testadas:**
- Conexão e estrutura do banco SQLite
- Listagem completa de tabelas com estatísticas
- Análise detalhada da estrutura das tabelas
- Leitura específica por ticker com validações
- Integridade dos dados OHLCV em múltiplas tabelas
- Performance de consultas e operações

**Como executar:**
```bash
uv run python backend/tests/test_market_database.py
```

**Análises realizadas:**
- Contagem de registros por tabela
- Verificação de índices e constraints
- Validação de ranges de preços e volumes
- Análise temporal de continuidade dos dados
- Detecção de inconsistências entre colunas OHLC

### test_read_market_db.py (Legado)
Versão original dos testes de banco de dados, mantida para compatibilidade.

**Nota:** Recomenda-se usar `test_market_database.py` para testes mais completos.

## Padrões dos Testes

### Estrutura Comum
Todos os testes seguem um padrão consistente:

```python
#!/usr/bin/env python3
"""
Descrição do teste.
"""

import sys
from pathlib import Path
import logging

# Configurar paths
project_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_path))

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

def test_functionality():
    """Descrição da funcionalidade testada."""
    print("🔍 Iniciando teste...")
    # Implementação do teste
    
def main():
    """Função principal."""
    print("🚀 Iniciando testes...")
    # Executar testes
    
if __name__ == "__main__":
    main()
```

### Saída Formatada
- **Emojis** para identificação visual clara
- **Cores** implícitas através de símbolos (✅ sucesso, ❌ erro, ⚠️ warning)
- **Estrutura hierárquica** com indentação
- **Métricas quantitativas** (registros, tempo, etc.)
- **Resumo final** com status consolidado

### Tratamento de Erros
- Try/catch abrangente com logging detalhado
- Continuação dos testes mesmo com falhas parciais
- Relatório final com estatísticas de sucesso/falha
- Stack traces para debugging quando necessário

## Executando Todos os Testes

### Script de Automação
```bash
# Criar script para executar todos os testes
cat > run_all_tests.sh << 'EOF'
#!/bin/bash
echo "🚀 Executando todos os testes do backend..."
echo "================================================"

echo -e "\n📊 Teste 1: Yahoo Finance Básico"
echo "--------------------------------"
uv run python backend/tests/test_yahoo_finance.py

echo -e "\n🔥 Teste 2: Yahoo Finance Estendido"
echo "-----------------------------------"
uv run python backend/tests/test_yahoo_finance_extended.py

echo -e "\n🏢 Teste 3: Setores B3"
echo "----------------------"
uv run python backend/tests/test_b3_sectors.py

echo -e "\n🌐 Teste 4: Wikipedia Extractor"
echo "--------------------------------"
uv run python backend/tests/test_wikipedia.py

echo -e "\n💾 Teste 5: Market Database Completo"
echo "------------------------------------"
uv run python backend/tests/test_market_database.py

echo -e "\n📊 Teste 6: Market Database Legado"
echo "----------------------------------"
uv run python backend/tests/test_read_market_db.py

echo -e "\n✅ Todos os testes concluídos!"
EOF

chmod +x run_all_tests.sh
./run_all_tests.sh
```

### Via Makefile
```makefile
.PHONY: test test-yahoo test-yahoo-extended test-b3 test-wiki test-db test-db-full

test: test-yahoo-extended test-b3 test-wiki test-db-full
	@echo "✅ Todos os testes concluídos"

test-yahoo:
	@echo "📊 Testando Yahoo Finance básico..."
	@uv run python backend/tests/test_yahoo_finance.py

test-yahoo-extended:
	@echo "🔥 Testando Yahoo Finance estendido..."
	@uv run python backend/tests/test_yahoo_finance_extended.py

test-b3:
	@echo "🏢 Testando setores B3..."
	@uv run python backend/tests/test_b3_sectors.py

test-wiki:
	@echo "🌐 Testando Wikipedia..."
	@uv run python backend/tests/test_wikipedia.py

test-db:
	@echo "💾 Testando banco de dados (legado)..."
	@uv run python backend/tests/test_read_market_db.py

test-db-full:
	@echo "💾 Testando banco de dados completo..."
	@uv run python backend/tests/test_market_database.py

test-all:
	@echo "🚀 Executando TODOS os testes..."
	@make test-yahoo test-yahoo-extended test-b3 test-wiki test-db test-db-full
```

## Melhores Práticas

### Desenvolvimento de Novos Testes
1. **Seguir o padrão** de estrutura e formatação
2. **Documentar** funcionalidades testadas
3. **Usar logging** apropriado para debug
4. **Validar dados** de forma abrangente
5. **Tratar erros** graciosamente
6. **Reportar métricas** quantitativas

### Manutenção
- **Executar regularmente** para detectar regressões
- **Atualizar** conforme mudanças no código
- **Monitorar** performance dos testes
- **Expandir cobertura** para novas funcionalidades

### Integração Contínua
Os testes podem ser integrados em pipelines CI/CD:
```yaml
# .github/workflows/test.yml
name: Backend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python and uv
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install uv
        run: pip install uv
      - name: Install dependencies
        run: uv sync
      - name: Run Core Tests
        run: |
          uv run python backend/tests/test_yahoo_finance_extended.py
          uv run python backend/tests/test_b3_sectors.py
          uv run python backend/tests/test_market_database.py
      - name: Run Additional Tests
        run: |
          uv run python backend/tests/test_wikipedia.py
          uv run python backend/tests/test_yahoo_finance.py
        continue-on-error: true  # Opcional: continua mesmo se alguns testes falharem
```
