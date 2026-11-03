"""Testes de build_slim.py: recorte recente, semanas W-FRI e pacote do RRG (sem rede)."""
import datetime as dt, json, os
import pandas as pd
import build_slim as bs
from common import unpack_prices


def _cols(n=900, start='2023-01-02'):
    d0 = dt.date.fromisoformat(start)
    days = [d0 + dt.timedelta(days=i) for i in range(n * 2) if (d0 + dt.timedelta(days=i)).weekday() < 5][:n]
    t = [d.isoformat() for d in days]
    c = [10 + i * 0.01 for i in range(n)]
    return {'t': t, 'o': c, 'h': c, 'l': c, 'c': c, 'v': [1000] * n}


def test_friday():
    assert bs.friday('2026-10-26') == '2026-10-30'   # segunda → sexta
    assert bs.friday('2026-10-30') == '2026-10-30'   # sexta → ela mesma
    assert bs.friday('2026-10-31') == '2026-11-06'   # sábado → próxima sexta (W-FRI)


def test_recent_corta_por_dias_corridos():
    c = _cols()
    r = bs.recent(c, 730)
    last = dt.date.fromisoformat(c['t'][-1])
    assert r['t'][-1] == c['t'][-1]
    assert dt.date.fromisoformat(r['t'][0]) >= last - dt.timedelta(days=730)
    assert all(len(r[k]) == len(r['t']) for k in r)
    assert bs.recent({'t': [], 'c': []}) == {'t': [], 'c': []}


def test_weekly_igual_pandas_wfri_last():
    c = _cols(600)
    rows = unpack_prices(c)
    w = bs.weekly(rows, weeks=50)
    s = pd.Series(c['c'], index=pd.to_datetime(c['t'])).resample('W-FRI').last().dropna().tail(50)
    assert w['t'] == [x.strftime('%Y-%m-%d') for x in s.index]
    assert w['c'] == list(s.values)
    assert w['last'] == c['t'][-1]


def test_slim_gera_arquivos_e_pacote(tmp_path, monkeypatch):
    p = tmp_path / 'prices'; p.mkdir()
    (p / 'PETR4.json').write_text(json.dumps(_cols()))
    rows = unpack_prices(_cols(50))   # formato antigo (linhas) também é aceito
    (p / 'XYZ3.json').write_text(json.dumps(rows))
    monkeypatch.setattr(bs, 'OUT', str(tmp_path))
    bs.slim()
    r = json.loads((tmp_path / 'prices/r/PETR4.json').read_text())
    assert len(r['t']) < 900 and r['t'][-1] == _cols()['t'][-1]
    assert (tmp_path / 'prices/r/XYZ3.json').exists() and (tmp_path / 'weekly/XYZ3.json').exists()
    b = json.loads((tmp_path / 'rrg.json').read_text())
    assert list(b['series']) == ['PETR4'] and b['last'] == _cols()['t'][-1] and b['weeks'] == bs.WEEKS
    assert not os.path.exists(tmp_path / 'prices/r/r')   # não recursa no subdiretório


def test_us_closed_through_portao_d1():
    utc = dt.timezone.utc
    # terça 2026-11-03: 14h ET (19h UTC) → pregão ainda aberto → segunda (D-1); 17h ET (22h UTC) → terça
    assert bs.us_closed_through(dt.datetime(2026, 11, 3, 19, 0, tzinfo=utc)) == '2026-11-02'
    assert bs.us_closed_through(dt.datetime(2026, 11, 3, 22, 0, tzinfo=utc)) == '2026-11-03'
    # segunda antes da abertura → sexta; sábado/domingo → sexta
    assert bs.us_closed_through(dt.datetime(2026, 11, 2, 10, 47, tzinfo=utc)) == '2026-10-30'
    assert bs.us_closed_through(dt.datetime(2026, 10, 31, 23, 0, tzinfo=utc)) == '2026-10-30'
    assert bs.us_closed_through(dt.datetime(2026, 11, 1, 23, 0, tzinfo=utc)) == '2026-10-30'


def test_weekly_through_descarta_barra_parcial():
    c = _cols(60)
    rows = unpack_prices(c)
    w = bs.weekly(rows, through=c['t'][-2])
    assert w['last'] == c['t'][-2]
    assert w['c'][-1] == c['c'][-2] or bs.friday(c['t'][-1]) != bs.friday(c['t'][-2])


def test_slim_pacote_us_separado_e_portao(tmp_path, monkeypatch):
    p = tmp_path / 'prices'; p.mkdir()
    for k in ('PETR4', 'AAPL', 'XLK', 'IDX_GSPC'): (p / f'{k}.json').write_text(json.dumps(_cols()))
    (tmp_path / 'tickers.json').write_text(json.dumps({'tickers': [{'ticker': 'AAPL', 'key': 'AAPL', 'class': 'us_equity'},
                                                                    {'ticker': 'XLK', 'key': 'XLK', 'class': 'etf'}]}))
    cut = _cols()['t'][-3]
    monkeypatch.setattr(bs, 'OUT', str(tmp_path))
    monkeypatch.setattr(bs, 'us_closed_through', lambda now=None: cut)
    bs.slim()
    br = json.loads((tmp_path / 'rrg.json').read_text())
    us = json.loads((tmp_path / 'rrg_us.json').read_text())
    assert sorted(br['series']) == ['IDX_GSPC', 'PETR4'] and sorted(us['series']) == ['AAPL', 'IDX_GSPC', 'XLK']
    assert us['series']['AAPL']['last'] == cut and us['series']['XLK']['last'] == cut and us['last'] == cut          # EUA: só até o último pregão encerrado
    assert json.loads((tmp_path / 'weekly/PETR4.json').read_text())['last'] == _cols()['t'][-1]   # BR não passa pelo portão
