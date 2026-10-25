"""Juros: DI futuro (B3) → expectativa de CDI/Copom (CDIE), curvas (GC) e monitor de juros (BTMM).
Fontes (todas públicas e gratuitas):
- B3 Boletim Diário de Mercado (BDI), tabela "Negócios Consolidados – Derivativos" (export CSV público);
  cobre ~21 pregões; o histórico é acumulado a cada execução (load_prev).
- BCB: calendário do Copom (API do site), SGS 4389 (CDI a.a.) e 432 (Selic meta), Focus por reunião (Olinda).
- Tesouro Transparente: PrecoTaxaTesouroDireto.csv (taxas de LTN/NTN-F/NTN-B); FRED: Treasuries e Fed Funds.
Dias úteis: base 252 com feriados nacionais calculados aqui (conferidos com o du implícito no PU da B3)."""
import io, math, datetime as dt
import pandas as pd, requests
from common import save, get, get_json, load_prev, clean, step, now_iso, UA, today_brt, fred_csv

TODAY = today_brt()
MONTHS = 'FGHJKMNQUVXZ'

# ---------- calendário de dias úteis (feriados nacionais) ----------
def easter(y):
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451; mo = (h + l - 7 * m + 114) // 31; da = ((h + l - 7 * m + 114) % 31) + 1
    return dt.date(y, mo, da)

_HOL = {}
def holidays(y):
    if y not in _HOL:
        e = easter(y)
        s = {dt.date(y, m, d) for m, d in [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (12, 25)]}
        if y >= 2024: s.add(dt.date(y, 11, 20))  # Consciência Negra (feriado nacional desde 2024)
        s |= {e - dt.timedelta(days=48), e - dt.timedelta(days=47), e - dt.timedelta(days=2), e + dt.timedelta(days=60)}
        _HOL[y] = s
    return _HOL[y]

def is_bd(d): return d.weekday() < 5 and d not in holidays(d.year)
def next_bd(d):
    d += dt.timedelta(days=1)
    while not is_bd(d): d += dt.timedelta(days=1)
    return d
def du(a, b):
    """dias úteis em [a, b)"""
    n = 0; d = a
    while d < b:
        if is_bd(d): n += 1
        d += dt.timedelta(days=1)
    return n
def first_bd(y, m):
    d = dt.date(y, m, 1)
    while not is_bd(d): d += dt.timedelta(days=1)
    return d
def maturity(code):  # DI1F27 → 1º dia útil de jan/2027
    return first_bd(2000 + int(code[-2:]), MONTHS.index(code[-3]) + 1)

# ---------- B3 BDI ----------
BDI = 'https://arquivos.b3.com.br/bdi/table/export/csv?lang=en-us'
def num(x):
    x = str(x).strip()
    if x in ('', '-', 'nan'): return None
    return float(x.replace(',', ''))

def di1_session(d):
    r = requests.post(BDI, json={'Name': 'ConsolidatedTradesDerivatives', 'Date': d.isoformat(), 'FinalDate': d.isoformat()},
                      headers={**UA, 'Content-Type': 'application/json'}, timeout=90)
    if r.status_code != 200 or 'Ticker symbol' not in r.text: return None
    txt = r.text[r.text.index('Ticker symbol'):]
    df = pd.read_csv(io.StringIO(txt), sep=';', dtype=str)
    df = df[df['Ticker symbol'].str.match(r'^DI1[FGHJKMNQUVXZ]\d\d$', na=False)]
    rows = []
    for x in df.itertuples(index=False):
        code = x[0]; pu = num(x[9]); tx = num(x[10])
        if pu is None or tx is None: continue
        mat = maturity(code); n = du(d, mat)
        if n <= 0: continue
        n_pu = round(252 * math.log(100000 / pu) / math.log(1 + tx / 100)) if pu < 100000 else None
        rows.append({'code': code, 'mat': mat.isoformat(), 'du': n, 'du_pu': n_pu, 'pu': pu, 'rate': tx, 'last': num(x[7]),
                     'prev_rate': num(x[11]), 'trades': num(x[17]), 'contracts': num(x[18]), 'volume': num(x[19])})
    rows.sort(key=lambda r: r['du'])
    return rows or None

