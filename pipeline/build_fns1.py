"""Funções novas, lote 1 (P2-H1): BEIR (inflação implícita), USMM (mercado monetário dos EUA),
CBR (juros dos bancos centrais) e CRYP (monitor de cripto). Só dados abertos; cada etapa é
independente e, se a fonte cair, o JSON anterior continua publicado."""
import datetime as dt, io, math
import pandas as pd
from common import save, get, get_json, clean, now_iso, today_brt, step

TODAY = today_brt()

# =====================================================================================
# BEIR – inflação implícita (breakeven) = prefixado (LTN/NTN-F) vs IPCA+ (NTN-B / NTN-B Principal)
# =====================================================================================
BEIR_TENORS = [('3Y', 3), ('5Y', 5), ('7Y', 7), ('10Y', 10)]

def _yrs(r):
    return (dt.date.fromisoformat(r['maturity']) - dt.date.fromisoformat(r['ref'])).days / 365.25

def _curve(rows, bonds):
    q = {}
    for r in rows:
        if r['bond'] in bonds and r.get('rate') is not None:
            y = round(_yrs(r), 4)
            if y > 0.25: q.setdefault(y, r['rate'])   # < 3 meses: taxa ruidosa, fora
    xs = sorted(q); return xs, [q[x] for x in xs]

def _interp(xs, ys, x):
    """Linear, sem extrapolar (o breakeven só existe onde as duas curvas têm títulos)."""
    if not xs or x < xs[0] or x > xs[-1]: return None
    for i in range(1, len(xs)):
        if x <= xs[i]:
            w = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + w * (ys[i] - ys[i - 1])
    return ys[-1]

def breakeven(nom, real):
    """Fisher: (1+i) = (1+r)(1+π) → π = (1+i)/(1+r) − 1, em % a.a."""
    if nom is None or real is None: return None
    return ((1 + nom / 100) / (1 + real / 100) - 1) * 100

def beir_day(rows):
    """Vértices (um por vencimento de título IPCA+) e prazos-padrão de um dia do Tesouro Direto."""
    px, py = _curve(rows, ('LTN', 'NTN-F'))
    rx, ry = _curve(rows, ('NTN-B P', 'NTN-B'))
    verts = []
    seen = set()
    for r in sorted(rows, key=lambda r: (r['maturity'], r['bond'] != 'NTN-B P')):
        if r['bond'] not in ('NTN-B P', 'NTN-B') or r.get('rate') is None or r['maturity'] in seen: continue
        y = _yrs(r)
        if y <= 0.25: continue
        seen.add(r['maturity'])
        nom = _interp(px, py, y)
        verts.append({'bond': r['bond'], 'maturity': r['maturity'], 'years': clean(y, 2), 'real': clean(r['rate'], 2),
                      'nominal': clean(nom, 2), 'bei': clean(breakeven(nom, r['rate']), 2)})
    ten = {}
    for k, y in BEIR_TENORS:
        nom, real = _interp(px, py, y), _interp(rx, ry, y)
        ten[k] = {'nominal': clean(nom, 2), 'real': clean(real, 2), 'bei': clean(breakeven(nom, real), 2)}
    return verts, ten

def build_beir_obj(hist):
    days = sorted(hist)
    if not days: raise RuntimeError('Tesouro Transparente sem dados')
    last = days[-1]
    verts, ten = beir_day(hist[last])
    def ago(n):
        tgt = (dt.date.fromisoformat(last) - dt.timedelta(days=n)).isoformat()
        c = [d for d in days if d <= tgt]; return c[-1] if c else None
    cmp = {}
    for lab, n in (('1W', 7), ('1M', 30), ('1Y', 365)):
        d0 = ago(n)
        if d0: cmp[lab] = {'date': d0, 'tenors': beir_day(hist[d0])[1]}
    series = {k: [] for k, _ in BEIR_TENORS}
    for d in days:
        _, t = beir_day(hist[d])
        for k, _y in BEIR_TENORS:
            if t[k]['bei'] is not None: series[k].append([d, t[k]['bei'], t[k]['nominal'], t[k]['real']])
    return {'date': last, 'vertices': verts, 'tenors': ten, 'compare': cmp, 'history': series}

