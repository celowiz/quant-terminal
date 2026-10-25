"""Dados por empresa: DES, CF, CN (parte CVM), FUND, VAL, DY, DVD, SPLIT, e CAL (universo IBOV).
Fontes oficiais abertas: CVM (cadastro, IPE, DFP, ITR, FCA) e Yahoo Finance (proventos, desdobramentos, preços brutos, datas de resultado)."""
import zipfile, datetime as dt, json, os
import pandas as pd, yfinance as yf
from common import save, cached, clean, step, now_iso, CNPJ, EQUITIES, OUT, today_brt

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

def load_statements(cnpjs):
    frames = {s: [] for s in STMTS}
    srcs = [('DFP', y) for y in range(Y - 6, Y)] + [('ITR', y) for y in range(Y - 3, Y + 1)]
    for kind, yr in srcs:
        try: p = cvm_zip(kind, yr)
        except Exception as e: print('skip', kind, yr, e); continue
        for s in STMTS:
            d = csv_in_zip(p, f'{kind.lower()}_cia_aberta_{s}_con_{yr}.csv')
            if not len(d): continue
            d = d[d.CNPJ_CIA.isin(cnpjs) & (d.ORDEM_EXERC == 'ÚLTIMO')].copy()
            d['KIND'] = kind; frames[s].append(d)
    out = {}
    for s, L in frames.items():
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

def fix_share_units(o):
    # O formulário da CVM não traz a unidade: algumas companhias (ex.: VALE, ITAÚ) informam
    # a composição do capital em MILHARES de ações. Large caps da B3 têm > 50 mi de ações,
    # então totais abaixo disso são tratados como milhares (×1000) e sinalizados.
    if o and 0 < o['total'] < 50_000_000:
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
                return fix_share_units(o)
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

def corp():
    cad = pd.read_csv(cached(f'{CVM}/CAD/DADOS/cad_cia_aberta.csv', 'cad_cia_aberta.csv', 20), sep=';', encoding='latin1', dtype=str)
    cnpjs = sorted(set(CNPJ.values()))
    st = load_statements(cnpjs)
    docs = ipe(cnpjs)
    raw = yf.download(EQUITIES, period='12y', auto_adjust=False, actions=True, progress=False, group_by='ticker')
    for t in EQUITIES:
        c = CNPJ[t]; o = {'ticker': t, 'cnpj': c, 'generated_at': now_iso()}
        r = cad[(cad.CNPJ_CIA == c)].sort_values('DT_INI_SIT').tail(1)
        if len(r):
            r = r.iloc[0]; o['cad'] = {k: (None if pd.isna(r[k]) else r[k]) for k in ['DENOM_SOCIAL', 'DENOM_COMERC', 'DT_REG', 'DT_CONST', 'SIT', 'CD_CVM', 'SETOR_ATIV', 'TP_MERC', 'CATEG_REG',
                                                                                   'SIT_EMISSOR', 'CONTROLE_ACIONARIO', 'LOGRADOURO', 'COMPL', 'BAIRRO', 'MUN', 'UF', 'CEP', 'DDD_TEL', 'TEL', 'EMAIL', 'TP_RESP', 'RESP', 'EMAIL_RESP', 'AUDITOR']}
        bank = (o.get('cad') or {}).get('SETOR_ATIV', '') .startswith('Bancos') or t.startswith('ITUB')
        o['fundamentals'] = build_fund(c, st, bank)
        o['shares'] = shares_cvm(c)
        tk = yf.Ticker(t)
        try:
            info = tk.info
            o['profile'] = {k: info.get(k) for k in ['longName', 'sector', 'industry', 'fullTimeEmployees', 'website', 'longBusinessSummary', 'city', 'country', 'exchange', 'currency']}
            o['yahoo_stats'] = {k: clean(info.get(k), 4) for k in ['marketCap', 'sharesOutstanding', 'trailingPE', 'priceToBook', 'enterpriseToEbitda', 'dividendYield', 'beta']}
        except Exception as e: print('info', t, e)
        try:
            d = raw[t]
            o['raw_close'] = [[i.strftime('%Y-%m-%d'), clean(v, 4)] for i, v in d['Close'].dropna().items() if i.dayofweek < 5]
            dv = d['Dividends'][d['Dividends'] > 0]; o['dividends'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in dv.items()]
            sp = d['Stock Splits'][d['Stock Splits'] > 0]; o['splits'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in sp.items()]
        except Exception as e: print('raw', t, e)
        try:
            full_div = tk.dividends; o['dividends_full'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in full_div.items()]
            full_sp = tk.splits; o['splits_full'] = [[i.strftime('%Y-%m-%d'), clean(v, 6)] for i, v in full_sp.items()]
        except Exception as e: print('actions', t, e)
        try:
            cal = tk.calendar or {}
            o['calendar'] = {k: [str(x) for x in v] if isinstance(v, list) else str(v) for k, v in cal.items()}
        except Exception as e: print('cal', t, e)
        dd = docs[docs.CNPJ_Companhia == c]
        o['filings'] = [{'date': r.Data_Entrega, 'ref': r.Data_Referencia, 'cat': r.Categoria, 'type': None if pd.isna(r.Tipo) else r.Tipo,
                         'species': None if pd.isna(r.Especie) else r.Especie, 'subject': None if pd.isna(r.Assunto) else r.Assunto[:300],
                         'version': r.Versao, 'link': r.Link_Download} for r in dd.head(400).itertuples()]
        o['source'] = 'CVM – dados abertos (cadastro, IPE, DFP, ITR); Yahoo Finance via yfinance (proventos, desdobramentos, preço sem ajuste, datas de resultado, perfil)'
        save(f'corp/{key(t)}.json', o)

