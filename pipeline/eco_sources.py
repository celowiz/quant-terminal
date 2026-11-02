"""Fontes extras da agenda ECO (além de IBGE, BEA, Census, Copom e FOMC, que ficam em build_macro.eco).

Cada fonte é uma função (a, b, fetch) → lista de linhas no formato do eco.json; o parser é separado da busca
(fetch(url) → texto ou JSON) para os testes rodarem com fixtures salvas. Falha de uma fonte nunca derruba as outras:
eco() captura a exceção, registra status[nome] = 0 e mantém as linhas anteriores daquela fonte.

Regras: só datas de calendários oficiais (ou regras de divulgação publicadas pelo próprio órgão, como ISM no 1º dia
útil e pedidos de seguro-desemprego às quintas); horários convertidos para BRT; sem consenso (survey = None);
nomes EN/PT escritos à mão aqui; importância (tier 1–3) é nossa, derivada do tipo de indicador.
"""
import os, re, json, urllib.parse, html as htmlmod, datetime as dt
from zoneinfo import ZoneInfo

BRT = ZoneInfo('America/Sao_Paulo')
UTC = dt.timezone.utc
NY = ZoneInfo('America/New_York')
LON = ZoneInfo('Europe/London')
CET = ZoneInfo('Europe/Brussels')
FRA = ZoneInfo('Europe/Berlin')
TOK = ZoneInfo('Asia/Tokyo')
TOR = ZoneInfo('America/Toronto')

# o calendário do BLS recusa User-Agent de navegador e alguns com URL; este (sem URL) responde 200
UA_CONTACT = {'User-Agent': 'quant-terminal-pipeline/1.0', 'From': 'celowiz@users.noreply.github.com'}
UA_BROWSER = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8'}

MONTHS_EN = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}
MONTHS_PT = {m: i + 1 for i, m in enumerate(['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'])}


def row(country, when, en, pt, agency, period=None, tier=2, approx=False, src=None):
    """Linha do eco.json. when: datetime com fuso (→ BRT) ou date (dia inteiro, sem horário publicado)."""
    allday = not isinstance(when, dt.datetime)
    t = dt.datetime.combine(when, dt.time(0, 0), BRT) if allday else when.astimezone(BRT)
    r = {'country': country, 'time': t.isoformat(timespec='minutes'), 'event': en, 'event_pt': pt, 'period': period, 'agency': agency,
         'survey': None, 'actual': None, 'prior': None, 'unit': None, 'key': tier >= 3, 'tier': tier, 'src': src}
    if allday: r['allday'] = True
    if approx: r['time_approx'] = True
    return r


def in_window(rows, a, b):
    lo, hi = a.isoformat(), b.isoformat()
    return [r for r in rows if lo <= r['time'][:10] <= hi]


def text_of(h):
    """HTML → texto, um bloco por linha (sem script/style)."""
    h = re.sub(r'<(script|style)\b.*?</\1>', '', h, flags=re.S | re.I)
    x = htmlmod.unescape(re.sub(r'<[^>]+>', '\n', h)).replace('\xa0', ' ')
    return '\n'.join(l.strip() for l in x.split('\n') if l.strip())


def ics_events(txt):
    """[(summary, datetime|date, props)] de um ICS; TZID reconhecido (America/Sao_Paulo, US-Eastern) ou Z; VALUE=DATE vira date."""
    txt = re.sub(r'\r?\n[ \t]', '', txt)
    tzmap = {'America/Sao_Paulo': BRT, 'US-Eastern': NY, 'America/New_York': NY, 'Europe/Brussels': CET, 'Europe/Luxembourg': CET}
    out = []
    for blk in txt.split('BEGIN:VEVENT')[1:]:
        blk = blk.split('END:VEVENT')[0]
        s = re.search(r'\nSUMMARY[^:\n]*:(.*)', blk); d = re.search(r'\nDTSTART([^:\n]*):(\d{8})(T\d{6}Z?)?', blk)
        if not s or not d: continue
        params, day, tm = d.groups()
        if not tm:
            when = dt.datetime.strptime(day, '%Y%m%d').date()
        else:
            t = dt.datetime.strptime(day + tm[:7], '%Y%m%dT%H%M%S')
            if tm.endswith('Z'): when = t.replace(tzinfo=UTC)
            else:
                z = re.search(r'TZID=([^;:]+)', params or '')
                when = t.replace(tzinfo=tzmap.get(z.group(1) if z else '', NY))
        props = {m.group(1): m.group(2).strip() for m in re.finditer(r'\n([A-Z-]+)[^:\n]*:(.*)', blk)}
        out.append((s.group(1).replace('\\,', ',').replace('\\;', ';').strip(), when, props))
    return out


# ---------------------------------------------------------------- feriados federais dos EUA (dias úteis)
def _nth(y, m, wd, n):
    d = dt.date(y, m, 1); d += dt.timedelta(days=(wd - d.weekday()) % 7); return d + dt.timedelta(weeks=n - 1)

def _last(y, m, wd):
    d = dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1); return d - dt.timedelta(days=(d.weekday() - wd) % 7)

def _obs(d): return d - dt.timedelta(days=1) if d.weekday() == 5 else d + dt.timedelta(days=1) if d.weekday() == 6 else d

def us_holidays(y):
    """Feriados federais (OPM), com a regra de folga observada para sábado/domingo."""
    return {_obs(dt.date(y, 1, 1)), _nth(y, 1, 0, 3), _nth(y, 2, 0, 3), _last(y, 5, 0), _obs(dt.date(y, 6, 19)), _obs(dt.date(y, 7, 4)),
            _nth(y, 9, 0, 1), _nth(y, 10, 0, 2), _obs(dt.date(y, 11, 11)), _nth(y, 11, 3, 4), _obs(dt.date(y, 12, 25))} | (
            {_obs(dt.date(y + 1, 1, 1))} if _obs(dt.date(y + 1, 1, 1)).year == y else set())

def us_bday(d): return d.weekday() < 5 and d not in us_holidays(d.year)

def nth_us_bday(y, m, n):
    d, k = dt.date(y, m, 1), 0
    while True:
        if us_bday(d):
            k += 1
            if k == n: return d
        d += dt.timedelta(days=1)

def months_between(a, b):
    y, m = a.year, a.month
    while (y, m) <= (b.year, b.month):
        yield y, m
        y, m = (y + (m == 12), m % 12 + 1)

