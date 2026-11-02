"""Parsers da agenda ECO com páginas/arquivos oficiais salvos em tests/fixtures/eco (sem rede)."""
import os, json, datetime as dt
import pytest
import eco_sources as es

FX = os.path.join(os.path.dirname(__file__), 'fixtures', 'eco')
def txt(n): return open(os.path.join(FX, n), encoding='utf-8').read()
def js(n): return json.load(open(os.path.join(FX, n), encoding='utf-8'))
def find(rows, day, event):
    hit = [r for r in rows if r['time'][:10] == day and r['event'] == event]
    assert hit, (day, event, sorted({(r['time'][:10], r['event']) for r in rows})[:20])
    return hit[0]

def check_schema(rows):
    for r in rows:
        assert set(r) >= {'country', 'time', 'event', 'event_pt', 'agency', 'tier', 'key', 'src'}
        assert r['survey'] is None                      # nunca inventamos consenso
        assert r['time'].endswith('-03:00')             # sempre em BRT
        assert 1 <= r['tier'] <= 3 and r['key'] == (r['tier'] >= 3)
        assert r['event'] and r['event_pt']

def test_bcb_listas():
    rows = []
    for i, (lista, pat, en, pt, tier) in enumerate(es.BCB_LISTS):
        rows += es.parse_bcb_ics(txt(f'bcb_{i}.ics'), pat, en, pt, tier)
    check_schema(rows)
    assert find(rows, '2026-11-09', 'Focus market survey')['time'] == '2026-11-09T08:30-03:00'
    assert find(rows, '2026-11-10', 'Copom minutes')['tier'] == 3
    assert find(rows, '2026-11-16', 'IBC-Br economic activity index')
    assert find(rows, '2026-11-19', 'National Monetary Council (CMN) meeting').get('allday')   # 00:00 no ICS = sem horário

def test_bcb_falha_de_uma_lista_nao_derruba_as_outras():
    def fetch(url):
        if 'Focus' in url: raise RuntimeError('HTTP 500')
        i = next(i for i, l in enumerate(es.BCB_LISTS) if es.urllib.parse.quote(l[0]) in url)
        return txt(f'bcb_{i}.ics')
    rows = es.bcb(dt.date(2026, 11, 1), dt.date(2026, 11, 30), fetch)
    assert rows and not any(r['event'] == 'Focus market survey' for r in rows)

def test_fgv_mdic_caged():
    f = es.parse_fgv(txt('fgv.html')); check_schema(f)
    assert find(f, '2026-11-03', 'Business confidence (ICE)')['time'] == '2026-11-03T08:00-03:00'
    m = es.parse_mdic(txt('mdic.html')); check_schema(m)
    assert find(m, '2026-11-06', 'Trade balance (monthly)')['period'] == '10/2026'
    assert find(m, '2026-11-09', 'Trade balance (weekly partial)')['tier'] == 1
    c = es.parse_caged(txt('caged.html')); check_schema(c)
    r = find(c, '2026-11-04', 'Formal job creation (Novo CAGED)')
    assert r['allday'] and r['period'] == '09/2026' and r['agency'] == 'MTE'

def test_bls_ics_horario_et_para_brt():
    rows = es.parse_bls(txt('bls.ics')); check_schema(rows)
    assert find(rows, '2026-11-06', 'Nonfarm payrolls & unemployment rate')['time'] == '2026-11-06T10:30-03:00'   # 08:30 ET (EST)
    assert find(rows, '2026-11-10', 'CPI inflation')['tier'] == 3

def test_fred_datas_valida_id_e_reserva_do_bls():
    d = {'release_dates': [
        {'release_id': 10, 'release_name': 'Consumer Price Index', 'date': '2026-11-10'},
        {'release_id': 14, 'release_name': 'G.19 Consumer Credit', 'date': '2026-11-06'},
        {'release_id': 20, 'release_name': 'H.4.1 Factors Affecting Reserve Balances', 'date': '2026-11-05'},
        {'release_id': 13, 'release_name': 'Something else', 'date': '2026-11-17'},      # nome não bate com o id → ignora
        {'release_id': 999, 'release_name': 'Unknown', 'date': '2026-11-17'}]}
    no_bls = es.parse_fred_dates(d, with_bls=False)
    assert {r['event'] for r in no_bls} == {'Consumer credit (G.19)', 'Fed balance sheet (H.4.1)'}
    assert find(no_bls, '2026-11-05', 'Fed balance sheet (H.4.1)')['time'] == '2026-11-05T18:30-03:00'
    with_bls = es.parse_fred_dates(d, with_bls=True); check_schema(with_bls)
    r = find(with_bls, '2026-11-10', 'CPI inflation')
    assert r['time_approx'] and r['src'] == 'fred_bls'

