"""Arquivos enxutos derivados de prices/<key>.json (rodam depois do pipeline e também no modo só-frontend).

- prices/r/<key>.json: últimos RECENT_DAYS dias corridos, mesmo formato colunar. O GP/GPC/HP/COMP/MACD/RSI
  carregam este primeiro e só buscam o histórico completo (prices/<key>.json) em 2Y/5Y/Max ou timeframe ≠ diário.
- weekly/<key>.json: fechamento semanal (semana terminando na sexta, como pandas W-FRI .last()) das últimas
  WEEKS semanas → {t:[sextas], c:[fechamentos]}. É o que o RRG usa para ativos fora do pacote padrão.
- rrg.json: as séries semanais do RRG padrão (seleção inicial + benchmarks) num arquivo só.
Nada aqui baixa dados: só reorganiza os preços já publicados, então não falha por fonte fora do ar."""
import datetime as dt, json, os, sys
from common import OUT, now_iso, step, unpack_prices

RECENT_DAYS = 730          # 1A + folga para a SMA(200) do GPC no período padrão
WEEKS = 320                # 104 semanas exibíveis + médias de até 52 + momentum de até 52 + aquecimento da EMA
RRG_DEFAULT = ['PETR4', 'VALE3', 'ITUB4', 'B3SA3', 'PETR3', 'ITUB3', 'IDX_BVSP', 'IDX_GSPC', 'IDX_IXIC', 'BOVA11']


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


def weekly(rows, weeks=WEEKS):
    """último fechamento de cada semana W-FRI → {t, c} das últimas `weeks` semanas"""
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
    bundle, n = {}, 0
    for k in keys:
        try:
            with open(os.path.join(src, k + '.json'), encoding='utf-8') as f: d = json.load(f)
        except Exception as e:
            print(f'  {k}: ilegível ({e})'); continue
        if isinstance(d, list):   # artefato antigo (linhas) → colunar
            d = {c: [r[f] for r in d] for c, f in (('t', 'time'), ('o', 'open'), ('h', 'high'), ('l', 'low'), ('c', 'close'), ('v', 'volume'))}
        _dump(f'prices/r/{k}.json', recent(d))
        w = weekly(unpack_prices(d))
        _dump(f'weekly/{k}.json', w)
        if k in RRG_DEFAULT: bundle[k] = w
        n += 1
    last = max((w['last'] for w in bundle.values() if w.get('last')), default=None)
    _dump('rrg.json', {'generated_at': now_iso(), **({'last': last} if last else {}), 'weeks': WEEKS, 'series': bundle})
    print(f'  {n} ativos: prices/r/ ({RECENT_DAYS} dias), weekly/ ({WEEKS} semanas), rrg.json ({len(bundle)} séries)')


if __name__ == '__main__':
    sys.exit(0 if step('slim', slim) else 1)