def build_beir():
    from build_macro import td_history, TD_SOURCE
    obj = build_beir_obj(td_history(1100))
    obj.update({'generated_at': now_iso(), 'source': TD_SOURCE,
                'note': 'Breakeven = (1 + prefixed rate) / (1 + IPCA+ real rate) − 1. Prefixed curve (LTN/NTN-F) linearly interpolated at each IPCA+ maturity; '
                        'no extrapolation. Uses Tesouro Direto sell (buy-back) rates; coupon and zero-coupon yields are mixed, so it is an approximation (no bootstrapping). '
                        'Includes inflation-risk and liquidity premia: it is not a pure inflation forecast.'})
    save('beir.json', obj)

# =====================================================================================
# USMM – mercado monetário dos EUA (NY Fed Markets API: SOFR, EFFR, OBFR, TGCR, BGCR + médias SOFR)
# =====================================================================================
USMM_RATES = ['SOFR', 'EFFR', 'OBFR', 'TGCR', 'BGCR']

def parse_usmm(d):
    rows = sorted(d.get('refRates', []), key=lambda r: r['effectiveDate'])
    hist = {k: [] for k in USMM_RATES}; band = []; sofrai = []
    for r in rows:
        k = r.get('type')
        if k in hist and r.get('percentRate') is not None:
            hist[k].append([r['effectiveDate'], clean(r['percentRate'], 3), clean(r.get('percentPercentile1'), 3), clean(r.get('percentPercentile25'), 3),
                            clean(r.get('percentPercentile75'), 3), clean(r.get('percentPercentile99'), 3), clean(r.get('volumeInBillions'), 0)])
            if k == 'EFFR' and r.get('targetRateFrom') is not None:
                band.append([r['effectiveDate'], clean(r['targetRateFrom'], 3), clean(r['targetRateTo'], 3)])
        elif k == 'SOFRAI':
            sofrai.append([r['effectiveDate'], clean(r.get('average30day'), 5), clean(r.get('average90day'), 5), clean(r.get('average180day'), 5), clean(r.get('index'), 8)])
    latest = []
    for k in USMM_RATES:
        h = hist[k]
        if not h: continue
        x = h[-1]
        prev = h[-2][1] if len(h) > 1 else None
        y1 = [p for p in h if p[0] <= (dt.date.fromisoformat(x[0]) - dt.timedelta(days=365)).isoformat()]
        latest.append({'rate': k, 'date': x[0], 'value': x[1], 'p1': x[2], 'p25': x[3], 'p75': x[4], 'p99': x[5], 'volume_bn': x[6],
                       'd1_bp': clean((x[1] - prev) * 100, 1) if prev is not None else None,
                       'y1_bp': clean((x[1] - y1[-1][1]) * 100, 1) if y1 else None})
    return {'latest': latest, 'band': band, 'sofrai': sofrai, 'history': hist}

def build_usmm():
    start = (TODAY - dt.timedelta(days=3 * 365 + 10)).isoformat()
    d = get_json(f'https://markets.newyorkfed.org/api/rates/all/search.json?startDate={start}&endDate={TODAY.isoformat()}')
    obj = parse_usmm(d)
    if not obj['latest']: raise RuntimeError('NY Fed sem taxas')
    obj.update({'generated_at': now_iso(),
                'source': 'Federal Reserve Bank of New York – Markets Data API (reference rates: SOFR, EFFR, OBFR, TGCR, BGCR, SOFR Averages & Index)',
                'note': 'Rates in % p.a. for the business day shown (published next morning, ~8:00 ET). Percentiles are volume-weighted across transactions. '
                        'Target range = FOMC fed funds band.'})
    save('usmm.json', obj)

