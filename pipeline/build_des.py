"""DES (descrição) para as classes sem dados corporativos CVM/SEC por empresa: FIIs, BDRs, ETFs da B3 e ETFs dos EUA.
Só cadastros oficiais e gratuitos; campo que a fonte não traz fica fora do JSON (o site mostra —, nunca estimativa):
  FII     CVM Informe Mensal de FII (geral + complemento) + CVM registro de fundos/classes (gestor, auditor, custodiante)
  ETF BR  B3 fundos listados (código → CNPJ) + CVM registro de fundos/classes (administrador, gestor, PL, auditor)
  BDR     B3 empresas listadas (BDRs: emissor, tipo, listagem, escriturador, ISIN, proventos) + SEC company_tickers_exchange
          (empresa no exterior por nome exato normalizado → CIK, tickers, bolsa) e submissions (cadastro na SEC)
  ETF US  SEC company_tickers_mf (ticker → CIK/série/classe) + submissions (registrante, endereço, exercício, filings)
Grava des/{T}.json. Cada classe é uma etapa independente com teto de tempo; se a fonte cair, o JSON anterior fica."""
import base64, io, json, os, re, sys, time, zipfile
from concurrent.futures import ThreadPoolExecutor
import pandas as pd, requests
from common import save, cached, get, get_json, now_iso, step, with_timeout, OUT, CACHE, file_key as key

CVM = 'https://dados.cvm.gov.br/dados'
B3F = 'https://sistemaswebb3-listados.b3.com.br/fundsListedProxy/Search/'
B3C = 'https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/'
SEC_UA = {'User-Agent': 'quant-terminal celowiz marcelo_wz@hotmail.com', 'Accept-Encoding': 'gzip, deflate'}
STEP_SECS = 300          # teto por classe (o run_all.sh ainda limita o script inteiro)

def b64(o): return base64.b64encode(json.dumps(o, ensure_ascii=False).encode()).decode()

def universe(cls, br=None):
    with open(os.path.join(OUT, 'tickers.json'), encoding='utf-8') as f: T = json.load(f)['tickers']
    return [t['ticker'] for t in T if t.get('class') == cls and (br is None or t['ticker'].endswith('.SA') == br)]

def s(x):
    """texto limpo ou None (NaN/vazio/zeros)."""
    if x is None: return None
    try:
        if pd.isna(x): return None
    except (TypeError, ValueError): pass
    t = ' '.join(str(x).split())
    return t or None

def f(x):
    try:
        v = float(x)
        return None if v != v or v in (float('inf'), float('-inf')) else v
    except (TypeError, ValueError): return None

def digits(x): return re.sub(r'\D', '', str(x or ''))

def fmt_cnpj(c):
    c = digits(c).zfill(14)
    return f'{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}' if c.strip('0') else None

def br_date(x):
    """dd/mm/aaaa → aaaa-mm-dd (None se inválida)"""
    m = re.fullmatch(r'(\d\d)/(\d\d)/(\d{4})', s(x) or '')
    return f'{m[3]}-{m[2]}-{m[1]}' if m else None

def compact(d):
    """tira chaves vazias (o site mostra — para campo ausente)"""
    if isinstance(d, dict): return {k: compact(v) for k, v in d.items() if v not in (None, '', [], {})}
    if isinstance(d, list): return [compact(v) for v in d]
    return d

def scrub(d):
    """o site não cita o terminal comercial (regra do projeto, como clean_name em build_prices): o nome do provedor de índice sai dos textos"""
    if isinstance(d, dict): return {k: scrub(v) for k, v in d.items()}
    if isinstance(d, list): return [scrub(v) for v in d]
    if isinstance(d, str): return ' '.join(re.sub(r'\bbloomberg\b', '', d, flags=re.I).split())
    return d

def put(t, rec):
    save(f'des/{key(t)}.json', {'generated_at': now_iso(), 'ticker': t, **scrub(rec)})

# ------------------------------- CVM registro de fundos/classes -------------------------------
def cvm_registry():
    """CNPJ (só dígitos) → dados de cadastro da classe e do fundo (administrador, gestor, auditor, custodiante...)."""
    z = zipfile.ZipFile(cached(f'{CVM}/FI/CAD/DADOS/registro_fundo_classe.zip', 'registro_fundo_classe.zip', 20))
    rc = pd.read_csv(z.open('registro_classe.csv'), sep=';', encoding='latin1', dtype=str)
    rf = pd.read_csv(z.open('registro_fundo.csv'), sep=';', encoding='latin1', dtype=str)
    return registry_map(rc, rf)

