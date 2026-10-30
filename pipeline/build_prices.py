"""Preços OHLCV diários (10 anos, ajustados) do universo do seletor + tickers.json.

Universo (dinâmico onde há fonte oficial):
  - Ações BR: carteiras teóricas B3 do Ibovespa (IBOV) e do Small Cap (SMLL), lidas a cada execução.
  - Ações EUA (~30 maiores por valor de mercado), índices, ETFs, commodities, cripto e moedas: listas fixas abaixo.
  - Cobertura ampliada (`ext`: entra no seletor, mas sem página estática por ticker — o site abre pelo 404.html):
      S&P 500 (lista aberta datasets/s-and-p-500-companies), FIIs (carteira B3 do IFIX), BDRs (carteira B3 do BDRX),
      ETFs listados na B3 (renda variável e renda fixa, cadastro de fundos da B3) e as maiores criptos da CoinGecko
      (sem stablecoins; só entra a que o Yahoo devolve com preço coerente com o da CoinGecko). Histórico de 5 anos.
  - Minério de ferro: Dalian (DCE, contínuo I0, CNY/t) via K-line diário público da Sina Finance;
    Singapura (SGX 62% Fe, USD/t) via Yahoo TIO=F (só fechamento: o Yahoo não publica OHLC intradiário dele).
Barra final das ações BR: fechamento oficial do COTAHIST diário da B3 (substitui barra incompleta ou acrescenta o pregão que faltar).
Fontes: B3 (carteiras, COTAHIST), Yahoo Finance via yfinance (lotes + retry + circuit breaker), Sina Finance (DCE).
Se uma fonte cair, o arquivo anterior do ticker é mantido (load_prev) e o ticker continua no tickers.json."""
import base64, io, json, os, re, time
import pandas as pd, requests, yfinance as yf
from common import OUT, now_iso, get_json, get, save, mark_coverage, EQUITIES, pack_prices, unpack_prices
from cotahist import latest_cotahist, parse, official_closes, apply_official

MIN_TICKERS = 200          # o teste e o pipeline falham abaixo disso (proteção contra universo truncado)
BATCH = 40                 # tickers por chamada ao Yahoo
RETRIES = 3
BREAKER = 3                # lotes seguidos sem nenhum dado → para de chamar o Yahoo (mantém arquivos anteriores)

US = {'AAPL': 'Apple', 'MSFT': 'Microsoft', 'NVDA': 'NVIDIA', 'GOOGL': 'Alphabet A', 'GOOG': 'Alphabet C', 'AMZN': 'Amazon',
      'META': 'Meta Platforms', 'AVGO': 'Broadcom', 'TSLA': 'Tesla', 'BRK-B': 'Berkshire Hathaway B', 'JPM': 'JPMorgan Chase',
      'LLY': 'Eli Lilly', 'V': 'Visa', 'WMT': 'Walmart', 'ORCL': 'Oracle', 'MA': 'Mastercard', 'XOM': 'Exxon Mobil',
      'NFLX': 'Netflix', 'COST': 'Costco', 'JNJ': 'Johnson & Johnson', 'HD': 'Home Depot', 'PG': 'Procter & Gamble',
      'BAC': 'Bank of America', 'ABBV': 'AbbVie', 'PLTR': 'Palantir', 'UNH': 'UnitedHealth', 'KO': 'Coca-Cola',
      'AMD': 'AMD', 'CVX': 'Chevron', 'CSCO': 'Cisco', 'GE': 'GE Aerospace', 'TMUS': 'T-Mobile US', 'CRM': 'Salesforce'}
INDEX = {'^BVSP': 'IBOVESPA', '^GSPC': 'S&P 500', '^NDX': 'Nasdaq 100', '^IXIC': 'Nasdaq Composite', '^DJI': 'Dow Jones Industrial',
         '^RUT': 'Russell 2000', '^STOXX50E': 'Euro Stoxx 50', '^N225': 'Nikkei 225', '^HSI': 'Hang Seng', 'DX-Y.NYB': 'US Dollar Index (DXY)'}
ETF = {'SPY': 'SPDR S&P 500 ETF', 'QQQ': 'Invesco QQQ (Nasdaq 100)', 'IWM': 'iShares Russell 2000', 'EWZ': 'iShares MSCI Brazil',
       'EEM': 'iShares MSCI Emerging Markets', 'TLT': 'iShares 20+ Year Treasury', 'BOVA11.SA': 'iShares Ibovespa (BOVA11)',
       'SMAL11.SA': 'iShares Small Cap (SMAL11)', 'IVVB11.SA': 'iShares S&P 500 BRL (IVVB11)'}
