"""Testes das funções puras de build_calendar.py (CAL v2: sites de RI + CVM), com trechos reais das páginas."""
import datetime as dt
import pytest
import build_calendar as bc

D = dt.date
W = (D(2026, 9, 30), D(2027, 1, 28))   # janela da temporada 3T26


def test_quarters_e_temporada():
    assert bc.season(D(2026, 10, 29)) == (2026, 3)
    assert bc.season(D(2027, 2, 10)) == (2026, 4)
    assert bc.qlabel(2026, 3) == '3T26' and bc.quarter_end(2026, 3) == D(2026, 9, 30)
    assert bc.quarters_in('Divulgação de Resultados 3T2026') == {(2026, 3)}
    assert bc.quarters_in('Informações Trimestrais Referentes ao 3º trimestre de 2026') == {(2026, 3)}
    assert bc.quarters_in('3rd quarter 2026 earnings') == {(2026, 3)}
    assert bc.quarters_in("Divulgação de Resultados 3T26'27 - Raízen") == set()   # ano-safra, não é o 3T26


def test_dates_in():
    assert [d for _, d in bc.dates_in('05/11/2026', W)] == [D(2026, 11, 5)]
    assert [d for _, d in bc.dates_in('05/11: Divulgação', W)] == [D(2026, 11, 5)]                 # sem ano → janela
    assert [d for _, d in bc.dates_in('A Vale divulgará hoje, 29 de outubro de 2026, o relatório', W)] == [D(2026, 10, 29)]
    assert [d for _, d in bc.dates_in('06 ago', W)] == []                                         # fora da janela
    assert bc.dates_in('13/11 11h', W)[0][1] == D(2026, 11, 13)


def test_timing_of():
    assert bc.timing_of('Após o fechamento do mercado') == ('amc', None)
    assert bc.timing_of('antes da abertura do mercado') == ('bmo', None)
    assert bc.timing_of('quarta-feira, 11/11/2026 23:00-23:59h') == (None, None)    # placeholder da plataforma
    assert bc.timing_of('00:00') == (None, None)
    assert bc.timing_of('18:30') == ('amc', '18:30')
    assert bc.timing_of('11:00 (*) Horário de Brasília') == (None, '11:00')


def test_kind_of():
    assert bc.kind_of('Divulgação dos Resultados do 3T26', 'divulgacao-de-resultado') == 'results'
    assert bc.kind_of('Webcast de Resultados 3T26', 'webcast') == 'call'
    assert bc.kind_of('Período de Silêncio 3T26', 'outros-eventos') == 'other'
    assert bc.kind_of('Reunião Pública com Investidores e de Divulgação de Resultados do 3T26') == 'results'
    assert bc.kind_of('Videoconferência de Resultados e Reunião Pública com Mercado 3T26') == 'call'


UUID = '08f327aa-e610-4d9d-b683-8ff0f7caae07'

@pytest.mark.parametrize('html,idx,want', [
    (f'<script src="https://api.mziq.com/x.js"></script><script>var eventId = "{UUID}"; var lang = "pt-br"; mzevents</script>'
     f'<script>u = baseEventsUrl + "/calendar/{UUID}/" + lang</script>', 0, UUID),
    ('<script>const lang = "pt-br"; const COMPANIES = [ { id: "21e1d193-5cab-456d-8bb8-f00a49a43c1c", slug: "gerdau", },'
     ' { id: "0e58d869-d438-4c13-9d23-c24d27e72c47", slug: "metalurgica_gerdau", }, ]; mzevents '
     'ajaxurlCalendar = baseEventsUrl + "/calendar/" + COMPANIES[0].id + "/" + lang</script>', 1, '0e58d869-d438-4c13-9d23-c24d27e72c47'),
    ('<html>sem MZ</html>', 0, None),
])
def test_parse_mz_id(html, idx, want):
    got = bc.parse_mz_id(html, idx)
    assert (got[0] if got else None) == want
    if got: assert got[1] == 'pt-br'


