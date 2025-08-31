from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sqlite3
from typing import Optional

from ...config import DB_PATH_DAILY_PRICES


router = APIRouter()


class StatsResponse(BaseModel):
    ticker: str
    total_records: int
    first_date: Optional[str]
    last_date: Optional[str]
    max_price: Optional[float]
    min_price: Optional[float]
    avg_price: Optional[float]
    total_volume: Optional[int]
    high_52w: Optional[float]
    low_52w: Optional[float]


@router.get("/{ticker}", response_model=StatsResponse)
def get_stats(ticker: str) -> StatsResponse:
    table = ticker.upper()
    if table.endswith('.SA'):
        table = table[:-3]

    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            cur = conn.cursor()

            # Estatísticas gerais
            cur.execute(
                f"""
                SELECT
                    COUNT(*) as total_records,
                    MIN(time) as first_date,
                    MAX(time) as last_date,
                    MAX(close) as max_price,
                    MIN(close) as min_price,
                    AVG(close) as avg_price,
                    SUM(volume) as total_volume
                FROM '{table.replace("'","''")}'
                """
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Ticker não encontrado")

            total_records, first_date, last_date, max_price, min_price, avg_price, total_volume = row

            # Últimas 52 semanas: janela de 365 dias a partir da última data disponível
            high_52w = low_52w = None
            if last_date:
                cur.execute(
                    f"""
                    SELECT MAX(close) AS h, MIN(close) AS l
                    FROM '{table.replace("'","''")}'
                    WHERE date(time) >= date(?, '-365 days') AND date(time) <= date(?)
                    """,
                    (last_date, last_date),
                )
                r2 = cur.fetchone()
                if r2:
                    high_52w, low_52w = r2

        return StatsResponse(
            ticker=table,
            total_records=int(total_records or 0),
            first_date=first_date,
            last_date=last_date,
            max_price=float(max_price) if max_price is not None else None,
            min_price=float(min_price) if min_price is not None else None,
            avg_price=float(avg_price) if avg_price is not None else None,
            total_volume=int(total_volume or 0) if total_volume is not None else None,
            high_52w=float(high_52w) if high_52w is not None else None,
            low_52w=float(low_52w) if low_52w is not None else None,
        )

    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar estatísticas: {e}")