def copom_calendar(y0, y1):
    u = (f"https://www.bcb.gov.br/api/servico/sitebcb/calendario?inicioAgenda=%27{y0}-01-01%27&fimAgenda=%27{y1}-12-31%27"
         "&lista=Reuni%C3%B5es%20do%20Copom")
    ds = sorted({dt.date.fromisoformat(e['dataEvento'][:10]) for e in get_json(u)['conteudo']})
    # cada reunião = 2 dias consecutivos; a decisão sai no 2º dia
    meets, i = [], 0
    while i < len(ds):
        if i + 1 < len(ds) and (ds[i + 1] - ds[i]).days <= 3: meets.append((ds[i], ds[i + 1])); i += 2
        else: meets.append((ds[i], ds[i])); i += 1
    out, cnt = [], {}
    for a, b in meets:
        cnt[b.year] = cnt.get(b.year, 0) + 1
        out.append({'start': a.isoformat(), 'decision': b.isoformat(), 'effective': next_bd(b).isoformat(), 'label': f'R{cnt[b.year]}/{b.year}'})
    return out

def upto(rows, today):
    """A SGS 432 (Selic meta) já publica dias futuros (meta vigente repetida); mantém só até hoje (BRT)."""
    return [x for x in rows if x[0] <= today]

def sgs_range(code, a, b):
    u = f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial={a:%d/%m/%Y}&dataFinal={b:%d/%m/%Y}'
    return [(dt.datetime.strptime(r['data'], '%d/%m/%Y').date(), float(r['valor'])) for r in get_json(u)]

def implied_path(ref, contracts, meetings, cdi0):
    """Caminho do CDI implícito: curva DI1 em forward constante entre vencimentos (flat forward, 252 d.u.);
    o CDI de cada período entre reuniões é o forward médio da curva nesse período (CDI constante entre reuniões).
    Estável mesmo quando um vencimento cai poucos dias depois de uma reunião (o ajuste exato reunião a reunião
    amplifica o ruído de contratos pouco líquidos)."""
    fut = [m for m in meetings if dt.date.fromisoformat(m['effective']) > ref]
    t = [du(ref, dt.date.fromisoformat(m['effective'])) for m in fut]
    knots = [(0, 0.0)] + [(c['du'], c['du'] * math.log(1 + c['rate'] / 100)) for c in contracts]
    last_n = contracts[-1]['du']
    def L(n):  # log-crescimento acumulado (×252) até n d.u., interpolação flat forward
        for (n0, g0), (n1, g1) in zip(knots, knots[1:]):
            if n <= n1: return g0 + (g1 - g0) * (n - n0) / (n1 - n0)
        (n0, g0), (n1, g1) = knots[-2], knots[-1]
        return g1 + (g1 - g0) / (n1 - n0) * (n - n1)
    def avg(a, b): return (math.exp((L(b) - L(a)) / (b - a)) - 1) * 100
    rows, prev = [], cdi0
    for k, m in enumerate(fut):
        a = t[k]; b = t[k + 1] if k + 1 < len(fut) else None
        if b is None or b > last_n: break
        r = avg(a, b)
        ref_c = next((c['code'] for c in contracts if c['du'] >= b), None)
        rows.append({**m, 'du': a, 'du_end': b, 'contract': ref_c, 'cdi': round(r, 4), 'move_bp': round((r - prev) * 100, 1),
                     'cum_bp': round((r - cdi0) * 100, 1)})
        prev = r
    # Est: reprecifica cada DI1 só com o caminho (CDI0 até a 1ª reunião, depois CDI de cada período; após o último, constante)
    def G(n):
        g, p0, r = 0.0, 0, cdi0
        for row in rows:
            if row['du'] >= n: break
            g += (row['du'] - p0) * math.log(1 + r / 100); p0 = row['du']; r = row['cdi']
        return g + (n - p0) * math.log(1 + r / 100)
    est = [round((math.exp(G(c['du']) / c['du']) - 1) * 100, 4) for c in contracts]
    return rows, est

def forwards(contracts):
    out, pg, pn = [], 0.0, 0
    for c in contracts:
        g = c['du'] / 252 * math.log(1 + c['rate'] / 100)
        out.append(round((math.exp((g - pg) * 252 / (c['du'] - pn)) - 1) * 100, 4) if c['du'] > pn else None)
        pg, pn = g, c['du']
    return out

