"""Utilidades comuns do pipeline de dados (roda local ou no GitHub Actions)."""
import json, os, time, datetime as dt, requests
from zoneinfo import ZoneInfo
OUT = os.environ.get('QT_DATA_OUT', os.path.join(os.path.dirname(__file__), '..', '..', 'work', 'frontend', 'public', 'data'))
OUT = os.path.abspath(OUT)
CACHE = os.environ.get('QT_CACHE', '/tmp/qt_cache'); os.makedirs(CACHE, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) quant-terminal-pipeline (educational)'}

# Datas sempre no fuso de São Paulo: o runner do Actions roda em UTC, e entre 21h e 0h (BRT) o
# dt.date.today() do runner já é o dia seguinte (ex.: selic_date '2026-10-25' gerado às 22h18 de 24/10).
TZ = ZoneInfo('America/Sao_Paulo')

def now_brt():
    return dt.datetime.now(TZ)

def today_brt(now=None):
    """Data de hoje em America/Sao_Paulo (now: datetime com fuso, para testes)."""
    return (now.astimezone(TZ) if now is not None else now_brt()).date()

def now_iso():
    return now_brt().isoformat(timespec='seconds')

def save(rel, obj):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False, default=str)
    print('  ->', rel, os.path.getsize(p)//1024, 'KB')

def get(url, tries=3, timeout=60, **kw):
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=timeout, **kw)
            if r.status_code == 200: return r
            last = f'HTTP {r.status_code}'
        except Exception as e:
            last = repr(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f'{url}: {last}')

# FRED (fredgraph.csv) com disjuntor: desde 24/10/2026 o FRED não responde aos runners do GitHub Actions
# (ReadTimeout em toda série), e cada série custava 3 × 60 s — markets/rates/macro estouravam o limite de 20 min da etapa.
# Depois de FRED_MAX_FAILS falhas seguidas, as séries restantes falham na hora e cada etapa segue com o que tiver
# (ou com a fonte alternativa, quando existe). QT_NO_FRED=1 simula a queda (testes/local).
FRED_MAX_FAILS = 2
_FRED = {'fails': 0}

def fred_csv(series_id, start):
    """Texto do CSV de uma série do FRED; RuntimeError rápido se o FRED estiver fora (disjuntor aberto)."""
    if os.environ.get('QT_NO_FRED') or _FRED['fails'] >= FRED_MAX_FAILS:
        raise RuntimeError('FRED indisponível (disjuntor aberto)')
    try:
        r = get(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}', tries=2, timeout=(10, 30))
    except Exception:
        _FRED['fails'] += 1
        if _FRED['fails'] >= FRED_MAX_FAILS: print(f'FRED: {FRED_MAX_FAILS} falhas seguidas, pulando as demais séries do FRED')
        raise
    _FRED['fails'] = 0
    return r.text

def cached(url, name, max_age_h=12):
    """Baixa um arquivo grande com cache local (CVM/B3)."""
    p = os.path.join(CACHE, name)
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < max_age_h * 3600:
        return p
    r = get(url, timeout=300)
    open(p, 'wb').write(r.content)
    return p

def clean(x, nd=4):
    try:
        import math
        if x is None: return None
        x = float(x)
        return None if math.isnan(x) or math.isinf(x) else round(x, nd)
    except Exception:
        return None

def step(name, fn):
    """Cada etapa é independente: se uma fonte cair, as demais seguem e o JSON anterior fica no ar."""
    t = time.time(); print(f'[{name}]')
    try:
        fn(); print(f'[{name}] ok em {time.time()-t:.0f}s'); return True
    except Exception as e:
        import traceback; traceback.print_exc(); print(f'[{name}] FALHOU: {e}'); return False

# Mapa ticker -> CNPJ (CVM). Fonte: cadastro CVM / FCA (valores mobiliários)
CNPJ = {
    'PETR3.SA': '33.000.167/0001-01', 'PETR4.SA': '33.000.167/0001-01',
    'VALE3.SA': '33.592.510/0001-54',
    'ITUB3.SA': '60.872.504/0001-23', 'ITUB4.SA': '60.872.504/0001-23',
    'B3SA3.SA': '09.346.601/0001-25',
}
EQUITIES = list(CNPJ)

def get_json(url, tries=5, **kw):
    """Como get(), mas também repete quando a resposta 200 não é JSON (a API do BCB às vezes devolve HTML sob carga)."""
    last = None
    for i in range(tries):
        try:
            return get(url, tries=2, **kw).json()
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise RuntimeError(f'{url}: {last!r}')

def load_prev(rel):
    """JSON da execução anterior (já publicado em public/data), para não regredir quando uma fonte falha."""
    try:
        with open(os.path.join(OUT, rel), encoding='utf-8') as f: return json.load(f)
    except Exception:
        return None
