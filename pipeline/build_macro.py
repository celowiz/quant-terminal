"""Macro global (11 funções novas, parte 1): WB, FOMC, WIRP, TAYL, ECO, FXFC, FXC e GMM.
Fontes públicas e gratuitas, sem chave de API:
- Títulos soberanos (WB): FRED (Treasuries, OECD mensal), Bank of Canada Valet, Bundesbank (BBSIS), Bank of England (IADB),
  Reserve Bank of Australia (F2), Ministry of Finance Japan (JGB), ANBIMA (taxas indicativas de LTN/NTN-F).
- Bancos centrais (FOMC/WIRP/TAYL): federalreserve.gov (calendário do FOMC), FRED (DFEDTARU/L, DFF, FEDFUNDS, PCE, NROU, GDPPOT...),
  Yahoo Finance (futuros de Fed Funds ZQ, CBOT), BCB (histórico de metas do Copom, calendário, SGS, Focus/Olinda), cdie.json (DI1 B3).
- Calendário (ECO): IBGE (API de calendário), BEA (ICS), Census (indicadores econômicos), SIDRA/SGS/FRED (realizado), Focus (consenso).
Cada etapa é independente e mantém o JSON anterior se a fonte falhar."""
import io, re, sys, os, json, math, datetime as dt, urllib.parse, html as htmlmod
from zoneinfo import ZoneInfo
import pandas as pd
from common import save, get, get_json, load_prev, clean, step, now_iso, today_brt, cached, OUT, TZ

TODAY = today_brt()
NY = ZoneInfo('America/New_York')
OL = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/'

def load_out(rel):
    p = os.path.join(OUT, rel)
    if not os.path.exists(p): return None
    with open(p, encoding='utf-8') as f: return json.load(f)

