import sqlite3
from .b3_sectors import get_b3_sectors
from ...config import DB_PATH_CADASTRO

def update_ticker_sectors():
    df_sectors = get_b3_sectors()
    if df_sectors.empty:
        print("Nenhum dado de setor encontrado.")
        return
    with sqlite3.connect(DB_PATH_CADASTRO) as conn:
        total_atualizados = 0
        for _, row in df_sectors.iterrows():
            cur = conn.execute('''
                UPDATE tickers
                SET setor = ?, subsetor = ?, segmento = ?
                WHERE UPPER(ticker) = ?
                   OR UPPER(substr(ticker, 1, 4)) = ?
            ''', (
                row['Setor'],
                row['Subsetor'],
                row['Segmento'],
                str(row['Ticker']).upper(),
                str(row['Ticker'])[:4].upper(),
            ))
            if cur.rowcount != -1:
                total_atualizados += cur.rowcount
    print(f"Setores atualizados em {total_atualizados} registros.")