def registry_map(rc, rf):
    rf = rf.drop_duplicates('ID_Registro_Fundo', keep='last').set_index('ID_Registro_Fundo')
    out = {}
    for r in rc.itertuples(index=False):
        c = digits(r.CNPJ_Classe)
        if not c: continue
        fu = rf.loc[r.ID_Registro_Fundo] if r.ID_Registro_Fundo in rf.index else None
        g = (lambda k: s(fu.get(k)) if fu is not None else None)
        out[c] = compact({
            'class_name': s(r.Denominacao_Social), 'status': s(r.Situacao), 'class_type': s(r.Tipo_Classe),
            'condo': s(r.Forma_Condominio), 'audience': s(r.Publico_Alvo),
            'pl': f(r.Patrimonio_Liquido), 'pl_date': s(r.Data_Patrimonio_Liquido),
            'auditor': s(r.Auditor), 'custodian': s(r.Custodiante), 'controller': s(r.Controlador),
            'fund_cnpj': fmt_cnpj(g('CNPJ_Fundo')), 'fund_type': g('Tipo_Fundo'),
            'registered': g('Data_Registro'), 'constituted': g('Data_Constituicao'), 'adapted_175': g('Data_Adaptacao_RCVM175'),
            'fy_end': g('Data_Fim_Exercicio_Social'), 'director': g('Diretor'), 'admin': g('Administrador'),
            'admin_cnpj': fmt_cnpj(g('CNPJ_Administrador')), 'manager': g('Gestor'),
        })
    return out

# ------------------------------------------- FII -------------------------------------------
def _inf(year, kind):
    name = f'inf_mensal_fii_{year}.zip'
    z = zipfile.ZipFile(cached(f'{CVM}/FII/DOC/INF_MENSAL/DADOS/{name}', name, 20 if year == time.localtime().tm_year else 24 * 30))
    n = [x for x in z.namelist() if kind in x][0]
    return pd.read_csv(z.open(n), sep=';', encoding='latin1', dtype=str)

def _latest(d):
    d = d.copy(); d['_v'] = pd.to_numeric(d.Versao, errors='coerce').fillna(0)
    return d.sort_values('_v').drop_duplicates(['CNPJ_Fundo_Classe', 'Data_Referencia'], keep='last').drop(columns='_v')

