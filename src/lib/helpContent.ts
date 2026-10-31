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
    en: 'Line chart of the daily close (adjusted for distributions and splits) with traded volume in the lower pane. The axis label marks the latest close.',
    pt: 'Gráfico de linha do fechamento diário (ajustado por proventos e desdobramentos) com volume negociado no painel inferior. O rótulo no eixo marca o último fechamento.',
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
    en: 'Intraday chart from delayed bars (1-minute bars cover ~5–7 sessions; 5-minute bars ~60 days), Brasília time. VWAP accumulates from the session open.',
    pt: 'Gráfico intradiário com barras atrasadas (1 min cobre ~5–7 pregões; 5 min ~60 dias), horário de Brasília. O VWAP acumula desde a abertura.',
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
    en: 'Copom path implied by DI1 futures. Each DI1 settlement price is converted to a rate; forwards between expiries are flat; the implied CDI of each inter-meeting period is that period\'s average forward (flat-forward method). The implied rate is what the market prices in, not a forecast, and includes a term premium. Focus = median Selic per meeting from the market survey. History grows by one session per pipeline run.',
    pt: 'Trajetória do Copom implícita nos futuros DI1. Cada PU de ajuste vira taxa; os forwards entre vencimentos são constantes; o CDI implícito de cada período entre reuniões é o forward médio do período (método flat-forward). A taxa implícita é o que o mercado precifica, não uma projeção, e inclui prêmio de prazo. Focus = mediana da Selic por reunião na pesquisa de mercado. O histórico cresce uma sessão por execução do pipeline.',
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
    en: 'Yield curves: Brazilian DI1 (settlement), Tesouro Direto bonds (morning buy rate) and US Treasuries. Compare two dates; the bar chart below shows each vertex\'s change in basis points (green = rate up, red = rate down). X axis in business years (bd/252). DI1 history only covers sessions already collected by the pipeline.',
    pt: 'Curvas de juros: DI1 (ajuste), títulos do Tesouro Direto (taxa de compra, manhã) e Treasuries. Compare duas datas; o gráfico de barras mostra a variação de cada vértice em pontos-base (verde = alta da taxa, vermelho = queda). Eixo X em anos úteis (du/252). O histórico do DI1 cobre só as sessões já coletadas pelo pipeline.',
    formulas: [
      { tex: R`\Delta_{bp}(\tau) = 100\,\big[y_{t_1}(\tau) - y_{t_0}(\tau)\big]`, en: 'Change of the rate at vertex τ between the compared dates (rates in % p.a.).', pt: 'Variação da taxa no vértice τ entre as datas comparadas (taxas em % a.a.).' },
      { tex: R`\tau = du/252`, en: 'Business-year time to maturity.', pt: 'Prazo em anos úteis.' },
    ],
  },
  YAS: {
    en: 'Tesouro Direto bond pricing from the published rates (sell-back rate and PU), business days on the national holiday calendar (252 basis), compared with the DI1 curve.',
    pt: 'Precificação dos títulos do Tesouro Direto a partir das taxas publicadas (taxa de venda e PU), dias úteis pelo calendário nacional (base 252), comparados com a curva DI1.',
    formulas: [
      { tex: R`PU_{LTN} = \frac{1000}{(1+y)^{du/252}}`, en: 'LTN (zero coupon).', pt: 'LTN (prefixado sem cupom).' },
      { tex: R`PU_{NTN\text{-}F} = \sum_{k} \frac{48{,}80885}{(1+y)^{du_k/252}} + \frac{1000}{(1+y)^{du_n/252}}`, en: 'NTN-F: 10% p.a. coupon paid half-yearly (Jan 1, Jul 1).', pt: 'NTN-F: cupom de 10% a.a. pago semestralmente (1/jan, 1/jul).' },
      { tex: R`PU_{LFT} = \frac{VNA}{(1+s)^{du/252}}`, en: 'LFT: VNA implied by the price; s = spread.', pt: 'LFT: VNA implícito no preço; s = spread.' },
    ],
  },
  DRSK: {
    en: 'Merton (1974) distance-to-default with a 1-year horizon. Equity = market cap; equity volatility = annualized 252-session volatility; default point = short-term debt + 0.5 × long-term debt (latest balance sheet); r = CDI (continuous). Solves for asset value V and asset volatility σV. PD is risk-neutral. Banks are excluded.',
    pt: 'Distância até o default de Merton (1974), horizonte de 1 ano. Equity = valor de mercado; vol do equity = vol anualizada de 252 pregões; ponto de default = dívida CP + 0,5 × dívida LP (último balanço); r = CDI (contínuo). Resolve o valor V e a vol σV dos ativos. PD neutra ao risco. Bancos excluídos.',
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
    en: 'Company description from registration data and the company profile. Market cap = raw closing price × shares outstanding (capital breakdown, all classes). Multiples use trailing 4-quarter earnings/EBITDA. For units (ticker ending in 11) the price is per unit, so shares are converted to equivalent units = (P_ON × ON + P_PN × PN) ÷ P_unit with the official exchange closes. The last price is the official exchange close when the exchange has published it; the "As of" chip shows the reference date (green dot = official close). The line chart shows the last year of closes. US stocks: fundamentals come from the 10-K/10-Q filings (XBRL, US GAAP, in US$) and the share count from the cover of the latest 10-K/10-Q (all classes); when the four quarters are not available the latest fiscal year is used and labelled FYyyyy. Indices, currencies, commodities and crypto: profile and statistics from the daily series only. Returns = close ÷ the last close on or before the start date − 1; a period longer than the available history shows —. Year to date starts at the previous year's last close. Volatility = standard deviation of daily log returns over the last year × √252 (crypto trades every day: √365). Max drawdown = largest fall from a running peak of closes in the last year. Series with closes only (no open/high/low) show the 52-week high and low of closes. Crypto market data is shown only when its price is within 20% of the series' last close.',
    pt: 'Descrição da companhia a partir dos dados cadastrais e do perfil da empresa. Valor de mercado = preço de fechamento bruto × ações em circulação (composição do capital, todas as classes). Múltiplos usam lucro/EBITDA dos últimos 4 trimestres. Nas units (código terminado em 11) o preço é por unit, então as ações viram units equivalentes = (P_ON × ON + P_PN × PN) ÷ P_unit com os fechamentos oficiais da bolsa. O último preço é o fechamento oficial da bolsa quando a bolsa já o publicou; o selo "Ref." mostra a data de referência (ponto verde = fechamento oficial). O gráfico mostra o último ano de fechamentos. Ações dos EUA: os fundamentos vêm dos 10-K/10-Q (XBRL, US GAAP, em US$) e o número de ações da capa do último 10-K/10-Q (todas as classes); sem os quatro trimestres, usa-se o último exercício fiscal, rotulado FYaaaa. Índices, moedas, commodities e cripto: perfil e estatísticas só da série diária. Retorno = fechamento ÷ último fechamento em ou antes da data inicial − 1; prazo maior que o histórico disponível aparece como —. O retorno no ano parte do último fechamento do ano anterior. Volatilidade = desvio-padrão dos log-retornos diários do último ano × √252 (cripto negocia todos os dias: √365). Queda máxima = maior queda a partir do pico acumulado dos fechamentos no último ano. Séries só com fechamento (sem abertura/máxima/mínima) mostram a máxima e a mínima de 52 semanas dos fechamentos. Os dados de mercado de cripto só aparecem quando o preço está a até 20% do último fechamento da série.',
    formulas: [
      { tex: R`MC = P \times N_{shares}`, en: 'Market capitalization.', pt: 'Valor de mercado.' },
      { tex: R`P/E = \frac{MC}{\sum_{4Q} NI},\qquad EV/EBITDA = \frac{MC + ND}{\sum_{4Q} EBITDA}`, en: 'Trailing multiples (NI = net income, ND = net debt).', pt: 'Múltiplos dos últimos 12 meses (NI = lucro líquido, ND = dívida líquida).' },
      { tex: R`\sigma = \sqrt{N}\,\mathrm{sd}\left(\ln \tfrac{P_t}{P_{t-1}}\right),\qquad MDD = \min_t \left(\tfrac{P_t}{\max_{s \le t} P_s} - 1\right)`, en: 'Annualized volatility (N = 252, crypto 365) and max drawdown (indices, currencies, commodities, crypto).', pt: 'Volatilidade anualizada (N = 252, cripto 365) e queda máxima (índices, moedas, commodities, cripto).' },
    ],
  },
  FUND: {
    en: 'Standardized financial statements. Brazil: DFP (annual) and ITR (quarterly) filings, consolidated when available; Q4 = annual − 9-month year-to-date. US: XBRL of the 10-K/10-Q filings (US GAAP). 10-Q cash flows are year-to-date, so a standalone quarter is the difference between consecutive year-to-date figures with the same start date; Q4 = fiscal year − 9 months. Quarter columns are labelled by the calendar quarter in which the fiscal period ends (Apple Q3 FY ending in late June → Q2). Only lines the company tags without dimensions are read; untagged lines show —, never estimated.',
    pt: 'Demonstrações padronizadas. Brasil: DFP (anual) e ITR (trimestral), consolidadas quando existem; 4º tri = anual − 9 meses acumulados. EUA: XBRL dos 10-K/10-Q (US GAAP). O fluxo de caixa do 10-Q é acumulado no ano, então o trimestre isolado é a diferença entre acumulados consecutivos com a mesma data de início; 4º tri = exercício − 9 meses. As colunas trimestrais usam o trimestre civil em que o período fiscal termina (3º tri fiscal da Apple, encerrado no fim de junho → 2º tri). Só se leem as linhas que a empresa marca sem dimensões; linhas sem marcação aparecem como —, nunca estimadas.',
    formulas: [
      { tex: R`Q_k = YTD_k - YTD_{k-1},\qquad Q_4 = FY - YTD_{9M}`, en: 'Standalone quarter from year-to-date figures.', pt: 'Trimestre isolado a partir dos acumulados.' },
      { tex: R`EBITDA = EBIT + D\&A,\qquad ND = Debt - Cash - ST\ investments`, en: 'EBIT = operating income (US: pre-tax income + interest expense when operating income is not tagged); D&A from the cash-flow statement (US: depreciation + amortization of intangibles when the company tags no combined D&A, e.g. Microsoft).', pt: 'EBIT = resultado operacional (EUA: lucro antes dos impostos + despesa de juros quando o resultado operacional não é marcado); D&A da DFC (EUA: depreciação + amortização de intangíveis quando a empresa não marca um D&A agregado, ex.: Microsoft).' },
    ],
  },
  FA: {
    en: 'Full statements line by line. Brazil: DFP/ITR accounts with their official codes. US: the main us-gaap lines of the 10-K/10-Q XBRL in a fixed layout (income statement, assets, liabilities and equity, cash flow), with the same year-to-date differencing as FUND. Δ annual compares with the previous year; in quarterly mode, with the same quarter a year earlier.',
    pt: 'Demonstrações completas, linha a linha. Brasil: contas da DFP/ITR com os códigos oficiais. EUA: as principais linhas us-gaap do XBRL dos 10-K/10-Q num layout fixo (DRE, ativo, passivo e patrimônio, fluxo de caixa), com a mesma diferença de acumulados do FUND. Δ anual compara com o ano anterior; no modo trimestral, com o mesmo trimestre do ano anterior.',
  },
  VAL: {
    en: 'Current multiples computed from the raw close × shares outstanding (Brazil: capital breakdown; US: cover of the latest 10-K/10-Q) and trailing 4-quarter results (latest fiscal year when 4 quarters are missing). The history applies, at each date, the results already published (assumed 45 days after quarter end). Peers: same subsector (Brazil) or industry (US), widened to the sector when there are fewer than 2.',
    pt: 'Múltiplos atuais calculados com o fechamento bruto × ações em circulação (Brasil: composição do capital; EUA: capa do último 10-K/10-Q) e o resultado dos últimos 4 trimestres (último exercício quando faltam trimestres). O histórico aplica, em cada data, os resultados já publicados (supostos 45 dias após o fim do trimestre). Pares: mesmo subsetor (Brasil) ou indústria (EUA), ampliado para o setor quando há menos de 2.',
    formulas: [{ tex: R`P/E = \frac{MC}{\sum_{4Q} NI},\quad P/B = \frac{MC}{Equity},\quad EV = MC + ND + NCI`, en: 'NCI = non-controlling interests.', pt: 'NCI = participação de não controladores.' }],
  },
  RV: {
    en: 'Relative valuation against peers. Brazil: Ibovespa companies in the same subsector (stocks outside the index show NA). US: covered US stocks in the same industry, with fundamentals from their filings. Widened to the sector when there are fewer than 3 peers. Green/red = better/worse than the peer median.',
    pt: 'Valuation relativo contra pares. Brasil: empresas do Ibovespa no mesmo subsetor (ações fora do índice aparecem como NA). EUA: ações americanas cobertas na mesma indústria, com fundamentos dos documentos entregues. Ampliado para o setor quando há menos de 3 pares. Verde/vermelho = melhor/pior que a mediana dos pares.',
  },
  GLCO: {
    en: 'Global commodity futures: front-month continuous contracts, delayed daily close. Changes use closes; 52w = 52-week low/high range. Click a row for the chart.',
    pt: 'Futuros de commodities globais: contrato contínuo de primeiro vencimento, fechamento diário com atraso. Variações sobre o fechamento; 52s = faixa mínima/máxima de 52 semanas. Clique numa linha para o gráfico.',
    formulas: [
      { tex: R`\Delta_{k} = \frac{P_t}{P_{t-k}} - 1`, en: 'Change over period k (1D, 1W, 1M, YTD, 1Y).', pt: 'Variação no período k (1D, 1S, 1M, YTD, 1A).' },
      { tex: R`\text{52w Low} = \min_{t-52w < s \le t} P_s,\quad \text{52w High} = \max_{t-52w < s \le t} P_s`, en: '52-week range on daily closes.', pt: 'Faixa de 52 semanas nos fechamentos diários.' },
    ],
  },
  WFI: {
    en: 'World fixed income: the US Treasury par yield curve (daily), long-term sovereign rates (monthly averages), ICE BofA total-return and OAS indices and Selic/CDI. Changes compare the latest value with 1 week, 1 month and 1 year ago. On the curve chart the tenors are evenly spaced (categorical axis), so the short end is readable; the slope between two points is therefore not to scale. The 1M yield is pinned near the Fed funds target, so curves from different dates often start at almost the same point.',
    pt: 'Renda fixa global: curva de taxas par dos Treasuries (diária), juros soberanos de longo prazo (médias mensais), índices ICE BofA de retorno total e OAS e Selic/CDI. As variações comparam o último valor com 1 semana, 1 mês e 1 ano atrás. No gráfico da curva os vértices ficam igualmente espaçados (eixo categórico), para o trecho curto ser legível; a inclinação entre dois pontos, portanto, não está em escala. A taxa de 1 mês fica presa perto da meta dos Fed funds, por isso curvas de datas diferentes costumam começar quase no mesmo ponto.',
    formulas: [{ tex: R`\Delta_{bp} = 100\,(y_t - y_{t-k})`, en: 'Yield change in basis points.', pt: 'Variação da taxa em pontos-base.' }],
  },
  WB: {
    en: 'World bonds: sovereign yields by country and tenor, daily where an official daily curve exists (e.g. United States, Canada, Germany, United Kingdom, Japan, Australia and Brazil, the last a local fixed-rate curve interpolated by maturity). Other countries (e.g. Colombia, Mexico, Chile, euro area members) are monthly averages of the 10-year yield. The D/M badge shows the frequency: D = daily close; M = monthly average (1D/1W changes are blank and the latest month appears a few weeks after it ends).',
    pt: 'Títulos soberanos: taxas por país e prazo, diárias onde existe curva oficial diária (ex.: Estados Unidos, Canadá, Alemanha, Reino Unido, Japão, Austrália e Brasil, este com a curva prefixada local interpolada pelo prazo). Os demais países (ex.: Colômbia, México, Chile, países do euro) são médias mensais da taxa de 10 anos. O selo D/M indica a frequência: D = fechamento diário; M = média mensal (variações de 1D/1S ficam em branco e o último mês aparece algumas semanas depois de terminar).',
    formulas: [{ tex: R`\Delta_{bp} = 100\,(y_t - y_{t-k})`, en: 'Change in basis points versus k days/months ago.', pt: 'Variação em pontos-base contra k dias/meses atrás.' }],
  },
  BEIR: {
    en: 'Breakeven (implied) inflation for Brazil: the inflation rate that makes a fixed-rate (prefixado) bond and an inflation-linked IPCA+ bond of the same maturity pay the same. For each IPCA+ maturity (NTN-B Principal, or NTN-B with coupons) the fixed-rate curve built from LTN and NTN-F is interpolated linearly at the same number of years (never extrapolated), then the Fisher relation is applied. Standard tenors (3Y, 5Y, 7Y, 10Y) interpolate both curves. Data: daily Tesouro Direto rates. Read it as the market\'s inflation compensation: it also contains an inflation-risk premium and liquidity effects, so it tends to sit above survey forecasts such as Focus.',
    pt: 'Inflação implícita (breakeven) no Brasil: a inflação que iguala o retorno de um título prefixado e de um título IPCA+ do mesmo vencimento. Para cada vencimento IPCA+ (NTN-B Principal, ou NTN-B com cupom) a curva prefixada montada com LTN e NTN-F é interpolada linearmente no mesmo prazo em anos (sem extrapolar) e aplica-se a relação de Fisher. Os prazos-padrão (3, 5, 7 e 10 anos) interpolam as duas curvas. Dados: taxas diárias do Tesouro Direto. Leia como a compensação de inflação do mercado: inclui prêmio de risco de inflação e efeitos de liquidez, por isso costuma ficar acima de projeções como as do Focus.',
    formulas: [
      { tex: R`(1+i_{pre}) = (1+r_{real})(1+\pi^{e})\;\Rightarrow\;\pi^{e} = \frac{1+i_{pre}}{1+r_{real}} - 1`, en: 'Fisher relation: i = fixed rate, r = IPCA+ real rate, π = breakeven inflation (all % p.a.).', pt: 'Relação de Fisher: i = taxa prefixada, r = taxa real IPCA+, π = inflação implícita (tudo em % a.a.).' },
      { tex: R`i_{pre}(T) = i_k + \frac{T - T_k}{T_{k+1} - T_k}\,(i_{k+1} - i_k)`, en: 'Linear interpolation of the fixed-rate curve at the IPCA+ maturity T (years).', pt: 'Interpolação linear da curva prefixada no vencimento T (anos) do título IPCA+.' },
    ],
  },
  USMM: {
    en: 'US money market reference rates. SOFR (Treasury repo, broad), TGCR and BGCR (general-collateral repo subsets), EFFR (federal funds) and OBFR (fed funds + eurodollar). Each rate is the volume-weighted median of the day\'s transactions; P1–P99 are volume-weighted percentiles, so P99 − P1 measures dispersion (it widens around month-ends, tax dates and Treasury settlements). The FOMC target range is the band the Fed steers EFFR into. SOFR averages compound the daily rate over 30/90/180 days and the SOFR Index compounds it since 2018-04-02.',
    pt: 'Mercado monetário dos EUA: taxas de referência. SOFR (compromissadas com Treasuries, ampla), TGCR e BGCR (subconjuntos de colateral geral), EFFR (fed funds) e OBFR (fed funds + eurodólar). Cada taxa é a mediana ponderada por volume das operações do dia; P1–P99 são percentis ponderados por volume, então P99 − P1 mede a dispersão (abre em fins de mês, datas de impostos e liquidações do Tesouro). A banda-alvo do FOMC é o intervalo em que o Fed conduz a EFFR. As médias SOFR compõem a taxa diária em 30/90/180 dias e o Índice SOFR compõe desde 02/04/2018.',
    formulas: [
      { tex: R`\text{SOFR Avg}_{n} = \left[\prod_{i}\left(1 + \frac{SOFR_i\,d_i}{360}\right) - 1\right]\frac{360}{N}`, en: 'Compounded average over N calendar days (d_i = days each rate applies).', pt: 'Média composta em N dias corridos (d_i = dias em que cada taxa vale).' },
      { tex: R`\text{spread} = 100\,(SOFR - EFFR)\ \text{bp}`, en: 'Positive when repo trades above fed funds (collateral/reserve scarcity).', pt: 'Positivo quando a compromissada fica acima do fed funds (escassez de reservas/colateral).' },
    ],
  },
  CBR: {
    en: 'Central bank policy rates for about 40 economies. The map is a cartogram: each tile is one central bank placed roughly where it is on a world map, coloured by the current rate or by its change over 3 months / 1 year (red = tightening, blue = easing). The table shows the last move found in the daily series. Click a tile or a row to chart its history against any other bank. For some countries the closest available official rate is used (e.g. the main refinancing rate for the ECB, the upper bound of the target range for the Fed).',
    pt: 'Juros básicos de cerca de 40 economias. O mapa é um cartograma: cada célula é um banco central posicionado aproximadamente onde está no mapa-múndi, colorido pela taxa atual ou pela variação em 3 meses / 1 ano (vermelho = aperto, azul = afrouxamento). A tabela mostra o último movimento encontrado na série diária. Clique numa célula ou linha para ver o histórico contra outro banco. Para alguns países usa-se a taxa oficial mais próxima (ex.: taxa de refinanciamento principal do BCE, teto da banda do Fed).',
    formulas: [{ tex: R`\Delta_{k}\,(\text{bp}) = 100\,(r_t - r_{t-k})`, en: 'Change versus k months ago.', pt: 'Variação contra k meses atrás.' }],
  },
  LP: {
    en: 'Launchpad: two or four functions side by side on the desktop. Each panel is a full terminal, so type a function code or a ticker in its own bar and it updates there. Use the buttons in the strip to switch between 2 panels (side by side) and 4 panels (2 × 2) or reset to the starting set; the arrow on a panel opens it full screen. The layout is saved in this browser and written into the page address, so the share link reopens the same panels. On phones and narrow tablets the panels become tabs, one at a time. Colours follow the theme chosen in Settings (amber, phosphor green, high contrast or light, with an optional colour-blind safe blue/orange for up/down).',
    pt: 'Launchpad: duas ou quatro funções lado a lado no desktop. Cada painel é um terminal completo: digite um código de função ou um ativo na barra dele e ele muda ali mesmo. Use os botões da faixa para alternar entre 2 painéis (lado a lado) e 4 painéis (2 × 2) ou restaurar o conjunto inicial; a seta de cada painel abre em tela cheia. O layout fica salvo neste navegador e no endereço da página, então o link de compartilhamento reabre os mesmos painéis. No celular e em tablets estreitos os painéis viram abas, um por vez. As cores seguem o tema escolhido nas Configurações (âmbar, verde fósforo, alto contraste ou claro, com opção de azul/laranja seguro para daltonismo nas altas/baixas).',
  },
  CRYP: {
    en: 'Crypto monitor: the 50 largest coins by market capitalisation, the total market and BTC/ETH dominance, the Crypto Fear & Greed Index (a 0–100 sentiment score built from volatility, momentum/volume, social media, dominance and search trends) and total value locked in DeFi protocols by chain. Stablecoins appear in the list because they are part of the market cap. Snapshot at each data update: crypto trades 24/7, so prices move between updates.',
    pt: 'Monitor de cripto: as 50 maiores moedas por valor de mercado, o mercado total e a dominância de BTC/ETH, o Índice Fear & Greed de cripto (nota de 0 a 100 de sentimento, feita de volatilidade, momento/volume, redes sociais, dominância e buscas) e o valor total travado em protocolos DeFi por blockchain. Stablecoins aparecem na lista porque fazem parte do valor de mercado. Foto a cada atualização dos dados: cripto negocia 24/7, então os preços mudam entre atualizações.',
    formulas: [
      { tex: R`\text{Dom}_{BTC} = \frac{MC_{BTC}}{\sum_j MC_j},\quad MC_j = P_j \times Q^{circ}_j`, en: 'Dominance = share of total market cap; market cap = price × circulating supply.', pt: 'Dominância = fatia do valor de mercado total; valor de mercado = preço × oferta em circulação.' },
      { tex: R`\text{vs ATH} = \frac{P_t}{P_{max}} - 1`, en: 'Distance from the all-time high.', pt: 'Distância da máxima histórica.' },
    ],
  },
  MEMB: {
    en: 'Members of the Ibovespa from the official portfolio of the day: weight, sector and theoretical quantity of each stock. The index level is the sum of theoretical quantity × price divided by a reductor that the exchange adjusts so that rebalances and corporate events do not move the index. From that, each stock\'s contribution in index points over a period is its quantity times its price change. The portfolio is rebalanced every four months (January, May, September). Effective N tells how many equal-weight stocks would give the same concentration.',
    pt: 'Ações do Ibovespa pela carteira oficial do dia: peso, setor e quantidade teórica de cada ação. O nível do índice é a soma de quantidade teórica × preço dividida por um redutor que a bolsa ajusta para que rebalanceamentos e eventos societários não mexam no índice. Daí, a contribuição de cada ação em pontos num período é a quantidade vezes a variação do preço. A carteira é rebalanceada a cada quatro meses (janeiro, maio, setembro). O N efetivo diz quantas ações de peso igual dariam a mesma concentração.',
    formulas: [
      { tex: R`I_t = \frac{\sum_i Q_i\,P_{i,t}}{R},\qquad w_i = \frac{Q_i P_{i,t}}{\sum_j Q_j P_{j,t}}`, en: 'Index level from theoretical quantities Q and the reductor R; weight of each member.', pt: 'Nível do índice pelas quantidades teóricas Q e o redutor R; peso de cada ação.' },
      { tex: R`\text{contrib}_i = \frac{Q_i\,(P_{i,t} - P_{i,t-k})}{R},\qquad \sum_i \text{contrib}_i \approx I_t - I_{t-k}`, en: 'Contribution in index points (exact while quantities are unchanged).', pt: 'Contribuição em pontos do índice (exata enquanto as quantidades não mudam).' },
      { tex: R`N_{ef} = \frac{1}{\sum_i w_i^2}`, en: 'Effective number of stocks (inverse Herfindahl).', pt: 'Número efetivo de ações (inverso do Herfindahl).' },
    ],
  },
  OVME: {
    en: 'Option valuation with Black-Scholes-Merton. Pick a listed series to load the end-of-day market inputs (spot, strike, business days to expiry, CDI as a continuous rate, implied vol and last premium), then change any field to run scenarios. The calculator returns the theoretical price, the greeks, the implied volatility that matches a premium (found by bisection) and checks put-call parity. The charts show value against the underlying today and at expiry, and the volatility smile of the expiry. The model assumes European exercise, constant volatility and rates, and lognormal prices.',
    pt: 'Precificação de opções por Black-Scholes-Merton. Escolha uma série listada para carregar os dados de fechamento (spot, strike, dias úteis até o vencimento, CDI como juro contínuo, vol implícita e último prêmio) e altere qualquer campo para simular cenários. A calculadora mostra o preço teórico, as gregas, a vol implícita que reproduz um prêmio (por bisseção) e confere a paridade put-call. Os gráficos mostram o valor contra o ativo hoje e no vencimento, e o smile de volatilidade do vencimento. O modelo supõe exercício europeu, vol e juros constantes e preços lognormais.',
    formulas: [
      { tex: R`C = S e^{-qT} N(d_1) - K e^{-rT} N(d_2),\quad P = K e^{-rT} N(-d_2) - S e^{-qT} N(-d_1)`, en: 'Call and put prices (q = dividend yield).', pt: 'Preços de call e put (q = dividend yield).' },
      { tex: R`d_{1,2} = \frac{\ln(S/K) + (r - q \pm \sigma^2/2)\,T}{\sigma\sqrt{T}},\qquad T = \frac{n_{du}}{252}`, en: 'T = business days (n_du) / 252, the local convention.', pt: 'T em dias úteis / 252, como na convenção local.' },
      { tex: R`\Delta_C = e^{-qT}N(d_1),\quad \Gamma = \frac{e^{-qT}\,\varphi(d_1)}{S\sigma\sqrt{T}},\quad \nu = S e^{-qT}\varphi(d_1)\sqrt{T}`, en: 'Delta, gamma and vega (shown per 1 percentage point of vol).', pt: 'Delta, gama e vega (mostrado por 1 ponto percentual de vol).' },
      { tex: R`C - P = S e^{-qT} - K e^{-rT}`, en: 'Put-call parity.', pt: 'Paridade put-call.' },
    ],
  },
  EVTS: {
    en: 'Corporate events drawn on the price chart: results releases, material facts (or other 8-K filings for US companies), dividend ex-dates and splits, plus the next expected results date from CAL. Each event links to the original filing. The day % column shows the close-to-close move on the event day, a quick way to see how the market reacted (it mixes the event with everything else that happened that day).',
    pt: 'Eventos corporativos desenhados sobre o gráfico de preço: divulgação de resultados, fatos relevantes (ou outros 8-K nas empresas dos EUA), datas ex de proventos e desdobramentos, além da próxima data esperada de resultados do CAL. Cada evento leva ao documento original. A coluna dia % mostra a variação de fechamento a fechamento no dia do evento, um jeito rápido de ver a reação do mercado (ela mistura o evento com tudo o mais que aconteceu no dia).',
    formulas: [{ tex: R`r_{evento} = \frac{P_{t}}{P_{t-1}} - 1`, en: 'Reaction on the first trading day on or after the event (adjusted closes).', pt: 'Reação no primeiro pregão na data do evento ou depois (fechamentos ajustados).' }],
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
  COT: {
    en: 'Commitments of Traders: how speculators are positioned in about 40 US futures markets (energy, metals, grains and softs, currencies, Treasuries, equity indices, VIX and crypto), from the Legacy futures-only report. Every Friday the regulator publishes the positions held on the previous Tuesday by large traders, split into non-commercial (funds and other speculators), commercial (producers, users and dealers hedging) and non-reportable (small traders). The table shows the speculators\' net position, its weekly change, its share of open interest and the COT index; click a row to chart the history of speculators and hedgers against open interest. Readings near 0 or 100 mean positioning is at a 3-year extreme, which traders watch as a crowding or contrarian signal, not a forecast.',
    pt: 'Commitments of Traders: como os especuladores estão posicionados em cerca de 40 mercados futuros dos EUA (energia, metais, grãos e softs, moedas, Treasuries, índices de ações, VIX e cripto), pelo relatório Legacy só de futuros. Toda sexta o regulador publica as posições de terça dos grandes participantes, divididas em não comerciais (fundos e outros especuladores), comerciais (produtores, usuários e dealers fazendo hedge) e não reportáveis (pequenos). A tabela mostra a posição líquida dos especuladores, a variação na semana, a fatia dos contratos em aberto e o índice COT; clique numa linha para ver o histórico de especuladores e hedgers contra os contratos em aberto. Leituras perto de 0 ou 100 indicam posicionamento no extremo de 3 anos, que o mercado acompanha como sinal de excesso ou contrário, não como previsão.',
    formulas: [
      { tex: R`\text{Net}_t = \text{Long}_t - \text{Short}_t`, en: 'Net position of a group, in contracts.', pt: 'Posição líquida de um grupo, em contratos.' },
      { tex: R`\text{COT}_t = 100\,\frac{\text{Net}_t - \min_{156}\text{Net}}{\max_{156}\text{Net} - \min_{156}\text{Net}}`, en: 'COT index: where the net sits in its range of the last 156 weeks (3 years).', pt: 'Índice COT: onde o líquido está na faixa das últimas 156 semanas (3 anos).' },
      { tex: R`\%\,\text{OI} = 100\,\frac{\text{Net}_t}{\text{OI}_t}`, en: 'Net position as a share of open interest.', pt: 'Líquido como fração dos contratos em aberto.' },
    ],
  },
  '13F': {
    en: 'Quarterly holdings of about 20 well-known US investment managers, read from their Form 13F-HR filings. Managers with more than $100 million in US-listed equities must file within 45 days after each quarter, so the data is a delayed snapshot. It lists long positions in US-listed stocks, ETFs, listed options and convertibles only: no short sales, cash, bonds or non-US assets, so it is not the full portfolio. Pick a manager to see its largest positions with their weight in the reported total and the change in shares versus the previous 13F (new, added, cut), plus the positions sold out. Consensus shows the stocks held by the most managers in this list. Puts and calls are shown separately and their value is that of the underlying shares. Managers whose latest 13F is too old or who stopped filing full holdings (13F-NT) are left out.',
    pt: 'Carteiras trimestrais de cerca de 20 gestores conhecidos dos EUA, lidas dos formulários 13F-HR. Gestores com mais de US$ 100 milhões em ações listadas nos EUA precisam entregar até 45 dias depois de cada trimestre, então o dado é uma foto atrasada. Mostra apenas posições compradas em ações, ETFs, opções listadas e conversíveis dos EUA: sem vendas a descoberto, caixa, títulos ou ativos fora dos EUA, então não é a carteira completa. Escolha um gestor para ver as maiores posições, com o peso no total informado e a variação no número de ações contra o 13F anterior (nova, aumentou, reduziu), além das posições zeradas. Consenso mostra as ações presentes em mais gestores da lista. Puts e calls aparecem separadas e o valor é o das ações-objeto. Gestores com 13F muito antigo ou que deixaram de entregar a carteira (13F-NT) ficam de fora.',
    formulas: [
      { tex: R`w_i = 100\,\frac{V_i}{\sum_j V_j}`, en: 'Weight of a position in the reported total.', pt: 'Peso de uma posição no total informado.' },
      { tex: R`\Delta_i = 100\,\frac{Q_{i,t} - Q_{i,t-1}}{Q_{i,t-1}}`, en: 'Change in shares versus the previous quarter.', pt: 'Variação no número de ações contra o trimestre anterior.' },
    ],
  },
  FIIM: {
    en: 'Monitor of Brazilian listed real-estate funds (FIIs). Fund data (net assets, NAV per unit, unitholders, monthly dividend yield, segment, administrator) come from the monthly report every FII files with the regulator; price and trading value are the official exchange close. Only funds with net assets above R$ 50 million and average daily trading above R$ 50 thousand over the last month of sessions are listed. P/NAV below 1 means the market price is under the book value per unit. The 12-month yield uses distributions derived from the reported yields, so it is only as accurate as each filing; the segment is the one the administrator declared. Click a fund to see its NAV per unit against today\'s price and the monthly distributions.',
    pt: 'Monitor dos FIIs listados. Os dados do fundo (PL, valor patrimonial da cota, cotistas, DY do mês, segmento, administrador) vêm do informe mensal que todo FII entrega ao regulador; preço e volume são o fechamento oficial da bolsa. Só entram fundos com PL acima de R$ 50 milhões e giro médio diário acima de R$ 50 mil no último mês de pregões. P/VP abaixo de 1 indica preço de mercado abaixo do valor patrimonial da cota. O DY 12m usa as distribuições derivadas do DY informado, então é tão preciso quanto cada informe; o segmento é o declarado pelo administrador. Clique num fundo para ver o VP da cota contra o preço de hoje e as distribuições mensais.',
    formulas: [
      { tex: R`P/VP = \frac{P}{PL / N_{cotas}}`, en: 'Price over NAV per unit.', pt: 'Preço sobre valor patrimonial da cota.' },
      { tex: R`d_m = DY_m \times VP_m`, en: 'Distribution per unit in month m, from the reported yield.', pt: 'Distribuição por cota no mês m, a partir do DY informado.' },
      { tex: R`DY_{12m} = 100\,\frac{\sum_{m=1}^{12} d_m}{P}`, en: '12-month yield on today\'s price.', pt: 'DY de 12 meses sobre o preço de hoje.' },
    ],
  },
  FNDS: {
    en: 'Ranking of Brazilian investment funds from the daily fund report (unit price, net assets, subscriptions, redemptions and unitholders of every fund class). Only open-ended, non-exclusive classes with net assets above R$ 300 million and at least 100 unitholders enter; the 60 largest per class (fixed income, multimarket, equity, FX) are listed. Returns are those of the unit price, net of fees and before income tax. Volatility is annualised from daily log returns over 12 months; maximum drawdown is the worst fall from a previous peak in the same window. Funds of funds and the funds they invest in both appear, so flows across rows may be double-counted.',
    pt: 'Ranking de fundos de investimento a partir do informe diário dos fundos (cota, PL, aplicações, resgates e cotistas de cada classe). Só entram classes abertas e não exclusivas com PL acima de R$ 300 milhões e pelo menos 100 cotistas; aparecem as 60 maiores de cada classe (renda fixa, multimercado, ações, cambial). Os retornos são da cota, líquidos de taxas e antes do imposto de renda. A volatilidade é anualizada a partir dos retornos log diários de 12 meses; o drawdown máximo é a pior queda a partir de um pico anterior na mesma janela. Fundos de cotas e os fundos em que investem aparecem juntos, então a captação pode ser contada duas vezes entre linhas.',
    formulas: [
      { tex: R`r_{t_0,t} = 100\left(\frac{Q_t}{Q_{t_0}} - 1\right)`, en: 'Return of the unit price between two dates.', pt: 'Retorno da cota entre duas datas.' },
      { tex: R`\sigma = \sqrt{252}\;\operatorname{sd}\!\left(\ln\frac{Q_t}{Q_{t-1}}\right)`, en: 'Annualised volatility (12 months).', pt: 'Volatilidade anualizada (12 meses).' },
      { tex: R`MDD = 100\,\min_t\left(\frac{Q_t}{\max_{s\le t} Q_s} - 1\right)`, en: 'Maximum drawdown (12 months).', pt: 'Drawdown máximo (12 meses).' },
      { tex: R`F = \sum_t (S_t - R_t)`, en: 'Net flow over the window: subscriptions S minus redemptions R.', pt: 'Captação líquida na janela: aplicações S menos resgates R.' },
    ],
  },
  BKS: {
    en: 'Panel of the 40 largest Brazilian prudential conglomerates by total assets: total assets, credit portfolio, funding, equity, net income, Basel ratio and fixed-asset ratio. The data is quarterly and comes out about three months after each quarter ends. Net income is accumulated within each half-year (a March or September figure covers 3 months; June or December, 6), so ROE is annualised accordingly. Segments S1–S5 are the proportional-regulation tiers. The chart shows the Basel ratio and the credit portfolio over the last quarters.',
    pt: 'Painel dos 40 maiores conglomerados prudenciais do Brasil por ativo total: ativo total, carteira de crédito, captações, patrimônio líquido, lucro líquido, índice de Basileia e índice de imobilização. Os dados são trimestrais e saem cerca de três meses depois do fim de cada trimestre. O lucro líquido é acumulado dentro de cada semestre (março ou setembro cobrem 3 meses; junho ou dezembro, 6), por isso o ROE é anualizado conforme o caso. Os segmentos S1–S5 são as faixas da regulação proporcional. O gráfico mostra o índice de Basileia e a carteira de crédito nos últimos trimestres.',
    formulas: [
      { tex: R`ROE = 100\,\frac{LL_{sem}\cdot 12/m}{PL}`, en: 'Annualised ROE; LL = net income accumulated in the half, m = months it covers (3 or 6), PL = equity.', pt: 'ROE anualizado; m = meses acumulados no semestre (3 ou 6).' },
      { tex: R`IB = 100\,\frac{PR}{RWA}`, en: 'Basel ratio (IB): regulatory capital (PR) over risk-weighted assets (RWA).', pt: 'Índice de Basileia (IB): patrimônio de referência (PR) sobre ativos ponderados pelo risco (RWA).' },
      { tex: R`g_{cred} = 100\left(\frac{C_t}{C_{t-4}} - 1\right)`, en: 'Credit growth over four quarters.', pt: 'Crescimento do crédito em quatro trimestres.' },
    ],
  },
  DCF: {
    en: 'Educational discounted cash flow. Free cash flow (operating cash flow minus capex) comes from the company\'s own filings: DFP/ITR for Brazilian companies and 10-K/10-Q for US companies, either the last 12 months (sum of 4 quarters), the last fiscal year or a 3-year average. Market inputs are data: the risk-free rate is the Brazilian fixed-rate government bond (Tesouro Prefixado) closest to 10 years, or the 10-year US Treasury; beta is the 2-year weekly regression against the benchmark index, Blume-adjusted; equity weight uses the market cap and debt weight the gross debt of the latest balance sheet. Everything else is an assumption you set (amber boxes): equity risk premium, pre-tax cost of debt, growth in years 1–5 and the perpetual growth rate; tax is the statutory rate (34% Brazil, 21% US). Growth fades linearly from g1 to g∞ in years 6–10 and the terminal value uses the Gordon formula. The reverse DCF shows the years 1–5 growth the current price implies. This is a teaching tool, not a price target: small changes in WACC or g∞ move the value a lot (see the sensitivity table). Banks and insurers are excluded because their cash flow does not separate operations from financing.',
    pt: 'Fluxo de caixa descontado educacional. O fluxo de caixa livre (caixa operacional menos capex) vem dos documentos da própria empresa: DFP/ITR para as brasileiras e 10-K/10-Q para as americanas, nos últimos 12 meses (soma de 4 trimestres), no último exercício ou na média de 3 anos. Os dados de mercado são reais: a taxa livre de risco é o Tesouro Prefixado mais próximo de 10 anos ou o Treasury de 10 anos dos EUA; o beta é a regressão semanal de 2 anos contra o índice de referência, ajustada por Blume; o peso do capital próprio usa o valor de mercado e o da dívida, a dívida bruta do último balanço. O resto são premissas suas (caixas âmbar): prêmio de risco de mercado, custo da dívida antes do IR, crescimento nos anos 1–5 e crescimento na perpetuidade; o IR é a alíquota nominal (34% Brasil, 21% EUA). O crescimento converge linearmente de g1 para g∞ nos anos 6–10 e o valor terminal usa a fórmula de Gordon. O DCF reverso mostra o crescimento nos anos 1–5 que o preço atual embute. É uma ferramenta didática, não um preço-alvo: pequenas mudanças no WACC ou no g∞ mexem muito no valor (veja a tabela de sensibilidade). Bancos e seguradoras ficam de fora porque o fluxo de caixa deles não separa operação de financiamento.',
    formulas: [
      { tex: R`FCF = CFO - \text{CapEx}`, en: 'Free cash flow to the firm (CFO = operating cash flow).', pt: 'Fluxo de caixa livre da firma (CFO = caixa operacional).' },
      { tex: R`K_e = R_f + \beta \cdot ERP,\qquad WACC = \frac{E}{D+E}K_e + \frac{D}{D+E}K_d(1-t)`, en: 'CAPM cost of equity and weighted average cost of capital (E = market cap, D = gross debt, t = tax rate).', pt: 'Custo do capital próprio pelo CAPM e custo médio ponderado de capital (E = valor de mercado, D = dívida bruta, t = alíquota de IR).' },
      { tex: R`EV = \sum_{t=1}^{10} \frac{FCF_t}{(1+WACC)^t} + \frac{TV}{(1+WACC)^{10}},\qquad TV = \frac{FCF_{10}(1+g_\infty)}{WACC - g_\infty}`, en: 'Enterprise value: present value of 10 years of cash flow plus the Gordon terminal value.', pt: 'Valor da firma: valor presente de 10 anos de fluxo mais o valor terminal de Gordon.' },
      { tex: R`V_{ps} = \frac{EV - ND - MI}{N}`, en: 'Value per share: EV minus net debt (ND) and minority interests (MI), over shares outstanding (N).', pt: 'Valor por ação (V_ps): EV menos dívida líquida (ND) e participação de minoritários (MI), dividido pelo número de ações (N).' },
    ],
  },
  OSA: {
    en: 'Option strategy builder on the listed options chain. Pick an expiry and a preset (long call or put, bull call or bear put spread, straddle, strangle, butterfly, iron condor, covered call, protective put) or edit the legs: side, type, strike, expiry and quantity. Premiums are the official closing trade of each series; a series that did not trade uses the bid/ask midpoint, or failing that a Black-Scholes value at the at-the-money implied vol (flagged in the Src column). The chart shows profit and loss at expiry and today, plus at a horizon you choose, valued with Black-Scholes using each leg\'s implied vol and the CDI as the risk-free rate. Breakevens, maximum gain and loss and the net greeks are computed on the curve. Costs, taxes, margin and early exercise are ignored.',
    pt: 'Montador de estratégias sobre a cadeia de opções listadas. Escolha um vencimento e uma estrutura pronta (compra de call ou put, trava de alta com calls ou de baixa com puts, straddle, strangle, borboleta, condor, venda coberta, put de proteção) ou edite as pernas: lado, tipo, strike, vencimento e quantidade. Os prêmios são o último negócio oficial de cada série; série sem negócio usa o meio entre compra e venda ou, na falta, o valor de Black-Scholes na vol implícita ATM (indicado na coluna Fonte). O gráfico mostra o resultado no vencimento e hoje, além de uma data que você escolhe, avaliado por Black-Scholes com a vol implícita de cada perna e o CDI como juro livre de risco. Pontos de equilíbrio, ganho e perda máximos e as gregas líquidas saem da curva. Custos, impostos, margem e exercício antecipado são ignorados.',
    formulas: [
      { tex: R`\Pi_T(S) = \sum_i s_i\,q_i\,\big(\max(0,\ \pm(S-K_i)) - p_i\big)`, en: 'Payoff at expiry: side s (+1 buy, −1 sell), quantity q, premium p; + for calls, − for puts.', pt: 'Resultado no vencimento: lado s (+1 compra, −1 venda), quantidade q, prêmio p; + para calls, − para puts.' },
      { tex: R`\Pi_t(S) = \sum_i s_i\,q_i\,\big(BS(S, K_i, T_i - t, r, \sigma_i) - p_i\big)`, en: 'Value before expiry with Black-Scholes at each leg\'s implied vol.', pt: 'Valor antes do vencimento por Black-Scholes na vol implícita de cada perna.' },
      { tex: R`\Delta_{net} = \sum_i s_i\,q_i\,\Delta_i,\qquad \Pi(S^*) = 0`, en: 'Net delta; breakevens S* are the zeros of the P&L curve.', pt: 'Delta líquido; os pontos de equilíbrio S* são os zeros da curva de resultado.' },
    ],
  },
  IVS: {
    en: 'Implied volatility smile and surface for the listed options, from the official end-of-day data. For each series that traded, the implied vol is the Black-Scholes vol that reproduces the closing premium, with the CDI as the risk-free rate and business days / 252. At each strike the out-of-the-money option is used (puts below the spot, calls from the spot up) because it is the more liquid one and carries no intrinsic value. The surface interpolates linearly between observed strikes of each expiry and never extrapolates: blank cells had no trades nearby. The term structure shows the at-the-money vol and the 90%–110% skew by expiry. Closing premiums and the spot close are not simultaneous, so thinly traded series are noisy; raise the minimum trades filter to clean them.',
    pt: 'Smile e superfície de volatilidade implícita das opções listadas, a partir dos dados oficiais de fechamento. Para cada série negociada, a vol implícita é a vol de Black-Scholes que reproduz o prêmio de fechamento, com o CDI como juro livre de risco e dias úteis / 252. Em cada strike usa-se a opção fora do dinheiro (puts abaixo do spot, calls a partir dele), que é a mais líquida e não carrega valor intrínseco. A superfície interpola linearmente entre os strikes observados de cada vencimento e nunca extrapola: células vazias não tiveram negócios por perto. A estrutura a termo mostra a vol ATM e o skew 90%–110% por vencimento. Prêmio e fechamento do ativo não são simultâneos, então séries pouco negociadas trazem ruído; aumente o filtro de negócios mínimos para limpar.',
    formulas: [
      { tex: R`BS(S, K, T, r, \sigma_{imp}) = p_{mercado}`, en: 'Implied vol: the σ that matches the market premium (bisection).', pt: 'Vol implícita: o σ que reproduz o prêmio de mercado (bisseção).' },
      { tex: R`m = \frac{K}{S},\qquad \sigma(m) = \sigma_a + (\sigma_b - \sigma_a)\frac{m - m_a}{m_b - m_a}`, en: 'Moneyness and linear interpolation between the two nearest observed strikes.', pt: 'Moneyness e interpolação linear entre os dois strikes observados mais próximos.' },
      { tex: R`\text{skew} = \sigma(0.9) - \sigma(1.1)`, en: 'Skew: vol at 90% moneyness minus vol at 110%.', pt: 'Skew: vol no moneyness de 90% menos a vol em 110%.' },
    ],
  },
}
