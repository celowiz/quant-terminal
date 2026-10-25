# quant-terminal → GitHub Pages (custo zero) — PLANO (rascunho v1, 24/10/2026)

Meta: `https://celowiz.github.io/quant-terminal/`. Só GitHub Pages + GitHub Actions. Sem Vercel/Railway/servidor.
O frontend continua o mesmo projeto Next (TopBar, Header, Footer, GPPage, GPCPage, RRGChart, useBlockCaret…), com o mesmo visual âmbar/preto. Saem o nome "Bloomberg" e o "BBG": o app passa a se chamar **celowiz • Quant Terminal**.

## 1. Arquitetura estática
```
.github/workflows/pages.yml   ← cron + push + manual
pipeline/                      ← Python (yfinance, pandas, requests): gera JSON
  build_data.py  requirements.txt  universe.yaml
frontend/                      ← Next 14, output:'export', basePath /quant-terminal
  public/data/  (gerado no Actions, não vai pro git da main)
```
- `next.config.mjs`: `output:'export'`, `basePath`/`assetPrefix` `/quant-terminal`, `trailingSlash:true`, `images.unoptimized`.
- Rotas dinâmicas (`/gp/[ticker]`, `/gpc/[ticker]`): `generateStaticParams` lê `data/tickers.json`, gerando 1 HTML por ticker. Já testei com `^BVSP`, `BRL=X` e `DX-Y.NYB`.
- A navegação (`window.location.assign`) passa por `go()`, que já prefixa o basePath.
- A camada de dados `src/lib/static.ts` substitui o axios/FastAPI. Os filtros de data, o resample (d/w/m/q/y) e o RRG passam a ser calculados no navegador.
- Workflow: Python gera `frontend/public/data/*.json` → `next build` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Histórico incremental: guardar os JSON num branch `data` (ou `actions/cache`) e baixar do Yahoo só os últimos ~10 dias de cada ticker. Isso reduz o rate limit e evita inchar a `main`.
- Tamanho: 12 tickers × 10 anos dá ~2,8 MB, e o site inteiro ~4,7 MB. Mesmo com ~100 tickers (IBOV) fica bem abaixo do limite de 1 GB do Pages.
- Os **.db (SQLite), o TinyDB, o Prefect e o Playwright não vão para o site**. O pipeline gera JSON direto.

## 2. Rotas da API → JSON
| API FastAPI original | Versão estática |
|---|---|
| `GET /prices/{t}?start&end&timeframe` | `data/prices/<KEY>.json` (`[{time,open,high,low,close(adj),volume}]`). O filtro e o resample rodam no cliente |
| `GET /tickers/` | `data/tickers.json` (ticker, key, nome, 1ª/última data, n) |
| `GET /info/ticker/{t}`, `GET /name/{t}` | `data/tickers.json` |
| `GET /stats/{t}` | calculado no cliente a partir de prices |
| `GET /rrg` | calculado no cliente: porte fiel do `rrg.py` (W-FRI, EMA/SMA, Savitzky-Golay interp). **Bate com o Python até a 2ª casa decimal** |
| `GET /funds_flow` | `data/funds_flow.json` (ver risco ANBIMA abaixo) |
| `GET /logo/{t}` | **removido**: era scraping do TradingView, não serve para site público |
| `/flows/daily/*` (Prefect) | substituído pelo próprio GitHub Actions (aba Actions = status e log) |

Chave de arquivo: `^`→`IDX_`, `.SA` removido, `. = -`→`_`. É a mesma regra das tabelas do SQLite original.

## 3. Cron (UTC; minutos fora de :04 :07 :09 :11 :13 :17 :23 :34 :39 :41)
- `27 22 * * 1-5`: 19:27 (horário de Brasília), depois do fechamento da B3. Preços Yahoo + BCB.
- `47 10 * * 2-6`: 07:47 (horário de Brasília). Repescagem: Yahoo atrasado, CVM/BCB publicados de madrugada.
- Também roda com `workflow_dispatch` (manual) e a cada push na `main`.