def fii_records(tickers, geral, comp, reg, months=24, cnpj_by_root=None):
    """ticker (XXXX11.SA) → registro DES. Código ↔ fundo pelo ISIN do informe mensal (BR + raiz do código + CTF):
    só casa quando a raiz bate exatamente; com mais de uma classe na mesma raiz, a de maior PL no último mês.
    Sem ISIN no informe, usa o CNPJ que a B3 publica para o código (cnpj_by_root: raiz → CNPJ só dígitos)."""
    cnpj_by_root = cnpj_by_root or {}
    geral = _latest(geral); comp = _latest(comp)
    for c in ('Patrimonio_Liquido', 'Valor_Patrimonial_Cotas', 'Cotas_Emitidas', 'Total_Numero_Cotistas', 'Numero_Cotistas_Pessoa_Fisica',
              'Percentual_Dividend_Yield_Mes', 'Percentual_Rentabilidade_Efetiva_Mes', 'Percentual_Rentabilidade_Patrimonial_Mes',
              'Percentual_Despesas_Taxa_Administracao', 'Valor_Ativo'):
        if c in comp: comp[c] = pd.to_numeric(comp[c], errors='coerce')
    g = geral.sort_values('Data_Referencia').drop_duplicates('CNPJ_Fundo_Classe', keep='last')
    g = g.assign(root=g.Codigo_ISIN.fillna('').str.extract(r'^BR([A-Z0-9]{4})CTF', expand=False), _c=g.CNPJ_Fundo_Classe.map(digits))
    last_pl = comp.sort_values('Data_Referencia').drop_duplicates('CNPJ_Fundo_Classe', keep='last').set_index('CNPJ_Fundo_Classe').Patrimonio_Liquido
    out = {}
    for t in tickers:
        root = t[:4]
        cand = g[g.root == root]
        if not len(cand) and root in cnpj_by_root: cand = g[g._c == cnpj_by_root[root]]
        if not len(cand): continue
        cand = cand.assign(_pl=cand.CNPJ_Fundo_Classe.map(last_pl).fillna(0)).sort_values(['_pl', 'Data_Referencia'])
        r = cand.iloc[-1]; cnpj = r.CNPJ_Fundo_Classe
        h = comp[comp.CNPJ_Fundo_Classe == cnpj].sort_values('Data_Referencia').tail(months)
        rg = reg.get(digits(cnpj), {})
        hist = [compact({'ref': x.Data_Referencia[:7], 'pl': f(x.Patrimonio_Liquido), 'nav': f(x.Valor_Patrimonial_Cotas),
                         'holders': f(x.Total_Numero_Cotistas), 'dy': f(x.Percentual_Dividend_Yield_Mes),
                         'ret': f(x.Percentual_Rentabilidade_Efetiva_Mes), 'ret_nav': f(x.Percentual_Rentabilidade_Patrimonial_Mes)})
                for x in h.itertuples(index=False)]
        last = h.iloc[-1] if len(h) else None
        L = (lambda k: f(last[k]) if last is not None and k in last else None)
        dy12 = [x.get('dy') for x in hist[-12:]]
        out[t] = compact({
            'kind': 'fii', 'name': s(r.Nome_Fundo_Classe), 'cnpj': cnpj, 'isin': s(r.Codigo_ISIN),
            'start': s(r.Data_Funcionamento), 'audience': s(r.Publico_Alvo), 'segment': s(r.Segmento_Atuacao),
            'mandate': s(r.get('Mandato')), 'mgmt': s(r.Tipo_Gestao), 'term': s(r.Prazo_Duracao), 'term_date': s(r.get('Data_Prazo_Duracao')),
            'fy_end': s(r.Encerramento_Exercicio_Social), 'exclusive': s(r.get('Fundo_Exclusivo')),
            'admin': s(r.Nome_Administrador), 'admin_cnpj': fmt_cnpj(r.CNPJ_Administrador), 'site': s(r.Site),
            'city': ', '.join(x for x in (s(r.Cidade), s(r.Estado)) if x) or None,
            'manager': rg.get('manager'), 'auditor': rg.get('auditor'), 'custodian': rg.get('custodian'),
            'registered': rg.get('registered'), 'director': rg.get('director'),
            'ref': last.Data_Referencia[:7] if last is not None else None,
            'pl': L('Patrimonio_Liquido'), 'assets': L('Valor_Ativo'), 'nav': L('Valor_Patrimonial_Cotas'), 'quotas': L('Cotas_Emitidas'),
            'holders': L('Total_Numero_Cotistas'), 'holders_pf': L('Numero_Cotistas_Pessoa_Fisica'),
            'dy_m': L('Percentual_Dividend_Yield_Mes'), 'ret_m': L('Percentual_Rentabilidade_Efetiva_Mes'),
            'fee_m': L('Percentual_Despesas_Taxa_Administracao'),
            # DY 12m (CVM) = soma dos 12 DY mensais informados; só com os 12 meses
            'dy_12m': sum(dy12) if len(dy12) == 12 and all(x is not None for x in dy12) else None,
            'hist': hist,
        })
    return out

def build_fii(reg):
    T = universe('fii')
    y = time.localtime().tm_year
    G, C = [], []
    for yr in (y - 2, y - 1, y):
        try: G.append(_inf(yr, 'geral')); C.append(_inf(yr, 'complemento'))
        except Exception as e: print('  inf_mensal', yr, e)
    geral = pd.concat(G)
    have = set(geral.Codigo_ISIN.fillna('').str.extract(r'^BR([A-Z0-9]{4})CTF', expand=False).dropna())
    miss = [t[:4] for t in T if t[:4] not in have]
    alt = {}
    if miss:
        try:
            ids = {r['acronym'].strip().upper(): r['id'] for r in b3_fund_list('FII') if r.get('acronym')}
            for a in miss:
                if a in ids:
                    try:
                        d = b3_fund_detail(ids[a], 'FII')
                        if d and digits(d.get('cnpj')).strip('0'): alt[a] = digits(d['cnpj']).zfill(14)
                    except Exception as e: print('  B3 FII', a, e)
        except Exception as e: print('  B3 lista FII', e)
    recs = fii_records(T, geral, pd.concat(C), reg, cnpj_by_root=alt)
    for t, r in recs.items(): put(t, r)
    print(f'  FII: {len(recs)} de {len(T)}')
    if len(recs) < len(T) // 2: raise RuntimeError(f'FII: só {len(recs)} de {len(T)}')

