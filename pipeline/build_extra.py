"""Funções v4: GIP (intradiário), GLCO (futuros de commodities), ECFC (Focus anual completo), ECST (indicadores BR/EUA),
HDS (acionistas – CVM FRE), FA (demonstrações detalhadas – CVM DFP/ITR) e EQS/RV/MOST (screener do IBOV).
Cada etapa é independente e mantém o JSON anterior se a fonte falhar."""
import datetime as dt, math, sys, json, os, urllib.parse
import pandas as pd, yfinance as yf
from common import save, get_json, load_prev, clean, step, now_iso, cached, corp_map, CNPJ, EQUITIES, OUT, today_brt
from build_corp import csv_in_zip, cvm_zip, key, ticker_cnpj_map, load_statements, build_fund, shares_cvm, fix_share_units, is_bank, Y

def bars(df):
    out = []
    for i, r in df.dropna(subset=['Close']).iterrows():
        v = r['Volume']
        out.append([int(i.timestamp()), clean(r['Open'], 4), clean(r['High'], 4), clean(r['Low'], 4), clean(r['Close'], 4), 0 if pd.isna(v) else int(v)])
    return out

# ---------------- GIP: barras intradiárias (Yahoo: 1m só ~7 dias, 5m só 60 dias) ----------------
def intraday():
    ok = 0
    for t in EQUITIES + ['^BVSP']:
        o = {'ticker': t, 'generated_at': now_iso(), 'tz': 'America/Sao_Paulo',
             'source': 'Yahoo Finance via yfinance (barras intradiárias com atraso; 1m: ~5 pregões; 5m: ~60 dias)'}
        for lab, iv, per in [('m1', '1m', '5d'), ('m5', '5m', '60d')]:
            try:
                d = yf.Ticker(t).history(interval=iv, period=per, auto_adjust=False, prepost=False)
                if len(d): d.index = d.index.tz_convert('America/Sao_Paulo'); o[lab] = bars(d)
            except Exception as e: print('intraday', t, iv, e)
        if o.get('m1') or o.get('m5'): save(f'intraday/{key(t)}.json', o); ok += 1
    if not ok: raise RuntimeError('nenhuma série intradiária')

# ---------------- GLCO: futuros de commodities (contrato contínuo do Yahoo) ----------------
FUT = [('Energia', 'CL=F', 'Petróleo WTI', 'NYMEX', 'US$/bbl'), ('Energia', 'BZ=F', 'Petróleo Brent', 'ICE', 'US$/bbl'),
       ('Energia', 'NG=F', 'Gás natural', 'NYMEX', 'US$/MMBtu'), ('Energia', 'RB=F', 'Gasolina RBOB', 'NYMEX', 'US$/gal'),
       ('Energia', 'HO=F', 'Diesel (heating oil)', 'NYMEX', 'US$/gal'),
       ('Metais', 'GC=F', 'Ouro', 'COMEX', 'US$/oz t'), ('Metais', 'SI=F', 'Prata', 'COMEX', 'US$/oz t'), ('Metais', 'HG=F', 'Cobre', 'COMEX', 'US$/lb'),
       ('Metais', 'PL=F', 'Platina', 'NYMEX', 'US$/oz t'), ('Metais', 'PA=F', 'Paládio', 'NYMEX', 'US$/oz t'),
       ('Agrícolas', 'ZC=F', 'Milho', 'CBOT', 'US¢/bu'), ('Agrícolas', 'ZW=F', 'Trigo', 'CBOT', 'US¢/bu'), ('Agrícolas', 'ZS=F', 'Soja', 'CBOT', 'US¢/bu'),
       ('Agrícolas', 'KC=F', 'Café arábica', 'ICE', 'US¢/lb'), ('Agrícolas', 'SB=F', 'Açúcar nº 11', 'ICE', 'US¢/lb'), ('Agrícolas', 'CC=F', 'Cacau', 'ICE', 'US$/t'),
       ('Agrícolas', 'CT=F', 'Algodão', 'ICE', 'US¢/lb'), ('Pecuária', 'LE=F', 'Boi gordo (EUA)', 'CME', 'US¢/lb'), ('Pecuária', 'HE=F', 'Suíno magro', 'CME', 'US¢/lb')]

