"""Realizado, anterior e expectativa das divulgações da agenda ECO a partir de séries oficiais gratuitas.

Complementa as linhas que o calendário traz sem números (FGV, BCB, ISM/DOL, Fed, BLS, Eurostat e StatCan):
- Brasil: SGS do BCB 189 (IGP-M), 7447 (IGP-10), 190 (IGP-DI) e 7456 (INCC-M), variação mensal em %, e 24364 (IBC-Br
  dessazonalizado; mostramos a variação mensal). Códigos conferidos nos títulos oficiais das séries no SGS.
- EUA: FRED ICSA (pedidos iniciais, semana terminada no sábado anterior à divulgação, em mil), INDPRO (var. mensal) e
  ECIALLCIV (custo do emprego, var. trimestral).
- Zona do euro: API do Eurostat (HICP anual, PIB t/t, desemprego, produção industrial e varejo, var. mensal).
- Canadá: API WDS da StatCan (vetores conferidos com getSeriesInfoFromVector).
- Expectativa (mediana da pesquisa Focus do BCB) para o IGP-M e a taxa de desocupação, além de IPCA e Selic (build_macro).

Regras: só preenche campos vazios; o realizado só aparece quando a divulgação já ocorreu (data ≤ hoje) e o valor do
período de referência existe na série; sem consenso gratuito, a expectativa fica vazia ('—' na tela). Nada é estimado.
Cada série tem novas tentativas e um último valor bom em cache (eco_series.json no QT_CACHE e no diretório publicado),
usado quando a fonte falha.
"""
import os, re, json, time, datetime as dt

SERIES_FILE = 'eco_series.json'

# (fontes da linha, padrão do evento, série, regra do período, transformação, unidade, casas, indicador Focus, novo nome EN/PT)
# regras: 'p' = período que o calendário já informa; 'm'/'m-1'/'m-2' = mês da divulgação (menos n); 'flash' = mês de (data − 10 dias);
# 'q-1' = último trimestre encerrado antes da divulgação; 'w' = semana terminada no sábado anterior à divulgação.
SPECS = [
    (('fgv',), r'^IGP-M general', 'sgs:189', 'p', 'level', '% m/m', 2, 'IGP-M', None),
    (('fgv',), r'^IGP-10 general', 'sgs:7447', 'p', 'level', '% m/m', 2, None, None),
    (('fgv',), r'^IGP-DI general', 'sgs:190', 'p', 'level', '% m/m', 2, None, None),
    (('fgv',), r'^INCC-M ', 'sgs:7456', 'p', 'level', '% m/m', 2, None, None),
    (('bcb',), r'^IBC-Br', 'sgs:24364', 'm-2', 'pct', '% m/m', 2, None, None),
    (('ibge',), r'^Unemployment rate \(PNAD', None, 'p', None, None, None, 'Taxa de desocupação', None),
    (('rules', 'dol'), r'^Initial jobless claims', 'fred:ICSA', 'w', 'k', 'k', 0, None, None),
    (('fred',), r'^Industrial production \(G\.17\)', 'fred:INDPRO', 'm-1', 'pct', '% m/m', 2, None, None),
    (('bls', 'fred_bls'), r'^Employment cost index', 'fred:ECIALLCIV', 'q-1', 'pct', '% q/q', 1, None, None),
    (('eurostat',), r'flash inflation', 'es:hicp', 'flash', 'level', '% y/y', 1, None, None),
    (('eurostat',), r'inflation \(HICP, final\)', 'es:hicp', 'm-1', 'level', '% y/y', 1, None, None),
    (('eurostat',), r'GDP', 'es:gdp', 'q-1', 'level', '% q/q', 1, None, None),
    (('eurostat',), r'unemployment rate', 'es:une', 'm-1', 'level', '%', 1, None, None),
    (('eurostat',), r'industrial production', 'es:ip', 'm-2', 'level', '% m/m', 1, None, None),
    (('eurostat',), r'retail sales', 'es:retail', 'm-2', 'level', '% m/m', 1, None, None),
    (('statcan',), r'CPI inflation', 'sc:41690973', 'p', 'yoy', '% y/y', 1, None, None),
    (('statcan',), r'employment \(LFS\)|unemployment rate \(LFS\)', 'sc:2062815', 'p', 'level', '%', 1, None, ('Canada unemployment rate (LFS)', 'Taxa de desemprego do Canadá (LFS)')),
    (('statcan',), r'GDP \(monthly\)', 'sc:65201210', 'p', 'pct', '% m/m', 1, None, None),
    (('statcan',), r'GDP \(quarterly\)', 'sc:62305752', 'p', 'pct', '% q/q', 1, None, None),
    (('statcan',), r'retail sales', 'sc:1446859483', 'p', 'pct', '% m/m', 1, None, None),
    (('statcan',), r'manufacturing sales', 'sc:800450', 'p', 'pct', '% m/m', 1, None, None),
]