def test_regras_ism_e_seguro_desemprego():
    rows = es.ism_claims(dt.date(2026, 11, 1), dt.date(2027, 1, 10)); check_schema(rows)
    assert find(rows, '2026-11-02', 'Manufacturing PMI (ISM)')['time'] == '2026-11-02T12:00-03:00'    # 1º dia útil, 10:00 ET
    assert find(rows, '2026-11-04', 'Services PMI (ISM)')
    assert find(rows, '2027-01-04', 'Manufacturing PMI (ISM)')                                          # 1/jan feriado → dia 4
    assert find(rows, '2026-11-25', 'Initial jobless claims')                                           # Ação de Graças (26/11) → quarta
    assert not [r for r in rows if r['time'][:10] == '2026-11-26']
    assert find(rows, '2026-12-24', 'Initial jobless claims')

def test_eia_feriados_e_umich_e_tesouro():
    hol = es.parse_eia_holidays(txt('eia.html'))
    assert hol[dt.date(2026, 11, 12)] == (12, 0)
    rows = es.eia(dt.date(2026, 11, 2), dt.date(2026, 11, 20), lambda u: txt('eia.html')); check_schema(rows)
    assert find(rows, '2026-11-12', 'Crude oil inventories (weekly)')['time'] == '2026-11-12T14:00-03:00'  # quinta 12:00 ET (Veterans Day)
    assert not [r for r in rows if r['time'][:10] == '2026-11-11']
    assert find(rows, '2026-11-04', 'Crude oil inventories (weekly)')['time'] == '2026-11-04T12:30-03:00'
    u = es.parse_umich(txt('um.html')); check_schema(u)
    assert find(u, '2026-11-06', 'Consumer sentiment (prelim.)')['time'] == '2026-11-06T12:00-03:00'
    t = es.parse_treasury(js('treasury.json')); check_schema(t)
    r = find(t, '2026-11-10', '10-Year note auction')
    assert r['allday'] and r['tier'] == 2                       # horário ainda não anunciado: não inventamos
    assert not [r for r in t if 'bill' in r['event'].lower()]

def test_pmi_utc_para_brt_e_paises():
    rows = es.parse_pmi(txt('pmi.html')); check_schema(rows)
    br = find(rows, '2026-11-03', 'Manufacturing PMI')
    assert br['country'] == 'BR' and br['time'] == '2026-11-03T10:00-03:00'         # 13:00 UTC
    assert {r['country'] for r in rows} >= {'BR', 'US', 'EA', 'DE', 'GB', 'JP', 'CN'}
    assert all(r['agency'] == 'S&P Global' for r in rows)

def test_eurostat_ons_statcan():
    e = es.parse_eurostat(txt('eurostat.ics')); check_schema(e)
    assert find(e, '2026-11-04', 'Euro area flash inflation (HICP)')['time'] == '2026-11-04T07:00-03:00'  # 11:00 CET
    assert find(e, '2026-11-13', 'Euro area GDP (flash)')
    o = es.parse_ons(js('ons.json')); check_schema(o)
    assert find(o, '2026-11-12', 'UK GDP (monthly)')['time'] == '2026-11-12T04:00-03:00'                  # 07:00 GMT
    assert len([r for r in o if r['event'] == 'UK GDP (quarterly)' and r['time'][:10] == '2026-11-12']) == 1
    s = es.parse_statcan(js('statcan.json')); check_schema(s)
    assert find(s, '2026-11-06', 'Canada employment (LFS)')['time'] == '2026-11-06T10:30-03:00'           # 08:30 ET
    assert find(s, '2026-11-16', 'Canada CPI inflation')['tier'] == 3

def test_bancos_centrais():
    ecb = es.parse_ecb(txt('ecb.html')); check_schema(ecb)
    assert find(ecb, '2026-12-17', 'ECB rate decision')['time'] == '2026-12-17T10:15-03:00'             # 14:15 CET
    boe = es.parse_boe(txt('boe.html')); check_schema(boe)
    assert find(boe, '2026-11-05', 'BoE rate decision')['time'] == '2026-11-05T09:00-03:00'             # 12:00 GMT
    boj = es.parse_boj(txt('boj.html')); check_schema(boj)
    assert find(boj, '2026-12-18', 'BoJ rate decision')['allday']                                       # último dia da reunião
    boc = es.parse_boc(txt('boc.html')); check_schema(boc)
    assert find(boc, '2026-12-09', 'BoC rate decision')['time'] == '2026-12-09T11:45-03:00'             # 09:45 ET

