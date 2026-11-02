"""P4 – funções novas com dados abertos: RESV (reservas internacionais do Brasil), WEO (projeções macro mundiais),
EUCV (curva soberana da área do euro), CDR (feriados das bolsas) e INSD (negociações de administradores e controladores).
Fontes: BCB SGS, FMI DataMapper, BCE Data API, biblioteca `holidays` (calendários de bolsa), CVM VLMO e SEC Form 4.
Cada etapa é independente (common.step): se uma fonte cair, o JSON anterior continua no ar."""
import sys, io, os, re, csv, json, time, zipfile, datetime as dt
import xml.etree.ElementTree as ET
from common import get, get_json, save, step, now_iso, today_brt, load_prev, cached, clean, corp_map, OUT

TODAY = today_brt()

# ======================= RESV =======================
def sgs_daily(code, start, end=None):
    """Série diária do SGS em blocos de até 10 anos (limite da API para séries diárias)."""
    end = end or TODAY; out = []; s = start
    while s <= end:
        e = min(dt.date(s.year + 9, 12, 31), end)
        u = f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial={s:%d/%m/%Y}&dataFinal={e:%d/%m/%Y}'
        out += parse_sgs(get_json(u))
        s = dt.date(e.year + 1, 1, 1)
    return sorted(dict(out).items())

def parse_sgs(js):
    out = []
    for r in js or []:
        try: out.append((dt.datetime.strptime(r['data'], '%d/%m/%Y').date().isoformat(), float(r['valor'])))
        except (KeyError, ValueError, TypeError): continue
    return out

def change(series, days):
    """Variação absoluta entre o último ponto e o último ponto até `days` dias antes (None se não houver)."""
    if not series: return None
    d0, v0 = series[-1]; lim = (dt.date.fromisoformat(d0) - dt.timedelta(days=days)).isoformat()
    prev = [v for d, v in series if d <= lim]
    return round(v0 - prev[-1], 1) if prev else None

def resv():
    daily = sgs_daily(13621, dt.date(TODAY.year - 12, 1, 1))
    if len(daily) < 500: raise RuntimeError(f'RESV: só {len(daily)} pontos diários')
    monthly = sgs_daily(3546, dt.date(2000, 1, 1))
    last_d, last_v = daily[-1]
    ytd = [v for d, v in daily if d < f'{last_d[:4]}-01-01']
    save('resv.json', {'generated_at': now_iso(), 'date': last_d, 'unit': 'USD mn',
                       'source': 'BCB – SGS 13621 (reservas internacionais, conceito liquidez, diário) e 3546 (mensal)',
                       'last': last_v, 'chg': {'1w': change(daily, 7), '1m': change(daily, 30), '12m': change(daily, 365),
                                               'ytd': round(last_v - ytd[-1], 1) if ytd else None},
                       'max': max(daily, key=lambda x: x[1]),
                       'daily': {'t': [d for d, _ in daily], 'v': [v for _, v in daily]},
                       'monthly': {'t': [d for d, _ in monthly], 'v': [v for _, v in monthly]}})

# ======================= WEO =======================
IMF = 'https://www.imf.org/external/datamapper/api/v1'
# O FMI (CDN) devolve 403 para User-Agent que imita navegador ('Mozilla/…') vindo de IPs de nuvem; identificação simples passa.
IMF_UA = {'User-Agent': 'quant-terminal-pipeline (educational; +https://celowiz.github.io/quant-terminal/)'}
WEO_IND = ['NGDP_RPCH', 'PCPIPCH', 'LUR', 'GGXWDG_NGDP', 'GGXCNL_NGDP', 'BCA_NGDPD']
WEO_AREAS = ['WEOWORLD', 'ADVEC', 'OEMDC', 'EURO', 'USA', 'CHN', 'BRA', 'DEU', 'JPN', 'GBR', 'FRA', 'ITA', 'ESP', 'CAN', 'IND', 'KOR', 'AUS',
             'MEX', 'ARG', 'CHL', 'COL', 'PER', 'URY', 'RUS', 'TUR', 'ZAF', 'IDN', 'SAU', 'NGA', 'EGY']

