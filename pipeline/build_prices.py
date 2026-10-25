"""Preços OHLCV diários (10 anos, ajustados) dos tickers do seletor + tickers.json.
Fonte: Yahoo Finance via yfinance. Mesmo conteúdo de tools/build_data.py, com saída em QT_DATA_OUT."""
import json, os
import pandas as pd, yfinance as yf
from common import OUT, now_iso

U = {'B3SA3.SA': 'B3 S.A.', 'BRL=X': 'USD/BRL', 'DX-Y.NYB': 'US Dollar Index (DXY)', 'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD',
     'ITUB3.SA': 'Itaú Unibanco ON', 'ITUB4.SA': 'Itaú Unibanco PN', 'JPY=X': 'USD/JPY', 'PETR3.SA': 'Petrobras ON',
     'PETR4.SA': 'Petróleo Brasileiro S.A. - Petrobras', 'VALE3.SA': 'Vale S.A.', '^BVSP': 'IBOVESPA'}

def key(t): return t.replace('^', 'IDX_').replace('.SA', '').replace('.', '_').replace('=', '_').replace('-', '_')

def main():
    os.makedirs(f'{OUT}/prices', exist_ok=True)
    df = yf.download(list(U), period='10y', auto_adjust=True, group_by='ticker', progress=False, threads=True)
    meta = []
    for t, name in U.items():
        d = df[t].dropna(subset=['Close']); d = d[d.index.dayofweek < 5]  # FX no Yahoo tem barras de fim de semana
        rows = [{'time': i.strftime('%Y-%m-%d'), 'open': round(float(r.Open), 4), 'high': round(float(r.High), 4), 'low': round(float(r.Low), 4),
                 'close': round(float(r.Close), 4), 'volume': int(r.Volume or 0)} for i, r in d.iterrows()]
        if not rows: raise RuntimeError(f'sem dados para {t}')
        json.dump(rows, open(f'{OUT}/prices/{key(t)}.json', 'w'), separators=(',', ':'))
        meta.append({'ticker': t, 'key': key(t), 'name': name, 'first': rows[0]['time'], 'last': rows[-1]['time'], 'n': len(rows)})
        print(' ', t, len(rows), rows[-1]['time'])
    json.dump({'generated_at': now_iso(), 'source': 'Yahoo Finance via yfinance (OHLC ajustado por proventos/desdobramentos)', 'tickers': meta},
              open(f'{OUT}/tickers.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
