"""GIP: barras intradiárias de todo o Ibovespa (build_extra.intraday) — união com o último arquivo bom, cortes e rodízio."""
import json
import build_extra as bx

T0 = 1793710800  # 03/11/2026 10:00 BRT (13:00 UTC)
def b(k, o, h, l, c, v, day=0): return [T0 + day * 86400 + k * 60, o, h, l, c, v]


def test_drop_snapshot_tira_so_a_barra_final_plana_sem_volume():
    assert bx.drop_snapshot([b(0, 10, 11, 9, 10, 5), b(1, 10, 10, 10, 10, 0)]) == [b(0, 10, 11, 9, 10, 5)]
    idx = [b(0, 10, 11, 9, 10, 0), b(1, 10, 10.5, 10, 10.2, 0)]   # índice: sem volume, mas com variação → fica
    assert bx.drop_snapshot(idx) == idx


def test_merge_bars_novo_prevalece_e_ordena():
    prev = [b(0, 1, 1, 1, 1, 1), b(1, 2, 2, 2, 2, 2)]
    new = [b(1, 3, 3, 3, 3, 3), b(2, 4, 4, 4, 4, 4), [T0, None, 1, 1, 1, 0]]
    m = bx.merge_bars(prev, new)
    assert [x[1] for x in m] == [1, 3, 4]
    assert bx.merge_bars(None, None) == []


def test_trim_m1_dois_pregoes_e_m5_60_dias():
    B = [b(0, 1, 1, 1, 1, 1, d) for d in (-3, -1, 0)]
    assert [bx._session(x[0]) for x in bx.trim_m1(B)] == ['2026-11-02', '2026-11-03']
    C = [b(0, 1, 1, 1, 1, 1, d) for d in (-70, -59, 0)]
    assert len(bx.trim_m5(C)) == 2


def test_ibov_members_e_rodizio(tmp_path, monkeypatch):
    import common
    for mod in (common, bx): monkeypatch.setattr(mod, 'OUT', str(tmp_path))
    (tmp_path / 'tickers.json').write_text(json.dumps({'tickers': [
        {'ticker': 'WEGE3.SA', 'class': 'br_equity', 'index': ['IBOV']},
        {'ticker': 'LWSA3.SA', 'class': 'br_equity', 'index': ['SMLL']},
        {'ticker': 'AAPL', 'class': 'us_equity'}]}))
    U = bx.ibov_members()
    assert 'WEGE3.SA' in U and 'LWSA3.SA' not in U and 'AAPL' not in U and 'PETR4.SA' in U and U[-1] == '^BVSP'
    (tmp_path / 'intraday').mkdir()
    (tmp_path / 'intraday' / 'PETR4.json').write_text(json.dumps({'generated_at': '2026-11-03T10:00:00-03:00'}))
    (tmp_path / 'intraday' / 'VALE3.json').write_text(json.dumps({'generated_at': '2026-11-02T10:00:00-03:00'}))
    r = bx.rotation(['PETR4.SA', 'VALE3.SA', 'WEGE3.SA'])
    assert r == ['WEGE3.SA', 'VALE3.SA', 'PETR4.SA']   # sem arquivo → mais antigo → mais novo


def test_intraday_mantem_ultimo_arquivo_bom_quando_a_fonte_falha(tmp_path, monkeypatch):
    import common
    for mod in (common, bx): monkeypatch.setattr(mod, 'OUT', str(tmp_path))
    (tmp_path / 'tickers.json').write_text(json.dumps({'tickers': []}))
    (tmp_path / 'intraday').mkdir()
    old = {'ticker': 'PETR4.SA', 'generated_at': 'x', 'm1': [b(0, 1, 2, 0.5, 1.5, 10)], 'm5': []}
    (tmp_path / 'intraday' / 'PETR4.json').write_text(json.dumps(old))
    monkeypatch.setattr(bx, '_download', lambda tks, iv, per: {'VALE3.SA': [b(0, 5, 6, 4, 5.5, 100)]} if iv == '1m' else {})
    monkeypatch.setattr('time.sleep', lambda s: None)
    bx.intraday()
    assert json.loads((tmp_path / 'intraday' / 'PETR4.json').read_text()) == old         # falhou → arquivo anterior intacto
    v = json.loads((tmp_path / 'intraday' / 'VALE3.json').read_text())
    assert v['m1'] == [b(0, 5, 6, 4, 5.5, 100)] and v['m5'] == [] and 'Yahoo' in v['source']
    assert not (tmp_path / 'intraday' / 'ITUB4.json').exists()                           # sem dados → sem arquivo (nada inventado)