def edition(src):
    """'World Economic Outlook (October 2026)' → '2026-10' (None se não reconhecer)."""
    m = re.search(r'(January|April|July|October)\s+(\d{4})', src or '')
    return f"{m.group(2)}-{dict(January='01', April='04', July='07', October='10')[m.group(1)]}" if m else None

def weo_table(values, years):
    """values = {indicador: {área: {ano: valor}}} → {área: {indicador: [valor por ano]}} (None onde faltar)."""
    out = {}
    for a in WEO_AREAS:
        row = {}
        for ind in WEO_IND:
            s = (values.get(ind) or {}).get(a) or {}
            row[ind] = [clean(s.get(str(y)), 2) for y in years]
        if any(v is not None for L in row.values() for v in L): out[a] = row
    return out

def weo():
    meta = get_json(f'{IMF}/indicators', headers=IMF_UA)['indicators']
    ed = {edition(meta.get(i, {}).get('source')) for i in WEO_IND} - {None}
    if len(ed) != 1: raise RuntimeError(f'WEO: edições diferentes entre indicadores {ed}')
    ed = ed.pop(); y0 = int(ed[:4])
    years = list(range(y0 - 6, y0 + 6))
    vals = {}
    for i in WEO_IND:
        vals[i] = get_json(f'{IMF}/{i}', timeout=120, headers=IMF_UA).get('values', {}).get(i, {})
        time.sleep(0.5)
    tab = weo_table(vals, years)
    if 'BRA' not in tab or 'USA' not in tab: raise RuntimeError('WEO: sem BRA/USA')
    labels = {}
    try:
        c = get_json(f'{IMF}/countries', headers=IMF_UA)['countries']; g = get_json(f'{IMF}/groups', headers=IMF_UA)['groups']
        labels = {a: (c.get(a) or g.get(a) or {}).get('label') for a in tab}
    except Exception as e: print('WEO rótulos', e)
    save('weo.json', {'generated_at': now_iso(), 'edition': ed, 'years': years, 'first_proj': y0,
                      'indicators': WEO_IND, 'labels': labels, 'rows': tab,
                      'source': f'FMI – World Economic Outlook ({ed}), API DataMapper'})

# ======================= EUCV =======================
ECB = 'https://data-api.ecb.europa.eu/service/data/YC'
EU_MATS = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y']
EU_CURVES = {'aaa': 'G_N_A', 'all': 'G_N_C'}

def ecb_csv(text):
    """CSV do BCE (format=csvdata) → {(curva, prazo): [(data, valor)]}."""
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        try:
            k = r['KEY'].split('.'); cv, mat = k[5], k[7].replace('SR_', '')
            out.setdefault((cv, mat), []).append((r['TIME_PERIOD'], float(r['OBS_VALUE'])))
        except (KeyError, IndexError, ValueError): continue
    return out

def eucv():
    start = (TODAY - dt.timedelta(days=400)).isoformat()
    key = f"B.U2.EUR.4F.{'+'.join(EU_CURVES.values())}.SV_C_YM.{'+'.join('SR_' + m for m in EU_MATS)}"
    d = ecb_csv(get(f'{ECB}/{key}?format=csvdata&startPeriod={start}', timeout=120).text)
    long_ = ecb_csv(get(f"{ECB}/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y+SR_10Y+SR_30Y?format=csvdata&startPeriod={TODAY.year - 10}-01-01", timeout=120).text)
    dates = sorted({x for (cv, _), L in d.items() if cv == 'G_N_A' for x, _ in L})
    if len(dates) < 100: raise RuntimeError('EUCV: poucas datas')
    curves = {}
    for nm, cv in EU_CURVES.items():
        curves[nm] = {m: [dict(d.get((cv, m), [])).get(x) for x in dates] for m in EU_MATS}
        curves[nm] = {m: [clean(v, 4) for v in L] for m, L in curves[nm].items()}
    ld = sorted({x for L in long_.values() for x, _ in L})
    hist = {m: [clean(dict(long_.get(('G_N_A', m), [])).get(x), 4) for x in ld] for m in ('2Y', '10Y', '30Y')}
    save('eucv.json', {'generated_at': now_iso(), 'date': dates[-1], 'mats': EU_MATS, 'dates': dates, 'curves': curves,
                       'hist': {'t': ld, **hist},
                       'source': 'BCE – curvas de juros da área do euro (Svensson, cupom zero, à vista): AAA e todos os emissores'})