def test_collect_falha_suave_e_reaproveita_linhas_anteriores():
    a, b = dt.date(2026, 11, 1), dt.date(2026, 11, 30)
    prev = [es.row('GB', dt.datetime(2026, 11, 5, 12, tzinfo=es.LON), 'BoE rate decision', 'Decisão de juros do BoE', 'BoE', tier=3, src='boe')]
    def boom(url): raise RuntimeError('timeout')
    src = [('boe', es.boe, None, 'text'), ('umich', es.umich, None, 'text')]
    rows, st = es.collect(a, b, prev, fetchers={'boe': boom, 'umich': lambda u: txt('um.html')}, sources=src, seed={})
    assert st['boe'] == 0 and st['boe_stale'] and st['umich'] == 1 and st['fred'] == 0
    assert find(rows, '2026-11-05', 'BoE rate decision')
    assert find(rows, '2026-11-06', 'Consumer sentiment (prelim.)')

def test_collect_usa_fred_so_como_reserva_do_bls():
    a, b = dt.date(2026, 11, 1), dt.date(2026, 11, 30)
    d = {'release_dates': [{'release_id': 10, 'release_name': 'Consumer Price Index', 'date': '2026-11-10'},
                           {'release_id': 14, 'release_name': 'G.19 Consumer Credit', 'date': '2026-11-06'}]}
    ok = {'bls': lambda u: txt('bls.ics'), 'fred': lambda p: d}
    rows, st = es.collect(a, b, fetchers=ok, sources=[('bls', es.bls, None, 'text')], seed={})
    assert not [r for r in rows if r['src'] == 'fred_bls'] and st['fred'] == 1
    def boom(url): raise RuntimeError('HTTP 403')
    rows, st = es.collect(a, b, fetchers={'bls': boom, 'fred': lambda p: d}, sources=[('bls', es.bls, None, 'text')], seed={})
    assert st['bls'] == 0 and find(rows, '2026-11-10', 'CPI inflation')['src'] == 'fred_bls'

def test_chave_do_fred_nunca_aparece_no_erro(monkeypatch):
    import requests
    def fake(url, params=None, timeout=None): raise requests.ConnectionError(f'{url}?api_key={params["api_key"]} refused')
    monkeypatch.setattr(requests, 'get', fake)
    with pytest.raises(RuntimeError) as e:
        es.fred_key_fetch('SECRETKEY123')({'limit': 1})
    assert 'SECRETKEY123' not in str(e.value) and 'api_key' not in str(e.value)


def test_semente_cobre_fonte_que_recusa_o_runner():
    a, b = dt.date(2026, 11, 1), dt.date(2026, 11, 30)
    seed_rows = es.parse_fgv(txt('fgv.html'))
    seed = {'fgv': {'fetched_at': '2026-11-02T18:05-03:00', 'rows': seed_rows}}
    def boom(u): raise RuntimeError('SSLError')
    src = [('fgv', es.fgv, None, 'text')]
    rows, st = es.collect(a, b, prev_events=seed_rows[:2], fetchers={'fgv': boom}, sources=src, seed=seed)
    fg = [r for r in rows if r['src'] == 'fgv']
    assert st['fgv'] == 0 and st['fgv_stale'] and st['fgv_seed'] == '2026-11-02T18:05-03:00'
    assert len(fg) == len(es.in_window(seed_rows, a, b))           # anteriores + semente, sem duplicar
    rows, st = es.collect(a, b, fetchers={'fgv': boom}, sources=src, seed={})
    assert not [r for r in rows if r['src'] == 'fgv'] and 'fgv_seed' not in st


def test_fgv_pede_a_janela_inteira():
    seen = []
    es.fgv(dt.date(2026, 11, 1), dt.date(2027, 1, 31), lambda u: seen.append(u) or txt('fgv.html'))
    assert 'field_divulgacao_data_value=2026-11-01' in seen[0] and 'field_divulgacao_data_value_1=2027-01-31' in seen[0]


def test_semente_versionada_valida():
    s = es.load_seed()
    for name in ('fgv', 'bls'):
        assert s[name]['rows'] and s[name]['fetched_at']
        for r in s[name]['rows']: assert r['src'] == name and r['survey'] is None and r['event_pt']
