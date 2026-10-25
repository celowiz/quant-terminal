"""Mercados: universo IBOV (TOP/HEAT/PORT/BETA), índices mundiais (WEI), moedas (FX),
indicadores econômicos (ECON), CDI (CDIE) e renda fixa mundial (WFI).
Fontes: B3 (carteira teórica do IBOV), Yahoo Finance (yfinance), BCB SGS/Olinda (PTAX, Focus), FRED."""
import io, json, datetime as dt, base64
import pandas as pd, yfinance as yf
from common import save, get, get_json, load_prev, clean, step, now_iso, today_brt

TODAY = today_brt()

def closes_frame(tickers, period='2y'):
    df = yf.download(tickers, period=period, auto_adjust=True, progress=False, threads=True, group_by='ticker')
    out = {}
    for t in tickers:
        try:
            s = df[t]['Close'].dropna()
            s = s[s.index.dayofweek < 5]
            if len(s) > 5: out[t] = s
        except Exception: pass
    return out, df

def universe():
    q = base64.b64encode(json.dumps({"language": "pt-br", "pageNumber": 1, "pageSize": 120, "index": "IBOV", "segment": "2"}).encode()).decode()
    d = get_json(f'https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/{q}')
    comp = [{'cod': r['cod'], 'name': r['asset'].strip(), 'type': ' '.join(r['type'].split()), 'sector': r['segment'].split('/')[0].strip(),
             'subsector': r['segment'].strip(), 'weight': float(r['part'].replace('.', '').replace(',', '.'))} for r in d['results']]
    tick = [c['cod'] + '.SA' for c in comp] + ['^BVSP']
    cl, df = closes_frame(tick, '3y')
    idx = sorted(set().union(*[s.index for s in cl.values()]))
    idx = [i for i in idx if (cl['^BVSP'].index == i).any()] if '^BVSP' in cl else idx
    dates = [i.strftime('%Y-%m-%d') for i in idx]
    series, vols = {}, {}
    for t, s in cl.items():
        s = s.reindex(idx)
        series[t.replace('.SA', '')] = [clean(v, 3) for v in s.values]
        try:
            v = df[t]['Volume'].reindex(idx).fillna(0) * df[t]['Close'].reindex(idx).fillna(0)
            vols[t.replace('.SA', '')] = [int(x) for x in v.values[-30:]]
        except Exception: pass
    comp = [c for c in comp if c['cod'] in series]
    save('universe.json', {'generated_at': now_iso(), 'source': 'B3 – carteira teórica do Ibovespa (pesos e setores); Yahoo Finance via yfinance (fechamento ajustado)',
                           'date_portfolio': d['header']['date'], 'components': comp, 'dates': dates, 'close': series, 'fin_volume_30d': vols})

WORLD = [
    ('Américas', [('^GSPC', 'S&P 500', 'US'), ('^DJI', 'Dow Jones Industrial', 'US'), ('^IXIC', 'Nasdaq Composite', 'US'), ('^RUT', 'Russell 2000', 'US'),
                  ('^GSPTSE', 'S&P/TSX Composite', 'CA'), ('^BVSP', 'Ibovespa', 'BR'), ('^MXX', 'S&P/BMV IPC', 'MX'), ('^MERV', 'S&P Merval', 'AR'), ('^IPSA', 'S&P IPSA', 'CL')]),
    ('EMEA', [('^STOXX50E', 'Euro Stoxx 50', 'EU'), ('^FTSE', 'FTSE 100', 'GB'), ('^GDAXI', 'DAX', 'DE'), ('^FCHI', 'CAC 40', 'FR'), ('^IBEX', 'IBEX 35', 'ES'),
              ('FTSEMIB.MI', 'FTSE MIB', 'IT'), ('^AEX', 'AEX', 'NL'), ('^SSMI', 'SMI', 'CH'), ('^OMX', 'OMX Stockholm 30', 'SE'), ('^J203.JO', 'JSE All Share', 'ZA')]),
    ('Ásia-Pacífico', [('^N225', 'Nikkei 225', 'JP'), ('^HSI', 'Hang Seng', 'HK'), ('000001.SS', 'Shanghai Composite', 'CN'), ('^KS11', 'KOSPI', 'KR'),
                       ('^TWII', 'TAIEX', 'TW'), ('^AXJO', 'S&P/ASX 200', 'AU'), ('^BSESN', 'S&P BSE Sensex', 'IN'), ('^NSEI', 'Nifty 50', 'IN'), ('^STI', 'Straits Times', 'SG')]),
]

