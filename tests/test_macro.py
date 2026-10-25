"""Testes das funções puras de build_macro.py (WB, FOMC, WIRP, ECO, FXFC, FXC, GMM) com fixtures reais."""
import datetime as dt, json, math, pathlib
import pandas as pd
import pytest
import build_macro as bm

FX = pathlib.Path(__file__).parent / 'fixtures'


def test_parse_td():
    h = bm.parse_td((FX / 'td_sample.csv').read_text(encoding='utf-8'))
    assert list(h) == ['2026-10-22', '2026-10-23']
    rows = h['2026-10-23']
    assert {r['bond'] for r in rows} == {'LTN', 'NTN-F', 'NTN-B', 'NTN-B P', 'LFT'}   # Educa+ e Renda+ fora
    f = next(r for r in rows if r['bond'] == 'NTN-F')
    assert f == {'bond': 'NTN-F', 'ref': '2026-10-23', 'maturity': '2035-01-01', 'rate': 13.42, 'bid': 13.42, 'ask': 13.3, 'pu': 862.4}
    assert bm.parse_td((FX / 'td_sample.csv').read_text(encoding='utf-8'), dt.date(2026, 10, 23)).keys() == {'2026-10-23'}


def test_interp_e_br_pre_tenor():
    assert bm.interp([1, 2], [10, 20], 1.5) == 15
    assert bm.interp([1, 2], [10, 20], 0.5) == 10      # trava na ponta
    assert bm.interp([1, 2], [10, 20], 3.5) is None    # não extrapola além de 1 ano
    rows = [{'bond': 'LTN', 'ref': '2026-01-01', 'maturity': '2027-01-01', 'rate': 12.0},
            {'bond': 'NTN-F', 'ref': '2026-01-01', 'maturity': '2031-01-01', 'rate': 13.0},
            {'bond': 'NTN-B', 'ref': '2026-01-01', 'maturity': '2029-01-01', 'rate': 6.0}]
    assert bm.br_pre_tenor(rows, 3.0) == pytest.approx(12.5, abs=0.01)


def test_series_stats_bp():
    idx = pd.bdate_range('2025-01-01', '2026-10-23')
    s = pd.Series([4.0 + i * 0.001 for i in range(len(idx))], index=idx)
    st = bm.series_stats(s, 'D')
    assert st['date'] == '2026-10-23' and st['d1'] == pytest.approx(0.1, abs=1e-6)
    assert st['yld'] == pytest.approx(s.iloc[-1], abs=1e-3) and len(st['spark']) == 66


FOMC_HTML = '''<h4><a id="1">2026 FOMC Meetings</a></h4>
<div class="fomc-meeting__month"><strong>January</strong></div><div class="fomc-meeting__date">27-28</div>
<div class="fomc-meeting__month"><strong>March</strong></div><div class="fomc-meeting__date">17-18*</div>
<div class="fomc-meeting__month"><strong>Apr/May</strong></div><div class="fomc-meeting__date">28-29</div>
<div class="fomc-meeting__month"><strong>Jul/Aug</strong></div><div class="fomc-meeting__date">31-1</div>
<div class="fomc-meeting__month"><strong>October</strong></div><div class="fomc-meeting__date">27-28 (notation vote)</div>
'''


def test_parse_fomc_calendar():
    m = bm.parse_fomc_calendar(FOMC_HTML)
    assert [x['decision'] for x in m] == ['2026-01-28', '2026-03-18', '2026-04-29', '2026-08-01', '2026-10-28']
    assert m[1]['sep'] and not m[0]['sep'] and m[4]['note'] == 'notation vote' and m[3]['start'] == '2026-07-31'


def test_fomc_decisions_e_unscheduled():
    idx = pd.date_range('2026-01-01', '2026-03-31')
    up = pd.Series([4.5] * len(idx), index=idx); up[up.index >= '2026-01-29'] = 4.25; up[up.index >= '2026-03-05'] = 4.0
    lo = up - 0.25
    meets = [{'start': '2026-01-27', 'decision': '2026-01-28', 'sep': False, 'note': ''}]
    out = bm.fomc_decisions(meets, up, lo)
    assert out[0]['decided'] and out[0]['change_bp'] == -25 and out[0]['upper'] == 4.25
    assert out[1]['note'].startswith('unscheduled') and out[1]['change_bp'] == -25