def at(d, h, mi, tz): return dt.datetime.combine(d, dt.time(h, mi), tz)

# ================================================================ BRASIL
BCB_ICS = 'https://www.bcb.gov.br/api/exportarics/sitebcb/agendaics?lista='
BCB_LISTS = [  # (lista, regex no SUMMARY, EN, PT, tier)
    ('Focus', r'Relat[óo]rio Focus', 'Focus market survey', 'Boletim Focus', 2),
    ('Atas e Comunicados do Copom', r'^Ata da Reuni[ãa]o do Copom', 'Copom minutes', 'Ata do Copom', 3),
    ('Índice de atividade econômica (IBC-Br)', r'IBC-Br', 'IBC-Br economic activity index', 'IBC-Br (atividade econômica)', 2),
    ('Estatísticas fiscais', r'fiscais', 'Public sector fiscal statistics', 'Estatísticas fiscais', 2),
    ('Estatísticas do setor externo', r'setor externo', 'External sector statistics (current account, FDI)', 'Estatísticas do setor externo (conta corrente, IDP)', 2),
    ('Estatísticas monetárias e de crédito', r'monet[áa]rias', 'Monetary and credit statistics', 'Estatísticas monetárias e de crédito', 1),
    ('Reuniões do CMN e COMOC', r'Reuni[ãa]o do CMN', 'National Monetary Council (CMN) meeting', 'Reunião do CMN', 1),
    ('Relatório de Política Monetária', r'Pol[íi]tica Monet[áa]ria', 'Monetary Policy Report', 'Relatório de Política Monetária', 2),
]

def parse_bcb_ics(txt, pat, en, pt, tier):
    out = []
    for s, when, _ in ics_events(txt):
        if not re.search(pat, s): continue
        if isinstance(when, dt.datetime) and when.hour == 0 and when.minute == 0: when = when.date()   # CMN: sem horário
        out.append(row('BR', when, en, pt, 'BCB', tier=tier, src='bcb'))
    return out

def bcb(a, b, fetch):
    out, ok = [], 0
    for lista, pat, en, pt, tier in BCB_LISTS:
        try:
            out += parse_bcb_ics(fetch(BCB_ICS + urllib.parse.quote(lista)), pat, en, pt, tier); ok += 1
        except Exception as e: print('eco bcb', lista, type(e).__name__, e)
    if not ok: raise RuntimeError('nenhuma agenda do BCB respondeu')
    return in_window(out, a, b)

FGV_URL = 'https://portalibre.fgv.br/calendario-de-divulgacao'
FGV_MAP = [  # (regex no título, EN, PT, tier)
    (r'^IGP-M e os componentes', 'IGP-M general price index', 'IGP-M', 3),
    (r'^IGP-DI e os componentes', 'IGP-DI general price index', 'IGP-DI', 2),
    (r'^IGP-10 e os componentes', 'IGP-10 general price index', 'IGP-10', 1),
    (r'^IGP-M Primeiro Dec', 'IGP-M 1st ten-day preview', 'IGP-M 1º decêndio', 1),
    (r'^IGP-M Segundo Dec', 'IGP-M 2nd ten-day preview', 'IGP-M 2º decêndio', 1),
    (r'^IPC-S Capitais', None, None, 0),
    (r'^IPC-S', 'IPC-S weekly consumer prices', 'IPC-S (inflação semanal)', 1),
    (r'^INCC-M', 'INCC-M construction costs', 'INCC-M (custo da construção)', 1),
    (r'^Sondagem do Consumidor', 'Consumer confidence', 'Confiança do consumidor', 2),
    (r'^Sondagem da Ind[úu]stria', 'Industry confidence', 'Confiança da indústria', 2),
    (r'^Sondagem de Servi[çc]os', 'Services confidence', 'Confiança de serviços', 1),
    (r'^Sondagem do Com[ée]rcio', 'Retail confidence', 'Confiança do comércio', 1),
    (r'^Sondagem da Constru[çc][ãa]o', 'Construction confidence', 'Confiança da construção', 1),
    (r'^Pr[ée]via da Sondagem da Ind', 'Industry confidence (preview)', 'Confiança da indústria (prévia)', 1),
    (r'^[ÍI]ndice de Confian[çc]a Empresarial', 'Business confidence (ICE)', 'Confiança empresarial (ICE)', 1),
    (r'^Indicador de Incerteza', 'Economic uncertainty index (IIE-Br)', 'Incerteza da economia (IIE-Br)', 1),
    (r'^Monitor do PIB', 'Monthly GDP monitor', 'Monitor do PIB', 1),
    (r'Aluguéis Residenciais|^IVAR', 'Residential rent index (IVAR)', 'Aluguéis residenciais (IVAR)', 1),
    (r'^Sondagem do Mercado de Trabalho|^IAEmp', 'Labour market indicators (IAEmp/ICD)', 'Indicadores do mercado de trabalho (IAEmp/ICD)', 1),
]

def _period_pt(s):
    """'Out/2026', 'Outubro/2026', 'Outubro de 2026', '1ª quadrissemana - Nov/2026' → '10/2026' (+ semana)."""
    m = re.search(r'(\d)ª quadrissemana\s*-\s*([A-Za-zçÇ]{3})[a-zç]*/(\d{4})', s)
    if m and m.group(2)[:3].lower() in MONTHS_PT: return f'W{m.group(1)} {MONTHS_PT[m.group(2)[:3].lower()]:02d}/{m.group(3)}'
    m = re.search(r'([A-Za-zçÇ]{3})[a-zç]*(?:/| de )(\d{4})\s*$', s)
    if m and m.group(1)[:3].lower() in MONTHS_PT: return f'{MONTHS_PT[m.group(1)[:3].lower()]:02d}/{m.group(2)}'
    return None

def parse_fgv(h):
    lines = text_of(h).split('\n'); out = []
    for i in range(len(lines) - 2):
        d = re.fullmatch(r'(\d{2})/(\d{2})/(\d{4})', lines[i]); tm = re.fullmatch(r'(\d{1,2})h(\d{2})?', lines[i + 1])
        if not d or not tm: continue
        title = re.sub(r'\s+', ' ', lines[i + 2]).strip()
        for pat, en, pt, tier in FGV_MAP:
            if re.search(pat, title):
                if en:
                    when = at(dt.date(int(d.group(3)), int(d.group(2)), int(d.group(1))), int(tm.group(1)), int(tm.group(2) or 0), BRT)
                    out.append(row('BR', when, en, pt, 'FGV', period=_period_pt(title), tier=tier, src='fgv'))
                break
    return out