def fred(ids, start='2000-01-01'):
    cols = {}
    for i in ids:
        try:
            r = get(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={i}&cosd={start}')
            df = pd.read_csv(io.StringIO(r.text), na_values=['.'])
            cols[i] = pd.Series(pd.to_numeric(df.iloc[:, 1], errors='coerce').values, index=pd.to_datetime(df.iloc[:, 0])).dropna()
        except Exception as e: print('fred', i, e)
    return cols

def pts(s, nd=3):
    return [[i.strftime('%Y-%m-%d'), clean(v, nd)] for i, v in s.items() if clean(v, nd) is not None]

# =====================================================================================
# WB – mercados de títulos soberanos
# =====================================================================================
def parse_anbima(txt):
    """Arquivo diário de mercado secundário de títulos públicos da ANBIMA (msAAMMDD.txt, separador @, decimal vírgula)."""
    rows = []
    for ln in txt.splitlines():
        p = ln.strip().split('@')
        if len(p) < 9 or p[0] not in ('LTN', 'NTN-F', 'NTN-B', 'LFT', 'NTN-C'): continue
        f = lambda x: None if x.strip() in ('', '--', 'N/D') else float(x.replace('.', '').replace(',', '.')) if x.count(',') else float(x)
        try:
            rows.append({'bond': p[0], 'ref': dt.datetime.strptime(p[1], '%Y%m%d').date().isoformat(), 'selic_code': p[2],
                         'issue': dt.datetime.strptime(p[3], '%Y%m%d').date().isoformat(), 'maturity': dt.datetime.strptime(p[4], '%Y%m%d').date().isoformat(),
                         'bid': f(p[5]), 'ask': f(p[6]), 'rate': f(p[7]), 'pu': f(p[8])})
        except Exception: continue
    return rows

def anbima_day(d):
    from build_rates import is_bd
    if not is_bd(d): return None
    name = f'ms{d:%y%m%d}.txt'
    p = os.path.join(os.environ.get('QT_CACHE', '/tmp/qt_cache'), 'anbima_' + name)
    if os.path.exists(p) and os.path.getsize(p) > 500:
        return parse_anbima(open(p, encoding='latin1').read())
    try:
        r = get(f'https://www.anbima.com.br/informacoes/merc-sec/arqs/{name}', tries=1, timeout=30)
    except Exception:
        return None
    txt = r.content.decode('latin1')
    rows = parse_anbima(txt)
    if rows: open(p, 'w', encoding='latin1').write(txt)
    return rows

def anbima_history(n_bd=12, max_days=18):
    """A ANBIMA só mantém ~2 semanas de arquivos diários públicos; o histórico mais longo é acumulado no wb.json."""
    out = {}; d = TODAY; k = 0
    while len(out) < n_bd and k < max_days:
        r = anbima_day(d)
        if r: out[d.isoformat()] = r
        d -= dt.timedelta(days=1); k += 1
    return dict(sorted(out.items()))

def interp(xs, ys, x):
    """Interpolação linear (sem extrapolar além de 1 ano das pontas)."""
    if not xs: return None
    if x < xs[0] - 1 or x > xs[-1] + 1: return None
    if x <= xs[0]: return ys[0]
    if x >= xs[-1]: return ys[-1]
    for i in range(1, len(xs)):
        if x <= xs[i]:
            w = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + w * (ys[i] - ys[i - 1])

def br_pre_tenor(rows, years):
    """Taxa prefixada (LTN/NTN-F, taxa indicativa ANBIMA) interpolada no prazo em anos corridos."""
    q = sorted([((dt.date.fromisoformat(r['maturity']) - dt.date.fromisoformat(r['ref'])).days / 365.25, r['rate'])
                for r in rows if r['bond'] in ('LTN', 'NTN-F') and r['rate'] is not None])
    return interp([a for a, _ in q], [b for _, b in q], years)

TENORS = ['2Y', '5Y', '10Y', '30Y']
OECD = [('FR', 'France', 'IRLTLT01FRM156N'), ('IT', 'Italy', 'IRLTLT01ITM156N'), ('ES', 'Spain', 'IRLTLT01ESM156N'), ('NL', 'Netherlands', 'IRLTLT01NLM156N'),
        ('PT', 'Portugal', 'IRLTLT01PTM156N'), ('GR', 'Greece', 'IRLTLT01GRM156N'), ('BE', 'Belgium', 'IRLTLT01BEM156N'), ('AT', 'Austria', 'IRLTLT01ATM156N'),
        ('IE', 'Ireland', 'IRLTLT01IEM156N'), ('SE', 'Sweden', 'IRLTLT01SEM156N'), ('CH', 'Switzerland', 'IRLTLT01CHM156N'), ('NO', 'Norway', 'IRLTLT01NOM156N'),
        ('DK', 'Denmark', 'IRLTLT01DKM156N'), ('PL', 'Poland', 'IRLTLT01PLM156N'), ('CZ', 'Czechia', 'IRLTLT01CZM156N'), ('HU', 'Hungary', 'IRLTLT01HUM156N'),
        ('MX', 'Mexico', 'IRLTLT01MXM156N'), ('CL', 'Chile', 'IRLTLT01CLM156N'), ('CO', 'Colombia', 'IRLTLT01COM156N'), ('ZA', 'South Africa', 'IRLTLT01ZAM156N'),
        ('KR', 'South Korea', 'IRLTLT01KRM156N'), ('NZ', 'New Zealand', 'IRLTLT01NZM156N'), ('IL', 'Israel', 'IRLTLT01ILM156N'), ('IN', 'India', 'INDIRLTLT01STM')]
REGION = {'US': 'Americas', 'CA': 'Americas', 'BR': 'Americas', 'MX': 'Americas', 'CL': 'Americas', 'CO': 'Americas',
          'JP': 'Asia/Pacific', 'AU': 'Asia/Pacific', 'NZ': 'Asia/Pacific', 'KR': 'Asia/Pacific', 'IN': 'Asia/Pacific'}

def series_stats(s, freq):
    """s: pd.Series diária ou mensal (índice datetime). Variações em pb."""
    s = s.dropna()
    if not len(s): return None
    last = float(s.iloc[-1]); d0 = s.index[-1]
    def at(days):
        q = s[s.index <= d0 - pd.Timedelta(days=days)]; return float(q.iloc[-1]) if len(q) else None
    bp = lambda b: clean((last - b) * 100, 1) if b is not None else None
    w3 = s[s.index > d0 - pd.Timedelta(days=92)]
    ytd = s[s.index < pd.Timestamp(d0.year, 1, 1)]
    return {'date': d0.strftime('%Y-%m-%d'), 'freq': freq, 'yld': clean(last, 3),
            'd1': bp(float(s.iloc[-2])) if freq == 'D' and len(s) > 1 else None, 'w1': bp(at(7)) if freq == 'D' else None,
            'm1': bp(at(30)), 'm3': bp(at(91)), 'ytd': bp(float(ytd.iloc[-1]) if len(ytd) else None), 'y1': bp(at(365)),
            'lo3m': clean(w3.min(), 3), 'hi3m': clean(w3.max(), 3), 'avg3m': clean(w3.mean(), 3),
            'spark': [clean(v, 3) for v in (s.tail(66) if freq == 'D' else s.tail(24)).values]}

def wb():
    start = (TODAY - dt.timedelta(days=760)).isoformat()
    br_hist = None
    countries = []  # {cc, name, region, src, tenors: {T: stats + series}}
    def add(cc, name, src, ser, freq):
        ten = {}
        for t, s in ser.items():
            if s is None or not len(s.dropna()): continue
            st = series_stats(s, freq)
            if st: st['series'] = pts(s.dropna()[s.dropna().index >= pd.Timestamp(TODAY - dt.timedelta(days=400))]); ten[t] = st
        if ten: countries.append({'cc': cc, 'name': name, 'region': REGION.get(cc, 'EMEA'), 'source': src, 'tenors': ten})
    # EUA (FRED, diário)
    f = fred(['DGS2', 'DGS5', 'DGS10', 'DGS30'], start)
    add('US', 'United States', 'FRED – US Treasury constant maturity (H.15)', {'2Y': f.get('DGS2'), '5Y': f.get('DGS5'), '10Y': f.get('DGS10'), '30Y': f.get('DGS30')}, 'D')
    # Canadá (BoC Valet)
    try:
        ids = {'2Y': 'BD.CDN.2YR.DQ.YLD', '5Y': 'BD.CDN.5YR.DQ.YLD', '10Y': 'BD.CDN.10YR.DQ.YLD', '30Y': 'BD.CDN.LONG.DQ.YLD'}
        d = get_json(f"https://www.bankofcanada.ca/valet/observations/{','.join(ids.values())}/json?start_date={start}")['observations']
        ser = {t: pd.Series({pd.Timestamp(o['d']): float(o[i]['v']) for o in d if i in o and o[i].get('v') not in (None, '')}) for t, i in ids.items()}
        add('CA', 'Canada', 'Bank of Canada – Valet API (benchmark bond yields; 30Y = long-term benchmark)', ser, 'D')
    except Exception as e: print('wb CA', e)
    # Alemanha (Bundesbank – curva de juros dos títulos federais)
    try:
        ser = {}
        for t, k in [('2Y', 'R02XX'), ('5Y', 'R05XX'), ('10Y', 'R10XX'), ('30Y', 'R30XX')]:
            r = get(f'https://api.statistiken.bundesbank.de/rest/data/BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.{k}.R.A.A._Z._Z.A?format=csv&startPeriod={start}')
            vals = {}
            for ln in r.text.splitlines():
                m = re.match(r'^(\d{4}-\d\d-\d\d);(-?\d+(?:,\d+)?);', ln)
                if m: vals[pd.Timestamp(m.group(1))] = float(m.group(2).replace(',', '.'))
            ser[t] = pd.Series(vals)
        add('DE', 'Germany', 'Deutsche Bundesbank – yields on Federal securities derived from the term structure (BBSIS)', ser, 'D')
    except Exception as e: print('wb DE', e)
    # Reino Unido (BoE – curva nominal zero-cupom)
    try:
        a = (TODAY - dt.timedelta(days=760)).strftime('%d/%b/%Y')
        r = get(f'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom={a}&Dateto=now'
                '&SeriesCodes=IUDSNZC,IUDMNZC&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N')
        df = pd.read_csv(io.StringIO(r.text)); df['DATE'] = pd.to_datetime(df['DATE'], format='%d %b %Y')
        df = df.set_index('DATE')
        add('GB', 'United Kingdom', 'Bank of England – nominal zero-coupon gilt yields (5Y, 10Y)',
            {'5Y': df['IUDSNZC'], '10Y': df['IUDMNZC']}, 'D')
    except Exception as e: print('wb GB', e)
    # Japão (MoF)
    try:
        frames = []
        for u in ['https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv',
                  'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv']:
            r = get(u); txt = r.content.decode('utf-8', 'ignore').splitlines()
            df = pd.read_csv(io.StringIO('\n'.join(txt[1:])), na_values=['-']).dropna(subset=['Date'])
            df = df[df['Date'].astype(str).str.match(r'^\d{4}/\d{1,2}/\d{1,2}$')]
            df['Date'] = pd.to_datetime(df['Date'], format='%Y/%m/%d'); frames.append(df.set_index('Date'))
        df = pd.concat(frames); df = df[~df.index.duplicated(keep='last')].sort_index()
        df = df[df.index >= pd.Timestamp(start)].apply(pd.to_numeric, errors='coerce')
        add('JP', 'Japan', 'Ministry of Finance Japan – JGB interest rates (constant maturity)', {t: df[t] for t in TENORS if t in df}, 'D')
    except Exception as e: print('wb JP', e)
    # Austrália (RBA F2)
    try:
        r = get('https://www.rba.gov.au/statistics/tables/csv/f2-data.csv'); L = r.content.decode('utf-8', 'ignore').splitlines()
        hi = next(i for i, l in enumerate(L) if l.startswith('Series ID'))
        df = pd.read_csv(io.StringIO('\n'.join([L[hi]] + L[hi + 1:])))
        df['Series ID'] = pd.to_datetime(df['Series ID'], format='%d-%b-%Y', errors='coerce'); df = df.dropna(subset=['Series ID']).set_index('Series ID')
        df = df[df.index >= pd.Timestamp(start)].apply(pd.to_numeric, errors='coerce')
        add('AU', 'Australia', 'Reserve Bank of Australia – F2 government bond yields (interpolated)', {'2Y': df['FCMYGBAG2D'], '5Y': df['FCMYGBAG5D'], '10Y': df['FCMYGBAG10D']}, 'D')
    except Exception as e: print('wb AU', e)
    # Brasil (ANBIMA – LTN/NTN-F indicativas, interpoladas no prazo)
    try:
        h = anbima_history()
        acc = ((load_prev('wb.json') or {}).get('br_hist') or {})
        for d, rows in h.items(): acc[d] = {t: clean(br_pre_tenor(rows, y), 4) for t, y in [('2Y', 2), ('5Y', 5), ('10Y', 10)]}
        acc = {d: v for d, v in sorted(acc.items()) if d >= (TODAY - dt.timedelta(days=760)).isoformat()}
        br_hist = acc
        ser = {t: pd.Series({pd.Timestamp(d): v.get(t) for d, v in acc.items()}, dtype=float) for t in ('2Y', '5Y', '10Y')}
        add('BR', 'Brazil (local, BRL)', 'ANBIMA – indicative rates of LTN/NTN-F (fixed-rate federal bonds), linearly interpolated by maturity', ser, 'D')
    except Exception as e: print('wb BR', e)
    # Demais países: OECD (FRED), mensal
    try:
        f = fred([i for _, _, i in OECD], (TODAY - dt.timedelta(days=900)).isoformat())
        for cc, name, i in OECD:
            if i in f: add(cc, name, f'OECD Main Economic Indicators via FRED ({i}) – long-term government bond yield, monthly average', {'10Y': f[i]}, 'M')
    except Exception as e: print('wb OECD', e)
    if len(countries) < 5: raise RuntimeError(f'só {len(countries)} países')
    save('wb.json', {'generated_at': now_iso(), 'tenors': TENORS, 'countries': countries, 'br_hist': br_hist or (load_prev('wb.json') or {}).get('br_hist'),
                     'note': 'Daily series where the central bank / treasury publishes them; OECD rows are monthly averages (1D/1W blank). '
                             'Brazil = local-currency fixed-rate curve (ANBIMA), not USD bonds.',
                     'source': 'FRED, Bank of Canada, Deutsche Bundesbank, Bank of England, MoF Japan, RBA, ANBIMA, OECD (via FRED)'})

# =====================================================================================
# FOMC / Copom – datas e decisões
# =====================================================================================
MONTHS_EN = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}

