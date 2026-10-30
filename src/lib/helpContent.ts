/** Metodologia detalhada por função (modal "?"). Fórmulas em TeX (KaTeX). Só descreve o que o código/pipeline faz. */
export type Formula = { tex: string; en: string; pt: string }
export type HelpDoc = { en: string; pt: string; formulas?: Formula[] }
const R = String.raw

export const HELP: Record<string, HelpDoc> = {
  HOME: {
    en: 'Quant Terminal: pick a function in the field at the top (or type its code) and a ticker. Every screen uses free, public data with delayed daily closes unless stated otherwise. The ? button explains the methodology of the screen you are on.',
    pt: 'Quant Terminal: escolha uma função no campo do topo (ou digite o código) e um ticker. Todas as telas usam dados públicos e gratuitos, com fechamento diário atrasado salvo indicação. O botão ? explica a metodologia da tela atual.',
  },
  GP: {
    en: 'Line chart of the daily close (Yahoo Finance, adjusted for distributions and splits) with traded volume in the lower pane. The axis label marks the latest close.',
    pt: 'Gráfico de linha do fechamento diário (Yahoo Finance, ajustado por proventos e desdobramentos) com volume negociado no painel inferior. O rótulo no eixo marca o último fechamento.',
    formulas: [{ tex: R`\Delta_t = C_t - C_{t-1},\qquad \Delta\%_t = \frac{C_t}{C_{t-1}} - 1`, en: 'Change shown in the header: the bar under the cursor (or the last bar) against the previous bar.', pt: 'Variação no cabeçalho: a barra sob o cursor (ou a última) contra a anterior.' }],
  },
  GPC: {
    en: 'Candlestick chart (open, high, low, close) of daily bars with volume. White candles: close ≥ open; blue candles: close < open.',
    pt: 'Gráfico de candles (abertura, máxima, mínima, fechamento) diários com volume. Candle branco: fechamento ≥ abertura; azul: fechamento < abertura.',
    formulas: [
      { tex: R`\text{candle}_t = \begin{cases} \text{white} & C_t \ge O_t \\ \text{blue} & C_t < O_t \end{cases}\qquad \text{wick} = [L_t,\ H_t]`, en: 'Body from open O to close C; the wick spans the low L to the high H of the bar.', pt: 'Corpo da abertura O ao fechamento C; o pavio vai da mínima L à máxima H da barra.' },
      { tex: R`\mathrm{SMAVG}_n(t) = \frac{1}{n}\sum_{i=0}^{n-1} C_{t-i},\quad n \in \{50,\ 200\}`, en: 'Simple moving averages of the close (toggle SMAVG 50 / 200).', pt: 'Médias móveis simples do fechamento (botões SMAVG 50 / 200).' },
      { tex: R`\Delta_t = C_t - C_{t-1},\qquad \Delta\%_t = \frac{C_t}{C_{t-1}} - 1`, en: 'Change shown in the header: the bar under the cursor (or the last bar) against the previous bar.', pt: 'Variação no cabeçalho: a barra sob o cursor (ou a última) contra a anterior.' },
    ],
  },
  GIP: {
    en: 'Intraday chart from delayed Yahoo Finance bars (1-minute bars cover ~5–7 sessions; 5-minute bars ~60 days), Brasília time. VWAP accumulates from the session open.',
    pt: 'Gráfico intradiário com barras atrasadas do Yahoo Finance (1 min cobre ~5–7 pregões; 5 min ~60 dias), horário de Brasília. O VWAP acumula desde a abertura.',
    formulas: [{ tex: R`\mathrm{VWAP}_t = \frac{\sum_{i \le t} \tfrac{H_i+L_i+C_i}{3}\, V_i}{\sum_{i \le t} V_i}`, en: 'Volume-weighted average of the typical price.', pt: 'Média do preço típico ponderada pelo volume.' }],
  },
  MACD: {
    en: 'Moving Average Convergence Divergence on the close. Arrows mark MACD/Signal crossovers.',
    pt: 'Convergência/divergência de médias móveis sobre o fechamento. Setas marcam cruzamentos MACD/Sinal.',
    formulas: [
      { tex: R`\mathrm{EMA}_t = \alpha P_t + (1-\alpha)\,\mathrm{EMA}_{t-1},\quad \alpha = \tfrac{2}{n+1}`, en: 'Exponential moving average.', pt: 'Média móvel exponencial.' },
      { tex: R`\mathrm{MACD} = \mathrm{EMA}_{f} - \mathrm{EMA}_{s},\quad \mathrm{Signal} = \mathrm{EMA}_{g}(\mathrm{MACD}),\quad \mathrm{Hist} = \mathrm{MACD} - \mathrm{Signal}`, en: 'f, s, g = fast, slow and signal periods (inputs).', pt: 'f, s, g = períodos rápido, lento e do sinal (parâmetros).' },
    ],
  },
  RSI: {
    en: "Wilder's Relative Strength Index with exponential smoothing 1/n. The line turns red above the overbought level and green below the oversold level.",
    pt: 'Índice de Força Relativa de Wilder com suavização exponencial 1/n. A linha fica vermelha acima do nível de sobrecompra e verde abaixo do de sobrevenda.',
    formulas: [{ tex: R`\mathrm{RSI} = 100 - \frac{100}{1 + \overline{G}_n / \overline{L}_n}`, en: 'Average gain over average loss (Wilder smoothing).', pt: 'Ganho médio sobre perda média (suavização de Wilder).' }],
  },
  RRG: {
    en: 'Relative Rotation Graph on weekly (Friday) closes versus the benchmark. Quadrants: Leading (ratio and momentum > 100), Weakening, Lagging, Improving. Play animates the tails through time.',
    pt: 'Gráfico de Rotação Relativa com fechamentos semanais (sexta) contra o benchmark. Quadrantes: Liderando (razão e momento > 100), Enfraquecendo, Atrasado, Melhorando. Animar percorre as trilhas no tempo.',
    formulas: [
      { tex: R`RS_t = \frac{P^{a}_t}{P^{b}_t},\qquad \text{RS-Ratio}_t = 100\,\frac{RS_t}{\mathrm{MA}_{n}(RS)_t}`, en: 'Relative strength versus the benchmark, normalized by its moving average (SMA or EMA).', pt: 'Força relativa contra o benchmark, normalizada pela sua média móvel (SMA ou EMA).' },
      { tex: R`\text{RS-Momentum}_t = 100\,\frac{\text{RS-Ratio}_t}{\text{RS-Ratio}_{t-m}}`, en: 'Rate of change of the RS-Ratio over m weeks; both series are smoothed before plotting.', pt: 'Taxa de variação do RS-Ratio em m semanas; as duas séries são suavizadas antes do gráfico.' },
    ],
  },
  CDIE: {
    en: 'Copom path implied by B3 DI1 futures. Each DI1 settlement price is converted to a rate; forwards between expiries are flat; the implied CDI of each inter-meeting period is that period\'s average forward (flat-forward method). The implied rate is what the market prices in, not a forecast, and includes a term premium. Focus = median Selic per meeting (BCB). History grows by one session per pipeline run.',
    pt: 'Trajetória do Copom implícita nos futuros DI1 da B3. Cada PU de ajuste vira taxa; os forwards entre vencimentos são constantes; o CDI implícito de cada período entre reuniões é o forward médio do período (método flat-forward). A taxa implícita é o que o mercado precifica, não uma projeção, e inclui prêmio de prazo. Focus = mediana da Selic por reunião (BCB). O histórico cresce uma sessão por execução do pipeline.',
    formulas: [
      { tex: R`r = \left(\frac{100\,000}{PU}\right)^{252/du} - 1`, en: 'DI1 rate from the settlement price PU, du = business days to expiry.', pt: 'Taxa do DI1 a partir do PU de ajuste, du = dias úteis até o vencimento.' },
      { tex: R`f_{i-1,i} = \left[\frac{(1+r_i)^{du_i/252}}{(1+r_{i-1})^{du_{i-1}/252}}\right]^{\frac{252}{du_i - du_{i-1}}} - 1`, en: 'Forward between consecutive expiries.', pt: 'Forward entre vencimentos consecutivos.' },
      { tex: R`\text{Selic}^{impl} = \text{CDI}^{impl} + (\text{Selic} - \text{CDI})_{today}`, en: 'Implied Selic adds today\'s Selic−CDI spread. Δ meeting vs the previous period; 25 bp = a standard move.', pt: 'Selic implícita soma o spread Selic−CDI de hoje. Δ reunião vs período anterior; 25 bp = movimento padrão.' },
      { tex: R`\text{Last} - \text{Est}\ (\text{bp})`, en: 'Est = contract rate recomputed from the implied path (only up to the last expiry covered by the published Copom calendar).', pt: 'Est = taxa do contrato recalculada pelo caminho implícito (só até o último vencimento coberto pelo calendário do Copom publicado).' },
    ],
  },
  WIRP: {
    en: 'Meeting-by-meeting probabilities of central-bank moves. Brazil: DI1 settlement curve → flat-forward CDI per Copom meeting; implied Selic = implied CDI + today\'s Selic−CDI spread. US: monthly average implied by each fed funds future (ZQ); the post-meeting rate is solved from the meeting-month average. Risk premia are ignored.',
    pt: 'Probabilidades de decisão por reunião. Brasil: curva de ajuste do DI1 → CDI flat-forward por reunião do Copom; Selic implícita = CDI implícito + spread Selic−CDI de hoje. EUA: média mensal implícita em cada futuro de fed funds (ZQ); a taxa pós-reunião é resolvida a partir da média do mês da reunião. Prêmios de risco são ignorados.',
    formulas: [
      { tex: R`\bar r_{month} = 100 - P_{ZQ},\qquad \bar r = \tfrac{d}{N}\, r_{pre} + \tfrac{N-d}{N}\, r_{post}`, en: 'Fed funds futures: d = days before the meeting in a month of N days.', pt: 'Futuros de fed funds: d = dias antes da reunião num mês de N dias.' },
      { tex: R`\Delta \in [a-25,\, a]:\quad p(a-25) = \frac{a - \Delta}{25},\quad p(a) = 1 - p(a-25)`, en: 'The implied move is split between the two adjacent 25 bp outcomes (e.g. −37 bp → 52% −25 bp / 48% −50 bp).', pt: 'O movimento implícito é dividido entre os dois resultados de 25 bp adjacentes (ex.: −37 bp → 52% −25 bp / 48% −50 bp).' },
      { tex: R`\#\text{moves} = \frac{\Delta_{cum}}{25\ \text{bp}}`, en: 'Cumulative move expressed in 25 bp steps.', pt: 'Movimento acumulado em passos de 25 bp.' },
    ],
  },
  GC: {
    en: 'Yield curves: Brazilian DI1 (B3 settlement), Tesouro Direto bonds (morning buy rate) and US Treasuries. Compare two dates; the bar chart below shows each vertex\'s change in basis points (green = rate up, red = rate down). X axis in business years (bd/252). DI1 history only covers sessions already collected by the pipeline.',
    pt: 'Curvas de juros: DI1 (ajuste B3), títulos do Tesouro Direto (taxa de compra, manhã) e Treasuries. Compare duas datas; o gráfico de barras mostra a variação de cada vértice em pontos-base (verde = alta da taxa, vermelho = queda). Eixo X em anos úteis (du/252). O histórico do DI1 cobre só as sessões já coletadas pelo pipeline.',
    formulas: [
      { tex: R`\Delta_{bp}(\tau) = 100\,\big[y_{t_1}(\tau) - y_{t_0}(\tau)\big]`, en: 'Change of the rate at vertex τ between the compared dates (rates in % p.a.).', pt: 'Variação da taxa no vértice τ entre as datas comparadas (taxas em % a.a.).' },
      { tex: R`\tau = du/252`, en: 'Business-year time to maturity.', pt: 'Prazo em anos úteis.' },
    ],
  },
  YAS: {
    en: 'Tesouro Direto bond pricing from the Tesouro Transparente rates (sell-back rate and PU), business days on the national holiday calendar (252 basis), compared with the B3 DI1 curve.',
    pt: 'Precificação dos títulos do Tesouro Direto a partir das taxas do Tesouro Transparente (taxa de venda e PU), dias úteis pelo calendário nacional (base 252), comparados com a curva DI1 da B3.',
    formulas: [
      { tex: R`PU_{LTN} = \frac{1000}{(1+y)^{du/252}}`, en: 'LTN (zero coupon).', pt: 'LTN (prefixado sem cupom).' },
      { tex: R`PU_{NTN\text{-}F} = \sum_{k} \frac{48{,}80885}{(1+y)^{du_k/252}} + \frac{1000}{(1+y)^{du_n/252}}`, en: 'NTN-F: 10% p.a. coupon paid half-yearly (Jan 1, Jul 1).', pt: 'NTN-F: cupom de 10% a.a. pago semestralmente (1/jan, 1/jul).' },
      { tex: R`PU_{LFT} = \frac{VNA}{(1+s)^{du/252}}`, en: 'LFT: VNA implied by the price; s = spread.', pt: 'LFT: VNA implícito no preço; s = spread.' },
    ],
  },
  DRSK: {
    en: 'Merton (1974) distance-to-default with a 1-year horizon. Equity = market cap; equity volatility = annualized 252-session volatility; default point = short-term debt + 0.5 × long-term debt (CVM balance sheet); r = CDI (continuous). Solves for asset value V and asset volatility σV. PD is risk-neutral. Banks are excluded.',
    pt: 'Distância até o default de Merton (1974), horizonte de 1 ano. Equity = valor de mercado; vol do equity = vol anualizada de 252 pregões; ponto de default = dívida CP + 0,5 × dívida LP (balanço CVM); r = CDI (contínuo). Resolve o valor V e a vol σV dos ativos. PD neutra ao risco. Bancos excluídos.',
    formulas: [
      { tex: R`E = V N(d_1) - DP\, e^{-rT} N(d_2),\qquad \sigma_E E = N(d_1)\, \sigma_V V`, en: 'System solved for V and σV.', pt: 'Sistema resolvido para V e σV.' },
      { tex: R`DD = \frac{\ln(V/DP) + (r - \sigma_V^2/2)\,T}{\sigma_V \sqrt{T}},\qquad PD = N(-DD)`, en: 'Distance to default and probability of default.', pt: 'Distância até o default e probabilidade de default.' },
    ],
  },
  TAYL: {
    en: 'Taylor rule versus the actual policy rate. Parameters are inputs; defaults follow Taylor (1993), α = β = 0.5. Gap = output gap (US, CBO) or Okun × (NAIRU − unemployment).',
    pt: 'Regra de Taylor contra a taxa básica efetiva. Os parâmetros são editáveis; padrão de Taylor (1993), α = β = 0,5. Hiato = hiato do produto (EUA, CBO) ou Okun × (NAIRU − desemprego).',
    formulas: [
      { tex: R`i^{T} = r^{*} + \pi + \alpha(\pi - \pi^{*}) + \beta\,\text{gap}`, en: 'Taylor rate.', pt: 'Taxa de Taylor.' },
      { tex: R`i_t = \rho\, i_{t-1} + (1-\rho)\, i^{T}_t`, en: 'With inertia ρ.', pt: 'Com inércia ρ.' },
    ],
  },
  OMON: {
    en: 'Option chain end-of-day snapshot (not real time). Implied volatility and greeks from Black-Scholes (European) with the continuously compounded annualized CDI as the rate and business days/252 as time. Shaded rows are in the money.',
    pt: 'Grade de opções no fechamento (não é tempo real). Vol implícita e gregas por Black-Scholes (europeia), juro = CDI anualizado contínuo, prazo = dias úteis/252. Linhas sombreadas estão dentro do dinheiro.',
    formulas: [
      { tex: R`C = S N(d_1) - K e^{-rT} N(d_2),\quad d_{1,2} = \frac{\ln(S/K) + (r \pm \sigma^2/2)T}{\sigma\sqrt{T}}`, en: 'Call price; puts by put-call parity.', pt: 'Preço da call; puts pela paridade put-call.' },
    ],
  },
  VOL: {
    en: 'Historical volatility over rolling windows; the cone shows the historical distribution of each window over the full series, with the current value as a point.',
    pt: 'Volatilidade histórica em janelas móveis; o cone mostra a distribuição histórica de cada janela em toda a série, com o valor atual em destaque.',
    formulas: [{ tex: R`\sigma_{ann} = \sqrt{252}\;\mathrm{sd}\!\left(\ln\frac{P_t}{P_{t-1}}\right)`, en: 'Annualized standard deviation of daily log returns.', pt: 'Desvio-padrão anualizado dos retornos log diários.' }],
  },
  BETA: {
    en: "OLS regression of the asset's returns on the index. Default: weekly returns, 2 years.",
    pt: 'Regressão MQO dos retornos do ativo contra o índice. Padrão: retornos semanais, 2 anos.',
    formulas: [
      { tex: R`R_a = \alpha + \beta R_m + \varepsilon,\qquad \hat\beta = \frac{\mathrm{Cov}(R_a,R_m)}{\mathrm{Var}(R_m)}`, en: 'Raw beta.', pt: 'Beta bruto.' },
      { tex: R`\beta_{adj} = 0.67\,\hat\beta + 0.33`, en: 'Blume adjustment.', pt: 'Ajuste de Blume.' },
    ],
  },
  DY: {
    en: '12-month dividend yield from distributions by ex-date (gross dividends + JCP) and the raw (unadjusted) price.',
    pt: 'Dividend yield 12m a partir dos proventos por data-ex (dividendos + JCP brutos) e do preço bruto (não ajustado).',
    formulas: [{ tex: R`DY_{12m}(t) = \frac{\sum_{t-12m < ex \le t} D_{ex}}{P_t}`, en: '', pt: '' }],
  },
  TRA: {
    en: 'Total return with distributions reinvested at the ex-date close; no taxes or costs.',
    pt: 'Retorno total com proventos reinvestidos no fechamento da data-ex; sem impostos ou custos.',
    formulas: [{ tex: R`u_{ex} = u_{ex^-}\left(1 + \frac{D}{P_{ex}}\right),\qquad TR_t = \frac{u_t P_t}{u_0 P_0} - 1`, en: 'Units grow at each distribution.', pt: 'As cotas crescem a cada provento.' }],
  },
  HS: {
    en: 'Spread/ratio between two assets with mean and ±1σ/±2σ bands, z-score and mean-reversion half-life from an AR(1) of the spread.',
    pt: 'Spread/razão entre dois ativos com média e bandas de ±1σ/±2σ, z-score e meia-vida de reversão por AR(1) do spread.',
    formulas: [
      { tex: R`z_t = \frac{x_t - \bar x}{\sigma_x}`, en: 'z-score of the ratio or difference.', pt: 'z-score da razão ou diferença.' },
      { tex: R`\Delta x_t = a + b\,x_{t-1} + e_t,\qquad t_{1/2} = -\frac{\ln 2}{\ln(1+b)}`, en: 'Half-life from the AR(1) coefficient.', pt: 'Meia-vida a partir do coeficiente do AR(1).' },
    ],
  },
  CORR: {
    en: 'Pearson correlation matrix of daily or weekly returns. Click a cell for the 63-session rolling correlation of the pair.',
    pt: 'Matriz de correlação de Pearson dos retornos diários ou semanais. Clique numa célula para a correlação móvel de 63 pregões do par.',
    formulas: [{ tex: R`\rho_{xy} = \frac{\sum (x_i-\bar x)(y_i-\bar y)}{\sqrt{\sum (x_i-\bar x)^2 \sum (y_i-\bar y)^2}}`, en: '', pt: '' }],
  },
  DES: {
    en: 'Company description from CVM registration data (FCA) and Yahoo Finance profile. Market cap = raw closing price × shares outstanding (CVM capital breakdown, all classes). Multiples use trailing 4-quarter earnings/EBITDA. For units (ticker ending in 11) the price is per unit, so shares are converted to equivalent units = (P_ON × ON + P_PN × PN) ÷ P_unit with the official B3 closes (COTAHIST). The last price is the official B3 close when the exchange has published it; the "As of" chip shows the reference date (green dot = official close). The line chart shows the last year of closes. US stocks: fundamentals come from SEC EDGAR (XBRL companyfacts of the 10-K/10-Q filings, US GAAP, in US$) and the share count from the cover of the latest 10-K/10-Q (all classes); when the four quarters are not available the latest fiscal year is used and labelled FYyyyy.',
    pt: 'Descrição da companhia a partir do cadastro CVM (FCA) e do perfil do Yahoo Finance. Valor de mercado = preço de fechamento bruto × ações em circulação (composição do capital CVM, todas as classes). Múltiplos usam lucro/EBITDA dos últimos 4 trimestres. Nas units (código terminado em 11) o preço é por unit, então as ações viram units equivalentes = (P_ON × ON + P_PN × PN) ÷ P_unit com os fechamentos oficiais da B3 (COTAHIST). O último preço é o fechamento oficial da B3 quando a bolsa já o publicou; o selo "Ref." mostra a data de referência (ponto verde = fechamento oficial). O gráfico mostra o último ano de fechamentos. Ações dos EUA: os fundamentos vêm da SEC EDGAR (XBRL companyfacts dos 10-K/10-Q, US GAAP, em US$) e o número de ações da capa do último 10-K/10-Q (todas as classes); sem os quatro trimestres, usa-se o último exercício fiscal, rotulado FYaaaa.',
    formulas: [
      { tex: R`MC = P \times N_{shares}`, en: 'Market capitalization.', pt: 'Valor de mercado.' },
      { tex: R`P/E = \frac{MC}{\sum_{4Q} NI},\qquad EV/EBITDA = \frac{MC + ND}{\sum_{4Q} EBITDA}`, en: 'Trailing multiples (NI = net income, ND = net debt).', pt: 'Múltiplos dos últimos 12 meses (NI = lucro líquido, ND = dívida líquida).' },
    ],
  },
  FUND: {
    en: 'Standardized financial statements. Brazil: CVM DFP (annual) and ITR (quarterly) filings, consolidated when available; Q4 = annual − 9-month year-to-date. US: SEC EDGAR XBRL companyfacts (10-K/10-Q, US GAAP). 10-Q cash flows are year-to-date, so a standalone quarter is the difference between consecutive year-to-date figures with the same start date; Q4 = fiscal year − 9 months. Quarter columns are labelled by the calendar quarter in which the fiscal period ends (Apple Q3 FY ending in late June → Q2). Only lines the company tags without dimensions are read; untagged lines show —, never estimated.',
    pt: 'Demonstrações padronizadas. Brasil: DFP (anual) e ITR (trimestral) da CVM, consolidadas quando existem; 4º tri = anual − 9 meses acumulados. EUA: XBRL companyfacts da SEC EDGAR (10-K/10-Q, US GAAP). O fluxo de caixa do 10-Q é acumulado no ano, então o trimestre isolado é a diferença entre acumulados consecutivos com a mesma data de início; 4º tri = exercício − 9 meses. As colunas trimestrais usam o trimestre civil em que o período fiscal termina (3º tri fiscal da Apple, encerrado no fim de junho → 2º tri). Só se leem as linhas que a empresa marca sem dimensões; linhas sem marcação aparecem como —, nunca estimadas.',
    formulas: [
      { tex: R`Q_k = YTD_k - YTD_{k-1},\qquad Q_4 = FY - YTD_{9M}`, en: 'Standalone quarter from year-to-date figures.', pt: 'Trimestre isolado a partir dos acumulados.' },
      { tex: R`EBITDA = EBIT + D\&A,\qquad ND = Debt - Cash - ST\ investments`, en: 'EBIT = operating income (US: pre-tax income + interest expense when operating income is not tagged); D&A from the cash-flow statement (US: depreciation + amortization of intangibles when the company tags no combined D&A, e.g. Microsoft).', pt: 'EBIT = resultado operacional (EUA: lucro antes dos impostos + despesa de juros quando o resultado operacional não é marcado); D&A da DFC (EUA: depreciação + amortização de intangíveis quando a empresa não marca um D&A agregado, ex.: Microsoft).' },
    ],
  },
  FA: {
    en: 'Full statements line by line. Brazil: CVM accounts (DFP/ITR) with their official codes. US: the main us-gaap lines of the 10-K/10-Q XBRL in a fixed layout (income statement, assets, liabilities and equity, cash flow), with the same year-to-date differencing as FUND. Δ annual compares with the previous year; in quarterly mode, with the same quarter a year earlier.',
    pt: 'Demonstrações completas, linha a linha. Brasil: contas da CVM (DFP/ITR) com os códigos oficiais. EUA: as principais linhas us-gaap do XBRL dos 10-K/10-Q num layout fixo (DRE, ativo, passivo e patrimônio, fluxo de caixa), com a mesma diferença de acumulados do FUND. Δ anual compara com o ano anterior; no modo trimestral, com o mesmo trimestre do ano anterior.',
  },
  VAL: {
    en: 'Current multiples computed from the raw close × shares outstanding (Brazil: CVM capital breakdown; US: cover of the latest 10-K/10-Q) and trailing 4-quarter results (latest fiscal year when 4 quarters are missing). The history applies, at each date, the results already published (assumed 45 days after quarter end). Peers: same B3 subsector (Brazil) or Yahoo industry (US), widened to the sector when there are fewer than 2.',
    pt: 'Múltiplos atuais calculados com o fechamento bruto × ações em circulação (Brasil: composição do capital na CVM; EUA: capa do último 10-K/10-Q) e o resultado dos últimos 4 trimestres (último exercício quando faltam trimestres). O histórico aplica, em cada data, os resultados já publicados (supostos 45 dias após o fim do trimestre). Pares: mesmo subsetor B3 (Brasil) ou indústria do Yahoo (EUA), ampliado para o setor quando há menos de 2.',
    formulas: [{ tex: R`P/E = \frac{MC}{\sum_{4Q} NI},\quad P/B = \frac{MC}{Equity},\quad EV = MC + ND + NCI`, en: 'NCI = non-controlling interests.', pt: 'NCI = participação de não controladores.' }],
  },
  RV: {
    en: 'Relative valuation against peers. Brazil: Ibovespa companies in the same B3 subsector (stocks outside the index show NA). US: covered US stocks in the same Yahoo industry, with fundamentals from SEC filings. Widened to the sector when there are fewer than 3 peers. Green/red = better/worse than the peer median.',
    pt: 'Valuation relativo contra pares. Brasil: empresas do Ibovespa no mesmo subsetor B3 (ações fora do índice aparecem como NA). EUA: ações americanas cobertas na mesma indústria do Yahoo, com fundamentos dos documentos da SEC. Ampliado para o setor quando há menos de 3 pares. Verde/vermelho = melhor/pior que a mediana dos pares.',
  },
  GLCO: {
    en: 'Global commodity futures: front-month continuous contracts from Yahoo Finance (ticker =F), delayed daily close. Changes use closes; 52w = 52-week low/high range. Click a row for the chart.',
    pt: 'Futuros de commodities globais: contrato contínuo de primeiro vencimento do Yahoo Finance (ticker =F), fechamento diário com atraso. Variações sobre o fechamento; 52s = faixa mínima/máxima de 52 semanas. Clique numa linha para o gráfico.',
    formulas: [
      { tex: R`\Delta_{k} = \frac{P_t}{P_{t-k}} - 1`, en: 'Change over period k (1D, 1W, 1M, YTD, 1Y).', pt: 'Variação no período k (1D, 1S, 1M, YTD, 1A).' },
      { tex: R`\text{52w Low} = \min_{t-52w < s \le t} P_s,\quad \text{52w High} = \max_{t-52w < s \le t} P_s`, en: '52-week range on daily closes.', pt: 'Faixa de 52 semanas nos fechamentos diários.' },
    ],
  },
  WFI: {
    en: 'World fixed income: the US Treasury par yield curve straight from the US Treasury daily CSV (home.treasury.gov; FRED H.15 only as a fallback), OECD long-term sovereign rates (monthly averages from the OECD SDMX API), ICE BofA total-return and OAS indices (FRED) and Selic/CDI (BCB). Changes compare the latest value with 1 week, 1 month and 1 year ago. On the curve chart the tenors are evenly spaced (categorical axis), so the short end is readable; the slope between two points is therefore not to scale. The 1M yield is pinned near the Fed funds target, so curves from different dates often start at almost the same point.',
    pt: 'Renda fixa global: curva de taxas par dos Treasuries direto do CSV diário do Tesouro dos EUA (home.treasury.gov; o H.15 do FRED só como reserva), juros soberanos de longo prazo da OCDE (médias mensais, pela API SDMX da OCDE), índices ICE BofA de retorno total e OAS (FRED) e Selic/CDI (BCB). As variações comparam o último valor com 1 semana, 1 mês e 1 ano atrás. No gráfico da curva os vértices ficam igualmente espaçados (eixo categórico), para o trecho curto ser legível; a inclinação entre dois pontos, portanto, não está em escala. A taxa de 1 mês fica presa perto da meta dos Fed funds, por isso curvas de datas diferentes costumam começar quase no mesmo ponto.',
    formulas: [{ tex: R`\Delta_{bp} = 100\,(y_t - y_{t-k})`, en: 'Yield change in basis points.', pt: 'Variação da taxa em pontos-base.' }],
  },
  WB: {
    en: 'World bonds: sovereign yields by country and tenor from each official publisher: US Treasury, Bank of Canada, Bundesbank, Bank of England, Japan MoF, RBA and Tesouro Direto (Brazil, local fixed-rate curve interpolated by maturity). Other countries (e.g. Colombia, Mexico, Chile, euro area members) come from the OECD SDMX API as monthly averages of the 10-year yield. The D/M badge shows the frequency: D = daily close; M = monthly average (1D/1W changes are blank and the latest month appears a few weeks after it ends).',
    pt: 'Títulos soberanos: taxas por país e prazo, cada uma do publicador oficial: Tesouro dos EUA, Bank of Canada, Bundesbank, Bank of England, Ministério das Finanças do Japão, RBA e Tesouro Direto (Brasil, curva prefixada local interpolada pelo prazo). Os demais países (ex.: Colômbia, México, Chile, países do euro) vêm da API SDMX da OCDE como média mensal da taxa de 10 anos. O selo D/M indica a frequência: D = fechamento diário; M = média mensal (variações de 1D/1S ficam em branco e o último mês aparece algumas semanas depois de terminar).',
    formulas: [{ tex: R`\Delta_{bp} = 100\,(y_t - y_{t-k})`, en: 'Change in basis points versus k days/months ago.', pt: 'Variação em pontos-base contra k dias/meses atrás.' }],
  },
  BEIR: {
    en: 'Breakeven (implied) inflation for Brazil: the inflation rate that makes a fixed-rate (prefixado) bond and an inflation-linked IPCA+ bond of the same maturity pay the same. For each IPCA+ maturity (NTN-B Principal, or NTN-B with coupons) the fixed-rate curve built from LTN and NTN-F is interpolated linearly at the same number of years (never extrapolated), then the Fisher relation is applied. Standard tenors (3Y, 5Y, 7Y, 10Y) interpolate both curves. Data: Tesouro Direto daily rates (Tesouro Transparente open data). Read it as the market\'s inflation compensation: it also contains an inflation-risk premium and liquidity effects, so it tends to sit above survey forecasts such as Focus.',
    pt: 'Inflação implícita (breakeven) no Brasil: a inflação que iguala o retorno de um título prefixado e de um título IPCA+ do mesmo vencimento. Para cada vencimento IPCA+ (NTN-B Principal, ou NTN-B com cupom) a curva prefixada montada com LTN e NTN-F é interpolada linearmente no mesmo prazo em anos (sem extrapolar) e aplica-se a relação de Fisher. Os prazos-padrão (3, 5, 7 e 10 anos) interpolam as duas curvas. Dados: taxas diárias do Tesouro Direto (dados abertos do Tesouro Transparente). Leia como a compensação de inflação do mercado: inclui prêmio de risco de inflação e efeitos de liquidez, por isso costuma ficar acima de projeções como as do Focus.',
    formulas: [
      { tex: R`(1+i_{pre}) = (1+r_{real})(1+\pi^{e})\;\Rightarrow\;\pi^{e} = \frac{1+i_{pre}}{1+r_{real}} - 1`, en: 'Fisher relation: i = fixed rate, r = IPCA+ real rate, π = breakeven inflation (all % p.a.).', pt: 'Relação de Fisher: i = taxa prefixada, r = taxa real IPCA+, π = inflação implícita (tudo em % a.a.).' },
      { tex: R`i_{pre}(T) = i_k + \frac{T - T_k}{T_{k+1} - T_k}\,(i_{k+1} - i_k)`, en: 'Linear interpolation of the fixed-rate curve at the IPCA+ maturity T (years).', pt: 'Interpolação linear da curva prefixada no vencimento T (anos) do título IPCA+.' },
    ],
  },
  USMM: {
    en: 'US money market: the New York Fed reference rates. SOFR (Treasury repo, broad), TGCR and BGCR (general-collateral repo subsets), EFFR (federal funds) and OBFR (fed funds + eurodollar). Each rate is the volume-weighted median of the day\'s transactions; P1–P99 are volume-weighted percentiles, so P99 − P1 measures dispersion (it widens around month-ends, tax dates and Treasury settlements). The FOMC target range is the band the Fed steers EFFR into. SOFR averages compound the daily rate over 30/90/180 days and the SOFR Index compounds it since 2018-04-02.',
    pt: 'Mercado monetário dos EUA: taxas de referência do Fed de Nova York. SOFR (compromissadas com Treasuries, ampla), TGCR e BGCR (subconjuntos de colateral geral), EFFR (fed funds) e OBFR (fed funds + eurodólar). Cada taxa é a mediana ponderada por volume das operações do dia; P1–P99 são percentis ponderados por volume, então P99 − P1 mede a dispersão (abre em fins de mês, datas de impostos e liquidações do Tesouro). A banda-alvo do FOMC é o intervalo em que o Fed conduz a EFFR. As médias SOFR compõem a taxa diária em 30/90/180 dias e o Índice SOFR compõe desde 02/04/2018.',
    formulas: [
      { tex: R`\text{SOFR Avg}_{n} = \left[\prod_{i}\left(1 + \frac{SOFR_i\,d_i}{360}\right) - 1\right]\frac{360}{N}`, en: 'Compounded average over N calendar days (d_i = days each rate applies).', pt: 'Média composta em N dias corridos (d_i = dias em que cada taxa vale).' },
      { tex: R`\text{spread} = 100\,(SOFR - EFFR)\ \text{bp}`, en: 'Positive when repo trades above fed funds (collateral/reserve scarcity).', pt: 'Positivo quando a compromissada fica acima do fed funds (escassez de reservas/colateral).' },
    ],
  },
  CBR: {
    en: 'Central bank policy rates for about 40 economies from the BIS (Bank for International Settlements) WS_CBPOL dataset. The map is a cartogram: each tile is one central bank placed roughly where it is on a world map, coloured by the current rate or by its change over 3 months / 1 year (red = tightening, blue = easing). The table shows the last move found in the daily series. Click a tile or a row to chart its history against any other bank. For some countries the BIS uses the closest available official rate (e.g. the main refinancing rate for the ECB, the upper bound of the target range for the Fed).',
    pt: 'Juros básicos de cerca de 40 economias, do conjunto WS_CBPOL do BIS (Banco de Compensações Internacionais). O mapa é um cartograma: cada célula é um banco central posicionado aproximadamente onde está no mapa-múndi, colorido pela taxa atual ou pela variação em 3 meses / 1 ano (vermelho = aperto, azul = afrouxamento). A tabela mostra o último movimento encontrado na série diária. Clique numa célula ou linha para ver o histórico contra outro banco. Para alguns países o BIS usa a taxa oficial mais próxima (ex.: taxa de refinanciamento principal do BCE, teto da banda do Fed).',
    formulas: [{ tex: R`\Delta_{k}\,(\text{bp}) = 100\,(r_t - r_{t-k})`, en: 'Change versus k months ago.', pt: 'Variação contra k meses atrás.' }],
  },
  CRYP: {
    en: 'Crypto monitor: the 50 largest coins by market capitalisation (CoinGecko), the total market and BTC/ETH dominance, the Crypto Fear & Greed Index (alternative.me: a 0–100 sentiment score built from volatility, momentum/volume, social media, dominance and search trends) and total value locked in DeFi protocols by chain (DefiLlama). Stablecoins appear in the list because they are part of the market cap. Snapshot at each data update: crypto trades 24/7, so prices move between updates.',
    pt: 'Monitor de cripto: as 50 maiores moedas por valor de mercado (CoinGecko), o mercado total e a dominância de BTC/ETH, o Índice Fear & Greed de cripto (alternative.me: nota de 0 a 100 de sentimento, feita de volatilidade, momento/volume, redes sociais, dominância e buscas) e o valor total travado em protocolos DeFi por blockchain (DefiLlama). Stablecoins aparecem na lista porque fazem parte do valor de mercado. Foto a cada atualização dos dados: cripto negocia 24/7, então os preços mudam entre atualizações.',
    formulas: [
      { tex: R`\text{Dom}_{BTC} = \frac{MC_{BTC}}{\sum_j MC_j},\quad MC_j = P_j \times Q^{circ}_j`, en: 'Dominance = share of total market cap; market cap = price × circulating supply.', pt: 'Dominância = fatia do valor de mercado total; valor de mercado = preço × oferta em circulação.' },
      { tex: R`\text{vs ATH} = \frac{P_t}{P_{max}} - 1`, en: 'Distance from the all-time high.', pt: 'Distância da máxima histórica.' },
    ],
  },
  EQS: {
    en: 'Equity screener over Ibovespa stocks. Fundamentals: last 12 months (sum of 4 quarters) from each company\'s latest ITR/DFP; equity and debt from the latest balance sheet.',
    pt: 'Screener de ações do Ibovespa. Fundamentos: últimos 12 meses (soma de 4 trimestres) do ITR/DFP mais recente; patrimônio e dívida do último balanço.',
    formulas: [
      { tex: R`MC \approx P_{classe} \times N_{ex\text{-}tesouraria}`, en: 'Approximation when share classes have different prices.', pt: 'Aproximação quando as classes têm preços diferentes.' },
      { tex: R`DY = \frac{\sum_{12m} D}{P},\quad ROE = \frac{\sum_{4Q} NI}{BV}`, en: '', pt: '' },
    ],
  },
  PORT: {
    en: 'Portfolio simulation without costs, taxes or slippage, saved only in your browser.',
    pt: 'Simulação de carteira sem custos, impostos ou slippage, salva só no seu navegador.',
    formulas: [{ tex: R`\text{Sharpe} = \frac{R_{ann} - CDI_{ann}}{\sigma_{ann}}`, en: '', pt: '' }],
  },
  FXFC: {
    en: 'BRL/USD forecasts: Focus survey medians (monthly averages for monthly references, year-end for annual) versus the theoretical covered-interest-parity forward from DI1 and US Treasury yields (not a traded onshore forward).',
    pt: 'Projeções de BRL/USD: medianas do Focus (média mensal para referências mensais, fim de ano para anuais) contra o forward teórico por paridade coberta de juros com DI1 e Treasuries (não é um forward negociado).',
    formulas: [{ tex: R`F_\tau = S\,\frac{(1+i_{BRL})^{\tau}}{(1+i_{USD})^{\tau}}`, en: 'Covered interest parity.', pt: 'Paridade coberta de juros.' }],
  },
}