def cdie():
    prev = load_prev('cdie.json') or {}
    hist = {h['date']: h for h in prev.get('history', [])}
    curves = dict(prev.get('curves', {}))
    meetings = copom_calendar(TODAY.year - 1, TODAY.year + 2)
    cdi_s = dict(sgs_range(4389, TODAY - dt.timedelta(days=420), TODAY))
    selic = upto(sgs_range(432, TODAY - dt.timedelta(days=60), TODAY), TODAY)
    sessions = {}
    d = TODAY - dt.timedelta(days=1)
    for _ in range(40):  # últimos ~21 pregões disponíveis no BDI (os já guardados não são baixados de novo, exceto os 2 mais recentes)
        if is_bd(d) and (d.isoformat() not in curves or (TODAY - d).days <= 4):
            try:
                rows = di1_session(d)
                if rows: sessions[d] = rows
            except Exception as e: print('bdi', d, e)
        d -= dt.timedelta(days=1)
    if not sessions and not prev: raise RuntimeError('sem dados de DI1 no BDI')
    for d, rows in sessions.items():
        curves[d.isoformat()] = [[r['code'], r['mat'], r['du'], r['rate']] for r in rows]
    hist = {}
    for ds in sorted(curves)[-400:]:  # histórico recalculado de todas as curvas guardadas (mesmo método sempre)
        d = dt.date.fromisoformat(ds)
        rows = [{'code': c, 'mat': m, 'du': n, 'rate': r} for c, m, n, r in curves[ds]]
        cdi0 = None
        for k in sorted(cdi_s):
            if k < d: cdi0 = cdi_s[k]
        cdi0 = cdi0 or next((h['cdi'] for h in prev.get('history', []) if h['date'] == ds), None)
        if cdi0 is None or not rows: continue
        path, _ = implied_path(d, rows, meetings, cdi0)
        if path:
            dec = [p for p in path if p['decision'][:4] == str(d.year)]
            cum = [p['cum_bp'] for p in path if dt.date.fromisoformat(p['decision']) <= d + dt.timedelta(days=365)]
            hist[ds] = {'date': ds, 'cdi': cdi0, 'next': path[0]['label'], 'next_move_bp': path[0]['move_bp'],
                        'cum_12m_bp': cum[-1] if cum else None, 'year_end_cdi': dec[-1]['cdi'] if dec else None,
                        'di1_1y': next((r['rate'] for r in rows if r['du'] >= 252), None)}
    last = max(sessions) if sessions else dt.date.fromisoformat(prev['ref_date'])
    if sessions:
        rows = sessions[last]
        cdi0 = [v for k, v in sorted(cdi_s.items()) if k < last][-1]
        path, est = implied_path(last, rows, meetings, cdi0)
        fw = forwards(rows)
        for r, e, f in zip(rows, est, fw): r['est'] = e; r['last_est_bp'] = round((r['rate'] - e) * 100, 1); r['fwd'] = f
        focus = {}
        try:
            u = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoSelic?"
                 "$top=60&$orderby=Data%20desc&$format=json&$filter=baseCalculo%20eq%200")
            v = get_json(u)['value']; dmax = max(x['Data'] for x in v)
            focus = {x['Reuniao']: {'median': x['Mediana'], 'mean': x['Media'], 'n': x['numeroRespondentes'], 'date': x['Data']} for x in v if x['Data'] == dmax}
        except Exception as e: print('focus selic', e)
        spread = round(selic[-1][1] - cdi0, 2) if selic else 0.1
        for p in path:
            p['selic'] = round(p['cdi'] + spread, 2)
            if p['label'] in focus: p['focus'] = focus[p['label']]
        out = {'generated_at': now_iso(), 'ref_date': last.isoformat(), 'cdi': cdi0, 'selic': selic[-1][1] if selic else None,
               'selic_date': selic[-1][0].isoformat() if selic else None, 'spread_selic_cdi': spread,
               'meetings': meetings, 'path': path, 'contracts': rows}
    else:
        out = {k: prev[k] for k in prev if k not in ('history', 'curves')}; out['generated_at'] = now_iso()
    keep = sorted(curves)[-400:]
    out['curves'] = {k: curves[k] for k in keep}
    out['history'] = [hist[k] for k in sorted(hist)][-400:]
    out['source'] = ('B3 – Boletim Diário de Mercado, Negócios Consolidados – Derivativos (preço e taxa de ajuste do DI1); '
                     'BCB – calendário do Copom, SGS 4389 (CDI a.a.) e 432 (Selic meta), Focus por reunião (Olinda)')
    out['method'] = ('Taxa DI1 = (100000/PU)^(252/du) − 1. CDI constante entre reuniões; mudança vale a partir do dia útil seguinte à decisão. '
                     'Fatores log do DI1 interpolados linearmente em du (forwards constantes entre vencimentos); o CDI implícito de cada período entre reuniões '
                     'é o forward médio do período (método flat-forward, como no pacote copom de Wilson Freitas). '
                     'Est = taxa do contrato recalculada pelo caminho implícito; Last−Est em pb.')
    save('cdie.json', out)