# Eurostat (JSON-stat): todas as dimensões fixadas, uma série por consulta; 'EA' = composição variável da zona do euro
EUROSTAT_API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
EUROSTAT = {
    'es:hicp': ('teicp000', {'unit': 'PCH_M12'}),
    'es:gdp': ('namq_10_gdp', {'s_adj': 'SCA', 'na_item': 'B1GQ', 'unit': 'CLV_PCH_PRE'}),
    'es:une': ('une_rt_m', {'s_adj': 'SA', 'age': 'TOTAL', 'sex': 'T', 'unit': 'PC_ACT'}),
    'es:ip': ('sts_inpr_m', {'s_adj': 'SCA', 'nace_r2': 'B-D', 'unit': 'PCH_PRE'}),
    'es:retail': ('sts_trtu_m', {'s_adj': 'SCA', 'nace_r2': 'G47', 'indic_bt': 'VOL_SLS', 'unit': 'PCH_PRE'}),
}
EUROSTAT_GEOS = ('EA', 'EA21')  # alguns conjuntos (desemprego) só têm o agregado da composição atual
STATCAN_API = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods'
QUARTERLY = {'fred:ECIALLCIV', 'es:gdp', 'sc:62305752'}
WEEKLY = {'fred:ICSA'}

MON_EN = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'])}
ORD = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4}


# ---------------- períodos ----------------
def mkey(y, m):
    while m < 1: y, m = y - 1, m + 12
    while m > 12: y, m = y + 1, m - 12
    return f'{y:04d}-{m:02d}'

def qkey(y, q):
    while q < 1: y, q = y - 1, q + 4
    return f'{y:04d}-Q{q}'

def parse_period(p):
    """'09/2026' | 'September 2026' | 'Q3/2026' | 'third quarter 2026' | '3rd Quarter 2026' → 'YYYY-MM' ou 'YYYY-Qn' (None se não reconhecer)."""
    if not p: return None
    s = str(p).strip()
    m = re.fullmatch(r'(\d{1,2})/(\d{4})', s)
    if m and 1 <= int(m.group(1)) <= 12: return mkey(int(m.group(2)), int(m.group(1)))
    m = re.fullmatch(r'Q([1-4])/(\d{4})', s)
    if m: return qkey(int(m.group(2)), int(m.group(1)))
    m = re.fullmatch(r'([A-Za-z]+) (\d{4})', s)
    if m and m.group(1).lower() in MON_EN: return mkey(int(m.group(2)), MON_EN[m.group(1).lower()])
    m = re.fullmatch(r'([A-Za-z0-9]+) quarter (\d{4})', s, re.I)
    if m and m.group(1).lower() in ORD: return qkey(int(m.group(2)), ORD[m.group(1).lower()])
    return None