# ======================= CDR =======================
CDR_MARKETS = [('BVMF', 'pt_BR'), ('XNYS', 'en_US'), ('XLON', 'en_US'), ('XECB', None), ('XJPX', 'en_US'), ('XHKG', 'en_US')]

def cdr_rows(start, end):
    import holidays
    yrs = list(range(start.year, end.year + 1)); out = {}
    for code, lg in CDR_MARKETS:
        kw = {'language': lg} if lg else {}
        en = holidays.financial_holidays(code, years=yrs, **({'language': 'en_US'} if lg else {}))
        loc = holidays.financial_holidays(code, years=yrs, **kw)
        out[code] = [[d.isoformat(), en.get(d), loc.get(d)] for d in sorted(en) if start <= d <= end]
    return out

def cdr():
    start, end = TODAY - dt.timedelta(days=60), dt.date(TODAY.year + 1, 12, 31)
    rows = cdr_rows(start, end)
    if not rows.get('BVMF') or not rows.get('XNYS'): raise RuntimeError('CDR: calendários vazios')
    import holidays
    save('cdr.json', {'generated_at': now_iso(), 'date': TODAY.isoformat(), 'from': start.isoformat(), 'to': end.isoformat(),
                      'markets': [c for c, _ in CDR_MARKETS], 'rows': rows,
                      'source': f'Calendários de bolsa da biblioteca holidays {holidays.__version__} (regras publicadas pelas bolsas)'})

# ======================= INSD =======================
CVM_VLMO = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/VLMO/DADOS/vlmo_cia_aberta_{y}.zip'
BUY = {'Compra à vista', 'Compra', 'Compra à termo'}
SELL = {'Venda à vista', 'Venda', 'Venda à termo'}
ROLE = {'Controlador ou Vinculado': 'ctrl', 'Conselho de Administração ou Vinculado': 'board', 'Diretor ou Vinculado': 'exec',
        'Conselho Fiscal ou Vinculado': 'fiscal', 'Órgão Estatutário ou Vinculado': 'other'}

def _num(x):
    try: v = float(str(x).replace(',', '.')); return v if v == v else None
    except (TypeError, ValueError): return None

def vlmo_rows(rows):
    """Linhas do VLMO consolidado → só a última versão de cada (empresa, mês), compras e vendas de ações/units
    da própria companhia. Devolve [{cnpj, ref, role, side, date, qty, px, val}]."""
    last = {}
    for r in rows:
        k = (r['CNPJ_Companhia'], r['Data_Referencia'])
        try: v = int(r['Versao'])
        except (TypeError, ValueError): continue
        last[k] = max(last.get(k, 0), v)
    out = []
    for r in rows:
        k = (r['CNPJ_Companhia'], r['Data_Referencia'])
        try:
            if int(r['Versao']) != last.get(k): continue
        except (TypeError, ValueError): continue
        mv = r.get('Tipo_Movimentacao'); side = 'buy' if mv in BUY else 'sell' if mv in SELL else None
        if not side or r.get('Tipo_Ativo') not in ('Ações', 'Units') or r.get('Tipo_Empresa') not in ('Companhia', None, ''): continue
        q = _num(r.get('Quantidade')); px = _num(r.get('Preco_Unitario')); vol = _num(r.get('Volume'))
        if not q or q <= 0: continue
        val = vol if vol and vol > 0 else (q * px if px and px > 0 else None)
        out.append({'cnpj': r['CNPJ_Companhia'], 'ref': r['Data_Referencia'][:7], 'role': ROLE.get(r.get('Tipo_Cargo'), 'other'), 'side': side,
                    'date': r.get('Data_Movimentacao') or None, 'qty': q, 'px': px if px and px > 0 else None, 'val': val,
                    'cls': r.get('Caracteristica_Valor_Mobiliario') or ''})
    return out