## 4. Riscos
- **Rate limit e instabilidade do Yahoo (yfinance não é oficial).** Mitigação: download incremental, retry com backoff, pausa entre tickers. Se um ticker falhar, mantém o JSON anterior em vez de publicar vazio, e o `generated_at` aparece na tela.
- **O cron do Actions atrasa** (às vezes 15–60 min nos horários de pico) e pode pular execuções. Por isso há 2 horários por dia, evitando o minuto :00.
- **Workflows agendados são desativados após 60 dias sem atividade no repo público** ([doc oficial](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow)). Mitigação: commit diário de dados no branch `data` (é atividade no repo) ou um keepalive mensal (commit de `data/heartbeat.json`). Se mesmo assim desativar, basta clicar em "Enable workflow" na aba Actions.
- **ANBIMA:** o arquivo saiu de anbima.com.br e foi para data.anbima.com.br. O link `.xls` agora fica em `data-strapi.prd.anbima.com.br/uploads/...`. Os **termos do portal ANBIMA Data proíbem expressamente spiders e mineração automatizada.** Para o mock baixei **1 arquivo publicado** (ref. 20/10/2026), equivalente a clicar em "Baixar". **Não proponho automatizar isso.** Alternativa: Informe Diário da CVM (dados abertos, ver tabela).
- **Repo público:** qualquer `.env`, chave ou `.db` commitado fica exposto (ver §6).

## 5. Fases / PRs
1. **PR1 – base estática** (é o mock atual): export + basePath, `lib/static.ts`, home/GP/GPC/RRG/ANB, `pipeline/build_data.py`, `pages.yml`, rebrand. Corrige os bugs do original: `/prices` fazia `SELECT time` mas a coluna é `date`; o front chamava `/info/{t}` mas a rota é `/info/ticker/{t}`; o RRG vinha vazio porque IDX_BVSP só tinha 22 linhas; o gráfico do GP ficava com altura 0; os ticks do RRG não eram formatados.
2. **PR2 – lote 1** (só preços + BCB): MACD, RSI, SEAG, SEAH, VOL, BETA, GR, CDIE e candles de verdade no GPC.
3. **PR3 – lote 2**: FX, WEI, ECON, TOP, HEAT, PORT e ANB via CVM.
4. **PR4 – lote 3**: DY, DVD, SPLIT, DES, CF, CN, NEWS, WFI.
5. **PR5 – lote 4**: FUND, VAL, CAL, OMON, ALERT.

Cada lote vem com mock e screenshots para aprovação antes do PR.

## 6. O que o Marcelo precisa fazer no GitHub
1. **Token:** no fine-grained PAT `grokbot-portfolio-celowiz`, adicionar o repo `celowiz/quant-terminal` com **Contents: Read and write**, **Pull requests: Read and write** e **Workflows: Read and write** (Metadata: read vem junto). Hoje o token recebe 404 nesse repo.
2. **Pages:** Settings → Pages → Build and deployment → **Source = GitHub Actions**.
3. **Actions:** Settings → Actions → General → Workflow permissions → "Read and write" (necessário para o commit no branch `data`).
4. **Secret opcional (lote 2):** `FRED_API_KEY` em Settings → Secrets and variables → Actions. A chave é gratuita no FRED.
5. **Repo privado?** Pela doc oficial: *"GitHub Pages is available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server."* ([docs.github.com – Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)).
   - No plano **Free o repo precisa ser público**. Repo privado exige Pro (pago).
   - Mesmo com Pro, **o site publicado continua público na internet**. Controle de acesso ao site só existe no Enterprise Cloud.
   - Observação: Actions em repo público usa runners padrão de graça e sem limite de minutos. Em repo privado no Free a cota é de 2.000 min/mês.
6. **Antes de tornar público:**
   - Garantir que `.env`, `*.db`, `*.csv`, `yahoo_assets.json` e logs não estão versionados. O `.gitignore` atual já cobre `.env`, `*.db` e `*.csv`.
   - **Conferir o histórico local:** como não temos a pasta `.git`, não dá para saber se o "first commit" incluiu algum `.env` ou `.db`. Rodar `git log --all --stat -- '*.env' '*.db' .env` e `git grep -i "api_key\|token\|senha" $(git rev-list --all)`. Se aparecer algo, **revogar a chave** e reescrever o histórico (git filter-repo) ou começar um repo limpo.
   - No código copiado o grep não achou segredo hardcoded. `fred.py` lê `FRED_API_KEY` do ambiente.

## 7. Todas as funções do FUNCTION_LIST
Legenda de viabilidade: ✅ viável com dados públicos gratuitos · 🟡 viável com ressalvas · 🔴 inviável como no original (vai com a alternativa honesta)

