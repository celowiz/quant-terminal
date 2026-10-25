"""Testes de build_credit.py: matemática de títulos públicos (fixture sintética no layout do CSV do Tesouro Transparente), Merton e agregação do Comex Stat."""
import datetime as dt, math, pathlib
import pytest
import build_macro as bm
import build_credit as bc

FX = pathlib.Path(__file__).parent / 'fixtures'
REF = dt.date(2026, 10, 23)


def rows():
    return {r['bond']: r for r in bm.parse_td((FX / 'td_sample.csv').read_text(encoding='utf-8'))['2026-10-23']}


def test_coupon_dates():
    assert bc.coupon_dates(REF, dt.date(2031, 1, 1))[:2] == [dt.date(2027, 1, 1), dt.date(2027, 7, 1)]
    ds = bc.coupon_dates(REF, dt.date(2035, 5, 15))
    assert ds[0] == dt.date(2026, 11, 15) and ds[-1] == dt.date(2035, 5, 15) and len(ds) == 18


def test_ntnf_fluxos_e_roundtrip():
    r = rows()['NTN-F']
    fl, vna = bc.bond_flows(r, REF)
    assert vna is None and len(fl) == 17 and fl[-1][1] == pytest.approx(1048.80885, abs=1e-5)
    p = bc.price(fl, r['rate'] / 100)
    assert bc.yld(fl, p) * 100 == pytest.approx(r['rate'], abs=1e-8)


def test_ltn_preco():
    from build_rates import du
    r = {'bond': 'LTN', 'maturity': '2027-04-01', 'rate': 13.2353, 'pu': 0}
    fl, _ = bc.bond_flows(r, REF)
    assert bc.price(fl, 0.132353) == pytest.approx(1000 / 1.132353 ** (du(REF, dt.date(2027, 4, 1)) / 252), abs=1e-9)


def test_vna_implicito_ntnb_ntnbp_lft():
    R = rows()
    for k in ('NTN-B', 'NTN-B P', 'LFT'):
        fl, vna = bc.bond_flows(R[k], REF)
        assert vna > 1000 and bc.price(fl, R[k]['rate'] / 100) == pytest.approx(R[k]['pu'], abs=1e-6)
    assert len(bc.bond_flows(R['NTN-B P'], REF)[0]) == 1 and len(bc.bond_flows(R['NTN-B'], REF)[0]) == 18


def test_yield_newton_e_risco():
    r = rows()['NTN-F']
    fl, _ = bc.bond_flows(r, REF)
    k = bc.risk(fl, r['rate'] / 100)
    assert 0 < k['mod'] < k['mac'] < 6
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
    assert t[2026]['bal'] == 35 and t[2026]['partial'] and t[2025]['partial'] and o['months'] == [1, 9]
    assert o['monthly'] == [{'month': '2026-09', 'exp': 10, 'imp': None}] and o['chapters']['exp'][0]['name'] == 'Ores'
