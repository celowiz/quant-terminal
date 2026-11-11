"""MOV / HMOV: contribuição de cada ação para a variação de índices da B3 (IBOV, IBrX-100, IBrX-50, SMLL, IDIV).

Saída (public/data/mov/):
  <IDX>.json    datas, nível oficial de fechamento do índice, membros (nome, setor, classe, entrada/saída) e, por membro
                e por pregão: fechamento, peso no fechamento anterior e pontos brutos do dia (encadeamento diário)
  archive.json  carteiras guardadas (uma por pregão em que a composição muda, mais a primeira e a última de cada
                período de vigência) — o site não lê; o pipeline usa nas execuções seguintes
  preview.json  prévia da próxima carteira, só na janela de prévias (último mês de vigência até a virada)

Método (por período de vigência p, que começa na primeira segunda-feira útil de jan, mai e set):
  peso no fechamento anterior à vigência: w_i ∝ part_i,snap ÷ (TR_i,snap−1 / TR_i,base), em que part é o peso que a bolsa
  publica na carteira do dia (calculado com o fechamento do pregão anterior) e TR é o fechamento ajustado a proventos
  (o índice é de retorno total). Dentro do período a carteira é fixa em retorno total, então o peso deriva com o preço:
  w_i,t ∝ w_i,t−1 · (1 + r_i,t). Pontos brutos do dia: pts_i,t = L_t−1 · w_i,t−1 · r_i,t (L = nível oficial).
  A soma dos brutos difere da variação real do índice (ajustes de proventos e eventos que a bolsa aplica de outro jeito);
  o site distribui esse resíduo pelo peso de cada ação no dia, para que os pontos somem exatamente a variação.
  Se a composição muda dentro do período (saída por evento societário), um novo trecho começa na data da carteira guardada.

Carteiras de 2026 anteriores ao arquivo diário: arquivos oficiais "Carteira do Dia" em pipeline/data/portfolios/
(proveniência em docs/MOV.md). Preço de ativo que o provedor de preços não tem mais: pipeline/data/portfolios/prices_seed.csv
(fechamentos oficiais do arquivo histórico da bolsa).
"""
import os, io, csv, json, base64, datetime as dt
import pandas as pd
from common import save, get_json, load_prev, now_iso, today_brt, quiet_yfinance

HERE = os.path.dirname(os.path.abspath(__file__))
SEED_DIR = os.path.join(HERE, 'data', 'portfolios')
INDICES = [('IBOV', 'Ibovespa'), ('IBXX', 'IBrX-100'), ('IBXL', 'IBrX-50'), ('SMLL', 'Small Cap'), ('IDIV', 'Dividendos')]
B3_IDX = 'https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/'
B3_STAT = 'https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/'
REBAL_MONTHS = (1, 5, 9)


def b64(o): return base64.b64encode(json.dumps(o).encode()).decode()


def br_num(x):
    """'1.460.506.056' / '3,039' / '13.999.429,66674930' → float; vazio → None"""
    x = (x or '').strip()
    if not x: return None
    try: return float(x.replace('.', '').replace(',', '.'))
    except ValueError: return None


def dmy(s):
    """'11/11/26' ou '11/11/2026' → '2026-11-11'"""
    d, m, y = s.strip().split('/')
    y = int(y); y = y + 2000 if y < 100 else y
    return f'{y:04d}-{int(m):02d}-{int(d):02d}'


# ---------------------------------------------------------------- carteiras
def parse_csv_portfolio(text):
    """Arquivo oficial 'IDX - Carteira do Dia dd/mm/aa' (separado por ';') → (data, {cod: {name,type,qty,part}}, redutor)."""
    lines = [l for l in text.replace('\r', '').split('\n') if l.strip()]
    head = lines[0]
    date = dmy(head.rsplit(' ', 1)[-1])
    mem, red = {}, None
    for l in lines[2:]:
        p = l.split(';')
        if len(p) < 4: continue
        if p[0].startswith('Redutor'): red = br_num(p[3]); continue
        if p[0].startswith('Quantidade'): continue
        cod = p[0].strip()
        if not cod or len(p) < 5: continue
        mem[cod] = {'name': p[1].strip(), 'type': ' '.join(p[2].split()), 'qty': br_num(p[3]), 'part': br_num(p[4])}
    return date, mem, red


