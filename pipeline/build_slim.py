"""Arquivos enxutos derivados de prices/<key>.json (rodam depois do pipeline e também no modo só-frontend).

- prices/r/<key>.json: últimos RECENT_DAYS dias corridos, mesmo formato colunar. O GP/GPC/HP/COMP/MACD/RSI
  carregam este primeiro e só buscam o histórico completo (prices/<key>.json) em 2Y/5Y/Max ou timeframe ≠ diário.
- weekly/<key>.json: fechamento semanal (semana terminando na sexta, como pandas W-FRI .last()) das últimas
  WEEKS semanas → {t:[sextas], c:[fechamentos]}. É o que o RRG usa para ativos fora do pacote padrão.
- rrg.json: as séries semanais do RRG padrão do Brasil (seleção inicial + benchmarks) num arquivo só.
- rrg_us.json: o mesmo para o RRG dos EUA (big techs + ETFs amplos vs S&P 500). Arquivo separado para o RRG
  do Brasil (padrão) não baixar bytes a mais. Séries dos EUA passam pelo portão D-1: a barra do dia só entra
  depois do fechamento de Nova York (16h15 ET), para uma execução fora de hora não gravar um fechamento parcial.
Nada aqui baixa dados: só reorganiza os preços já publicados, então não falha por fonte fora do ar."""
import datetime as dt, json, os, sys
from zoneinfo import ZoneInfo
from common import OUT, now_iso, step, unpack_prices

RECENT_DAYS = 730          # 1A + folga para a SMA(200) do GPC no período padrão
WEEKS = 320                # 104 semanas exibíveis + médias de até 52 + momentum de até 52 + aquecimento da EMA
RRG_DEFAULT = ['PETR4', 'VALE3', 'ITUB4', 'B3SA3', 'PETR3', 'ITUB3', 'IDX_BVSP', 'IDX_GSPC', 'IDX_IXIC', 'BOVA11']
# RRG EUA: big techs + ETFs amplos que já estão no universo (não há ETFs setoriais nele) vs S&P 500
RRG_US = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'QQQ', 'IWM', 'IDX_GSPC', 'IDX_NDX']
US_IDX = {'IDX_GSPC', 'IDX_NDX', 'IDX_IXIC', 'IDX_DJI', 'IDX_RUT'}
NY = ZoneInfo('America/New_York')
US_CLOSE = dt.time(16, 15)   # fechamento 16h + folga para a barra final assentar


def us_closed_through(now=None):
    """último pregão de NY já encerrado: hoje depois das 16h15 ET (dia útil), senão o dia útil anterior (D-1)"""
    n = (now or dt.datetime.now(dt.timezone.utc)).astimezone(NY)
    d = n.date()
    if d.weekday() >= 5 or n.time() < US_CLOSE:
        d -= dt.timedelta(days=1)
    while d.weekday() >= 5: d -= dt.timedelta(days=1)
    return d.isoformat()


def us_keys():
    """chaves negociadas em NY (ações/ETFs dos EUA e índices americanos), pelo tickers.json já publicado"""
    try:
        with open(os.path.join(OUT, 'tickers.json'), encoding='utf-8') as f: tk = json.load(f)['tickers']
    except Exception: tk = []
    ks = {t['key'] for t in tk if t.get('class') in ('us_equity', 'etf') and not t['ticker'].endswith('.SA')}
    return ks | US_IDX | (set(RRG_US) - {'IDX_GSPC', 'IDX_NDX'})


def recent(cols, days=RECENT_DAYS):
    """recorte colunar dos últimos `days` dias corridos (a partir da última data)"""
    t = cols['t']
    if not t: return cols
    cut = (dt.date.fromisoformat(t[-1]) - dt.timedelta(days=days)).isoformat()
    i = next((k for k, d in enumerate(t) if d >= cut), len(t))
    return {k: v[i:] for k, v in cols.items()}


def friday(d):
    """sexta-feira que fecha a semana de d (W-FRI)"""
    x = dt.date.fromisoformat(d)
    return (x + dt.timedelta(days=(4 - x.weekday()) % 7)).isoformat()


def weekly(rows, weeks=WEEKS, through=None):
    """último fechamento de cada semana W-FRI → {t, c} das últimas `weeks` semanas (só barras até `through`, se dado)"""
    if through: rows = [r for r in rows if r['time'] <= through]
    m = {}
    for r in rows:
        if r['close'] is not None: m[friday(r['time'])] = r['close']
    ks = sorted(m)[-weeks:]
    last = rows[-1]['time'] if rows else None   # último pregão de fato (a última "sexta" pode ser a semana corrente)
    return {'last': last, 't': ks, 'c': [m[k] for k in ks]}


def _dump(rel, obj):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: json.dump(obj, f, separators=(',', ':'), allow_nan=False)


def slim():
    src = os.path.join(OUT, 'prices')
    keys = sorted(f[:-5] for f in os.listdir(src) if f.endswith('.json'))
    bundle, us, n = {}, {}, 0
    usk, cut = us_keys(), us_closed_through()
    for k in keys:
        try:
            with open(os.path.join(src, k + '.json'), encoding='utf-8') as f: d = json.load(f)
        except Exception as e:
            print(f'  {k}: ilegível ({e})'); continue
        if isinstance(d, list):   # artefato antigo (linhas) → colunar
            d = {c: [r[f] for r in d] for c, f in (('t', 'time'), ('o', 'open'), ('h', 'high'), ('l', 'low'), ('c', 'close'), ('v', 'volume'))}
        _dump(f'prices/r/{k}.json', recent(d))
        w = weekly(unpack_prices(d), through=cut if k in usk else None)
        _dump(f'weekly/{k}.json', w)
        if k in RRG_DEFAULT: bundle[k] = w
        if k in RRG_US: us[k] = w
        n += 1
    for name, b in (('rrg.json', bundle), ('rrg_us.json', us)):
        last = max((w['last'] for w in b.values() if w.get('last')), default=None)
        _dump(name, {'generated_at': now_iso(), **({'last': last} if last else {}), 'weeks': WEEKS, 'series': b})
    print(f'  {n} ativos: prices/r/ ({RECENT_DAYS} dias), weekly/ ({WEEKS} semanas), rrg.json ({len(bundle)} séries), '
          f'rrg_us.json ({len(us)} séries, EUA até {cut})')


if __name__ == '__main__':
    sys.exit(0 if step('slim', slim) else 1)
