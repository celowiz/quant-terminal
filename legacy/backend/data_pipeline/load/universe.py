from typing import List, Dict
from datetime import date
import sqlite3
from ..extract.b3_sectors import get_b3_sectors
from ...config import DB_PATH_CADASTRO


def _ensure_tickers_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS tickers (
            ticker TEXT PRIMARY KEY,
            nome_empresa TEXT,
            fonte TEXT,
            tipo_ativo TEXT,
            ativo INTEGER,
            setor TEXT,
            subsetor TEXT,
            segmento TEXT,
            data_atualizacao DATE
        )
        '''
    )


def save_tickers_to_sqlite(tickers: List[Dict], db_path: str):
    """Salva lista de tickers na tabela universal do banco SQLite"""
    with sqlite3.connect(db_path) as conn:
        _ensure_tickers_table(conn)
        for t in tickers:
            conn.execute(
                '''
                INSERT OR REPLACE INTO tickers (ticker, nome_empresa, fonte, tipo_ativo, ativo, setor, subsetor, segmento, data_atualizacao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    t.get('ticker'),
                    t.get('nome'),
                    t.get('source', 'B3'),
                    t.get('categoria', ''),
                    1,
                    t.get('setor', ''),
                    t.get('subsetor', ''),
                    t.get('segmento', ''),
                    date.today(),
                ),
            )
        print(f"{len(tickers)} tickers salvos/atualizados no banco {db_path}")


def update_ticker_sectors():
    df_sectors = get_b3_sectors()
    if df_sectors.empty:
        print("Nenhum dado de setor encontrado.")
        return
    with sqlite3.connect(DB_PATH_CADASTRO) as conn:
        total_atualizados = 0
        for _, row in df_sectors.iterrows():
            cur = conn.execute(
                '''
                UPDATE tickers
                SET setor = ?, subsetor = ?, segmento = ?
                WHERE UPPER(ticker) = ?
                   OR UPPER(substr(ticker, 1, 4)) = ?
                ''',
                (
                    row['Setor'],
                    row['Subsetor'],
                    row['Segmento'],
                    str(row['Ticker']).upper(),
                    str(row['Ticker'])[:4].upper(),
                ),
            )
            if cur.rowcount != -1:
                total_atualizados += cur.rowcount
    print(f"Setores atualizados em {total_atualizados} registros.")