# =====================================================================================
# CBR – juros básicos dos bancos centrais (BIS WS_CBPOL, SDMX)
# =====================================================================================
BIS = 'https://stats.bis.org/api/v1/data/WS_CBPOL'
# código ISO → (nome EN, nome PT, região, banco central)
CB = {
    'US': ('United States', 'Estados Unidos', 'Americas', 'Fed'), 'CA': ('Canada', 'Canadá', 'Americas', 'BoC'),
    'MX': ('Mexico', 'México', 'Americas', 'Banxico'), 'BR': ('Brazil', 'Brasil', 'Americas', 'BCB'),
    'AR': ('Argentina', 'Argentina', 'Americas', 'BCRA'), 'CL': ('Chile', 'Chile', 'Americas', 'BCCh'),
    'CO': ('Colombia', 'Colômbia', 'Americas', 'BanRep'), 'PE': ('Peru', 'Peru', 'Americas', 'BCRP'),
    'XM': ('Euro area', 'Zona do euro', 'Europe', 'ECB'), 'GB': ('United Kingdom', 'Reino Unido', 'Europe', 'BoE'),
    'CH': ('Switzerland', 'Suíça', 'Europe', 'SNB'), 'SE': ('Sweden', 'Suécia', 'Europe', 'Riksbank'),
    'NO': ('Norway', 'Noruega', 'Europe', 'Norges Bank'), 'DK': ('Denmark', 'Dinamarca', 'Europe', 'Nationalbanken'),
    'IS': ('Iceland', 'Islândia', 'Europe', 'Seðlabanki'), 'PL': ('Poland', 'Polônia', 'Europe', 'NBP'),
    'CZ': ('Czechia', 'Tchéquia', 'Europe', 'CNB'), 'HU': ('Hungary', 'Hungria', 'Europe', 'MNB'),
    'RO': ('Romania', 'Romênia', 'Europe', 'BNR'), 'RS': ('Serbia', 'Sérvia', 'Europe', 'NBS'),
    'MK': ('North Macedonia', 'Macedônia do Norte', 'Europe', 'NBRNM'), 'HR': ('Croatia', 'Croácia', 'Europe', 'HNB'),
    'TR': ('Türkiye', 'Turquia', 'Europe', 'CBRT'), 'RU': ('Russia', 'Rússia', 'Europe', 'CBR'),
    'GR': ('Greece', 'Grécia', 'Europe', 'BoG'),
    'IL': ('Israel', 'Israel', 'Middle East & Africa', 'BoI'), 'SA': ('Saudi Arabia', 'Arábia Saudita', 'Middle East & Africa', 'SAMA'),
    'KW': ('Kuwait', 'Kuwait', 'Middle East & Africa', 'CBK'), 'ZA': ('South Africa', 'África do Sul', 'Middle East & Africa', 'SARB'),
    'MA': ('Morocco', 'Marrocos', 'Middle East & Africa', 'BAM'),
    'JP': ('Japan', 'Japão', 'Asia-Pacific', 'BoJ'), 'CN': ('China', 'China', 'Asia-Pacific', 'PBoC'),
    'HK': ('Hong Kong SAR', 'Hong Kong', 'Asia-Pacific', 'HKMA'), 'KR': ('South Korea', 'Coreia do Sul', 'Asia-Pacific', 'BoK'),
    'IN': ('India', 'Índia', 'Asia-Pacific', 'RBI'), 'ID': ('Indonesia', 'Indonésia', 'Asia-Pacific', 'BI'),
    'MY': ('Malaysia', 'Malásia', 'Asia-Pacific', 'BNM'), 'TH': ('Thailand', 'Tailândia', 'Asia-Pacific', 'BoT'),
    'PH': ('Philippines', 'Filipinas', 'Asia-Pacific', 'BSP'), 'AU': ('Australia', 'Austrália', 'Asia-Pacific', 'RBA'),
    'NZ': ('New Zealand', 'Nova Zelândia', 'Asia-Pacific', 'RBNZ'),
}