def world():
    tick = [t for _, L in WORLD for t, _, _ in L]
    cl, _ = closes_frame(tick, '2y')
    regions = []
    for reg, L in WORLD:
        rows = []
        for t, name, cc in L:
            if t not in cl: continue
            s = cl[t]
            rows.append({'ticker': t, 'name': name, 'country': cc, 'dates': [i.strftime('%Y-%m-%d') for i in s.index], 'close': [clean(v, 2) for v in s.values]})
        regions.append({'region': reg, 'rows': rows})
    save('world.json', {'generated_at': now_iso(), 'source': 'Yahoo Finance via yfinance (fechamento diário, não é tempo real)', 'regions': regions})

CCY = ['BRL', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'MXN', 'ARS', 'CLP', 'INR', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'ZAR', 'TRY', 'KRW', 'HKD', 'SGD', 'COP', 'PEN', 'IDR', 'ILS']

def fx():
    tick = [f'{c}=X' for c in CCY] + ['DX-Y.NYB']
    cl, _ = closes_frame(tick, '2y')
    idx = sorted(set().union(*[s.index for s in cl.values()]))
    dates = [i.strftime('%Y-%m-%d') for i in idx]
    usd_per = {c: [clean(v, 6) for v in cl[f'{c}=X'].reindex(idx).ffill().values] for c in CCY if f'{c}=X' in cl}
    dxy = [clean(v, 3) for v in cl['DX-Y.NYB'].reindex(idx).ffill().values] if 'DX-Y.NYB' in cl else []
    ptax = {}
    ini = (TODAY - dt.timedelta(days=120)).strftime('%m-%d-%Y'); fim = TODAY.strftime('%m-%d-%Y')
    for m in ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']:
        try:
            if m == 'USD':
                u = f"https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@a,dataFinalCotacao=@b)?@a='{ini}'&@b='{fim}'&$format=json"
                v = [{'date': r['dataHoraCotacao'][:10], 'buy': r['cotacaoCompra'], 'sell': r['cotacaoVenda']} for r in get_json(u)['value']]
            else:
                u = f"https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@m,dataInicial=@a,dataFinalCotacao=@b)?@m='{m}'&@a='{ini}'&@b='{fim}'&$format=json"
                v = [{'date': r['dataHoraCotacao'][:10], 'buy': r['cotacaoCompra'], 'sell': r['cotacaoVenda']} for r in get_json(u)['value'] if r['tipoBoletim'] == 'Fechamento']
            ptax[m] = v
        except Exception as e:
            print('ptax', m, e)
    save('fx.json', {'generated_at': now_iso(), 'source': 'Yahoo Finance (USD/XXX, fechamento diário); BCB PTAX via API Olinda (boletim de fechamento)',
                     'dates': dates, 'usd_per': usd_per, 'dxy': dxy, 'ptax': ptax})

def sgs(code, start=None, last=None):
    if last:
        u = f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados/ultimos/{last}?formato=json'
        return [(dt.datetime.strptime(r['data'], '%d/%m/%Y').date(), float(r['valor'])) for r in get_json(u)]
    out = []; s = start
    while s <= TODAY:
        e = min(dt.date(s.year + 9, 12, 31), TODAY)
        u = f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados?formato=json&dataInicial={s:%d/%m/%Y}&dataFinal={e:%d/%m/%Y}'
        try: out += [(dt.datetime.strptime(r['data'], '%d/%m/%Y').date(), float(r['valor'])) for r in get_json(u)]
        except Exception as ex: print('sgs', code, s, ex)
        s = dt.date(e.year + 1, 1, 1)
    return out

