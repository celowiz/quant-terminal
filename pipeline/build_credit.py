"""Crédito, títulos e comércio exterior: YAS (calculadora de títulos públicos federais), DRSK (distância até o default de Merton)
e ECTR (fluxos de comércio exterior do Brasil por país).
Fontes abertas: Tesouro Transparente (taxas e PUs do Tesouro Direto), B3/cdie.json (curva DI1), CVM DFP/ITR (dívida), Yahoo Finance (preços),
BCB SGS 4389 (CDI) e API do Comex Stat (MDIC/SECEX)."""
import os, sys, json, math, time, datetime as dt
import pandas as pd
import requests
from common import save, clean, step, now_iso, now_brt, today_brt, OUT, UA

TODAY = today_brt()

def load_out(rel):
    p = os.path.join(OUT, rel)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None

def ncdf(x): return 0.5 * (1 + math.erf(x / math.sqrt(2)))

# ======================= YAS: títulos públicos federais =======================
NTNF_CPN = 1000 * (1.10 ** 0.5 - 1)        # R$ 48,80885 por semestre (10% a.a.)
NTNB_CPN = 100 * (1.06 ** 0.5 - 1)         # 2,956301% do VNA por semestre (6% a.a.)

def add_months(d, n):
    m = d.month - 1 + n; y = d.year + m // 12; m = m % 12 + 1
    return dt.date(y, m, d.day)  # vencimentos de títulos públicos caem no dia 1 ou 15

def coupon_dates(ref, mat):
    """Datas de cupom semestrais contadas para trás a partir do vencimento, estritamente após a data de referência."""
    out, k = [], 0
    while True:
        d = add_months(mat, -6 * k)
        if d <= ref: break
        out.append(d); k += 1
    return sorted(out)

def bond_flows(row, ref):
    """Fluxos [du, valor em R$ por título] a partir da data-base do Tesouro Direto. NTN-B, NTN-B Principal e LFT usam o VNA implícito no PU."""
    from build_rates import du
    mat = dt.date.fromisoformat(row['maturity']); b = row['bond']; y = row['rate'] / 100
    if b == 'LTN':
        return [[du(ref, mat), 1000.0, mat.isoformat()]], None
    if b == 'NTN-F':
        ds = coupon_dates(ref, mat)
        return [[du(ref, d), NTNF_CPN + (1000.0 if d == mat else 0.0), d.isoformat()] for d in ds], None
    if b == 'NTN-B':
        ds = coupon_dates(ref, mat)
        fl = [[du(ref, d), NTNB_CPN + (100.0 if d == mat else 0.0), d.isoformat()] for d in ds]
        cot = sum(a / (1 + y) ** (n / 252) for n, a, _ in fl)          # cotação (% do VNA)
        vna = row['pu'] / (cot / 100)
        return [[n, a * vna / 100, d] for n, a, d in fl], vna
    if b in ('LFT', 'NTN-B P'):
        n = du(ref, mat); cot = 1 / (1 + y) ** (n / 252)
        vna = row['pu'] / cot
        return [[n, vna, mat.isoformat()]], vna
    return None, None

def price(flows, y):
    return sum(a / (1 + y) ** (n / 252) for n, a, *_ in flows)

def risk(flows, y):
    """Duration de Macaulay e modificada (anos, base 252), convexidade e DV01 (R$ por 1bp, por título)."""
    pu = price(flows, y)
    mac = sum((n / 252) * a / (1 + y) ** (n / 252) for n, a, *_ in flows) / pu
    conv = sum((n / 252) * (n / 252 + 1) * a / (1 + y) ** (n / 252 + 2) for n, a, *_ in flows) / pu
    mod = mac / (1 + y)
    return {'pu': pu, 'mac': mac, 'mod': mod, 'conv': conv, 'dv01': mod * pu * 1e-4}

ORDER = {'LTN': 0, 'NTN-F': 1, 'NTN-B': 2, 'NTN-B P': 3, 'LFT': 4}