def test_move_probs():
    p = bm.move_probs(-37.0)
    assert p == [{'move_bp': -50, 'prob': 48.0}, {'move_bp': -25, 'prob': 52.0}]
    assert bm.move_probs(0.0) == [{'move_bp': 0, 'prob': 100.0}]
    assert bm.move_probs(None) == []


def test_fed_implied():
    # reunião em 28/out: 28 dias à taxa anterior, 3 dias à nova; novembro sem reunião → usa a média de novembro
    avg = {(2026, 10): 3.90, (2026, 11): 3.875, (2026, 12): 3.80}
    out = bm.fed_implied(['2026-10-28', '2026-12-09'], avg, 3.875)
    assert out[0]['contract'] == 'ZQX26.CBT' and out[0]['move_bp'] == pytest.approx(0.0)
    # dezembro: (3.80·31 − 3.875·9)/22
    assert out[1]['implied'] == pytest.approx((3.80 * 31 - 3.875 * 9) / 22, abs=1e-4)
    assert bm.zq_ticker(2027, 1) == 'ZQF27.CBT' and bm.days_in_month(2028, 2) == 29


def test_ibge_rows_fixture_real():
    items = json.loads((FX / 'ibge_calendar.json').read_text(encoding='utf-8'))['items']
    sidra = {'desemprego': {'202608': 5.3}, 'pim': {'202608': -0.6}, 'pib_qq': {'202602': 0.5}}
    sgs433 = {'202608': -0.32, '202609': 0.82}
    focus = {'09/2026': [('2026-10-01', 0.6)], '10/2026': [('2026-10-20', 0.32), ('2026-11-20', 0.4)]}
    rows = bm.ibge_rows(items, sidra, sgs433, focus)
    by = {(r['event'], r['period']): r for r in rows}
    ipca = by[('IPCA MoM', '09/2026')]
    assert ipca['time'] == '2026-10-09T09:00-03:00' and ipca['actual'] == 0.82 and ipca['prior'] == -0.32 and ipca['survey'] == 0.6
    assert by[('IPCA MoM', '10/2026')]['survey'] == 0.32       # só expectativas até a data de divulgação
    assert by[('IPCA MoM', '10/2026')]['actual'] is None
    assert by[('GDP QoQ (sa)', 'Q3/2026')]['prior'] == 0.5      # trimestral: chave YYYYQQ
    assert by[('Industrial production MoM (sa)', '09/2026')]['prior'] == -0.6
    assert ('Industrial production MoM (sa)', '08/2026') not in by   # Regional não é a PIM Brasil
    assert by[('Unemployment rate (PNAD, 3-mo)', '10/2026')]['prior'] is None   # set/26 ainda não divulgado
    assert any(r['event'] == 'INPC consumer prices' for r in rows)
    assert all(r['country'] == 'BR' for r in rows)


def test_prev_key():
    assert bm.prev_key('202601') == '202512' and bm.prev_key('202610') == '202609'
    assert bm.prev_key('202601', True) == '202504' and bm.prev_key('202603', True) == '202602'


def test_parse_ics_e_census_e_period_key():
    ics = ('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:20261029T083000\r\nSUMMARY:GDP (Advance Estimate)\\, 3rd Q\r\n uarter 2026\r\nEND:VEVENT\r\n'
           'BEGIN:VEVENT\r\nDTSTART:20261126T133000Z\r\nSUMMARY:Personal Income and Outlays\\, October 2026\r\nEND:VEVENT\r\nEND:VCALENDAR')
    ev = bm.parse_ics(ics)
    assert ev[0]['summary'] == 'GDP (Advance Estimate), 3rd Quarter 2026' and ev[0]['time'].hour == 8
    assert ev[1]['time'].utcoffset() == dt.timedelta(0)
    h = ('<table id="calendar"><tr><td><a href="#">Advance Monthly Sales for Retail and Food Services</a></td>'
         '<td>November 17, 2026</td><td>8:30 AM</td><td>October 2026</td></tr></table>')
    c = bm.parse_census(h)
    assert c[0]['period'] == 'October 2026' and c[0]['time'].month == 11 and c[0]['time'].hour == 8
    assert bm.period_key('October 2026') == 202610 and bm.period_key('3rd Quarter 2026') == 202607
    assert re_gdp('GDP (Advance Estimate), 3rd Quarter 2026') and not re_gdp('GDP by State, 2nd Quarter 2026')


def re_gdp(s):
    import re
    return bool(re.search(bm.US_MAP[0][0], s))