def parse_bis_csv(txt):
    """CSV SDMX do BIS (detail=dataonly) → {país: pd.Series(valor, índice=data)}."""
    df = pd.read_csv(io.StringIO(txt), dtype={'TIME_PERIOD': str})
    df = df.dropna(subset=['OBS_VALUE'])
    out = {}
    for area, g in df.groupby('REF_AREA'):
        idx = pd.to_datetime(g['TIME_PERIOD'])
        out[area] = pd.Series(g['OBS_VALUE'].astype(float).values, index=idx).sort_index()
    return out

def last_move(s):
    """(data, variação em pb) da última mudança de juros na série diária/mensal."""
    v = s.round(4); ch = v.diff()
    nz = ch[ch.abs() > 1e-9]
    if nz.empty: return None, None
    return nz.index[-1].strftime('%Y-%m-%d'), clean(nz.iloc[-1] * 100, 1)

def build_cbr_obj(daily, monthly, today):
    rows = []
    for c, (en, pt, reg, bank) in CB.items():
        d, m = daily.get(c), monthly.get(c)
        base = d if d is not None and not d.empty else m
        if base is None or base.empty: continue
        last_d = base.index[-1]
        if (pd.Timestamp(today) - last_d).days > 400: continue    # série descontinuada (ex.: Grécia pré-euro)
        val = float(base.iloc[-1])
        def at(days):
            s = base[base.index <= last_d - pd.Timedelta(days=days)]
            if s.empty and m is not None: s = m[m.index <= last_d - pd.Timedelta(days=days)]
            return float(s.iloc[-1]) if not s.empty else None
        mv_date, mv_bp = last_move(d) if d is not None and not d.empty else (None, None)
        if mv_date is None and m is not None: mv_date, mv_bp = last_move(m)
        c3, c12 = at(91), at(365)
        hist = m if m is not None else base.resample('ME').last()
        rows.append({'code': c, 'name': en, 'name_pt': pt, 'region': reg, 'bank': bank, 'rate': clean(val, 3), 'date': last_d.strftime('%Y-%m-%d'),
                     'chg_3m_bp': clean((val - c3) * 100, 0) if c3 is not None else None, 'chg_1y_bp': clean((val - c12) * 100, 0) if c12 is not None else None,
                     'last_move': mv_date, 'last_move_bp': mv_bp,
                     'hist': [[i.strftime('%Y-%m'), clean(v, 3)] for i, v in hist.items() if clean(v, 3) is not None]})
    rows.sort(key=lambda r: -r['rate'])
    return {'banks': rows}

def build_cbr():
    m = parse_bis_csv(get(f'{BIS}/M..?startPeriod=2000-01&format=csv&detail=dataonly', timeout=120).text)
    d = parse_bis_csv(get(f'{BIS}/D..?startPeriod={TODAY.year - 4}-01-01&format=csv&detail=dataonly', timeout=180).text)
    obj = build_cbr_obj(d, m, TODAY)
    if len(obj['banks']) < 10: raise RuntimeError('BIS: poucos países')
    obj.update({'generated_at': now_iso(), 'source': 'BIS – Central bank policy rates (WS_CBPOL, SDMX API stats.bis.org), daily and monthly end-of-period',
                'note': 'Policy rate as compiled by the BIS (for some countries a proxy such as the main refinancing or target rate). '
                        'Last move = last change in the daily series (monthly if no daily data). Euro area = ECB.'})
    save('cbr.json', obj)