def yld(flows, pu, y0=0.1):
    """Taxa a partir do PU (Newton)."""
    y = y0
    for _ in range(100):
        p = price(flows, y); dp = -sum((n / 252) * a / (1 + y) ** (n / 252 + 1) for n, a, *_ in flows)
        step_ = (p - pu) / dp; y -= step_
        if abs(step_) < 1e-12: break
    return y

def di_curve(ref):
    """Curva DI1 (du a partir da data-base dos títulos, taxa % a.a.) a partir de cdie.json."""
    from build_rates import du
    c = load_out('cdie.json') or {}
    pts = []
    for k in c.get('contracts') or []:
        try:
            mat = dt.date.fromisoformat(k['mat'])
            if mat > ref and k.get('rate') is not None: pts.append([du(ref, mat), k['rate']])
        except Exception: pass
    return sorted(pts), c.get('ref_date')

def latest_td():
    from build_macro import td_history
    h = td_history(30)
    if not h: return None, None
    d = max(h); return dt.date.fromisoformat(d), h[d]

def yas():
    try: ref, rows = latest_td()
    except Exception as e: print('yas TD', e); ref, rows = None, None
    if not rows:
        prev = load_out('yas.json')
        if prev and prev.get('bonds'):
            prev['status'] = 'stale'; prev['note'] = 'Tesouro Transparente unavailable in this run; showing the previous data.'
            save('yas.json', prev); return
        raise RuntimeError('Tesouro Transparente: sem preços do Tesouro Direto nos últimos 30 dias')
    curve, di_ref = di_curve(ref)
    lag = (dt.date.fromisoformat(di_ref) - ref).days if di_ref else None
    di_ok = bool(curve) and lag is not None and abs(lag) <= 3
    bonds = []
    for r in rows:
        if r['bond'] not in ORDER or not r.get('pu') or r.get('rate') is None: continue
        flows, vna = bond_flows(r, ref)
        if not flows: continue
        k = risk(flows, r['rate'] / 100)
        bonds.append({'id': f"{r['bond']} {r['maturity']}", 'bond': r['bond'], 'maturity': r['maturity'],
                      'rate': r['rate'], 'bid': r.get('bid'), 'ask': r.get('ask'),
                      'pu': r['pu'], 'model_pu': clean(k['pu'], 6), 'vna': clean(vna, 6), 'du': flows[-1][0],
                      'flows': [[n, clean(a, 6), d] for n, a, d in flows]})
    bonds.sort(key=lambda b: (ORDER[b['bond']], b['maturity']))
    note = None if di_ok else (f'DI1 spreads hidden: bond prices are from {ref.isoformat()} and the DI1 curve from {di_ref} '
                               '(Tesouro Direto data lags); comparing different days would be misleading.')
    save('yas.json', {'generated_at': now_iso(), 'ref_date': ref.isoformat(), 'di_ref_date': di_ref, 'di1': curve if di_ok else [], 'di_ok': di_ok,
                      'bonds': bonds, 'status': 'ok', 'note': note,
                      'source': 'Tesouro Nacional – Tesouro Transparente open data (Tesouro Direto morning rates and prices); B3 DI1 settlement curve',
                      'conventions': {'Rate': 'Tesouro Direto sell-back (Taxa Venda) rate and PU; Buy = investor buy rate',
                                      'LTN': 'Zero coupon: PU = 1000 / (1+y)^(bd/252)', 'NTN-F': '10% p.a. coupon (R$ 48.80885 per half-year, Jan 1 and Jul 1) + 1000 at maturity',
                                      'NTN-B': '6% p.a. coupon (2.956301% of VNA per half-year); VNA implied by the price / quote',
                                      'NTN-B P': 'Zero coupon on VNA (Tesouro IPCA+); VNA implied by the price',
                                      'LFT': 'PU = VNA / (1+spread)^(bd/252); VNA implied by the price', 'days': 'Business days, national holiday calendar (252 basis)'}})

