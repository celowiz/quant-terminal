"""Atualiza pipeline/data/eco_seed.json: linhas do ECO das fontes que recusam os runners do GitHub Actions.

FGV IBRE (calendário de divulgação, erro de TLS a partir do Actions) e BLS (calendário ICS, HTTP 403 a partir do
Actions). Rode numa máquina que alcança os sites e versione o arquivo; o pipeline só usa a semente quando a fonte falha.
Uso: python pipeline/refresh_eco_seed.py [AAAA-MM-DD início] [AAAA-MM-DD fim]   (padrão: hoje−31d .. hoje+9 meses)
"""
import sys, json, datetime as dt
import eco_sources as es

if __name__ == '__main__':
    today = dt.datetime.now(es.BRT).date()
    a = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else today - dt.timedelta(days=31)
    b = dt.date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else today + dt.timedelta(days=270)
    seed = es.load_seed()
    for name, fn, headers, kind in es.SOURCES:
        if name not in ('fgv', 'bls'): continue
        rows = fn(a, b, es.http_fetch(headers, kind))
        if not rows: raise SystemExit(f'{name}: nenhuma linha — semente não alterada')
        seed[name] = {'fetched_at': dt.datetime.now(es.BRT).isoformat(timespec='minutes'), 'from': a.isoformat(), 'to': b.isoformat(), 'rows': rows}
        print(name, len(rows), rows[0]['time'], '..', rows[-1]['time'])
    with open(es.SEED_PATH, 'w', encoding='utf-8') as f: json.dump(seed, f, ensure_ascii=False, indent=0)