def test_us_rows_actual_e_prior():
    fr = {'RSAFS': pd.Series([100.0, 101.0, 102.01], index=pd.to_datetime(['2026-07-01', '2026-08-01', '2026-09-01']))}
    ev = [{'summary': 'Advance Monthly Sales for Retail and Food Services', 'time': dt.datetime(2026, 10, 15, 8, 30, tzinfo=bm.NY), 'period': 'September 2026'}]
    r = bm.us_rows(ev, fr)[0]
    assert r['event'] == 'Retail sales MoM' and r['actual'] == pytest.approx(1.0) and r['prior'] == pytest.approx(1.0)
    assert r['time'] == '2026-10-15T09:30-03:00'


def test_cip_forward_e_cross():
    f = bm.cip_forward(5.0, 13.0, 252, 4.0, 1.0)
    assert f == pytest.approx(5.0 * 1.13 / 1.04)
    assert bm.cip_forward(None, 13, 1, 4, 1) is None
    up = {'BRL': 5.0, 'EUR': 0.9}
    assert bm.cross(up, 'EUR', 'BRL') == pytest.approx(5.0 / 0.9)
    assert bm.cross(up, 'USD', 'BRL') == 5.0 and bm.cross(up, 'BRL', 'USD') == pytest.approx(0.2)
    assert bm.cross(up, 'XXX', 'BRL') is None


def test_chg_block():
    d = pd.bdate_range('2025-12-01', '2026-10-23')
    v = [100.0] * (len(d) - 1) + [110.0]
    b = bm.chg_block(d, v, 'pct')
    assert b['d1'] == pytest.approx(10.0) and b['ytd'] == pytest.approx(10.0) and b['mtd'] == pytest.approx(10.0)
    r = bm.chg_block(d, [4.0] * (len(d) - 1) + [4.1], 'bp')
    assert r['d1'] == pytest.approx(10.0) and r['kind'] == 'bp'
    assert bm.chg_block(d[:2], [1, 2], 'pct') is None


# ---- FRED fora do ar no CI: disjuntor e fontes alternativas -------------------------------------------------------
def test_parse_treasury_csv():
    txt = ('Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"\n'
           '10/23/2026,4.11,4.11,4.16,4.22,4.30,4.30,4.44,4.69,4.75,4.82,4.89,5.00,5.37,5.33\n'
           '10/22/2026,4.11,4.10,4.16,4.22,4.29,4.29,4.41,4.65,4.72,4.78,4.86,4.96,5.32,5.29\n')
    f = bm.parse_treasury_csv(txt)
    assert set(f) == {'DGS2', 'DGS5', 'DGS10', 'DGS30'}
    assert list(f['DGS10'].index.strftime('%Y-%m-%d')) == ['2026-10-22', '2026-10-23']   # ordenado
    assert f['DGS10'].iloc[-1] == 5.00 and f['DGS2'].iloc[0] == 4.65


def test_parse_nyfed_effr():
    d = {'refRates': [
        {'effectiveDate': '2026-10-22', 'type': 'EFFR', 'percentRate': 3.88, 'targetRateFrom': 3.75, 'targetRateTo': 4.00},
        {'effectiveDate': '2026-09-16', 'type': 'EFFR', 'percentRate': 4.08, 'targetRateFrom': 4.00, 'targetRateTo': 4.25}]}
    f = bm.parse_nyfed_effr(d)
    assert f['DFF'].iloc[-1] == 3.88 and f['DFEDTARU'].iloc[0] == 4.25 and f['DFEDTARL'].iloc[-1] == 3.75
    assert f['DFF'].index[0] < f['DFF'].index[-1]


def test_fred_breaker(monkeypatch):
    import common
    calls = []
    def boom(url, **kw): calls.append(url); raise RuntimeError('ReadTimeout')
    monkeypatch.setattr(common, 'get', boom)
    monkeypatch.setitem(common._FRED, 'fails', 0)
    monkeypatch.delenv('QT_NO_FRED', raising=False)
    out = bm.fred(['A', 'B', 'C', 'D'], '2026-01-01')
    assert out == {} and len(calls) == common.FRED_MAX_FAILS   # depois de 2 falhas, as demais séries nem tentam
    monkeypatch.setenv('QT_NO_FRED', '1'); monkeypatch.setitem(common._FRED, 'fails', 0)
    assert bm.fred(['A'], '2026-01-01') == {} and len(calls) == common.FRED_MAX_FAILS