def parse_api_portfolio(d):
    """Resposta do GetPortfolioDay (carteira do dia) → (data, membros, redutor, setores {cod: 'Setor / Subsetor'})."""
    h = d.get('header') or {}
    mem, sec = {}, {}
    for r in d.get('results') or []:
        cod = (r.get('cod') or '').strip()
        if not cod: continue
        mem[cod] = {'name': (r.get('asset') or '').strip(), 'type': ' '.join((r.get('type') or '').split()), 'qty': br_num(r.get('theoricalQty')), 'part': br_num(r.get('part'))}
        if r.get('segment'): sec[cod] = ' '.join(r['segment'].split())
    return dmy(h['date']), mem, br_num(h.get('reductor')), sec


def seed_snapshots(idx):
    out = {}
    d = os.path.join(SEED_DIR, idx)
    if not os.path.isdir(d): return out
    for f in sorted(os.listdir(d)):
        if not f.endswith('.csv'): continue
        raw = open(os.path.join(d, f), 'rb').read().decode('latin-1')
        date, mem, red = parse_csv_portfolio(raw)
        out[date] = {'members': mem, 'reductor': red, 'seed': True}
    return out


def first_monday(y, m):
    d = dt.date(y, m, 1)
    return d + dt.timedelta(days=(7 - d.weekday()) % 7)


def period_start(date_iso, trading):
    """Início da vigência (primeira segunda-feira de jan/mai/set, ou o pregão seguinte) do período que contém a data."""
    d = dt.date.fromisoformat(date_iso)
    cands = []
    for y in (d.year - 1, d.year):
        for m in REBAL_MONTHS:
            s = first_monday(y, m).isoformat()
            nxt = next((t for t in trading if t >= s), s)
            cands.append(nxt)
    return max(c for c in cands if c <= date_iso)


def next_period_start(date_iso):
    d = dt.date.fromisoformat(date_iso)
    for y in (d.year, d.year + 1):
        for m in REBAL_MONTHS:
            s = first_monday(y, m)
            if s.isoformat() > date_iso: return s.isoformat()
    return None


def prune_archive(snaps, trading):
    """Mantém, por período, a primeira e a última carteira e toda carteira cuja composição difere da anterior."""
    keep, by = {}, {}
    for d in sorted(snaps):
        by.setdefault(period_start(d, trading) if trading else d[:7], []).append(d)
    for ds in by.values():
        prev = None
        for i, d in enumerate(ds):
            s = set(snaps[d]['members'])
            if i == 0 or i == len(ds) - 1 or s != prev: keep[d] = snaps[d]
            prev = s
    return keep


def segments(snaps, trading):
    """[(dia de início, data da carteira)] em ordem: um trecho por período e outro a cada mudança de composição."""
    by = {}
    for d in sorted(snaps): by.setdefault(period_start(d, trading), []).append(d)
    out = []
    for ps, ds in sorted(by.items()):
        out.append((ps, ds[0]))
        prev = set(snaps[ds[0]]['members'])
        for d in ds[1:]:
            s = set(snaps[d]['members'])
            if s != prev and d in trading: out.append((d, d))
            prev = s
    return out


# ---------------------------------------------------------------- séries
def index_levels(idx, years):
    """Fechamentos oficiais diários do índice (estatísticas da bolsa) → {data: nível}"""
    out = {}
    for y in years:
        d = get_json(B3_STAT + b64({'index': idx, 'language': 'pt-br', 'year': str(y)}))
        for r in d.get('results') or []:
            day = r.get('day')
            for m in range(1, 13):
                v = br_num(r.get(f'rateValue{m}'))
                if v and day: out[f'{y:04d}-{m:02d}-{int(day):02d}'] = v
    return out