def calendar():
    uni = json.load(open(os.path.join(OUT, 'universe.json')))
    m = ticker_cnpj_map()
    docs = None
    try:
        allc = {m.get(c['cod']) for c in uni['components']} - {None}
        docs = ipe(sorted(allc))
    except Exception as e: print('ipe cal', e)
    rows = []
    for comp in uni['components']:
        t = comp['cod'] + '.SA'; r = {'ticker': comp['cod'], 'name': comp['name'], 'sector': comp['sector'], 'weight': comp['weight']}
        try:
            cal = yf.Ticker(t).calendar or {}
            ed = cal.get('Earnings Date') or []
            r['earnings'] = [str(x) for x in ed]
            r['ex_div'] = str(cal['Ex-Dividend Date']) if cal.get('Ex-Dividend Date') else None
        except Exception as e: r['earnings'] = []
        c = m.get(comp['cod']); r['cnpj'] = c
        if docs is not None and c:
            d = docs[(docs.CNPJ_Companhia == c) & (docs.Categoria.str.contains('Calendário', na=False))]
            if len(d): r['cvm_calendar'] = {'date': d.iloc[0].Data_Entrega, 'link': d.iloc[0].Link_Download}
            d = docs[(docs.CNPJ_Companhia == c) & (docs.Categoria.isin(['Dados Econômico-Financeiros']))]
            if len(d): r['last_results_doc'] = {'date': d.iloc[0].Data_Entrega, 'subject': None if pd.isna(d.iloc[0].Assunto) else d.iloc[0].Assunto[:160], 'link': d.iloc[0].Link_Download}
        rows.append(r)
    save('calendar.json', {'generated_at': now_iso(), 'source': 'Yahoo Finance via yfinance (datas estimadas/confirmadas de resultado e data-ex); CVM IPE (Calendário de Eventos Corporativos)', 'rows': rows})

if __name__ == '__main__':
    import sys
    steps = {'corp': corp, 'calendar': calendar}
    for k in (sys.argv[1:] or steps): step(k, steps[k])
