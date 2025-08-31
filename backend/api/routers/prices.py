from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import sqlite3
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd

from ...config import DB_PATH_DAILY_PRICES


router = APIRouter()


class Price(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


@router.get("/{ticker}", response_model=List[Price])
def get_prices(
    ticker: str,
    start_date: Optional[str] = Query(None, description="Data inicial no formato YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Data final no formato YYYY-MM-DD"),
    timeframe: str = Query("d", description="Timeframe: d=diário, w=semanal, m=mensal, q=trimestral, y=anual")
):
    # Força o nome da tabela sem sufixo da bolsa (ex.: PETR4)
    table = ticker.upper()
    if table.endswith('.SA'):
        table = table[:-3]
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            cur = conn.cursor()
            # Double-quote the identifier to support dots in table names
            safe_table = table.replace('"', '""')
            
            # Construir query com filtros de data
            where_conditions = []
            params = []
            
            if start_date:
                where_conditions.append("time >= ?")
                params.append(start_date)
            
            if end_date:
                where_conditions.append("time <= ?")
                params.append(end_date)
            
            where_clause = ""
            if where_conditions:
                where_clause = f" WHERE {' AND '.join(where_conditions)}"
            
            sql = f'SELECT time, open, high, low, close, volume FROM "{safe_table}"{where_clause} ORDER BY time ASC'
            cur.execute(sql, params)
            rows = cur.fetchall()
        
        # Se não há dados ou timeframe é diário, retornar direto
        if not rows or timeframe == "d":
            return [
                Price(
                    time=r[0], open=r[1], high=r[2], low=r[3], close=r[4], volume=int(r[5] or 0)
                )
                for r in rows
            ]
        
        # Agrupar dados por timeframe
        df = pd.DataFrame(rows, columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        df['time'] = pd.to_datetime(df['time'])
        df.set_index('time', inplace=True)
        
        # Definir regra de agrupamento
        freq_map = {
            'w': 'W',      # Semanal
            'm': 'M',      # Mensal
            'q': 'Q',      # Trimestral
            'y': 'Y'       # Anual
        }
        
        if timeframe in freq_map:
            # Agrupar dados
            grouped = df.groupby(pd.Grouper(freq=freq_map[timeframe])).agg({
                'open': 'first',
                'high': 'max',
                'low': 'min',
                'close': 'last',
                'volume': 'sum'
            }).dropna()
            
            # Converter de volta para lista
            result = []
            for timestamp, row in grouped.iterrows():
                result.append(Price(
                    time=timestamp.strftime('%d-%m-%Y'),
                    open=float(row['open']),
                    high=float(row['high']),
                    low=float(row['low']),
                    close=float(row['close']),
                    volume=int(row['volume'])
                ))
            return result
        else:
            # Timeframe inválido, retornar diário
            return [
                Price(
                    time=r[0], open=r[1], high=r[2], low=r[3], close=r[4], volume=int(r[5] or 0)
                )
                for r in rows
            ]
            
    except sqlite3.Error as e:
        raise HTTPException(status_code=404, detail=f"Erro ao consultar preços: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {e}")