def fred(ids, start='2005-01-01'):
    cols = {}
    for i in ids:  # uma série por requisição (o CSV multi-série do FRED mistura frequências)
        try:
            r = get(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={i}&cosd={start}')
            df = pd.read_csv(io.StringIO(r.text), na_values=['.'])
            cols[i] = pd.Series(df.iloc[:, 1].values, index=pd.to_datetime(df.iloc[:, 0]))
        except Exception as e: print('fred', i, e)
    return pd.DataFrame(cols)

def cdi():
    s = sgs(12, dt.date(2000, 1, 1))
    save('cdi.json', {'generated_at': now_iso(), 'source': 'Banco Central do Brasil – SGS série 12 (CDI, % a.d.)', 'series': [[d.isoformat(), v] for d, v in s]})

ECON_BR = [
    # code, nome, unidade, frequência, transformação
    (432, 'Selic – meta (Copom)', '% a.a.', 'D', None),
    (12, 'CDI', '% a.d.', 'D', None),
    (433, 'IPCA – variação mensal', '% m/m', 'M', None),
    (13522, 'IPCA – acumulado 12 meses', '% 12m', 'M', None),
    (189, 'IGP-M – variação mensal', '% m/m', 'M', None),
    (188, 'INPC – variação mensal', '% m/m', 'M', None),
    (24369, 'Taxa de desocupação (PNAD Contínua)', '%', 'M', None),
    (24363, 'IBC-Br (índice dessazonalizado)', 'índice', 'M', None),
    (4380, 'PIB mensal (valores correntes)', 'R$ mi', 'M', None),
    (1, 'Dólar PTAX venda', 'R$/US$', 'D', None),
    (13762, 'Dívida bruta do governo geral (% PIB)', '% PIB', 'M', None),
    (5793, 'Resultado primário setor público (12m, % PIB)', '% PIB', 'M', None),
    (22707, 'Balança comercial – saldo mensal', 'US$ mi', 'M', None),
    (3546, 'Reservas internacionais', 'US$ mi', 'D', None),
]
ECON_US = [('FEDFUNDS', 'Fed Funds efetiva', '%', 'M'), ('CPIAUCSL', 'CPI EUA (índice)', 'índice', 'M'), ('UNRATE', 'Desemprego EUA', '%', 'M'),
           ('PAYEMS', 'Payroll (emprego não agrícola)', 'mil', 'M'), ('GDPC1', 'PIB real EUA', 'US$ bi 2017', 'Q'), ('DGS10', 'Treasury 10 anos', '%', 'D'),
           ('T10Y2Y', 'Spread 10a–2a', 'p.p.', 'D'), ('DCOILBRENTEU', 'Petróleo Brent', 'US$/bbl', 'D')]

def econ():
    start = dt.date(TODAY.year - 12, 1, 1); items = []
    prev = {x['id']: x for x in (load_prev('econ.json') or {}).get('series', [])}
    for code, name, unit, fq, _ in ECON_BR:
        try:
            s = sgs(code, start if fq == 'M' else dt.date(TODAY.year - 6, 1, 1))
            if fq == 'D':  # reduz diárias para fim de mês + últimos 60 dias
                df = pd.Series({d: v for d, v in s}); df.index = pd.to_datetime(df.index)
                m = df.resample('ME').last().dropna()
                pts = [[i.date().isoformat(), float(v)] for i, v in m.items()][:-1] + [[d.isoformat(), v] for d, v in s[-60:]]
            else:
                pts = [[d.isoformat(), v] for d, v in s]
            p0 = prev.get(f'SGS{code}')
            if p0 and len(pts) < 0.8 * len(p0['points']):  # fonte falhou em parte: mantém a série anterior
                print('econ', code, f'parcial ({len(pts)} < {len(p0["points"])}), mantendo anterior'); pts = p0['points']
            items.append({'id': f'SGS{code}', 'country': 'BR', 'name': name, 'unit': unit, 'freq': fq, 'source': f'BCB SGS {code}', 'points': pts})
        except Exception as e:
            print('econ', code, e)
            if f'SGS{code}' in prev: items.append(prev[f'SGS{code}'])
    try:
        f = fred([i for i, *_ in ECON_US], start.isoformat())
        for i, name, unit, fq in ECON_US:
            s = f[i].dropna()
            if fq == 'D':
                m = s.resample('ME').last().dropna(); pts = [[d.date().isoformat(), float(v)] for d, v in m.items()][:-1] + [[d.date().isoformat(), float(v)] for d, v in s[-60:].items()]
            else: pts = [[d.date().isoformat(), float(v)] for d, v in s.items()]
            items.append({'id': i, 'country': 'US', 'name': name, 'unit': unit, 'freq': fq, 'source': f'FRED {i}', 'points': pts})
    except Exception as e: print('fred', e)
    focus = []
    for ind in ['IPCA', 'Selic', 'PIB Total', 'Câmbio', 'IGP-M']:
        try:
            u = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=40&$format=json"
                 f"&$filter=Indicador%20eq%20'{ind.replace(' ', '%20')}'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc")
            v = get_json(u)['value']; d0 = v[0]['Data']
            for r in v:
                if r['Data'] == d0: focus.append({'indicator': ind, 'date': d0, 'year': r['DataReferencia'], 'median': r['Mediana'], 'mean': r['Media'], 'n': r['numeroRespondentes']})
        except Exception as e: print('focus', ind, e)
    if not focus: focus = (load_prev('econ.json') or {}).get('focus', [])
    save('econ.json', {'generated_at': now_iso(), 'source': 'BCB SGS; BCB Focus (Expectativas, API Olinda); FRED – Federal Reserve Bank of St. Louis', 'series': items, 'focus': focus})