def fgv(a, b, fetch):
    # a página mostra só o mês corrente; o filtro 'Período' do próprio site devolve a janela inteira
    u = f'{FGV_URL}?field_divulgacao_data_value={a.isoformat()}&field_divulgacao_data_value_1={b.isoformat()}'
    return in_window(parse_fgv(fetch(u)), a, b)

CAGED_URL = ('https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/'
             'estatisticas-trabalho/o-pdet/calendario-de-divulgacao-do-novo-caged')
PT_MONTH_FULL = {m: i + 1 for i, m in enumerate(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])}

def parse_caged(h):
    """'04/11/2026 - Competência: setembro de 2026' — a página publica só o dia; o horário fica em aberto (dia inteiro)."""
    out = []
    for d, mo, y, mes, ano in re.findall(r'(\d{2})/(\d{2})/(\d{4})\s*-\s*Compet[êe]ncia:\s*([a-zç]+) de (\d{4})', text_of(h), flags=re.I):
        per = f'{PT_MONTH_FULL.get(mes.lower(), 0):02d}/{ano}'
        out.append(row('BR', dt.date(int(y), int(mo), int(d)), 'Formal job creation (Novo CAGED)', 'Emprego formal (Novo Caged)', 'MTE', period=per, tier=2, src='caged'))
    return out

def caged(a, b, fetch): return in_window(parse_caged(fetch(CAGED_URL)), a, b)

MDIC_URL = 'https://balanca.mdic.gov.br/balanca/cronograma/pg_cronograma.html'

def parse_mdic(h):
    lines = text_of(h).split('\n'); out = []
    for i in range(len(lines) - 3):
        d = re.fullmatch(r'(\d{2})/(\d{2})/(\d{2})', lines[i])
        if not d: continue
        kind, tm, per = lines[i + 1], lines[i + 2], lines[i + 3]
        t = re.match(r'(\d{2}):(\d{2})', tm)
        if not t: continue
        day = dt.date(2000 + int(d.group(3)), int(d.group(2)), int(d.group(1)))
        when = at(day, int(t.group(1)), int(t.group(2)), BRT)
        p = re.match(r'(\d{2})/(\d{2})/(\d{2}) a (\d{2})/(\d{2})/(\d{2})', per)
        if re.search(r'consolidados', kind, re.I):
            period = f'{p.group(5)}/20{p.group(6)}' if p else None
            out.append(row('BR', when, 'Trade balance (monthly)', 'Balança comercial (mensal)', 'MDIC', period=period, tier=2, src='mdic'))
        elif re.search(r'Parcial', kind, re.I):
            period = f'{p.group(1)}/{p.group(2)}–{p.group(4)}/{p.group(5)}' if p else None
            out.append(row('BR', when, 'Trade balance (weekly partial)', 'Balança comercial (parcial semanal)', 'MDIC', period=period, tier=1, src='mdic'))
    return out

def mdic(a, b, fetch): return in_window(parse_mdic(fetch(MDIC_URL)), a, b)

# ================================================================ EUA
BLS_ICS = 'https://www.bls.gov/schedule/news_release/bls.ics'
BLS_MAP = [  # (regex, EN, PT, tier)
    (r'^Employment Situation', 'Nonfarm payrolls & unemployment rate', 'Payroll (emprego) e taxa de desemprego', 3),
    (r'^Consumer Price Index', 'CPI inflation', 'CPI (inflação ao consumidor)', 3),
    (r'^Producer Price Index', 'PPI producer prices', 'PPI (preços ao produtor)', 2),
    (r'^Job Openings and Labor Turnover', 'JOLTS job openings', 'JOLTS (vagas de emprego)', 2),
    (r'^Employment Cost Index', 'Employment cost index', 'Índice de custo do emprego (ECI)', 2),
    (r'^Productivity and Costs', 'Productivity & unit labor costs', 'Produtividade e custo unitário do trabalho', 1),
    (r'^Real Earnings', 'Real earnings', 'Rendimentos reais', 1),
    (r'Import and Export Price', 'Import & export prices', 'Preços de importação e exportação', 1),
    (r'^State Employment and Unemployment', 'State employment & unemployment', 'Emprego e desemprego por estado', 1),
]

def parse_bls(txt):
    out = []
    for s, when, _ in ics_events(txt):
        if not isinstance(when, dt.datetime): continue
        for pat, en, pt, tier in BLS_MAP:
            if re.search(pat, s): out.append(row('US', when, en, pt, 'BLS', tier=tier, src='bls')); break
    return out

def bls(a, b, fetch): return in_window(parse_bls(fetch(BLS_ICS)), a, b)

# FRED: datas de divulgação (sem horário) — usado para G.19/H.4.1/G.17 e como reserva do BLS.
# release_id → (nome esperado no FRED, EN, PT, tier, horário ET de praxe, agência, só como reserva do BLS?)
FRED_RELEASES = {
    10: ('Consumer Price Index', 'CPI inflation', 'CPI (inflação ao consumidor)', 3, (8, 30), 'BLS', True),
    50: ('Employment Situation', 'Nonfarm payrolls & unemployment rate', 'Payroll (emprego) e taxa de desemprego', 3, (8, 30), 'BLS', True),
    46: ('Producer Price Index', 'PPI producer prices', 'PPI (preços ao produtor)', 2, (8, 30), 'BLS', True),
    192: ('Job Openings and Labor Turnover', 'JOLTS job openings', 'JOLTS (vagas de emprego)', 2, (10, 0), 'BLS', True),
    14: ('G.19 Consumer Credit', 'Consumer credit (G.19)', 'Crédito ao consumidor (G.19)', 1, (15, 0), 'Fed', False),
    20: ('H.4.1', 'Fed balance sheet (H.4.1)', 'Balanço do Fed (H.4.1)', 1, (16, 30), 'Fed', False),
    13: ('G.17 Industrial Production', 'Industrial production (G.17)', 'Produção industrial (G.17)', 2, (9, 15), 'Fed', False),
}
FRED_DATES = 'https://api.stlouisfed.org/fred/releases/dates'