# ======================= DRSK: Merton distance-to-default =======================
def merton(E, sE, D, r, T=1.0):
    """Resolve V (valor dos ativos) e σV no modelo de Merton: E = V·N(d1) − D·e^(−rT)·N(d2); σE·E = N(d1)·σV·V.
    r contínua. Retorna dict com V, sV, DD (risco-neutro), PD = N(−DD), ou None se não converge."""
    if not (E > 0 and sE > 0 and D > 0): return None
    sV = sE * E / (E + D); V = E + D * math.exp(-r * T)
    for _ in range(200):
        def eq(v):
            d1 = (math.log(v / D) + (r + sV * sV / 2) * T) / (sV * math.sqrt(T))
            return v * ncdf(d1) - D * math.exp(-r * T) * ncdf(d1 - sV * math.sqrt(T)) - E
        lo, hi = E, E + D * 1.5 + 1
        while eq(hi) < 0: hi *= 2
        for _ in range(200):
            mid = (lo + hi) / 2
            if eq(mid) > 0: hi = mid
            else: lo = mid
        V = (lo + hi) / 2
        d1 = (math.log(V / D) + (r + sV * sV / 2) * T) / (sV * math.sqrt(T))
        new = sE * E / (ncdf(d1) * V)
        if abs(new - sV) < 1e-9: sV = new; break
        sV = new
    dd = (math.log(V / D) + (r - sV * sV / 2) * T) / (sV * math.sqrt(T))
    return {'V': V, 'sV': sV, 'dd': dd, 'pd': ncdf(-dd)}

def bpp_debt(cnpjs):
    """Dívida financeira (empréstimos e financiamentos) por CNPJ e data: CVM BPP consolidado, contas 2.01.04 (CP) e 2.02.01 (LP)."""
    from build_corp import cvm_zip, csv_in_zip
    Y = TODAY.year
    out = {}
    for kind, yr in [('DFP', y) for y in range(Y - 4, Y)] + [('ITR', y) for y in range(Y - 3, Y + 1)]:
        try: p = cvm_zip(kind, yr)
        except Exception as e: print('drsk skip', kind, yr, e); continue
        d = csv_in_zip(p, f'{kind.lower()}_cia_aberta_BPP_con_{yr}.csv')
        if not len(d): continue
        d = d[d.CNPJ_CIA.isin(cnpjs) & (d.ORDEM_EXERC == 'ÚLTIMO') & d.CD_CONTA.isin(['2.01.04', '2.02.01'])].copy()
        d['VL'] = d.VL_CONTA.astype(float) * d.ESCALA_MOEDA.map({'MIL': 1e3, 'UNIDADE': 1}).fillna(1)
        d['VERSAO'] = d.VERSAO.astype(int)
        d = d.sort_values('VERSAO').drop_duplicates(['CNPJ_CIA', 'DT_REFER', 'CD_CONTA'], keep='last')
        for r in d.itertuples():
            o = out.setdefault(r.CNPJ_CIA, {}).setdefault(r.DT_REFER, {})
            o['st' if r.CD_CONTA == '2.01.04' else 'lt'] = float(r.VL)
    return out

def debt_asof(hist, date, lag_days=45):
    """Último balanço com data de referência ≤ date − lag (evita usar balanço ainda não publicado)."""
    ks = [k for k in sorted(hist) if dt.date.fromisoformat(k) <= date - dt.timedelta(days=lag_days)]
    return (ks[-1], hist[ks[-1]]) if ks else (None, None)

SECTOR_EN = {'bens indls': 'Industrials', 'cons n basico': 'Consumer staples', 'cons n ciclico': 'Consumer staples',
             'consumo ciclico': 'Consumer discretionary', 'diversos': 'Diversified', 'financ e outros': 'Financials & other',
             'financeiro e outros': 'Financials & other', 'mats basicos': 'Materials', 'petroleo, gas e biocombustiveis': 'Oil, gas & biofuels',
             'saude': 'Health care', 'tec.informacao': 'Technology', 'telecomunicacao': 'Telecom', 'utilidade publ': 'Utilities'}


