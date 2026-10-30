"""Auditoria de português nas telas em inglês (idioma padrão).

Visita todas as rotas do export estático (e todas as abas de cada função, e o modal "?"),
coleta o texto visível + title/aria-label/placeholder + <title> e lista as strings que parecem PT.

uso: python scripts/pt_audit.py [PORT] [out.json]
     (sirva out/ antes, p.ex.: mkdir -p /tmp/s && ln -sfn $PWD/out /tmp/s/quant-terminal && cd /tmp/s && python -m http.server 8822)
"""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '8822'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/pt_audit.json'
APP = os.path.join(os.path.dirname(__file__), '..', 'src', 'app')
BASE = f'http://localhost:{PORT}/quant-terminal'
TICKER_FN = sorted(d for d in os.listdir(APP) if os.path.isdir(f'{APP}/{d}/[ticker]'))
ROUTES = ['/'] + sorted(f'/{d}/' for d in os.listdir(APP) if os.path.isdir(f'{APP}/{d}'))
ROUTES += [f'/{d}/PETR4.SA/' for d in TICKER_FN] + ['/gp/PETR4.SA/', '/gpc/PETR4.SA/']

# palavras PT inequívocas; qualquer palavra com acento/cedilha também conta
PT = set('''da do das dos para com uma não nao pelo pela entre sobre até após apos também tambem
mês meses anos dia dias semana semanas hoje ontem taxa taxas juros preço preços variação média mediana máximo mínimo
fonte fontes ativo ativos ação ações empresa empresas setor setores receita lucro dívida patrimônio vencimento vencimentos
contrato contratos reunião reuniões ajuste fechamento abertura carregando erro
janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro
fev abr ago dez segunda terça quarta quinta sexta sábado domingo
alemanha frança espanha itália japão reino unido estados unidos méxico canadá suíça áustria bélgica holanda países baixos
irlanda grécia noruega suécia dinamarca finlândia polônia república tcheca hungria nova zelândia austrália coreia áfrica
índia rússia turquia colômbia islândia eslováquia eslovênia estônia letônia lituânia luxemburgo zona brasil
financeiro financeiros consumo cíclico básicos materiais utilidade pública saúde tecnologia informação comunicações
petróleo gás biocombustíveis bens industriais outros índice índices renda fixa câmbio moeda moedas'''.split())
WEAK = {'de', 'em', 'set', 'mar', 'mai', 'out', 'sem', 'ano', 'um', 'alta', 'baixa', 'pre'}  # ambíguas: só contam com outra evidência
ALLOW = {'Marcelo', 'Wizenberg', 'Tesouro', 'Direto', 'Prefixado', 'IPCA', 'Selic', 'Copom', 'Focus', 'Ibovespa', 'Olinda',
         'Transparente', 'Português', 'Brasília', 'São', 'Itaú', 'Câmbio'}  # nomes próprios / nome do idioma no seletor
ACC = re.compile(r"[A-Za-zÀ-ÿ]*[ãõçâêôáéíóúà][A-Za-zÀ-ÿ]*", re.I)
WORD = re.compile(r"[A-Za-zÀ-ÿ]+")
JS = r'''()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
while(n=w.nextNode()){const p=n.parentElement;if(!p)continue;if(p.closest('script,style,[data-audit-skip]'))continue;
const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')continue;const t=n.textContent.trim();if(t)out.push(t)}
document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e=>{if(e.closest('[data-audit-skip]'))return;['title','aria-label','placeholder'].forEach(a=>{const v=e.getAttribute(a);if(v)out.push(v)})});
out.push(document.title);return out}'''


def hits(text):
    found = {w for w in ACC.findall(text) if w not in ALLOW}
    words = [w.lower() for w in WORD.findall(text)]
    strong = [w for w in words if w in PT]
    found |= set(strong)
    if found:
        found |= {w for w in words if w in WEAK}
    for m in re.finditer(r'\b(fev|abr|mai|ago|set|out|dez)/\d\d\b', text, re.I):
        found.add(m.group(0))
    return found


async def visit(b, r, res, sem):
    async with sem:
        ctx = await b.new_context(viewport={'width': 1600, 'height': 900})
        await ctx.route('**/*googletagmanager.com/**', lambda x: x.abort())
        p = await ctx.new_page()
        texts = []
        try:
            await p.goto(BASE + r, wait_until='networkidle', timeout=60000)
            await p.wait_for_timeout(1500)
            texts += await p.evaluate(JS)
            tabs = p.locator('[data-fn-tab], div.fn-strip > button.border-r')
            for i in range(1, await tabs.count()):
                try:
                    await tabs.nth(i).click(); await p.wait_for_timeout(900); texts += await p.evaluate(JS)
                except Exception:
                    pass
            if await p.locator('[data-help-toggle]').count():
                await p.click('[data-help-toggle]'); await p.wait_for_timeout(600); texts += await p.evaluate(JS)
        except Exception as e:
            texts.append(f'__ERR__ {e}')
        await ctx.close()
        res[r] = {t[:240]: sorted(f) for t in set(texts) if (f := hits(t))}


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        res, sem = {}, asyncio.Semaphore(6)
        await asyncio.gather(*[visit(b, r, res, sem) for r in ROUTES])
        await b.close()
    json.dump(res, open(OUT, 'w'), ensure_ascii=False, indent=1)
    tot = 0
    for r in sorted(res):
        if res[r]:
            print(f'== {r}')
            for t, f in sorted(res[r].items()):
                print(f'   {f}  ::  {t}'); tot += 1
    print(f'TOTAL: {tot} PT-looking strings on {sum(1 for r in res if res[r])} of {len(res)} routes')


if __name__ == '__main__':
    asyncio.run(main())
