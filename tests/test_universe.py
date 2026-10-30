"""Universo de ativos (build_prices.py) e o data/tickers.json versionado."""
import json, pathlib
import pandas as pd
import build_prices as bp

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLASSES = {'br_equity', 'us_equity', 'index', 'etf', 'commodity', 'crypto', 'fx'}


def test_build_universe_classes_e_indices():
    U = bp.build_universe([('PETR4', 'PETROBRAS PN'), ('WEGE3', 'WEG ON')], [('WEGE3', 'WEG ON'), ('LWSA3', 'LOCAWEB ON')])
    assert U['WEGE3.SA']['index'] == ['IBOV', 'SMLL'] and U['LWSA3.SA']['index'] == ['SMLL']
    assert U['PETR4.SA']['corp'] is True and 'corp' not in U['WEGE3.SA']
    assert U['ITUB4.SA']['corp'] is True            # EQUITIES ficam mesmo fora do índice
    assert {m['class'] for m in U.values()} == CLASSES
    assert U['TIO=F']['close_only'] and U['TIO=F']['unit'] == 'USD/t' and 'ref' in U['TIO=F']
    assert U['I0.DCE']['unit'] == 'CNY/t' and U['I0.DCE']['currency'] == 'CNY'
    assert 'GOOGL' in U and 'BTC-USD' in U and '^GSPC' in U and 'BOVA11.SA' in U


def test_key_e_arredondamento():
    assert bp.key('^BVSP') == 'IDX_BVSP' and bp.key('BRK-B') == 'BRK_B' and bp.key('USDBRL=X') == 'USDBRL_X'
    assert bp.key('I0.DCE') == 'I0_DCE' and bp.key('PETR4.SA') == 'PETR4'
    assert bp._r(123456.789) == 123457.0 and bp._r(0.123456789) == 0.123457


def test_rows_from_frame_dias_uteis_e_ohl_faltante():
    idx = pd.to_datetime(['2026-10-23', '2026-10-24', '2026-10-26'])   # sex, sáb, seg
    d = pd.DataFrame({'Open': [1, 2, None], 'High': [1, 2, None], 'Low': [1, 2, None], 'Close': [1.5, 2, 3], 'Volume': [10, 0, None]}, index=idx)
    rows = bp.rows_from_frame(d)
    assert [r['time'] for r in rows] == ['2026-10-23', '2026-10-26']
    assert rows[1] == {'time': '2026-10-26', 'open': 3.0, 'high': 3.0, 'low': 3.0, 'close': 3.0, 'volume': 0}


def test_tickers_json_minimo():
    d = json.loads((ROOT / 'public/data/tickers.json').read_text())
    T = d['tickers']
    assert len(T) >= bp.MIN_TICKERS
    assert {t['class'] for t in T} == CLASSES
    assert len({t['key'] for t in T}) == len(T)
    assert sum('IBOV' in t.get('index', []) for t in T) >= 60
    assert sum('SMLL' in t.get('index', []) for t in T) >= 80
    assert sum(t['class'] == 'us_equity' for t in T) >= 30
    assert sorted(t['ticker'] for t in T if t.get('corp')) == sorted(bp.EQUITIES)