# =====================================================================================
# CRYP – cripto: CoinGecko (top moedas, dados globais), alternative.me (Fear & Greed), DefiLlama (TVL)
# =====================================================================================
def parse_coins(arr):
    out = []
    for c in arr:
        sp = ((c.get('sparkline_in_7d') or {}).get('price') or [])
        sp = [clean(x, 6) for x in sp[::4] if x is not None]       # 168 pontos horários → 42
        out.append({'id': c.get('id'), 'sym': (c.get('symbol') or '').upper(), 'name': c.get('name'), 'rank': c.get('market_cap_rank'),
                    'price': clean(c.get('current_price'), 8), 'mcap': clean(c.get('market_cap'), 0), 'vol': clean(c.get('total_volume'), 0),
                    'ch24': clean(c.get('price_change_percentage_24h_in_currency'), 2), 'ch7d': clean(c.get('price_change_percentage_7d_in_currency'), 2),
                    'ch30d': clean(c.get('price_change_percentage_30d_in_currency'), 2), 'ath_pct': clean(c.get('ath_change_percentage'), 1), 'spark': sp})
    return [c for c in out if c['price'] is not None]

def parse_fng(d):
    rows = []
    for x in d.get('data', []):
        try: rows.append([dt.datetime.fromtimestamp(int(x['timestamp']), dt.timezone.utc).strftime('%Y-%m-%d'), int(x['value']), x.get('value_classification')])
        except Exception: pass
    return sorted(rows)

def parse_tvl(hist, chains, n=15):
    h = [[dt.datetime.fromtimestamp(int(x['date']), dt.timezone.utc).strftime('%Y-%m-%d'), clean(x['tvl'] / 1e9, 2)] for x in hist if x.get('tvl')]
    ch = sorted([c for c in chains if c.get('tvl')], key=lambda c: -c['tvl'])
    tot = sum(c['tvl'] for c in ch) or 1
    top = [{'name': c['name'], 'sym': c.get('tokenSymbol'), 'tvl_bn': clean(c['tvl'] / 1e9, 2), 'share': clean(c['tvl'] / tot * 100, 1)} for c in ch[:n]]
    return h, top

def build_cryp():
    cg = 'https://api.coingecko.com/api/v3'
    coins = parse_coins(get_json(f'{cg}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h,7d,30d'))
    if len(coins) < 10: raise RuntimeError('CoinGecko: resposta curta')
    g = get_json(f'{cg}/global').get('data', {})
    glob = {'mcap_usd': clean((g.get('total_market_cap') or {}).get('usd'), 0), 'vol_usd': clean((g.get('total_volume') or {}).get('usd'), 0),
            'mcap_ch24': clean(g.get('market_cap_change_percentage_24h_usd'), 2),
            'dominance': {k.upper(): clean(v, 2) for k, v in sorted((g.get('market_cap_percentage') or {}).items(), key=lambda kv: -kv[1])[:6]},
            'active': g.get('active_cryptocurrencies')}
    obj = {'coins': coins, 'global': glob, 'fng': [], 'tvl': [], 'chains': []}
    try: obj['fng'] = parse_fng(get_json('https://api.alternative.me/fng/?limit=1100'))
    except Exception as e: print('  fng falhou:', e)
    try: obj['tvl'], obj['chains'] = parse_tvl(get_json('https://api.llama.fi/v2/historicalChainTvl'), get_json('https://api.llama.fi/v2/chains'))
    except Exception as e: print('  defillama falhou:', e)
    obj.update({'generated_at': now_iso(),
                'source': 'Data provided by CoinGecko (coins/markets, global) · alternative.me Crypto Fear & Greed Index · DefiLlama (DeFi TVL by chain)',
                'note': 'Prices in USD, snapshot at build time (crypto trades 24/7). TVL = total value locked in DeFi protocols (DefiLlama methodology, excludes double counting by default).'})
    save('cryp.json', obj)

if __name__ == '__main__':
    import sys
    ok = [step('beir', build_beir), step('usmm', build_usmm), step('cbr', build_cbr), step('cryp', build_cryp)]
    sys.exit(0 if any(ok) else 1)