# ------------------------------------------- ETF BR -------------------------------------------
def b3_fund_list(typ):
    out, page, pages = [], 1, 1
    while page <= pages:
        d = get_json(B3F + 'GetListFunds/' + b64({'language': 'pt-br', 'typeFund': typ, 'pageNumber': page, 'pageSize': 120, 'keyword': ''}))
        pages = (d.get('page') or {}).get('totalPages') or 0
        out += d.get('results') or []; page += 1
    return out

def b3_fund_detail(idf, typ):
    d = get_json(B3F + 'GetDetailFund/' + b64({'language': 'pt-br', 'idFNET': str(idf), 'idCEM': '0', 'typeFund': typ}), tries=3)
    return (d.get('detailFund') or d) if isinstance(d, dict) else None

def etf_record(det, rg):
    return compact({
        'kind': 'etf_br', 'name': rg.get('class_name') or s(det.get('fundName')), 'cnpj': fmt_cnpj(det.get('cnpj')),
        'trading_name': s(det.get('tradingName')), 'segment': s(det.get('segment')), 'site': s(det.get('webSite')),
        'fund_cnpj': rg.get('fund_cnpj'), 'status': rg.get('status'), 'audience': rg.get('audience'),
        'registered': rg.get('registered'), 'adapted_175': rg.get('adapted_175'), 'fy_end': rg.get('fy_end'),
        'admin': rg.get('admin'), 'admin_cnpj': rg.get('admin_cnpj'), 'manager': rg.get('manager'), 'director': rg.get('director'),
        'auditor': rg.get('auditor'), 'custodian': rg.get('custodian'), 'pl': rg.get('pl'), 'pl_date': rg.get('pl_date'),
    })

def build_etf_br(reg):
    T = {t[:4]: t for t in universe('etf', br=True)}
    L = {}
    for typ in ('ETF', 'ETF-RF'):
        try:
            for r in b3_fund_list(typ):
                a = (r.get('acronym') or '').strip().upper()
                if a in T and a not in L: L[a] = (r['id'], typ)
        except Exception as e: print('  B3 lista', typ, e)
    def one(a):
        idf, typ = L[a]
        try: return a, b3_fund_detail(idf, typ)
        except Exception as e: print('  B3 detalhe', a, e); return a, None
    n = 0
    with ThreadPoolExecutor(8) as ex:
        for a, det in ex.map(one, sorted(L)):
            if not det or not digits(det.get('cnpj')).strip('0'): continue
            t = T[a]
            put(t, etf_record(det, reg.get(digits(det['cnpj']).zfill(14), {}))); n += 1
    print(f'  ETF B3: {n} de {len(T)}')
    if n < len(T) // 2: raise RuntimeError(f'ETF B3: só {n} de {len(T)}')

# ------------------------------------------- SEC -------------------------------------------
def sec_json(url, name, max_age_h=72):
    p = os.path.join(CACHE, 'sec_' + name)
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < max_age_h * 3600:
        return json.load(open(p))
    last = None
    for i in range(3):
        try:
            r = requests.get(url, headers=SEC_UA, timeout=45); time.sleep(0.15)
            if r.status_code == 200: open(p, 'wb').write(r.content); return r.json()
            last = f'HTTP {r.status_code}'
        except Exception as e: last = repr(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f'{url}: {last}')

FORMS = ('10-K', '20-F', '40-F', '10-Q', '6-K', '8-K', 'N-CSR', 'N-CSRS', 'N-PORT-P', 'NPORT-P', '485BPOS', '497K', 'DEF 14A')

def sec_profile(sub):
    """submissions da SEC → cadastro (sem interpretação)"""
    a = (sub.get('addresses') or {}).get('business') or {}
    rec = sub.get('filings', {}).get('recent', {})
    last = {}
    for form, date in zip(rec.get('form', []), rec.get('filingDate', [])):
        if form in FORMS and form not in last: last[form] = date
    return compact({
        'sec_name': s(sub.get('name')), 'cik': str(sub.get('cik') or '').zfill(10) if sub.get('cik') else None,
        'entity_type': s(sub.get('entityType')), 'sic': s(sub.get('sic')), 'sic_desc': s(sub.get('sicDescription')),
        'state_inc': s(sub.get('stateOfIncorporationDescription')),
        'fy_end': s(sub.get('fiscalYearEnd')), 'exchanges': [x for x in sub.get('exchanges') or [] if x],
        'tickers': [x for x in sub.get('tickers') or [] if x], 'website': s(sub.get('website')),
        'address': ', '.join(x for x in (s(a.get('street1')), s(a.get('city')), s(a.get('stateOrCountryDescription') or a.get('stateOrCountry'))) if x) or None,
        'former': [s(x.get('name')) for x in (sub.get('formerNames') or [])[:3] if s(x.get('name'))],
        'filings': [{'form': k, 'date': v} for k, v in last.items()],
    })

