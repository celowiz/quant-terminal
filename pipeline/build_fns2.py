"""Funções novas, lote 2 (P3-J1): COT (posições de especuladores na CFTC) e 13F (carteiras trimestrais de gestores
dos EUA na SEC). Só dados abertos e oficiais; cada etapa é independente e, se a fonte cair, o JSON anterior continua."""
import datetime as dt, re, time, xml.etree.ElementTree as ET
import requests
from common import save, clean, now_iso, today_brt, step

TODAY = today_brt()

# =====================================================================================
# COT – Commitments of Traders (CFTC Public Reporting, relatório Legacy, só futuros)
# =====================================================================================
COT_API = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json'
# (código CFTC, símbolo curto, nome EN, nome PT, grupo)
COT_MARKETS = [
    ('067651', 'CL', 'WTI crude oil', 'Petróleo WTI', 'energy'),
    ('023651', 'NG', 'Natural gas (Henry Hub)', 'Gás natural (Henry Hub)', 'energy'),
    ('111659', 'RB', 'RBOB gasoline', 'Gasolina RBOB', 'energy'),
    ('022651', 'HO', 'ULSD heating oil', 'Diesel (ULSD)', 'energy'),
    ('088691', 'GC', 'Gold', 'Ouro', 'metals'),
    ('084691', 'SI', 'Silver', 'Prata', 'metals'),
    ('085692', 'HG', 'Copper', 'Cobre', 'metals'),
    ('076651', 'PL', 'Platinum', 'Platina', 'metals'),
    ('002602', 'ZC', 'Corn', 'Milho', 'ags'),
    ('005602', 'ZS', 'Soybeans', 'Soja', 'ags'),
    ('007601', 'ZL', 'Soybean oil', 'Óleo de soja', 'ags'),
    ('001602', 'ZW', 'Wheat (SRW)', 'Trigo (SRW)', 'ags'),
    ('080732', 'SB', 'Sugar No. 11', 'Açúcar nº 11', 'ags'),
    ('083731', 'KC', 'Coffee C', 'Café arábica (C)', 'ags'),
    ('073732', 'CC', 'Cocoa', 'Cacau', 'ags'),
    ('033661', 'CT', 'Cotton No. 2', 'Algodão nº 2', 'ags'),
    ('057642', 'LE', 'Live cattle', 'Boi gordo (EUA)', 'ags'),
    ('099741', '6E', 'Euro', 'Euro', 'fx'),
    ('097741', '6J', 'Japanese yen', 'Iene', 'fx'),
    ('096742', '6B', 'British pound', 'Libra', 'fx'),
    ('090741', '6C', 'Canadian dollar', 'Dólar canadense', 'fx'),
    ('092741', '6S', 'Swiss franc', 'Franco suíço', 'fx'),
    ('232741', '6A', 'Australian dollar', 'Dólar australiano', 'fx'),
    ('112741', '6N', 'New Zealand dollar', 'Dólar neozelandês', 'fx'),
    ('095741', '6M', 'Mexican peso', 'Peso mexicano', 'fx'),
    ('102741', '6L', 'Brazilian real', 'Real', 'fx'),
    ('098662', 'DX', 'US dollar index', 'Índice do dólar (DXY)', 'fx'),
    ('042601', 'ZT', 'US Treasury 2Y note', 'Treasury 2 anos', 'rates'),
    ('044601', 'ZF', 'US Treasury 5Y note', 'Treasury 5 anos', 'rates'),
    ('043602', 'ZN', 'US Treasury 10Y note', 'Treasury 10 anos', 'rates'),
    ('020601', 'ZB', 'US Treasury bond', 'Treasury bond (longo)', 'rates'),
    ('020604', 'UB', 'Ultra US Treasury bond', 'Ultra Treasury bond', 'rates'),
    ('13874A', 'ES', 'E-mini S&P 500', 'E-mini S&P 500', 'equity'),
    ('209742', 'NQ', 'Nasdaq-100 mini', 'Nasdaq-100 mini', 'equity'),
    ('239742', 'RTY', 'Russell 2000 E-mini', 'Russell 2000 E-mini', 'equity'),
    ('124603', 'YM', 'Dow Jones mini ($5)', 'Dow Jones mini (US$ 5)', 'equity'),
    ('1170E1', 'VX', 'VIX futures', 'Futuro de VIX', 'equity'),
    ('133741', 'BTC', 'Bitcoin (CME)', 'Bitcoin (CME)', 'crypto'),
    ('146021', 'ETH', 'Ether (CME)', 'Ether (CME)', 'crypto'),
]
COT_FIELDS = ['cftc_contract_market_code', 'market_and_exchange_names', 'report_date_as_yyyy_mm_dd', 'open_interest_all',
              'noncomm_positions_long_all', 'noncomm_positions_short_all', 'noncomm_postions_spread_all',
              'comm_positions_long_all', 'comm_positions_short_all', 'nonrept_positions_long_all', 'nonrept_positions_short_all']
