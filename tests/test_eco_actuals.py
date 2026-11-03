"""Realizado/anterior/expectativa da agenda ECO a partir de séries oficiais (respostas reais salvas em fixtures, sem rede)."""
import os, json, datetime as dt
import pytest
import eco_actuals as ea

FX = os.path.join(os.path.dirname(__file__), 'fixtures', 'eco_actuals')
def js(n): return json.load(open(os.path.join(FX, n), encoding='utf-8'))
TODAY = dt.date(2026, 11, 3)

def ev(day, event, src, period=None, hm='08:00', **kw):
    r = {'country': 'BR', 'time': f'{day}T{hm}-03:00', 'event': event, 'event_pt': event, 'period': period, 'agency': 'X',
         'survey': None, 'actual': None, 'prior': None, 'unit': None, 'key': False, 'tier': 2, 'src': src}
    r.update(kw); return r

def one(rows, series, focus=None, today=TODAY):
    out, n = ea.enrich(rows, series, focus or {}, today)
    return out[0] if len(out) == 1 else out

# ---------------- períodos ----------------
@pytest.mark.parametrize('p,k', [('10/2026', '2026-10'), ('September 2026', '2026-09'), ('Q3/2026', '2026-Q3'),
                                 ('third quarter 2026', '2026-Q3'), ('3rd Quarter 2026', '2026-Q3'), ('W2 10/2026', None), (None, None)])
def test_parse_period(p, k):
    assert ea.parse_period(p) == k

def test_ref_rules():
    d = dt.date
    assert ea.ref_period('m-2', d(2026, 10, 16)) == '2026-08'           # IBC-Br de outubro = agosto
    assert ea.ref_period('m-1', d(2026, 1, 16)) == '2025-12'
    assert ea.ref_period('flash', d(2026, 11, 4)) == '2026-10'          # prévia do HICP no início do mês seguinte
    assert ea.ref_period('flash', d(2026, 10, 31)) == '2026-10'
    assert ea.ref_period('q-1', d(2026, 10, 30)) == '2026-Q3'
    assert ea.ref_period('q-1', d(2026, 1, 30)) == '2025-Q4'
    assert ea.ref_period('w', d(2026, 10, 15)) == '2026-10-10'          # quinta → semana terminada no sábado anterior
    assert ea.prev_period('2026-01') == '2025-12' and ea.prev_period('2026-Q1') == '2025-Q4'
    assert ea.prev_period('2026-10-10') == '2026-10-03'
    assert ea.period_label('2026-10-10') == '10/10/2026' and ea.period_label('2026-Q3') == 'Q3/2026' and ea.period_label('2026-08') == '08/2026'

def test_transform():
    pts = {'2025-09': 100.0, '2026-08': 110.0, '2026-09': 110.0 * 1.0034}
    t = ea.transform(pts, 'pct')
    assert round(t['2026-09'], 2) == 0.34 and '2025-09' not in t      # sem o mês anterior, não calcula
    assert round(ea.transform(pts, 'yoy')['2026-09'], 2) == round((110.374 / 100 - 1) * 100, 2)
    assert ea.transform({'2026-10-10': 200000.0}, 'k') == {'2026-10-10': 200.0}

# ---------------- parsers com respostas reais ----------------
def test_sgs_igpm_e_ibcbr():
    get = lambda u: js('sgs_189.json') if 'sgs.189/' in u else js('sgs_24364.json')
    igpm = ea.fetch_sgs(189, get, dt.date(2026, 6, 1))
    assert igpm['2026-10'] == 1.47 and igpm['2026-09'] == 1.57
    r = one([ev('2026-10-29', 'IGP-M general price index', 'fgv', '10/2026')], {'sgs:189': igpm})
    assert (r['actual'], r['prior'], r['unit']) == (1.47, 1.57, '% m/m')
    ibc = ea.fetch_sgs(24364, get, dt.date(2026, 5, 1))
    r = one([ev('2026-10-16', 'IBC-Br economic activity index', 'bcb', hm='09:00')], {'sgs:24364': ibc})
    assert r['period'] == '08/2026' and r['actual'] == round((ibc['2026-08'] / ibc['2026-07'] - 1) * 100, 2) and r['actual'] == 0.34