def parse_fred_dates(d, with_bls):
    out = []
    for x in d.get('release_dates', []):
        m = FRED_RELEASES.get(int(x.get('release_id', -1)))
        if not m: continue
        name, en, pt, tier, (h, mi), ag, is_bls = m
        if is_bls and not with_bls: continue
        if not re.search(re.escape(name.split()[0]), x.get('release_name', '')): continue     # id não bate com o nome: ignora
        day = dt.date.fromisoformat(x['date'])
        out.append(row('US', at(day, h, mi, NY), en, pt, ag, tier=tier, approx=True, src='fred_bls' if is_bls else 'fred'))
    return out

def fred_dates(a, b, fetch_key, with_bls):
    """fetch_key(params) → JSON; a chave vai só dentro de fetch_key (nunca em URL de log)."""
    d = fetch_key({'realtime_start': a.isoformat(), 'realtime_end': b.isoformat(), 'include_release_dates_with_no_data': 'true',
                   'limit': 1000, 'file_type': 'json', 'sort_order': 'asc'})
    return in_window(parse_fred_dates(d, with_bls), a, b)

def ism_claims(a, b):
    """Regras publicadas: ISM industrial no 1º dia útil e serviços no 3º dia útil, 10:00 ET;
    pedidos de seguro-desemprego (DOL) toda quinta 08:30 ET — se a quinta for feriado federal, na quarta anterior."""
    out = []
    for y, m in months_between(a, b):
        out.append(row('US', at(nth_us_bday(y, m, 1), 10, 0, NY), 'Manufacturing PMI (ISM)', 'PMI industrial (ISM)', 'ISM', tier=3, src='rules'))
        out.append(row('US', at(nth_us_bday(y, m, 3), 10, 0, NY), 'Services PMI (ISM)', 'PMI de serviços (ISM)', 'ISM', tier=2, src='rules'))
    d = a + dt.timedelta(days=(3 - a.weekday()) % 7)
    while d <= b:
        day = d - dt.timedelta(days=1) if d in us_holidays(d.year) else d
        out.append(row('US', at(day, 8, 30, NY), 'Initial jobless claims', 'Pedidos iniciais de seguro-desemprego', 'DOL', tier=2, src='rules'))
        d += dt.timedelta(days=7)
    return in_window(out, a, b)

EIA_URL = 'https://www.eia.gov/petroleum/supply/weekly/schedule.php'

def parse_eia_holidays(h):
    """Tabela de datas alteradas: (semana de referência, nova data, dia, horário, feriado) → {data_nova: (h, m)}."""
    lines = text_of(h).split('\n'); out = {}
    dre = r'(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})'
    for i in range(len(lines) - 3):
        if re.fullmatch(dre, lines[i]) and re.fullmatch(dre, lines[i + 1]):
            mo, d, y = re.fullmatch(dre, lines[i + 1]).groups()
            t = re.fullmatch(r'(\d{1,2}):(\d{2}) ([ap])\.m\.', lines[i + 3])
            if not t: continue
            hh = int(t.group(1)) % 12 + (12 if t.group(3) == 'p' else 0)
            out[dt.date(int(y), MONTHS_EN[mo[:3].lower()], int(d))] = (hh, int(t.group(2)))
    return out

def eia(a, b, fetch):
    """Estoques semanais de petróleo: quarta 10:30 ET, exceto as semanas da tabela de feriados da EIA."""
    hol = parse_eia_holidays(fetch(EIA_URL))
    out = []
    d = a + dt.timedelta(days=(2 - a.weekday()) % 7)
    while d <= b:
        mon = d - dt.timedelta(days=2)
        moved = [k for k in hol if mon <= k <= mon + dt.timedelta(days=6)]
        when = at(moved[0], *hol[moved[0]], NY) if moved else at(d, 10, 30, NY)
        out.append(row('US', when, 'Crude oil inventories (weekly)', 'Estoques de petróleo (semanal)', 'EIA', tier=1, src='eia'))
        d += dt.timedelta(days=7)
    return in_window(out, a, b)

UMICH_URL = 'https://www.sca.isr.umich.edu/'

def parse_umich(h):
    m = re.search(r'Next data release:\s*\w+day,\s*(\w+) (\d{1,2}), (\d{4}) for (Preliminary|Final) (\w+) data at (\d{1,2})(?::(\d{2}))?\s*([ap])m ET', text_of(h).replace('\n', ' '))
    if not m: return []
    mo, d, y, kind, ref, hh, mi, ap = m.groups()
    when = at(dt.date(int(y), MONTHS_EN[mo[:3].lower()], int(d)), int(hh) % 12 + (12 if ap == 'p' else 0), int(mi or 0), NY)
    en = 'Consumer sentiment (prelim.)' if kind == 'Preliminary' else 'Consumer sentiment (final)'
    pt = 'Sentimento do consumidor (prévia)' if kind == 'Preliminary' else 'Sentimento do consumidor (final)'
    per = f'{MONTHS_EN[ref[:3].lower()]:02d}/{y}' if ref[:3].lower() in MONTHS_EN else None
    return [row('US', when, en, pt, 'UMich', period=per, tier=2, src='umich')]

def umich(a, b, fetch): return in_window(parse_umich(fetch(UMICH_URL)), a, b)

TSY_URL = 'https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json'
TSY_PT = {'Note': 'Leilão de T-Note', 'Bond': 'Leilão de T-Bond', 'TIPS Note': 'Leilão de TIPS', 'TIPS Bond': 'Leilão de TIPS', 'FRN Note': 'Leilão de FRN'}

def parse_treasury(d):
    """Leilões anunciados de notes/bonds/TIPS (bills ficam de fora): data e hora de fechamento das propostas competitivas (ET)."""
    out, seen = [], set()
    for x in d:
        ty = (x.get('type') or x.get('securityType') or '').strip()
        if ty not in TSY_PT: continue
        day = (x.get('auctionDate') or x.get('competitiveAuctionCloseDate') or '')[:10]
        tm = re.match(r'(\d{1,2}):(\d{2}) ([AP])M', x.get('competitiveAuctionCloseTime') or '')
        if not day: continue
        d0 = dt.date.fromisoformat(day)  # sem horário publicado ainda → dia inteiro (não inventamos o horário)
        when = at(d0, int(tm.group(1)) % 12 + (12 if tm.group(3) == 'P' else 0), int(tm.group(2)), NY) if tm else d0
        term = x.get('securityTerm') or ''
        k = (day, term, ty)
        if k in seen: continue
        seen.add(k)
        en = f'{term} {"TIPS" if "TIPS" in ty else "FRN" if "FRN" in ty else ty.lower()} auction'
        out.append(row('US', when, en, f'{TSY_PT[ty]} {term.replace("-Year", " anos")}',
                       'Treasury', tier=2 if term in ('10-Year', '30-Year') else 1, src='treasury'))
    return out