| Cód. | Função | Viab. | Fonte (gratuita) | Cálculo / implementação | Lote |
|---|---|---|---|---|---|
| (home) | Homepage | ✅ | — | já replicada | PR1 |
| GP | Line Graph | ✅ | Yahoo (yfinance) | adj close, filtro/resample no cliente | PR1 |
| GPC | Candle Chart | ✅ | Yahoo | hoje é **área igual ao GP**. Proposta: candles OHLC de verdade (+volume) | PR1 (fiel) / PR2 (candles) |
| RRG | Relative Rotation Graph | ✅ | Yahoo | porte do rrg.py no cliente | PR1 |
| ANB | Fluxo de fundos por categoria | 🟡 | **CVM – Informe Diário de Fundos** (dados.cvm.gov.br, dados abertos) + cadastro CVM (classe) | captação − resgate por dia, agregado por classe (RF, Ações, Multimercado, Cambial) e acumulado no mês/ano/12m. **Não é idêntico às categorias ANBIMA**, que são proprietárias. A planilha ANBIMA só por download manual (ToS proíbe automação) | PR3 |
| MACD | MACD | ✅ | Yahoo | EMA12 − EMA26, sinal EMA9, histograma | PR2 |
| RSI | RSI | ✅ | Yahoo | RSI de Wilder (14) | PR2 |
| CDIE | Expectativa CDI/Copom (DI futuro) | ✅ | B3 BDI (ajuste DI1), BCB SGS 4389/432, calendário Copom (BCB), Focus por reunião (Olinda) | flat-forward em du/252, CDI implícito e mudança em pb por reunião, curva cotada × estimada, histórico ~1 mês | v4 (refeito) |
| SEAG | Sazonalidade (gráfico) | ✅ | Yahoo | retorno médio/mediano por mês, % de anos positivos | PR2 |
| SEAH | Sazonalidade (heatmap) | ✅ | Yahoo | matriz ano × mês de retornos | PR2 |
| VOL | Volatilidade histórica | ✅ | Yahoo | desvio-padrão de log-retornos ×√252, janelas 21/63/252, cone de vol | PR2 |
| BETA | Beta e correlação | ✅ | Yahoo | cov/var vs ^BVSP (rolling 252), matriz de correlação | PR2 |
| GR | Relação entre gráficos | ✅ | Yahoo | razão/spread A/B, dispersão, regressão | PR2 |
| FX | Cotações de moedas | ✅ | Yahoo `=X` + BCB PTAX (API Olinda) | tabela de pares + variação 1d/1m/YTD, PTAX oficial | PR3 |
| WEI | Índices mundiais de ações | ✅ | Yahoo (^GSPC, ^IXIC, ^DJI, ^STOXX50E, ^GDAXI, ^FTSE, ^N225, ^HSI, ^BVSP, ^MXX…) | tabela de variações + mini-gráficos. Fechamento diário, não tempo real | PR3 |
| ECON | Indicadores econômicos | ✅ | BCB SGS (Selic 432, IPCA 433, IGP-M 189, câmbio), IBGE SIDRA, FRED (key grátis) | séries + último valor | PR3 |
| TOP | Maiores altas/baixas | ✅ | Yahoo, universo IBOV (~85 ativos) | variação do dia/semana/mês com base no fechamento | PR3 |
| HEAT | Heatmap setorial | ✅ | Yahoo + setores B3 (do cadastro.db, convertido para JSON) | treemap por setor, peso igual (ou volume financeiro) | PR3 |
| PORT | Simulador de carteira | ✅ | Yahoo | pesos + rebalanceamento, retorno/vol/drawdown, carteira salva no localStorage | PR3 |
| DY | Histórico de dividend yield | 🟡 | yfinance `dividends` | soma 12m dos proventos / preço. Na B3 JCP e dividendos podem vir incompletos, e isso fica sinalizado | PR4 |
| DVD | Histórico de dividendos | 🟡 | yfinance `dividends` | tabela por data-ex. Mesma ressalva | PR4 |
| SPLIT | Histórico de desdobramentos | ✅ | yfinance `splits` | tabela + fator acumulado | PR4 |
| DES | Descrição da empresa | 🟡 | CVM cadastro de cias abertas (CNPJ, setor, situação) + SEC EDGAR (EUA) | ficha cadastral oficial. O resumo "business summary" do Yahoo é não oficial e opcional | PR4 |
| CF | Documentos da empresa (Filings) | ✅ | CVM IPE (fatos relevantes, comunicados, ITR/DFP) + SEC EDGAR submissions | lista com data, tipo e link para o documento oficial | PR4 |
| CN | Notícias da empresa | 🟡 | CVM IPE (fatos relevantes) + RSS públicos | manchete + link (nunca o texto completo). Atualizado só nos horários do cron | PR4 |
| NEWS | Notícias de mercado | 🟡 | Agência Brasil (CC BY 4.0), notas do BCB/CVM via RSS | manchete + link + fonte. Não é tempo real | PR4 |
| WFI | Índices mundiais de renda fixa | 🟡 | Tesouro Transparente (preços/taxas do Tesouro Direto), FRED (DGS2/DGS10, Bund e afins), BCB | curvas/taxas soberanas. **Os índices IMA/IDkA da ANBIMA ficam de fora** (ToS) | PR4 |
| FUND | Fundamentos da empresa | 🟡 | CVM DFP/ITR (dados abertos, CSV) + SEC EDGAR companyfacts | receita, EBITDA, lucro, margens, dívida líquida. Parsing pesado, cobertura no IBOV primeiro | PR5 |
| VAL | Valuation – múltiplos | 🟡 | CVM DFP/ITR + preço Yahoo + nº de ações (CVM FRE/composição do capital) | P/L, P/VP, EV/EBITDA, DY. Defasado até o próximo ITR | PR5 |
| CAL | Calendário de resultados | 🟡 | CVM IPE "Calendário de Eventos Corporativos" + yfinance `calendar` | próximas datas quando publicadas. **Não existe calendário oficial consolidado e gratuito**, então a cobertura é parcial e isso fica dito na tela | PR5 |
| OMON | Monitor de opções | 🔴→🟡 | B3 COTAHIST diário (arquivo público de fechamento, inclui opções) | **sem tempo real e sem book**. A versão honesta é a cadeia de fechamento (D-1) de PETR4/VALE3/BOVA11, com IV e gregas por Black-Scholes usando o CDI | PR5 |
| ALERT | Alertas de preço | 🔴→🟡 | — | sem servidor não há push em tempo real. Alternativa: regras num `alerts.yaml` do repo, checadas pelo Actions em cada cron, que abre uma Issue (o GitHub notifica por e-mail). No site, alertas locais avaliados ao abrir a página | PR5 |
| COMP | Retorno comparativo | ✅ | Yahoo | até 6 tickers rebaseados, retorno/anualizado/vol | v4 |
| HS | Spread histórico | ✅ | Yahoo | razão/spread, ±σ, z-score, meia-vida, hedge ratio | v4 |
| CORR | Matriz de correlação | ✅ | Yahoo | top N IBOV + ^BVSP, janela/frequência, correlação móvel 63d no clique | v4 |
| HRA | Regressão histórica | ✅ | Yahoo | OLS D/S/M vs ^BVSP: alfa, beta, t, R² aj., resíduos | v4 |
| GIP | Gráfico intradiário | 🟡 | Yahoo (atrasado) | 1m (~5–7 pregões) / 5m (~60 dias), linha/candle, VWAP; só 6 ações + ^BVSP | v4 |
| EQS | Screener de ações | ✅ | CVM DFP/ITR + FRE + Yahoo | filtros, ordenação, CSV; universo IBOV | v4 |
| RV | Valuation relativo | ✅ | screener (CVM + Yahoo) | pares por subsetor/setor B3, medianas | v4 |
| HP | Tabela de preços históricos | ✅ | Yahoo | D/S/M, período, export CSV | v4 |
| TRA | Retorno total | 🟡 | Yahoo (proventos) | dividendos reinvestidos × preço, tabela anual; proventos Yahoo podem faltar | v4 |
| GC | Curvas de juros | ✅ | B3 DI1, Tesouro Transparente, FRED | DI1 / Tesouro Pré e IPCA+ / Treasuries, comparação histórica e Δpb | v4 |
| ECFC | Previsões econômicas | ✅ | BCB Focus (Olinda) | medianas anuais por indicador + evolução da mediana | v4 |
| ECST | Estatísticas econômicas | ✅ | BCB SGS, IBGE SIDRA, FRED | último/anterior/variação, transformações, gráfico por linha | v4 |
| WCRS | Ranking de moedas | ✅ | Yahoo `=X` | 26 moedas, base USD/BRL, 1D..1A (só spot) | v4 |
| GLCO | Commodities globais | ✅ | Yahoo futuros (1º vencimento) | tabela por grupo + gráfico | v4 |
| MOST | Mais negociadas | ✅ | Yahoo, universo IBOV | 6 abas (volume, altas, baixas, volume anormal, 52s) | v4 |
| HDS | Acionistas | 🟡 | CVM FRE (posição acionária) | detentores diretos + cadeia de controle; data do FRE | v4 |
| FA | Análise financeira | ✅ | CVM DFP/ITR | DRE/BP/DFC anual e trimestral, R$ mi, Δ | v4 |
| BTMM | Monitor de juros e money market | ✅ | BCB SGS, B3 DI1, Tesouro Transparente, FRED | painéis BR/EUA + Selic × Fed Funds; sem coluna de consenso | v4 |
| MRR | Retorno dos membros | ✅ | Yahoo | ranking dos membros do IBOV com contribuição + heatmap mensal | v4 |

Princípios: só dado real com a fonte e a data (`generated_at`) visíveis em cada tela. Tom educativo, sem recomendação. Onde a fonte não cobre, a tela mostra "sem dados", nunca valor inventado.
