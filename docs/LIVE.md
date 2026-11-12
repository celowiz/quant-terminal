# Camada ao vivo

Custo zero: só Pages + Actions. Toda fonte ao vivo é opcional — se falhar, a tela fica com o retrato diário
publicado (nunca inventa número; sem valor, '—'). Textos da tela curados em EN/PT e sem nome de fonte (exceções:
publicador por manchete na NEWS e a coluna de divulgador do ECO).

## 1. Navegador (fontes com CORS aberto, sem chave) — `src/lib/liveFetch.ts`, `src/lib/live.mjs`

| Tela | O quê | Cadência |
|---|---|---|
| GIP | cotação com atraso + barras de 1 min do pregão (B3 cotacao) | 60 s com o pregão aberto |
| BTMM | DI1 e dólar futuro (B3 cotacao) | 60 s com o pregão de futuros aberto |
| CRYP | websocket de cotações (Coinbase) | contínuo |
| NEWS | Agência Brasil (3 feeds) e notas do BCB | 3 min |
| ECON | séries do BCB (SGS) e pesquisa Focus (Olinda) | 5 min (dias úteis 08–19), 2 min seg. de manhã, 30 s perto de divulgação do Brasil na agenda |
| FX | boletins PTAX do dia (Olinda) | 2 min (10:00–13:30) |
| FOMC | comunicados do Copom (BCB) | 30 s no dia da decisão (18:00–20:30) |
| ECO | CPI, payroll e desemprego dos EUA (BLS) quando o diário ainda não trouxe o realizado | 1 min nos 30 min após a divulgação; ≤ 20 consultas/dia por navegador |

Selo (`LiveBadge`): "Ao vivo · atualizado às hh:mm:ss", "Atraso de N min · atualizado às hh:mm",
"Pregão encerrado · último negócio às hh:mm", "Consultado às hh:mm".

## 2. Watcher (`pipeline/live_watch.py` + `.github/workflows/live.yml`)

Fontes sem CORS ou com chave. Dias úteis 07:00–22:00 BRT, uma execução por vez (a mais antiga vence), cada uma até
~5h10 e depois dispara a próxima (`workflow_dispatch` com o GITHUB_TOKEN). Ao fim da janela (22:00 BRT) a cadeia não
para: dispara uma espera noturna (`mode=standby`) que dorme em blocos de ~5h05 (abaixo do limite de 6 h do Actions; um
único passo de sono, sem Python) até as 07:00 do próximo dia útil — sexta à noite encadeia até segunda 07:00. A última
espera dorme o restante e vira o watcher. O próximo elo é disparado ao fim do bloco (~5h05, 15 min antes do teto de 5h20 do job), com novas
tentativas se a execução não ficar `in_progress` (`startup_failure`). Cron a cada 20 min (`7,27,47 * * * 1-6`, seg–sáb UTC) só como
rede de segurança (o agendamento deste repositório atrasa horas ou simplesmente não dispara): se já houver espera ou
watcher ativo, a execução sai em segundos; se a cadeia tiver morrido, ela retoma. Publica no branch órfão `live` — um
único commit, force-push, só quando o conteúdo muda:

- `world.json` — índices mundiais e futuros (Yahoo chart: último, fechamento anterior, hora, fuso), 5 min
- `news.json` — RSS de CVM, Receita, Fed e SEC; fatos relevantes (CVM RAD, categoria IPE 4); plantão de notícias da B3 (sem informes rotineiros), 4 min
- `fred.json` — séries dos EUA do ECON (FRED, chave só no segredo `FRED_API_KEY`), 30 min; 1 min perto de divulgação dos EUA na agenda
- `mov.json` — MOV: carteira do dia de IBOV/IBXX/IBXL/SMLL/IDIV (`part` = peso no fechamento anterior, uma vez por dia) e cotações com atraso de ~15 min de `cotacao.b3.com.br` (último, var. % vs. fechamento anterior) dos membros e dos índices, 3 min no pregão (09:55–18:35), 1 h fora; nada é publicado se menos da metade das cotações responder. Reserva no navegador: se o arquivo faltar ou estiver velho (> 12 min) no pregão, o MOV busca as mesmas cotações direto (CORS liberado) com os pesos do último fechamento (`last_w` de `mov/<IDX>.json`)
- `dispatch.json` — dia do último disparo dos builds diários (fase 4)

O site lê esses arquivos por `raw.githubusercontent.com`. Pulso: a API pública do GitHub dá o sha do último commit
do branch (≤ 1 consulta a cada 90 s por navegador, compartilhada entre abas; 15 min de pausa se bater o limite de
60/h por IP) e o arquivo é lido em `/<sha>/` — sem os ~5 min de cache do endereço do branch.

## 3. Builds diários na hora (fase 4)

O watcher dispara o `pages.yml` com `slot=morning` (ter–sex, 07:47) e `slot=evening` (seg–sex, quando o arquivo
diário oficial da B3 sai, checado a cada 5 min desde as 20:00, ou às 21:55). O job `gate` do `pages.yml` pula o
cron atrasado do mesmo horário quando já houve disparo (sucesso ou em andamento).

## 4. CSP

`scripts/csp.mjs` → `LIVE_HOSTS` (connect-src). `scripts/liveHosts.test.mjs` garante que todo host usado pelos
buscadores ao vivo está liberado e que nada liberado sobra. Novo host: confirmar CORS num navegador real antes.