def chain(dates, level, members_seg, raw, tr):
    """Encadeamento diário. members_seg: lista (início, carteira {cod: part}, data da carteira).
    raw/tr: DataFrames (índice = datas, colunas = códigos) já alinhados a `dates` e com ffill.
    Devolve {cod: {'pts': [...], 'w': [...]}} (None fora da carteira)."""
    n = len(dates)
    pos = {d: i for i, d in enumerate(dates)}
    res = {}
    for k, (start, part, snapd) in enumerate(members_seg):
        if start not in pos: continue
        i0 = pos[start]
        i1 = pos[members_seg[k + 1][0]] if k + 1 < len(members_seg) and members_seg[k + 1][0] in pos else n
        if i0 == 0: continue
        base = i0 - 1
        # pesos no fechamento anterior à data da carteira (part) → recuados para a base do trecho com o retorno total
        # (carteira de hoje antes do fechamento oficial: a referência é o último pregão anterior à data da carteira)
        before = [i for i, d in enumerate(dates) if d < snapd]
        ref = before[-1] if before else base
        w = {}
        for c, p in part.items():
            if p is None or c not in tr: continue
            a, b = tr[c].iloc[ref], tr[c].iloc[base]
            if pd.isna(a) or pd.isna(b) or a <= 0 or b <= 0: continue
            w[c] = p / (a / b)
        s = sum(w.values())
        if s <= 0: continue
        w = {c: v / s for c, v in w.items()}
        for t in range(i0, i1):
            L0 = level[t - 1]
            rets = {}
            for c in w:
                a, b = tr[c].iloc[t - 1], tr[c].iloc[t]
                rets[c] = (b / a - 1) if pd.notna(a) and pd.notna(b) and a > 0 else 0.0
            for c, wc in w.items():
                o = res.setdefault(c, {'pts': [None] * n, 'w': [None] * n})
                o['w'][t] = wc
                o['pts'][t] = L0 * wc * rets[c]
            g = {c: w[c] * (1 + rets[c]) for c in w}
            s = sum(g.values())
            w = {c: v / s for c, v in g.items()}
    return res


def adj_events(raw, tr):
    """Fator TR/fechamento por data, compactado em [[i, fator]] só onde muda (proventos)."""
    out, last = [], None
    for i, (a, b) in enumerate(zip(raw, tr)):
        if a is None or b is None or a <= 0: continue
        f = round(b / a, 6)
        if last is None or abs(f - last) > 1e-6: out.append([i, f]); last = f
    return out


def r2(x, nd=2):
    return None if x is None or (isinstance(x, float) and (x != x)) else round(float(x), nd)


def download(codes, start):
    import yfinance as yf
    quiet_yfinance()
    raw, tr = {}, {}
    tick = [c + '.SA' for c in codes]
    for i in range(0, len(tick), 80):
        part = tick[i:i + 80]
        try:
            df = yf.download(part, start=start, auto_adjust=False, progress=False, threads=True, group_by='ticker')
        except Exception as e:
            print('yfinance falhou', e); continue
        for t in part:
            try:
                sub = df[t] if len(part) > 1 else df
                c, a = sub['Close'].dropna(), sub['Adj Close'].dropna()
                if len(c): raw[t[:-3]] = c; tr[t[:-3]] = a
            except Exception: pass
    return raw, tr


def seed_prices():
    p = os.path.join(SEED_DIR, 'prices_seed.csv')
    out = {}
    if not os.path.exists(p): return out
    for r in csv.DictReader(open(p, encoding='utf-8')):
        out.setdefault(r['cod'], {})[r['date']] = float(r['close'])
    return out


