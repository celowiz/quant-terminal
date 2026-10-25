# REFERENCIAS.md — telas de referência e decisões de design do quant-terminal

> Documento interno de pesquisa. O **produto** não usa nome nem logo Bloomberg (verificado por `grep -ri bloomberg out/` = vazio).
> O estilo é *inspirado* em terminais financeiros profissionais: fundo preto, texto âmbar, tabelas densas e monoespaçadas,
> barra de comando com `<CÓDIGO> <GO>`. Todos os dados são reais, de fontes abertas, e gerados por `pipeline/*.py`.
> O tom é educacional. Nada aqui é recomendação de investimento.

## 1. Paleta e tipografia (aproximadas, medidas a olho em screenshots públicos; não são valores oficiais)

| Papel | Hex (aprox.) | Uso no mock |
|---|---|---|
| Fundo | `#000000` | página e painéis |
| Âmbar (texto principal / rótulos) | **`#FFA028`** | títulos, códigos de função, colunas-chave |
| Alta | **`#3DDC84`** | variações positivas, barras de alta |
| Baixa | **`#FF4D4D`** | variações negativas |
| Azul (candle de baixa no GPC) | **`#2F7BFF`** | corpo cheio dos candles de queda |
| Branco (candle de alta no GPC) | `#FFFFFF` | candle vazado (só contorno) |
| Linhas de grade | `#1E1E1E`–`#2A2A2A` | grade dos gráficos e tabelas |
| Destaque de linha | `#1A1205` | linha selecionada (fundo âmbar escuro) |
| Fonte | monoespaçada do sistema (`ui-monospace`, Consolas, Menlo) | tudo |

## 2. Fontes gerais de pesquisa (como são as telas reais)

- Guia oficial "Getting started on the Bloomberg Terminal" (PDF para estudantes): https://data.bloomberglp.com/professional/sites/10/Getting-Started-Guide-for-Students-English.pdf
- Bloomberg Professional, "Terminal Essentials: best equities functions": https://www.bloomberg.com/professional/insights/technology/bloomberg-terminal-essentials-best-equities-functions/
- Pace University, mnemônicos: https://libguides.pace.edu/c.php?g=63952&p=410850
- Seton Hall, comandos/funções: https://library.shu.edu/c.php?g=351647&p=9986882
- USD, funções de equity research: https://libguides.sandiego.edu/c.php?g=1305187&p=11445874
- Columbia, comandos básicos: https://guides.library.columbia.edu/bloomberg/basic
- UT Dallas, comandos comuns (PDF): https://bpb-us-e2.wpmucdn.com/sites.utdallas.edu/dist/8/1090/files/2021/03/bloomberg_commands.pdf
- Damodaran/NYU, "Using the Bloomberg terminal for data" (PDF): https://pages.stern.nyu.edu/~adamodar/pdfiles/Bloombergfull.pdf
- Corporate Finance Institute, lista de funções: https://corporatefinanceinstitute.com/resources/equities/bloomberg-functions-shortcuts-list/
- Guias SMU, Duke, Penn e Cornell/Ithaca (CTC Fundamental PDF), consultados na pesquisa de v2.

## 3. Telas da v2

### GP — gráfico de linha (página inteira)
- **Real:** gráfico de preço de página inteira com barra de período (1D…Max), seletor de campo, eixo à direita, legenda no canto superior esquerdo e painel de volume opcional.
- **Mock:** `/GP/<ticker>/` ocupa a tela toda, com períodos 1M/3M/6M/YTD/1A/5A/Max, eixo de preço à direita e volume embaixo (K/M/B).
- **Diferenças:** sem intraday (só o diário do Yahoo); sem anotações nem campos customizados.

### GPC — candles
- **Real:** candlestick com candle de alta vazado/branco e candle de baixa cheio (azul/vermelho conforme o tema).
- **Mock:** usa OHLC real (ajustado). Candle de **alta = branco vazado** e de **baixa = azul `#2F7BFF` cheio**, com volume abaixo.
- **Diferenças:** OHLC ajustado por proventos (o real mostra o não ajustado por padrão); sem estudos sobrepostos além de MAs.