def treasury(a, b, fetch): return in_window(parse_treasury(fetch(TSY_URL)), a, b)

# ================================================================ PMI (datas oficiais em UTC)
PMI_URL = 'https://www.pmi.spglobal.com/Public/Release/ReleaseDates'
PMI_CTRY = [('Brazil', 'BR'), ('US', 'US'), ('Eurozone', 'EA'), ('Germany', 'DE'), ('France', 'FR'), ('Italy', 'IT'), ('Spain', 'ES'), ('UK', 'GB'),
            ('Japan', 'JP'), ('China', 'CN'), ('India', 'IN'), ('Canada', 'CA'), ('Mexico', 'MX'), ('Australia', 'AU')]
PMI_KIND = [  # (regex, EN, PT, tier) — ordem importa
    (r'Flash', 'Flash PMI (manufacturing & services)', 'PMI preliminar (indústria e serviços)', 2),
    (r'Manufacturing PMI', 'Manufacturing PMI', 'PMI industrial', 2),
    (r'Services PMI|Composite PMI', 'Services & composite PMI', 'PMI de serviços e composto', 2),
]

def parse_pmi(h):
    lines = text_of(h).split('\n'); out = []
    year, prev_m, day, tm = None, 0, None, None
    for l in lines:
        if re.fullmatch(r'20\d\d', l): year = int(l); prev_m = 0; continue
        m = re.fullmatch(r'(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})', l)
        if m and year:
            mo = MONTHS_EN[m.group(1)[:3].lower()]
            if mo < prev_m: year += 1
            prev_m = mo; day = dt.date(year, mo, int(m.group(2))); continue
        t = re.fullmatch(r'(\d{2}):(\d{2}) UTC', l)
        if t: tm = (int(t.group(1)), int(t.group(2))); continue
        if not day or not tm or 'PMI' not in l or 'Sector' in l or 'Construction' in l: continue
        c = next((code for name, code in PMI_CTRY if re.search(rf'\b{name}\b', l) and not re.search(r'ASEAN|Asia|Global (Composite|Manufacturing)', l)), None)
        if not c: continue
        k = next((x for x in PMI_KIND if re.search(x[0], l)), None)
        if not k: continue
        tier = 3 if c in ('US', 'EA', 'CN') and k[0] == 'Manufacturing PMI' else k[3]
        out.append(row(c, at(day, *tm, UTC), k[1], k[2], 'S&P Global', tier=tier, src='pmi')); tm = None
    return out

def pmi(a, b, fetch): return in_window(parse_pmi(fetch(PMI_URL)), a, b)

# ================================================================ Zona do euro, Reino Unido, Canadá
EUROSTAT_ICS = 'https://ec.europa.eu/eurostat/o/calendars/eventsIcal?category=1'
EUROSTAT_MAP = [  # euro indicators saem às 11:00 (Luxemburgo/Bruxelas)
    (r'^Flash estimate inflation', 'Euro area flash inflation (HICP)', 'Inflação preliminar da zona do euro (HICP)', 3),
    (r'^Inflation\b|^HICP|^Annual inflation', 'Euro area inflation (HICP, final)', 'Inflação da zona do euro (HICP, final)', 2),
    (r'^Flash estimate GDP|^Preliminary flash estimate GDP', 'Euro area GDP (flash)', 'PIB da zona do euro (preliminar)', 3),
    (r'^GDP and employment|^GDP main aggregates', 'Euro area GDP & employment', 'PIB e emprego da zona do euro', 2),
    (r'^Unemployment|^Euro area unemployment', 'Euro area unemployment rate', 'Taxa de desemprego da zona do euro', 2),
    (r'^Industrial production', 'Euro area industrial production', 'Produção industrial da zona do euro', 2),
    (r'^Volume of retail trade|^Retail trade', 'Euro area retail sales', 'Vendas no varejo da zona do euro', 2),
    (r'^Industrial producer prices', 'Euro area producer prices', 'Preços ao produtor da zona do euro', 1),
    (r'^International trade in goods|^Euro area international trade', 'Euro area trade balance', 'Balança comercial da zona do euro', 1),
]

def parse_eurostat(txt):
    out = []
    for s, when, props in ics_events(txt):
        if 'Euro indicators' not in props.get('X-CATEGORY', '') and 'euro indicators' not in props.get('CATEGORIES', '').lower(): continue
        for pat, en, pt, tier in EUROSTAT_MAP:
            if re.search(pat, s, re.I):
                day = when if isinstance(when, dt.date) and not isinstance(when, dt.datetime) else when.date()
                out.append(row('EA', at(day, 11, 0, CET), en, pt, 'Eurostat', tier=tier, src='eurostat')); break
    return out

def eurostat(a, b, fetch): return in_window(parse_eurostat(fetch(EUROSTAT_ICS)), a, b)

ONS_URL = 'https://api.beta.ons.gov.uk/v1/search/releases?release-type=type-upcoming&fromDate={a}&toDate={b}&limit=200'
ONS_MAP = [
    (r'^(GDP first quarterly estimate|GDP quarterly national accounts), UK: [A-Z][a-z]+ to [A-Z][a-z]+ \d{4}$', 'UK GDP (quarterly)', 'PIB do Reino Unido (trimestral)', 3),
    (r'^GDP monthly estimate, UK: [A-Z][a-z]+ \d{4}$', 'UK GDP (monthly)', 'PIB do Reino Unido (mensal)', 2),
    (r'^Consumer price inflation, UK: [A-Z][a-z]+ \d{4}$', 'UK CPI inflation', 'Inflação do Reino Unido (CPI)', 3),
    (r'^Labour market overview, UK: [A-Z][a-z]+ \d{4}$', 'UK labour market (unemployment, wages)', 'Mercado de trabalho do Reino Unido (desemprego, salários)', 2),
    (r'^Retail sales, Great Britain: [A-Z][a-z]+ \d{4}$', 'UK retail sales', 'Vendas no varejo do Reino Unido', 2),
    (r'^UK trade: [A-Z][a-z]+ \d{4}$', 'UK trade balance', 'Balança comercial do Reino Unido', 1),
    (r'^Public sector finances, UK: [A-Z][a-z]+ \d{4}$', 'UK public finances', 'Finanças públicas do Reino Unido', 1),
]

