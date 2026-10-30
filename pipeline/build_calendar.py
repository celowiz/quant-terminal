"""CAL v2 — calendário de resultados do Ibovespa.

Fonte principal: o site de RI de cada empresa (checado todo dia). Fallback: CVM.
  1. RI: JSON público de eventos da plataforma MZ (api.mziq.com/mzevents, o mesmo que a página de agenda do RI carrega),
     ou o texto da página de agenda (ListaAgenda.aspx, tabelas "Eventos Futuros", páginas Next.js/WordPress).
  2. CVM (dados abertos): Calendário de Eventos Corporativos (IPE, PDF anual) → data PREVISTA do ITR/DFP;
     ITR/DFP entregue (DT_RECEB) → DIVULGADA.
Status: expected (só o calendário anual da CVM) · confirmed (data na agenda do RI) · released (ITR/DFP entregue à CVM:
  dados abertos semanais + consulta pública do RAD em tempo real).
Nada é inventado: sem data em nenhuma fonte, a linha sai com date=None ("—" na tela).
Educativo; não é recomendação de investimento.
"""
import datetime as dt, html as htmlmod, io, json, os, re, time, zipfile
from html.parser import HTMLParser
from urllib import robotparser
from urllib.parse import urlsplit
import requests
from common import CACHE, OUT, save, now_iso, today_brt, load_prev, cached

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'quant-terminal-calendar/1.0 (+https://github.com/celowiz/quant-terminal; educational, 1 req/s)'}
MZ_API = 'https://api.mziq.com/mzevents/events/calendar/{id}/{lang}'
CVM = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC'
HOST_DELAY_S = 1.0      # educado: no máximo 1 requisição/s por host
RI_MAX_FAILS = 8        # disjuntor: N falhas de rede seguidas → para de consultar RI nesta execução (fica a CVM)
RI_BUDGET_S = 900       # teto de tempo para a etapa RI