def parse_fomc_calendar(h):
    """Página federalreserve.gov/monetarypolicy/fomccalendars.htm → [{start, decision, sep, note}]."""
    out = []
    for m in re.finditer(r'<h4><a id="[^"]*">(\d{4}) FOMC Meetings</a></h4>', h):
        y = int(m.group(1)); nxt = h.find('FOMC Meetings</a></h4>', m.end()); blk = h[m.end(): nxt if nxt > 0 else len(h)]
        for r in re.finditer(r'fomc-meeting__month[^>]*>\s*<strong>([^<]+)</strong>.*?fomc-meeting__date[^>]*>([^<]+)<', blk, re.S):
            mon, dd = r.group(1).strip(), htmlmod.unescape(r.group(2)).strip()
            mons = [MONTHS_EN.get(x.strip()[:3].lower()) for x in mon.split('/')]
            if not mons[0]: continue
            note = ''
            if '(' in dd: note = dd[dd.index('(') + 1:].rstrip(')').strip(); dd = dd[:dd.index('(')].strip()
            sep = dd.endswith('*'); dd = dd.rstrip('*').strip()
            days = [int(x) for x in re.findall(r'\d+', dd)]
            if not days: continue
            m1 = mons[0]; m2 = mons[-1] if len(mons) > 1 else m1
            if len(days) > 1 and days[-1] >= days[0]: m2 = m1   # 'Apr/May 28-29' = 28 e 29 de abril; 'Apr/May 30-1' cruza o mês
            a = dt.date(y, m1, days[0]); b = dt.date(y, m2, days[-1]) if len(days) > 1 else a
            if b < a: b = dt.date(y + 1, m2, days[-1])
            out.append({'start': a.isoformat(), 'decision': b.isoformat(), 'sep': sep, 'note': note})
    out.sort(key=lambda x: x['decision'])
    return out

def step_changes(s):
    """Série diária de meta → lista de (data_efetiva, antes, depois)."""
    s = s.dropna(); out = []
    prev = None
    for d, v in s.items():
        if prev is not None and abs(v - prev) > 1e-9: out.append((d.date(), prev, float(v)))
        prev = float(v)
    return out

def fomc_decisions(meets, upper, lower):
    """Associa a cada reunião passada a mudança da meta (efetiva até 7 dias após a decisão)."""
    ch = step_changes(upper)
    out = []
    for mt in meets:
        d = dt.date.fromisoformat(mt['decision']); r = dict(mt)
        if d <= TODAY and len(upper):
            after_u = upper[upper.index <= pd.Timestamp(d + dt.timedelta(days=7))]
            before_u = upper[upper.index < pd.Timestamp(dt.date.fromisoformat(mt['start']))]
            after_l = lower[lower.index <= pd.Timestamp(d + dt.timedelta(days=7))]
            if len(after_u) and len(before_u) and after_u.index[-1] >= pd.Timestamp(d):
                u1, u0 = float(after_u.iloc[-1]), float(before_u.iloc[-1])
                r.update({'decided': True, 'upper': u1, 'lower': float(after_l.iloc[-1]) if len(after_l) else None, 'change_bp': round((u1 - u0) * 100)})
            else: r['decided'] = d < TODAY
        else: r['decided'] = False
        out.append(r)
    # mudanças fora de reuniões agendadas (ex.: 2020) entram como "unscheduled"
    sched = {mt['decision'] for mt in meets}
    for d, a, b in ch:
        if not any(abs((d - dt.date.fromisoformat(x)).days) <= 7 for x in sched) and str(d) >= (meets[0]['start'] if meets else '9999'):
            out.append({'start': d.isoformat(), 'decision': d.isoformat(), 'sep': False, 'note': 'unscheduled (rate change)', 'decided': True,
                        'upper': b, 'lower': None, 'change_bp': round((b - a) * 100)})
    out.sort(key=lambda x: x['decision'])
    return out

def copom_history():
    d = get_json('https://www.bcb.gov.br/api/servico/sitebcb/historicotaxasjuros')['conteudo']
    out = []
    for r in d:
        dd = dt.datetime.fromisoformat(r['DataReuniaoCopom'].replace('Z', '+00:00')).astimezone(TZ).date()
        out.append({'n': int(r['NumeroReuniaoCopom']), 'decision': dd.isoformat(), 'selic': r['MetaSelic'], 'extra': bool(r.get('ReuniaoExtraordinaria')),
                    'bias': None if r.get('Vies') in (None, 'n/a') else r['Vies']})
    out.sort(key=lambda x: (x['decision'], x['n']))
    for i, r in enumerate(out):
        r['change_bp'] = round((r['selic'] - out[i - 1]['selic']) * 100) if i and r['selic'] is not None and out[i - 1]['selic'] is not None else None
    return out

def fomc():
    from build_rates import copom_calendar
    h = get('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm').text
    meets = [m for m in parse_fomc_calendar(h) if m['decision'] >= '2021-01-01']
    if len(meets) < 8: raise RuntimeError('calendário do FOMC não reconhecido')
    f = fred(['DFEDTARU', 'DFEDTARL', 'DFF'], '2020-06-01')
    fed = fomc_decisions(meets, f.get('DFEDTARU', pd.Series(dtype=float)), f.get('DFEDTARL', pd.Series(dtype=float)))
    out = {'generated_at': now_iso(), 'fed': {'meetings': fed, 'target_upper': clean(f['DFEDTARU'].iloc[-1], 2) if 'DFEDTARU' in f else None,
                                               'target_lower': clean(f['DFEDTARL'].iloc[-1], 2) if 'DFEDTARL' in f else None,
                                               'effr': clean(f['DFF'].iloc[-1], 2) if 'DFF' in f else None,
                                               'effr_date': f['DFF'].index[-1].strftime('%Y-%m-%d') if 'DFF' in f else None,
                                               'target_series': pts(f['DFEDTARU'][f['DFEDTARU'].index >= pd.Timestamp('2021-01-01')].resample('W').last().dropna(), 2) if 'DFEDTARU' in f else []}}
    try:
        hist = copom_history()
        cal = copom_calendar(TODAY.year - 1, TODAY.year + 1)
        past = {r['decision']: r for r in hist}
        rows = [dict(r, decided=True, start=None, label=None) for r in hist if r['decision'] >= '2021-01-01']
        for c in cal:
            if c['decision'] in past:
                for r in rows:
                    if r['decision'] == c['decision']: r['start'] = c['start']; r['label'] = c['label']
            elif c['decision'] >= TODAY.isoformat():
                rows.append({'n': None, 'decision': c['decision'], 'start': c['start'], 'label': c['label'], 'selic': None, 'change_bp': None, 'decided': False, 'extra': False})
        rows.sort(key=lambda x: x['decision'])
        out['copom'] = {'meetings': rows, 'selic': hist[-1]['selic'], 'selic_date': hist[-1]['decision']}
    except Exception as e:
        print('copom', e); prev = load_prev('fomc.json') or {}
        if prev.get('copom'): out['copom'] = prev['copom']
    out['source'] = ('Federal Reserve – FOMC meeting calendar (federalreserve.gov); FRED DFEDTARU/DFEDTARL (target range), DFF (effective rate); '
                     'BCB – Copom rate history and meeting calendar (bcb.gov.br)')
    save('fomc.json', out)

# =====================================================================================
# WIRP – probabilidades implícitas por reunião
# =====================================================================================
def move_probs(move_bp, step_bp=25.0):
    """Converte movimento implícito (pb) em probabilidades entre os dois múltiplos de 25 pb adjacentes.
    Ex.: −37 pb → 52% de −25 pb e 48% de −50 pb."""
    if move_bp is None: return []
    lo = math.floor(move_bp / step_bp) * step_bp; hi = lo + step_bp
    p_hi = (move_bp - lo) / step_bp
    out = [{'move_bp': round(lo), 'prob': round((1 - p_hi) * 100, 1)}, {'move_bp': round(hi), 'prob': round(p_hi * 100, 1)}]
    return [o for o in out if o['prob'] > 0.05]