def insd_br_summary(trades, cnpj_tk, months):
    """Agrega por empresa e mês: quantidades e valores (só onde o preço foi informado) de compra e venda, por cargo."""
    agg = {}
    for t in trades:
        tk = cnpj_tk.get(t['cnpj'])
        if not tk or t['ref'] not in months: continue
        a = agg.setdefault((tk, t['ref']), {'tk': tk, 'ref': t['ref'], 'n': 0, 'bq': 0, 'sq': 0, 'bv': 0.0, 'sv': 0.0, 'nv': 0, 'roles': {}})
        a['n'] += 1
        a['bq' if t['side'] == 'buy' else 'sq'] += t['qty']
        if t['val'] is not None: a['bv' if t['side'] == 'buy' else 'sv'] += t['val']
        else: a['nv'] += 1
        r = a['roles'].setdefault(t['role'], [0.0, 0.0]); r[0 if t['side'] == 'buy' else 1] += t['qty']
    return sorted(agg.values(), key=lambda a: (a['ref'], a['bv'] + a['sv']), reverse=True)

def insd_br():
    rows = []
    for y in (TODAY.year - 1, TODAY.year):
        try:
            p = cached(CVM_VLMO.format(y=y), f'vlmo_{y}.zip', max_age_h=20)
            with zipfile.ZipFile(p) as z:
                with z.open(f'vlmo_cia_aberta_con_{y}.csv') as f:
                    rows += list(csv.DictReader(io.TextIOWrapper(f, encoding='latin1'), delimiter=';'))
        except Exception as e: print('vlmo', y, e)
    trades = vlmo_rows(rows)
    if not trades: raise RuntimeError('INSD BR: VLMO vazio')
    cm = corp_map(); cnpj_tk = {}
    for tk, c in sorted(cm.items()):                      # prefere a ação mais líquida já listada primeiro no mapa (ON/PN em ordem)
        cnpj_tk.setdefault(c, tk.replace('.SA', ''))
    months = sorted({t['ref'] for t in trades})[-6:]
    return months, insd_br_summary(trades, cnpj_tk, set(months))

def form4_parse(xml):
    """XML do Form 4 → (CIK do emissor, dono, cargo, [transações não derivativas {date, code, qty, px, ad}])."""
    root = ET.fromstring(xml)
    g = lambda e, p: (e.findtext(p) or '').strip() if e is not None else ''
    ro = root.find('reportingOwner')
    name = g(ro, 'reportingOwnerId/rptOwnerName')
    rel = ro.find('reportingOwnerRelationship') if ro is not None else None
    roles = []
    if rel is not None:
        if g(rel, 'isDirector') in ('1', 'true'): roles.append('Director')
        if g(rel, 'isOfficer') in ('1', 'true'): roles.append(g(rel, 'officerTitle') or 'Officer')
        if g(rel, 'isTenPercentOwner') in ('1', 'true'): roles.append('10% owner')
    tx = []
    for t in root.findall('nonDerivativeTable/nonDerivativeTransaction'):
        tx.append({'date': g(t, 'transactionDate/value')[:10], 'code': g(t, 'transactionCoding/transactionCode'),
                   'qty': _num(g(t, 'transactionAmounts/transactionShares/value')), 'px': _num(g(t, 'transactionAmounts/transactionPricePerShare/value')),
                   'ad': g(t, 'transactionAmounts/transactionAcquiredDisposedCode/value')})
    return g(root, 'issuer/issuerCik').lstrip('0'), name, ', '.join(roles), tx

