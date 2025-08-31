# Configurações globais do projeto
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH_CADASTRO = str(BASE_DIR / 'database' / 'cadastro.db')  # Cadastro de ativos

# Banco NoSQL para dados do Yahoo Finance
DB_PATH_YAHOO_ASSETS = str(BASE_DIR / 'database' / 'yahoo_assets.json')  # Dados JSON do Yahoo Finance (TinyDB)
DB_PATH_DAILY_PRICES = str(BASE_DIR / 'database' / 'daily_prices.db')  # Preços diários
DB_PATH_CORPORATE_ACTIONS = str(BASE_DIR / 'database' / 'corporate_actions.db')  # Proventos

# Diretórios/pastas de artefatos do pipeline
LOG_DIR = str(BASE_DIR / 'logs')
ARTIFACTS_DIR = str(BASE_DIR / 'artifacts')
STATUS_PATH = str(BASE_DIR / 'artifacts' / 'daily_last_run.json')
DAG_PATH = str(BASE_DIR / 'artifacts' / 'daily_dag.json')

# pasta/arquivo para listas manuais de ativos
MANUAL_ASSETS_DIR = str(BASE_DIR / 'data_pipeline' / 'assets')
MANUAL_ASSETS_FILE = "manual_assets.yaml"

# Horário padrão para atualização dos tickers
TICKERS_UPDATE_HOUR = 7  # 7h da manhã

# Configurações do Yahoo Finance Provider
YAHOO_TIMEOUT = 10
YAHOO_RETRIES = 3