ZQ_MONTHS = 'FGHJKMNQUVXZ'
def zq_ticker(y, m): return f'ZQ{ZQ_MONTHS[m - 1]}{y % 100:02d}.CBT'

def days_in_month(y, m): return ((dt.date(y + (m == 12), m % 12 + 1, 1)) - dt.date(y, m, 1)).days

def fed_implied(meetings, avg_rate, effr0):
    """Método dos futuros de Fed Funds (como no CME FedWatch, simplificado):
    avg_rate: {(ano, mês): média implícita da EFFR no mês = 100 − preço}.
    Para cada reunião, taxa pós-reunião = média do mês seguinte (se ele não tem reunião) ou
    (média_mês·N − taxa_pré·d) / (N − d), com d = dias do mês antes da vigência (dia seguinte à decisão)."""
    months_with = {(dt.date.fromisoformat(m).year, dt.date.fromisoformat(m).month) for m in meetings}
    out = []; pre = effr0
    for ms in meetings:
        d = dt.date.fromisoformat(ms); y, m = d.year, d.month
        N = days_in_month(y, m); k = d.day  # vigência no dia seguinte: d dias à taxa anterior
        nxt = (y + (m == 12), m % 12 + 1)
        post, how = None, None
        if nxt not in months_with and nxt in avg_rate: post, how = avg_rate[nxt], zq_ticker(*nxt)
        elif (y, m) in avg_rate and N - k > 0: post, how = (avg_rate[(y, m)] * N - pre * k) / (N - k), zq_ticker(y, m)
        if post is None: break
        mv = (post - pre) * 100; cum = (post - effr0) * 100
        out.append({'decision': ms, 'contract': how, 'implied': round(post, 4), 'move_bp': round(mv, 1), 'cum_bp': round(cum, 1),
                    'n_moves': round(cum / 25, 3), 'pct_move': round(mv / 25 * 100, 1), 'probs': move_probs(mv)})
        pre = post
    return out

def wirp():
    out = {'generated_at': now_iso()}
    cd = load_out('cdie.json')
    if cd and cd.get('path'):
        meet = []
        for p in cd['path']:
            meet.append({'label': p['label'], 'decision': p['decision'], 'contract': p.get('contract'), 'implied_cdi': p.get('cdi'), 'implied': p.get('selic'),
                         'move_bp': p.get('move_bp'), 'cum_bp': p.get('cum_bp'), 'n_moves': round(p['cum_bp'] / 25, 3) if p.get('cum_bp') is not None else None,
                         'pct_move': round(p['move_bp'] / 25 * 100, 1) if p.get('move_bp') is not None else None, 'probs': move_probs(p.get('move_bp')),
                         'focus': (p.get('focus') or {}).get('median')})
        out['br'] = {'ref_date': cd['ref_date'], 'target': cd.get('selic'), 'effective': cd.get('cdi'), 'meetings': meet,
                     'history': [{'date': h['date'], 'next': h.get('next'), 'next_move_bp': h.get('next_move_bp'), 'cum_12m_bp': h.get('cum_12m_bp')} for h in cd.get('history', [])],
                     'instrument': 'DI1 futures (B3)', 'source': 'B3 DI1 settlement rates → flat-forward CDI per Copom meeting (cdie.json); Selic = CDI + spread (Selic − CDI today)'}
    # EUA: futuros de Fed Funds (Yahoo, CBOT ZQ)
    try:
        import yfinance as yf
        fm = load_out('fomc.json') or {}
        meets = [m['decision'] for m in (fm.get('fed') or {}).get('meetings', []) if m['decision'] >= TODAY.isoformat()][:8]
        if not meets: raise RuntimeError('sem calendário do FOMC (fomc.json)')
        tick = []; y, m = TODAY.year, TODAY.month
        for _ in range(16): tick.append(zq_ticker(y, m)); y, m = y + (m == 12), m % 12 + 1
        raw = yf.download(tick, period='10d', auto_adjust=False, progress=False, group_by='ticker')
        avg, px, asof = {}, [], None
        for t in tick:
            try: c = raw[t]['Close'].dropna()
            except Exception: continue
            if not len(c): continue
            mm = ZQ_MONTHS.index(t[2]) + 1; yy = 2000 + int(t[3:5])
            avg[(yy, mm)] = 100 - float(c.iloc[-1]); asof = max(asof or c.index[-1], c.index[-1])
            px.append({'ticker': t, 'month': f'{yy}-{mm:02d}', 'price': clean(c.iloc[-1], 4), 'implied': clean(100 - float(c.iloc[-1]), 4), 'date': c.index[-1].strftime('%Y-%m-%d')})
        if len(avg) < 4: raise RuntimeError(f'só {len(avg)} contratos ZQ')
        effr = (fm.get('fed') or {}).get('effr')
        # taxa de partida: média implícita do mês corrente se não há reunião nele; senão EFFR publicada
        cur = (TODAY.year, TODAY.month)
        has_meet_now = any(dt.date.fromisoformat(x).month == TODAY.month and dt.date.fromisoformat(x).year == TODAY.year for x in meets)
        effr0 = effr if (has_meet_now or cur not in avg) else avg[cur]
        out['us'] = {'ref_date': asof.strftime('%Y-%m-%d') if asof is not None else None, 'target_lower': fm['fed'].get('target_lower'), 'target_upper': fm['fed'].get('target_upper'),
                     'effective': effr, 'start_rate': round(effr0, 4) if effr0 is not None else None, 'meetings': fed_implied(meets, avg, effr0), 'contracts': px,
                     'instrument': '30-day Fed Funds futures (CBOT ZQ)', 'source': 'Yahoo Finance (ZQ contracts, delayed daily close); FRED DFF; federalreserve.gov FOMC calendar'}
    except Exception as e:
        print('wirp us', e)
    if not out.get('br') and not out.get('us'): raise RuntimeError('sem dados para WIRP')
    out['method'] = ('Implied move per meeting = change in the implied overnight rate after the meeting. Probabilities split the move between the two adjacent '
                     '25 bp outcomes (e.g. −37 bp → 52% −25 bp / 48% −50 bp). #moves = cumulative move ÷ 25 bp. Risk premia are ignored.')
    save('wirp.json', out)

# =====================================================================================
# TAYL – regra de Taylor (dados; o cálculo com parâmetros fica no cliente)
# =====================================================================================
CMN_TARGET = {2005: 4.5, 2006: 4.5, 2007: 4.5, 2008: 4.5, 2009: 4.5, 2010: 4.5, 2011: 4.5, 2012: 4.5, 2013: 4.5, 2014: 4.5, 2015: 4.5, 2016: 4.5,
              2017: 4.5, 2018: 4.5, 2019: 4.25, 2020: 4.0, 2021: 3.75, 2022: 3.5, 2023: 3.25, 2024: 3.0}

def br_target(y): return CMN_TARGET.get(y, 3.0 if y > 2024 else None)

def monthly(s, how='last'):
    s = s.dropna()
    if not len(s): return s
    r = s.resample('MS')
    return r.last() if how == 'last' else r.mean()

def yoy(s):
    s = s.dropna(); return (s / s.shift(12) - 1) * 100

def frame_rows(cols):
    df = pd.DataFrame(cols).sort_index()
    return [{'date': i.strftime('%Y-%m'), **{k: clean(v, 3) for k, v in r.items()}} for i, r in df.iterrows()]

