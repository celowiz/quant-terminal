"""Dados por empresa: DES, CF, CN (parte CVM), FUND, VAL, DY, DVD, SPLIT, e CAL (universo IBOV).
Fontes oficiais abertas: CVM (cadastro, IPE, DFP, ITR, FCA) e Yahoo Finance (proventos, desdobramentos, preços brutos, datas de resultado)."""
import zipfile, datetime as dt, json, os, re, time
import pandas as pd, yfinance as yf
from common import with_timeout, save, get_json, cached, clean, step, now_iso, load_prev, br_universe, CNPJ, EQUITIES, OUT, today_brt

CVM = 'https://dados.cvm.gov.br/dados/CIA_ABERTA'
Y = today_brt().year

def csv_in_zip(path, name):
    z = zipfile.ZipFile(path)
    if name not in z.namelist(): return pd.DataFrame()
    return pd.read_csv(z.open(name), sep=';', encoding='latin1', dtype=str)

def key(t): return t.replace('^', 'IDX_').replace('.SA', '').replace('.', '_').replace('=', '_').replace('-', '_')

def cvm_zip(kind, year):
    return cached(f'{CVM}/DOC/{kind}/DADOS/{kind.lower()}_cia_aberta_{year}.zip', f'{kind.lower()}_cia_aberta_{year}.zip', max_age_h=20)

def ticker_cnpj_map():
    """Código de negociação -> CNPJ pelo FCA (valores mobiliários) da CVM."""
    for yr in (Y, Y - 1):
        try:
            v = csv_in_zip(cvm_zip('FCA', yr), f'fca_cia_aberta_valor_mobiliario_{yr}.csv')
            if len(v):
                v = v.dropna(subset=['Codigo_Negociacao'])
                return {r.Codigo_Negociacao.strip(): r.CNPJ_Companhia for r in v.itertuples()}
        except Exception as e: print('fca', yr, e)
    return {}

# ---------------- demonstrações financeiras ----------------
STMTS = ['DRE', 'BPA', 'BPP', 'DFC_MI']

ONLY_IND = set()   # CNPJs cujas demonstrações vieram das individuais (última chamada de load_statements)

def load_statements(cnpjs):
    """DFP/ITR consolidadas; para quem não publica consolidado (sem controladas, ex.: Sanepar), usa as individuais."""
    frames = {b: {s: [] for s in STMTS} for b in ('con', 'ind')}
    srcs = [('DFP', y) for y in range(Y - 6, Y)] + [('ITR', y) for y in range(Y - 3, Y + 1)]
    for kind, yr in srcs:
        try: p = cvm_zip(kind, yr)
        except Exception as e: print('skip', kind, yr, e); continue
        for b in ('con', 'ind'):
            for s in STMTS:
                d = csv_in_zip(p, f'{kind.lower()}_cia_aberta_{s}_{b}_{yr}.csv')
                if not len(d): continue
                d = d[d.CNPJ_CIA.isin(cnpjs) & (d.ORDEM_EXERC == 'ÚLTIMO')].copy()
                d['KIND'] = kind; frames[b][s].append(d)
    has_con = set()
    for L in frames['con'].values():
        for d in L: has_con |= set(d.CNPJ_CIA)
    only_ind = set(cnpjs) - has_con
    if only_ind: print(f'  demonstrações individuais (sem consolidado): {len(only_ind)} empresa(s)')
    ONLY_IND.clear(); ONLY_IND.update(only_ind)
    out = {}
    for s in STMTS:
        L = frames['con'][s] + [d[d.CNPJ_CIA.isin(only_ind)] for d in frames['ind'][s]]
        L = [d for d in L if len(d)]
        d = pd.concat(L) if L else pd.DataFrame()
        if len(d):
            d['VL'] = d.VL_CONTA.astype(float) * d.ESCALA_MOEDA.map({'MIL': 1e3, 'UNIDADE': 1}).fillna(1)
            d['VERSAO'] = d.VERSAO.astype(int)
            d = d.sort_values('VERSAO').drop_duplicates(['CNPJ_CIA', 'KIND', 'DT_REFER', 'DT_INI_EXERC', 'DT_FIM_EXERC', 'CD_CONTA'], keep='last') if 'DT_INI_EXERC' in d else \
                d.sort_values('VERSAO').drop_duplicates(['CNPJ_CIA', 'KIND', 'DT_REFER', 'CD_CONTA'], keep='last')
        out[s] = d
    return out