def build_etf_us():
    T = universe('etf', br=False)
    mf = sec_json('https://www.sec.gov/files/company_tickers_mf.json', 'company_tickers_mf.json')
    idx = {r[3]: r for r in mf['data']}
    try:   # fundos UIT (ex.: SPY) não estão no arquivo de fundos mútuos; só CIK, sem série/classe
        cte = sec_json('https://www.sec.gov/files/company_tickers_exchange.json', 'company_tickers_exchange.json')
        for cik, _, tk, _ in cte['data']: idx.setdefault(tk, [cik, None, None, tk])
    except Exception as e: print('  SEC tickers:', e)
    n = 0
    for t in T:
        r = idx.get(t)
        if not r: print('  SEC mf: sem', t); continue
        cik = str(r[0]).zfill(10)
        try: sub = sec_json(f'https://data.sec.gov/submissions/CIK{cik}.json', f'sub{cik}.json')
        except Exception as e: print('  SEC', t, e); continue
        put(t, compact({'kind': 'etf_us', 'series_id': r[1], 'class_id': r[2], **sec_profile(sub)})); n += 1
    print(f'  ETF EUA: {n} de {len(T)}')
    if n < len(T) // 2: raise RuntimeError(f'ETF EUA: só {n} de {len(T)}')

# ------------------------------------------- BDR -------------------------------------------
SUFFIX = {'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'PLC', 'SA', 'NV', 'AG', 'SE',
          'AB', 'ASA', 'AS', 'SPA', 'LLC', 'LP', 'THE', 'HOLDINGS', 'HOLDING', 'GROUP', 'CLASS', 'A', 'B', 'C', 'DE', 'CV', 'ADR', 'ADS',
          'BDR', 'DRN', 'DR1', 'DR2', 'DR3', 'ON', 'PN'}

def norm_name(n):
    """nome societário normalizado para casar B3 × SEC: maiúsculas, sem acento/pontuação e sem sufixos societários"""
    import unicodedata
    n = unicodedata.normalize('NFKD', str(n or '')).encode('ascii', 'ignore').decode().upper().replace('&', ' AND ')
    n = re.sub(r'\s*/[A-Z]{1,4}/?\s*$', '', n.strip())   # sufixo de estado da SEC: "/DE/", "/MN", "/NEW"
    n = re.sub(r'\s*/[A-Z]{1,4}/?\s*$', '', n)
    w = re.sub(r'[^A-Z0-9 ]', ' ', n).split()
    while w and w[-1] in SUFFIX: w.pop()
    while w and w[0] == 'THE': w.pop(0)
    return ' '.join(w)

def sec_name_index(cte):
    """nome normalizado → {cik, name, tickers[], exchanges[]}; nomes com mais de um CIK ficam de fora (ambíguo)"""
    by = {}
    for cik, name, tk, exch in cte['data']:
        k = norm_name(name)
        if not k: continue
        e = by.setdefault(k, {})
        x = e.setdefault(cik, {'cik': str(cik).zfill(10), 'name': name, 'tickers': [], 'exchanges': []})
        if tk and exch in ('NYSE', 'Nasdaq', 'CBOE') and '-' not in tk and tk not in x['tickers']: x['tickers'].append(tk)
        if exch in ('NYSE', 'Nasdaq', 'CBOE') and exch not in x['exchanges']: x['exchanges'].append(exch)
    return {k: next(iter(v.values())) for k, v in by.items() if len(v) == 1}

def match_underlying(names, idx):
    for n in names:
        k = norm_name(n)
        if k and k in idx: return idx[k]
    return None

def b3_bdr_list():
    out, page, pages = [], 1, 1
    while page <= pages:
        d = get_json(B3C + 'GetCompaniesBDR/' + b64({'language': 'pt-br', 'pageNumber': page, 'pageSize': 120, 'codeCategoryBVMF': 6, 'company': ''}))
        pages = (d.get('page') or {}).get('totalPages') or 0
        out += d.get('results') or []; page += 1
    return out