def parse_ons(d):
    out = []
    for r in d.get('releases', []):
        x = r.get('description') or {}
        if x.get('cancelled'): continue
        t = (x.get('title') or '').strip()
        for pat, en, pt, tier in ONS_MAP:
            if re.search(pat, t):
                when = dt.datetime.fromisoformat(x['release_date'].replace('Z', '+00:00'))
                per = t.split(': ', 1)[1] if ': ' in t else None
                out.append(row('GB', when, en, pt, 'ONS', period=per, tier=tier, src='ons')); break
    return out

def ons(a, b, fetch): return in_window(parse_ons(fetch(ONS_URL.format(a=a.isoformat(), b=b.isoformat()))), a, b)

STATCAN_URL = 'https://www150.statcan.gc.ca/n1/dai-quo/ssi/homepage/schedule-key_indicators-eng.json'
STATCAN_MAP = [  # The Daily sai às 08:30 (Ottawa)
    (r'^Consumer Price Index$', 'Canada CPI inflation', 'Inflação do Canadá (CPI)', 3),
    (r'^Labour Force Survey$', 'Canada employment (LFS)', 'Emprego no Canadá (LFS)', 3),
    (r'^Gross domestic product, income and expenditure$', 'Canada GDP (quarterly)', 'PIB do Canadá (trimestral)', 3),
    (r'^Gross domestic product by industry$', 'Canada GDP (monthly)', 'PIB do Canadá (mensal)', 2),
    (r'^Retail trade$', 'Canada retail sales', 'Vendas no varejo do Canadá', 2),
    (r'^Canadian international merchandise trade$', 'Canada trade balance', 'Balança comercial do Canadá', 1),
    (r'^Monthly Survey of Manufacturing$', 'Canada manufacturing sales', 'Vendas da indústria do Canadá', 1),
]

def parse_statcan(d):
    out = []
    for x in d:
        t = (x.get('title') or '').strip()
        for pat, en, pt, tier in STATCAN_MAP:
            if re.search(pat, t):
                day = dt.date.fromisoformat(x['date'][:10])
                per = (x.get('description') or '').strip() or None
                out.append(row('CA', at(day, 8, 30, TOR), en, pt, 'StatCan', period=per, tier=tier, src='statcan')); break
    return out

def statcan(a, b, fetch): return in_window(parse_statcan(fetch(STATCAN_URL)), a, b)

# ================================================================ bancos centrais
ECB_URL = 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'
BOE_URL = 'https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates'
BOJ_URL = 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm'
BOC_URL = 'https://www.bankofcanada.ca/press/upcoming-events/'

def parse_ecb(h):
    """Dia 2 da reunião de política monetária: decisão 14:15 e coletiva 14:45 (Frankfurt)."""
    out = []
    lines = text_of(h).split('\n')
    for i in range(len(lines) - 1):
        d = re.fullmatch(r'(\d{2})/(\d{2})/(\d{4})', lines[i])
        if d and re.search(r'monetary policy meeting.*\(Day 2\)', lines[i + 1]) and 'non-monetary' not in lines[i + 1]:
            day = dt.date(int(d.group(3)), int(d.group(2)), int(d.group(1)))
            out.append(row('EA', at(day, 14, 15, FRA), 'ECB rate decision', 'Decisão de juros do BCE', 'ECB', tier=3, src='ecb'))
    return out

def parse_boe(h):
    """'2026 confirmed dates' → 'Thursday 5 November'; anúncio da Bank Rate às 12:00 (Londres)."""
    x = text_of(h); out = []
    for m in re.finditer(r'(20\d\d) (?:confirmed|provisional) dates(.*?)(?=20\d\d (?:confirmed|provisional) dates|$)', x, flags=re.S):
        y = int(m.group(1))
        for d, mo in re.findall(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday) (\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)', m.group(2)):
            out.append(row('GB', at(dt.date(y, MONTHS_EN[mo[:3].lower()], int(d)), 12, 0, LON), 'BoE rate decision', 'Decisão de juros do BoE', 'BoE', tier=3, src='boe'))
    return out

def parse_boj(h):
    """Tabela 'Date of MPM' por ano: decisão no último dia da reunião; o BoJ não fixa horário (dia inteiro)."""
    out = []
    for tb in re.findall(r'<table.*?</table>', h, flags=re.S):
        cap = re.search(r'Table\s*:\s*(20\d\d)', htmlmod.unescape(re.sub(r'<[^>]+>', ' ', tb)))
        if not cap: continue
        y = int(cap.group(1))
        for tr in re.findall(r'<tr.*?</tr>', tb, flags=re.S):
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, flags=re.S)
            if not cells: continue
            c0 = re.sub(r'\s+', ' ', htmlmod.unescape(re.sub(r'<[^>]+>', '', cells[0]))).strip()
            m = re.match(r'(Jan|Feb|Mar|Apr|May|June|July|Aug|Sept|Oct|Nov|Dec)\.? (\d{1,2}) \([A-Za-z.]+\)(?:, (\d{1,2}) \([A-Za-z.]+\))?', c0)
            if not m: continue
            day = dt.date(y, MONTHS_EN[m.group(1)[:3].lower()], int(m.group(3) or m.group(2)))
            out.append(row('JP', day, 'BoJ rate decision', 'Decisão de juros do BoJ', 'BoJ', tier=3, src='boj'))
    return out

def parse_boc(h):
    """Links 'interest-rate-announcement-<mês>-<dia>-<ano>' (ou 'announcement-…'); anúncio às 09:45 (Ottawa)."""
    out, seen = [], set()
    for mo, d, y in re.findall(r'announcement-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(20\d\d)', h, flags=re.I):
        day = dt.date(int(y), MONTHS_EN[mo[:3].lower()], int(d))
        if day in seen: continue
        seen.add(day); out.append(row('CA', at(day, 9, 45, TOR), 'BoC rate decision', 'Decisão de juros do BoC', 'BoC', tier=3, src='boc'))
    return out