COMMODITY = {'BZ=F': ('Brent Crude Oil', 'USD/bbl'), 'CL=F': ('WTI Crude Oil', 'USD/bbl'), 'GC=F': ('Gold', 'USD/oz t'),
             'SI=F': ('Silver', 'USD/oz t'), 'HG=F': ('Copper', 'USD/lb'), 'NG=F': ('Natural Gas (Henry Hub)', 'USD/MMBtu'),
             'ZS=F': ('Soybeans', 'USc/bu'), 'ZC=F': ('Corn', 'USc/bu'), 'KC=F': ('Coffee (Arabica)', 'USc/lb'),
             'TIO=F': ('Iron Ore · Singapore (SGX)', 'USD/t')}
CRYPTO = {'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ethereum', 'SOL-USD': 'Solana'}
FX = {'BRL=X': 'USD/BRL', 'EURBRL=X': 'EUR/BRL', 'GBPBRL=X': 'GBP/BRL', 'JPYBRL=X': 'JPY/BRL',
      'ARSBRL=X': 'ARS/BRL', 'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'JPY=X': 'USD/JPY', 'MXN=X': 'USD/MXN',
      'CNY=X': 'USD/CNY', 'ZAR=X': 'USD/ZAR', 'TRY=X': 'USD/TRY', 'INR=X': 'USD/INR', 'CLP=X': 'USD/CLP', 'COP=X': 'USD/COP', 'ARS=X': 'USD/ARS'}
DCE = ('I0.DCE', 'Iron Ore · Dalian (DCE)', 'CNY/t')
LINKS = {'TIO=F': 'https://www.sgx.com/derivatives/products/iron-ore', 'I0.DCE': 'https://www.dce.com.cn/'}
# referência de cotação (só link no detalhe; nada é lido de lá)
REFS = {'TIO=F': 'https://br.tradingview.com/symbols/SGX-FEF1!/', 'I0.DCE': 'https://gu.sina.cn/ft/hq/nf.php?symbol=i0'}

def key(t): return t.replace('^', 'IDX_').replace('.SA', '').replace('.', '_').replace('=', '_').replace('-', '_')

def b3_portfolio(index, with_type=True):
    """componentes da carteira teórica do dia (B3) → [(cod, nome)]"""
    q = base64.b64encode(json.dumps({"language": "pt-br", "pageNumber": 1, "pageSize": 200, "index": index, "segment": "2"}).encode()).decode()
    d = get_json(f'https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/{q}')
    typ = lambda r: ' '.join(r['type'].split()[:1]) if with_type else ''
    return [(r['cod'].strip(), f"{' '.join(r['asset'].split())} {typ(r)}".strip()) for r in d['results']]

EXT_PERIOD = '5y'          # histórico da cobertura ampliada (controla tamanho do deploy e tempo do Yahoo)
CRYPTO_EXT = 25            # criptos extras (além das fixas), por valor de mercado
SP500_CSV = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'
B3_FUNDS = 'https://sistemaswebb3-listados.b3.com.br/fundsListedProxy/Search/GetListFunds/'
CG_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1'

def parse_sp500(text):
    """CSV aberto dos constituintes do S&P 500 → [(símbolo Yahoo, nome)]; BRK.B → BRK-B"""
    df = pd.read_csv(io.StringIO(text))
    return [(str(r.Symbol).strip().replace('.', '-'), ' '.join(str(r.Security).split())) for r in df.itertuples() if str(r.Symbol).strip()]

def sp500():
    out = parse_sp500(get(SP500_CSV).text)
    if len(out) < 450: raise RuntimeError(f'S&P 500 com {len(out)} empresas')
    return out

def etf_name(r):
    n = ' '.join((r.get('fundName') or r.get('tradingName') or '').split())
    n = re.split(r'\s+(?:-\s+)?(?:FUNDO|CLASSE) DE [IÍ]NDICE', n, flags=re.I)[0].strip(' -')
    return n or ' '.join((r.get('tradingName') or '').split())

def clean_name(n):
    """o site não cita o terminal comercial (regra do projeto): o nome do provedor de índice sai do rótulo"""
    return ' '.join(re.sub(r'\bbloomberg\b', '', n, flags=re.I).split())