COT_WIN = 156  # 3 anos de semanas para o índice COT

def _i(x):
    try: return int(float(x))
    except (TypeError, ValueError): return None

def cot_index(series, win=COT_WIN):
    """Índice COT (estocástico de Williams): posição do líquido atual entre a mínima e a máxima da janela, 0–100."""
    w = [v for v in series[-win:] if v is not None]
    if len(w) < 10: return None
    lo, hi = min(w), max(w)
    return None if hi == lo else round(100 * (w[-1] - lo) / (hi - lo), 1)

def build_cot_obj(rows, markets=COT_MARKETS):
    by = {}
    for r in rows:
        by.setdefault(r['cftc_contract_market_code'], {})[r['report_date_as_yyyy_mm_dd'][:10]] = r
    out = []
    for code, sym, en, pt, grp in markets:
        d = by.get(code)
        if not d: continue
        hist = []
        for day in sorted(d):
            r = d[day]
            oi = _i(r.get('open_interest_all'))
            ncl, ncs = _i(r.get('noncomm_positions_long_all')), _i(r.get('noncomm_positions_short_all'))
            cl_, cs = _i(r.get('comm_positions_long_all')), _i(r.get('comm_positions_short_all'))
            nrl, nrs = _i(r.get('nonrept_positions_long_all')), _i(r.get('nonrept_positions_short_all'))
            if None in (oi, ncl, ncs, cl_, cs): continue
            hist.append([day, ncl - ncs, cl_ - cs, (nrl - nrs) if None not in (nrl, nrs) else None, oi, ncl, ncs])
        if len(hist) < 2: continue
        last, prev = hist[-1], hist[-2]
        nc = [h[1] for h in hist]; cm = [h[2] for h in hist]
        oi = last[4]
        out.append({'code': code, 'sym': sym, 'name': en, 'name_pt': pt, 'group': grp,
                    'exchange': d[last[0]]['market_and_exchange_names'].split(' - ')[-1].title(),
                    'date': last[0], 'oi': oi, 'oi_chg': oi - prev[4],
                    'spec_long': last[5], 'spec_short': last[6], 'spec_net': last[1], 'spec_chg': last[1] - prev[1],
                    'spec_pct_oi': clean(100 * last[1] / oi, 1) if oi else None,
                    'comm_net': last[2], 'comm_chg': last[2] - prev[2], 'small_net': last[3],
                    'spec_idx': cot_index(nc), 'comm_idx': cot_index(cm),
                    'spec_max': max(nc[-COT_WIN:]), 'spec_min': min(nc[-COT_WIN:]),
                    'hist': [h[:5] for h in hist]})
    if not out: raise RuntimeError('CFTC sem mercados')
    return {'date': max(m['date'] for m in out), 'markets': out}

