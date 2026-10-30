"""Etapa final: atualiza no tickers.json a cobertura por ativo (quais JSON por ticker existem: corp, holders, fa, options, intraday, des)."""
import json, os, sys
from common import OUT, save, mark_coverage, step

def coverage():
    p = os.path.join(OUT, 'tickers.json')
    d = json.load(open(p, encoding='utf-8'))
    U = {t['ticker']: t for t in d['tickers']}
    mark_coverage(U)
    n = {k: sum(1 for t in d['tickers'] if k in (t.get('cov') or [])) for k in ('corp', 'holders', 'fa', 'options', 'intraday', 'des')}
    d['coverage'] = n
    print('cobertura:', n)
    with open(p, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    sys.exit(0 if step('coverage', coverage) else 1)