def ecb(a, b, fetch): return in_window(parse_ecb(fetch(ECB_URL)), a, b)
def boe(a, b, fetch): return in_window(parse_boe(fetch(BOE_URL)), a, b)
def boj(a, b, fetch): return in_window(parse_boj(fetch(BOJ_URL)), a, b)
def boc(a, b, fetch): return in_window(parse_boc(fetch(BOC_URL)), a, b)

# ================================================================ coleta (usada por build_macro.eco)
FRED_DATES_URL = 'https://api.stlouisfed.org/fred/releases/dates'
# fonte → (função, cabeçalhos HTTP, 'json' ou 'text')
# ----- México (INEGI) -----
# Lista anual mantida à mão, copiada só do calendário oficial do INEGI:
# "Calendario de difusión de información estadística y geográfica y de Interés Nacional del INEGI 2026"
# https://www.inegi.org.mx/contenidos/saladeprensa/doc/cal_2026.pdf — "la información se difunde a las 06:00 a.m." (Cidade do México).
# Atualize a cada novo calendário anual (o INEGI publica o do ano seguinte em novembro/dezembro).
MEX = ZoneInfo('America/Mexico_City')
INEGI_2026 = [  # (data, EN, PT, período, importância)
    ('2026-11-09', 'CPI (2nd half-month & monthly)', 'Inflação ao consumidor (2ª quinzena e mensal)', '10/2026', 2),
    ('2026-11-11', 'Industrial production', 'Produção industrial', '09/2026', 1),
    ('2026-11-23', 'GDP (quarterly, revised)', 'PIB trimestral (revisado)', 'Q3/2026', 2),
    ('2026-11-23', 'Economic activity index (IGAE)', 'Índice de atividade econômica (IGAE)', '09/2026', 1),
    ('2026-11-24', 'CPI (1st half-month)', 'Inflação ao consumidor (1ª quinzena)', '11/2026', 2),
    ('2026-11-26', 'Unemployment rate', 'Taxa de desemprego', '10/2026', 1),
    ('2026-11-27', 'Trade balance', 'Balança comercial', '10/2026', 1),
    ('2026-12-09', 'CPI (2nd half-month & monthly)', 'Inflação ao consumidor (2ª quinzena e mensal)', '11/2026', 2),
    ('2026-12-11', 'Industrial production', 'Produção industrial', '10/2026', 1),
    ('2026-12-23', 'Economic activity index (IGAE)', 'Índice de atividade econômica (IGAE)', '10/2026', 1),
    ('2026-12-23', 'CPI (1st half-month)', 'Inflação ao consumidor (1ª quinzena)', '12/2026', 2),
    ('2026-12-23', 'Trade balance', 'Balança comercial', '11/2026', 1),
    ('2026-12-24', 'Unemployment rate', 'Taxa de desemprego', '11/2026', 1),
]

def inegi(a, b, fetch=None):
    out = [row('MX', at(dt.date.fromisoformat(d), 6, 0, MEX), en, pt, 'INEGI', period=per, tier=t, src='inegi') for d, en, pt, per, t in INEGI_2026]
    return in_window(out, a, b)

# ----- China (NBS) -----
# Lista anual mantida à mão, copiada só do calendário oficial "Regular Press Release Calendar of NBS in 2026"
# https://www.stats.gov.cn/english/PressRelease/ReleaseCalendar/202512/t20251226_1962154.html (horário de Pequim;
# "release dates are preliminary and subject to adjustment"). Atualize quando sair o calendário de 2027.
PEK = ZoneInfo('Asia/Shanghai')
NBS_KINDS = {  # chave → (EN, PT, importância, hora, minuto, período = mês anterior?)
    'cpi': ('CPI inflation', 'Inflação ao consumidor (CPI)', 2, 9, 30, True),
    'ppi': ('Producer prices (PPI)', 'Preços ao produtor (PPI)', 1, 9, 30, True),
    'ip': ('Industrial production', 'Produção industrial', 2, 10, 0, True),
    'retail': ('Retail sales', 'Vendas no varejo', 2, 10, 0, True),
    'fai': ('Fixed-asset investment (YTD)', 'Investimento em ativos fixos (acum. no ano)', 1, 10, 0, True),
    'home': ('New home prices (70 cities)', 'Preços de imóveis novos (70 cidades)', 1, 9, 30, True),
    'profits': ('Industrial profits (YTD)', 'Lucros industriais (acum. no ano)', 1, 9, 30, True),
    'pmi': ('Official manufacturing & non-manufacturing PMI', 'PMI oficial da indústria e de não manufatura', 3, 9, 30, False),
}
NBS_2026 = [('2026-11-09', 'cpi'), ('2026-11-09', 'ppi'), ('2026-11-16', 'ip'), ('2026-11-16', 'retail'), ('2026-11-16', 'fai'),
            ('2026-11-16', 'home'), ('2026-11-27', 'profits'), ('2026-11-30', 'pmi'),
            ('2026-12-09', 'cpi'), ('2026-12-09', 'ppi'), ('2026-12-15', 'ip'), ('2026-12-15', 'retail'), ('2026-12-15', 'fai'),
            ('2026-12-15', 'home'), ('2026-12-27', 'profits'), ('2026-12-31', 'pmi')]

def nbs(a, b, fetch=None):
    out = []
    for d, k in NBS_2026:
        en, pt, tier, h, mi, prev = NBS_KINDS[k]; day = dt.date.fromisoformat(d)
        pm = (day.replace(day=1) - dt.timedelta(days=1)) if prev else day
        out.append(row('CN', at(day, h, mi, PEK), en, pt, 'NBS', period=f'{pm.month:02d}/{pm.year}', tier=tier, src='nbs'))
    return in_window(out, a, b)

