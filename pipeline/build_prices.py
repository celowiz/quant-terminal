"""Preços OHLCV diários (10 anos, ajustados) do universo do seletor + tickers.json.

Universo (dinâmico onde há fonte oficial):
  - Ações BR: carteiras teóricas B3 do Ibovespa (IBOV) e do Small Cap (SMLL), lidas a cada execução.
  - Ações EUA (~30 maiores por valor de mercado), índices, ETFs, commodities, cripto e moedas: listas fixas abaixo.
  - Minério de ferro: Dalian (DCE, contínuo I0, CNY/t) via K-line diário público da Sina Finance;
    Singapura (SGX 62% Fe, USD/t) via Yahoo TIO=F (só fechamento: o Yahoo não publica OHLC intradiário dele).
Fontes: B3 (carteiras), Yahoo Finance via yfinance (lotes + retry + circuit breaker), Sina Finance (DCE).
Se uma fonte cair, o arquivo anterior do ticker é mantido (load_prev) e o ticker continua no tickers.json."""
import base64, json, os, re, time
import pandas as pd, requests, yfinance as yf
from common import OUT, now_iso, get_json, EQUITIES

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

def b3_portfolio(index):
    """componentes da carteira teórica do dia (B3) → [(cod, nome)]"""
    q = base64.b64encode(json.dumps({"language": "pt-br", "pageNumber": 1, "pageSize": 200, "index": index, "segment": "2"}).encode()).decode()
    d = get_json(f'https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/{q}')
    return [(r['cod'].strip(), f"{' '.join(r['asset'].split())} {' '.join(r['type'].split()[:1])}".strip()) for r in d['results']]

def build_universe(ibov, smll):
    """dict ticker → meta (sem preços). ibov/smll = [(cod, nome)] das carteiras B3."""
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
    for t, m in U.items():
        if t in EQUITIES: m['corp'] = True
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

def yahoo_batches(tickers):
    """{ticker: rows}; lotes de BATCH, retry com backoff, circuit breaker após BREAKER lotes vazios seguidos"""
    out, dead = {}, 0
    for i in range(0, len(tickers), BATCH):
        if dead >= BREAKER:
            print(f'  [breaker] Yahoo sem resposta em {dead} lotes seguidos — pulando {len(tickers) - i} tickers'); break
        lot, got = tickers[i:i + BATCH], {}
        for a in range(RETRIES):
            try:
                df = yf.download(lot, period='10y', auto_adjust=True, group_by='ticker', progress=False, threads=True)
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

def _prev_rows(t):
    try: return json.load(open(f'{OUT}/prices/{key(t)}.json'))
    except Exception: return None

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
    U = build_universe(comp['IBOV'], comp['SMLL'])
    data = yahoo_batches([t for t in U if t != DCE[0]])
    try: data[DCE[0]] = sina_dce('I0')
    except Exception as e: print(f'  Sina DCE indisponível ({type(e).__name__})')
    meta, kept = [], []
    for t, m in U.items():
        rows = data.get(t)
        if rows: json.dump(rows, open(f'{OUT}/prices/{key(t)}.json', 'w'), separators=(',', ':'))
        else:
            rows = _prev_rows(t)
            if not rows: print('  sem dados:', t); continue
            kept.append(t)
        meta.append({'ticker': t, 'key': key(t), **m, 'first': rows[0]['time'], 'last': rows[-1]['time'], 'n': len(rows)})
    if kept: print(f'  {len(kept)} tickers mantidos do arquivo anterior: {", ".join(kept[:20])}')
    if len(meta) < MIN_TICKERS: raise RuntimeError(f'universo com {len(meta)} tickers (< {MIN_TICKERS}); tickers.json anterior mantido')
    counts = pd.Series([m['class'] for m in meta]).value_counts().to_dict()
    print('  por classe:', counts)
    json.dump({'generated_at': now_iso(), 'source': 'B3 (carteiras IBOV/SMLL); Yahoo Finance via yfinance (OHLC ajustado); Sina Finance (DCE)',
               'counts': counts, 'tickers': meta}, open(f'{OUT}/tickers.json', 'w'), ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
