"""Testes das funções puras de build_fns1.py (BEIR, USMM, CBR, CRYP) com fixtures pequenas no formato real das fontes."""
import pathlib
import pandas as pd
import pytest
import build_fns1 as bf
import build_macro as bm

FX = pathlib.Path(__file__).parent / 'fixtures'


def test_breakeven_fisher():
    assert bf.breakeven(15.0, 8.0) == pytest.approx((1.15 / 1.08 - 1) * 100)
    assert bf.breakeven(None, 8.0) is None


def test_beir_day_interpola_e_nao_extrapola():
    rows = [{'bond': 'LTN', 'ref': '2026-01-02', 'maturity': '2028-01-01', 'rate': 14.0},
            {'bond': 'NTN-F', 'ref': '2026-01-02', 'maturity': '2036-01-01', 'rate': 13.0},
            {'bond': 'NTN-B P', 'ref': '2026-01-02', 'maturity': '2032-01-01', 'rate': 7.0},
            {'bond': 'NTN-B', 'ref': '2026-01-02', 'maturity': '2032-01-01', 'rate': 7.2},   # mesmo vencimento: fica o Principal
            {'bond': 'NTN-B P', 'ref': '2026-01-02', 'maturity': '2050-01-01', 'rate': 6.5}]
    verts, ten = bf.beir_day(rows)
    assert [v['maturity'] for v in verts] == ['2032-01-01', '2050-01-01']
    v = verts[0]
    assert v['bond'] == 'NTN-B P' and v['nominal'] == pytest.approx(13.5, abs=0.01)
    assert v['bei'] == pytest.approx((1.135 / 1.07 - 1) * 100, abs=0.01)
    assert verts[1]['nominal'] is None and verts[1]['bei'] is None          # além da curva prefixada
    assert ten['3Y']['real'] is None and ten['3Y']['bei'] is None           # antes do 1º IPCA+
    assert ten['7Y']['bei'] is not None and ten['10Y']['bei'] is None     # pré termina em 9,99 anos


def test_beir_obj_com_fixture_td():
    hist = bm.parse_td((FX / 'td_sample.csv').read_text(encoding='utf-8'))
    o = bf.build_beir_obj(hist)
    assert o['date'] == '2026-10-23' and o['vertices']
    for v in o['vertices']:
        if v['bei'] is not None: assert 2 < v['bei'] < 12
    assert set(o['history']) == {k for k, _ in bf.BEIR_TENORS}


NY = {'refRates': [
    {'effectiveDate': '2026-10-28', 'type': 'SOFR', 'percentRate': 3.94, 'percentPercentile1': 3.89, 'percentPercentile25': 3.92, 'percentPercentile75': 3.99, 'percentPercentile99': 4.02, 'volumeInBillions': 3074},
    {'effectiveDate': '2026-10-29', 'type': 'SOFR', 'percentRate': 3.96, 'percentPercentile1': 3.89, 'percentPercentile25': 3.92, 'percentPercentile75': 3.99, 'percentPercentile99': 4.02, 'volumeInBillions': 3145},
    {'effectiveDate': '2026-10-29', 'type': 'EFFR', 'percentRate': 3.88, 'percentPercentile1': 3.83, 'targetRateFrom': 3.75, 'targetRateTo': 4.0, 'volumeInBillions': 117},
    {'effectiveDate': '2026-10-30', 'type': 'SOFRAI', 'average30day': 3.89857, 'average90day': 3.77532, 'average180day': 3.71759, 'index': 1.2649531},
]}


def test_parse_usmm():
    o = bf.parse_usmm(NY)
    s = next(x for x in o['latest'] if x['rate'] == 'SOFR')
    assert s['value'] == 3.96 and s['d1_bp'] == pytest.approx(2.0) and s['p99'] == 4.02 and s['volume_bn'] == 3145
    assert o['band'] == [['2026-10-29', 3.75, 4.0]]
    assert o['sofrai'][-1][1] == pytest.approx(3.89857)
    assert [x['rate'] for x in o['latest']] == ['SOFR', 'EFFR']


BIS_D = """FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE
D,BR,2026-06-17,14.25
D,BR,2026-06-18,14.0
D,BR,2026-09-17,14.0
D,BR,2026-09-18,13.75
D,BR,2026-10-27,13.75
D,US,2026-10-27,3.875
"""
BIS_M = """FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE
M,BR,2025-10,15.0
M,BR,2026-09,13.75
M,US,2025-10,4.125
M,US,2026-09,3.875
M,GR,2000-12,5.75
"""


def test_cbr_obj():
    d, m = bf.parse_bis_csv(BIS_D), bf.parse_bis_csv(BIS_M)
    o = bf.build_cbr_obj(d, m, pd.Timestamp('2026-10-30').date())
    codes = [b['code'] for b in o['banks']]
    assert codes == ['BR', 'US']                                  # ordenado por taxa; GR (série encerrada) fora
    br = o['banks'][0]
    assert br['rate'] == 13.75 and br['last_move'] == '2026-09-18' and br['last_move_bp'] == -25.0
    assert br['chg_3m_bp'] == -25 and br['chg_1y_bp'] == -125
    assert br['hist'][-1] == ['2026-09', 13.75] and br['name_pt'] == 'Brasil'


def test_parse_coins_fng_tvl():
    c = bf.parse_coins([{'id': 'bitcoin', 'symbol': 'btc', 'name': 'Bitcoin', 'market_cap_rank': 1, 'current_price': 77776, 'market_cap': 1.5e12,
                         'total_volume': 1e11, 'price_change_percentage_24h_in_currency': -4.456, 'sparkline_in_7d': {'price': list(range(168))}},
                        {'id': 'x', 'symbol': 'x', 'current_price': None}])
    assert len(c) == 1 and c[0]['sym'] == 'BTC' and c[0]['ch24'] == -4.46 and len(c[0]['spark']) == 42
    f = bf.parse_fng({'data': [{'value': '30', 'value_classification': 'Fear', 'timestamp': '1793318400'}, {'value': '55', 'value_classification': 'Neutral', 'timestamp': '1793232000'}]})
    assert f == [['2026-10-29', 55, 'Neutral'], ['2026-10-30', 30, 'Fear']]
    h, top = bf.parse_tvl([{'date': 1793318400, 'tvl': 83.43e9}, {'date': 1506470400, 'tvl': 0}], [{'name': 'Ethereum', 'tokenSymbol': 'ETH', 'tvl': 3e9}, {'name': 'Tron', 'tvl': 1e9}, {'name': 'Z', 'tvl': None}])
    assert h == [['2026-10-30', 83.43]]
    assert top[0] == {'name': 'Ethereum', 'sym': 'ETH', 'tvl_bn': 3.0, 'share': 75.0}