def tayl():
    from build_markets import sgs
    out = {'generated_at': now_iso()}
    f = fred(['FEDFUNDS', 'DFEDTARU', 'PCEPILFE', 'CPIAUCSL', 'UNRATE', 'NROU', 'GDPC1', 'GDPPOT', 'FEDTARMDLR'], '1999-01-01')
    if 'FEDFUNDS' in f:
        q = lambda k: f[k].resample('MS').ffill() if k in f else pd.Series(dtype=float)
        gap = ((f['GDPC1'] / f['GDPPOT'].reindex(f['GDPC1'].index) - 1) * 100).dropna() if 'GDPC1' in f and 'GDPPOT' in f else pd.Series(dtype=float)
        rows = frame_rows({'rate': f['FEDFUNDS'], 'core_pce': yoy(f['PCEPILFE']) if 'PCEPILFE' in f else None, 'cpi': yoy(f['CPIAUCSL']) if 'CPIAUCSL' in f else None,
                           'unemp': f.get('UNRATE'), 'nairu': q('NROU').reindex(f['FEDFUNDS'].index).ffill() if 'NROU' in f else None,
                           'gap': gap.resample('MS').ffill().reindex(f['FEDFUNDS'].index).ffill() if len(gap) else None})
        rows = [r for r in rows if r['date'] >= '2000-01']
        lr = f.get('FEDTARMDLR')
        out['us'] = {'rows': rows, 'policy_now': clean(f['DFEDTARU'].iloc[-1], 2) if 'DFEDTARU' in f else None,
                     'policy_now_lower': None, 'pi_target': 2.0, 'longrun_ffr': clean(lr.iloc[-1], 3) if lr is not None and len(lr) else None,
                     'longrun_date': lr.index[-1].strftime('%Y-%m-%d') if lr is not None and len(lr) else None,
                     'source': 'FRED: FEDFUNDS (effective, monthly avg), DFEDTARU (target upper), PCEPILFE (core PCE), CPIAUCSL, UNRATE, NROU (CBO NAIRU), GDPC1/GDPPOT (CBO output gap), FEDTARMDLR (FOMC SEP longer-run median)'}
    try:
        st = dt.date(2001, 1, 1)
        sel = pd.Series({pd.Timestamp(d): v for d, v in sgs(432, st) if d <= TODAY})
        ipca12 = pd.Series({pd.Timestamp(d): v for d, v in sgs(13522, st)})
        un = pd.Series({pd.Timestamp(d): v for d, v in sgs(24369, dt.date(2012, 1, 1))})
        # Focus: IPCA esperado 12 meses à frente (suavizado), média mensal das medianas diárias
        u = (OL + 'ExpectativasMercadoInflacao12Meses?' + urllib.parse.urlencode({'$top': 10000, '$format': 'json', '$orderby': 'Data desc',
             '$filter': "Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '2005-01-01'", '$select': 'Data,Mediana'}, quote_via=urllib.parse.quote))
        ex = pd.Series({pd.Timestamp(r['Data']): r['Mediana'] for r in get_json(u)['value']}).sort_index()
        rows = frame_rows({'rate': monthly(sel), 'ipca12': ipca12.resample('MS').last(), 'exp12': monthly(ex, 'mean'), 'unemp': un.resample('MS').last()})
        for r in rows: r['target'] = br_target(int(r['date'][:4]))
        rows = [r for r in rows if r['date'] >= '2005-01']
        fo = load_out('focus.json') or {}
        lr = {}
        for ind in ('Selic', 'IPCA'):
            snap = ((fo.get('indicators') or {}).get(ind) or {}).get('snap') or {}
            if snap:
                y = max(snap); lr[ind] = {'year': y, 'median': snap[y].get('median')}
        rstar = clean(lr['Selic']['median'] - lr['IPCA']['median'], 2) if lr.get('Selic') and lr.get('IPCA') and lr['Selic']['median'] is not None and lr['IPCA']['median'] is not None else None
        out['br'] = {'rows': rows, 'policy_now': clean(sel.iloc[-1], 2), 'pi_target': 3.0, 'focus_longrun': lr, 'rstar_focus': rstar,
                     'source': 'BCB SGS 432 (Selic target), 13522 (IPCA 12m), 24369 (PNAD unemployment); Focus/Olinda (IPCA expected 12m ahead, smoothed; long-run Selic and IPCA); CMN inflation targets'}
    except Exception as e:
        print('tayl br', e)
    nxt = {}
    fm = load_out('fomc.json') or {}
    fu = [m for m in (fm.get('fed') or {}).get('meetings', []) if m['decision'] >= TODAY.isoformat()]
    cu = [m for m in (fm.get('copom') or {}).get('meetings', []) if m['decision'] >= TODAY.isoformat()]
    cd = load_out('cdie.json') or {}
    if fu and 'us' in out: out['us']['next_meeting'] = fu[0]['decision']
    if cu and 'br' in out:
        out['br']['next_meeting'] = cu[0]['decision']
        p = next((p for p in cd.get('path', []) if p['decision'] == cu[0]['decision']), None)
        if p and p.get('focus'): out['br']['survey'] = {'median': p['focus'].get('median'), 'date': p['focus'].get('date'), 'n': p['focus'].get('n')}
    if 'us' not in out and 'br' not in out: raise RuntimeError('sem dados')
    out['method'] = ('Taylor = r* + π + α·(π − π*) + β·gap. Gap = output gap (US, CBO) or Okun × (NAIRU − unemployment). '
                     'With inertia ρ: rate = ρ·previous policy rate + (1 − ρ)·Taylor. Parameters are user inputs; defaults follow Taylor (1993): α = β = 0.5.')
    save('tayl.json', out)

# =====================================================================================
# ECO – calendário econômico (BR: IBGE + BCB; EUA: BEA + Census + FOMC)
# =====================================================================================
IBGE_MAP = [  # (regex no título, id da série, descrição em inglês, unidade, fonte)
    (r'Amplo 15', 'ipca15', 'IPCA-15 MoM', '%'),
    (r'Pre[çc]os ao Consumidor Amplo$', 'ipca', 'IPCA MoM', '%'),
    (r'Amostra de Domic[ií]lios Cont[ií]nua Mensal', 'desemprego', 'Unemployment rate (PNAD, 3-mo)', '%'),
    (r'Industrial Mensal.*F[ií]sica - Brasil', 'pim', 'Industrial production MoM (sa)', '%'),
    (r'Mensal de Com[ée]rcio$', 'pmc', 'Retail sales MoM (sa)', '%'),
    (r'Mensal de Servi[çc]os$', 'pms', 'Services volume MoM (sa)', '%'),
    (r'Contas Nacionais Trimestrais', 'pib_qq', 'GDP QoQ (sa)', '%'),
]
IBGE_EN = {'Índice de Preços ao Produtor': 'Producer prices (IPP)', 'Levantamento Sistemático da Produção Agrícola': 'Crop production survey (LSPA)',
           'Pesquisa Nacional por Amostra de Domicílios Contínua Trimestral': 'PNAD quarterly labour survey', 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil': 'Construction costs (SINAPI)',
           'Índice Nacional de Preços ao Consumidor': 'INPC consumer prices', 'Pesquisa Industrial Mensal Produção Física - Regional': 'Industrial production – regional',
           'Pesquisa Mensal de Serviços - Regional': 'Services survey – regional'}

def ibge_events(a, b):
    u = f'https://servicodados.ibge.gov.br/api/v3/calendario/?qtd=500&de={a:%m-%d-%Y}&ate={b:%m-%d-%Y}'
    d = get_json(u, tries=3)
    return d.get('items', [])

def ref_key(y, m): return f'{y:04d}{m:02d}' if y and m else None

def prev_key(key, quarterly=False):
    """'202601' → '202512' (mensal) ou '202504' (trimestral, YYYYQQ)."""
    y, p = int(key[:4]), int(key[4:])
    n = 4 if quarterly else 12
    return f'{y - 1:04d}{n:02d}' if p == 1 else f'{y:04d}{p - 1:02d}'

def ibge_rows(items, sidra, sgs433, focus_m):
    """items: itens do calendário IBGE; sidra: {id: {'YYYYMM': valor}}; sgs433: {'YYYYMM': valor}; focus_m: {'MM/YYYY': [(data, mediana)]}."""
    out = []
    for it in items:
        if it.get('tipo_id') != 1: continue
        t = (it.get('titulo') or '').strip()
        when = dt.datetime.strptime(it['data_divulgacao'], '%d/%m/%Y %H:%M:%S').replace(tzinfo=dt.timezone.utc).astimezone(TZ)
        y, m = it.get('ano_referencia_inicio'), it.get('mes_referencia_inicio')
        if it.get('ano_referencia_fim') and it.get('mes_referencia_fim'): y, m = it['ano_referencia_fim'], it['mes_referencia_fim']
        key = ref_key(y, m)
        quarterly = bool(re.search(r'Contas Nacionais Trimestrais', t))
        qkey = f'{y:04d}{(m - 1) // 3 + 1:02d}' if key and quarterly else None
        r = {'country': 'BR', 'time': when.isoformat(timespec='minutes'), 'event': t, 'period': (f'Q{(m - 1) // 3 + 1}/{y}' if quarterly else f'{m:02d}/{y}') if key else None, 'agency': 'IBGE',
             'survey': None, 'actual': None, 'prior': None, 'unit': None, 'key': False}
        for pat, sid, name, unit in IBGE_MAP:
            if re.search(pat, t):
                r.update({'event': name, 'unit': unit, 'key': True, 'series': sid})
                ser = sgs433 if sid == 'ipca' else sidra.get(sid, {})
                if qkey: key = qkey
                if key and ser:
                    if key in ser and when.date() <= TODAY: r['actual'] = ser[key]
                    r['prior'] = ser.get(prev_key(key, bool(qkey)))
                if sid == 'ipca' and key:
                    fm = focus_m.get(f'{m:02d}/{y}') or []
                    fm = [v for d0, v in fm if d0 <= when.date().isoformat()]
                    if fm: r['survey'] = fm[-1]
                break
        else:
            r['event'] = IBGE_EN.get(t, t)
        out.append(r)
    return out

