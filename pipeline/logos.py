"""Logos do CAL: regra de correspondência ticker → arquivo do repo de logos (TICKER.png).

1. override explícito (escolha do Marcelo), registrado como match='override';
2. ticker exato;
3. mesma raiz de 4 letras com outro número, nesta ordem: 3, 4, 11, 5, 6, 7, 8.
Sem correspondência → None (a UI mostra o selo com o ticker).

Uso para sincronizar public/logos a partir de um clone do repo:
    python3 pipeline/logos.py /caminho/logos_b3
"""
import hashlib, json, os, re, shutil, struct, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOGOS = os.path.join(HERE, '..', 'public', 'logos')
ORDER = ('3', '4', '11', '5', '6', '7', '8')
OVERRIDES = {'AXIA3': 'AXIA7'}   # mesma empresa (Axia, ex-Eletrobras); escolha explícita, não AXIA5
REPO = 'github.com/mqteuss/logos_b3'


def resolve(ticker, available):
    """→ (ticker_do_arquivo, match) ou (None, None). `available`: tickers com arquivo."""
    av = set(available)
    o = OVERRIDES.get(ticker)
    if o and o in av: return o, 'override'
    if ticker in av: return ticker, 'exact'
    root = re.match(r'[A-Z]{4}', ticker)
    if root:
        for n in ORDER:
            c = root.group(0) + n
            if c != ticker and c in av: return c, 'root'
    return None, None


def _px(path):
    with open(path, 'rb') as f: h = f.read(24)
    return struct.unpack('>I', h[16:20])[0] if h[:8] == b'\x89PNG\r\n\x1a\n' else None


MAX_LOGO_BYTES = 512 * 1024


def _safe_png(path):
    """Arquivo regular (sem symlink), até 512 KB e com assinatura PNG: nada de SVG/HTML disfarçado vindo do repositório externo."""
    try:
        if os.path.islink(path) or not os.path.isfile(path) or os.path.getsize(path) > MAX_LOGO_BYTES: return False
        with open(path, 'rb') as f: return f.read(8) == b'\x89PNG\r\n\x1a\n'
    except OSError: return False


def sync(repo_dir, universe):
    """Copia TICKER.png para public/logos e reescreve o manifest. universe: [(ticker, empresa)]."""
    files = {f[:-4] for f in os.listdir(repo_dir) if f.endswith('.png')}
    try: commit = subprocess.check_output(['git', '-C', repo_dir, 'rev-parse', 'HEAD'], text=True).strip()
    except Exception: commit = None
    for f in os.listdir(LOGOS):
        if f.endswith('.png'): os.remove(os.path.join(LOGOS, f))
    out, miss = [], []
    for t, name in universe:
        src, how = resolve(t, files)
        if not src: miss.append(t); continue
        if not re.fullmatch(r'[A-Z0-9]{1,12}', t): miss.append(t); continue
        sp = os.path.join(repo_dir, src + '.png')
        if not _safe_png(sp): miss.append(t); continue
        dst = os.path.join(LOGOS, t + '.png'); shutil.copyfile(sp, dst)
        e = {'ticker': t, 'company': name, 'file': t + '.png', 'source': REPO, 'source_file': src + '.png', 'match': how,
             'commit': commit, 'px': _px(dst), 'sha256': hashlib.sha256(open(dst, 'rb').read()).hexdigest()[:16]}
        out.append(e)
    man = {'note': 'Internal manifest. Files copied from github.com/mqteuss/logos_b3. Match rule: override, exact ticker, '
                   'then same 4-letter root in order 3, 4, 11, 5, 6, 7, 8 (pipeline/logos.py). Missing tickers fall back to a ticker badge in the UI.',
           'logos': out, 'missing': miss}
    json.dump(man, open(os.path.join(LOGOS, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return out, miss


if __name__ == '__main__':
    old = {x['ticker']: x.get('company') for x in json.load(open(os.path.join(LOGOS, 'manifest.json'), encoding='utf-8'))['logos']}
    uni = os.environ.get('QT_UNIVERSE')
    if uni:
        u = json.load(open(uni, encoding='utf-8'))
        rows = u.get('rows', u) if isinstance(u, dict) else u
        old.update({r['ticker']: r.get('name') or old.get(r['ticker']) for r in rows if isinstance(r, dict) and r.get('ticker')})
    out, miss = sync(sys.argv[1], sorted(old.items()))
    print(len(out), 'logos;', 'missing:', miss or '—'); print({e['ticker']: e['source_file'] for e in out if e['match'] != 'exact'})