def sector_en(s):
    """Setores B3 vêm abreviados e com grafias variadas ('Cons N  Básico', 'Financ e Outros'); normaliza para um rótulo único em inglês."""
    import unicodedata
    k = ' '.join(unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower().split())
    return SECTOR_EN.get(k, s or 'Other')


def drsk():
    from build_markets import sgs
    import yfinance as yf
    sc = load_out('screener.json')
    if not sc: raise RuntimeError('screener.json ausente')
    rows = [r for r in sc['rows'] if not r.get('bank') and r.get('cnpj') and r.get('shares') and r.get('price')]
    banks = [r['cod'] for r in sc['rows'] if r.get('bank')]
    debt = bpp_debt(sorted({r['cnpj'] for r in rows}))
    cdi = sgs(4389, TODAY - dt.timedelta(days=4 * 366))
    cdi_s = pd.Series({pd.Timestamp(d): v for d, v in cdi}).sort_index()
    raw = yf.download([r['cod'] + '.SA' for r in rows], period='4y', auto_adjust=False, progress=False, group_by='ticker')
    out, skipped = [], []
    for r in rows:
        cod = r['cod']
        try:
            d = raw[cod + '.SA'].dropna(subset=['Close'])
            close, adj = d['Close'], d['Adj Close']
        except Exception as e:
            skipped.append({'cod': cod, 'reason': 'no prices'}); continue
        lr = (adj / adj.shift(1)).apply(lambda x: math.log(x) if x and x > 0 else float('nan')).dropna()
        vol = lr.rolling(252, min_periods=200).std() * math.sqrt(252)
        h = debt.get(r['cnpj'], {})
        def at(day, E, use_lag=True):
            per, b = debt_asof(h, day, 45 if use_lag else 0)
            if not b: return None
            st, lt = b.get('st') or 0.0, b.get('lt') or 0.0
            DP = st + 0.5 * lt
            sE = vol[vol.index <= pd.Timestamp(day)]
            rr = cdi_s[cdi_s.index <= pd.Timestamp(day)]
            if not len(sE) or not len(rr) or DP <= 0: return None
            rc = math.log(1 + rr.iloc[-1] / 100)
            m = merton(E, float(sE.iloc[-1]), DP, rc)
            if not m: return None
            return {'period': per, 'st': st, 'lt': lt, 'dp': DP, 'sigma_e': float(sE.iloc[-1]), 'r': rr.iloc[-1], **m}
        cur = at(TODAY, r['mcap'], use_lag=False)
        if not cur:
            skipped.append({'cod': cod, 'reason': 'loans & financing (accounts 2.01.04/2.02.01) zero or not filed, or no price history'}); continue
        hist = []
        for me in pd.date_range(end=pd.Timestamp(TODAY), periods=37, freq='ME'):
            px = close[close.index <= me]
            if not len(px): continue
            x = at(me.date(), float(px.iloc[-1]) * r['shares'])
            if x: hist.append([me.strftime('%Y-%m-%d'), clean(x['dd'], 3), clean(x['pd'] * 100, 4)])
        out.append({'cod': cod, 'name': r['name'], 'sector': sector_en(r['sector']), 'subsector': r['subsector'], 'price': r['price'], 'mcap': clean(r['mcap'], 0),
                    'sigma_e': clean(cur['sigma_e'] * 100, 2), 'st_debt': clean(cur['st'], 0), 'lt_debt': clean(cur['lt'], 0), 'dp': clean(cur['dp'], 0),
                    'balance_date': cur['period'], 'V': clean(cur['V'], 0), 'sigma_v': clean(cur['sV'] * 100, 2), 'lev': clean(cur['dp'] / cur['V'] * 100, 2),
                    'dd': clean(cur['dd'], 3), 'pd': clean(cur['pd'] * 100, 4), 'hist': hist})
    out.sort(key=lambda x: x['dd'])
    sec = {}
    for x in out: sec.setdefault(x['sector'], []).append(x)
    med = lambda L: float(pd.Series(L).median()) if L else None
    sectors = [{'sector': s, 'n': len(L), 'median_dd': clean(med([x['dd'] for x in L]), 3), 'median_pd': clean(med([x['pd'] for x in L]), 4)} for s, L in sec.items()]
    sectors.sort(key=lambda s: s['median_dd'])
    save('drsk.json', {'generated_at': now_iso(), 'date': sc.get('date'), 'r_cdi': clean(cdi_s.iloc[-1], 2) if len(cdi_s) else None,
                       'rows': out, 'sectors': sectors, 'skipped': skipped, 'banks_excluded': banks,
                       'method': 'Merton (1974), horizon T = 1 year. E = market cap; σE = annualized 252-session volatility; default point DP = short-term debt + 0.5 × long-term debt '
                                 '(balance sheet accounts 2.01.04 and 2.02.01, loans & financing); r = CDI, continuous. Solves for V and σV; '
                                 'DD = [ln(V/DP) + (r − σV²/2)T] / (σV√T); PD = N(−DD), risk-neutral. Monthly history uses the balance sheet with a 45-day filing lag and the current share count.',
                       'source': 'CVM DFP/ITR (debt), Yahoo Finance (prices), BCB SGS 4389 (CDI), B3/CVM screener data (market cap)'})