def insd_us(days=90, per=12):
    from build_sec import sec_json, SEC_UA, us_universe
    import requests
    tk = sec_json('https://www.sec.gov/files/company_tickers.json', 'company_tickers.json')
    cik = {v['ticker'].upper(): str(v['cik_str']).zfill(10) for v in tk.values()}
    lim = (TODAY - dt.timedelta(days=days)).isoformat(); out = []; fails = 0; seen = set()
    for t in us_universe():
        c = cik.get(t.upper().replace('-', '.')) or cik.get(t.upper())
        if not c: continue
        try: sub = sec_json(f'https://data.sec.gov/submissions/CIK{c}.json', f'sub{c}.json')
        except Exception as e: print('insd sub', t, e); fails += 1; continue
        r = sub['filings']['recent']; k = 0
        for i in range(len(r['form'])):
            if r['form'][i] != '4' or r['filingDate'][i] < lim: continue
            acc = r['accessionNumber'][i].replace('-', '')
            if acc in seen: continue                       # GOOG/GOOGL: mesmo emissor, mesmo Form 4
            seen.add(acc); doc = r['primaryDocument'][i].split('/')[-1]
            url = f'https://www.sec.gov/Archives/edgar/data/{int(c)}/{acc}/{doc}'
            try:
                x = requests.get(url, headers=SEC_UA, timeout=30); time.sleep(0.12)
                if x.status_code != 200: continue
                icik, name, role, tx = form4_parse(x.content)
            except Exception as e: print('form4', t, e); continue
            if icik != str(int(c)): continue                 # a empresa é a declarante (ex.: participação em outra emissora)
            for z in tx:
                if z['code'] in ('P', 'S') and z['qty']:
                    out.append({'tk': t, 'filed': r['filingDate'][i], 'date': z['date'], 'owner': name, 'role': role, 'side': 'buy' if z['code'] == 'P' else 'sell',
                                'qty': z['qty'], 'px': z['px'], 'val': round(z['qty'] * z['px'], 0) if z['px'] else None,
                                'link': f'https://www.sec.gov/Archives/edgar/data/{int(c)}/{acc}/'})
            k += 1
            if k >= per: break
    if fails > 10: raise RuntimeError('INSD US: SEC indisponível')
    return sorted(out, key=lambda z: (z['date'], z['val'] or 0), reverse=True)

def insd():
    prev = load_prev('insd.json') or {}
    br = us = None
    try: br = insd_br()
    except Exception as e: print('INSD BR falhou:', e)
    try: us = insd_us()
    except Exception as e: print('INSD US falhou:', e)
    if br is None and us is None: raise RuntimeError('INSD: as duas fontes falharam')
    doc = {'generated_at': now_iso(), 'source': 'CVM – VLMO (valores mobiliários negociados e detidos, art. 11) e SEC – Form 4'}
    if br: doc['br'] = {'months': br[0], 'rows': br[1], 'status': 'ok'}
    else: doc['br'] = {**(prev.get('br') or {}), 'status': 'stale' if prev.get('br') else 'na'}
    if us is not None: doc['us'] = {'days': 90, 'rows': us, 'status': 'ok'}
    else: doc['us'] = {**(prev.get('us') or {}), 'status': 'stale' if prev.get('us') else 'na'}
    save('insd.json', doc)

def placeholder(rel):
    """Fonte caiu e não há JSON anterior: publica um marcador de indisponível (a tela mostra '—' sem 404 no console)."""
    if load_prev(rel) is None: save(rel, {'generated_at': now_iso(), 'unavailable': True})

if __name__ == '__main__':
    only = set(sys.argv[1:])
    for nm, fn in (('resv', resv), ('weo', weo), ('eucv', eucv), ('cdr', cdr), ('insd', insd)):
        if (not only or nm in only) and not step(nm, fn): placeholder(f'{nm}.json')