def ref_period(rule, day, given=None):
    """Período de referência da divulgação do dia `day` (date)."""
    if rule == 'p': return parse_period(given)
    if rule == 'm': return mkey(day.year, day.month)
    if rule.startswith('m-'): return mkey(day.year, day.month - int(rule[2:]))
    if rule == 'flash': d = day - dt.timedelta(days=10); return mkey(d.year, d.month)
    if rule == 'q-1': return qkey(day.year, (day.month - 1) // 3)
    if rule == 'w': return (day - dt.timedelta(days=(day.weekday() - 5) % 7 or 7)).isoformat()
    raise ValueError(rule)

def prev_period(k):
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', k): return (dt.date.fromisoformat(k) - dt.timedelta(days=7)).isoformat()
    if '-Q' in k: return qkey(int(k[:4]), int(k[-1]) - 1)
    return mkey(int(k[:4]), int(k[5:]) - 1)

def period_label(k):
    """Rótulo no formato do eco.json ('MM/YYYY', 'Qn/YYYY', semana 'DD/MM/YYYY')."""
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', k): return f'{k[8:]}/{k[5:7]}/{k[:4]}'
    if '-Q' in k: return f'Q{k[-1]}/{k[:4]}'
    return f'{k[5:]}/{k[:4]}'


# ---------------- transformações ----------------
def transform(points, how):
    """points: {período: nível}. 'level' (já em %), 'pct' (var. % sobre o período anterior), 'yoy' (12 meses antes), 'k' (÷1000)."""
    if how == 'level': return dict(points)
    if how == 'k': return {k: v / 1000 for k, v in points.items()}
    out = {}
    for k, v in points.items():
        b = k
        for _ in range(12 if how == 'yoy' else 1): b = prev_period(b)
        if b in points and points[b]: out[k] = (v / points[b] - 1) * 100
    return out


# ---------------- busca (com cache do último valor bom) ----------------
def _key_of(sid, iso):
    """data ISO da observação → chave do período da série."""
    if sid in WEEKLY: return iso[:10]
    if sid in QUARTERLY: return qkey(int(iso[:4]), (int(iso[5:7]) - 1) // 3 + 1)
    return iso[:7]

def fetch_sgs(code, get_json, start):
    d = get_json(f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial={start:%d/%m/%Y}')
    out = {}
    for r in d:
        dd, mm, yy = r['data'].split('/')
        try: out[f'{yy}-{mm}'] = float(r['valor'])
        except (TypeError, ValueError): pass
    return out

def parse_jsonstat(d):
    """JSON-stat de uma série única → {'YYYY-MM' | 'YYYY-Qn': valor}."""
    if not d.get('value'): return {}  # consulta válida sem observações (ex.: agregado inexistente nesse conjunto)
    multi = [k for k in d.get('id', []) if k != 'time' and d.get('size', [1] * len(d['id']))[d['id'].index(k)] != 1]
    if multi: raise ValueError(f'consulta não fixou as dimensões {multi}')  # evita misturar séries
    tm = d['dimension']['time']['category']['index']
    inv = {v: k for k, v in tm.items()}
    n = len(tm)
    out = {}
    for i, v in d.get('value', {}).items():
        if v is None: continue
        t = inv[int(i) % n]
        out[t if '-Q' in t else t[:7]] = float(v)
    return out

def fetch_eurostat(sid, get_json, start):
    ds, dims = EUROSTAT[sid]
    last = None
    for geo in EUROSTAT_GEOS:
        q = '&'.join(f'{k}={v}' for k, v in {**dims, 'geo': geo}.items())
        try:
            since = f'{start.year}-Q1' if sid in QUARTERLY else f'{start.year}-01'
            pts = parse_jsonstat(get_json(f'{EUROSTAT_API}{ds}?{q}&sinceTimePeriod={since}'))
            if pts: return pts
        except Exception as e: last = e
    raise RuntimeError(f'{sid}: sem dados ({last!r})')

def parse_statcan(d):
    out = {}
    for r in d:
        if r.get('status') != 'SUCCESS': continue
        o = r['object']; sid = f"sc:{o['vectorId']}"
        out[sid] = {_key_of(sid, p['refPer']): float(p['value']) for p in o.get('vectorDataPoint', []) if p.get('value') is not None}
    return out

def fetch_statcan(vectors, post_json, n=30):
    return parse_statcan(post_json(STATCAN_API, [{'vectorId': int(v.split(':')[1]), 'latestN': n} for v in vectors]))

def fetch_fred(ids, fred_fn, start):
    fr = fred_fn([i.split(':')[1] for i in ids], start.isoformat())
    out = {}
    for i in ids:
        s = fr.get(i.split(':')[1])
        if s is not None and len(s): out[i] = {_key_of(i, d.isoformat()): float(v) for d, v in s.dropna().items()}
    return out

def load_cache(paths):
    best = {}
    for p in paths:
        try:
            with open(p, encoding='utf-8') as f: c = json.load(f)
        except Exception: continue
        for sid, s in (c.get('series') or {}).items():
            if s.get('points') and s.get('fetched_at', '') > best.get(sid, {}).get('fetched_at', ''): best[sid] = s
    return best

def write_cache(paths, series):
    for p in paths:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w', encoding='utf-8') as f: json.dump({'series': series}, f, ensure_ascii=False, separators=(',', ':'))
        except Exception as e: print('eco_series cache', e)

def fetch_all(ids, fetchers, now, cache_paths=(), tries=2):
    """{série: {período: nível}} e status. Cada fornecedor é tentado `tries` vezes; falhou → último valor bom do cache."""
    cache = load_cache(cache_paths)
    got, status = {}, {'ok': [], 'cached': [], 'missing': []}
    groups = {}
    for i in ids: groups.setdefault(i.split(':')[0], []).append(i)
    for prov, sids in groups.items():
        fn = fetchers.get(prov)
        res = {}
        for t in range(tries):
            try:
                res = fn(sids) if fn else {}
                break
            except Exception as e:
                print('eco_actuals', prov, e)
                if t + 1 < tries: time.sleep(2 * (t + 1))
        for s in sids:
            if res.get(s): got[s] = {'fetched_at': now, 'points': res[s]}; status['ok'].append(s)
            elif s in cache: got[s] = cache[s]; status['cached'].append(s)
            else: status['missing'].append(s)
    if cache_paths and got:
        write_cache(cache_paths, {**cache, **got})
    return {k: v['points'] for k, v in got.items()}, status


# ---------------- enriquecimento ----------------
def rnd(x, dec):
    v = round(float(x), dec)
    return 0.0 if v == 0 else v  # sem '-0.0'

def spec_for(r):
    for srcs, pat, *rest in SPECS:
        if r.get('src') in srcs and re.search(pat, r.get('event') or ''):
            return (srcs, pat, *rest)
    return None

def focus_survey(focus, ind, per, day):
    """Mediana mais recente coletada antes do dia da divulgação. focus: {indicador: {'MM/YYYY': [(data ISO, mediana)]}}."""
    if not ind or not per or '-Q' in per: return None
    xs = [v for d0, v in (focus.get(ind) or {}).get(f'{per[5:7]}/{per[:4]}', []) if d0 < day.isoformat()]
    return xs[-1] if xs else None

def enrich(rows, series, focus, today):
    """Preenche actual/prior/survey/unit/period nas linhas reconhecidas (sem sobrescrever o que já veio). Devolve (linhas, nº de campos preenchidos)."""
    out, filled = [], 0
    cache = {}
    for r in rows:
        sp = spec_for(r)
        if not sp: out.append(r); continue
        _, _, sid, rule, how, unit, dec, ind, rename = sp
        r = dict(r)
        day = dt.date.fromisoformat(r['time'][:10])
        per = ref_period(rule, day, r.get('period'))
        if not per: out.append(r); continue
        if not r.get('period'): r['period'] = period_label(per)
        if sid:
            if sid not in cache: cache[sid] = transform(series.get(sid) or {}, how) if series.get(sid) else {}
            ser = cache[sid]
            if ser:
                if r.get('actual') is None and day <= today and per in ser:
                    r['actual'] = rnd(ser[per], dec); filled += 1
                if r.get('prior') is None and prev_period(per) in ser:
                    r['prior'] = rnd(ser[prev_period(per)], dec); filled += 1
                if r.get('actual') is not None or r.get('prior') is not None:
                    r['unit'] = r.get('unit') or unit
                    r['series'] = r.get('series') or sid
                    if rename: r['event'], r['event_pt'] = rename
        if r.get('survey') is None:
            s = focus_survey(focus, ind, per, day)
            if s is not None: r['survey'] = round(float(s), 2); filled += 1
        out.append(r)
    return out, filled

def series_ids():
    return sorted({sp[2] for sp in SPECS if sp[2]})