### RRG — Relative Rotation Graph
- **Referências:** metodologia JdK RS-Ratio/RS-Momentum (Julius de Kempenaer, https://relativerotationgraphs.com/); implementação de referência celowiz/rrg (só lida/clonada em `/workspace/qt/ref/rrg`).
- **Mock:** os quatro quadrantes (Leading verde, Weakening amarelo, Lagging vermelho, Improving azul), rastros (*trails*) de N semanas com cabeça marcada e benchmark ^BVSP.
- **Diferenças:** a fórmula JdK exata é proprietária; aqui é a aproximação aberta do celowiz/rrg (razão normalizada mais momentum da razão, centrados em 100).

## 4. As 28 funções

Formato: **Real** = o que a tela original faz e como é. **Mock** = o que foi replicado. **Fonte** = de onde vêm os dados. **Difere** = diferenças conhecidas.

### Técnicas (`src/views/fn/tech.tsx`)

**MACD** — Moving Average Convergence/Divergence
- Real: painel superior de preço e painel inferior com MACD(12,26), sinal(9) e histograma; parâmetros editáveis no topo. Ref: Pace/Seton Hall (mnemônicos), CFI.
- Mock: preço + MACD/sinal/histograma (verde/vermelho), parâmetros editáveis e tabela de cruzamentos recentes.
- Fonte: Yahoo (OHLC diário). Difere: sem intraday; sem backtest da estratégia (a tela real tem a aba "Backtest").

**RSI** — Relative Strength Index
- Real: preço + RSI(14) de Wilder com faixas 70/30.
- Mock: igual, com período editável, faixas 70/30 e estatísticas do período (dias sobrecomprado/sobrevendido).
- Fonte: Yahoo. Difere: só diário.

**SEAG** — Seasonality Graph
- Real: retorno acumulado de cada ano sobreposto no mesmo eixo de calendário (jan→dez), mais média.
- Mock: linhas por ano + média, com destaque do ano corrente e tabela de retorno por ano.
- Fonte: Yahoo (10 anos). Difere: só 10 anos de histórico (o real vai mais longe).

**SEAH** — Seasonality Heatmap
- Real: matriz ano × mês com retorno mensal colorido.
- Mock: igual, com linhas de média, mediana e % positivos.
- Fonte: Yahoo. Difere: o primeiro ano (2016) é parcial, porque a janela é de 10 anos corridos.

**VOL** — Historical Volatility
- Real: vol histórica de várias janelas e comparação com a implícita.
- Mock: vol realizada (10/20/30/60/90/120d) e **cone de volatilidade** (mín/p25/mediana/p75/máx).
- Fonte: Yahoo. Difere: **sem vol implícita** (a B3 não publica a superfície em dados abertos). O máximo do cone de 10d (~263%) reflete o crash de 2020 e é real.

**BETA** — Historical Beta
- Real: regressão do ativo contra um índice, com beta bruto e ajustado (0,67·β + 0,33), R², desvio-padrão, janela de 2 anos semanal por padrão. Refs: BYU https://guides.lib.byu.edu/bloomberg/Beta, Babson https://libguides.babson.edu/beta/Bloomberg
- Mock: scatter + reta, β bruto/ajustado, α, R², erro-padrão, frequência D/S/M, benchmark selecionável e aba de matriz de correlação.
- Fonte: Yahoo. Difere: universo de benchmarks limitado aos tickers do seletor.

**GR** — Graph Relationship
- Real: dois ativos com razão/spread, regressão e correlação.
- Mock: razão normalizada, scatter de retornos, correlação móvel.
- Fonte: Yahoo. Difere: a correlação PETR4×VALE3 baixa (0,08) foi verificada em Python e é real.

### Corporativas (`src/views/fn/corp.tsx`)

**DES** — Description
- Real: várias páginas com descrição do negócio, dados-chave (mkt cap, P/L, dividend yield, beta), gráfico de 1 ano, executivos e estimativas.
- Mock: abas Perfil (descrição, preço de 1 ano, dados-chave), Receita & Lucro e Cadastro CVM.
- Fonte: Yahoo (perfil) + CVM `cad_cia_aberta` + DFP/ITR. Difere: sem consenso de analistas nem rating; executivos só via FCA.

**FUND** — Financial Analysis (equivalente ao FA)
- Real: DRE, balanço, fluxo de caixa e indicadores, anual/trimestral, padronizados. Ref: Ithaca/Cornell CTC Fundamental (PDF).
- Mock: abas DRE, Balanço, Fluxo de caixa e Indicadores (anual e trimestral) com os dados oficiais da CVM.
- Fonte: CVM DFP/ITR (dados.cvm.gov.br). Difere: **sem padronização entre setores**. Bancos (ITUB4) aparecem no formato IF da CVM, então algumas linhas não se aplicam. O PL dos bancos é tirado da conta de nível 2 "Patrimônio Líquido".

**VAL** — Valuation / múltiplos (equivalente ao RV/EQRV)
- Real: múltiplos correntes e históricos, comparação com pares.
- Mock: múltiplos calculados (P/L, P/VPA, EV/EBITDA, DY, ROE, margens) ao lado dos do Yahoo, histórico e pares com a mesma metodologia.
- Fonte: CVM + Yahoo. Difere: sem múltiplos *forward* (não há consenso aberto). Ajuste aplicado: a CVM reporta ações em milhares para VALE/ITUB (`fix_share_units`).

**DY** — Dividend Yield
- Real: DY corrente e histórico.
- Mock: DY 12m móvel (dividendos + JCP brutos por data-ex ÷ preço) e tabela por ano.
- Fonte: Yahoo (proventos) + CVM. Difere: JCP aparece bruto, sem IR.

**DVD** — Dividend/Split History
- Real: tabela de proventos (declaração, ex, pagamento, valor, tipo) e gráfico.
- Mock: histórico de proventos + total por ano + aba de avisos CVM (IPE).
- Fonte: Yahoo + CVM IPE. Difere: o Yahoo não traz as datas de declaração/pagamento; essas datas vêm dos avisos do IPE, mas não estão ligadas linha a linha.

**SPLIT** — desdobramentos/grupamentos (subconjunto do DVD)
- Mock: tabela de eventos com razão e fator, e marcadores no gráfico (`1:x` / `G x:1`), filtrados para a faixa de preço.
- Fonte: Yahoo. Difere: cobre só o que o Yahoo registra; bonificações em ações nem sempre aparecem.

**CF** — Company Filings
- Real: lista de documentos regulatórios com filtro e busca.
- Mock: documentos IPE/DFP/ITR da CVM com categoria, assunto, busca e link para o documento original.
- Fonte: CVM IPE. Difere: sem visualizador embutido (abre o PDF na CVM).

**CN** — Company News
- Real: fluxo de notícias da empresa vindo da agência própria e de terceiros.
- Mock: Fatos Relevantes/Comunicados (CVM IPE), com destaque para Fato Relevante, mais RSS de licença aberta.
- Fonte: CVM IPE + RSS. Difere: **sem newswire paga**, então o volume é bem menor que no real.

**OMON** — Option Monitor
- Real: calls à esquerda, puts à direita, agrupadas por vencimento, com bid/ask/last/vol/IV/gregas. Refs: HBS https://www.library.hbs.edu/services/help-center/bloomberg-options, Godel Terminal (OMON).
- Mock: igual (calls | strike | puts), seletor de vencimento, IV e gregas Black-Scholes calculadas.
- Fonte: B3 COTAHIST diário (opções). Difere: **fim de dia, não tempo real**; bid/ask frequentemente 0 no arquivo da B3; a IV é calculada por nós.

### Mercado (`src/views/fn/market.tsx`)

**WEI** — World Equity Indices
- Real: índices por região (Américas/EMEA/Ásia), com último, variação, %YTD e moeda.
- Mock: igual, com sparkline de 1M, 1M%, YTD% e gráfico de 2 anos do índice selecionado.
- Fonte: Yahoo. Difere: fechamento diário; alguns índices não estão no Yahoo (^IPSA, por exemplo, deu falha no pipeline).

**WFI** — World Fixed Income
- Real: curvas soberanas por país, prazos, variações e spreads.
- Mock: abas Curva EUA (Treasuries), Soberanos 10a, Crédito (ICE BofA índices/OAS) e Brasil (Selic, CDI).
- Fonte: FRED (CSV público) + BCB SGS. Difere: **sem curva de juros brasileira** (DI/NTN-B não têm fonte aberta automatizável sem violar ToS, e a ANBIMA proíbe automação).

**ECON** — economic indicators (equivalente a ECST/ECO)
- Real: tabela de indicadores e calendário de divulgações com consenso.
- Mock: Brasil (IPCA, Selic, PIB, desemprego…) e EUA, com gráfico do selecionado e medianas do Focus.
- Fonte: BCB SGS + Focus (Olinda) + FRED. Difere: sem calendário com consenso de mercado (só Focus).

**FX** — Currency Monitor (FXC/FXIP)
- Real: matriz cruzada de moedas e variações.
- Mock: matriz cruzada, variação 1D%, PTAX (BCB) e DXY/USDBRL.
- Fonte: Yahoo + BCB PTAX. Difere: fim de dia.

**HEAT** — mapa de calor (IMAP)
- Real: treemap de setores/ações colorido pela variação.
- Mock: treemap do Ibovespa por setor (tamanho = peso/valor de mercado, cor = variação).
- Fonte: Yahoo + composição da B3. Difere: fim de dia; a carteira teórica pode ter defasagem.

**TOP** — maiores altas/baixas (MOST/MOV)
- Real: listas de *gainers/losers/most active*.
- Mock: altas, baixas, mais negociadas (volume financeiro de 30d) e distribuição ordenada das variações.
- Fonte: Yahoo. Difere: universo = Ibovespa.

**CAL** — calendário corporativo (EVTS/ERN)
- Real: calendário de resultados, assembleias e proventos.
- Mock: visões Mês, Lista e Por empresa.
- Fonte: CVM IPE (calendário anual de eventos) + Yahoo. Difere: as datas do Yahoo são estimativas.

**NEWS** — Top News (TOP/N)
- Real: manchetes curadas da agência.
- Mock: manchetes de RSS de licença aberta (Agência Brasil, BCB, CVM, SEC, Fed), com busca.
- Fonte: RSS. Difere: sem conteúdo pago nem curadoria editorial.

**ANB** — fluxo de fundos por classe
- Real: dados ANBIMA de captação/patrimônio por classe.
- Mock: captação líquida diária/mensal por classe.
- Fonte: **CVM Informe Diário de fundos** (dados.cvm.gov.br). Os ToS da ANBIMA proíbem automação, por isso a classificação é a da CVM e não a ANBIMA.

**CDIE**: expectativa do CDI e do Copom implícita no DI futuro (refeito na v4)
- Real: tela de taxas forward e decisões do Copom implícitas nos contratos DI1. Coluna "COPOM Est" com a mudança estimada por reunião. "Est" é o DI1 reprecificado a partir dessas mudanças, e "Last−Est" é a diferença para o último preço. Hipóteses: CDI constante entre reuniões, ponto de partida no último DI over, solução suavizada. Opção 98 mostra o gráfico cotado × estimado.
- Referências: Massar (quant de renda fixa do fornecedor), "Analyzing Brazilian One-day Interbank Deposit Futures" (studylib.net/doc/28134023); Wilson Freitas, "Expectativas do COPOM nos contratos de DI1" e pacote `copom` (interpolação FlatForwardCOPOM); tela WIRP, de função análoga (vídeo Pro Tips, 2023). Posts no LinkedIn que replicam a tela em Excel com dados da B3.
- Mock:
  - Tabela de reuniões do Copom: data, DI1 de referência, CDI implícito após a reunião, mudança implícita em pb, acumulado e Focus/BCB da reunião quando houver.
  - Tabela de contratos DI1: vencimento, dias úteis, PU e taxa de ajuste, forward entre vencimentos consecutivos e taxa estimada pelo caminho do Copom com Last−Est.
  - Gráficos: escada do CDI implícito × Selic meta e curva cotada × estimada.
- Fontes: B3 Boletim Diário (BDI, "Negócios Consolidados – Derivativos", POST público em arquivos.b3.com.br/bdi); calendário do Copom da API pública do site do BCB; CDI e Selic do BCB SGS (4389 e 432); Focus por reunião via BCB Olinda ExpectativasMercadoSelic.
- Cálculo: dias úteis 252 com feriados nacionais calculados no código, conferidos com o du implícito no próprio PU da B3. Interpolação flat-forward: fatores log dos DI1 interpolados linearmente em du (forward constante entre vencimentos). O CDI implícito de cada período entre reuniões é o forward médio do período, como no FlatForwardCOPOM do pacote `copom` de Wilson Freitas. A mudança por reunião é a diferença entre períodos consecutivos. O ponto de partida é o CDI atual, e o spread Selic−CDI (~10 pb) é usado para converter em Selic implícita. A tela real usa solução suavizada, por isso os números diferem um pouco.

**PORT** — Portfolio (PORT)
- Real: análise de carteira (performance, risco, atribuição).
- Mock: backtest de pesos-alvo com rebalanceamento diário ou mensal, curva, drawdown e métricas.
- Fonte: Yahoo. Difere: sem atribuição nem fatores de risco; carteira local no navegador.

**ALERT** — alertas
- Real: alertas em tempo real no terminal ou no celular.
- Mock: regras `alerts.yaml` avaliadas no fechamento pelo GitHub Actions (abre issue quando dispara), mais alertas locais no navegador.
- Fonte: preços do pipeline. Difere: **não é push em tempo real**, só uma checagem diária.


## 5. Novas funções (v4), pesquisadas antes de construir

Fontes gerais desta rodada: lista de funções da CFI (corporatefinanceinstitute.com/resources/equities/bloomberg-functions-shortcuts-list), guias de biblioteca (HBS Baker Library "yield curves" e "comparative returns", Penn, USC, Yale, Michigan Kresge, Bocconi, Ljubljana eTutor, NYU Damodaran 2024), guia BTMM (idoc.pub), Gloom Academy (GC), Godel Terminal docs (MOST) e Chegg (colunas do WCRS).

**COMP**: retorno comparativo
- Real: compara o retorno total do papel com até 5 outros, benchmark incluído. Escolhe período e frequência e mostra curvas rebaseadas com tabela de retorno por papel (HBS "comparative returns", CFI).
- Mock: até 6 tickers (padrão PETR4 × IBOV × VALE3 × ITUB4), curvas em % desde o início, tabela com retorno, retorno anualizado, volatilidade e diferença para o primeiro papel.

**HS**: spread histórico
- Real: gráfico do spread ou razão entre dois papéis (HSN normalizado), com estatísticas média ± desvio (USC guide).
- Mock: razão ou diferença de log-preço de A/B (padrão PETR4/PETR3, par clássico de pairs trading), média e bandas ±1σ/±2σ, z-score, painel de estatísticas (média, desvio, z atual, meia-vida AR(1), correlação). Ideia vinda de celowiz/pairs-trading (só leitura).

**CORR**: matriz de correlação
- Real: matriz de correlação de até 20 papéis, período e frequência configuráveis (USC guide, eFinancialCareers).
- Mock: matriz heatmap dos retornos diários ou semanais de todos os tickers do mock, com janela 3M/6M/1A/3A e correlação rolante de um par.

**HRA**: análise de regressão histórica
- Real: regressão linear de um papel contra outro ou um índice: scatter, reta, α, β, R², erro padrão (USC guide, junto com BETA).
- Mock: scatter de retornos (diário, semanal ou mensal) do papel × IBOV, reta OLS e tabela α, β, R², correlação, erro padrão do β, t-stat e nº de observações.

**GIP**: gráfico intradiário
- Real: gráfico intraday com até 240 dias, barras de 1 min e mais (CFI).
- Mock: barras de 1 min (últimos ~5 pregões) e 5 min (~60 dias) do Yahoo, com volume. Limitação: o Yahoo só fornece 1 min por ~7 dias e 5 min por ~60, com atraso, e o arquivo é atualizado só uma vez por dia pelo pipeline.

**EQS**: screening de ações
- Real: define universo (índice/setor) e critérios (ex.: market cap, P/L, EBITDA) e devolve a lista com colunas selecionáveis e export (Ljubljana eTutor, Dartmouth).
- Mock: universo IBOV (~76). Filtros de setor, market cap, P/L, P/VPA, EV/EBITDA, DY, ROE, margem líquida, dívida líquida/EBITDA e liquidez média em 30 dias. Grade ordenável com exportação em CSV.

**RV**: valor relativo
- Real: compara o papel com os pares (fonte BICS/GICS ou custom). A aba Overview mostra market cap, preço, LPA, P/L e ROE, e a aba Valuation os múltiplos (Bocconi, IESE).
- Mock: pares = mesmo setor/subsetor B3 do IBOV. Colunas de preço, market cap, P/L, P/VPA, EV/EBITDA, DY, ROE e margem, com mediana dos pares e posição percentual do papel.

**HP**: tabela de preços históricos
- Real: tabela de data, último, abertura, máxima, mínima e volume, com variação e periodicidade diária, semanal ou mensal (CFI).
- Mock: OHLCV diário, semanal ou mensal com variação % e botão "Exportar CSV".

**TRA**: retorno total
- Real: retorno total de um papel num período com dividendos brutos reinvestidos, colunas de retorno total e anualizado por ano (Studylib TT-27, Penn FAQ).
- Mock: com preço sem ajuste e proventos do Yahoo, reinveste cada provento na data-ex. Mostra retorno de preço × total por ano, anualizado e gráfico das duas curvas.

**GC**: curvas de juros
- Real: até 4 curvas, data "as of" e data de comparação (1W/3M/1Y), tabela de membros e spreads 2s10s (HBS, Gloom).
- Mock: curva prefixada BR (LTN/NTN-F do Tesouro Direto, taxa de compra) e curva real (NTN-B). Curva US (FRED DGS*). Comparação com 1S, 1M, 3M e 1A atrás e tabela de vértices com a variação em pb.

**ECFC**: projeções econômicas
- Real: consenso e contribuintes por indicador e ano, histórico de revisões, distribuição (Stonehill, Course Sidekick).
- Mock: Focus/BCB (Olinda ExpectativasMercadoAnuais): mediana, média, desvio, mín., máx. e nº de respondentes de IPCA, PIB, Selic, câmbio, IGP-M e resultado primário por ano, com gráfico da evolução da mediana (revisões).

**ECST**: estatísticas econômicas
- Real: dados econômicos por país com contexto, gráficos e tabelas históricas (CFI, Finance Canada).
- Mock: painel Brasil (IPCA 12m, Selic, PIB trimestral, desemprego PNAD) via BCB SGS e IBGE SIDRA, e EUA (CPI, Fed Funds, desemprego, PIB) via FRED. Último valor, anterior, data e gráfico.

**WCRS**: ranking de moedas
- Real: ranking de moedas contra uma base (USD) com retorno spot, de juros e total em vários períodos (Chegg, Ohio U newsroom guide).
- Mock: ranking spot das moedas do fx.json contra USD ou BRL em 1D, 1S, 1M, 3M, YTD e 1A, com barras. Limitação: só retorno spot, sem carry (não há taxas de juros gratuitas de 3M para todos os países).

**GLCO**: commodities globais
- Real: monitor por grupos (Energia, Metais, Agrícolas) com preço, variação e desempenho (Kresge, Ljubljana).
- Mock: futuros contínuos do Yahoo (CL, BZ, NG, RB, HO, GC, SI, HG, PL, PA, ZC, ZW, ZS, KC, SB, CC, CT, LE) com último, variação em 1D, 1S, 1M, YTD e 1A e spark.

**MOST**: mais ativos
- Real: abas Volume, Valor, Altas e Baixas da sessão, com filtros (Godel docs, CFI).
- Mock: universo IBOV no último pregão do universe.json, com abas Volume financeiro (média 30d), Altas, Baixas e Máx./mín. de 52 semanas.

**HDS**: acionistas
- Real: nome do detentor, posição, % em circulação, variação e fonte do filing (NYU/Damodaran, HBS, WU).
- Mock: posição acionária do Formulário de Referência (CVM FRE, `posicao_acionaria`): acionista, ações ON, PN, total e % de cada classe, com data de referência.

**FA**: análise financeira
- Real: demonstrações (IS, BS, CF), índices e histórico anual ou trimestral (Penn, USD guide).
- Mock: DRE, Balanço (ativo/passivo) e DFC por conta CVM (níveis 1 a 3) dos arquivos DFP e ITR consolidados, com abas anual e trimestral (4º tri = anual − 9M nas contas de fluxo).

**BTMM**: monitor de juros e mercado monetário
- Real: caixas com Treasuries, bills, repo, Fed Funds, swaps, FX, bolsas, commodities e calendário econômico embaixo (idoc BTMM guide, Investopedia).
- Mock: caixas BR (Selic meta, CDI, DI1 principais vértices, Tesouro prefixado/IPCA+) e US (Fed Funds, Treasuries 3M–30Y), dólar, Ibovespa, S&P e petróleo, com calendário econômico da semana do calendar/econ quando houver.

**MRR**: retorno dos membros
- Real (CFI): "Member Returns": ranqueia os membros de um índice ou carteira por valorização ou retorno total num período. Não é um heatmap mensal.
- Mock: aba "Membros" com o ranking dos ~76 papéis do IBOV por retorno no período (1M, 3M, YTD, 1A) e contribuição pelo peso. Aba "Mensal" com o heatmap de retornos mensais × ano do ticker, pedido do projeto.