# ---------- curvas (GC) ----------
TD_URL = ('https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/'
          '796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv')
US_IDS = [('DGS1MO', 1 / 12, '1M'), ('DGS3MO', .25, '3M'), ('DGS6MO', .5, '6M'), ('DGS1', 1, '1A'), ('DGS2', 2, '2A'), ('DGS3', 3, '3A'),
          ('DGS5', 5, '5A'), ('DGS7', 7, '7A'), ('DGS10', 10, '10A'), ('DGS20', 20, '20A'), ('DGS30', 30, '30A')]
OFFS = [('now', 0), ('w1', 7), ('m1', 30), ('m3', 91), ('y1', 365)]

def fred(ids, start):
    cols = {}
    for i in ids:
        try:
            df = pd.read_csv(io.StringIO(fred_csv(i, start)), na_values=['.'])
            cols[i] = pd.Series(df.iloc[:, 1].values, index=pd.to_datetime(df.iloc[:, 0]))
        except Exception as e: print('fred', i, e)
    return pd.DataFrame(cols)

def tesouro():
    r = get(TD_URL, timeout=300)
    df = pd.read_csv(io.StringIO(r.content.decode('latin1')), sep=';', decimal=',')
    df['base'] = pd.to_datetime(df['Data Base'], dayfirst=True); df['venc'] = pd.to_datetime(df['Data Vencimento'], dayfirst=True)
    df = df[df.base >= pd.Timestamp(TODAY - dt.timedelta(days=400))]
    out = {}
    for kind, names in [('pre', ['Tesouro Prefixado', 'Tesouro Prefixado com Juros Semestrais']), ('ipca', ['Tesouro IPCA+', 'Tesouro IPCA+ com Juros Semestrais'])]:
        k = df[df['Tipo Titulo'].isin(names)]
        last = k.base.max(); snaps = {}
        for lab, off in OFFS:
            dd = k[k.base <= last - pd.Timedelta(days=off)].base.max()
            s = k[k.base == dd].sort_values('venc')
            snaps[lab] = {'date': dd.strftime('%Y-%m-%d'), 'points': [[(v - dd).days / 365.25, clean(t, 4), n, v.strftime('%Y-%m-%d')]
                                                                     for v, t, n in zip(s.venc, s['Taxa Compra Manha'], s['Tipo Titulo'])]}
        out[kind] = snaps
    return out

def curves():
    prev = load_prev('curves.json') or {}
    out = {'generated_at': now_iso()}
    f = fred([i for i, *_ in US_IDS] + ['DFF', 'SOFR', 'DTB3'], (TODAY - dt.timedelta(days=420)).isoformat())
    us = {}
    g = f[[i for i, *_ in US_IDS]].dropna(how='all').ffill()
    for lab, off in OFFS:
        row = g[g.index <= g.index.max() - pd.Timedelta(days=off)].iloc[-1]
        us[lab] = {'date': row.name.strftime('%Y-%m-%d'), 'points': [[t, clean(row[i], 3), l] for i, t, l in US_IDS]}
    out['us'] = us
    mm = {}
    for i in ['DFF', 'SOFR', 'DTB3']:
        s = f[i].dropna() if i in f else pd.Series(dtype=float)
        if len(s): mm[i] = {'date': s.index[-1].strftime('%Y-%m-%d'), 'last': clean(s.iloc[-1], 3), 'prev': clean(s.iloc[-2], 3), 'series': [[d.strftime('%Y-%m-%d'), clean(v, 3)] for d, v in s.tail(260).items()]}
    out['us_money'] = mm
    try: out['td'] = tesouro(); out['td_source'] = 'Tesouro Transparente – PrecoTaxaTesouroDireto.csv (taxa de compra, manhã)'
    except Exception as e:
        print('tesouro direto', e)
        if prev.get('td'): out['td'] = prev['td']; out['td_source'] = prev.get('td_source'); out['td_stale'] = True
    out['source'] = 'FRED (Treasury constant maturity DGS*, DFF, SOFR, DTB3); Tesouro Transparente (Tesouro Direto); curva DI1 em cdie.json (B3)'
    save('curves.json', out)

if __name__ == '__main__':
    import sys
    steps = {'cdie': cdie, 'curves': curves}
    res = [step(k, steps[k]) for k in (sys.argv[1:] or steps)]
    sys.exit(0 if all(res) else 1)
