import sqlite3
from .config import DB_PATH_DAILY_PRICES, DB_PATH_CADASTRO

def clear_market_data():
    with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall() if not row[0].startswith('sqlite_')]
        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
        print(f"Todas as tabelas de preços removidas de {DB_PATH_DAILY_PRICES}")

def clear_cadastro():
    with sqlite3.connect(DB_PATH_CADASTRO) as conn:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS tickers")
        print(f"Tabela 'tickers' removida de {DB_PATH_CADASTRO}")

if __name__ == "__main__":
    clear_market_data()
    clear_cadastro()