def futures():
    raw = yf.download([f[1] for f in FUT], period='2y', auto_adjust=False, progress=False, group_by='ticker')
    rows = []
    for grp, t, name, exch, unit in FUT:
        try: c = raw[t]['Close'].dropna()
        except Exception: continue
        if len(c) < 30: continue
        last = float(c.iloc[-1]); d0 = c.index[-1]
        def at(days):
            s = c[c.index <= d0 - pd.Timedelta(days=days)]; return float(s.iloc[-1]) if len(s) else None
        ytd = c[c.index < pd.Timestamp(d0.year, 1, 1)]
        y1 = c[c.index > d0 - pd.Timedelta(days=365)]
        pc = lambda b: clean((last / b - 1) * 100, 2) if b else None
        rows.append({'group': grp, 'ticker': t, 'name': name, 'exchange': exch, 'unit': unit, 'date': d0.strftime('%Y-%m-%d'),
                     'last': clean(last, 4), 'chg': clean(last - float(c.iloc[-2]), 4), 'pct': pc(float(c.iloc[-2])), 'w1': pc(at(7)), 'm1': pc(at(30)), 'm3': pc(at(91)),
                     'ytd': pc(float(ytd.iloc[-1]) if len(ytd) else None), 'y1': pc(at(365)), 'hi52': clean(y1.max(), 4), 'lo52': clean(y1.min(), 4),
                     'series': [[i.strftime('%Y-%m-%d'), clean(v, 4)] for i, v in c.tail(260).items()]})
    if len(rows) < 10: raise RuntimeError(f'só {len(rows)} futuros')
    save('futures.json', {'generated_at': now_iso(), 'rows': rows,
                          'source': 'Yahoo Finance via yfinance – contrato futuro contínuo (front month, =F), fechamento diário com atraso'})

# ---------------- ECFC: Focus anual completo (BCB Olinda ExpectativasMercadoAnuais) ----------------
OL = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/'
FOCUS_IND = ['IPCA', 'PIB Total', 'Selic', 'Câmbio', 'IGP-M', 'IPCA Administrados', 'Conta corrente', 'Balança comercial',
             'Investimento direto no país', 'Dívida líquida do setor público', 'Resultado primário', 'Resultado nominal']

def focus():
    since = (today_brt() - dt.timedelta(days=400)).isoformat()
    out = {}
    y0 = today_brt().year; refs = [str(y) for y in range(y0, y0 + 4)]
    for ind in FOCUS_IND:
        flt = f"Indicador eq '{ind}' and baseCalculo eq 0 and Data ge '{since}'"
        url = (OL + 'ExpectativasMercadoAnuais?' + urllib.parse.urlencode({'$top': 5000, '$format': 'json', '$orderby': 'Data desc', '$filter': flt,
               '$select': 'Indicador,IndicadorDetalhe,Data,DataReferencia,Media,Mediana,DesvioPadrao,Minimo,Maximo,numeroRespondentes'}, quote_via=urllib.parse.quote))
        try: v = get_json(url)['value']
        except Exception as e: print('focus', ind, e); continue
        dets = sorted({r.get('IndicadorDetalhe') or '' for r in v})
        if len(dets) > 1:  # ex.: Balança comercial (Saldo/Exportações/Importações) → fica com o saldo/total
            pick = next((d for d in dets if d in ('Saldo', '')), dets[0]); v = [r for r in v if (r.get('IndicadorDetalhe') or '') == pick]
        if not v: continue
        hist = {}
        for r in v:
            if r['DataReferencia'] in refs: hist.setdefault(r['DataReferencia'], []).append([r['Data'], clean(r['Mediana'], 4)])
        for k in hist: hist[k].sort()
        last = v[0]['Data']
        snap = {}
        for r in v:
            if r['Data'] == last and r['DataReferencia'] in refs:
                snap[r['DataReferencia']] = {'mean': clean(r['Media'], 4), 'median': clean(r['Mediana'], 4), 'sd': clean(r['DesvioPadrao'], 4),
                                             'min': clean(r['Minimo'], 4), 'max': clean(r['Maximo'], 4), 'n': r['numeroRespondentes']}
        def med_at(ref, days):
            target = (dt.date.fromisoformat(last) - dt.timedelta(days=days)).isoformat()
            h = [p for p in hist.get(ref, []) if p[0] <= target]
            return h[-1][1] if h else None
        for ref in snap: snap[ref]['w1'] = med_at(ref, 7); snap[ref]['w4'] = med_at(ref, 28)
        out[ind] = {'date': last, 'detail': v[0].get('IndicadorDetalhe'), 'snap': snap, 'hist': {r: h[-260:] for r, h in hist.items()}}
    if len(out) < 4: raise RuntimeError('Focus incompleto')
    save('focus.json', {'generated_at': now_iso(), 'refs': refs, 'indicators': out,
                        'source': 'BCB – Sistema Expectativas de Mercado (Focus), API Olinda ExpectativasMercadoAnuais (base de cálculo 0)'})