MONTHS = {m: i + 1 for i, m in enumerate(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'])}
MONTHS.update({'feb': 2, 'apr': 4, 'may': 5, 'aug': 8, 'sep': 9, 'oct': 10, 'dec': 12})
RE_RESULTS = re.compile(r'resultado|release|divulga|earnings|informa[çc][õo]es\s+trimestrais|\bITR\b|\bDFP\b|demonstra[çc][õo]es\s+financeiras', re.I)
RE_RELEASE = re.compile(r'divulga[çc][ãa]o\s+(?:d[aeo]s?\s+)?(?:resultados|informa[çc][õo]es)|\brelease\b|informa[çc][õo]es\s+trimestrais|relat[óo]rio\s+de\s+desempenho|divulgar[áa]', re.I)
RE_CALL = re.compile(r'teleconfer|webcast|confer[êe]ncia|\bcall\b|webinar|videoconfer|\blive\b|reuni[ãa]o|apimec|transmiss|encontro|q&a', re.I)
RE_AMC = re.compile(r'ap[óo]s\s+(?:o\s+)?(?:encerramento|fechamento)|after\s+(?:the\s+)?(?:market\s+)?clos|p[óo]s[-\s]?(?:mercado|fechamento|preg[ãa]o)|after\s+market', re.I)
RE_BMO = re.compile(r'antes\s+(?:da\s+)?abertura|before\s+(?:the\s+)?(?:market\s+)?open|pr[ée][-\s]?(?:abertura|mercado|preg[ãa]o)|before\s+market', re.I)
RE_TIME = re.compile(r'(?<![\d/])([01]?\d|2[0-3])(?:h|:)([0-5]\d)?(?:\s*h|min)?(?![\d/])', re.I)


# ---------------- trimestres ----------------
def quarter_end(y, q):
    return dt.date(y, 3 * q, 31 if q in (1, 4) else 30)

def season(today):
    """Trimestre da temporada atual = último trimestre encerrado antes de hoje."""
    q = (today.month - 1) // 3
    return (today.year - 1, 4) if q == 0 else (today.year, q)

def qlabel(y, q):
    return f'{q}T{y % 100:02d}'

def quarters_in(text):
    """Trimestres citados num texto: 3T26, 3T2026, 3Q26, 3º trimestre de 2026, 3rd quarter 2026."""
    out = set()
    for q, y in re.findall(r"\b([1-4])\s*[TQ]\s*((?:20)?\d{2})\b(?!['\u2019]\d)", text, re.I):
        out.add((2000 + int(y[-2:]), int(q)))
    for q, y in re.findall(r'\b([1-4])\s*[º°oª]?\s*(?:trimestre|tri)\b\D{0,12}(20\d\d)', text, re.I):
        out.add((int(y), int(q)))
    for q, y in re.findall(r'\b([1-4])(?:st|nd|rd|th)\s+quarter\D{0,12}(20\d\d)', text, re.I):
        out.add((int(y), int(q)))
    return out


# ---------------- datas e horário ----------------
def _mk(y, m, d):
    try: return dt.date(y, m, d)
    except ValueError: return None

def dates_in(text, window):
    """Datas no texto (dd/mm/aaaa, dd/mm, dd/mmm, '09 de novembro de 2026'); sem ano → o ano que cai na janela."""
    lo, hi = window
    found = []
    def add(d, m, y, pos):
        if y is None:
            for yy in (lo.year, lo.year + 1):
                x = _mk(yy, m, d)
                if x and lo <= x <= hi: found.append((pos, x)); return
            return
        y = 2000 + y if y < 100 else y
        x = _mk(y, m, d)
        if x: found.append((pos, x))
    for mt in re.finditer(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?\b(?!\s*h)', text):
        d, m, y = mt.groups()
        if int(m) <= 12: add(int(d), int(m), int(y) if y else None, mt.start())
    names = '|'.join(['janeiro', 'fevereiro', 'mar[çc]o', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])
    for mt in re.finditer(rf'\b(\d{{1,2}})\s*(?:de\s+|/|\s|-)\s*({names}|jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\.?\b(?:\s*(?:de\s+)?(20\d\d))?', text, re.I):
        d, mn, y = mt.groups()
        m = MONTHS.get(mn[:3].lower().replace('ç', 'c'))
        if m: add(int(d), m, int(y) if y else None, mt.start())
    return found

def timing_of(text):
    """(timing, hh:mm) — timing 'amc' (após o fechamento) / 'bmo' (antes da abertura) / None.
    Horários-placeholder das plataformas (00:00, 23:00-23:59) são ignorados."""
    if RE_AMC.search(text): t = 'amc'
    elif RE_BMO.search(text): t = 'bmo'
    else: t = None
    hhmm = None
    if not re.search(r'23:00\s*-\s*23:59', text):
        for h, m in RE_TIME.findall(text):
            h, m = int(h), int(m or 0)
            if (h, m) == (0, 0): continue
            hhmm = f'{h:02d}:{m:02d}'; break
    if t is None and hhmm:
        h = int(hhmm[:2])
        t = 'amc' if h >= 17 else 'bmo' if h < 10 else None
    return t, hhmm


# ---------------- HTML → texto ----------------
class _Text(HTMLParser):
    BLOCK = {'p', 'div', 'li', 'tr', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'table', 'ul', 'dt', 'dd'}
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts = []; self.skip = 0
    def handle_starttag(self, tag, a):
        if tag in ('script', 'style', 'noscript', 'svg'): self.skip += 1
        elif tag in self.BLOCK: self.parts.append('\n')
        elif tag in ('td', 'th', 'span'): self.parts.append(' ')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'svg'): self.skip = max(0, self.skip - 1)
        elif tag in self.BLOCK: self.parts.append('\n')
    def handle_data(self, d):
        if not self.skip: self.parts.append(d)

def html_lines(html):
    p = _Text(); p.feed(html)
    txt = htmlmod.unescape(''.join(p.parts)).replace('\xa0', ' ')
    return [re.sub(r'\s+', ' ', ln).strip() for ln in txt.split('\n') if ln.strip()]


# ---------------- parsers RI ----------------
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

RE_SKIP = re.compile(r'per[ií]odo\s+de\s+sil[êe]ncio|quiet\s+period|assembleia|dividend|juros\s+sobre', re.I)

def kind_of(text, typ=''):
    """'results' (divulgação/release/ITR), 'call' (teleconferência/webcast/reunião) ou 'other'."""
    if RE_SKIP.search(text): return 'other'
    if 'resultado' in typ or RE_RELEASE.search(text) and not re.match(r'\s*(?:\w+\s*\|\s*)?(?:v[íi]deo)?(?:teleconfer|webcast|confer[êe]ncia|call|webinar|videoconfer|live)', text, re.I):
        return 'results'
    if typ == 'webcast' or RE_CALL.search(text): return 'call'
    return 'results' if RE_RESULTS.search(text) else 'other'

def parse_mz_id(html, index=0):
    """(id, lang) do calendário de eventos MZ embutido na página (variável JS, lista COMPANIES ou URL literal)."""
    if 'mzevents' not in html and 'mziq' not in html: return None
    lang = (re.search(r'''\blang\s*=\s*["']([a-z]{2}(?:-[a-z]{2})?)["']''', html) or [None, 'pt-br'])[1]
    m = re.search(rf'/calendar/({UUID})', html)
    if m: return m[1], lang
    m = re.search(r'COMPANIES\s*=\s*\[(.*?)\]\s*;', html, re.S)
    if m:
        ids = re.findall(rf'''id\s*:\s*["']({UUID})["']''', m[1])
        if len(ids) > index: return ids[index], lang
    m = re.search(r'baseEventsUrl\s*\+\s*["\']/calendar/["\']\s*\+\s*(\w+)', html)
    names = [m[1]] if m else []
    names += ['eventId', 'fmId', 'company_id', 'companyId']
    for v in names:
        m = re.search(rf'''\b{v}\s*[=:]\s*["']({UUID})["']''', html)
        if m: return m[1], lang
    return None

def parse_mz_events(js, entity=None):
    """Eventos do JSON da MZ → [{date, kind, text, timing, time}]. 'data' vem como MM/DD/AAAA."""
    rows = js.get('data', js) if isinstance(js, dict) else js
    out = []
    for e in rows if isinstance(rows, list) else []:
        try: m, d, y = (int(x) for x in str(e.get('data', '')).split('/'))
        except Exception: continue
        day = _mk(y, m, d)
        if not day: continue
        desc = ' '.join(str(e.get(k) or '') for k in ('descricao', 'titulo', 'title')).strip()
        if entity and entity.lower() not in desc.lower(): continue   # agenda de grupo (ex.: Cosan lista Rumo/Compass/Raízen)
        det = re.sub(r'<[^>]+>', ' ', str(e.get('detalhes') or ''))
        typ = str(e.get('type') or '')
        kind = kind_of(desc, typ)
        timing, hhmm = timing_of(f'{desc} {det} {e.get("event_starttime") or ""}')
        out.append({'date': day, 'kind': kind, 'text': desc[:160], 'timing': timing, 'time': hhmm, 'quarters': quarters_in(f'{desc} {det}')})
    return out

def parse_text_events(lines, window):
    """Eventos a partir do texto de uma página de agenda (cada linha com palavra de resultado/call + data próxima)."""
    lines = _merge_split_dates(lines)
    out = []
    for i, ln in enumerate(lines):
        if not (RE_RESULTS.search(ln) or RE_CALL.search(ln)) or len(ln) > 400: continue
        qs = quarters_in(ln)
        if not qs: continue
        ds = dates_in(ln, window)
        ctx = ln
        j = 1
        while not ds and j <= 3:   # data em linha vizinha (tabelas/cartões: data acima ou abaixo do título)
            for k in (i - j, i + j):
                if 0 <= k < len(lines):
                    dk = dates_in(lines[k], window)
                    if dk and not (k > i and (RE_RESULTS.search(lines[k]) or RE_CALL.search(lines[k])) and quarters_in(lines[k])):
                        ds = dk; ctx = f'{lines[k]} {ln}' if k < i else f'{ln} {lines[k]}'; break
            j += 1
        if not ds: continue
        nxt = []
        for k in range(i + 1, min(i + 4, len(lines))):   # horário/"após o fechamento" costuma vir nas linhas logo abaixo
            if RE_RESULTS.search(lines[k]) or RE_CALL.search(lines[k]) or dates_in(lines[k], window): break
            nxt.append(lines[k])
        prv = lines[i - 1] if i > 0 and not (RE_RESULTS.search(lines[i - 1]) or RE_CALL.search(lines[i - 1]) or quarters_in(lines[i - 1]) or dates_in(lines[i - 1], window)) else ''
        timing, hhmm = timing_of(f'{prv} {ctx} {" ".join(nxt)}')
        kind = kind_of(ln)
        if kind == 'other': continue
        out.append({'date': ds[0][1], 'kind': kind, 'text': ln[:160], 'timing': timing, 'time': hhmm, 'quarters': qs})
    return out

def _merge_split_dates(lines):
    """'06' + 'ago' em linhas separadas (cartões de agenda) → '06 ago'."""
    out, i = [], 0
    while i < len(lines):
        if i + 1 < len(lines) and re.fullmatch(r'\d{1,2}', lines[i]) and re.fullmatch(r'[a-zç]{3}\.?', lines[i + 1], re.I) and lines[i + 1][:3].lower() in MONTHS:
            out.append(f'{lines[i]} {lines[i + 1]}'); i += 2
        else:
            out.append(lines[i]); i += 1
    return out

def pick(events, y, q):
    """Evento de divulgação do trimestre (y, q) e o call correspondente."""
    qe = quarter_end(y, q); lo, hi = qe, qe + dt.timedelta(days=120)
    def ok(e): return lo < e['date'] <= hi and ((y, q) in e['quarters'] or not e['quarters'])
    res = sorted([e for e in events if e['kind'] == 'results' and ok(e)], key=lambda e: ((y, q) not in e['quarters'], e['date'], e['timing'] is None))
    calls = sorted([e for e in events if e['kind'] == 'call' and ok(e)], key=lambda e: ((y, q) not in e['quarters'], e['date']))
    r = res[0] if res else None
    c = next((x for x in calls if r is None or 0 <= (x['date'] - r['date']).days <= 7), None)
    return r, c


# ---------------- HTTP educado + disjuntor ----------------
class Fetcher:
    def __init__(self, max_fails=RI_MAX_FAILS, budget_s=RI_BUDGET_S, session=None):
        self.s = session or requests.Session(); self.s.headers.update(UA)
        self.last = {}; self.robots = {}; self.fails = 0; self.max_fails = max_fails
        self.t0 = time.time(); self.budget = budget_s; self.requests = 0

    @property
    def open(self):
        """Disjuntor aberto = parar de consultar RI nesta execução."""
        return self.fails >= self.max_fails or time.time() - self.t0 > self.budget

    def allowed(self, url):
        sp = urlsplit(url); base = f'{sp.scheme}://{sp.netloc}'
        if base not in self.robots:
            rp = robotparser.RobotFileParser()
            try:
                r = self._get(base + '/robots.txt', count=False)
                rp.parse(r.text.splitlines() if r is not None and r.status_code == 200 else [])
            except Exception:
                rp.parse([])
            self.robots[base] = rp
        return self.robots[base].can_fetch(UA['User-Agent'], url)

    def _get(self, url, count=True):
        sp = urlsplit(url); host = sp.netloc
        rp = self.robots.get(f'{sp.scheme}://{host}')
        cd = (rp.crawl_delay(UA['User-Agent']) if rp else None) or 0
        wait = self.last.get(host, 0) + min(max(HOST_DELAY_S, float(cd)), 15) - time.time()
        if wait > 0: time.sleep(wait)
        self.last[host] = time.time(); self.requests += 1
        return self.s.get(url, timeout=(10, 25))

    def get(self, url):
        """Texto da URL ou None. Falha de rede conta para o disjuntor; 4xx/5xx não."""
        if self.open: raise RuntimeError('disjuntor RI aberto')
        if not self.allowed(url): return None
        try:
            r = self._get(url)
        except Exception:
            self.fails += 1; return None
        self.fails = 0
        return r if r.status_code == 200 else None


def fetch_ri(src, f, y, q):
    """Consulta o RI de uma empresa → dict com o evento (ou None) + diagnóstico."""
    qe = quarter_end(y, q); window = (qe, qe + dt.timedelta(days=150))
    info = {'platform': src['platform'], 'page': src['page'], 'error': None}
    if src['platform'] == 'blocked':
        info['error'] = 'site de RI bloqueia robôs (HTTP 403)'; return None, None, info
    if src.get('mz_id'):
        # id da agenda MZ fixado no ri_sources.json: consulta direto o JSON público (a página de agenda
        # pode bloquear os runners do GitHub, ex.: PRIO atrás de Cloudflare, e aí nunca se descobria o id)
        info['platform'] = 'mz'; info['mz_id'] = src['mz_id']
        rj = f.get(MZ_API.format(id=src['mz_id'], lang=src.get('mz_lang', 'pt-br')))
        events = []
        if rj is not None:
            try: events = parse_mz_events(rj.json(), src.get('mz_entity'))
            except ValueError: events = []
        res, call = pick(events, y, q)
        if res is not None: return res, call, info
        if rj is None: info['error'] = 'agenda MZ indisponível'; info['down'] = True; return None, None, info
    r = f.get(src['page'])
    if r is None:
        info['error'] = 'página de agenda indisponível'; info['down'] = True; return None, None, info
    html = r.text
    events = []
    mz = parse_mz_id(html, src.get('mz_index', 0)) if src['platform'] == 'auto' else None
    if mz:
        info['platform'] = 'mz'; info['mz_id'] = mz[0]
        rj = f.get(MZ_API.format(id=mz[0], lang=mz[1]))
        if rj is not None:
            try: events = parse_mz_events(rj.json(), src.get('mz_entity'))
            except ValueError: events = []
    if not events or pick(events, y, q)[0] is None:
        ev2 = parse_text_events(html_lines(html), window)
        if ev2 and (not events or pick(ev2, y, q)[0]):
            events = ev2; info['platform'] = info['platform'] if src['platform'] != 'auto' else ('html' if not mz else 'mz+html')
    res, call = pick(events, y, q)
    if res is None: info['error'] = f'{qlabel(y, q)} não encontrado na agenda'
    return res, call, info


# ---------------- CVM ----------------
RAD_LIST = 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx/ListarDocumentos'
RAD_DOC = 'https://www.rad.cvm.gov.br/ENET/frmGerenciaPaginaFRE.aspx?NumeroSequencialDocumento={seq}&CodigoTipoInstituicao=1'

def parse_rad(dados, ref):
    """Resposta do ListarDocumentos do RAD → {codigo_cvm: (data de entrega, link)} dos ITR/DFP com data de referência `ref`.
    Registros separados por '&*', campos por '$&': código CVM ('00865-6'), nome, categoria, tipo, espécie,
    '<spanOrder>AAAAMMDD</spanOrder> DD/MM/AAAA' (referência), entrega 'DD/MM/AAAA HH:MM', status, versão, ..."""
    out = {}
    for rec in (dados or '').split('&*'):
        f = rec.split('$&')
        if len(f) < 8: continue
        strip = lambda x: re.sub(r'<[^>]+>', ' ', x)
        mref = re.search(r'(\d\d)/(\d\d)/(\d{4})', strip(f[5])); ment = re.search(r'(\d\d)/(\d\d)/(\d{4})', strip(f[6]))
        if not mref or not ment: continue
        if dt.date(int(mref[3]), int(mref[2]), int(mref[1])) != ref: continue
        code = str(int(re.sub(r'\D', '', f[0].split('-')[0]) or 0)) + re.sub(r'\D', '', f[0].split('-')[1] if '-' in f[0] else '')
        day = dt.date(int(ment[3]), int(ment[2]), int(ment[1]))
        seq = re.search(r'NumeroSequencialDocumento=(\d+)', rec)
        link = RAD_DOC.format(seq=seq[1]) if seq else 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx'
        if code not in out or day < out[code][0]: out[code] = (day, link)
    return out

def rad_filed(y, q, today, post=None):
    """ITR/DFP entregues no RAD da CVM (consulta pública, tempo real). Os dados abertos (dados.cvm.gov.br) só
    são atualizados uma vez por semana, então sem isto a empresa que já divulgou seguia "expected" por dias."""
    post = post or (lambda body: requests.post(RAD_LIST, json=body, headers={**UA, 'Content-Type': 'application/json; charset=utf-8'}, timeout=(10, 40)).json())
    qe = quarter_end(y, q); out = {}
    a = qe + dt.timedelta(days=1)
    while a <= today:
        b = min(today, a + dt.timedelta(days=29))
        body = {'dataDe': a.strftime('%d/%m/%Y'), 'dataAte': b.strftime('%d/%m/%Y'), 'empresa': '', 'setorAtividade': '-1', 'categoriaEmissor': '-1',
                'situacaoEmissor': '-1', 'tipoParticipante': '1', 'dataReferencia': '', 'categoria': 'EST_4' if q == 4 else 'EST_3', 'periodo': '2',
                'horaIni': '', 'horaFim': '', 'palavraChave': '', 'ultimaDtRef': 'false', 'tipoEmpresa': '0', 'token': '', 'versaoCaptcha': ''}
        d = post(body).get('d') or {}
        if d.get('temErro'): raise RuntimeError(d.get('msgErro') or 'RAD erro')
        for k, v in parse_rad(d.get('dados'), qe).items():
            if k not in out or v[0] < out[k][0]: out[k] = v
        a = b + dt.timedelta(days=1); time.sleep(HOST_DELAY_S)
    return out

def parse_cvm_calendar(text, q):
    """Data prevista do ITR (q=1..3) ou da DFP (q=4) no PDF do Calendário de Eventos Corporativos."""
    t = re.sub(r'\s+', ' ', text)
    if q in (1, 2, 3):
        m = re.search(rf'{q}\s*[º°o]\s*trimestre\D{{0,80}}?(\d\d/\d\d/\d{{4}})', t, re.I)
    else:
        m = re.search(r'Demonstra[çc][õo]es\s+Financeiras\s+Anuais[^/]{0,200}?(\d\d/\d\d/\d{4})', t, re.I)
    if not m: return None
    d, mo, y = (int(x) for x in m[1].split('/'))
    return _mk(y, mo, d)

def _zip_csv(path, name):
    import pandas as pd
    z = zipfile.ZipFile(path)
    return pd.read_csv(z.open(name), sep=';', encoding='latin1', dtype=str) if name in z.namelist() else pd.DataFrame()

def cvm_data(cnpjs, y, q, today=None):
    """{cnpj: {'planned': (date, link), 'filed': (date, link)}} — calendário anual (IPE) e ITR/DFP entregue."""
    import logging, pypdf
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    out = {c: {} for c in cnpjs}
    cal_year = y + 1 if q == 4 else y
    code_cnpj = {}
    try:
        ipe = _zip_csv(cached(f'{CVM}/IPE/DADOS/ipe_cia_aberta_{cal_year}.zip', f'ipe_cia_aberta_{cal_year}.zip', max_age_h=20), f'ipe_cia_aberta_{cal_year}.csv')
        code_cnpj = {str(r.Codigo_CVM).strip(): r.CNPJ_Companhia for r in ipe[ipe.CNPJ_Companhia.isin(cnpjs)][['Codigo_CVM', 'CNPJ_Companhia']].drop_duplicates().itertuples()}
        cal = ipe[ipe.Categoria.str.contains('Calend', na=False) & ipe.CNPJ_Companhia.isin(cnpjs)].sort_values(['Data_Entrega', 'Versao'])
        fails = 0
        qe = quarter_end(y, q)
        for c, g in cal.groupby('CNPJ_Companhia'):
            # do mais novo ao mais antigo: algumas companhias já entregam o calendário do ano seguinte (ex.: Itaú, ago/26 → 2027)
            for row in list(g.itertuples())[::-1][:3]:
                link = row.Link_Download
                p = os.path.join(CACHE, 'cvmcal_' + re.sub(r'\W', '_', row.Protocolo_Entrega + '_' + str(row.Versao)) + '.pdf')
                if not os.path.exists(p):
                    if fails >= 3: break   # disjuntor do RAD
                    try:
                        r = requests.get(link, headers=UA, timeout=(10, 40))
                        if r.status_code != 200 or not r.content.startswith(b'%PDF'): raise RuntimeError(r.status_code)
                        open(p, 'wb').write(r.content); fails = 0; time.sleep(0.5)
                    except Exception as e:
                        fails += 1; print('  cvm cal', c, e); continue
                try:
                    txt = ' '.join(pg.extract_text() or '' for pg in pypdf.PdfReader(p).pages)
                    d = parse_cvm_calendar(txt, q)
                    if d and 0 < (d - qe).days <= 120:
                        out[c]['planned'] = (d, link); break
                except Exception as e: print('  pdf', c, e)
    except Exception as e: print('  ipe', e)
    kind = 'DFP' if q == 4 else 'ITR'
    try:
        df = _zip_csv(cached(f'{CVM}/{kind}/DADOS/{kind.lower()}_cia_aberta_{y}.zip', f'{kind.lower()}_cia_aberta_{y}.zip', max_age_h=20), f'{kind.lower()}_cia_aberta_{y}.csv')
        df = df[(df.DT_REFER == quarter_end(y, q).isoformat()) & df.CNPJ_CIA.isin(cnpjs)].sort_values('DT_RECEB')
        for c, g in df.groupby('CNPJ_CIA'):
            r = g.iloc[0]; out[c]['filed'] = (dt.date.fromisoformat(r.DT_RECEB[:10]), r.LINK_DOC)
    except Exception as e: print('  itr', e)
    try:
        n = 0
        for code, v in rad_filed(y, q, today or today_brt()).items():
            c = code_cnpj.get(code)
            if c and (not out[c].get('filed') or v[0] < out[c]['filed'][0]): out[c]['filed'] = v; n += 1
        print(f'  RAD (tempo real): {n} entregas de {qlabel(y, q)} além dos dados abertos')
    except Exception as e: print('  rad', type(e).__name__, e)
    return out


# ---------------- montagem ----------------
def build_row(base, y, q, res, call, info, cvm, today, prev=None):
    """Linha final: RI primeiro, CVM como fallback. Nunca inventa data."""
    row = dict(base); row['q'] = qlabel(y, q)
    planned = cvm.get('planned'); filed = cvm.get('filed')
    row['cvm_planned'] = {'date': planned[0].isoformat(), 'link': planned[1]} if planned else None
    row['filed'] = {'date': filed[0].isoformat(), 'link': filed[1]} if filed else None
    row['ri_page'] = info.get('page'); row['ri_platform'] = info.get('platform'); row['ri_error'] = info.get('error')
    row['call'] = {'date': call['date'].isoformat(), 'time': call['time']} if call else None
    row['stale'] = False
    if res is None and info.get('down') and prev and prev.get('source') == 'RI' and prev.get('q') == row['q']:
        # RI fora do ar hoje (rede/disjuntor — não quando a agenda simplesmente não tem a data): mantém o que o RI publicou na última checagem bem-sucedida, marcado como "stale"
        for k in ('date', 'time', 'timing', 'link', 'checked_at', 'call'): row[k] = prev.get(k)
        row['source'] = 'RI'; row['stale'] = True
    elif res is not None:
        row.update(date=res['date'].isoformat(), time=res['time'], timing=res['timing'], source='RI', link=info.get('page'), checked_at=today.isoformat())
    elif planned:
        row.update(date=planned[0].isoformat(), time=None, timing=None, source='CVM', link=planned[1], checked_at=today.isoformat())
    elif filed:
        row.update(date=filed[0].isoformat(), time=None, timing=None, source='CVM', link=filed[1], checked_at=today.isoformat())
    else:
        row.update(date=None, time=None, timing=None, source=None, link=None, checked_at=today.isoformat())
    if filed: row['status'] = 'released'
    elif row['source'] == 'RI': row['status'] = 'confirmed'
    elif row['date']: row['status'] = 'expected'
    else: row['status'] = None
    return row

def coverage(rows):
    n = len(rows)
    return {'n': n, 'ri_date': sum(r['source'] == 'RI' for r in rows), 'ri_timing': sum(r['source'] == 'RI' and bool(r['timing']) for r in rows),
            'cvm_only': sum(r['source'] == 'CVM' for r in rows), 'no_date': sum(not r['date'] for r in rows),
            'released': sum(r['status'] == 'released' for r in rows)}

def load_sources():
    return json.load(open(os.path.join(HERE, 'ri_sources.json'), encoding='utf-8'))['sources']

def universe_rows():
    uni = json.load(open(os.path.join(OUT, 'universe.json'), encoding='utf-8'))
    return [{'ticker': c['cod'], 'name': c['name'], 'sector': c.get('sector'), 'weight': c.get('weight')} for c in uni['components']]

def cnpj_map(tickers):
    """Código de negociação → CNPJ pelo FCA da CVM (mesma fonte do build_corp)."""
    y = today_brt().year
    for yr in (y, y - 1):
        try:
            v = _zip_csv(cached(f'{CVM}/FCA/DADOS/fca_cia_aberta_{yr}.zip', f'fca_cia_aberta_{yr}.zip', max_age_h=20), f'fca_cia_aberta_valor_mobiliario_{yr}.csv')
            if len(v):
                v = v.dropna(subset=['Codigo_Negociacao'])
                return {r.Codigo_Negociacao.strip(): r.CNPJ_Companhia for r in v.itertuples() if r.Codigo_Negociacao.strip() in tickers}
        except Exception as e: print('fca', yr, e)
    return {}

def logo_map(tickers=()):
    """ticker → 'logos/<arquivo>' pelo manifest; quem não estiver nele cai na regra de pipeline/logos.py
    (override, exato, mesma raiz 3/4/11/5/6/7/8) sobre os arquivos já presentes em public/logos."""
    d = os.path.join(HERE, '..', 'public', 'logos')
    try: m = {x['ticker']: 'logos/' + x['file'] for x in json.load(open(os.path.join(d, 'manifest.json'), encoding='utf-8'))['logos']}
    except Exception: m = {}
    try:
        from logos import resolve
        have = {f[:-4] for f in os.listdir(d) if f.endswith('.png')}
        for t in tickers:
            if t not in m:
                src, _ = resolve(t, have)
                if src: m[t] = f'logos/{src}.png'
    except Exception as e: print('logos', e)
    return m

def main():
    today = today_brt(); y, q = season(today)
    base = universe_rows(); tickers = {b['ticker'] for b in base}
    srcs = load_sources(); logos = logo_map(tickers)
    cn = cnpj_map(tickers)
    unit_cnpj = {'TAEE11': 'TAEE3', 'KLBN11': 'KLBN3', 'ENGI11': 'ENGI3', 'IGTI11': 'IGTI3', 'SANB11': 'SANB3', 'BPAC11': 'BPAC3'}
    for t, alt in unit_cnpj.items():
        if t not in cn and alt in cn: cn[t] = cn[alt]
    cvm = cvm_data(sorted(set(cn.values())), y, q, today)
    prev = {r['ticker']: r for r in ((load_prev('calendar.json') or {}).get('rows') or []) if r.get('v') == 2}
    f = Fetcher(); seen = {}; rows = []
    print(f'  temporada {qlabel(y, q)}; {len(base)} empresas')
    for b in base:
        t = b['ticker']; src = srcs.get(t)
        b = {**b, 'v': 2, 'cnpj': cn.get(t), 'logo': logos.get(t)}
        res = call = None; info = {'platform': None, 'page': None, 'error': 'sem RI mapeado'}
        if src:
            key = (src['page'], src.get('mz_index', 0), src.get('mz_entity'))
            if key in seen: res, call, info = seen[key]          # PETR3/PETR4, BBDC3/BBDC4: uma consulta só
            elif f.open: info = {'platform': src['platform'], 'page': src['page'], 'error': 'disjuntor aberto (RI não consultado hoje)', 'down': True}
            else:
                try: res, call, info = fetch_ri(src, f, y, q)
                except Exception as e: info = {'platform': src['platform'], 'page': src['page'], 'error': f'erro: {type(e).__name__}', 'down': True}
                seen[key] = (res, call, info)
        rows.append(build_row(b, y, q, res, call, info, cvm.get(cn.get(t), {}), today, prev.get(t)))
    rows.sort(key=lambda r: (r['date'] or '9999', r['ticker']))
    cov = coverage(rows)
    print(f'  cobertura: {cov}; {f.requests} requisições RI; disjuntor {"ABERTO" if f.open else "fechado"}')
    save('calendar.json', {'v': 2, 'generated_at': now_iso(), 'as_of': today.isoformat(), 'quarter': qlabel(y, q), 'quarter_end': quarter_end(y, q).isoformat(),
                           'coverage': cov, 'breaker_open': f.open,
                           'source': 'Company investor-relations sites (agenda/events calendar, checked daily) with CVM open data fallback (IPE Corporate Events Calendar; ITR/DFP filings).',
                           'rows': rows})

if __name__ == '__main__':
    main()