def bdr_divs(sup):
    rows = []
    for x in (sup or {}).get('cashDividends') or []:
        rows.append(compact({'pay': br_date(x.get('paymentDate')), 'ex': br_date(x.get('lastDatePrior')), 'approved': br_date(x.get('approvedOn')),
                             'rate': f(str(x.get('rate') or '').replace('.', '').replace(',', '.')), 'label': s(x.get('label')), 'ref': s(x.get('relatedTo'))}))
    return sorted([r for r in rows if r.get('rate')], key=lambda r: r.get('ex') or r.get('pay') or '', reverse=True)[:16]

def bdr_record(t, base, det, sup, und, us_cov):
    det = det or {}
    isin = next((s(o.get('isin')) for o in det.get('otherCodes') or [] if s(o.get('code')) == t[:-3]), None)
    rec = {
        'kind': 'bdr', 'name': s(base.get('companyName')), 'trading_name': s(base.get('tradingName')), 'issuer_code': s(base.get('issuingCompany')),
        'type_bdr': s(base.get('typeBDR')), 'listed': br_date(base.get('dateListing')), 'market': s(base.get('market')),
        'isin': isin, 'website': s(det.get('website')), 'bookkeeper': s(det.get('institutionPreferred')) or s(det.get('institutionCommon')),
        'divs': bdr_divs(sup),
    }
    if und:
        rec['underlying'] = compact({**und, 'des': next((x for x in und['tickers'] if x in us_cov), None)})
    return compact(rec)

def build_bdr():
    T = {}
    for t in universe('bdr'): T.setdefault(t[:4], []).append(t)   # GOGL34/GOGL35: mesmo emissor, um arquivo por código
    base = {}
    for r in b3_bdr_list():
        a = (r.get('issuingCompany') or '').strip().upper()
        if a in T: base.setdefault(a, r)
    cte = sec_json('https://www.sec.gov/files/company_tickers_exchange.json', 'company_tickers_exchange.json')
    idx = sec_name_index(cte)
    with open(os.path.join(OUT, 'tickers.json'), encoding='utf-8') as fh:
        us_cov = {x['ticker'] for x in json.load(fh)['tickers'] if x.get('class') == 'us_equity' and 'corp' in (x.get('cov') or [])}
    us_cov |= {f[:-5] for f in os.listdir(os.path.join(OUT, 'corp')) if f.endswith('.json')} if os.path.isdir(os.path.join(OUT, 'corp')) else set()
    def one(a):
        b = base[a]; det = sup = None
        try: det = get_json(B3C + 'GetDetail/' + b64({'codeCVM': str(b['codeCVM']), 'language': 'pt-br'}), tries=3)
        except Exception as e: print('  B3 detalhe', a, e)
        try:
            x = get_json(B3C + 'GetListedSupplementCompany/' + b64({'issuingCompany': a, 'language': 'pt-br'}), tries=3)
            sup = x[0] if isinstance(x, list) and x else None
        except Exception as e: print('  B3 proventos', a, e)
        return a, det, sup
    n = m = 0
    with ThreadPoolExecutor(8) as ex:
        for a, det, sup in ex.map(one, sorted(base)):
            b = base[a]
            und = match_underlying([b.get('companyName'), (det or {}).get('companyName')], idx)
            if und:
                m += 1
                try: und = {**und, **{k: v for k, v in sec_profile(sec_json(f"https://data.sec.gov/submissions/CIK{und['cik']}.json", f"sub{und['cik']}.json")).items() if k not in ('tickers',)}}
                except Exception as e: print('  SEC', a, e)
            for t in T[a]:
                put(t, bdr_record(t, b, det, sup, und, us_cov)); n += 1
    print(f'  BDR: {n} de {sum(map(len, T.values()))} ({m} com empresa casada na SEC)')
    if n < sum(map(len, T.values())) // 2: raise RuntimeError(f'BDR: só {n} de {len(T)}')

def main():
    reg = {}
    try: reg = with_timeout(cvm_registry, STEP_SECS)
    except Exception as e: print('  CVM registro:', e)
    ok = [step('des_fii', lambda: with_timeout(build_fii, STEP_SECS, reg)),
          step('des_etf_br', lambda: with_timeout(build_etf_br, STEP_SECS, reg)),
          step('des_etf_us', lambda: with_timeout(build_etf_us, STEP_SECS)),
          step('des_bdr', lambda: with_timeout(build_bdr, STEP_SECS))]
    return all(ok)

if __name__ == '__main__':
    sys.exit(0 if main() else 1)