def b3_etfs():
    """ETFs listados na B3 (cadastro de fundos: renda variável e renda fixa) → [(código, nome)]; código = sigla + 11"""
    out = {}
    for typ in ('ETF', 'ETF-RF'):
        page, pages = 1, 1
        while page <= pages:
            q = base64.b64encode(json.dumps({"language": "pt-br", "typeFund": typ, "pageNumber": page, "pageSize": 120, "keyword": ""}).encode()).decode()
            d = get_json(B3_FUNDS + q)
            pages = (d.get('page') or {}).get('totalPages') or 0
            for r in d.get('results') or []:
                a = (r.get('acronym') or '').strip().upper()
                if re.fullmatch(r'[A-Z0-9]{4}', a): out.setdefault(f'{a}11', etf_name(r))
            page += 1
    if len(out) < 50: raise RuntimeError(f'ETFs B3: só {len(out)}')
    return sorted(out.items())

STABLE = re.compile(r'usd|usy|eur|dollar|stable|fund|yield|treasury|wrapped|staked|bridged|liquid', re.I)

def parse_coingecko(rows, skip=()):
    """markets da CoinGecko → [(SYM-USD, nome, preço)] sem stablecoins/tokens derivados (embrulhados, staking, fundos)"""
    out, seen = [], set(skip)
    for c in rows:
        sym, name, px = (c.get('symbol') or '').upper(), c.get('name') or '', c.get('current_price')
        if not re.fullmatch(r'[A-Z0-9]{2,6}', sym) or not px: continue
        if STABLE.search(sym) or STABLE.search(name) or STABLE.search(c.get('id') or '') or abs(px - 1) < 0.05: continue
        t = f'{sym}-USD'
        if t in seen: continue
        seen.add(t); out.append((t, name, float(px)))
    return out

def coherent(rows, px, tol=0.15):
    """o Yahoo devolveu o mesmo ativo? último fechamento dentro de ±15% do preço CoinGecko (símbolos ambíguos caem aqui)"""
    try: return abs(rows[-1]['close'] / px - 1) <= tol
    except Exception: return False

EXT = (('sp500', 'us_equity', 'USD', 'S&P 500'), ('ifix', 'fii', 'BRL', 'IFIX'), ('bdrx', 'bdr', 'BRL', 'BDRX'),
       ('etf_br', 'etf', 'BRL', None), ('crypto', 'crypto', 'USD', None))

def build_universe(ibov, smll, ext=None):
    """dict ticker → meta (sem preços). ibov/smll = [(cod, nome)] das carteiras B3.
    ext = {'sp500': [(sym, nome)], 'ifix'|'bdrx'|'etf_br': [(cod B3, nome)], 'crypto': [(SYM-USD, nome)]} → `ext: True`
    (o núcleo fixo/IBOV/SMLL tem prioridade: um ticker que já está no universo não vira ext)."""
    U = {}
    for idx, comp in (('IBOV', ibov), ('SMLL', smll)):
        for cod, name in comp:
            t = f'{cod}.SA'
            m = U.setdefault(t, {'name': name, 'class': 'br_equity', 'currency': 'BRL', 'index': []})
            m['index'].append(idx)
    for t in EQUITIES:  # ações com dados CVM/B3 ficam mesmo se saírem do índice
        U.setdefault(t, {'name': t[:-3], 'class': 'br_equity', 'currency': 'BRL', 'index': []})
    for t, n in US.items(): U[t] = {'name': n, 'class': 'us_equity', 'currency': 'USD'}
    for t, n in INDEX.items(): U[t] = {'name': n, 'class': 'index', 'currency': 'BRL' if t == '^BVSP' else ('' if t == 'DX-Y.NYB' else None)}
    for t, n in ETF.items(): U[t] = {'name': n, 'class': 'etf', 'currency': 'BRL' if t.endswith('.SA') else 'USD'}
    for t, (n, unit) in COMMODITY.items(): U[t] = {'name': n, 'class': 'commodity', 'currency': unit.split('/')[0], 'unit': unit}
    for t, n in CRYPTO.items(): U[t] = {'name': n, 'class': 'crypto', 'currency': 'USD'}
    for t, n in FX.items(): U[t] = {'name': n, 'class': 'fx'}
    t, n, unit = DCE; U[t] = {'name': n, 'class': 'commodity', 'currency': 'CNY', 'unit': unit}
    for src, cls, cur, idx in EXT:
        for row in (ext or {}).get(src) or []:
            cod, name = row[0], row[1]
            t = cod if cls in ('us_equity', 'crypto') else f'{cod}.SA'
            if t in U:
                if idx and cls == U[t]['class']: U[t].setdefault('index', []).append(idx)
                continue
            U[t] = {'name': clean_name(name), 'class': cls, 'currency': cur, 'index': [idx] if idx else [], 'ext': True}
    for t, m in U.items():
        if t in LINKS: m['link'] = LINKS[t]
        if t in REFS: m['ref'] = REFS[t]
        if t == 'TIO=F': m['close_only'] = True
        for k in [k for k, v in m.items() if v in (None, '', [])]: del m[k]
    return U