def months(a, b):
    a, b = pd.Timestamp(a), pd.Timestamp(b); return (b.year - a.year) * 12 + b.month - a.month + 1

def flow_items(dre, dfc, bank):
    """Retorna dict periodo_fim -> {conta: valor} para fluxos (DRE + D&A), anual e trimestral."""
    def pick(df, code=None, pat=None):
        q = df
        if code: q = q[q.CD_CONTA == code]
        if pat: q = q[q.DS_CONTA.str.contains(pat, case=False, regex=True, na=False)]
        return q
    rows = []
    for (kind, ini, fim), g in dre.groupby(['KIND', 'DT_INI_EXERC', 'DT_FIM_EXERC']):
        m = months(ini, fim)
        if m not in (3, 6, 9, 12): continue
        def v(code):
            q = g[g.CD_CONTA == code]; return float(q.VL.iloc[0]) if len(q) else None
        net = v('3.11.01') if v('3.11.01') not in (None, 0) else v('3.11')
        if net in (None, 0): net = v('3.09')
        r = {'kind': kind, 'ini': ini, 'fim': fim, 'm': m, 'revenue': v('3.01'), 'gross': v('3.03'), 'ebit': None if bank else v('3.05'),
             'fin': None if bank else v('3.06'), 'pretax': v('3.07') if not bank else None, 'net': net}
        if not bank and len(dfc):
            q = dfc[(dfc.KIND == kind) & (dfc.DT_INI_EXERC == ini) & (dfc.DT_FIM_EXERC == fim) & dfc.CD_CONTA.str.startswith('6.01.01.')]
            q = q[q.DS_CONTA.str.contains('deprecia|amortiza|exaust', case=False, regex=True, na=False)]
            r['da'] = float(q.VL.sum()) if len(q) else None
            cfo = dfc[(dfc.KIND == kind) & (dfc.DT_INI_EXERC == ini) & (dfc.DT_FIM_EXERC == fim) & (dfc.CD_CONTA == '6.01')]
            r['cfo'] = float(cfo.VL.iloc[0]) if len(cfo) else None
            capex = dfc[(dfc.KIND == kind) & (dfc.DT_INI_EXERC == ini) & (dfc.DT_FIM_EXERC == fim) & dfc.CD_CONTA.str.startswith('6.02.') &
                        dfc.DS_CONTA.str.contains('imobilizado|intangível|intangivel|exploração e desenvolvimento|investimentos em', case=False, regex=True, na=False) &
                        ~dfc.DS_CONTA.str.contains('venda|alienação|recebi|dividend', case=False, regex=True, na=False)]
            r['capex'] = float(capex.VL.sum()) if len(capex) else None
        rows.append(r)
    return rows

