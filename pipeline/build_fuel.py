"""FUEL — weekly average pump prices for Brazil, regions and states, plus Brent in BRL
from oil and FX series already published by this pipeline. Never invents a number."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata
from collections import defaultdict
from urllib.parse import urljoin

from common import CACHE, OUT, clean, get, load_prev, now_iso, read_prices, save, step, today_brt

# placeholder is defined in build_fns4; keep a local fallback
def _placeholder(rel):
    if load_prev(rel) is None:
        save(rel, {'generated_at': now_iso(), 'unavailable': True})


ANP_DIR = 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/'
ANP_HDR = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,text/csv,text/plain;q=0.9,*/*;q=0.8',
}

# product id, match substrings (folded) in priority order (first hit wins)
PRODUCTS = [
    ('gas_add', ('gasolina aditivada', 'gasolina c aditivada')),
    ('gasoline', ('gasolina',)),
    ('ethanol', ('etanol',)),
    ('diesel_s10', ('diesel s10', 'diesel s-10', 'oleo diesel s10', 'oleo diesel s-10')),
    ('diesel_s500', ('diesel s500', 'diesel s-500', 'oleo diesel s500', 'oleo diesel s-500')),
    ('diesel', ('diesel', 'oleo diesel')),
    ('gnv', ('gnv',)),
    ('glp', ('glp', 'gas liquefeito', 'gas de cozinha')),
]
FUEL_ORDER = [p[0] for p in PRODUCTS]
REGIONS = ('N', 'NE', 'CO', 'SE', 'S')
STATES = ('AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
          'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO')
UNITS = {
    'r$/l': 'R$/L', 'r$/litro': 'R$/L', 'r$ / l': 'R$/L', 'r$/litro': 'R$/L',
    'r$/m3': 'R$/m³', 'r$/m³': 'R$/m³', 'r$/m^3': 'R$/m³',
    'r$/13kg': 'R$/13kg', 'r$/13 kg': 'R$/13kg', 'r$/13quilogramas': 'R$/13kg',
}


def fold(s) -> str:
    if s is None:
        return ''
    t = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'\s+', ' ', t).strip().lower()


def classify_filename(name: str):
    """Map an ANP open-data file name to a product group, tolerant of typos and drift."""
    f = fold(os.path.basename(name).replace('_', ' ').replace('-', ' '))
    if not f:
        return None
    if 'glp' in f:
        return 'glp'
    if 'diesel' in f or 'gnv' in f:
        return 'diesel_gnv'
    if 'gasolina' in f or 'etanol' in f or 'ethanol' in f:
        return 'gasolina_etanol'
    return None


def csv_hrefs(html: str, base: str) -> list[str]:
    """Absolute CSV download URLs from an ANP folder page (strips /view)."""
    out, seen = [], set()
    for href in re.findall(r'href=["\']([^"\']+)["\']', html, re.I):
        h = href.strip()
        if not re.search(r'\.csv', h, re.I) and not re.search(r'preco', fold(h)):
            continue
        if not re.search(r'\.csv|preco|diesel|gasolina|etanol|glp|gnv', fold(h)):
            continue
        url = urljoin(base, h)
        url = re.sub(r'/view/?$', '', url, flags=re.I)
        url = url.split('?')[0]
        if url in seen:
            continue
        # only files in the open-data year folder; skip site-nav links that merely mention diesel
        if '/shpc/dsan/' not in url.lower():
            continue
        if re.search(r'subvencao|metadados|transparen', fold(url)):
            continue
        if classify_filename(url) is None:
            continue
        seen.add(url)
        out.append(url)
    return out


def week_end(d: dt.date) -> dt.date:
    """Saturday that ends the Sun–Sat survey week containing d."""
    return d + dt.timedelta(days=(5 - d.weekday()) % 7)


def parse_date(s):
    s = (s or '').strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})$', s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return dt.date(y, mo, d)
        except ValueError:
            return None
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        try:
            return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def parse_num(s):
    if s is None:
        return None
    t = str(s).strip()
    if not t or t in {'.', '-', '—'}:
        return None
    t = t.replace('\xa0', '').replace(' ', '')
    if re.match(r'^-?\d{1,3}(\.\d{3})+,\d+$', t) or (',' in t and t.rfind(',') > t.rfind('.')):
        t = t.replace('.', '').replace(',', '.')
    elif re.match(r'^-?\d{1,3}(,\d{3})+\.\d+$', t):
        t = t.replace(',', '')
    else:
        t = t.replace(',', '.')
    try:
        v = float(t)
    except ValueError:
        return None
    if v != v or v < 0 or v > 1e6:  # NaN or absurd pump price
        return None
    return v


def product_id(name: str):
    f = fold(name)
    if not f:
        return None
    for pid, keys in PRODUCTS:
        if any(k in f for k in keys):
            return pid
    return None


def unit_norm(s: str) -> str | None:
    f = fold(s).replace(' ', '')
    f = f.replace('litro', 'l').replace('litros', 'l')
    if not f:
        return None
    return UNITS.get(f) or UNITS.get(f.replace('r$', 'r$'))


def colmap(header: list[str]) -> dict:
    m = {}
    for i, h in enumerate(header):
        f = fold(h)
        if f.startswith('regiao'):
            m['region'] = i
        elif f.startswith('estado'):
            m['state'] = i
        elif f == 'produto' or f.startswith('produto'):
            m['product'] = i
        elif 'data da coleta' in f or f in {'data', 'data coleta'}:
            m['date'] = i
        elif 'valor de venda' in f or f in {'preco', 'preco de venda', 'valor venda'}:
            m['price'] = i
        elif 'unidade' in f:
            m['unit'] = i
    return m


def decode_csv(raw: bytes) -> str:
    if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
        return raw.decode('utf-16', errors='replace')
    for enc in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode('latin-1', errors='replace')


def iter_pump_rows(text: str):
    """Yield (date, product_id, region, state, price, unit) from an ANP pump-level CSV."""
    import csv
    import io
    raw = text.lstrip('\ufeff')
    # dialect: ANP uses ';'
    sample = raw[:4096]
    delim = ';' if sample.count(';') >= sample.count(',') else ','
    r = csv.reader(io.StringIO(raw), delimiter=delim)
    try:
        header = next(r)
    except StopIteration:
        return
    cm = colmap(header)
    if 'date' not in cm or 'product' not in cm or 'price' not in cm:
        return
    def cell(row, k):
        i = cm.get(k)
        return row[i] if i is not None and i < len(row) else ''
    for row in r:
        if not row or all(not (c or '').strip() for c in row):
            continue
        d = parse_date(cell(row, 'date'))
        pid = product_id(cell(row, 'product'))
        px = parse_num(cell(row, 'price'))
        if d is None or pid is None or px is None:
            continue
        reg = (cell(row, 'region') or '').strip().upper()
        st = (cell(row, 'state') or '').strip().upper()
        if reg == 'CENTRO-OESTE' or reg == 'CW':
            reg = 'CO'
        if reg not in REGIONS:
            reg = None
        if st not in STATES:
            st = None
        unit = unit_norm(cell(row, 'unit'))
        yield d, pid, reg, st, px, unit


def add_obs(acc, week, pid, region, state, price):
    """acc[pid][geo][week] = [sum, n]. geo is BR, a region code, or a state code."""
    def bump(geo):
        slot = acc[pid][geo]
        if week not in slot:
            slot[week] = [0.0, 0]
        slot[week][0] += price
        slot[week][1] += 1
    bump('BR')
    if region:
        bump(region)
    if state:
        bump(state)


def means(acc):
    """acc -> {pid: {geo: {week_iso: mean}}}."""
    out = {}
    for pid, geos in acc.items():
        out[pid] = {}
        for geo, weeks in geos.items():
            out[pid][geo] = {w: clean(s / n, 4) for w, (s, n) in weeks.items() if n > 0 and s / n > 0}
    return out


def iso(d: dt.date) -> str:
    return d.isoformat()


def chg_vs(series: list, last, days: int):
    """last minus the last value on or before last_week_end - days. series = [(week_iso, value)] sorted."""
    if last is None or not series:
        return None
    last_d = parse_date(series[-1][0]) if not isinstance(series[-1][0], dt.date) else series[-1][0]
    # series weeks are iso strings
    end = dt.date.fromisoformat(series[-1][0]) if isinstance(series[-1][0], str) else series[-1][0]
    cut = end - dt.timedelta(days=days)
    prev = None
    for w, v in series:
        wd = dt.date.fromisoformat(w) if isinstance(w, str) else w
        if wd <= cut and v is not None:
            prev = v
    if prev is None:
        return None
    return clean(last - prev, 4)


def last_on_or_before(series, day: dt.date):
    """series: sorted list of (date, value)."""
    prev = None
    for d, v in series:
        if isinstance(d, str):
            d = dt.date.fromisoformat(d[:10])
        if d > day:
            break
        if v is not None:
            prev = v
    return prev


def brent_brl_for_weeks(weeks: list[str], oil: list, fx: list) -> list:
    """Brent in BRL for each week-end: last oil close × last FX on or before that Saturday. None if either is missing."""
    out = []
    for w in weeks:
        d = dt.date.fromisoformat(w)
        o = last_on_or_before(oil, d)
        x = last_on_or_before(fx, d)
        if o is None or x is None or o <= 0 or x <= 0:
            out.append(None)
        else:
            out.append(clean(o * x, 4))
    return out


def load_oil_fx():
    """Reuse published oil (BZ=F close, USD/bbl) and FX (BRL per USD). Prefer official bulletin when both exist."""
    oil, fx = [], []
    try:
        rows = read_prices('BZ_F')
        for r in rows:
            t, c = r.get('time'), r.get('close')
            if t and c is not None:
                oil.append((str(t)[:10], float(c)))
        oil.sort()
    except Exception as e:
        print('FUEL: oil prices missing:', e)
    try:
        with open(os.path.join(OUT, 'fx.json'), encoding='utf-8') as f:
            d = json.load(f)
        by = {}
        dates, brl = d.get('dates') or [], (d.get('usd_per') or {}).get('BRL') or []
        for t, v in zip(dates, brl):
            if t and v is not None:
                by[str(t)[:10]] = float(v)
        for p in (d.get('ptax') or {}).get('USD') or []:
            t, sell = p.get('date'), p.get('sell')
            if t and sell is not None:
                by[str(t)[:10]] = float(sell)  # official bulletin overrides
        fx = sorted(by.items())
    except Exception as e:
        print('FUEL: fx missing:', e)
    return oil, fx


def list_year_csvs(year: int) -> list[str]:
    urls, seen = [], set()
    for start in range(0, 200, 20):
        base = f'{ANP_DIR}{year}'
        page = f'{base}?b_start:int={start}' if start else base
        try:
            r = get(page, tries=3, timeout=45, headers=ANP_HDR)
        except Exception as e:
            print(f'FUEL: list {page} failed: {e}')
            break
        found = csv_hrefs(r.text, base + '/')
        new = [u for u in found if u not in seen]
        if start and not new:
            break
        for u in new:
            seen.add(u)
            urls.append(u)
        if 'b_start:int=' + str(start + 20) not in r.text and start:
            # no next page marker is fine; also stop if this page had fewer than a full batch
            if len(found) < 5:
                break
    return urls


def fetch_csv(url: str) -> str | None:
    """GET the CSV with a browser-like UA (HEAD is sometimes 403) and cache the bytes."""
    from common import write_atomic
    name = 'anp_' + re.sub(r'[^a-zA-Z0-9._-]+', '_', os.path.basename(url))[:120]
    path = os.path.join(CACHE, name)
    age_h = 12 if today_brt().strftime('%m') in os.path.basename(url) else 24 * 7
    try:
        if os.path.exists(path) and time.time() - os.path.getmtime(path) < age_h * 3600:
            raw = open(path, 'rb').read()
            if raw and not raw.lstrip()[:9].lower().startswith(b'<!doctype') and raw[:1] != b'<':
                return decode_csv(raw)
        try:
            r = get(url, tries=2, timeout=90, headers=ANP_HDR)
        except Exception:
            if not re.search(r'\.csv$', url, re.I):
                r = get(url + '.csv', tries=2, timeout=90, headers=ANP_HDR)
            else:
                raise
        raw = r.content
        if not raw or raw.lstrip()[:9].lower().startswith(b'<!doctype') or raw[:1] == b'<':
            print(f'FUEL: not a CSV: {url}')
            return None
        os.makedirs(CACHE, exist_ok=True)
        write_atomic(path, raw)
        return decode_csv(raw)
    except Exception as e:
        print(f'FUEL: download failed {url}: {e}')
        return None


def default_unit(pid: str, seen: dict) -> str:
    if pid in seen and seen[pid]:
        # most common
        return max(seen[pid].items(), key=lambda kv: kv[1])[0]
    if pid == 'gnv':
        return 'R$/m³'
    if pid == 'glp':
        return 'R$/13kg'
    return 'R$/L'


def build_doc(means_map, units_seen, oil, fx, generated=None):
    """Build the slim JSON. Missing means are omitted (the UI prints —). No invented points."""
    all_weeks = sorted({w for geos in means_map.values() for s in geos.values() for w in s})
    if not all_weeks:
        raise RuntimeError('FUEL: no weekly averages')
    brent = brent_brl_for_weeks(all_weeks, oil, fx)
    brent_by = dict(zip(all_weeks, brent))
    fuels = []
    hist = {}
    rows = []
    for pid in FUEL_ORDER:
        geos = means_map.get(pid) or {}
        if not geos:
            continue
        unit = default_unit(pid, units_seen)
        fuels.append({'id': pid, 'unit': unit})
        hist[pid] = {}
        for geo in ('BR',) + REGIONS + STATES:
            series = geos.get(geo) or {}
            if not series:
                continue
            hist[pid][geo] = [series.get(w) for w in all_weeks]
            pts = [(w, series[w]) for w in all_weeks if w in series and series[w] is not None]
            if not pts:
                continue
            last_w, last = pts[-1]
            prev = pts[-2][1] if len(pts) >= 2 else None
            chg_w = clean(last - prev, 4) if prev is not None else None
            chg_12m = chg_vs(pts, last, 364)
            level = 'BR' if geo == 'BR' else ('region' if geo in REGIONS else 'state')
            rows.append({
                'fuel': pid, 'level': level, 'geo': geo, 'week': last_w,
                'last': last, 'prev': prev, 'chg_w': chg_w, 'chg_12m': chg_12m,
                'unit': unit, 'brent': brent_by.get(last_w),
            })
    return {
        'generated_at': generated or now_iso(),
        'date': all_weeks[-1],
        'brent_unit': 'R$/bbl',
        'weeks': all_weeks,
        'brent_brl': brent,
        'fuels': fuels,
        'regions': [r for r in REGIONS],
        'states': [s for s in STATES],
        'rows': rows,
        'hist': hist,
    }


def ingest(text: str, acc, units_seen) -> int:
    n = 0
    for d, pid, reg, st, px, unit in iter_pump_rows(text):
        add_obs(acc, iso(week_end(d)), pid, reg, st, px)
        if unit:
            units_seen[pid][unit] += 1
        n += 1
    return n


def fuel():
    today = today_brt()
    years = list(range(today.year - 3, today.year + 1))
    urls = []
    for y in years:
        urls.extend(list_year_csvs(y))
    # unique, stable
    seen, uniq = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u); uniq.append(u)
    if not uniq:
        raise RuntimeError('FUEL: no open-data CSV links found')
    print(f'FUEL: {len(uniq)} CSV links in {years[0]}–{years[-1]}')
    acc = defaultdict(lambda: defaultdict(dict))
    units_seen = defaultdict(lambda: defaultdict(int))
    used = 0
    for url in uniq:
        txt = fetch_csv(url)
        if not txt:
            continue
        n = ingest(txt, acc, units_seen)
        if n:
            used += 1
            print(f'  {os.path.basename(url)}: {n} rows')
    if used == 0:
        raise RuntimeError('FUEL: every CSV download or parse failed')
    means_map = means(acc)
    oil, fx = load_oil_fx()
    doc = build_doc(means_map, units_seen, oil, fx)
    save('fuel.json', doc)
    print(f'FUEL: week {doc["date"]}, fuels={len(doc["fuels"])}, rows={len(doc["rows"])}, weeks={len(doc["weeks"])}')


if __name__ == '__main__':
    ok = step('fuel', fuel)
    if not ok:
        _placeholder('fuel.json')
        sys.exit(1)
