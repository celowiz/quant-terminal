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
      { tex: R`EBITDA = EBIT + D\&A,\qquad ND = Debt - Cash - ST\ investments`, en: 'EBIT = operating income (US: pre-tax income + interest expense when operating income is not tagged); D&A from the cash-flow statement.', pt: 'EBIT = resultado operacional (EUA: lucro antes dos impostos + despesa de juros quando o resultado operacional não é marcado); D&A da DFC.' },
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
    en: 'World fixed income: US Treasury constant-maturity yields, OECD long-term sovereign rates (monthly averages), ICE BofA total-return and OAS indices (FRED) and Selic/CDI (BCB). Changes compare the latest value with 1 week, 1 month and 1 year ago.',
    pt: 'Renda fixa global: Treasuries de maturidade constante, juros soberanos de longo prazo da OCDE (médias mensais), índices ICE BofA de retorno total e OAS (FRED) e Selic/CDI (BCB). As variações comparam o último valor com 1 semana, 1 mês e 1 ano atrás.',
    formulas: [{ tex: R`\Delta_{bp} = 100\,(y_t - y_{t-k})`, en: 'Yield change in basis points.', pt: 'Variação da taxa em pontos-base.' }],
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