# ======================= ECTR: comércio exterior (Comex Stat) =======================
CX = 'https://api-comexstat.mdic.gov.br'

def cx_post(body, tries=6, wait=20):
    """POST na API do Comex Stat respeitando o limite de requisições (HTTP 429 → espera e tenta de novo)."""
    last = None
    for i in range(tries):
        try:
            r = requests.post(f'{CX}/general?language=en', json=body, headers={**UA, 'Accept': 'application/json'}, timeout=180)
            if r.status_code == 200:
                j = r.json()
                if j.get('data') and 'list' in j['data']: return j['data']['list']
                last = str(j)[:200]
            else: last = f'HTTP {r.status_code}'
        except Exception as e: last = repr(e)
        time.sleep(wait * (i + 1) if i < 3 else 60)
    raise RuntimeError(f'comexstat: {last}')

def cx_rows(lst, key):
    """[{year, <key>, metricFOB}] → {nome: {ano: US$}}"""
    out = {}
    for x in lst:
        try: out.setdefault(x[key].strip(), {})[int(x['year'])] = float(x['metricFOB'])
        except Exception: pass
    return out

def ectr_build(exp, imp, months_exp, months_imp, chap_exp, chap_imp, last_year, last_month, updated):
    years = sorted({y for d in (exp, imp) for v in d.values() for y in v})
    names = sorted(set(exp) | set(imp))
    rows = []
    for n in names:
        e, i = exp.get(n, {}), imp.get(n, {})
        rows.append({'country': n, 'exp': {y: clean(e.get(y), 0) for y in years if e.get(y)}, 'imp': {y: clean(i.get(y), 0) for y in years if i.get(y)}})
    tot = lambda d, y: sum(v.get(y, 0) for v in d.values())
    totals = [{'year': y, 'exp': clean(tot(exp, y), 0), 'imp': clean(tot(imp, y), 0), 'bal': clean(tot(exp, y) - tot(imp, y), 0),
               'partial': last_month < 12} for y in years]  # every year covers Jan–last_month (same window)
    rows.sort(key=lambda r: -((r['exp'].get(last_year) or 0) + (r['imp'].get(last_year) or 0)))
    mon = {}
    for flow, L in (('exp', months_exp), ('imp', months_imp)):
        for x in L or []:
            try: mon.setdefault(f"{int(x['year']):04d}-{int(x['monthNumber']):02d}", {})[flow] = float(x['metricFOB'])
            except Exception: pass
    monthly = [{'month': k, 'exp': clean(v.get('exp'), 0), 'imp': clean(v.get('imp'), 0)} for k, v in sorted(mon.items())]
    chap = lambda L: sorted([{'name': x.get('chapter') or x.get('section'), 'fob': clean(float(x['metricFOB']), 0)} for x in (L or [])], key=lambda c: -c['fob'])[:15]
    return {'years': years, 'last_year': last_year, 'last_month': last_month, 'months': [1, last_month], 'updated': updated, 'totals': totals, 'rows': rows,
            'monthly': monthly, 'chapters': {'exp': chap(chap_exp), 'imp': chap(chap_imp)}}