def build_cot():
    start = (TODAY - dt.timedelta(days=5 * 366)).isoformat()
    where = "cftc_contract_market_code in(%s) AND report_date_as_yyyy_mm_dd >= '%s'" % (
        ','.join("'%s'" % m[0] for m in COT_MARKETS), start)
    r = requests.get(COT_API, params={'$where': where, '$limit': 50000, '$select': ','.join(COT_FIELDS),
                                      '$order': 'report_date_as_yyyy_mm_dd'}, timeout=90)
    r.raise_for_status()
    obj = build_cot_obj(r.json())
    obj.update({'generated_at': now_iso(),
                'source': 'CFTC Commitments of Traders, Legacy report, futures only (publicreporting.cftc.gov, dataset 6dca-aqww)',
                'note': 'Positions as of Tuesday, released by the CFTC on Friday (3:30 pm ET). Speculators = non-commercial traders; hedgers = commercial; small = non-reportable. Net = long − short, in contracts. COT index = where the net sits between its 3-year low (0) and high (100).'})
    save('cot.json', obj)

# =====================================================================================
# 13F – carteiras trimestrais de gestores (SEC EDGAR, Form 13F-HR, information table)
# =====================================================================================
SEC_UA = {'User-Agent': 'quant-terminal celowiz marcelo_wz@hotmail.com', 'Accept-Encoding': 'gzip, deflate'}
# (CIK, nome curto, estilo EN, estilo PT) – gestores conhecidos; cada um com o último 13F-HR que entregou
MANAGERS = [
    (1067983, 'Berkshire Hathaway', 'Conglomerate (Buffett)', 'Conglomerado (Buffett)'),
    (102909, 'Vanguard Group', 'Index funds', 'Fundos de índice'),   # desde 2026 entrega 13F-NT (sai pela regra de defasagem)
    (2012383, 'BlackRock', 'Asset manager', 'Gestora'),
    (93751, 'State Street', 'Asset manager', 'Gestora'),
    (1350694, 'Bridgewater Associates', 'Global macro', 'Macro global'),
    (1037389, 'Renaissance Technologies', 'Quant', 'Quantitativo'),
    (1423053, 'Citadel Advisors', 'Multi-strategy', 'Multiestratégia'),
    (1009207, 'D. E. Shaw', 'Quant / multi-strategy', 'Quant / multiestratégia'),
    (1167557, 'AQR Capital', 'Quant', 'Quantitativo'),
    (1603466, 'Point72', 'Multi-strategy', 'Multiestratégia'),
    (1336528, 'Pershing Square', 'Activist (Ackman)', 'Ativista (Ackman)'),
    (1536411, 'Duquesne Family Office', 'Druckenmiller', 'Druckenmiller'),
    (1656456, 'Appaloosa', 'Tepper', 'Tepper'),
    (1061768, 'Baupost Group', 'Value (Klarman)', 'Valor (Klarman)'),
    (1040273, 'Third Point', 'Activist (Loeb)', 'Ativista (Loeb)'),
    (1029160, 'Soros Fund Management', 'Global macro', 'Macro global'),
    (1103804, 'Viking Global', 'Long/short equity', 'Long/short de ações'),
    (1061165, 'Lone Pine Capital', 'Long/short equity', 'Long/short de ações'),
    (1167483, 'Tiger Global', 'Growth / tech', 'Crescimento / tecnologia'),
    (1135730, 'Coatue Management', 'Growth / tech', 'Crescimento / tecnologia'),
    (1697748, 'ARK Investment', 'Thematic growth', 'Crescimento temático'),
    (1569205, 'Fundsmith', 'Quality growth', 'Qualidade'),
]
TOP_N = 30

def sec_get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=SEC_UA, timeout=120)
            time.sleep(0.15)                       # limite da SEC: 10 req/s
            if r.status_code == 200: return r
            last = f'HTTP {r.status_code}'
        except Exception as e: last = repr(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f'{url}: {last}')

