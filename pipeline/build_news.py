"""NEWS e CN (parte de manchetes): RSS públicos. Só manchete, data, fonte e link (nunca o texto completo)."""
import re, html, datetime as dt, email.utils, xml.etree.ElementTree as ET
from common import save, get, step, now_iso

FEEDS = [
    ('Agência Brasil – Economia', 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', 'CC BY 4.0'),
    ('Agência Brasil – Internacional', 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml', 'CC BY 4.0'),
    ('Agência Brasil – Política', 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml', 'CC BY 4.0'),
    ('CVM – Notícias', 'https://www.gov.br/cvm/pt-br/assuntos/noticias/RSS', 'gov.br'),
    ('BCB – Notas à imprensa', 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa', 'gov.br'),
    ('Receita Federal – Notícias', 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS', 'gov.br'),
    ('Fed – Press releases', 'https://www.federalreserve.gov/feeds/press_all.xml', 'public domain'),
    ('SEC – Press releases', 'https://www.sec.gov/news/pressreleases.rss', 'public domain'),
]
KEYWORDS = {'PETR': ['petrobras'], 'VALE': ['vale s.a', 'mineradora vale', ' vale '], 'ITUB': ['itaú', 'itau unibanco'], 'B3SA': [' b3 ', 'bolsa de valores']}

def parse_date(s):
    if not s: return None
    try: return email.utils.parsedate_to_datetime(s).astimezone(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec='minutes')
    except Exception:
        try: return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-3))).isoformat(timespec='minutes')
        except Exception: return s

def text(el, tag):
    for c in el:
        if c.tag.split('}')[-1] == tag: return (c.text or '').strip()
    return ''

def news():
    items = []
    for name, url, lic in FEEDS:
        try:
            root = ET.fromstring(get(url, tries=2, timeout=40).content)
            for it in [e for e in root.iter() if e.tag.split('}')[-1] in ('item', 'entry')][:60]:
                title = html.unescape(re.sub('<[^>]+>', '', text(it, 'title')))
                link = text(it, 'link') or next((c.get('href') for c in it if c.tag.split('}')[-1] == 'link'), '')
                date = parse_date(text(it, 'pubDate') or text(it, 'updated') or text(it, 'published') or text(it, 'date'))
                link = (link or '').strip()
                if not re.match(r'^https?://[^\s/]+', link, re.I): link = ''  # só http(s): nada de javascript:/data: no href
                if title and link: items.append({'source': name, 'license': lic, 'title': title[:220], 'link': link, 'date': date})
            print(' ', name, 'ok')
        except Exception as e: print(' ', name, 'falhou', e)
    items.sort(key=lambda x: x['date'] or '', reverse=True)
    for it in items:
        low = f" {it['title'].lower()} "
        it['tags'] = [k for k, ws in KEYWORDS.items() if any(w in low for w in ws)]
    save('news.json', {'generated_at': now_iso(), 'source': 'RSS públicos: ' + '; '.join(n for n, *_ in FEEDS) + '. Só manchete + link.', 'items': items})

if __name__ == '__main__':
    step('news', news)