def build_fund(cnpj, st, bank):
    dre = st['DRE'][st['DRE'].CNPJ_CIA == cnpj] if len(st['DRE']) else pd.DataFrame()
    dfc = st['DFC_MI'][st['DFC_MI'].CNPJ_CIA == cnpj] if len(st['DFC_MI']) else pd.DataFrame()
    if not len(dre): return None
    flows = flow_items(dre, dfc, bank)
    keys = ['revenue', 'gross', 'ebit', 'fin', 'pretax', 'net', 'da', 'cfo', 'capex']
    annual = {r['fim']: r for r in flows if r['kind'] == 'DFP' and r['m'] == 12}
    # trimestres: valores de 3 meses do ITR (ou YTD de 3 meses do 1T); 4T = anual − 9M acumulado
    q = {}
    for r in flows:
        if r['kind'] == 'ITR' and r['m'] == 3: q[r['fim']] = r
    ytd9 = {r['fim'][:4]: r for r in flows if r['kind'] == 'ITR' and r['m'] == 9}
    for fim, a in annual.items():
        y9 = ytd9.get(fim[:4])
        if y9:
            q[fim] = {'fim': fim, **{k: (a.get(k) - y9.get(k)) if a.get(k) is not None and y9.get(k) is not None else None for k in keys}}
    # DFC no ITR só vem acumulada no ano: trimestre = YTD(m) − YTD(m−3)
    ytd = {(r['fim'][:4], r['m']): r for r in flows if r['kind'] == 'ITR' and r['ini'][5:] == '01-01'}
    for fim, r in q.items():
        mm = int(fim[5:7])
        if mm in (6, 9):
            cur, prev = ytd.get((fim[:4], mm)), ytd.get((fim[:4], mm - 3))
            for k in ('da', 'cfo', 'capex'):
                if r.get(k) is None and cur and prev and cur.get(k) is not None and prev.get(k) is not None:
                    r[k] = cur[k] - prev[k]
    def bal(fim):
        out = {}
        for s, codes in [('BPA', {'assets': '1', 'cash': '1.01.01', 'stinv': '1.01.02'}), ('BPP', {'equity': '2.03', 'liab_total': '2'})]:
            d = st[s]
            if not len(d): continue
            d = d[(d.CNPJ_CIA == cnpj) & (d.DT_FIM_EXERC == fim)] if 'DT_FIM_EXERC' in d else d[(d.CNPJ_CIA == cnpj) & (d.DT_REFER == fim)]
            for k, c in codes.items():
                x = d[d.CD_CONTA == c]; out[k] = float(x.VL.iloc[0]) if len(x) else None
            if s == 'BPP' and bank:
                # Formato IF (bancos): 2.03 não é o PL; localizar 'Patrimônio Líquido (Consolidado)' no 2º nível
                x = d[(d.CD_CONTA.str.count(r'\.') == 1) & d.DS_CONTA.str.contains(r'^Patrim[oô]nio L[ií]quido', case=False, na=False, regex=True)]
                out['equity'] = float(x.VL.iloc[0]) if len(x) else None
            if s == 'BPP' and not bank:
                x = d[d.CD_CONTA.isin(['2.01.04', '2.02.01'])]; out['debt'] = float(x.VL.sum()) if len(x) else None
                e = d[(d.CD_CONTA == '2.03.09') | (d.DS_CONTA.str.contains('Participação dos Acionistas Não Controladores', case=False, na=False) & d.CD_CONTA.str.startswith('2.03'))]
                out['minority'] = float(e.VL.iloc[0]) if len(e) else 0.0
        if out.get('debt') is not None and out.get('cash') is not None:
            out['netdebt'] = out['debt'] - out['cash'] - (out.get('stinv') or 0)
        return out
    def fmt(r, fim):
        o = {'period': fim, **{k: clean(r.get(k), 0) for k in keys}}
        if o.get('ebit') is not None and o.get('da') is not None: o['ebitda'] = clean(o['ebit'] + abs(o['da']), 0)
        o.update({k: clean(v, 0) for k, v in bal(fim).items()})
        return o
    A = [fmt(annual[k], k) for k in sorted(annual)]
    Q = [fmt(q[k], k) for k in sorted(q)][-16:]
    return {'annual': A, 'quarterly': Q, 'currency': 'BRL', 'unit': 'R$', 'bank_format': bank,
            'note': 'Demonstrações consolidadas (CVM DFP/ITR). 4º trimestre = anual − 9 meses acumulados. EBITDA = EBIT + D&A da DFC (método indireto).'}