def test_eurostat_jsonstat():
    hicp = ea.parse_jsonstat(js('es_hicp.json'))
    assert hicp['2026-09'] == 3.8 and hicp['2026-08'] == 3.2
    gdp = ea.parse_jsonstat(js('es_gdp.json'))
    assert gdp['2026-Q3'] == 0.4 and gdp['2026-Q2'] == 0.6
    assert ea.parse_jsonstat(js('es_une_ea.json')) == {}              # 'EA' vazio no desemprego → tenta 'EA21'
    rows = [ev('2026-10-16', 'Euro area inflation (HICP, final)', 'eurostat', hm='06:00'),
            ev('2026-11-04', 'Euro area flash inflation (HICP)', 'eurostat', hm='07:00'),
            ev('2026-10-30', 'Euro area GDP (flash)', 'eurostat', hm='07:00')]
    fin, flash, g = one(rows, {'es:hicp': hicp, 'es:gdp': gdp})
    assert (fin['period'], fin['actual'], fin['prior']) == ('09/2026', 3.8, 3.2)
    assert (flash['period'], flash['actual'], flash['prior']) == ('10/2026', None, 3.8)   # ainda não divulgado
    assert (g['period'], g['actual'], g['prior'], g['unit']) == ('Q3/2026', 0.4, 0.6, '% q/q')

def test_eurostat_geo_fallback():
    calls = []
    def get(u):
        calls.append(u)
        return js('es_une_ea.json') if 'geo=EA&' in u else {**js('es_une_ea.json'), 'size': [1] * 6 + [1], 'value': {'0': 6.5},
                                                              'dimension': {**js('es_une_ea.json')['dimension'], 'time': {'category': {'index': {'2026-09': 0}}}}}
    pts = ea.fetch_eurostat('es:une', get, dt.date(2026, 1, 1))
    assert pts == {'2026-09': 6.5} and 'geo=EA21' in calls[-1]

def test_jsonstat_recusa_series_misturadas():
    d = js('es_hicp.json'); d = {**d, 'size': [1, 1, 2, 1, 5]}
    with pytest.raises(ValueError): ea.parse_jsonstat(d)

def test_statcan():
    sc = ea.parse_statcan(js('statcan.json'))
    assert sc['sc:2062815']['2026-09'] == 6.5
    assert '2026-Q2' in sc['sc:62305752'] and len(sc['sc:41690973']) == 14
    rows = [ev('2026-10-09', 'Canada employment (LFS)', 'statcan', 'September 2026', hm='09:30'),
            ev('2026-10-19', 'Canada CPI inflation', 'statcan', 'September 2026', hm='09:30'),
            ev('2026-11-30', 'Canada GDP (quarterly)', 'statcan', 'third quarter 2026', hm='10:30')]
    lfs, cpi, gdp = one(rows, sc)
    assert lfs['event'] == 'Canada unemployment rate (LFS)' and (lfs['actual'], lfs['prior'], lfs['unit']) == (6.5, 6.4, '%')
    c = sc['sc:41690973']
    assert cpi['actual'] == round((c['2026-09'] / c['2025-09'] - 1) * 100, 1) and cpi['unit'] == '% y/y'
    q = sc['sc:62305752']
    assert gdp['actual'] is None and gdp['prior'] == round((q['2026-Q2'] / q['2026-Q1'] - 1) * 100, 1)

def test_fred_semanal_e_mensal():
    import pandas as pd
    s_icsa = pd.Series([198000.0, 200000.0, 195000.0], index=pd.to_datetime(['2026-10-03', '2026-10-10', '2026-10-17']))
    s_ip = pd.Series([100.0, 100.06, 100.72], index=pd.to_datetime(['2026-07-01', '2026-08-01', '2026-09-01']))
    s_eci = pd.Series([170.0, 171.53, 172.9], index=pd.to_datetime(['2026-01-01', '2026-04-01', '2026-07-01']))
    fr = ea.fetch_fred(['fred:ICSA', 'fred:INDPRO', 'fred:ECIALLCIV'], lambda ids, start: {'ICSA': s_icsa, 'INDPRO': s_ip, 'ECIALLCIV': s_eci}, dt.date(2026, 1, 1))
    assert fr['fred:ECIALLCIV'].keys() == {'2026-Q1', '2026-Q2', '2026-Q3'}
    rows = [ev('2026-10-15', 'Initial jobless claims', 'rules', hm='09:30'), ev('2026-10-22', 'Initial jobless claims', 'rules', hm='09:30'),
            ev('2026-10-29', 'Initial jobless claims', 'rules', hm='09:30'),
            ev('2026-10-16', 'Industrial production (G.17)', 'fred', hm='10:15'), ev('2026-10-30', 'Employment cost index', 'bls', hm='09:30')]
    a, b, c, ip, eci = one(rows, fr)
    assert (a['period'], a['actual'], a['prior'], a['unit']) == ('10/10/2026', 200.0, 198.0, 'k')
    assert (b['actual'], b['prior']) == (195.0, 200.0)
    assert (c['period'], c['actual'], c['prior']) == ('24/10/2026', None, 195.0)   # semana ainda sem dado: só o anterior
    assert (ip['period'], ip['actual'], ip['prior']) == ('09/2026', 0.66, 0.06)
    assert (eci['period'], eci['actual'], eci['unit']) == ('Q3/2026', 0.8, '% q/q')