def wfi():
    curve_ids = ['DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1', 'DGS2', 'DGS3', 'DGS5', 'DGS7', 'DGS10', 'DGS20', 'DGS30']
    tenors = [1/12, .25, .5, 1, 2, 3, 5, 7, 10, 20, 30]
    f = fred(curve_ids, (TODAY - dt.timedelta(days=800)).isoformat()).ffill().dropna()
    def at(d):
        r = f[f.index <= d].iloc[-1]; return {'date': f[f.index <= d].index[-1].date().isoformat(), 'y': [clean(r[i], 3) for i in curve_ids]}
    last = f.index[-1]
    us = {'tenors': tenors, 'labels': ['1M', '3M', '6M', '1A', '2A', '3A', '5A', '7A', '10A', '20A', '30A'],
          'now': at(last), 'w1': at(last - pd.Timedelta(days=7)), 'm1': at(last - pd.Timedelta(days=30)), 'y1': at(last - pd.Timedelta(days=365))}
    gov = [('DE', 'Alemanha'), ('GB', 'Reino Unido'), ('JP', 'Japão'), ('FR', 'França'), ('IT', 'Itália'), ('ES', 'Espanha'), ('CA', 'Canadá'),
           ('AU', 'Austrália'), ('CH', 'Suíça'), ('KR', 'Coreia do Sul'), ('MX', 'México'), ('ZA', 'África do Sul')]
    ids = [f'IRLTLT01{c}M156N' for c, _ in gov]
    g = fred(ids, (TODAY - dt.timedelta(days=4000)).isoformat())
    sov = [{'country': c, 'name': n, 'id': i, 'points': [[d.date().isoformat(), clean(v, 3)] for d, v in g[i].dropna().items()]} for (c, n), i in zip(gov, ids) if i in g]
    us10 = fred(['DGS10'], (TODAY - dt.timedelta(days=4000)).isoformat())['DGS10'].dropna().resample('ME').mean()
    sov.insert(0, {'country': 'US', 'name': 'Estados Unidos', 'id': 'DGS10 (média mensal)', 'points': [[d.date().isoformat(), clean(v, 3)] for d, v in us10.items()]})
    idx_ids = [('BAMLCC0A0CMTRIV', 'ICE BofA US Corporate', 'US IG'), ('BAMLHYH0A0HYM2TRIV', 'ICE BofA US High Yield', 'US HY'),
               ('BAMLEMCBPITRIV', 'ICE BofA Emerging Markets Corporate Plus', 'EM Corp'), ('BAMLHE00EHYITRIV', 'ICE BofA Euro High Yield', 'EUR HY'),
               ('BAMLEMHBHYCRPITRIV', 'ICE BofA High Yield EM Corporate Plus', 'EM HY'), ('BAMLCC0A1AAATRIV', 'ICE BofA AAA US Corporate', 'US AAA')]
    ix = fred([i for i, *_ in idx_ids], (TODAY - dt.timedelta(days=1200)).isoformat())
    indexes = [{'id': i, 'name': n, 'short': s, 'points': [[d.date().isoformat(), clean(v, 2)] for d, v in ix[i].dropna().items()]} for i, n, s in idx_ids if i in ix]
    oas = fred(['BAMLC0A0CM', 'BAMLH0A0HYM2', 'BAMLEMCBPIOAS'], (TODAY - dt.timedelta(days=1200)).isoformat())
    spreads = [{'id': i, 'name': n, 'points': [[d.date().isoformat(), clean(v, 2)] for d, v in oas[i].dropna().items()]} for i, n in
               [('BAMLC0A0CM', 'US Corporate OAS'), ('BAMLH0A0HYM2', 'US High Yield OAS'), ('BAMLEMCBPIOAS', 'EM Corporate OAS')] if i in oas]
    br = {}
    try:
        s = [x for x in sgs(432, TODAY - dt.timedelta(days=60)) if x[0] <= TODAY]; br['selic'] = {'date': s[-1][0].isoformat(), 'v': s[-1][1]}  # SGS 432 traz datas futuras até a próxima reunião
        c = sgs(4389, last=1); br['cdi_aa'] = {'date': c[-1][0].isoformat(), 'v': c[-1][1]}
    except Exception as e: print('br', e)
    if not {'selic', 'cdi_aa'} <= br.keys():  # mantém o valor anterior se o BCB falhar
        br = {**((load_prev('wfi.json') or {}).get('br') or {}), **br}
    save('wfi.json', {'generated_at': now_iso(), 'source': 'FRED (US Treasury constant maturity, OCDE long-term rates, índices ICE BofA total return e OAS); BCB SGS (Selic/CDI)',
                      'us_curve': us, 'sovereign10y': sov, 'indexes': indexes, 'spreads': spreads, 'br': br})

if __name__ == '__main__':
    import sys
    steps = {'universe': universe, 'world': world, 'fx': fx, 'cdi': cdi, 'econ': econ, 'wfi': wfi}
    for k in (sys.argv[1:] or steps): step(k, steps[k])