# ---------------- ECST: indicadores BR (IBGE SIDRA) — BCB SGS e FRED já estão em econ.json ----------------
SIDRA = [('pib_qq', 'PIB – variação trimestral (dessaz.)', '% t/t', 't/5932/n1/all/v/6564/p/last%2012/c11255/90707'),
         ('pib_aa', 'PIB – vs. mesmo tri do ano anterior', '% a/a', 't/5932/n1/all/v/6561/p/last%2012/c11255/90707'),
         ('desemprego', 'Desocupação (PNAD trimestre móvel)', '%', 't/6381/n1/all/v/4099/p/last%2024'),
         ('pim', 'Produção industrial (PIM-PF) m/m dessaz.', '% m/m', 't/8888/n1/all/v/11601/p/last%2024/c544/129314'),
         ('pmc', 'Varejo restrito (PMC) m/m dessaz.', '% m/m', 't/8880/n1/all/v/11708/p/last%2024/c11046/56734'),
         ('pms', 'Volume de serviços (PMS) m/m dessaz.', '% m/m', 't/5906/n1/all/v/11623/p/last%2024/c11046/56726'),
         ('ipca15', 'IPCA-15 – variação mensal', '% m/m', 't/3065/n1/all/v/355/p/last%2024')]

def ecst():
    prev = load_prev('ecst.json') or {}
    old = {s['id']: s for s in prev.get('sidra', [])}
    out = []
    for sid, name, unit, path in SIDRA:
        try:
            v = get_json('https://apisidra.ibge.gov.br/values/' + path)[1:]
            pts = [[r['D3C'], r['D3N'], clean(r['V'], 3)] for r in v if r['V'] not in ('...', '-', 'X', '..')]
            if not pts: raise RuntimeError('vazio')
            out.append({'id': sid, 'name': name, 'unit': unit, 'points': pts, 'source': 'IBGE SIDRA tabela ' + path.split('/')[1]})
        except Exception as e:
            print('sidra', sid, e)
            if sid in old: out.append(old[sid] | {'stale': True})
    if not out: raise RuntimeError('SIDRA indisponível')
    save('ecst.json', {'generated_at': now_iso(), 'sidra': out, 'source': 'IBGE SIDRA (PIB, PNAD, PIM-PF, PMC, PMS, IPCA-15); BCB SGS e FRED em econ.json'})