def test_parse_mz_events_e_pick():
    js = [{'data': '11/12/2026', 'descricao': 'Webcast de Resultados 3T26', 'type': 'webcast', 'event_starttime': '09:00'},
          {'data': '11/11/2026', 'descricao': 'Divulgação dos Resultados do 3T26', 'type': 'divulgacao-de-resultado'},
          {'data': '11/10/2026', 'descricao': 'Período de Silêncio 3T26', 'type': 'outros-eventos'},
          {'data': '11/26/2026', 'descricao': 'Teleconferência 3T26 (reapresentação)', 'type': 'webcast'},
          {'data': '11/14/2025', 'descricao': 'Divulgação de Resultados 3T25', 'type': 'divulgacao-de-resultado'}]
    r, c = bc.pick(bc.parse_mz_events(js), 2026, 3)
    assert r['date'] == D(2026, 11, 11) and c['date'] == D(2026, 11, 12) and c['time'] == '09:00'
    grp = [{'data': '11/12/2026', 'descricao': 'Divulgação de Resultados 3T26 - Compass', 'type': 'divulgacao-de-resultado'},
           {'data': '11/13/2026', 'descricao': 'Divulgação de Resultados 3T26 - Cosan', 'type': 'divulgacao-de-resultado'}]
    assert bc.pick(bc.parse_mz_events(grp, 'Cosan'), 2026, 3)[0]['date'] == D(2026, 11, 13)


def test_parse_text_events_localiza_cemig_taesa_raia():
    rent = ['Exportar', '05/11/2026', '05/11: Divulgação de Resultados 3T26', '-', 'Após fechamento do mercado',
            '06/11/2026', '06/11: Webinar de Resultados 3T26', '11:00', '(*) Horário de Brasília']
    r, c = bc.pick(bc.parse_text_events(rent, W), 2026, 3)
    assert (r['date'], r['timing']) == (D(2026, 11, 5), 'amc') and c['date'] == D(2026, 11, 6)
    cemig = ['12/11', 'Após o fechamento do mercado', 'Divulgação de resultados 3T26', 'Adicionar ao calendário', '13/11', '11h', 'Webcast dos Resultados 3T26']
    r, c = bc.pick(bc.parse_text_events(cemig, W), 2026, 3)
    assert (r['date'], r['timing']) == (D(2026, 11, 12), 'amc') and c['date'] == D(2026, 11, 13)
    taesa = ['Reunião Pública com Investidores e de Divulgação de Resultados do 3T26', 'quarta-feira, 11/11/2026', '23:00-23:59h',
             'Videoconferência de Resultados e Reunião Pública com Mercado 3T26', 'quinta-feira, 12/11/2026', '11:00-12:00h']
    r, c = bc.pick(bc.parse_text_events(taesa, W), 2026, 3)
    assert (r['date'], r['timing'], r['time']) == (D(2026, 11, 11), None, None) and c['date'] == D(2026, 11, 12)
    raia = ['Call Resultados 2T26 [PT+EN]', '06', 'ago', 'Divulgação Resultados 2T26', '05', 'ago']   # só trimestres passados
    assert bc.pick(bc.parse_text_events(raia, W), 2026, 3) == (None, None)


def test_parse_cvm_calendar():
    t = 'Informações Trimestrais – ITR Referentes ao 1º trimestre 05/05/2026 Referentes ao 2º trimestre 04/08/2026\nReferentes ao 3º trimestre 03/11/2026'
    assert bc.parse_cvm_calendar(t, 3) == D(2026, 11, 3)
    assert bc.parse_cvm_calendar('Demonstrações Financeiras Anuais Completas … 10/02/2027', 4) == D(2027, 2, 10)
    assert bc.parse_cvm_calendar('nada aqui', 3) is None


BASE = {'ticker': 'XPTO3', 'name': 'X', 'sector': 'S', 'weight': 1.0}
RES = {'date': D(2026, 11, 5), 'time': None, 'timing': 'amc'}
TODAY = D(2026, 10, 29)