# ---------------------------------------------------------------- montagem
def build_index(idx, name, snaps, sectors, prev_out, px_cache):
    levels = px_cache['levels'][idx]
    trading = sorted(levels)
    if not snaps or not trading: return None
    segs = segments(snaps, trading)
    first_base_i = max(0, trading.index(next(t for t in trading if t >= segs[0][0])) - 1)
    dates = trading[first_base_i:]
    level = [levels[d] for d in dates]
    codes = sorted(set().union(*[set(snaps[s[1]]['members']) for s in segs]))
    idx_dt = pd.to_datetime(dates)
    prev_px = (prev_out or {}).get('px') or {}
    prev_dates = (prev_out or {}).get('dates') or []
    seed = px_cache['seed']
    rcols, tcols = {}, {}
    for c in codes:
        r, t = px_cache['raw'].get(c), px_cache['tr'].get(c)
        rc = r.reindex(idx_dt) if r is not None and len(r) else pd.Series(float('nan'), index=idx_dt)
        tc = t.reindex(idx_dt) if t is not None and len(t) else pd.Series(float('nan'), index=idx_dt)
        # buracos: fechamento publicado antes (ativo que saiu do provedor) e depois a semente oficial
        if c in prev_px and prev_dates and len(prev_px[c]) == len(prev_dates):
            pv = pd.Series(prev_px[c], index=pd.to_datetime(prev_dates), dtype='float64').reindex(idx_dt)
            rc = rc.fillna(pv); tc = tc.fillna(pv)
        if c in seed:
            sv = pd.Series(seed[c]); sv.index = pd.to_datetime(sv.index); sv = sv.reindex(idx_dt)
            rc = rc.fillna(sv); tc = tc.fillna(sv)
        rcols[c], tcols[c] = rc.astype('float64'), tc.astype('float64')
    raw_df, tr_df = pd.DataFrame(rcols, index=idx_dt), pd.DataFrame(tcols, index=idx_dt)
    last_trade = {c: (raw_df[c].last_valid_index()) for c in codes}
    raw_f, tr_f = raw_df.ffill(), tr_df.ffill()
    seg_in = [(s, {c: m['part'] for c, m in snaps[d]['members'].items()}, d) for s, d in segs]
    # primeira carteira guardada: recuar o peso até o início da vigência só enquanto nenhum membro tem queda diária
    # > 20% no retorno total (provento em ações ou cisão que o ajuste de preço não pega); se tiver, a série começa ali
    s0, p0, d0 = seg_in[0]
    if d0 in dates and s0 in dates and d0 > s0:
        i0, iref = dates.index(s0), dates.index(d0) - 1
        bad = [t for t in range(i0, iref + 1) for c in p0 if c in tr_f and pd.notna(tr_f[c].iloc[t - 1]) and pd.notna(tr_f[c].iloc[t])
               and tr_f[c].iloc[t - 1] > 0 and tr_f[c].iloc[t] / tr_f[c].iloc[t - 1] - 1 < -0.20]
        if bad:
            ns = dates[max(bad) + 1]
            print(f'  {idx}: evento sem ajuste em {dates[max(bad)]} — histórico começa em {ns}')
            seg_in[0] = (ns, p0, d0)
            k = dates.index(ns) - 1
            dates, level = dates[k:], level[k:]
            raw_f, tr_f, last_trade = raw_f.iloc[k:], tr_f.iloc[k:], last_trade
            segs = [(ns, d0)] + segs[1:]
    res = chain(dates, level, seg_in, raw_f, tr_f)
    # metadados de cada membro
    meta = {}
    for d in sorted(snaps):
        for c, m in snaps[d]['members'].items(): meta[c] = {'name': m['name'], 'type': m['type']}
    prev_meta = {m['cod']: m for m in (prev_out or {}).get('members') or []}
    root_sec = {}
    for c, s in sectors.items(): root_sec.setdefault(c[:4], s)
    mem_out, px_out, pts_out, w_out, adj_out = [], {}, {}, {}, {}
    cur = set(snaps[max(snaps)]['members'])
    for c in codes:
        if c not in res: continue
        act = [i for i, v in enumerate(res[c]['w']) if v is not None]
        sec = sectors.get(c) or (prev_meta.get(c) or {}).get('sector') or root_sec.get(c[:4])
        lt = last_trade.get(c)
        mem_out.append({'cod': c, 'name': meta.get(c, {}).get('name') or c, 'type': meta.get(c, {}).get('type') or '',
                        'sector': sec, 'root': c[:4], 'current': c in cur, 'first': dates[act[0]], 'last': dates[act[-1]],
                        'last_trade': lt.strftime('%Y-%m-%d') if lt is not None else None})
        rv = [None if pd.isna(x) else float(x) for x in raw_f[c].values]
        tv = [None if pd.isna(x) else float(x) for x in tr_f[c].values]
        px_out[c] = [r2(x) for x in rv]
        adj_out[c] = adj_events(rv, tv)
        pts_out[c] = [r2(x, 3) for x in res[c]['pts']]
        w_out[c] = [None if x is None else round(x, 6) for x in res[c]['w']]
    # pesos no último fechamento (base do MOV quando o arquivo ao vivo não está disponível)
    last_w = {}
    tlast = len(dates) - 1
    if tlast >= 1:
        tot = 0.0
        for c in cur:
            if c in res and res[c]['w'][tlast] is not None:
                a, b = tr_f[c].iloc[tlast - 1], tr_f[c].iloc[tlast]
                g = res[c]['w'][tlast] * (b / a if pd.notna(a) and pd.notna(b) and a > 0 else 1)
                last_w[c] = g; tot += g
        last_w = {c: round(v / tot, 6) for c, v in last_w.items()} if tot > 0 else {}
    return {'generated_at': now_iso(), 'index': idx, 'name': name, 'dates': dates, 'level': [r2(x) for x in level],
            'periods': [{'start': s, 'snapshot': d, 'n': len(snaps[d]['members'])} for s, d in segs],
            'next_rebalance': next_period_start(dates[-1]), 'members': mem_out, 'px': px_out, 'adj': adj_out,
            'pts': pts_out, 'w': w_out, 'last_w': last_w}


