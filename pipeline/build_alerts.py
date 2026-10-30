"""ALERT: avalia as regras de alerts.yaml contra o último fechamento. Gera data/alerts.json (exibido no site)
e, se rodando no Actions, escreve os alertas disparados em $GITHUB_OUTPUT/arquivo para o workflow abrir uma Issue."""
import json, os, sys
import yaml
from common import save, step, now_iso, OUT, read_prices

def key(t): return t.upper().replace('^', 'IDX_').replace('.SA', '').replace('.', '_').replace('=', '_').replace('-', '_')

def alerts():
    path = os.environ.get('QT_ALERTS', os.path.join(os.path.dirname(__file__), '..', '..', 'work', 'frontend', 'alerts.yaml'))
    rules = yaml.safe_load(open(path)) or []
    out, fired = [], []
    for r in rules:
        try:
            px = read_prices(key(r['ticker']))
            last, prev = px[-1], px[-2]
            chg = (last['close'] / prev['close'] - 1) * 100
            v = float(r['value']); op = r['op']
            hit = {'above': last['close'] > v, 'below': last['close'] < v, 'change_pct_above': chg > v, 'change_pct_below': chg < v}[op]
            row = {**r, 'last': last['close'], 'date': last['time'], 'change_pct': round(chg, 2), 'triggered': bool(hit)}
        except Exception as e:
            row = {**r, 'error': str(e), 'triggered': False}
        out.append(row)
        if row.get('triggered'): fired.append(row)
    save('alerts.json', {'generated_at': now_iso(), 'source': 'alerts.yaml do repositório, avaliado no pipeline (fechamento diário)', 'rules': out})
    md = '\n'.join(f"- **{a['id']}** – {a.get('note','')}: {a['ticker']} fechou {a['last']} em {a['date']} ({a['change_pct']:+.2f}%)" for a in fired)
    open(os.environ.get('QT_ALERTS_MD', '/tmp/alerts_fired.md'), 'w').write(md)
    print(f'{len(fired)} alerta(s) disparado(s)')

if __name__ == '__main__':
    step('alerts', alerts)
