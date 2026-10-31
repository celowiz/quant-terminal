"""B3 COTAHIST diário (arquivo público da B3): leitura e fechamento oficial das ações BR.
Usado por build_prices (barra final oficial), build_corp (preço bruto) e build_options (cadeia de opções)."""
import io, os, zipfile, datetime as dt
from common import get, today_brt, CACHE

URL = 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D{:%d%m%Y}.ZIP'
LOT_BDI = ('02', '12', '14')  # lote padrão: ações/units (02), FII (12), cotas de fundos/ETF (14)

def latest_cotahist(days=10):
    """(data, bytes do zip, url) do último pregão publicado. Guarda o zip no cache (prices e options usam o mesmo)."""
    d = today_brt()
    for i in range(0, days):
        x = d - dt.timedelta(days=i)
        if x.weekday() >= 5: continue
        url = URL.format(x)
        p = os.path.join(CACHE, f'COTAHIST_D{x:%Y%m%d}.ZIP')
        if os.path.exists(p):
            b = open(p, 'rb').read()
            if b[:2] == b'PK': return x, b, url
        try:
            r = get(url, tries=1, timeout=120)
            if r.content[:2] == b'PK':
                open(p, 'wb').write(r.content)
                return x, r.content, url
        except Exception as e: print('cotahist', x, e)
    raise RuntimeError('COTAHIST indisponível')

def cotahist_day(x):
    """zip do COTAHIST de um pregão específico (datetime.date), com cache; None se indisponível."""
    p = os.path.join(CACHE, f'COTAHIST_D{x:%Y%m%d}.ZIP')
    if os.path.exists(p):
        b = open(p, 'rb').read()
        if b[:2] == b'PK': return b
    try:
        r = get(URL.format(x), tries=1, timeout=90)
        if r.content[:2] == b'PK':
            open(p, 'wb').write(r.content)
            return r.content
    except Exception as e: print('cotahist', x, e)
    return None

def parse(content):
    z = zipfile.ZipFile(io.BytesIO(content)); txt = z.read(z.namelist()[0]).decode('latin1')
    rows = []
    for ln in txt.splitlines():
        if not ln.startswith('01'): continue
        f = lambda a, b: ln[a - 1:b]
        n = lambda a, b, dv=100: int(f(a, b)) / dv
        rows.append({'date': f(3, 10), 'codbdi': f(11, 12), 'code': f(13, 24).strip(), 'tpmerc': f(25, 27), 'nomres': f(28, 39).strip(), 'especi': f(40, 49).strip(),
                     'open': n(57, 69), 'high': n(70, 82), 'low': n(83, 95), 'avg': n(96, 108), 'last': n(109, 121), 'bid': n(122, 134), 'ask': n(135, 147),
                     'trades': int(f(148, 152)), 'qty': int(f(153, 170)), 'vol': n(171, 188), 'strike': n(189, 201), 'exp': f(203, 210), 'fatcot': int(f(211, 217)), 'isin': f(231, 242).strip()})
    return rows

def official_closes(rows):
    """código → barra oficial do mercado à vista (tpmerc 010), lote padrão. fatcot normaliza cotações por lote de 1000."""
    out = {}
    for r in rows:
        if r['tpmerc'] != '010' or r['codbdi'] not in LOT_BDI or r['last'] <= 0: continue
        k = max(1, r['fatcot'] or 1)
        d = r['date']
        out[r['code']] = {'time': f'{d[:4]}-{d[4:6]}-{d[6:8]}', 'open': round(r['open'] / k, 4), 'high': round(r['high'] / k, 4),
                          'low': round(r['low'] / k, 4), 'close': round(r['last'] / k, 4), 'volume': r['qty'],
                          'trades': r['trades'], 'value': r['vol']}
    return out

def apply_official(rows, bar):
    """Barra final oficial na série diária (OHLC ajustado do Yahoo). A última barra ajustada é igual à bruta
    (o ajuste só altera barras anteriores a eventos), então o OHLC do COTAHIST entra sem conversão.
    - mesma data: substitui (o build pode ter pego uma barra incompleta);
    - data nova: acrescenta (Yahoo ainda sem o pregão);
    - série já à frente do COTAHIST: não mexe.
    Devolve (rows, 'replaced' | 'appended' | None)."""
    if not rows or not bar: return rows, None
    b = {k: bar[k] for k in ('time', 'open', 'high', 'low', 'close', 'volume')}
    last = rows[-1]['time']
    if last == b['time']: return rows[:-1] + [b], 'replaced'
    if last < b['time']: return rows + [b], 'appended'
    return rows, None

def suspect(rows, i, tol=0.10):
    """barra i com abertura/mínima/máxima muito fora do intervalo entre o fechamento anterior e o fechamento do dia
    (ex.: negócio isolado sem volume gravado como abertura/mínima)."""
    if i <= 0 or i >= len(rows): return False
    r, pc = rows[i], rows[i - 1]['close']
    lo, hi = min(pc, r['close']), max(pc, r['close'])
    return (r['low'] < lo * (1 - tol) or r['high'] > hi * (1 + tol)
            or not (r['low'] <= r['open'] <= r['high']) or not (r['low'] <= r['close'] <= r['high']))

def _rescaled(row, ref):
    """O/H/L oficiais (ref) levados à escala do fechamento ajustado de row; None se as escalas não batem
    ou se o resultado não é uma barra coerente (sem forçar valores)."""
    if not ref or not ref.get('close') or ref['close'] <= 0: return None
    k = row['close'] / ref['close']
    if not 0.85 < k < 1.15: return None
    out = dict(row)
    for f in ('open', 'high', 'low'): out[f] = float(f'{ref[f] * k:.6g}')
    eps = 1e-5 * row['close']   # só arredondamento
    if not (out['low'] - eps <= min(out['open'], out['close']) and max(out['open'], out['close']) <= out['high'] + eps): return None
    out['high'], out['low'] = max(out['high'], out['open'], out['close']), min(out['low'], out['open'], out['close'])
    return out

def repair_bad_bars(rows, ledger=None, official=None, recent=20):
    """Corrige O/H/L de barras suspeitas apenas com valores oficiais do mesmo pregão (COTAHIST):
    1) ledger {data: barra oficial} de correções anteriores (persistido entre execuções);
    2) nas últimas `recent` barras, official(data) → barra oficial ou None.
    Sem referência oficial a barra fica exatamente como veio. Devolve (rows, [datas corrigidas], {data: barra oficial usada})."""
    if not rows: return rows, [], {}
    ledger = ledger or {}
    out, fixed, used = [dict(r) for r in rows], [], {}
    for i in range(1, len(out)):
        if not suspect(out, i): continue
        d = out[i]['time']
        ref = ledger.get(d)
        if ref is None and official and i >= len(out) - recent: ref = official(d)
        c = _rescaled(out[i], ref)
        if c and not suspect(out[:i] + [c], i) and c != out[i]:
            out[i] = c; fixed.append(d)
            used[d] = {k: ref[k] for k in ('open', 'high', 'low', 'close')}
    return out, fixed, used