def parse_ics(txt):
    txt = re.sub(r'\r?\n[ \t]', '', txt)  # desdobra linhas
    ev = []
    for blk in txt.split('BEGIN:VEVENT')[1:]:
        s = re.search(r'\nSUMMARY[^:]*:(.*)', blk); d = re.search(r'\nDTSTART[^:]*:(\d{8}T\d{6}Z?)', blk)
        if not s or not d: continue
        v = d.group(1)
        t = dt.datetime.strptime(v[:15], '%Y%m%dT%H%M%S')
        t = t.replace(tzinfo=dt.timezone.utc) if v.endswith('Z') else t.replace(tzinfo=NY)
        ev.append({'summary': s.group(1).replace('\\,', ',').replace('\\;', ';').strip(), 'time': t})
    return ev

def parse_census(h):
    out = []
    i = h.find('id="calendar"')
    for r in re.finditer(r'<tr[^>]*>\s*<td[^>]*>\s*<a[^>]*>([^<]+)</a>\s*</td>\s*<td[^>]*>([^<]+)</td>\s*<td>([^<]+)</td>\s*<td>([^<]+)</td>', h[i:]):
        name, day, tm, per = [htmlmod.unescape(x).strip() for x in r.groups()]
        try: t = dt.datetime.strptime(f'{day} {tm}', '%B %d, %Y %I:%M %p').replace(tzinfo=NY)
        except Exception: continue
        out.append({'summary': name, 'time': t, 'period': per})
    return out

US_MAP = [  # (regex, série FRED, nome, transformação, unidade)
    (r'^Gross Domestic Product(?! by)|^GDP \(', 'A191RL1Q225SBEA', 'GDP QoQ annualized', 'level', '%'),
    (r'^Personal Income and Outlays', 'PCEPILFE', 'Core PCE price index YoY', 'yoy', '%'),
    (r'International Trade in Goods and Services', 'BOPGSTB', 'Trade balance', 'level_bn', 'US$ bn'),
    (r'Advance Monthly Sales for Retail|Advance Monthly Retail', 'RSAFS', 'Retail sales MoM', 'mom', '%'),
    (r'New Residential Construction', 'HOUST', 'Housing starts (SAAR, k)', 'level', 'k'),
    (r'New Residential Sales', 'HSN1F', 'New home sales (SAAR, k)', 'level', 'k'),
    (r'Durable Goods', 'DGORDER', 'Durable goods orders MoM', 'mom', '%'),
    (r'^Construction Spending', 'TTLCONS', 'Construction spending MoM', 'mom', '%'),
]

def period_key(txt):
    """'November 2026' → 202611; '3rd Quarter 2026' → 202607 (1º mês do trimestre, como no FRED)."""
    m = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})', txt or '')
    if m: return int(m.group(2)) * 100 + MONTHS_EN[m.group(1)[:3].lower()]
    m = re.search(r'(\d)(?:st|nd|rd|th) Quarter(?: and Year)? (\d{4})', txt or '')
    if m: return int(m.group(2)) * 100 + (int(m.group(1)) - 1) * 3 + 1
    return None

def transform(s, how):
    if how == 'yoy': return (s / s.shift(12) - 1) * 100
    if how == 'mom': return (s / s.shift(1) - 1) * 100
    if how == 'level_bn': return s / 1000
    return s

def us_rows(events, fr):
    out = []; seen = set()
    for e in events:
        name = e['summary']; t = e['time'].astimezone(TZ)
        per = e.get('period') or name.split(',', 1)[1].strip() if ',' in name or e.get('period') else e.get('period')
        r = {'country': 'US', 'time': t.isoformat(timespec='minutes'), 'event': name.split(',')[0].strip(), 'period': per, 'agency': e.get('agency'),
             'survey': None, 'actual': None, 'prior': None, 'unit': None, 'key': False}
        for pat, sid, nm, how, unit in US_MAP:
            if re.search(pat, name):
                r.update({'event': nm, 'unit': unit, 'key': True, 'series': sid})
                pk = period_key(per or name)
                s = fr.get(sid)
                if pk and s is not None and len(s):
                    v = transform(s, how).dropna()
                    idx = {i.year * 100 + i.month: float(x) for i, x in v.items()}
                    if pk in idx and t.date() <= TODAY: r['actual'] = clean(idx[pk], 2)
                    q = how == 'level' and sid.endswith('Q225SBEA')
                    pp = (pk - 3 if pk % 100 > 3 else pk - 100 + 9) if q else (pk - 1 if pk % 100 > 1 else pk - 100 + 11)
                    if pp in idx: r['prior'] = clean(idx[pp], 2)
                break
        k = (r['time'][:10], r['event'])
        if k in seen: continue
        seen.add(k); out.append(r)
    return out

