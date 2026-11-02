"""Atualiza pipeline/data/ibge_calendar_seed.json com o calendário oficial do IBGE (API v3).

A API não aceita conexão dos runners do GitHub Actions desde out/2026, então a semente é gerada
numa máquina que alcança o IBGE e versionada no repo. O ECO usa: API (CI) → cache da semana → semente.
Uso: python pipeline/refresh_ibge_seed.py 2026-10-01 2027-06-30
"""
import sys, json, datetime as dt, os
import requests

KEEP = ('id', 'titulo', 'tipo_id', 'data_divulgacao', 'ano_referencia_inicio', 'mes_referencia_inicio', 'ano_referencia_fim', 'mes_referencia_fim', 'produto_id')
HERE = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(HERE, 'data', 'ibge_calendar_seed.json')

def fetch(a, b):
    items, d = [], a
    while d <= b:                        # blocos de ~3 meses (a API devolve o período inteiro de uma vez)
        e = min(b, d + dt.timedelta(days=90))
        u = f'https://servicodados.ibge.gov.br/api/v3/calendario/?qtd=1000&de={d:%m-%d-%Y}&ate={e:%m-%d-%Y}'
        r = requests.get(u, timeout=(10, 60)); r.raise_for_status()
        items += r.json().get('items', [])
        d = e + dt.timedelta(days=1)
    seen, out = set(), []
    for it in items:
        if it.get('id') in seen: continue
        seen.add(it.get('id')); out.append({k: it.get(k) for k in KEEP})
    return out

if __name__ == '__main__':
    a, b = (dt.date.fromisoformat(x) for x in sys.argv[1:3])
    items = fetch(a, b)
    if not items: sys.exit('calendário vazio: semente não alterada')
    c = {'fetched_at': dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec='seconds'), 'from': a.isoformat(), 'to': b.isoformat(),
         'source': 'https://servicodados.ibge.gov.br/api/v3/calendario/', 'seed': True, 'items': items}
    with open(SEED, 'w', encoding='utf-8') as f: json.dump(c, f, ensure_ascii=False, indent=0)
    print(f'{len(items)} itens → {SEED}')
