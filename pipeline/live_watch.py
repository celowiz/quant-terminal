"""Watcher leve (fase 2 do tempo real): roda só em dias úteis 07:00–22:00 BRT e publica arquivos pequenos
no branch órfão `live` (um único commit, force-push, só quando o conteúdo muda). O site lê esses arquivos
via raw.githubusercontent.com e cai no snapshot diário se algo falhar. Nunca inventa dado: fonte que falha
mantém o último valor publicado (com a hora original) ou some do arquivo.

Arquivos:
  world.json  último preço + fechamento anterior + hora do negócio + fuso da bolsa de índices mundiais e futuros (a cada 5 min)
  news.json   manchetes de fontes que o navegador não alcança (RSS oficiais, fatos relevantes, plantão da bolsa)
  dispatch.json  dia do último disparo dos builds diários (manhã/noite) — ver fase 4 abaixo
  fred.json   últimas observações das séries dos EUA do ECON (a cada 30 min, a cada 1 min perto de uma divulgação
              dos EUA na agenda; chave só no segredo do Actions)

Uso: python live_watch.py            (loop até o fim da janela ou QT_LIVE_MAX_S)
     python live_watch.py --once     (uma passada, útil para teste)
     python live_watch.py --in-window (sai 0 se ainda estamos na janela; 1 caso contrário)
"""
import os, re, sys, json, time, html, hashlib, subprocess, email.utils, datetime as dt, xml.etree.ElementTree as ET
import requests

BRT = dt.timezone(dt.timedelta(hours=-3))
WIN = (7 * 60, 22 * 60)
OUT = os.path.abspath(os.environ.get('QT_LIVE_DIR', 'live-out'))
PAGES = os.environ.get('QT_PAGES_DATA', 'https://celowiz.github.io/quant-terminal/data')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) quant-terminal-live (educational)'}
MAX_S = int(os.environ.get('QT_LIVE_MAX_S', str(5 * 3600 + 40 * 60)))
TICK = int(os.environ.get('QT_LIVE_TICK', '20'))

