"""Universo de ativos (build_prices.py) e o data/tickers.json versionado."""
import json, pathlib
import pandas as pd
import build_prices as bp

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLASSES = {'br_equity', 'us_equity', 'index', 'etf', 'commodity', 'crypto', 'fx'}


def test_build_universe_classes_e_indices():
    U = bp.build_universe([('PETR4', 'PETROBRAS PN'), ('WEGE3', 'WEG ON')], [('WEGE3', 'WEG ON'), ('LWSA3', 'LOCAWEB ON')])
    assert U['WEGE3.SA']['index'] == ['IBOV', 'SMLL'] and U['LWSA3.SA']['index'] == ['SMLL']
    assert 'ITUB4.SA' in U and not U['ITUB4.SA'].get('index')   # núcleo EQUITIES fica mesmo fora do índice
    assert 'corp' not in U['PETR4.SA']                         # cobertura vem dos arquivos (mark_coverage), não de lista fixa
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
    corp = {t['ticker'] for t in T if t.get('corp')}
    # corp: ações BR (CVM) e, desde o P1-B, ações dos EUA (SEC companyfacts)
    assert set(bp.EQUITIES) <= corp and all(t['class'] in ('br_equity', 'us_equity') for t in T if t.get('corp'))


def test_universe_corta_barra_final_sem_acoes():
    import build_markets as bm
    d = pd.to_datetime(['2026-10-27', '2026-10-28', '2026-10-29'])
    cl = {'^BVSP': pd.Series([1, 2, 3], index=d), 'PETR4.SA': pd.Series([1, 2], index=d[:2]),
          'VALE3.SA': pd.Series([1, 2, None], index=d), 'ITUB4.SA': pd.Series([1, 2, 3], index=d)}
    assert list(bm.trim_tail(list(d), cl)) == list(d[:2])          # 1 de 3 ações na última data
    cl['VALE3.SA'] = pd.Series([1, 2, 3], index=d)
    assert list(bm.trim_tail(list(d), cl)) == list(d)              # 2 de 3: mantém


def test_mark_coverage_pelos_arquivos(tmp_path, monkeypatch):
    import common
    monkeypatch.setattr(common, 'OUT', str(tmp_path))
    for d, k in (('corp', 'WEGE3'), ('holders', 'WEGE3'), ('options', 'PETR4'), ('intraday', 'IDX_BVSP')):
        (tmp_path / d).mkdir(exist_ok=True); (tmp_path / d / f'{k}.json').write_text('{}')
    U = {'WEGE3.SA': {'corp': True}, 'PETR4.SA': {'corp': True}, '^BVSP': {}, 'AAPL': {}}
    common.mark_coverage(U)
    assert U['WEGE3.SA'] == {'cov': ['corp', 'holders'], 'corp': True}
    assert U['PETR4.SA'] == {'cov': ['options']}        # flag antiga sem arquivo é removida
    assert U['^BVSP'] == {'cov': ['intraday']} and U['AAPL'] == {}


def test_parse_portfolio_b3_qtd_teorica_e_redutor():
    import pytest
    import build_markets as bm
    d = {'header': {'date': '30/10/26', 'part': '100,000', 'reductor': '13.999.429,66674930', 'theoricalQty': '93.803.750.400'},
         'results': [{'segment': 'Bens Indls / Máqs e Equips', 'cod': 'WEGE3', 'asset': 'WEG ', 'type': 'ON      NM', 'part': '3,039', 'theoricalQty': '1.460.506.056'},
                     {'segment': 'Financeiro / Bancos', 'cod': 'ITUB4', 'asset': 'ITAUUNIBANCO', 'type': 'PN  N1', 'part': '8,1', 'theoricalQty': ''}]}
    comp, head = bm.parse_portfolio(d)
    assert comp[0] == {'cod': 'WEGE3', 'name': 'WEG', 'type': 'ON NM', 'sector': 'Bens Indls', 'subsector': 'Bens Indls / Máqs e Equips', 'weight': 3.039, 'qty': 1460506056.0}
    assert comp[1]['qty'] is None and comp[1]['weight'] == 8.1
    assert head == {'date': '30/10/26', 'reductor': pytest.approx(13999429.6667493), 'theoretical_qty': 93803750400.0}