# ----- Alemanha (Destatis) -----
# Lista mantida à mão, copiada só do Veröffentlichungskalender oficial do Destatis
# (https://www.destatis.de/SiteGlobals/Forms/Suche/Termine/DE/Terminsuche_Formular.html), consultado em 02/11/2026.
# "Die Veröffentlichungen erfolgen in der Regel um 8.00 Uhr" (Berlim) → horário marcado como aproximado.
BER = ZoneInfo('Europe/Berlin')
DESTATIS_2026 = [  # (data, EN, PT, período, importância)
    ('2026-11-02', 'Retail sales', 'Vendas no varejo', '09/2026', 1),
    ('2026-11-05', 'Factory orders', 'Encomendas à indústria', '09/2026', 1),
    ('2026-11-06', 'Industrial production', 'Produção industrial', '09/2026', 2),
    ('2026-11-09', 'Trade balance', 'Balança comercial', '09/2026', 1),
    ('2026-11-11', 'CPI inflation (final)', 'Inflação ao consumidor (final)', '10/2026', 1),
    ('2026-11-20', 'Producer prices (PPI)', 'Preços ao produtor (PPI)', '10/2026', 1),
    ('2026-11-25', 'GDP (detailed results)', 'PIB (resultados detalhados)', 'Q3/2026', 2),
    ('2026-11-30', 'Retail sales', 'Vendas no varejo', '10/2026', 1),
    ('2026-11-30', 'CPI inflation (flash)', 'Inflação ao consumidor (prévia)', '11/2026', 3),
    ('2026-12-07', 'Factory orders', 'Encomendas à indústria', '10/2026', 1),
    ('2026-12-08', 'Industrial production', 'Produção industrial', '10/2026', 2),
    ('2026-12-09', 'Trade balance', 'Balança comercial', '10/2026', 1),
    ('2026-12-10', 'CPI inflation (final)', 'Inflação ao consumidor (final)', '11/2026', 1),
    ('2026-12-18', 'Producer prices (PPI)', 'Preços ao produtor (PPI)', '11/2026', 1),
]

def destatis(a, b, fetch=None):
    out = [row('DE', at(dt.date.fromisoformat(d), 8, 0, BER), en, pt, 'Destatis', period=per, tier=t, approx=True, src='destatis')
           for d, en, pt, per, t in DESTATIS_2026]
    return in_window(out, a, b)

SOURCES = [
    ('bcb', bcb, None, 'text'), ('fgv', fgv, None, 'text'), ('caged', caged, None, 'text'), ('mdic', mdic, None, 'text'),
    ('bls', bls, UA_CONTACT, 'text'), ('eia', eia, None, 'text'), ('umich', umich, None, 'text'), ('treasury', treasury, None, 'json'),
    ('pmi', pmi, UA_BROWSER, 'text'), ('eurostat', eurostat, None, 'text'), ('ons', ons, None, 'json'), ('statcan', statcan, None, 'json'),
    ('ecb', ecb, None, 'text'), ('boe', boe, UA_BROWSER, 'text'), ('boj', boj, None, 'text'), ('boc', boc, UA_BROWSER, 'text'),
    ('inegi', inegi, None, 'text'), ('nbs', nbs, None, 'text'),
    ('destatis', destatis, None, 'text'),
]

def http_fetch(headers, kind, tries=2, timeout=(10, 40)):
    from common import get, UA
    def f(url):
        r = get(url, tries=tries, timeout=timeout, headers=headers or UA)
        if kind == 'json': return r.json()
        try: return r.content.decode('utf-8')
        except UnicodeDecodeError: return r.content.decode('latin1')
    return f

def fred_key_fetch(key):
    """Datas de divulgação pela API oficial do FRED; a chave só vai nos params e nunca aparece em erro/log."""
    import requests
    def f(params):
        try:
            r = requests.get(FRED_DATES_URL, params={**params, 'api_key': key}, timeout=(10, 40))
            if r.status_code != 200: raise RuntimeError(f'HTTP {r.status_code}')
            return r.json()
        except Exception as e:
            raise RuntimeError(f'FRED release dates: {type(e).__name__} {str(e)[:80] if isinstance(e, RuntimeError) else ""}'.strip()) from None
    return f

# Semente versionada (pipeline/data/eco_seed.json) para fontes que recusam os runners do GitHub Actions
# (FGV IBRE: erro de TLS; BLS: HTTP 403). São as linhas já interpretadas dos calendários oficiais, geradas por
# pipeline/refresh_eco_seed.py numa máquina que alcança os sites. Só entra quando a fonte falha.
SEED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'eco_seed.json')

def load_seed(path=SEED_PATH):
    try:
        with open(path, encoding='utf-8') as f: return json.load(f)
    except Exception: return {}

def collect(a, b, prev_events=(), fred_key=None, fetchers=None, sources=SOURCES, seed=None):
    """Roda cada fonte isolada. Falha (ou zero linhas numa fonte que deveria ter algo): status[nome] = 0 e
    reaproveita as linhas anteriores da mesma fonte dentro da janela, completadas pela semente. Devolve (linhas, status)."""
    rows, status = [], {}
    lo, hi = a.isoformat(), b.isoformat()
    seed = load_seed() if seed is None else seed
    def stale(name):
        old = [r for r in prev_events if r.get('src') == name and lo <= r['time'][:10] <= hi]
        if old: status[name + '_stale'] = True
        have = {(r['time'][:10], r['event']) for r in old}
        sd = [r for r in (seed.get(name) or {}).get('rows', []) if lo <= r['time'][:10] <= hi and (r['time'][:10], r['event']) not in have]
        if sd: status[name + '_seed'] = (seed.get(name) or {}).get('fetched_at')
        return old + sd
    for name, fn, headers, kind in sources:
        try:
            fetch = (fetchers or {}).get(name) or http_fetch(headers, kind)
            got = fn(a, b, fetch)
            if not got: raise RuntimeError('nenhum evento na janela')
            rows += got; status[name] = len(got)
        except Exception as e:
            print(f'eco {name}: {str(e)[:200]}'); status[name] = 0; rows += stale(name)
    got = ism_claims(a, b); rows += got; status['rules'] = len(got)
    with_bls = not status.get('bls')
    if fred_key or (fetchers or {}).get('fred'):
        try:
            got = fred_dates(a, b, (fetchers or {}).get('fred') or fred_key_fetch(fred_key), with_bls)
            rows += got; status['fred'] = len(got)
        except Exception as e:
            print(f'eco fred: {str(e)[:120]}'); status['fred'] = 0; rows += stale('fred') + (stale('fred_bls') if with_bls else [])
    else:
        status['fred'] = 0; rows += stale('fred') + (stale('fred_bls') if with_bls else [])
    if with_bls and not any(r.get('src') in ('fred_bls', 'bls') for r in rows): rows += stale('bls')
    return rows, status
