"""Funções novas, lote 2 (P3-J2): FIIM (monitor de FIIs), FNDS (ranking de fundos) e BKS (painel de bancos).
Só dados abertos e oficiais: CVM (Informe Mensal de FII, Informe Diário de fundos, registro de classes), B3 (COTAHIST
diário) e BCB (IF.data, API Olinda). Cada etapa é independente; se a fonte cair, o JSON anterior continua no ar."""
import io, os, zipfile, datetime as dt
import numpy as np
import pandas as pd
from common import save, cached, get, now_iso, today_brt, step, CACHE
from cotahist import URL as COTA_URL, parse as cota_parse

TODAY = today_brt()
CVM = 'https://dados.cvm.gov.br/dados'

def _f(x):
    """float JSON-seguro (None para NaN/inf)."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if np.isfinite(v) else None

def _r(x, d=4):
    v = _f(x)
    return None if v is None else round(v, d)

# =====================================================================================
# FIIM – CVM Informe Mensal de FII + B3 COTAHIST (preço de tela)
# =====================================================================================
def cotahist_sessions(n=21, days=45):
    """Últimos n pregões publicados do COTAHIST diário: lista [(data, rows)] do mais antigo ao mais novo (cache local)."""
    out = []
    for i in range(days):
        x = TODAY - dt.timedelta(days=i)
        if x.weekday() >= 5: continue
        p = os.path.join(CACHE, f'COTAHIST_D{x:%Y%m%d}.ZIP')
        b = open(p, 'rb').read() if os.path.exists(p) else None
        if not b or b[:2] != b'PK':
            try:
                r = get(COTA_URL.format(x), tries=1, timeout=90)
                if r.content[:2] != b'PK': continue
                b = r.content; open(p, 'wb').write(b)
            except Exception:
                continue
        out.append((x, cota_parse(b)))
        if len(out) >= n: break
    return out[::-1]

def fii_quotes(sessions):
    """ISIN → {code, close, prev_close_1m, adtv (R$/dia, média), sessions}. Só mercado à vista (010), BDI 12 (FII)."""
    acc = {}
    for d, rows in sessions:
        for r in rows:
            if r['tpmerc'] != '010' or r['codbdi'] != '12' or r['last'] <= 0 or not r.get('isin'): continue
            k = max(1, r['fatcot'] or 1)
            a = acc.setdefault(r['isin'], {'code': r['code'], 'closes': [], 'vals': []})
            a['code'] = r['code']; a['closes'].append((d.isoformat(), r['last'] / k)); a['vals'].append(r['vol'])
    n = max(1, len(sessions)); out = {}
    for isin, a in acc.items():
        out[isin] = {'code': a['code'], 'close': a['closes'][-1][1], 'date': a['closes'][-1][0], 'first': a['closes'][0][1],
                     'adtv': sum(a['vals']) / n, 'sessions': len(a['closes'])}
    return out

def _read_inf(year, kind):
    name = f'inf_mensal_fii_{year}.zip'
    z = zipfile.ZipFile(cached(f'{CVM}/FII/DOC/INF_MENSAL/DADOS/{name}', name, 20 if year == TODAY.year else 24 * 30))
    f = [n for n in z.namelist() if kind in n][0]
    return pd.read_csv(z.open(f), sep=';', encoding='latin1', dtype=str)

def _latest_version(d):
    d = d.copy(); d['_v'] = pd.to_numeric(d.Versao, errors='coerce').fillna(0)
    return d.sort_values('_v').drop_duplicates(['CNPJ_Fundo_Classe', 'Data_Referencia'], keep='last').drop(columns='_v')

def fii_table(geral, comp, quotes, min_pl=50e6, min_adtv=50e3):
    """Une cadastro (geral), números do mês (complemento) e preço de tela. Distribuição por cota no mês =
    DY do mês (CVM: rendimento/PL) × valor patrimonial da cota; DY 12m = soma das 12 últimas ÷ preço."""
    geral = _latest_version(geral); comp = _latest_version(comp)
    num = ['Total_Numero_Cotistas', 'Patrimonio_Liquido', 'Cotas_Emitidas', 'Valor_Patrimonial_Cotas', 'Percentual_Dividend_Yield_Mes',
           'Percentual_Rentabilidade_Efetiva_Mes', 'Percentual_Rentabilidade_Patrimonial_Mes', 'Numero_Cotistas_Pessoa_Fisica']
    for c in num:
        if c in comp: comp[c] = pd.to_numeric(comp[c], errors='coerce')
    comp['dist'] = comp.Percentual_Dividend_Yield_Mes * comp.Valor_Patrimonial_Cotas
    g_last = geral.sort_values('Data_Referencia').drop_duplicates('CNPJ_Fundo_Classe', keep='last').set_index('CNPJ_Fundo_Classe')
    rows = []
    for cnpj, h in comp.sort_values('Data_Referencia').groupby('CNPJ_Fundo_Classe'):
        if cnpj not in g_last.index: continue
        g = g_last.loc[cnpj]; isin = str(g.get('Codigo_ISIN') or '').strip()
        q = quotes.get(isin)
        if not q: continue
        last = h.iloc[-1]; pl = _f(last.Patrimonio_Liquido); vpa = _f(last.Valor_Patrimonial_Cotas)
        if not pl or pl < min_pl or not vpa or vpa <= 0 or q['adtv'] < min_adtv: continue
        ref = last.Data_Referencia[:7]
        y_ago = (pd.Period(ref, 'M') - 11).strftime('%Y-%m')
        h12 = h[h.Data_Referencia.str[:7] >= y_ago]
        dist12 = h12.dist.sum(min_count=1); px = q['close']
        months = int(h12.dist.notna().sum())
        h13 = h[h.Data_Referencia.str[:7] >= (pd.Period(ref, 'M') - 12).strftime('%Y-%m')]
        vpa0 = _f(h13.Valor_Patrimonial_Cotas.iloc[0]) if len(h13) >= 13 else None
        rows.append({
            'code': q['code'], 'name': str(g.get('Nome_Fundo_Classe') or '').strip(), 'cnpj': cnpj,
            'segment': str(g.get('Segmento_Atuacao') or '').strip() or None, 'mandate': str(g.get('Mandato') or '').strip() if isinstance(g.get('Mandato'), str) else None,
            'mgmt': str(g.get('Tipo_Gestao') or '').strip() if isinstance(g.get('Tipo_Gestao'), str) else None,
            'admin': str(g.get('Nome_Administrador') or '').strip() if isinstance(g.get('Nome_Administrador'), str) else None,
            'ref': ref, 'price': _r(px, 2), 'price_date': q['date'], 'chg_1m': _r((px / q['first'] - 1) * 100, 2) if q['first'] else None,
            'adtv': _r(q['adtv'], 0), 'nav_q': _r(vpa, 2), 'pvp': _r(px / vpa, 3), 'pl': _r(pl, 0), 'holders': int(last.Total_Numero_Cotistas) if pd.notna(last.Total_Numero_Cotistas) else None,
            'dist_m': _r(last.dist, 4), 'dy_m': _r(last.dist / px * 100, 3) if pd.notna(last.dist) else None,
            'dist_12m': _r(dist12, 4), 'dy_12m': _r(dist12 / px * 100, 2) if months >= 12 and pd.notna(dist12) else None, 'months': months,
            'nav_chg_12m': _r((vpa / vpa0 - 1) * 100, 2) if vpa0 else None,
            'hist': [[r.Data_Referencia[:7], _r(r.Valor_Patrimonial_Cotas, 2), _r(r.dist, 4), int(r.Total_Numero_Cotistas) if pd.notna(r.Total_Numero_Cotistas) else None]
                     for r in h.tail(24).itertuples()],
        })
    rows.sort(key=lambda r: -r['pl'])
    return rows

def fiim():
    geral = pd.concat([_read_inf(y, 'geral') for y in (TODAY.year - 1, TODAY.year)])
    comp = pd.concat([_read_inf(y, 'complemento') for y in (TODAY.year - 2, TODAY.year - 1, TODAY.year)])
    sess = cotahist_sessions(21)
    if not sess: raise RuntimeError('COTAHIST indisponível')
    rows = fii_table(geral, comp, fii_quotes(sess))
    if len(rows) < 50: raise RuntimeError(f'FIIM: só {len(rows)} fundos')
    refs = pd.Series([r['ref'] for r in rows]).value_counts()
    save('fiim.json', {'generated_at': now_iso(), 'ref': refs.index[0], 'price_date': sess[-1][0].isoformat(),
                       'sessions': len(sess), 'count': len(rows),
                       'filters': {'min_pl': 50e6, 'min_adtv': 50e3},
                       'source': 'CVM – Informe Mensal de FII (dados abertos: geral + complemento) e B3 – COTAHIST diário (fechamento oficial). '
                                 'Distribuição/cota = DY do mês informado à CVM × valor patrimonial da cota; DY 12m = soma de 12 meses ÷ preço; P/VP = preço ÷ VP da cota.',
                       'rows': rows})

# =====================================================================================
# FNDS – CVM Informe Diário (cota, PL, captação, cotistas) + registro de classes
# =====================================================================================
CATS = {'Renda Fixa': 'fixed', 'Ações': 'equity', 'Multimercado': 'multi', 'Cambial': 'fx'}

def fund_metrics(dates, quota, pl, net, holders):
    """Métricas de um fundo a partir das séries diárias (ordem crescente). Retornos em %, captações em R$."""
    q = pd.Series(quota, index=pd.to_datetime(dates)).astype(float)
    q = q[q > 0]
    if len(q) < 30: return None
    last = q.index[-1]
    def ret_since(t):
        base = q[q.index <= t]
        return (q.iloc[-1] / base.iloc[-1] - 1) * 100 if len(base) else None
    y_start = pd.Timestamp(last.year, 1, 1) - pd.Timedelta(days=1)
    w = q[q.index > last - pd.DateOffset(years=1)]
    full_year = q.index[0] <= last - pd.DateOffset(years=1) + pd.Timedelta(days=7)
    r = np.log(w).diff().dropna()
    dd = (w / w.cummax() - 1).min() * 100
    n = pd.Series(net, index=pd.to_datetime(dates)).astype(float).fillna(0)
    return {
        'ret_1m': _r(ret_since(last - pd.DateOffset(months=1)), 2),
        'ret_ytd': _r(ret_since(y_start), 2) if q.index[0] <= y_start + pd.Timedelta(days=7) else None,
        'ret_12m': _r(ret_since(last - pd.DateOffset(years=1)), 2) if full_year else None,
        'vol_12m': _r(r.std() * np.sqrt(252) * 100, 2) if len(r) > 20 else None,
        'mdd_12m': _r(dd, 2), 'pl': _r(pl[-1], 0), 'holders': int(holders[-1]) if holders[-1] == holders[-1] and holders[-1] is not None else None,
        'flow_1m': _r(n[n.index > last - pd.DateOffset(months=1)].sum(), 0), 'flow_12m': _r(n[n.index > last - pd.DateOffset(years=1)].sum(), 0),
        'date': last.strftime('%Y-%m-%d'),
    }

def fnds(top=60, min_pl=300e6, min_holders=100):
    reg = pd.read_csv(zipfile.ZipFile(cached(f'{CVM}/FI/CAD/DADOS/registro_fundo_classe.zip', 'registro_fundo_classe.zip', 20)).open('registro_classe.csv'),
                      sep=';', encoding='latin1', dtype=str,
                      usecols=['CNPJ_Classe', 'Denominacao_Social', 'Classificacao', 'Classificacao_Anbima', 'Exclusivo', 'Forma_Condominio', 'Situacao', 'Publico_Alvo'])
    reg['CNPJ_Classe'] = reg.CNPJ_Classe.str.replace(r'\D', '', regex=True).str.zfill(14)
    reg = reg.drop_duplicates('CNPJ_Classe', keep='last').set_index('CNPJ_Classe')
    frames = []
    for i in range(13, -1, -1):
        y, m = TODAY.year, TODAY.month - i
        while m <= 0: m += 12; y -= 1
        name = f'inf_diario_fi_{y}{m:02d}.zip'
        try:
            p = cached(f'{CVM}/FI/DOC/INF_DIARIO/DADOS/{name}', name, 20 if i < 2 else 24 * 30)
        except Exception as e: print('skip', name, e); continue
        z = zipfile.ZipFile(p)
        d = pd.read_csv(z.open(z.namelist()[0]), sep=';', encoding='latin1', dtype={'CNPJ_FUNDO_CLASSE': str, 'ID_SUBCLASSE': str},
                        usecols=['CNPJ_FUNDO_CLASSE', 'ID_SUBCLASSE', 'DT_COMPTC', 'VL_QUOTA', 'VL_PATRIM_LIQ', 'CAPTC_DIA', 'RESG_DIA', 'NR_COTST'])
        d = d[d.ID_SUBCLASSE.isna()].drop(columns='ID_SUBCLASSE')
        frames.append(d)
    d = pd.concat(frames); d['CN'] = d.CNPJ_FUNDO_CLASSE.str.replace(r'\D', '', regex=True).str.zfill(14)
    d['DT'] = pd.to_datetime(d.DT_COMPTC)
    cnt = d.groupby('DT').size(); full = cnt[cnt >= 0.8 * cnt.tail(30).median()]; last = full.index.max()
    d = d[d.DT <= last]
    snap = d[d.DT == last].set_index('CN')
    r = reg.reindex(snap.index)
    ok = (snap.VL_PATRIM_LIQ >= min_pl) & (snap.NR_COTST >= min_holders) & r.Classificacao.isin(list(CATS)) & \
         (r.Exclusivo.fillna('N') != 'S') & (r.Forma_Condominio.fillna('').str.startswith('Aberto'))
    keep = set(snap.index[ok.fillna(False).values])
    d = d[d.CN.isin(keep)].sort_values('DT')
    d['NET'] = d.CAPTC_DIA.fillna(0) - d.RESG_DIA.fillna(0)
    out = {k: [] for k in CATS.values()}
    for cn, h in d.groupby('CN'):
        m = fund_metrics(h.DT.values, h.VL_QUOTA.values, h.VL_PATRIM_LIQ.values, h.NET.values, h.NR_COTST.values)
        if not m: continue
        info = reg.loc[cn]; cat = CATS[info.Classificacao]
        w = h.set_index('DT').VL_QUOTA.resample('W-FRI').last().dropna().tail(53)
        out[cat].append({'cnpj': cn, 'name': str(info.Denominacao_Social).strip(), 'anbima': info.Classificacao_Anbima if isinstance(info.Classificacao_Anbima, str) else None,
                         **m, 'spark': [[x.strftime('%Y-%m-%d'), _r(v / w.iloc[0] * 100, 3)] for x, v in w.items()]})
    for k in out:
        out[k] = sorted(out[k], key=lambda x: -(x['pl'] or 0))[:top]
    if sum(len(v) for v in out.values()) < 40: raise RuntimeError('FNDS: poucos fundos')
    save('fnds.json', {'generated_at': now_iso(), 'date': last.strftime('%Y-%m-%d'), 'universe': len(keep),
                       'filters': {'min_pl': min_pl, 'min_holders': min_holders, 'top': top},
                       'source': 'CVM – Informe Diário de fundos (dados abertos: cota, PL, captação, resgate, cotistas) + registro de classes CVM (RCVM 175). '
                                 'Classes abertas e não exclusivas; classificação CVM. Retorno da cota (líquido de taxas, antes de impostos).',
                       'cats': out})

# =====================================================================================
# BKS – BCB IF.data (API Olinda): conglomerados prudenciais
# =====================================================================================
OLINDA = 'https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata'
BKS_COLS = {'Ativo Total': 'assets', 'Carteira de Crédito': 'credit', 'Patrimônio Líquido': 'equity', 'Lucro Líquido': 'net_income',
            'Captações': 'funding', 'Índice de Basileia': 'basel', 'Índice de Imobilização': 'fixed_ratio'}

def quarters_back(n, today=None):
    """Fim de trimestre (AAAAMM) dos n trimestres até hoje, mais recente primeiro."""
    t = today or TODAY; y, m = t.year, (t.month - 1) // 3 * 3
    if m == 0: y, m = y - 1, 12
    out = []
    for _ in range(n):
        out.append(f'{y}{m:02d}'); m -= 3
        if m == 0: y, m = y - 1, 12
    return out

def ann_factor(am):
    """IF.data: lucro líquido acumulado no semestre (mar/set = 3 meses; jun/dez = 6) → fator de anualização."""
    return 4.0 if am[-2:] in ('03', '09') else 2.0


def ifdata(am, kind='valores'):
    import json as _j
    p = os.path.join(CACHE, f'ifdata_{kind}_{am}.json')
    if os.path.exists(p) and os.path.getsize(p) > 1000: return _j.load(open(p))
    if kind == 'valores':
        url = f"{OLINDA}/IfDataValores(AnoMes=@AnoMes,TipoInstituicao=@TipoInstituicao,Relatorio=@Relatorio)?@AnoMes={am}&@TipoInstituicao=1&@Relatorio='1'&$format=json"
    else:
        url = f"{OLINDA}/IfDataCadastro(AnoMes=@AnoMes)?@AnoMes={am}&$format=json"
    v = get(url, tries=2, timeout=120).json().get('value', [])
    if len(v) > 10: _j.dump(v, open(p, 'w'))
    return v

def bank_table(vals_by_q, cad, top=40):
    """vals_by_q: {AnoMes: [linhas IfDataValores]}, mais recente primeiro. Devolve linhas por banco com série trimestral."""
    names = {}; seg = {}
    for c in cad:
        names.setdefault(c['CodInst'], c.get('NomeInstituicao'))
        if c.get('Sr'): seg.setdefault(c['CodInst'], c['Sr'])
        if c.get('CodConglomeradoPrudencial') and c.get('Sr'): seg.setdefault(c['CodConglomeradoPrudencial'], c['Sr'])
    per = {}
    for am, rows in vals_by_q.items():
        for x in rows:
            k = BKS_COLS.get((x.get('NomeColuna') or '').strip())
            if not k: continue
            per.setdefault(x['CodInst'], {}).setdefault(am, {})[k] = _f(x.get('Saldo'))
    qs = list(vals_by_q)
    last = qs[0]
    cands = [(c, d[last]) for c, d in per.items() if last in d and (d[last].get('assets') or 0) > 0]
    cands.sort(key=lambda t: -t[1]['assets'])
    out = []
    for c, v in cands[:top]:
        h = per[c]; yago = next((q for q in qs if int(q) == int(last) - 100), None)
        cr0 = h.get(yago, {}).get('credit') if yago else None
        eq = v.get('equity'); ni = v.get('net_income')
        out.append({'id': c, 'name': (names.get(c) or c).replace(' - PRUDENCIAL', ''), 'seg': seg.get(c),
                    'assets': _r(v.get('assets'), 0), 'credit': _r(v.get('credit'), 0), 'equity': _r(eq, 0), 'funding': _r(v.get('funding'), 0),
                    'net_income': _r(ni, 0), 'roe': _r(ni * ann_factor(last) / eq * 100, 2) if eq and ni is not None and eq > 0 else None,
                    'basel': _r(v['basel'] * 100, 2) if v.get('basel') is not None else None,
                    'fixed_ratio': _r(v['fixed_ratio'] * 100, 2) if v.get('fixed_ratio') is not None else None,
                    'credit_yoy': _r((v['credit'] / cr0 - 1) * 100, 2) if cr0 and v.get('credit') else None,
                    'credit_assets': _r(v['credit'] / v['assets'] * 100, 2) if v.get('credit') and v.get('assets') else None,
                    'hist': [[q, _r((h[q].get('basel') or 0) * 100, 2) if h[q].get('basel') is not None else None, _r(h[q].get('credit'), 0),
                              _r(h[q].get('net_income'), 0)] for q in reversed(qs) if q in h]})
    return out

def bks():
    vals = {}
    for am in quarters_back(8):
        try:
            v = ifdata(am)
        except Exception as e: print('ifdata', am, e); continue
        if len(v) > 1000: vals[am] = v
    if not vals: raise RuntimeError('IF.data indisponível')
    last = next(iter(vals)); cad = ifdata(last, 'cadastro')
    rows = bank_table(vals, cad)
    if len(rows) < 20: raise RuntimeError('BKS: poucos bancos')
    save('bks.json', {'generated_at': now_iso(), 'ref': last, 'quarters': list(reversed(list(vals))),
                      'source': 'BCB – IF.data (API Olinda, dados abertos), relatório Resumo dos conglomerados prudenciais. '
                                'Valores em R$; lucro líquido acumulado no semestre; ROE anualizado = lucro × (12 ÷ meses no semestre) ÷ PL.',
                      'rows': rows})

if __name__ == '__main__':
    step('fiim', fiim); step('fnds', fnds); step('bks', bks)
