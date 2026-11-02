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