def eco():
    a, b = TODAY - dt.timedelta(days=21), TODAY + dt.timedelta(days=45)
    rows, status = [], {}
    prev = load_prev('eco.json') or {}
    # --- Brasil: IBGE
    try:
        ec = load_out('ecst.json') or {}
        sidra = {s['id']: {p[0]: p[2] for p in s['points']} for s in ec.get('sidra', [])}
        en = load_out('econ.json') or {}
        s433 = next((s for s in en.get('series', []) if s['id'] == 'SGS433'), None)
        sgs433 = {p[0][:4] + p[0][5:7]: p[1] for p in s433['points']} if s433 else {}
        focus_m = {}
        try:
            u = (OL + 'ExpectativaMercadoMensais?' + urllib.parse.urlencode({'$top': 3000, '$format': 'json', '$orderby': 'Data asc',
                 '$filter': f"Indicador eq 'IPCA' and baseCalculo eq 0 and Data ge '{(a - dt.timedelta(days=60)).isoformat()}'", '$select': 'Data,DataReferencia,Mediana'}, quote_via=urllib.parse.quote))
            for r in get_json(u)['value']: focus_m.setdefault(r['DataReferencia'], []).append((r['Data'], r['Mediana']))
        except Exception as e: print('focus mensal', e)
        br = ibge_rows(ibge_events(a, b), sidra, sgs433, focus_m)
        rows += br; status['ibge'] = len(br)
    except Exception as e:
        print('eco ibge', e); status['ibge'] = 0
        old = [r for r in prev.get('events', []) if r.get('agency') == 'IBGE']
        if old: rows += old; status['ibge_stale'] = True
    # --- Brasil: Copom
    fm = load_out('fomc.json') or {}
    cd = load_out('cdie.json') or {}
    focus_by = {p['decision']: (p.get('focus') or {}).get('median') for p in cd.get('path', [])}
    cm = (fm.get('copom') or {}).get('meetings', [])
    for i, m in enumerate(cm):
        if a.isoformat() <= m['decision'] <= b.isoformat():
            prior = next((x['selic'] for x in reversed(cm[:i]) if x.get('selic') is not None), None)
            t = dt.datetime.fromisoformat(m['decision'] + 'T18:30').replace(tzinfo=TZ)
            rows.append({'country': 'BR', 'time': t.isoformat(timespec='minutes'), 'event': 'Copom rate decision (Selic target)', 'period': m.get('label'),
                         'agency': 'BCB', 'survey': focus_by.get(m['decision']), 'actual': m.get('selic') if m.get('decided') else None, 'prior': prior, 'unit': '%', 'key': True, 'time_approx': True})
    # --- EUA: BEA (ICS) + Census
    us_ev = []
    try:
        for e in parse_ics(get('https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics').text): e['agency'] = 'BEA'; us_ev.append(e)
        status['bea'] = True
    except Exception as e: print('eco bea', e); status['bea'] = False
    try:
        for u in sorted({f'calendar-listview-{a.year}.html', f'calendar-listview-{b.year}.html'}):
            try: h = get('https://www.census.gov/economic-indicators/' + u).content.decode('latin1')
            except Exception as e: print('census', u, e); continue
            for e in parse_census(h): e['agency'] = 'Census'; us_ev.append(e)
        status['census'] = True
    except Exception as e: print('eco census', e); status['census'] = False
    us_ev = [e for e in us_ev if a <= e['time'].astimezone(TZ).date() <= b]
    fr = fred(sorted({x[1] for x in US_MAP}), (TODAY - dt.timedelta(days=900)).isoformat()) if us_ev else {}
    rows += us_rows(us_ev, fr)
    # FOMC
    fd = (fm.get('fed') or {}).get('meetings', [])
    for i, m in enumerate(fd):
        if a.isoformat() <= m['decision'] <= b.isoformat():
            t = dt.datetime.fromisoformat(m['decision'] + 'T14:00').replace(tzinfo=NY).astimezone(TZ)
            prior = next((x['upper'] for x in reversed(fd[:i]) if x.get('upper') is not None), None)
            rows.append({'country': 'US', 'time': t.isoformat(timespec='minutes'), 'event': 'FOMC rate decision (upper bound)', 'period': None, 'agency': 'Fed',
                         'survey': None, 'actual': m.get('upper') if m.get('decided') else None, 'prior': prior, 'unit': '%', 'key': True})
    if not rows: raise RuntimeError('calendário vazio')
    rows.sort(key=lambda r: r['time'])
    save('eco.json', {'generated_at': now_iso(), 'from': a.isoformat(), 'to': b.isoformat(), 'events': rows, 'status': status,
                      'note': 'Times in Brasília time (BRT). Survey: Focus median for IPCA (month) and per-meeting Selic; no free consensus source for US releases. '
                              'BLS releases (CPI, payrolls) are not listed: the BLS calendar blocks automated access.',
                      'source': 'IBGE – release calendar (API v3); IBGE SIDRA and BCB SGS (actuals); BCB Focus (survey); BCB Copom calendar; '
                                'BEA release calendar (ICS); U.S. Census Bureau economic indicator calendar; FRED (US actuals); federalreserve.gov (FOMC)'})

# =====================================================================================
# FXFC – projeções Focus para o câmbio
# =====================================================================================
def cip_forward(spot, r_brl, du, r_usd, years):
    """Forward teórico por paridade coberta: S·(1+r_BRL)^(du/252) / (1+r_USD)^anos."""
    if None in (spot, r_brl, r_usd) or du is None: return None
    return spot * (1 + r_brl / 100) ** (du / 252) / (1 + r_usd / 100) ** years

def fxfc():
    from build_rates import du as bdu
    q = lambda ent, flt, sel: (OL + ent + '?' + urllib.parse.urlencode({'$top': 5000, '$format': 'json', '$orderby': 'Data desc', '$filter': flt, '$select': sel}, quote_via=urllib.parse.quote))
    since = (TODAY - dt.timedelta(days=400)).isoformat()
    mv = get_json(q('ExpectativaMercadoMensais', f"Indicador eq 'Câmbio' and baseCalculo eq 0 and Data ge '{since}'",
                    'Data,DataReferencia,Media,Mediana,DesvioPadrao,Minimo,Maximo,numeroRespondentes'))['value']
    av = get_json(q('ExpectativasMercadoAnuais', f"Indicador eq 'Câmbio' and baseCalculo eq 0 and Data ge '{since}'",
                    'Data,DataReferencia,Media,Mediana,DesvioPadrao,Minimo,Maximo,numeroRespondentes'))['value']
    if not mv and not av: raise RuntimeError('Focus câmbio vazio')
    last = max(r['Data'] for r in mv + av)
    def snap(rows, ref):
        h = sorted([r for r in rows if r['DataReferencia'] == ref], key=lambda r: r['Data'])
        if not h: return None
        x = h[-1]
        def ago(days):
            c = [r for r in h if r['Data'] <= (dt.date.fromisoformat(x['Data']) - dt.timedelta(days=days)).isoformat()]
            return c[-1]['Mediana'] if c else None
        return {'ref': ref, 'date': x['Data'], 'median': x['Mediana'], 'mean': x['Media'], 'sd': x['DesvioPadrao'], 'min': x['Minimo'], 'max': x['Maximo'],
                'n': x['numeroRespondentes'], 'w1': ago(7), 'w4': ago(28), 'hist': [[r['Data'], r['Mediana']] for r in h][-260:]}
    def ym(ref):
        m, y = ref.split('/'); return int(y), int(m)
    months = sorted({r['DataReferencia'] for r in mv if r['Data'] == last}, key=lambda s: ym(s))
    years = sorted({r['DataReferencia'] for r in av if r['Data'] == last})
    monthly_rows = [s for s in (snap(mv, ref) for ref in months) if s]
    annual_rows = [s for s in (snap(av, ref) for ref in years) if s]
    for s in monthly_rows: y, m = ym(s['ref']); s['end'] = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).isoformat()
    for s in annual_rows: s['end'] = f"{s['ref']}-12-31"
    # spot (PTAX venda) e forward teórico
    fx = load_out('fx.json') or {}
    pt = (fx.get('ptax') or {}).get('USD') or []
    spot = pt[-1]['sell'] if pt else None; spot_date = pt[-1]['date'] if pt else None
    cd = load_out('cdie.json') or {}; cv = load_out('curves.json') or {}
    di = [(c['du'], c['rate']) for c in cd.get('contracts', []) if c.get('rate') is not None]
    us = [(p[0], p[1]) for p in ((cv.get('us') or {}).get('now') or {}).get('points', []) if p[1] is not None]
    for s in monthly_rows + annual_rows:
        end = dt.date.fromisoformat(s['end'])
        if end <= TODAY or not spot: continue
        n = bdu(TODAY, end); yrs = (end - TODAY).days / 365.25
        rb = interp([a for a, _ in di], [b for _, b in di], n) if di else None
        ru = interp([a for a, _ in us], [b for _, b in us], yrs) if us else None
        s['forward'] = clean(cip_forward(spot, rb, n, ru, yrs), 4)
    hist_spot = [[p['date'], p['sell']] for p in pt]
    sgs1 = next((x for x in (load_out('econ.json') or {}).get('series', []) if x['id'] == 'SGS1'), None)
    if sgs1: hist_spot = [p for p in sgs1['points'] if p[0] >= since]
    save('fxfc.json', {'generated_at': now_iso(), 'survey_date': last, 'spot': spot, 'spot_date': spot_date, 'monthly': monthly_rows, 'annual': annual_rows,
                       'spot_hist': hist_spot,
                       'note': 'Focus = BCB market survey (median of respondents, BRL per USD, monthly average for monthly references / year-end for annual). '
                               'Forward = theoretical covered-interest-parity value from DI1 (B3) and US Treasury yields; not a traded onshore forward.',
                       'source': 'BCB Focus via Olinda (ExpectativaMercadoMensais / ExpectativasMercadoAnuais, indicador Câmbio); BCB PTAX; B3 DI1; FRED Treasuries'})

# =====================================================================================
# FXC – matriz de taxas cruzadas
# =====================================================================================
FXC_CCY = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'CNY', 'BRL', 'MXN', 'ARS', 'CLP', 'ZAR', 'INR', 'KRW']

def cross(usd_per, base, quote):
    """Unidades de `quote` por 1 `base`, dado usd_per[X] = unidades de X por 1 USD (USD = 1)."""
    a = 1.0 if base == 'USD' else usd_per.get(base); b = 1.0 if quote == 'USD' else usd_per.get(quote)
    if not a or not b: return None
    return b / a