def _r(x):
    """6 algarismos significativos (controla o tamanho do deploy sem perder precisão útil)"""
    x = float(x)
    return float(f'{x:.6g}') if abs(x) >= 1 else round(x, 6)

def rows_from_frame(d):
    d = d.dropna(subset=['Close']); d = d[d.index.dayofweek < 5]  # FX/cripto no Yahoo têm barras de fim de semana
    return [{'time': i.strftime('%Y-%m-%d'), 'open': _r(r.Open if pd.notna(r.Open) else r.Close), 'high': _r(r.High if pd.notna(r.High) else r.Close),
             'low': _r(r.Low if pd.notna(r.Low) else r.Close), 'close': _r(r.Close), 'volume': int(r.Volume) if pd.notna(r.Volume) else 0}
            for i, r in d.iterrows()]

def yahoo_batches(tickers, period='10y'):
    """{ticker: rows}; lotes de BATCH, retry com backoff, circuit breaker após BREAKER lotes vazios seguidos"""
    out, dead = {}, 0
    for i in range(0, len(tickers), BATCH):
        if dead >= BREAKER:
            print(f'  [breaker] Yahoo sem resposta em {dead} lotes seguidos — pulando {len(tickers) - i} tickers'); break
        lot, got = tickers[i:i + BATCH], {}
        for a in range(RETRIES):
            try:
                df = yf.download(lot, period=period, auto_adjust=True, group_by='ticker', progress=False, threads=True)
                for t in lot:
                    if t in got: continue
                    try:
                        rows = rows_from_frame(df[t])
                        if len(rows) >= 20: got[t] = rows
                    except KeyError: pass
            except Exception as e:
                print(f'  lote {i // BATCH} tentativa {a + 1}: {type(e).__name__}')
            if len(got) == len(lot): break
            time.sleep(2 * (a + 1))
        dead = 0 if got else dead + 1
        out.update(got)
        print(f'  lote {i // BATCH}: {len(got)}/{len(lot)}')
    return out

def sina_dce(symbol='I0'):
    """K-line diário de futuros chineses (Sina Finance; mesmo endpoint usado pelo akshare). Retorna rows OHLCV."""
    url = (f'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_{symbol}=/InnerFuturesNewService.getDailyKLine'
           f'?symbol={symbol}&type={pd.Timestamp.now().year}_1_1')
    txt = requests.get(url, timeout=60, headers={'User-Agent': 'quant-terminal-pipeline/1.0 (+https://celowiz.github.io/quant-terminal; educational)',
                            'Referer': 'https://finance.sina.com.cn/'}).text
    data = json.loads(re.search(r'\((\[.*\])\)', txt, re.S).group(1))
    cut = (pd.Timestamp.now() - pd.DateOffset(years=10)).strftime('%Y-%m-%d')
    return [{'time': r['d'], 'open': _r(r['o']), 'high': _r(r['h']), 'low': _r(r['l']), 'close': _r(r['c']), 'volume': int(float(r['v']))}
            for r in data if r['d'] >= cut and float(r['c']) > 0]

def official_bars():
    """Fechamento oficial do último pregão (B3 COTAHIST) → ({código: barra}, info). Falha da B3 não derruba os preços."""
    try:
        day, content, url = latest_cotahist()
        off = official_closes(parse(content))
        info = {'date': day.isoformat(), 'url': url, 'source': 'B3 COTAHIST diário (mercado à vista, lote padrão)', 'n': len(off)}
        save('official_close.json', {**info, 'generated_at': now_iso(), 'closes': off})
        return off, info
    except Exception as e:
        print(f'  COTAHIST indisponível ({type(e).__name__}: {e}); última barra BR fica a do Yahoo')
        return {}, None

def _prev_rows(t):
    try: return unpack_prices(json.load(open(f'{OUT}/prices/{key(t)}.json')))
    except Exception: return None

def _prev_tickers():
    try: return json.load(open(f'{OUT}/tickers.json'))['tickers']
    except Exception: return []

