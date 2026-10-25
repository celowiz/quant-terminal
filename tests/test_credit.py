"""Testes de build_credit.py: matemática de títulos públicos (conferida contra o PU ANBIMA), Merton e agregação do Comex Stat."""
import datetime as dt, math, pathlib
import pytest
import build_macro as bm
import build_credit as bc

FX = pathlib.Path(__file__).parent / 'fixtures'
REF = dt.date(2026, 10, 23)


def rows():
    return {r['bond']: r for r in bm.parse_anbima((FX / 'anbima_ms261023.txt').read_text(encoding='utf-8'))}


def test_coupon_dates():
    assert bc.coupon_dates(REF, dt.date(2031, 1, 1))[:2] == [dt.date(2027, 1, 1), dt.date(2027, 7, 1)]
    ds = bc.coupon_dates(REF, dt.date(2035, 5, 15))
    assert ds[0] == dt.date(2026, 11, 15) and ds[-1] == dt.date(2035, 5, 15) and len(ds) == 18


def test_ntnf_reproduz_pu_anbima():
    r = rows()['NTN-F']
    fl, vna = bc.bond_flows(r, REF)
    assert vna is None and len(fl) == 9 and fl[-1][1] == pytest.approx(1048.80885, abs=1e-5)
    assert bc.price(fl, r['rate'] / 100) == pytest.approx(r['pu'], abs=1e-3)


def test_ltn_preco():
    r = {'bond': 'LTN', 'maturity': '2027-04-01', 'rate': 13.2353, 'pu': 948.591309}
    fl, _ = bc.bond_flows(r, REF)
    assert bc.price(fl, 0.132353) == pytest.approx(948.591309, abs=1e-5)


def test_ntnb_vna_implicito_e_lft():
    b = rows()['NTN-B']
    fl, vna = bc.bond_flows(b, REF)
    assert 4700 < vna < 4800 and bc.price(fl, b['rate'] / 100) == pytest.approx(b['pu'], abs=1e-6)
    l = rows()['LFT']
    fl, vna = bc.bond_flows(l, REF)
    assert vna == pytest.approx(20149.8, abs=0.1)


def test_yield_newton_e_risco():
    r = rows()['NTN-F']
    fl, _ = bc.bond_flows(r, REF)
    assert bc.yld(fl, r['pu']) * 100 == pytest.approx(r['rate'], abs=1e-5)
    k = bc.risk(fl, r['rate'] / 100)
    assert 0 < k['mod'] < k['mac'] < 4.3
    # DV01 ≈ variação de preço por 1 bp
    dp = bc.price(fl, r['rate'] / 100 - 0.00005) - bc.price(fl, r['rate'] / 100 + 0.00005)
    assert k['dv01'] == pytest.approx(dp, rel=1e-3)
    zero = [[504, 1000.0, '']]
    assert bc.risk(zero, 0.1)['mac'] == pytest.approx(2.0)


def test_merton():
    m = bc.merton(E=100.0, sE=0.4, D=80.0, r=math.log(1.12))
    # consistência: equações de Merton satisfeitas
    sv, V, D, r = m['sV'], m['V'], 80.0, math.log(1.12)
    d1 = (math.log(V / D) + (r + sv * sv / 2)) / sv
    assert V * bc.ncdf(d1) - D * math.exp(-r) * bc.ncdf(d1 - sv) == pytest.approx(100.0, abs=1e-6)
    assert 0.4 * 100 == pytest.approx(bc.ncdf(d1) * sv * V, rel=1e-6)
    assert m['pd'] == pytest.approx(bc.ncdf(-m['dd'])) and m['dd'] > 0
    # mais alavancagem → menor DD
    assert bc.merton(100.0, 0.4, 300.0, r)['dd'] < m['dd']
    assert bc.merton(0, 0.4, 1, r) is None


def test_debt_asof_defasagem():
    h = {'2026-03-31': {'st': 1}, '2026-06-30': {'st': 2}}
    assert bc.debt_asof(h, dt.date(2026, 8, 1))[0] == '2026-03-31'
    assert bc.debt_asof(h, dt.date(2026, 8, 20))[0] == '2026-06-30'
    assert bc.debt_asof(h, dt.date(2026, 8, 1), 0)[0] == '2026-06-30'


def test_ectr_build():
    exp = bc.cx_rows([{'year': '2025', 'country': 'China', 'metricFOB': '100'}, {'year': '2026', 'country': 'China', 'metricFOB': '80'},
                      {'year': '2026', 'country': 'Chile ', 'metricFOB': '5'}], 'country')
    imp = bc.cx_rows([{'year': '2026', 'country': 'China', 'metricFOB': '50'}], 'country')
    o = bc.ectr_build(exp, imp, [{'year': '2026', 'monthNumber': '09', 'metricFOB': '10'}], [], [{'chapter': 'Ores', 'metricFOB': '7'}], None, 2026, 9, '2026-10-06')
    assert o['rows'][0]['country'] == 'China' and o['rows'][1]['country'] == 'Chile'
    t = {x['year']: x for x in o['totals']}
    assert t[2026]['bal'] == 35 and t[2026]['partial'] and not t[2025]['partial']
    assert o['monthly'] == [{'month': '2026-09', 'exp': 10, 'imp': None}] and o['chapters']['exp'][0]['name'] == 'Ores'