def preview_window(today_iso, trading_next):
    """Janela das prévias: do primeiro pregão do último mês de vigência até a véspera da nova carteira."""
    nxt = dt.date.fromisoformat(trading_next)
    m = nxt.month - 1 or 12
    y = nxt.year if nxt.month != 1 else nxt.year - 1
    return dt.date(y, m, 1).isoformat() <= today_iso < trading_next


def main():
    today = today_brt().isoformat()
    prev_arch = load_prev('mov/archive.json') or {}
    arch, sectors, outs = {}, {}, {}
    levels, years = {}, sorted({today_brt().year - 1, today_brt().year})
    for idx, _ in INDICES:
        try: levels[idx] = index_levels(idx, years)
        except Exception as e: print(idx, 'níveis falharam', e); levels[idx] = {}
        snaps = {d: v for d, v in ((prev_arch.get(idx) or {}).get('snapshots') or {}).items()}
        for d, v in seed_snapshots(idx).items(): snaps.setdefault(d, v)
        try:
            j = get_json(B3_IDX + 'GetPortfolioDay/' + b64({'language': 'pt-br', 'pageNumber': 1, 'pageSize': 200, 'index': idx, 'segment': '2'}))
            d, mem, red, sec = parse_api_portfolio(j)
            snaps[d] = {'members': mem, 'reductor': red}
            sectors.update(sec)
            print(f'{idx}: carteira do dia {d} ({len(mem)} ativos)')
        except Exception as e: print(idx, 'carteira do dia falhou', e)
        arch[idx] = {'snapshots': prune_archive(snaps, sorted(levels[idx]))}
    for v in (prev_arch.get('_sectors') or {}).items(): sectors.setdefault(*v)
    arch['_sectors'] = sectors
    save('mov/archive.json', arch)
    # preços: todos os membros de todas as carteiras, desde a base mais antiga
    starts = []
    for idx, _ in INDICES:
        S = arch[idx]['snapshots']
        if S and levels[idx]: starts.append(period_start(min(S), sorted(levels[idx])))
    start = (dt.date.fromisoformat(min(starts)) - dt.timedelta(days=15)).isoformat() if starts else today
    codes = sorted(set().union(*[set(m) for idx, _ in INDICES for s in arch[idx]['snapshots'].values() for m in [s['members']]]))
    raw, tr = download(codes, start)
    print(f'preços: {len(raw)}/{len(codes)} ativos desde {start}')
    cache = {'levels': levels, 'raw': raw, 'tr': tr, 'seed': seed_prices()}
    for idx, name in INDICES:
        prev = load_prev(f'mov/{idx}.json')
        try: o = build_index(idx, name, arch[idx]['snapshots'], sectors, prev, cache)
        except Exception as e: print(idx, 'falhou', repr(e)); o = None
        if o: save(f'mov/{idx}.json', o); outs[idx] = o
    # prévia da próxima carteira (só na janela de prévias)
    pv = {'generated_at': now_iso(), 'indices': {}}
    for idx, _ in INDICES:
        o = outs.get(idx)
        if not o or not o.get('next_rebalance'): continue
        nr = o['next_rebalance']
        if not preview_window(today, nr):
            pv['indices'][idx] = {'next_rebalance': nr, 'window': False}; continue
        try:
            j = get_json(B3_IDX + 'GetQuartelyPreview/' + b64({'pageNumber': 1, 'pageSize': 200, 'language': 'pt-br', 'index': idx}))
            new = {r['cod'].strip(): {'name': (r.get('asset') or '').strip(), 'part': br_num(r.get('part'))} for r in j.get('results') or [] if r.get('cod')}
            cur = {c: v['part'] for c, v in max(arch[idx]['snapshots'].items())[1]['members'].items()}
            pv['indices'][idx] = {'next_rebalance': nr, 'window': True, 'checked': today,
                                  'rows': [{'cod': c, 'name': v['name'], 'part': v['part'], 'cur': cur.get(c)} for c, v in new.items()],
                                  'removed': [{'cod': c, 'cur': p} for c, p in cur.items() if c not in new]}
        except Exception as e: print(idx, 'prévia falhou', e); pv['indices'][idx] = {'next_rebalance': nr, 'window': True, 'rows': None}
    save('mov/preview.json', pv)


if __name__ == '__main__':
    main()