def test_build_row_status_e_fonte():
    info = {'page': 'https://ri.x/agenda', 'platform': 'mz', 'error': None}
    cvm = {'planned': (D(2026, 11, 6), 'https://rad/cal')}
    r = bc.build_row(BASE, 2026, 3, RES, None, info, cvm, TODAY)
    assert (r['status'], r['source'], r['date'], r['link']) == ('confirmed', 'RI', '2026-11-05', 'https://ri.x/agenda')
    r = bc.build_row(BASE, 2026, 3, None, None, {'error': '3T26 não encontrado na agenda'}, cvm, TODAY)
    assert (r['status'], r['source'], r['date'], r['link']) == ('expected', 'CVM', '2026-11-06', 'https://rad/cal')
    r = bc.build_row(BASE, 2026, 3, RES, None, info, {**cvm, 'filed': (D(2026, 11, 5), 'https://rad/itr')}, TODAY)
    assert r['status'] == 'released' and r['filed']['link'] == 'https://rad/itr'
    r = bc.build_row(BASE, 2026, 3, None, None, {'error': 'x'}, {}, TODAY)
    assert (r['status'], r['date'], r['source']) == (None, None, None)     # nunca inventa


def test_build_row_stale_so_quando_ri_fora_do_ar():
    prev = {'q': '3T26', 'source': 'RI', 'date': '2026-11-05', 'time': None, 'timing': 'amc', 'link': 'https://ri.x', 'checked_at': '2026-10-28', 'call': None}
    down = bc.build_row(BASE, 2026, 3, None, None, {'error': 'página de agenda indisponível', 'down': True}, {}, TODAY, prev)
    assert (down['source'], down['date'], down['stale'], down['status']) == ('RI', '2026-11-05', True, 'confirmed')
    gone = bc.build_row(BASE, 2026, 3, None, None, {'error': '3T26 não encontrado na agenda'}, {}, TODAY, prev)
    assert gone['date'] is None and not gone['stale']
    other_q = bc.build_row(BASE, 2026, 3, None, None, {'down': True}, {}, TODAY, {**prev, 'q': '2T26'})
    assert other_q['date'] is None


class _Sess:
    def __init__(self, exc=None, status=200): self.headers = {}; self.exc = exc; self.status = status; self.calls = []
    def get(self, url, timeout=None):
        self.calls.append(url)
        if url.endswith('/robots.txt'): return type('R', (), {'status_code': 200, 'text': 'User-agent: *\nDisallow: /privado\n'})()
        if self.exc: raise self.exc
        return type('R', (), {'status_code': self.status, 'text': 'ok'})()

def test_fetcher_disjuntor_e_robots(monkeypatch):
    monkeypatch.setattr(bc, 'HOST_DELAY_S', 0)
    f = bc.Fetcher(max_fails=2, session=_Sess(exc=ConnectionError('tls')))
    assert f.get('https://a.x/p') is None and not f.open
    assert f.get('https://a.x/q') is None and f.open
    with pytest.raises(RuntimeError): f.get('https://a.x/r')
    s = _Sess(); f = bc.Fetcher(session=s)
    assert f.get('https://b.x/privado/agenda') is None and 'https://b.x/privado/agenda' not in s.calls   # respeita robots.txt
    assert f.get('https://b.x/agenda').text == 'ok'
    assert bc.Fetcher(session=_Sess(status=403)).get('https://c.x/agenda') is None
    assert bc.Fetcher(budget_s=-1, session=_Sess()).open                                                # orçamento de tempo


# ---------- regra de logos ----------
from logos import resolve


def test_logo_exact_first():
    assert resolve('PETR4', {'PETR3', 'PETR4'}) == ('PETR4', 'exact')


def test_logo_root_order():
    assert resolve('ABCD3', {'ABCD5', 'ABCD11', 'ABCD4'}) == ('ABCD4', 'root')
    assert resolve('ABCD4', {'ABCD5', 'ABCD11'}) == ('ABCD11', 'root')
    assert resolve('ABCD11', {'ABCD8', 'ABCD6'}) == ('ABCD6', 'root')
    assert resolve('ABCD3', {'ABCE3', 'ABCD9'}) == (None, None)


def test_logo_override_axia():
    assert resolve('AXIA3', {'AXIA5', 'AXIA7'}) == ('AXIA7', 'override')


def test_manifest_matches_rule():
    import json, os
    m = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'public', 'logos', 'manifest.json'), encoding='utf-8'))
    ax = {x['ticker']: x for x in m['logos']}['AXIA3']
    assert ax['source_file'] == 'AXIA7.png' and ax['match'] == 'override'
    assert all(x['match'] in ('exact', 'root', 'override') for x in m['logos'])