def fxc():
    fx = load_out('fx.json')
    if not fx: raise RuntimeError('fx.json ausente')
    dates = fx['dates']; up = fx['usd_per']
    def at(i): return {c: (up[c][i] if c in up and up[c][i] is not None else None) for c in FXC_CCY if c != 'USD'}
    n = len(dates) - 1
    while n > 0 and sum(1 for v in at(n).values() if v) < 8: n -= 1
    now, prev = at(n), at(n - 1)
    j = max(i for i, d in enumerate(dates) if d <= (dt.date.fromisoformat(dates[n]) - dt.timedelta(days=7)).isoformat())
    wk = at(j)
    ccys = [c for c in FXC_CCY if c == 'USD' or now.get(c)]
    out = {'generated_at': now_iso(), 'date': dates[n], 'prev_date': dates[n - 1], 'week_date': dates[j], 'ccys': ccys,
           'usd_per': {c: now[c] for c in ccys if c != 'USD'}, 'usd_per_prev': {c: prev[c] for c in ccys if c != 'USD'},
           'usd_per_week': {c: wk[c] for c in ccys if c != 'USD'},
           'spark': {c: [v for v in up[c][max(0, n - 60): n + 1]] for c in ccys if c != 'USD'}}
    # PTAX (BCB): todas as moedas do boletim, R$ por unidade (fechamento)
    try:
        moedas = [m['simbolo'] for m in get_json('https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/Moedas?$format=json')['value']]
        ini = (TODAY - dt.timedelta(days=10)).strftime('%m-%d-%Y'); fim = TODAY.strftime('%m-%d-%Y')
        pt = {}
        for m in moedas:
            u = (f"https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@m,dataInicial=@a,dataFinalCotacao=@b)"
                 f"?@m='{m}'&@a='{ini}'&@b='{fim}'&$format=json")
            v = [r for r in get_json(u)['value'] if r['tipoBoletim'] == 'Fechamento']
            if v: pt[m] = {'date': v[-1]['dataHoraCotacao'][:10], 'buy': v[-1]['cotacaoCompra'], 'sell': v[-1]['cotacaoVenda'],
                           'par_buy': v[-1]['paridadeCompra'], 'par_sell': v[-1]['paridadeVenda'], 'prev_sell': v[-2]['cotacaoVenda'] if len(v) > 1 else None}
        out['ptax'] = pt
    except Exception as e: print('fxc ptax', e)
    out['source'] = 'Yahoo Finance via yfinance (USD/XXX daily close, fx.json); BCB PTAX via Olinda (closing bulletin, BRL per unit)'
    out['note'] = 'Cross rate (row → column) = units of the column currency per 1 unit of the row currency, derived from USD rates. Delayed daily closes, not real time.'
    save('fxc.json', out)

# =====================================================================================
# GMM – maiores movimentos macro globais
# =====================================================================================
def chg_block(dates, vals, kind):
    """kind: 'pct' (preços) ou 'bp' (taxas). Retorna variações 1D/1W/MTD/YTD + spark."""
    s = pd.Series(vals, index=pd.to_datetime(dates)).dropna()
    if len(s) < 3: return None
    last = float(s.iloc[-1]); d0 = s.index[-1]
    def base(cond):
        q = s[cond]; return float(q.iloc[-1]) if len(q) else None
    bases = {'d1': float(s.iloc[-2]), 'w1': base(s.index <= d0 - pd.Timedelta(days=7)),
             'mtd': base(s.index < pd.Timestamp(d0.year, d0.month, 1)), 'ytd': base(s.index < pd.Timestamp(d0.year, 1, 1))}
    f = (lambda b: clean((last / b - 1) * 100, 2) if b else None) if kind == 'pct' else (lambda b: clean((last - b) * 100, 1) if b is not None else None)
    return {'last': clean(last, 4), 'date': d0.strftime('%Y-%m-%d'), 'abs_d1': clean(last - bases['d1'], 4), 'kind': kind,
            **{k: f(v) for k, v in bases.items()}, 'spark': [clean(v, 4) for v in s.tail(30).values]}

GMM_EQ = ['^GSPC', '^IXIC', '^GSPTSE', '^BVSP', '^MXX', '^STOXX50E', '^FTSE', '^GDAXI', '^N225', '^HSI', '000001.SS', '^AXJO']
GMM_FX = [('DXY', 'US Dollar Index (DXY)'), ('EUR', 'Euro'), ('JPY', 'Japanese Yen'), ('GBP', 'British Pound'), ('CNY', 'Chinese Renminbi'),
          ('BRL', 'Brazilian Real'), ('MXN', 'Mexican Peso'), ('CAD', 'Canadian Dollar'), ('AUD', 'Australian Dollar'), ('CHF', 'Swiss Franc')]
GMM_CMD = ['CL=F', 'BZ=F', 'NG=F', 'GC=F', 'SI=F', 'HG=F', 'ZS=F', 'ZC=F', 'KC=F', 'SB=F']
GMM_BONDS = [('US', '2Y'), ('US', '10Y'), ('US', '30Y'), ('DE', '10Y'), ('GB', '10Y'), ('JP', '10Y'), ('CA', '10Y'), ('AU', '10Y'), ('BR', '2Y'), ('BR', '10Y')]

def gmm():
    groups = []
    w = load_out('world.json') or {}
    rows = {r['ticker']: r for g in w.get('regions', []) for r in g['rows']}
    eq = []
    for t in GMM_EQ:
        r = rows.get(t)
        if r:
            b = chg_block(r['dates'], r['close'], 'pct')
            if b: eq.append({'id': t, 'name': r['name'], **b})
    groups.append({'group': 'Equity Indices', 'tiles': eq})
    fx = load_out('fx.json') or {}
    fxt = []
    for c, name in GMM_FX:
        vals = fx.get('dxy') if c == 'DXY' else (fx.get('usd_per') or {}).get(c)
        if not vals: continue
        inv = c in ('EUR', 'GBP', 'AUD')  # cotadas como USD por unidade (convenção de mercado)
        v = [(1 / x if inv and x else x) for x in vals]
        b = chg_block(fx['dates'], v, 'pct')
        if b: fxt.append({'id': c, 'name': name, 'pair': 'DXY' if c == 'DXY' else (f'{c}USD' if inv else f'USD{c}'), **b})
    groups.append({'group': 'Forex', 'tiles': fxt})
    wbj = load_out('wb.json') or {}
    cmap = {c['cc']: c for c in wbj.get('countries', [])}
    bt = []
    for cc, ten in GMM_BONDS:
        c = cmap.get(cc); s = (c or {}).get('tenors', {}).get(ten)
        if not s or s.get('freq') != 'D': continue
        b = chg_block([p[0] for p in s['series']], [p[1] for p in s['series']], 'bp')
        if b: bt.append({'id': f'{cc}{ten}', 'name': f"{c['name'].split(' (')[0]} {ten}", **b})
    groups.append({'group': 'Sovereign Bonds', 'tiles': bt})
    fu = load_out('futures.json') or {}
    frow = {r['ticker']: r for r in fu.get('rows', [])}
    ct = []
    for t in GMM_CMD:
        r = frow.get(t)
        if r and r.get('series'):
            b = chg_block([p[0] for p in r['series']], [p[1] for p in r['series']], 'pct')
            if b: ct.append({'id': t, 'name': r['name'], 'unit': r.get('unit'), **b})
    groups.append({'group': 'Commodities', 'tiles': ct})
    if sum(len(g['tiles']) for g in groups) < 10: raise RuntimeError('poucos ativos para GMM')
    save('gmm.json', {'generated_at': now_iso(), 'groups': groups,
                      'note': 'Price moves in %, yield moves in basis points. Delayed daily closes. FX quoted as USD per unit for EUR, GBP, AUD; units per USD otherwise.',
                      'source': 'Yahoo Finance via yfinance (indices, FX, commodity futures – world.json, fx.json, futures.json); sovereign yields from wb.json (FRED, BoC, Bundesbank, BoE, MoF Japan, RBA, ANBIMA)'})

STEPS = {'wb': wb, 'fomc': fomc, 'wirp': wirp, 'tayl': tayl, 'eco': eco, 'fxfc': fxfc, 'fxc': fxc, 'gmm': gmm}
if __name__ == '__main__':
    res = [step(k, STEPS[k]) for k in (sys.argv[1:] or STEPS)]
    sys.exit(0 if all(res) else 1)
