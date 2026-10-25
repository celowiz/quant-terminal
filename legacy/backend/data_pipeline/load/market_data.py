import sqlite3
import pandas as pd
from typing import Optional


def save_yahoo_data_to_sqlite(
    df: pd.DataFrame,
    db_path: str,
    table_name: str,
    if_exists: str = 'replace',
    index: bool = False,
    dtype: Optional[dict] = None,
):
    """
    Salva um DataFrame de cotações do Yahoo Finance em uma tabela SQLite.
    """
    with sqlite3.connect(db_path) as conn:
        df.to_sql(table_name, conn, if_exists=if_exists, index=index, dtype=dtype)