FEEDS = [  # mesmos rótulos do pipeline diário (build_news.py), só os que o navegador não consegue ler
    ('CVM – Notícias', 'https://www.gov.br/cvm/pt-br/assuntos/noticias/RSS', 'gov.br'),
    ('Receita Federal – Notícias', 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS', 'gov.br'),
    ('Fed – Press releases', 'https://www.federalreserve.gov/feeds/press_all.xml', 'public domain'),
    ('SEC – Press releases', 'https://www.sec.gov/news/pressreleases.rss', 'public domain'),
]
CVM_FACTS = 'CVM – Fatos relevantes'
B3_NEWS = 'B3 – Plantão de notícias'
RAD = 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx/ListarDocumentos'
RAD_DOC = 'https://www.rad.cvm.gov.br/ENET/frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega='
B3_LIST = 'https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia=18&palavra=&dataInicial={d}&dataFinal={d}'
B3_DOC = 'https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/Detail?idNoticia={id}&agencia=18&dataNoticia={dt}'
# Plantão da bolsa publica centenas de avisos rotineiros por dia; esses padrões são ruído para a tela NEWS.
B3_SKIP = re.compile(r'informe mensal|informe trimestral|informe anual|posi[cç][aã]o individual|valores mobili[aá]rios negociados|'
                     r'demonstra[cç][oõ]es financeiras|rendimentos? (de|em)|aviso aos cotistas.*rendimento|relat[oó]rio gerencial', re.I)

def now(): return dt.datetime.now(BRT)

def in_window(t=None):
    t = t or now()
    return t.weekday() < 5 and WIN[0] <= t.hour * 60 + t.minute < WIN[1]

def iso_brt(x):
    """Data de RSS/Atom/ISO -> ISO em BRT (minutos); None se não der para ler."""
    if not x: return None
    try: d = email.utils.parsedate_to_datetime(x)
    except Exception:
        try: d = dt.datetime.fromisoformat(x.strip().replace('Z', '+00:00'))
        except Exception: return None
    if d.tzinfo is None: d = d.replace(tzinfo=BRT)
    return d.astimezone(BRT).isoformat(timespec='minutes')

def http_get(url, timeout=25, **kw):
    r = requests.get(url, headers=UA, timeout=timeout, **kw)
    r.raise_for_status()
    return r

# ---------------------------------------------------------------- parsers (puros, testados)
def _txt(el, tag):
    for c in el:
        if c.tag.split('}')[-1] == tag: return (c.text or '').strip()
    return ''

def parse_feed(xml_bytes, source, lic, n=30):
    root = ET.fromstring(xml_bytes)
    out = []
    for it in [e for e in root.iter() if e.tag.split('}')[-1] in ('item', 'entry')][:n]:
        title = html.unescape(re.sub('<[^>]+>', '', _txt(it, 'title'))).strip()
        link = _txt(it, 'link') or next((c.get('href') for c in it if c.tag.split('}')[-1] == 'link'), '') or ''
        link = link.strip()
        if not re.match(r'^https?://[^\s/]+', link, re.I): continue
        date = iso_brt(_txt(it, 'pubDate') or _txt(it, 'updated') or _txt(it, 'published') or _txt(it, 'date'))
        if title: out.append({'source': source, 'license': lic, 'title': title[:220], 'link': link, 'date': date})
    return out

def parse_rad(payload):
    """Resposta do ListarDocumentos (categoria fato relevante) -> itens de notícia."""
    dados = ((payload or {}).get('d') or {}).get('dados') or ''
    out = []
    for rec in dados.split('&*'):
        f = rec.split('$&')
        if len(f) < 11: continue
        company = html.unescape(f[1]).strip()
        subject = html.unescape(re.sub('<[^>]+>', '', f[12] if len(f) > 12 and f[12].strip() else f[4])).strip(' -')
        m = re.search(r'(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2})', re.sub('<[^>]+>', ' ', f[6]))
        p = re.search(r'NumeroProtocoloEntrega=(\d+)', rec)
        if not (company and m and p): continue
        d, mo, y, hh, mi = m.groups()
        title = f'{company}: {subject}' if subject else company
        out.append({'source': CVM_FACTS, 'license': 'gov.br', 'title': title[:220], 'link': RAD_DOC + p.group(1),
                    'date': f'{y}-{mo}-{d}T{hh}:{mi}-03:00'})
    out.sort(key=lambda x: x['date'], reverse=True)
    return out

def parse_b3(rows, n=40):
    out = []
    for r in rows or []:
        m = (r or {}).get('NwsMsg') or {}
        h, i, t = (m.get('headline') or '').strip(), m.get('id'), (m.get('dateTime') or '').strip()
        if not (h and i and re.match(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}', t)) or B3_SKIP.search(h): continue
        out.append({'source': B3_NEWS, 'license': 'b3.com.br', 'title': html.unescape(h)[:220],
                    'link': B3_DOC.format(id=int(i), dt=requests.utils.quote(t)), 'date': t[:10] + 'T' + t[11:16] + '-03:00'})
    out.sort(key=lambda x: x['date'], reverse=True)
    return out[:n]

def parse_chart(j):
    """meta do chart v8 -> [último, fechamento anterior, unix do último negócio, fuso da bolsa em s] ou None."""
    try: m = j['chart']['result'][0]['meta']
    except Exception: return None
    last, prev, t = m.get('regularMarketPrice'), m.get('chartPreviousClose') or m.get('previousClose'), m.get('regularMarketTime')
    if not all(isinstance(v, (int, float)) and v > 0 for v in (last, prev, t)): return None
    off = m.get('gmtoffset')
    return [round(float(last), 4), round(float(prev), 4), int(t), int(off) if isinstance(off, (int, float)) else 0]

def parse_fred(j, n=3):
    pts = []
    for o in (j or {}).get('observations') or []:
        try: pts.append([o['date'], round(float(o['value']), 4)])
        except Exception: continue  # '.' = sem valor
    pts.sort()
    return pts[-n:]

def content_hash(obj):
    o = {k: v for k, v in obj.items() if k != 'generated_at'}
    return hashlib.sha256(json.dumps(o, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

# ---------------------------------------------------------------- tarefas
def task_world(state):
    if 'tickers' not in state:
        tk = []
        try:
            w = http_get(f'{PAGES}/world.json').json()
            tk += [r['ticker'] for g in w.get('regions', []) for r in g.get('rows', [])]
        except Exception as e: print('world.json (lista) falhou', e)
        try: tk += [r['ticker'] for r in http_get(f'{PAGES}/futures.json').json().get('rows', [])]
        except Exception as e: print('futures.json (lista) falhou', e)
        state['tickers'] = list(dict.fromkeys(t for t in tk if isinstance(t, str) and re.match(r'^[\w^.=\-]{1,20}$', t)))
    prev = (state['files'].get('world.json') or {}).get('quotes') or {}
    quotes, ok = {}, 0
    for t in state['tickers']:
        try:
            q = parse_chart(http_get(f'https://query1.finance.yahoo.com/v8/finance/chart/{requests.utils.quote(t)}?range=1d&interval=5m').json())
        except Exception: q = None
        if q: quotes[t] = q; ok += 1
        elif t in prev: quotes[t] = prev[t]  # mantém o último publicado, com a hora original do negócio
        time.sleep(0.25)
    print(f'world: {ok}/{len(state["tickers"])}')
    if not quotes: return None
    return {'quotes': quotes}

def task_news(state):
    old = (state['files'].get('news.json') or {}).get('items') or []
    items, failed = [], []
    for name, url, lic in FEEDS:
        try: items += parse_feed(http_get(url, timeout=30).content, name, lic)
        except Exception as e: failed.append(name); print(' ', name, 'falhou', e)
    today = now().strftime('%d/%m/%Y')
    try:
        body = {'dataDe': today, 'dataAte': today, 'empresa': '', 'setorAtividade': '-1', 'categoriaEmissor': '-1',
                'situacaoEmissor': '-1', 'tipoParticipante': '1', 'dataReferencia': '', 'categoria': 'IPE_4_-1_-1',
                'periodo': '2', 'horaIni': '', 'horaFim': '', 'palavraChave': '', 'ultimaDtRef': 'false',
                'tipoEmpresa': '0', 'token': '', 'versaoCaptcha': ''}
        r = requests.post(RAD, json=body, headers={**UA, 'Content-Type': 'application/json; charset=utf-8'}, timeout=40)
        r.raise_for_status(); items += parse_rad(r.json())[:40]
    except Exception as e: failed.append(CVM_FACTS); print(' ', CVM_FACTS, 'falhou', e)
    try: items += parse_b3(http_get(B3_LIST.format(d=now().strftime('%Y-%m-%d')), timeout=30).json())
    except Exception as e: failed.append(B3_NEWS); print(' ', B3_NEWS, 'falhou', e)
    items += [i for i in old if i.get('source') in failed]  # fonte fora: mantém o que já tinha sido publicado
    seen, out = set(), []
    for i in sorted(items, key=lambda x: x.get('date') or '', reverse=True):
        if i['link'] in seen: continue
        seen.add(i['link']); out.append(i)
    print(f'news: {len(out)} itens; falharam: {failed or "nenhuma"}')
    return {'items': out[:150]} if out else None

def task_fred(state):
    key = os.environ.get('FRED_API_KEY', '').strip()
    if not key: return None
    if 'fred_ids' not in state:
        try: state['fred_ids'] = [s['id'] for s in http_get(f'{PAGES}/econ.json').json().get('series', []) if s.get('country') == 'US']
        except Exception as e: print('econ.json (lista) falhou', e); return None
    prev = (state['files'].get('fred.json') or {}).get('series') or {}
    series = {}
    for sid in state['fred_ids']:
        if not re.match(r'^[A-Z0-9]{2,20}$', sid): continue
        try:
            j = http_get('https://api.stlouisfed.org/fred/series/observations', params={
                'series_id': sid, 'api_key': key, 'file_type': 'json', 'sort_order': 'desc', 'limit': 5}).json()
            pts = parse_fred(j)
            if pts: series[sid] = pts
            elif sid in prev: series[sid] = prev[sid]
        except Exception as e:
            print(' ', sid, 'falhou', type(e).__name__)  # nunca imprime a URL (tem a chave)
            if sid in prev: series[sid] = prev[sid]
        time.sleep(0.3)
    print(f'fred: {len(series)}/{len(state["fred_ids"])}')
    return {'series': series} if series else None

def release_near(events, t, countries=('US',), before=2, after=40):
    """Modo rápido da agenda: há divulgação com horário exato dos países pedidos entre `before` min antes e `after` min depois?"""
    for e in events or []:
        if not isinstance(e, dict) or e.get('country') not in countries or e.get('allday') or e.get('time_approx'): continue
        try: et = dt.datetime.fromisoformat(e['time'])
        except Exception: continue
        if et - dt.timedelta(minutes=before) <= t <= et + dt.timedelta(minutes=after): return True
    return False

def agenda(state):
    """Eventos da agenda publicada (relida a cada 2 h); [] se faltar."""
    if time.time() - state.get('agenda_t', 0) > 7200:
        state['agenda_t'] = time.time()
        try: state['agenda'] = http_get(f'{PAGES}/eco.json').json().get('events') or []
        except Exception as e: print('eco.json (agenda) falhou', e); state.setdefault('agenda', [])
    return state.get('agenda', [])

def fred_every(state):
    return 60 if release_near(agenda(state), now()) else 1800

# ---------------------------------------------------------------- fase 4: builds diários na hora certa
# O agendamento deste repo atrasa horas; o watcher, que já está rodando, dispara o pages.yml nos horários do cron:
#   manhã  — ter–sex a partir das 07:47 (sábado fica com o cron)
#   noite  — seg–sex quando o arquivo diário oficial da bolsa sair (checado a cada 5 min a partir das 20:00), ou às 21:55
# O pages.yml pula o cron atrasado quando já houve esse disparo (job gate). Estado em dispatch.json (sobrevive ao encadeamento).
COTAHIST = 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D{d}.ZIP'

def due_slot(t, done, official_ok):
    day, hm, dow = t.date().isoformat(), t.hour * 60 + t.minute, t.isoweekday()
    if 2 <= dow <= 5 and 7 * 60 + 47 <= hm < 9 * 60 + 30 and done.get('morning') != day: return 'morning'
    if 1 <= dow <= 5 and 20 * 60 <= hm < 22 * 60 and done.get('evening') != day and (official_ok or hm >= 21 * 60 + 55): return 'evening'
    return None

def cotahist_ready(t):
    try:
        r = requests.head(COTAHIST.format(d=t.strftime('%d%m%Y')), headers=UA, timeout=30, allow_redirects=True)
        return r.status_code == 200
    except Exception: return False

def dispatch_pages(slot):
    tok, repo = os.environ.get('GH_TOKEN', ''), os.environ.get('REPO', '')
    if not tok or not repo: print('disparo (simulado):', slot); return False
    try:
        r = requests.post(f'https://api.github.com/repos/{repo}/actions/workflows/pages.yml/dispatches', timeout=30,
                          headers={'Authorization': f'Bearer {tok}', 'Accept': 'application/vnd.github+json', 'User-Agent': UA['User-Agent']},
                          json={'ref': 'main', 'inputs': {'slot': slot}})
        print('disparo do build', slot, r.status_code)
        return r.status_code == 204
    except Exception as e: print('disparo falhou', type(e).__name__); return False

def task_dispatch(state):
    t = now()
    old = state['files'].get('dispatch.json') or {}
    done = {k: old.get(k) for k in ('morning', 'evening') if old.get(k)}
    hm = t.hour * 60 + t.minute
    if t.isoweekday() <= 5 and 20 * 60 <= hm < 22 * 60 and done.get('evening') != t.date().isoformat() and time.time() - state.get('off_t', 0) >= 300:
        state['off_t'] = time.time(); state['off'] = cotahist_ready(t)
        print('arquivo oficial do dia:', 'disponível' if state['off'] else 'ainda não')
    slot = due_slot(t, done, state.get('off', False))
    if slot and dispatch_pages(slot): done[slot] = t.date().isoformat()
    return done or None

# intervalo em segundos (número ou função do estado)
TASKS = [('world.json', task_world, 300), ('news.json', task_news, 240), ('fred.json', task_fred, fred_every), ('dispatch.json', task_dispatch, 60)]

# ---------------------------------------------------------------- publicação
def git(*a, check=True, **kw): return subprocess.run(['git', '-C', OUT, *a], check=check, capture_output=True, text=True, **kw)

def load_existing(state):
    os.makedirs(OUT, exist_ok=True)
    for name, *_ in TASKS:
        p = os.path.join(OUT, name)
        if os.path.exists(p):
            try: state['files'][name] = json.load(open(p, encoding='utf-8'))
            except Exception: pass

def publish(changed):
    """Um commit órfão com os arquivos atuais; force-push para `live`. Sem histórico = branch sempre pequeno."""
    if os.environ.get('QT_LIVE_NOPUSH') or not os.path.isdir(os.path.join(OUT, '.git')): print('publicar (simulado):', changed); return True
    try:
        git('add', '-A')
        tree = git('write-tree').stdout.strip()
        c = subprocess.run(['git', '-C', OUT, '-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
                            'commit-tree', tree, '-m', 'live: ' + ', '.join(changed)], check=True, capture_output=True, text=True).stdout.strip()
        git('push', '-q', '-f', 'origin', f'{c}:refs/heads/live')
        print('publicado:', ', '.join(changed), c[:7])
        return True
    except subprocess.CalledProcessError as e:
        print('push falhou', (e.stderr or '')[-300:].replace(os.environ.get('GH_TOKEN', '\0'), '***'))
        return False

def run(once=False):
    t0 = time.time()
    state = {'files': {}}
    load_existing(state)
    last = {name: 0.0 for name, *_ in TASKS}
    while True:
        if not in_window(): print('fora da janela (dias úteis 07:00–22:00 BRT)'); break
        changed = []
        for name, fn, every in TASKS:
            if time.time() - last[name] < (every(state) if callable(every) else every): continue
            last[name] = time.time()
            try: body = fn(state)
            except Exception as e: print(name, 'erro', e); body = None
            if not body: continue
            old = state['files'].get(name)
            if old and content_hash(old) == content_hash(body): continue
            body = {'generated_at': now().isoformat(timespec='seconds'), **body}
            state['files'][name] = body
            with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f: json.dump(body, f, ensure_ascii=False, separators=(',', ':'))
            changed.append(name)
        if changed: publish(changed)
        if once or time.time() - t0 > MAX_S: break
        time.sleep(TICK)

if __name__ == '__main__':
    if '--in-window' in sys.argv: sys.exit(0 if in_window() else 1)
    run(once='--once' in sys.argv)