# ---------------- HDS: posição acionária (CVM FRE) ----------------
def holders():
    d = pd.DataFrame()
    for yr in (Y, Y - 1):
        try:
            d = csv_in_zip(cvm_zip('FRE', yr), f'fre_cia_aberta_posicao_acionaria_{yr}.csv')
            if len(d): break
        except Exception as e: print('fre', yr, e)
    if not len(d): raise RuntimeError('FRE indisponível')
    n = 0; M = corp_map()
    for t in sorted(M):
        g = d[d.CNPJ_Companhia == M[t]]
        if not len(g): continue
        g = g[g.Data_Referencia == g.Data_Referencia.max()]
        g = g[g.Versao.astype(int) == g.Versao.astype(int).max()]
        f = lambda x: clean(x, 4) if pd.notna(x) and x != '' else None
        s = lambda x: None if pd.isna(x) else x
        def row(r):
            return {'name': s(r.get('Acionista')), 'id': s(r.get('ID_Acionista')), 'parent': s(r.get('ID_Acionista_Relacionado')),
                    'controller': s(r.get('Acionista_Controlador')), 'foreign': s(r.get('Acionista_Estrangeiro')),
                    'qty_on': f(r.get('Quantidade_Acao_Ordinaria_Circulacao')), 'pct_on': f(r.get('Percentual_Acao_Ordinaria_Circulacao')),
                    'qty_pn': f(r.get('Quantidade_Acao_Preferencial_Circulacao')), 'pct_pn': f(r.get('Percentual_Acao_Preferencial_Circulacao')),
                    'qty': f(r.get('Quantidade_Total_Acoes_Circulacao')), 'pct': f(r.get('Percentual_Total_Acoes_Circulacao')),
                    'updated': s(r.get('Data_Ultima_Alteracao'))}
        allr = [row(r) for _, r in g.iterrows()]
        try: save(f'holders/{key(t)}.json', {'ticker': t, 'cnpj': M[t], 'generated_at': now_iso(), 'ref_date': g.Data_Referencia.iloc[0],
                                        'version': int(g.Versao.iloc[0]), 'top': [r for r in allr if not r['parent']], 'all': allr,
                                        'source': f'CVM – Formulário de Referência (FRE {yr}), item posição acionária'})
        except ValueError as e: print('holders', t, e); continue   # um emissor com dado inválido não derruba os demais
        n += 1
    if not n: raise RuntimeError('nenhuma empresa no FRE')

# ---------------- FA: demonstrações detalhadas (contas níveis 1–3) ----------------
def _mdiff(a, b): a, b = pd.Timestamp(a), pd.Timestamp(b); return (b.year - a.year) * 12 + b.month - a.month + 1

def fa():
    M = corp_map()
    st = load_statements(sorted(set(M.values())))
    names = {'DRE': 'Demonstração do resultado', 'BPA': 'Balanço – ativo', 'BPP': 'Balanço – passivo e PL', 'DFC_MI': 'Fluxo de caixa (método indireto)'}
    for t in sorted(M):
        c = M[t]; out = {'ticker': t, 'cnpj': c, 'generated_at': now_iso(), 'stmts': {}}
        for s in names:
            d = st[s]
            if not len(d): continue
            d = d[(d.CNPJ_CIA == c) & (d.CD_CONTA.str.count(r'\.') <= 2)].copy()
            if not len(d): continue
            flow = s in ('DRE', 'DFC_MI'); vals = {}
            for (kind, fim), g in d.groupby(['KIND', 'DT_FIM_EXERC']):
                if flow:
                    m = g.apply(lambda r: _mdiff(r.DT_INI_EXERC, r.DT_FIM_EXERC), axis=1)
                    if kind == 'DFP': vals[('A', fim)] = g[m == 12]
                    else:
                        y = g[g.DT_INI_EXERC.str[5:] == '01-01']
                        if len(y): vals[('YTD', fim)] = y
                        if (m == 3).any(): vals[('Q', fim)] = g[m == 3]
                else:
                    vals[('A' if kind == 'DFP' else 'Q', fim)] = g
                    if kind == 'DFP': vals[('Q', fim)] = g
            vals = {k: {r.CD_CONTA: float(r.VL) for r in g.itertuples()} for k, g in vals.items()}
            if flow:  # trimestre isolado a partir de acumulados: Q = YTD(m) − YTD(m−3); 4T = anual − 9M
                ytd = {f[:7]: v for (typ, f), v in vals.items() if typ == 'YTD'}
                for (typ, fim), v in list(vals.items()):
                    yy, mm = fim[:4], int(fim[5:7])
                    if typ == 'YTD' and ('Q', fim) not in vals:
                        if mm == 3: vals[('Q', fim)] = v
                        elif f'{yy}-{mm - 3:02d}' in ytd:
                            p = ytd[f'{yy}-{mm - 3:02d}']; vals[('Q', fim)] = {k: v[k] - p.get(k, 0) for k in v}
                    if typ == 'A' and f'{yy}-09' in ytd:
                        p = ytd[f'{yy}-09']; vals[('Q', fim)] = {k: v[k] - p.get(k, 0) for k in v}
            labels = d.sort_values('VERSAO').drop_duplicates('CD_CONTA', keep='last').set_index('CD_CONTA').DS_CONTA.to_dict()
            res = {}
            for typ, n in (('A', 6), ('Q', 12)):
                ps = sorted(f for (t2, f) in vals if t2 == typ)[-n:]
                codes = sorted({k for p in ps for k in vals[(typ, p)]}, key=lambda x: [int(i) for i in x.split('.')])
                res['annual' if typ == 'A' else 'quarterly'] = {'periods': ps, 'rows': [
                    {'code': k, 'name': labels.get(k, k), 'level': k.count('.') + 1, 'vals': [clean(vals[(typ, p)].get(k), 0) for p in ps]} for k in codes]}
            out['stmts'][s] = {'name': names[s], **res}
        out['source'] = 'CVM – dados abertos DFP (anual) e ITR (trimestral), demonstrações consolidadas, contas até o 3º nível'
        out['note'] = 'Valores em R$. Trimestres de fluxo (DRE/DFC) derivados dos acumulados quando o ITR não traz o trimestre isolado; 4º tri = anual − 9 meses.'
        save(f'fa/{key(t)}.json', out)

