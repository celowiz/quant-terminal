"""Watcher do tempo real (fase 2): parsers puros, janela e detecção de mudança. Sem rede."""
import json, datetime as dt
import live_watch as L

BRT = L.BRT

def test_janela_dias_uteis_07_22():
    assert L.in_window(dt.datetime(2026, 11, 10, 7, 0, tzinfo=BRT))
    assert L.in_window(dt.datetime(2026, 11, 10, 21, 59, tzinfo=BRT))
    assert not L.in_window(dt.datetime(2026, 11, 10, 22, 0, tzinfo=BRT))
    assert not L.in_window(dt.datetime(2026, 11, 10, 6, 59, tzinfo=BRT))
    assert not L.in_window(dt.datetime(2026, 11, 14, 12, 0, tzinfo=BRT))  # sábado

def test_rss_atom_so_http():
    xml = b'''<rss><channel>
      <item><title>Fed &amp; rates</title><link>https://www.federalreserve.gov/x.htm</link><pubDate>Tue, 10 Nov 2026 20:26:00 GMT</pubDate></item>
      <item><title>bad</title><link>javascript:alert(1)</link></item>
      <item><title></title><link>https://a.b/c</link></item>
    </channel></rss>'''
    r = L.parse_feed(xml, 'Fed – Press releases', 'public domain')
    assert r == [{'source': 'Fed – Press releases', 'license': 'public domain', 'title': 'Fed & rates', 'link': 'https://www.federalreserve.gov/x.htm', 'date': '2026-11-10T17:26-03:00'}]
    atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title><link href="https://x.y/z"/><updated>2026-11-10T08:01:06-03:00</updated></entry></feed>'
    assert L.parse_feed(atom, 'S', 'l')[0]['date'] == '2026-11-10T08:01-03:00'

def test_fatos_relevantes():
    rec = ("02008-7$&EMBRAER S.A.$&Fato Relevante$& - $&<spanOrder>Atualização das Projeções 2026</spanOrder> - $&"
           "<spanOrder>20261110</spanOrder> 10/11/2026$&<spanOrder>20261110</spanOrder> 10/11/2026 06:50$&Ativo$&1$&AP$&"
           "<i onclick=OpenPopUpVer('frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega=1586711')></i>$&Atualização das Projeções 2026$&")
    r = L.parse_rad({'d': {'dados': rec + '&*' + 'lixo$&x'}})
    assert r == [{'source': 'CVM – Fatos relevantes', 'license': 'gov.br', 'title': 'EMBRAER S.A.: Atualização das Projeções 2026',
                  'link': L.RAD_DOC + '1586711', 'date': '2026-11-10T06:50-03:00'}]
    assert L.parse_rad({}) == [] and L.parse_rad(None) == []

def test_plantao_filtra_rotina():
    rows = [{'NwsMsg': {'headline': 'PETROBRAS (PETR-N2) - Fato Relevante - 10/11/26', 'id': 3550300, 'dateTime': '2026-11-10 19:53:01'}},
            {'NwsMsg': {'headline': 'FII NOVA I (NVIF) 22.003.469/0001-17 - Informe Mensal - 10/2026', 'id': 3550333, 'dateTime': '2026-11-10 19:57:16'}},
            {'NwsMsg': {'headline': 'sem data', 'id': 1, 'dateTime': ''}}, {}]
    r = L.parse_b3(rows)
    assert len(r) == 1 and r[0]['date'] == '2026-11-10T19:53-03:00' and r[0]['source'] == 'B3 – Plantão de notícias'
    assert r[0]['link'].startswith('https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/Detail?idNoticia=3550300&agencia=18&dataNoticia=2026-11-10')

def test_cotacao_e_fred():
    j = {'chart': {'result': [{'meta': {'regularMarketPrice': 7520.93, 'chartPreviousClose': 7549.94, 'regularMarketTime': 1794348031, 'gmtoffset': -18000}}]}}
    assert L.parse_chart(j) == [7520.93, 7549.94, 1794348031, -18000]
    assert L.parse_chart({'chart': {'result': [{'meta': {'regularMarketPrice': None}}]}}) is None
    assert L.parse_chart({}) is None
    f = {'observations': [{'date': '2026-10-01', 'value': '4.1'}, {'date': '2026-09-01', 'value': '.'}, {'date': '2026-08-01', 'value': '4.2'}]}
    assert L.parse_fred(f) == [['2026-08-01', 4.2], ['2026-10-01', 4.1]]

def test_so_publica_quando_muda(tmp_path, monkeypatch):
    monkeypatch.setattr(L, 'OUT', str(tmp_path))
    monkeypatch.setenv('QT_LIVE_NOPUSH', '1')
    monkeypatch.setattr(L, 'in_window', lambda t=None: True)
    calls = []
    monkeypatch.setattr(L, 'publish', lambda ch: calls.append(list(ch)) or True)
    payload = {'quotes': {'^GSPC': [1.0, 1.0, 1, 0]}}
    monkeypatch.setattr(L, 'TASKS', [('world.json', lambda st: dict(payload), 0)])
    L.run(once=True); L.run(once=True)
    assert calls == [['world.json']]  # segunda passada: mesmo conteúdo, nada publicado
    body = json.load(open(tmp_path / 'world.json'))
    assert body['quotes'] == payload['quotes'] and 'generated_at' in body
    assert L.content_hash({'generated_at': 'a', **payload}) == L.content_hash({'generated_at': 'b', **payload})

def test_modo_rapido_da_agenda():
    ev = [{'country': 'US', 'time': '2026-11-12T10:30-03:00'}, {'country': 'US', 'time': '2026-11-12T12:00-03:00', 'time_approx': True},
          {'country': 'BR', 'time': '2026-11-12T09:00-03:00'}, {'bad': 1}, {'country': 'US', 'time': 'x'}]
    t = lambda h, m: dt.datetime(2026, 11, 12, h, m, tzinfo=BRT)
    assert L.release_near(ev, t(10, 28)) and L.release_near(ev, t(11, 10))
    assert not L.release_near(ev, t(10, 27)) and not L.release_near(ev, t(11, 11))
    assert not L.release_near(ev, t(12, 5))  # horário aproximado não acelera
    assert L.release_near(ev, t(9, 5), ('BR',))
    st = {'agenda_t': 1e18, 'agenda': ev}
    import time as _t
    st['agenda_t'] = _t.time()
    assert L.fred_every(st) in (60, 1800)