def ectr():
    try:
        u = requests.get(f'{CX}/general/dates/updated', headers=UA, timeout=60).json()['data']
        ly, lm = int(u['year']), int(u['monthNumber']); updated = u.get('updated')
        y0 = ly - 5
        per = {'from': f'{y0}-01', 'to': f'{ly}-{lm:02d}'}
        ytd = {'from': f'{ly}-01', 'to': f'{ly}-{lm:02d}'}
        res = {}
        for name, body in [('exp', {'flow': 'export', 'monthDetail': False, 'period': per, 'filters': [], 'details': ['country'], 'metrics': ['metricFOB']}),
                           ('imp', {'flow': 'import', 'monthDetail': False, 'period': per, 'filters': [], 'details': ['country'], 'metrics': ['metricFOB']}),
                           # Comex Stat applies the month window to every year in the period, so monthly history
                           # needs one query for the full prior years and one for the current year-to-date.
                           ('mexp', {'flow': 'export', 'monthDetail': True, 'period': {'from': f'{ly - 2}-01', 'to': f'{ly - 1}-12'}, 'filters': [], 'details': [], 'metrics': ['metricFOB']}),
                           ('mimp', {'flow': 'import', 'monthDetail': True, 'period': {'from': f'{ly - 2}-01', 'to': f'{ly - 1}-12'}, 'filters': [], 'details': [], 'metrics': ['metricFOB']}),
                           ('mexp2', {'flow': 'export', 'monthDetail': True, 'period': ytd, 'filters': [], 'details': [], 'metrics': ['metricFOB']}),
                           ('mimp2', {'flow': 'import', 'monthDetail': True, 'period': ytd, 'filters': [], 'details': [], 'metrics': ['metricFOB']}),
                           ('cexp', {'flow': 'export', 'monthDetail': False, 'period': ytd, 'filters': [], 'details': ['chapter'], 'metrics': ['metricFOB']}),
                           ('cimp', {'flow': 'import', 'monthDetail': False, 'period': ytd, 'filters': [], 'details': ['chapter'], 'metrics': ['metricFOB']})]:
            try: res[name] = cx_post(body)
            except Exception as e:
                if name in ('exp', 'imp'): raise
                print('ectr', name, e); res[name] = None
            time.sleep(12)
        o = ectr_build(cx_rows(res['exp'], 'country'), cx_rows(res['imp'], 'country'), (res['mexp'] or []) + (res['mexp2'] or []), (res['mimp'] or []) + (res['mimp2'] or []), res['cexp'], res['cimp'], ly, lm, updated)
        o.update({'generated_at': now_iso(), 'status': 'ok', 'unit': 'US$ FOB',
                  'source': 'MDIC/SECEX – Comex Stat API (api-comexstat.mdic.gov.br), exports and imports by country (US$ FOB)'})
        save('ectr.json', o)
    except Exception as e:
        prev = load_out('ectr.json')
        if prev and prev.get('rows'):
            prev['status'] = 'stale'; prev['note'] = f'Comex Stat unavailable in this run ({str(e)[:120]}); showing the previous data.'
            save('ectr.json', prev)
        else:
            save('ectr.json', {'generated_at': now_iso(), 'status': 'unavailable', 'rows': [], 'note': f'Comex Stat unavailable: {str(e)[:160]}',
                               'source': 'MDIC/SECEX – Comex Stat API'})
        print('ectr', e)

STEPS = {'yas': yas, 'drsk': drsk, 'ectr': ectr}

if __name__ == '__main__':
    names = sys.argv[1:] or list(STEPS)
    ok = True
    for n in names:
        ok = step(n, STEPS[n]) and ok
    sys.exit(0 if ok else 1)