def test_focus_survey():
    focus = {'IGP-M': {'10/2026': [('2026-10-27', 1.3), ('2026-10-28', 1.38), ('2026-10-29', 1.45)]},
             'Taxa de desocupação': {'09/2026': [('2026-10-29', 5.3)]}}
    rows = [ev('2026-10-29', 'IGP-M general price index', 'fgv', '10/2026'),
            ev('2026-10-30', 'Unemployment rate (PNAD, 3-mo)', 'ibge', '09/2026', series='desemprego', actual=5.2, prior=5.3, unit='%'),
            ev('2026-10-19', 'IGP-10 general price index', 'fgv', '10/2026')]
    g, u, i10 = one(rows, {}, focus)
    assert g['survey'] == 1.38                     # só medianas coletadas antes do dia da divulgação
    assert u['survey'] == 5.3 and u['actual'] == 5.2
    assert i10['survey'] is None                   # sem consenso gratuito → '—' na tela

def test_nao_sobrescreve_e_nao_inventa():
    r = ev('2026-10-29', 'IGP-M general price index', 'fgv', '10/2026', actual=9.9)
    out = one([r], {'sgs:189': {'2026-09': 1.57}})
    assert out['actual'] == 9.9 and out['prior'] == 1.57
    out = one([ev('2026-10-29', 'IGP-M general price index', 'fgv', '10/2026')], {'sgs:189': {'2026-10': 1.47, '2026-09': 1.57}}, today=dt.date(2026, 10, 28))
    assert out['actual'] is None and out['prior'] == 1.57               # data futura: só o anterior
    out = one([ev('2026-10-29', 'Something else', 'fgv', '10/2026')], {'sgs:189': {'2026-10': 1.47}})
    assert out['actual'] is None and out['unit'] is None
    assert one([ev('2026-10-30', 'Canada GDP (monthly)', 'statcan', 'August 2026')], {'sc:65201210': {'2026-07': 100.0, '2026-08': 99.999}})['actual'] == 0.0

def test_fetch_all_cache(tmp_path):
    p = str(tmp_path / 'eco_series.json')
    ok = {'sgs': lambda ids: {'sgs:189': {'2026-10': 1.47}}}
    pts, st = ea.fetch_all(['sgs:189'], ok, '2026-11-03T12:00', [p], tries=1)
    assert pts == {'sgs:189': {'2026-10': 1.47}} and st['ok'] == ['sgs:189']
    def boom(ids): raise RuntimeError('fora do ar')
    calls = []
    def flaky(ids):
        calls.append(1)
        if len(calls) < 2: raise RuntimeError('timeout')
        return {'sgs:189': {'2026-10': 1.47, '2026-11': 0.5}}
    pts, st = ea.fetch_all(['sgs:189'], {'sgs': flaky}, '2026-11-04T12:00', [p], tries=2)
    assert len(calls) == 2 and pts['sgs:189']['2026-11'] == 0.5         # nova tentativa
    pts, st = ea.fetch_all(['sgs:189', 'sgs:190'], {'sgs': boom}, '2026-11-05T12:00', [p], tries=1)
    assert pts == {'sgs:189': {'2026-10': 1.47, '2026-11': 0.5}}        # último valor bom
    assert st == {'ok': [], 'cached': ['sgs:189'], 'missing': ['sgs:190']}

def test_specs_bem_formados():
    for srcs, pat, sid, rule, how, unit, dec, ind, rename in ea.SPECS:
        assert isinstance(srcs, tuple) and rule in ('p', 'm', 'm-1', 'm-2', 'flash', 'q-1', 'w')
        assert (sid is None) == (how is None)
        assert sid is None or sid.split(':')[0] in ('sgs', 'fred', 'es', 'sc')
        assert sid is None or not sid.startswith('es:') or sid in ea.EUROSTAT
    assert {'sgs:189', 'sgs:7447', 'sgs:7456', 'sgs:24364', 'fred:ICSA', 'fred:INDPRO', 'fred:ECIALLCIV'} <= set(ea.series_ids())