def fix_share_units(o, ref=None):
    # O formulário da CVM não traz a unidade: algumas companhias (ex.: VALE, ITAÚ) informam a composição do capital
    # em MILHARES de ações. Com referência externa (ações em circulação do Yahoo), vale o fator (1 ou 1000) mais
    # próximo dela; sem referência, totais abaixo de 50 mi são tratados como milhares (regra das large caps).
    if not o or o['total'] <= 0: return o
    import math
    if ref and ref > 0:
        f = min((1, 1000), key=lambda k: abs(math.log(o['total'] * k / ref)))
    else:
        f = 1000 if o['total'] < 50_000_000 else 1
    if f == 1000:
        for k in ('on', 'pn', 'total', 'treasury'): o[k] *= 1000
        o['unit_note'] = 'CVM informada em milhares de ações (convertido ×1000)'
    return o

def shares_cvm(cnpj):
    for kind, yr in [('ITR', Y), ('DFP', Y - 1), ('ITR', Y - 1)]:
        try:
            k = csv_in_zip(cvm_zip(kind, yr), f'{kind.lower()}_cia_aberta_composicao_capital_{yr}.csv')
            k = k[k.CNPJ_CIA == cnpj]
            if len(k):
                r = k.sort_values(['DT_REFER', 'VERSAO']).iloc[-1]
                n = lambda c: int(float(r[c])) if pd.notna(r[c]) else 0
                o = {'date': r.DT_REFER, 'source': f'CVM {kind} {yr} – composição do capital', 'on': n('QT_ACAO_ORDIN_CAP_INTEGR'), 'pn': n('QT_ACAO_PREF_CAP_INTEGR'),
                     'total': n('QT_ACAO_TOTAL_CAP_INTEGR'), 'treasury': n('QT_ACAO_TOTAL_TESOURO')}
                return o
        except Exception as e: print('shares', kind, yr, e)
    return None

def ipe(cnpjs):
    L = []
    for yr in (Y - 1, Y):
        try:
            d = csv_in_zip(cvm_zip('IPE', yr), f'ipe_cia_aberta_{yr}.csv'); L.append(d[d.CNPJ_Companhia.isin(cnpjs)])
        except Exception as e: print('ipe', yr, e)
    d = pd.concat(L) if L else pd.DataFrame()
    return d.sort_values('Data_Entrega', ascending=False)

def b3_cnpj(root):
    """CNPJ do emissor pelo cadastro oficial de companhias listadas da B3 (código de emissor exato, ex.: CSNA)."""
    import base64
    q = base64.b64encode(json.dumps({'language': 'pt-br', 'pageNumber': 1, 'pageSize': 20, 'company': root}).encode()).decode()
    r = get_json('https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetInitialCompanies/' + q)
    for x in r.get('results') or []:
        c = re.sub(r'\D', '', x.get('cnpj') or '').zfill(14)
        if x.get('issuingCompany') == root and c.strip('0'):
            return f'{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}'
    return None

def coverage_map():
    """ticker → CNPJ para todas as ações BR do seletor, pelo FCA da CVM (código de negociação); se o FCA não traz o
    código, pelo cadastro de companhias listadas da B3 e, por fim, pelo mapeamento da execução anterior / núcleo fixo."""
    fca = ticker_cnpj_map()
    prev = (load_prev('corp_index.json') or {}).get('cnpj') or {}
    m = {}
    for t in br_universe():
        c = fca.get(t[:-3])
        if not c:
            try: c = b3_cnpj(t[:4])
            except Exception as e: print('  b3 cadastro', t, e)
        c = c or prev.get(t) or CNPJ.get(t)
        if c: m[t] = c
    print(f'  CVM: {len(m)} de {len(br_universe())} ações BR do seletor com CNPJ no FCA')
    return m

def is_bank(cad_row, st, cnpj):
    """Layout de instituição financeira (DFP/ITR modelo IF): setor CVM de bancos ou DRE 3.01 = intermediação financeira."""
    setor = (cad_row or {}).get('SETOR_ATIV') or ''
    if 'Bancos' in setor or 'Intermediação Financeira' in setor: return True
    d = st['DRE']
    if len(d):
        x = d[(d.CNPJ_CIA == cnpj) & (d.CD_CONTA == '3.01')]
        if len(x) and x.DS_CONTA.str.contains('Intermedia', case=False, na=False).any(): return True
    return False