def ext_sources(prev):
    """listas da cobertura ampliada; fonte fora do ar → a lista da execução anterior (tickers.json)"""
    core = set(US) | set(CRYPTO)
    def back(cls, idx):
        return [((p['ticker'][:-3] if p['ticker'].endswith('.SA') else p['ticker']), p['name']) for p in prev
                if p.get('ext') and p.get('class') == cls and (idx is None or idx in p.get('index', []))]
    fetch = {'sp500': sp500, 'ifix': lambda: b3_portfolio('IFIX', False), 'bdrx': lambda: b3_portfolio('BDRX', False), 'etf_br': b3_etfs,
             'crypto': lambda: parse_coingecko(get_json(CG_MARKETS), skip=core)}
    out, prices = {}, {}
    for src, cls, _, idx in EXT:
        try:
            out[src] = fetch[src]()
            if src == 'crypto':
                prices = {t: px for t, _, px in out[src]}
                out[src] = [(t, n) for t, n, _ in out[src]]
            print(f'  {src}: {len(out[src])}')
        except Exception as e:
            out[src] = back(cls, idx)
            print(f'  {src} indisponível ({type(e).__name__}: {e}); {len(out[src])} da execução anterior')
    return out, prices

def main():
    os.makedirs(f'{OUT}/prices', exist_ok=True)
    comp = {}
    for idx in ('IBOV', 'SMLL'):
        try: comp[idx] = b3_portfolio(idx); print(f'  B3 {idx}: {len(comp[idx])} ações')
        except Exception as e:
            print(f'  B3 {idx} indisponível ({type(e).__name__}); usando o tickers.json anterior')
            try:
                prev = json.load(open(f'{OUT}/tickers.json'))['tickers']
                comp[idx] = [(p['ticker'][:-3], p['name']) for p in prev if idx in p.get('index', [])]
            except Exception: comp[idx] = []
    prev = _prev_tickers()
    ext, cg_px = ext_sources(prev)
    U = build_universe(comp['IBOV'], comp['SMLL'], ext)
    data = yahoo_batches([t for t, m in U.items() if t != DCE[0] and not m.get('ext')])
    data.update(yahoo_batches([t for t, m in U.items() if m.get('ext')], EXT_PERIOD))
    # cripto ampliada: só a que o Yahoo confirma (preço coerente com a CoinGecko), até CRYPTO_EXT
    n_cr = 0
    for t, m in list(U.items()):
        if m.get('ext') and m['class'] == 'crypto':
            ok = t in data and (t not in cg_px or coherent(data[t], cg_px[t]))
            if not ok or n_cr >= CRYPTO_EXT: U.pop(t); data.pop(t, None); continue
            n_cr += 1
    try: data[DCE[0]] = sina_dce('I0')
    except Exception as e: print(f'  Sina DCE indisponível ({type(e).__name__})')
    off, off_info = official_bars()
    meta, kept, patched = [], [], {'replaced': 0, 'appended': 0}
    for t, m in U.items():
        rows = data.get(t)
        if not rows:
            rows = _prev_rows(t)
            if not rows: print('  sem dados:', t); continue
            kept.append(t)
        mo = {}
        if t.endswith('.SA') and t[:-3] in off:
            rows, how = apply_official(rows, off[t[:-3]])
            if how: patched[how] += 1
            if rows[-1]['time'] == off[t[:-3]]['time']: mo['official'] = rows[-1]['time']
        json.dump(pack_prices(rows), open(f'{OUT}/prices/{key(t)}.json', 'w'), separators=(',', ':'))
        meta.append({'ticker': t, 'key': key(t), **m, 'first': rows[0]['time'], 'last': rows[-1]['time'], 'n': len(rows), **mo})
    if off_info: print(f"  COTAHIST {off_info['date']}: {patched['replaced']} barras finais substituídas, {patched['appended']} acrescentadas")
    if kept: print(f'  {len(kept)} tickers mantidos do arquivo anterior: {", ".join(kept[:20])}')
    if len(meta) < MIN_TICKERS: raise RuntimeError(f'universo com {len(meta)} tickers (< {MIN_TICKERS}); tickers.json anterior mantido')
    mark_coverage({m['ticker']: m for m in meta})   # cobertura da execução anterior; o build_coverage atualiza no fim
    counts = pd.Series([m['class'] for m in meta]).value_counts().to_dict()
    print('  por classe:', counts)
    src = 'B3 (carteiras IBOV/SMLL/IFIX/BDRX, cadastro de ETFs; COTAHIST diário = fechamento oficial da última barra BR); Yahoo Finance via yfinance (OHLC ajustado); Sina Finance (DCE); S&P 500: datasets/s-and-p-500-companies; cripto: CoinGecko'
    json.dump({'generated_at': now_iso(), 'source': src, **({'official_close': off_info} if off_info else {}),
               'counts': counts, 'tickers': meta}, open(f'{OUT}/tickers.json', 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