def _strip_ns(tag): return tag.rsplit('}', 1)[-1]

def parse_infotable(xml_bytes):
    """Tabela de informação do 13F → {(cusip, put/call): {...}} somando as linhas do mesmo papel
    (o mesmo CUSIP aparece uma vez por gestor/discricionariedade). Valores em US$ (regra da SEC desde jan/2023)."""
    root = ET.fromstring(xml_bytes)
    agg = {}
    for it in root.iter():
        if _strip_ns(it.tag) != 'infoTable': continue
        f = {}
        for ch in it.iter():
            t = _strip_ns(ch.tag)
            if ch.text and ch.text.strip(): f[t] = ch.text.strip()
        cusip = f.get('cusip', '').upper()
        if not cusip: continue
        pc = (f.get('putCall') or '').title()
        k = (cusip, pc)
        a = agg.setdefault(k, {'cusip': cusip, 'issuer': f.get('nameOfIssuer', '').strip(), 'cls': f.get('titleOfClass', '').strip(),
                               'pc': pc, 'value': 0, 'shares': 0, 'type': f.get('sshPrnamtType', 'SH')})
        a['value'] += _i(f.get('value')) or 0
        a['shares'] += _i(f.get('sshPrnamt')) or 0
    return fix_units(agg)

def fix_units(agg):
    """Alguns gestores ainda informam o valor em milhares de US$ (regra antiga). Se o preço implícito mediano
    (valor ÷ ações) das posições em ações ficar abaixo de US$ 2, a tabela está em milhares: multiplica por 1.000."""
    px = sorted(a['value'] / a['shares'] for a in agg.values() if a['type'] == 'SH' and not a['pc'] and a['shares'] > 0)
    if px and px[len(px) // 2] < 2:
        for a in agg.values(): a['value'] *= 1000
    return agg

def latest_13f(cik, n=2):
    """Os n últimos 13F-HR (originais) por período: [(acc, filed, period)], do mais novo para o mais velho."""
    s = sec_get(f'https://data.sec.gov/submissions/CIK{cik:010d}.json').json()
    f = s['filings']['recent']
    out, seen = [], set()
    for i, fm in enumerate(f['form']):
        if fm != '13F-HR' or f['reportDate'][i] in seen: continue
        seen.add(f['reportDate'][i]); out.append((f['accessionNumber'][i], f['filingDate'][i], f['reportDate'][i]))
        if len(out) == n: break
    return s.get('name', ''), out

def infotable(cik, acc):
    a = acc.replace('-', '')
    idx = sec_get(f'https://www.sec.gov/Archives/edgar/data/{cik}/{a}/index.json').json()
    xs = [it['name'] for it in idx['directory']['item'] if it['name'].lower().endswith('.xml') and it['name'] != 'primary_doc.xml']
    if not xs: raise RuntimeError(f'13F {acc}: sem information table')
    xs.sort(key=lambda n: ('info' not in n.lower(), n))
    return parse_infotable(sec_get(f'https://www.sec.gov/Archives/edgar/data/{cik}/{a}/{xs[0]}').content)

def diff_positions(cur, prev):
    """Mudança de cada posição contra o trimestre anterior, em ações: new / add / cut / same; e as zeradas."""
    rows = []
    for k, p in cur.items():
        q = prev.get(k) if prev is not None else None
        if prev is None: st, d = None, None
        elif q is None: st, d = 'new', p['shares']
        else:
            d = p['shares'] - q['shares']
            st = 'add' if d > 0 else 'cut' if d < 0 else 'same'
        rows.append({**p, 'status': st, 'd_shares': d, 'd_pct': clean(100 * d / q['shares'], 1) if (q and q['shares']) else None})
    sold = [] if prev is None else [{**q, 'status': 'sold'} for k, q in prev.items() if k not in cur]
    return rows, sold

def manager_obj(cik, short, style, style_pt, cur, prev, period, filed, prev_period):
    rows, sold = diff_positions(cur, prev)
    tot = sum(r['value'] for r in rows) or 1
    rows.sort(key=lambda r: -r['value']); sold.sort(key=lambda r: -r['value'])
    for r in rows: r['w'] = clean(100 * r['value'] / tot, 2)
    cnt = {s: sum(1 for r in rows if r['status'] == s) for s in ('new', 'add', 'cut', 'same')}
    return {'cik': cik, 'name': short, 'style': style, 'style_pt': style_pt, 'period': period, 'filed': filed, 'prev_period': prev_period,
            'value': tot, 'n': len(rows), 'top10_w': clean(sum(r['w'] for r in rows[:10]), 1), 'counts': {**cnt, 'sold': len(sold)},
            'positions': rows[:TOP_N], 'sold': [{k: s[k] for k in ('cusip', 'issuer', 'cls', 'pc', 'value', 'shares')} for s in sold[:10]]}

def consensus(full, top=40):
    """Papéis mais presentes entre os gestores (só ações, sem opções): quantos têm, valor somado e quem comprou/vendeu."""
    agg = {}
    for m, rows in full:
        for r in rows:
            if r['pc'] or r['type'] != 'SH': continue
            a = agg.setdefault(r['cusip'], {'cusip': r['cusip'], 'issuer': r['issuer'], 'cls': r['cls'], 'holders': 0, 'value': 0, 'buyers': 0, 'sellers': 0, 'who': []})
            a['holders'] += 1; a['value'] += r['value']; a['who'].append(m)
            if r['status'] in ('new', 'add'): a['buyers'] += 1
            elif r['status'] == 'cut': a['sellers'] += 1
    return sorted(agg.values(), key=lambda a: (-a['holders'], -a['value']))[:top]

def build_13f():
    mans, full = [], []
    for cik, short, style, style_pt in MANAGERS:
        try:
            _, fl = latest_13f(cik)
            if not fl: print('  13F sem filing:', short); continue
            acc, filed, period = fl[0]
            if (TODAY - dt.date.fromisoformat(period)).days > 400: print('  13F antigo, fora:', short, period); continue
            cur = infotable(cik, acc)
            prev, pp = (infotable(cik, fl[1][0]), fl[1][2]) if len(fl) > 1 else (None, None)
            m = manager_obj(cik, short, style, style_pt, cur, prev, period, filed, pp)
            mans.append(m)
            rows, _ = diff_positions(cur, prev); full.append((short, rows))
            print(f'  13F {short}: {period} {m["n"]} posições US$ {m["value"]/1e9:.1f} bi')
        except Exception as e:
            print('  13F falhou:', short, e)
    if len(mans) < 5: raise RuntimeError('13F: poucos gestores')
    newest = max(dt.date.fromisoformat(m['period']) for m in mans)
    keep = {m['name'] for m in mans if (newest - dt.date.fromisoformat(m['period'])).days <= 100}   # no máximo 1 trimestre atrás
    for m in mans:
        if m['name'] not in keep: print('  13F defasado, fora:', m['name'], m['period'])
    mans = [m for m in mans if m['name'] in keep]; full = [f for f in full if f[0] in keep]
    obj = {'managers': mans, 'consensus': consensus(full), 'generated_at': now_iso(),
           'source': 'SEC EDGAR, Form 13F-HR information tables (data.sec.gov submissions + Archives)',
           'note': 'Long positions in US-listed equities, ETFs, options and convertibles that managers with over US$ 100 million must report 45 days after each quarter. No shorts, cash, bonds or non-US holdings, so this is not the whole portfolio. Values in US$ at quarter-end prices; changes compare share counts with the previous 13F-HR.'}
    save('13f.json', obj)

if __name__ == '__main__':
    import sys
    ok = [step('cot', build_cot), step('13f', build_13f)]
    sys.exit(0 if any(ok) else 1)