def official_closes():
    """fechamentos oficiais do último pregão (official_close.json, gravado pelo build_prices a partir do COTAHIST)."""
    o = load_prev('official_close.json') or {}
    return o.get('closes') or {}, o.get('date')

def unit_equiv(t, shares, off):
    """Units (código 11): o preço é por unit, não por ação. Ações equivalentes = (P_ON·ON + P_PN·PN) / P_unit, com os
    fechamentos oficiais de <raiz>3 e <raiz>4 no COTAHIST; sem esses preços, não há valor de mercado (None)."""
    root = t[:-3][:4]; u = off.get(t[:-3]); on, pn = off.get(root + '3'), off.get(root + '4')
    if not shares or not u: return None
    tr = shares.get('treasury') or 0; tot = shares.get('total') or 0
    k = 1 - (tr / tot if tot else 0)  # tesouraria proporcional (a CVM não separa por classe aqui)
    mc = 0.0
    for cls, px in (('on', on), ('pn', pn)):
        q = (shares.get(cls) or 0) * k
        if q and not px: return None
        if q: mc += q * px['close']
    return {'equiv': clean(mc / u['close'], 0), 'equiv_date': u['time'],
            'note': f'Unit: ações equivalentes = (P {root}3 × ON + P {root}4 × PN) / P {t[:-3]} (B3 COTAHIST {u["time"]})'}