# ---------------- EQS/RV/MOST: screener do IBOV (CVM + Yahoo) ----------------
def screener():
    u = json.load(open(os.path.join(OUT, 'universe.json'), encoding='utf-8'))
    comps = u['components']
    m = ticker_cnpj_map()
    cn = {c['cod']: m.get(c['cod']) for c in comps}
    st = load_statements(sorted({v for v in cn.values() if v}))
    cad = pd.read_csv(cached('https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv', 'cad_cia_aberta.csv', 20), sep=';', encoding='latin1', dtype=str)
    setor = cad.sort_values('DT_INI_SIT').drop_duplicates('CNPJ_CIA', keep='last').set_index('CNPJ_CIA').SETOR_ATIV.to_dict()
    raw = yf.download([c['cod'] + '.SA' for c in comps], period='1y', auto_adjust=False, actions=True, progress=False, group_by='ticker')
    fund_cache, share_cache, rows = {}, {}, []
    off = (load_prev('official_close.json') or {}).get('closes') or {}
    for c in comps:
        cod = c['cod']; cnpj = cn.get(cod); px = None; pcl = None
        r = {'cod': cod, 'name': c['name'], 'sector': c['sector'], 'subsector': c['subsector'], 'weight': c['weight'], 'cnpj': cnpj}
        try:
            d = raw[cod + '.SA'].dropna(subset=['Close']); cl = d.Close
            px = float(cl.iloc[-1]); pcl = float(cl.iloc[-2]); r.update({'price': clean(px, 2), 'date': d.index[-1].strftime('%Y-%m-%d'), 'pct': clean((px / cl.iloc[-2] - 1) * 100, 2),
                'vol_fin': clean(float(cl.iloc[-1] * d.Volume.iloc[-1]), 0), 'vol_qty': int(d.Volume.iloc[-1]),
                'vol_fin_avg30': clean(float((cl * d.Volume).tail(30).mean()), 0), 'hi52': clean(d.High.max(), 2), 'lo52': clean(d.Low.min(), 2),
                'm1': clean((px / cl[cl.index <= d.index[-1] - pd.Timedelta(days=30)].iloc[-1] - 1) * 100, 2), 'y1': clean((px / cl.iloc[0] - 1) * 100, 2)})
            b = cl[cl.index < pd.Timestamp(d.index[-1].year, 1, 1)]
            r['ytd'] = clean((px / b.iloc[-1] - 1) * 100, 2) if len(b) else None
            dv = d['Dividends'][d['Dividends'] > 0]; r['div12m'] = clean(float(dv.sum()), 4); r['dy'] = clean(float(dv.sum()) / px * 100, 2)
        except Exception as e: print('px', cod, e)
        b = off.get(cod)
        if b and px and b['time'] >= r.get('date', ''):
            base = px if b['time'] > r['date'] else pcl   # Yahoo ainda sem o último pregão → a base é a última barra dele
            r['pct'] = clean((b['close'] / base - 1) * 100, 2)
            px = b['close']; r.update({'price': clean(px, 2), 'date': b['time'], 'official': True, 'vol_fin': clean(b['value'], 0), 'vol_qty': int(b['volume'])})
        if cnpj and px:
            bank = (setor.get(cnpj) or '').startswith('Bancos') or 'Interms Financs' in c['subsector']
            if cnpj not in fund_cache:
                try: fund_cache[cnpj] = build_fund(cnpj, st, bank)
                except Exception as e: print('fund', cod, e); fund_cache[cnpj] = None
                cp = load_prev(f'corp/{key(cod + ".SA")}.json') or {}
                if cp.get('shares'): share_cache[cnpj] = cp['shares']   # já conferida (unidade) no build_corp
                else:
                    try: share_cache[cnpj] = fix_share_units(shares_cvm(cnpj))
                    except Exception: share_cache[cnpj] = None
            f, sh = fund_cache[cnpj], share_cache[cnpj]; r['bank'] = bank
            if sh:
                n = sh['equiv'] if 'equiv' in sh else sh['total'] - (sh.get('treasury') or 0)
                if n: r['shares'] = n; r['mcap'] = clean(px * n, 0)
            if f and f['quarterly']:
                q = [x for x in f['quarterly'] if x.get('net') is not None][-4:]
                bal = f['quarterly'][-1]; r['fund_period'] = bal['period']
                ttm = lambda k: sum(x[k] for x in q) if len(q) == 4 and all(x.get(k) is not None for x in q) else None
                rev, ebitda, net = ttm('revenue'), ttm('ebitda'), ttm('net')
                r.update({'rev_ttm': rev, 'ebitda_ttm': ebitda, 'net_ttm': net, 'equity': bal.get('equity'), 'netdebt': bal.get('netdebt')})
                mc = r.get('mcap'); eq = bal.get('equity')
                if mc:
                    r['pe'] = clean(mc / net, 2) if net and net > 0 else None
                    r['pb'] = clean(mc / eq, 2) if eq and eq > 0 else None
                    if ebitda and ebitda > 0 and bal.get('netdebt') is not None:
                        r['ev'] = clean(mc + bal['netdebt'] + (bal.get('minority') or 0), 0); r['ev_ebitda'] = clean(r['ev'] / ebitda, 2)
                r['roe'] = clean(net / eq * 100, 2) if net is not None and eq and eq > 0 else None
                r['net_margin'] = clean(net / rev * 100, 2) if net is not None and rev and rev > 0 and not bank else None
                r['ebitda_margin'] = clean(ebitda / rev * 100, 2) if ebitda and rev and rev > 0 else None
                r['nd_ebitda'] = clean(bal['netdebt'] / ebitda, 2) if bal.get('netdebt') is not None and ebitda and ebitda > 0 else None
        rows.append(r)
    ok = sum(1 for r in rows if r.get('pe') is not None or r.get('pb') is not None)
    print('empresas com múltiplos:', ok, '/', len(rows))
    if ok < 30: raise RuntimeError(f'só {ok} empresas com múltiplos')
    save('screener.json', {'generated_at': now_iso(), 'date': max(r.get('date', '') for r in rows), 'rows': rows,
                           'source': 'CVM – DFP/ITR (resultado 12m = soma dos 4 últimos trimestres; balanço do último ITR), FCA (ticker→CNPJ), composição do capital; B3 – carteira do IBOV; Yahoo Finance – preço, volume, proventos 12m',
                           'note': 'Valor de mercado ≈ preço da classe × total de ações ex-tesouraria (aproximação quando ON e PN têm preços diferentes). DY = proventos pagos nos últimos 12 meses ÷ preço.'})

STEPS = {'intraday': intraday, 'futures': futures, 'focus': focus, 'ecst': ecst, 'holders': holders, 'fa': fa, 'screener': screener}
if __name__ == '__main__':
    res = [step(k, STEPS[k]) for k in (sys.argv[1:] or STEPS)]
    sys.exit(0 if all(res) else 1)  # o JSON anterior de cada etapa que falhou continua publicado
