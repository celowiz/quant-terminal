"""OMON (versão honesta): cadeia de opções de FECHAMENTO do último pregão a partir do arquivo público
COTAHIST diário da B3. Não há book nem tempo real. Vol. implícita e gregas por Black-Scholes, com o CDI como juro."""
import io, zipfile, math, datetime as dt, json, os
from common import save, get, step, now_iso, OUT

UNDER = {  # prefixo do código de opção, espécie do subjacente -> ativo-objeto
    'PETR4.SA': ('PETR', 'PN'), 'PETR3.SA': ('PETR', 'ON'), 'VALE3.SA': ('VALE', 'ON'), 'ITUB4.SA': ('ITUB', 'PN'), 'ITUB3.SA': ('ITUB', 'ON'), 'B3SA3.SA': ('B3SA', 'ON'), 'BOVA11.SA': ('BOVA', 'CI')}

def latest_cotahist():
    d = dt.date.today()
    for i in range(0, 10):
        x = d - dt.timedelta(days=i)
        if x.weekday() >= 5: continue
        url = f'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D{x:%d%m%Y}.ZIP'
        try:
            r = get(url, tries=1, timeout=120)
            if r.content[:2] == b'PK': return x, r.content, url
        except Exception as e: print('cotahist', x, e)
    raise RuntimeError('COTAHIST indisponível')

def parse(content):
    z = zipfile.ZipFile(io.BytesIO(content)); txt = z.read(z.namelist()[0]).decode('latin1')
    rows = []
    for ln in txt.splitlines():
        if not ln.startswith('01'): continue
        f = lambda a, b: ln[a - 1:b]
        n = lambda a, b, dv=100: int(f(a, b)) / dv
        rows.append({'codbdi': f(11, 12), 'code': f(13, 24).strip(), 'tpmerc': f(25, 27), 'nomres': f(28, 39).strip(), 'especi': f(40, 49).strip(),
                     'open': n(57, 69), 'high': n(70, 82), 'low': n(83, 95), 'avg': n(96, 108), 'last': n(109, 121), 'bid': n(122, 134), 'ask': n(135, 147),
                     'trades': int(f(148, 152)), 'qty': int(f(153, 170)), 'vol': n(171, 188), 'strike': n(189, 201), 'exp': f(203, 210), 'fatcot': int(f(211, 217))})
    return rows

N = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
n = lambda x: math.exp(-x * x / 2) / math.sqrt(2 * math.pi)

def bs(S, K, T, r, s, call):
    if T <= 0 or s <= 0: return None
    d1 = (math.log(S / K) + (r + s * s / 2) * T) / (s * math.sqrt(T)); d2 = d1 - s * math.sqrt(T)
    if call: p = S * N(d1) - K * math.exp(-r * T) * N(d2); delta = N(d1)
    else: p = K * math.exp(-r * T) * N(-d2) - S * N(-d1); delta = N(d1) - 1
    gamma = n(d1) / (S * s * math.sqrt(T)); vega = S * n(d1) * math.sqrt(T) / 100
    theta = (-(S * n(d1) * s) / (2 * math.sqrt(T)) - (r * K * math.exp(-r * T) * (N(d2) if call else -N(-d2)))) / 252
    return p, delta, gamma, vega, theta

def iv(price, S, K, T, r, call):
    intrinsic = max(0.0, (S - K * math.exp(-r * T)) if call else (K * math.exp(-r * T) - S))
    if price <= intrinsic + 1e-4 or T <= 0: return None
    lo, hi = 1e-4, 5.0
    for _ in range(80):
        mid = (lo + hi) / 2; p = bs(S, K, T, r, mid, call)[0]
        if p > price: hi = mid
        else: lo = mid
    return (lo + hi) / 2

def bdays(a, b):
    d, c = a, 0
    while d < b:
        d += dt.timedelta(days=1)
        if d.weekday() < 5: c += 1
    return c

def options():
    day, content, url = latest_cotahist(); rows = parse(content)
    try:
        cdi = json.load(open(os.path.join(OUT, 'cdi.json')))['series'][-1][1]; r = math.log((1 + cdi / 100) ** 252)
    except Exception: r = math.log(1.15)
    spots = {r_['code']: r_ for r_ in rows if r_['tpmerc'] == '010' and r_['codbdi'] in ('02', '12')}
    for t, (pref, esp) in UNDER.items():
        code = t.replace('.SA', ''); sp = spots.get(code)
        if not sp: continue
        S = sp['last']
        opts = [o for o in rows if o['tpmerc'] in ('070', '080') and o['code'].startswith(pref) and o['especi'].split()[0] == esp]
        exps = {}
        for o in opts:
            if not (0.6 * S <= o['strike'] <= 1.4 * S): continue
            e = dt.datetime.strptime(o['exp'], '%Y%m%d').date(); bd = bdays(day, e)
            if bd <= 0: continue
            T = bd / 252; call = o['tpmerc'] == '070'
            px = o['last'] / max(o['fatcot'], 1)
            v = iv(px, S, o['strike'], T, r, call) if o['trades'] > 0 else None
            g = bs(S, o['strike'], T, r, v, call) if v else None
            exps.setdefault(e.isoformat(), {'date': e.isoformat(), 'bdays': bd, 'calls': [], 'puts': []})['calls' if call else 'puts'].append({
                'code': o['code'], 'strike': o['strike'], 'last': px, 'open': o['open'], 'high': o['high'], 'low': o['low'], 'bid': o['bid'], 'ask': o['ask'],
                'trades': o['trades'], 'qty': o['qty'], 'vol': o['vol'], 'iv': round(v * 100, 2) if v else None,
                'delta': round(g[1], 3) if g else None, 'gamma': round(g[2], 4) if g else None, 'vega': round(g[3], 4) if g else None, 'theta': round(g[4], 4) if g else None})
        E = sorted(exps.values(), key=lambda x: x['date'])
        E = [e for e in E if sum(o['trades'] for o in e['calls'] + e['puts']) > 0][:8]
        for e in E:
            e['calls'].sort(key=lambda o: o['strike']); e['puts'].sort(key=lambda o: o['strike'])
        save(f'options/{code}.json', {'generated_at': now_iso(), 'source': f'B3 – COTAHIST diário (arquivo público de fechamento): {url}', 'date': day.isoformat(),
                                      'underlying': code, 'spot': S, 'spot_change': None, 'r_cont': round(r, 5), 'cdi_daily': None,
                                      'model': 'Black-Scholes (europeia), juro = CDI anualizado contínuo, prazo = dias úteis/252 (sem feriados)', 'expiries': E})

if __name__ == '__main__':
    step('options', options)