def corp():
    cad = pd.read_csv(cached(f'{CVM}/CAD/DADOS/cad_cia_aberta.csv', 'cad_cia_aberta.csv', 20), sep=';', encoding='latin1', dtype=str)
    M = coverage_map()
    tickers = sorted(M)
    cnpjs = sorted(set(M.values()))
    st = load_statements(cnpjs)
    docs = ipe(cnpjs)
    off, off_date = official_closes()
    try:
        raw = with_timeout(yf.download, 600, tickers, period='12y', auto_adjust=False, actions=True, progress=False, group_by='ticker', threads=True, timeout=30)
    except Exception as e:
        print('  yf.download falhou/travou:', e); raw = pd.DataFrame()
    yfail = 0; done = {}; t0 = time.time(); YBUDGET = 600   # teto de 10 min para as chamadas tk.info
    for i, t in enumerate(tickers):
        if i % 25 == 0: print(f'  corp {i}/{len(tickers)} ({int(time.time() - t0)}s)', flush=True)
        c = M[t]; o = {'ticker': t, 'cnpj': c, 'generated_at': now_iso()}
        prev = load_prev(f'corp/{key(t)}.json') or {}
        r = cad[(cad.CNPJ_CIA == c)].sort_values('DT_INI_SIT').tail(1)
        if len(r):
            r = r.iloc[0]; o['cad'] = {k: (None if pd.isna(r[k]) else r[k]) for k in ['DENOM_SOCIAL', 'DENOM_COMERC', 'DT_REG', 'DT_CONST', 'SIT', 'CD_CVM', 'SETOR_ATIV', 'TP_MERC', 'CATEG_REG',
                                                                                   'SIT_EMISSOR', 'CONTROLE_ACIONARIO', 'LOGRADOURO', 'COMPL', 'BAIRRO', 'MUN', 'UF', 'CEP', 'DDD_TEL', 'TEL', 'EMAIL', 'TP_RESP', 'RESP', 'EMAIL_RESP', 'AUDITOR']}
        bank = is_bank(o.get('cad'), st, c) or t.startswith('ITUB')
        o['fundamentals'] = build_fund(c, st, bank)
        if not o['fundamentals']: print('  sem DFP/ITR na CVM:', t); continue
        o['fundamentals']['basis'] = 'individual' if c in ONLY_IND else 'consolidated'
        tk = yf.Ticker(t)
        if yfail < 5 and time.time() - t0 < YBUDGET:
            try:
                info = with_timeout(lambda: tk.info, 30)
                o['profile'] = {k: info.get(k) for k in ['longName', 'sector', 'industry', 'fullTimeEmployees', 'website', 'longBusinessSummary', 'city', 'country', 'exchange', 'currency']}
                o['yahoo_stats'] = {k: clean(info.get(k), 4) for k in ['marketCap', 'sharesOutstanding', 'trailingPE', 'priceToBook', 'enterpriseToEbitda', 'dividendYield', 'beta']}
                yfail = 0
            except Exception as e: print('info', t, e); yfail += 1
        for k in ('profile', 'yahoo_stats'):
            if k not in o and prev.get(k): o[k] = prev[k]   # Yahoo fora: perfil da execução anterior
        o['shares'] = fix_share_units(shares_cvm(c), (o.get('yahoo_stats') or {}).get('sharesOutstanding'))
        if t.endswith('11.SA') and o['shares']:
            ue = unit_equiv(t, o['shares'], off)
            if ue: o['shares'].update(ue)
            else: o['shares']['equiv'] = None; o['shares']['note'] = 'Unit sem preço oficial das classes ON/PN: valor de mercado não calculado'
        try:
            d = raw[t] if len(tickers) > 1 else raw
            o['raw_close'] = [[i.strftime('%Y-%m-%d'), clean(v, 4)] for i, v in d['Close'].dropna().items() if i.dayofweek < 5]
            dv = d['Dividends'][d['Dividends'] > 0]; o['dividends'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in dv.items()]
            sp = d['Stock Splits'][d['Stock Splits'] > 0]; o['splits'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in sp.items()]
        except Exception as e: print('raw', t, e)
        if not o.get('raw_close') and prev.get('raw_close'):
            for k in ('raw_close', 'dividends', 'splits'): o[k] = prev.get(k) or []
        # preço bruto do último pregão = fechamento oficial da B3 (COTAHIST)
        b = off.get(t[:-3])
        if b and o.get('raw_close'):
            rc = o['raw_close']
            if rc[-1][0] == b['time']: rc[-1] = [b['time'], b['close']]
            elif rc[-1][0] < b['time']: rc.append([b['time'], b['close']])
            if rc[-1][0] == b['time']: o['official_close'] = {'date': b['time'], 'close': b['close'], 'source': 'B3 COTAHIST'}
        if not o.get('raw_close'): print('  sem preço bruto:', t); continue
        if yfail < 5:
            try:
                full_div = tk.dividends; o['dividends_full'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in full_div.items()]
                full_sp = tk.splits; o['splits_full'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in full_sp.items()]
            except Exception as e: print('actions', t, e)
        if 'dividends_full' not in o: o['dividends_full'] = prev.get('dividends_full') or o.get('dividends') or []
        if 'splits_full' not in o: o['splits_full'] = prev.get('splits_full') or o.get('splits') or []
        dd = docs[docs.CNPJ_Companhia == c]
        o['filings'] = [{'date': r.Data_Entrega, 'ref': r.Data_Referencia, 'cat': r.Categoria, 'type': None if pd.isna(r.Tipo) else r.Tipo,
                         'species': None if pd.isna(r.Especie) else r.Especie, 'subject': None if pd.isna(r.Assunto) else r.Assunto[:300],
                         'version': r.Versao, 'link': r.Link_Download} for r in dd.head(400).itertuples()]
        o['source'] = 'CVM – dados abertos (cadastro, IPE, DFP, ITR, FCA); B3 – COTAHIST (fechamento oficial); Yahoo Finance via yfinance (proventos, desdobramentos, preço sem ajuste, perfil)'
        save(f'corp/{key(t)}.json', o); done[t] = c
    if len(done) < len(EQUITIES): raise RuntimeError(f'só {len(done)} empresas com dados CVM')
    save('corp_index.json', {'generated_at': now_iso(), 'n': len(done), 'cnpj': done, 'official_close': off_date,
                             'source': 'CVM FCA (código de negociação → CNPJ; B3 cadastro de companhias listadas quando o FCA não traz o código) para as ações BR do seletor (carteiras IBOV/SMLL)'})

if __name__ == '__main__':
    import sys
    steps = {'corp': corp}   # calendário de resultados: build_calendar.py (RI + CVM)
    for k in (sys.argv[1:] or steps): step(k, steps[k])
