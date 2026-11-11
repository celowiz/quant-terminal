"""Testes puros do build_mov.py (MOV/HMOV): carteiras, calendário de vigência, encadeamento diário. Sem rede."""
import os, datetime as dt
import pandas as pd
import build_mov as m

SEED = os.path.join(os.path.dirname(__file__), '..', 'pipeline', 'data', 'portfolios', 'IBOV')


def test_sementes_oficiais_de_2026():
    got = {}
    for f in sorted(os.listdir(SEED)):
        d, mem, red = m.parse_csv_portfolio(open(os.path.join(SEED, f), 'rb').read().decode('latin-1'))
        assert f == d + '.csv'
        assert abs(sum(x['part'] for x in mem.values()) - 100) < 0.05
        assert red and red > 1e6 and all(x['qty'] and x['qty'] > 0 for x in mem.values())
        got[d] = mem
    assert [len(got[d]) for d in sorted(got)] == [85, 83, 79]
    assert 'CVCB3' in got['2026-01-02'] and 'CSMG3' not in got['2026-01-02'] and 'CSMG3' in got['2026-03-23']
    assert not {'AXIA7', 'CYRE4', 'IRBR3', 'RENT4'} & set(got['2026-05-11'])


def test_carteira_da_api():
    j = {'header': {'date': '11/11/26', 'reductor': '13.980.694,43000744'},
         'results': [{'cod': 'WEGE3', 'asset': 'WEG', 'type': 'ON      NM', 'part': '3,106', 'theoricalQty': '1.460.506.056', 'segment': 'Bens Indls / Máqs e Equips'}]}
    d, mem, red, sec = m.parse_api_portfolio(j)
    assert d == '2026-11-11' and round(red, 2) == 13980694.43
    assert mem['WEGE3'] == {'name': 'WEG', 'type': 'ON NM', 'qty': 1460506056.0, 'part': 3.106}
    assert sec['WEGE3'] == 'Bens Indls / Máqs e Equips'


def test_inicio_da_vigencia():
    tr = [d.isoformat() for d in pd.bdate_range('2025-08-01', '2026-12-31').date if d.isoformat() != '2026-09-07']
    assert m.period_start('2026-01-02', tr) == '2025-09-01'
    assert m.period_start('2026-01-05', tr) == '2026-01-05'
    assert m.period_start('2026-03-23', tr) == '2026-01-05'
    assert m.period_start('2026-05-11', tr) == '2026-05-04'
    assert m.period_start('2026-11-11', tr) == '2026-09-08'      # 07/09 feriado → pregão seguinte
    assert m.next_period_start('2026-11-11') == '2027-01-04'
    assert m.preview_window('2026-12-01', '2027-01-04') and not m.preview_window('2026-11-11', '2027-01-04')


def test_trechos_e_arquivo_enxuto():
    tr = [d.isoformat() for d in pd.bdate_range('2026-01-01', '2026-06-30').date]
    s = lambda *c: {'members': {x: {'part': 1} for x in c}}
    snaps = {'2026-01-05': s('A', 'B'), '2026-01-06': s('A', 'B'), '2026-02-02': s('A'), '2026-03-02': s('A'), '2026-05-04': s('A', 'C')}
    assert m.segments(snaps, tr) == [('2026-01-05', '2026-01-05'), ('2026-02-02', '2026-02-02'), ('2026-05-04', '2026-05-04')]
    assert sorted(m.prune_archive(snaps, tr)) == ['2026-01-05', '2026-02-02', '2026-03-02', '2026-05-04']


def test_encadeamento_soma_a_variacao_quando_o_indice_segue_a_carteira():
    dates = [d.isoformat() for d in pd.bdate_range('2026-01-02', periods=6).date]
    idx = pd.to_datetime(dates)
    tr = pd.DataFrame({'A': [10, 11, 12, 11, 13, 13.5], 'B': [20, 19, 19.5, 21, 20, 22]}, index=idx, dtype=float)
    q = {'A': 3.0, 'B': 1.0}
    level = list((tr['A'] * q['A'] + tr['B'] * q['B']).values)
    part = {c: q[c] * tr[c].iloc[2] / level[2] * 100 for c in q}       # peso publicado em dates[3] (fechamento de dates[2])
    res = m.chain(dates, level, [(dates[1], part, dates[3])], tr, tr)
    for t in range(1, 6):
        assert abs(sum(res[c]['pts'][t] for c in q) - (level[t] - level[t - 1])) < 1e-9
        assert abs(sum(res[c]['w'][t] for c in q) - 1) < 1e-12
    assert res['A']['pts'][0] is None


def test_eventos_de_ajuste_compactos():
    assert m.adj_events([10, 10, 9, 9], [9, 9, 9, 9]) == [[0, 0.9], [2, 1.0]]
    assert m.adj_events([None, 5], [None, 5]) == [[1, 1.0]]


def test_carteira_de_hoje_antes_do_fechamento_oficial():
    # carteira datada do dia seguinte ao último fechamento oficial: peso = fechamento do último pregão
    dates = [d.isoformat() for d in pd.bdate_range('2026-01-02', periods=6).date]
    idx = pd.to_datetime(dates)
    tr = pd.DataFrame({'A': [10, 11, 12, 11, 13, 20], 'B': [20, 19, 19.5, 21, 20, 18]}, index=idx, dtype=float)
    q = {'A': 3.0, 'B': 1.0}
    level = list((tr['A'] * q['A'] + tr['B'] * q['B']).values)
    part = {c: q[c] * tr[c].iloc[5] / level[5] * 100 for c in q}
    hoje = pd.bdate_range(dates[-1], periods=2)[1].date().isoformat()
    res = m.chain(dates, level, [(dates[1], part, hoje)], tr, tr)
    for t in range(1, 6):
        assert abs(sum(res[c]['pts'][t] for c in q) - (level[t] - level[t - 1])) < 1e-9
