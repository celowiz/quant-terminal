/** Mapa PT → EN para textos que chegam do pipeline/dados em português (nomes de países, setores B3,
 *  commodities, indicadores, fontes). Usado com o idioma EN (padrão); em PT o texto original é mantido. */
import { lang } from './settings'

const MAP: Record<string, string> = {
  'Valores em R$. Trimestres de fluxo (DRE/DFC) derivados dos acumulados quando o ITR não traz o trimestre isolado; 4º tri = anual − 9 meses.': 'Values in R$. Flow quarters (income statement/cash flow) derived from cumulative figures when the ITR does not report the standalone quarter; Q4 = annual − 9 months.',
  'R$ mi': 'R$ mn',
  'Valor de mercado ≈ preço da classe × total de ações ex-tesouraria (aproximação quando ON e PN têm preços diferentes). DY = proventos pagos nos últimos 12 meses ÷ preço.': 'Market cap ≈ class price × shares outstanding ex-treasury (approximation when ON and PN trade at different prices). DY = distributions paid over the last 12 months ÷ price.',
  'CVM – DFP/ITR (resultado 12m = soma dos 4 últimos trimestres; balanço do último ITR), FCA (ticker→CNPJ), composição do capital; B3 – carteira do IBOV; Yahoo Finance – preço, volume, proventos 12m': 'CVM – DFP/ITR (12m earnings = sum of the last 4 quarters; balance sheet from the latest ITR), FCA (ticker→CNPJ), capital breakdown; B3 – IBOV portfolio; Yahoo Finance – price, volume, 12m distributions',
  'Demonstrações consolidadas (CVM DFP/ITR). 4º trimestre = anual − 9 meses acumulados. EBITDA = EBIT + D&A da DFC (método indireto).': 'Consolidated statements (CVM DFP/ITR). 4th quarter = annual − 9-month year-to-date. EBITDA = EBIT + D&A from the cash-flow statement (indirect method).',
  // países / regiões
  'Estados Unidos': 'United States', 'Alemanha': 'Germany', 'Japão': 'Japan', 'Reino Unido': 'United Kingdom', 'França': 'France',
  'Itália': 'Italy', 'Canadá': 'Canada', 'Espanha': 'Spain', 'Coreia do Sul': 'South Korea', 'México': 'Mexico', 'Suíça': 'Switzerland',
  'África do Sul': 'South Africa', 'Austrália': 'Australia', 'Brasil': 'Brazil', 'Américas': 'Americas', 'Ásia-Pacífico': 'Asia-Pacific',
  'Europa': 'Europe', 'Holanda': 'Netherlands', 'Suécia': 'Sweden', 'Noruega': 'Norway', 'Bélgica': 'Belgium', 'Áustria': 'Austria',
  'Portugal': 'Portugal', 'Irlanda': 'Ireland', 'Dinamarca': 'Denmark', 'Finlândia': 'Finland', 'Grécia': 'Greece', 'Polônia': 'Poland',
  'Nova Zelândia': 'New Zealand', 'Índia': 'India', 'Chile': 'Chile', 'Colômbia': 'Colombia', 'Israel': 'Israel', 'Turquia': 'Turkey',
  'Hungria': 'Hungary', 'República Tcheca': 'Czech Republic', 'Islândia': 'Iceland', 'Eslováquia': 'Slovakia', 'Eslovênia': 'Slovenia',
  'Letônia': 'Latvia', 'Lituânia': 'Lithuania', 'Estônia': 'Estonia', 'Luxemburgo': 'Luxembourg', 'China': 'China', 'Rússia': 'Russia',
  // setores / subsetores B3
  'Petróleo, Gás e Biocombustíveis': 'Oil, Gas & Biofuels', 'Petróleo e Gás': 'Oil & Gas', 'Materiais Básicos': 'Basic Materials',
  'Mats Básicos': 'Basic Materials', 'Bens Industriais': 'Industrials', 'Bens Indls': 'Industrials', 'Consumo não Cíclico': 'Consumer Staples',
  'Consumo Não Cíclico': 'Consumer Staples', 'Cons N Cíclico': 'Consumer Staples', 'Cons N  Básico': 'Consumer Staples', 'Cons N Básico': 'Consumer Staples',
  'Consumo Cíclico': 'Consumer Discretionary', 'Saúde': 'Health Care', 'Tecnologia da Informação': 'Information Technology',
  'Tec.Informação': 'Information Technology', 'Comunicações': 'Communications', 'Telecomunicação': 'Telecommunications',
  'Utilidade Pública': 'Utilities', 'Utilidade Públ': 'Utilities', 'Financeiro': 'Financials', 'Financeiro e Outros': 'Financials & Other',
  'Financ e Outros': 'Financials & Other', 'Outros': 'Other', 'Saúde/SM Hosp An.Diag': 'Health Care / Hospitals & Diagnostics',
  // commodities
  'Petróleo WTI': 'WTI Crude', 'Petróleo Brent': 'Brent Crude', 'Gás natural': 'Natural gas', 'Ouro': 'Gold', 'Prata': 'Silver',
  'Cobre': 'Copper', 'Platina': 'Platinum', 'Paládio': 'Palladium', 'Milho': 'Corn', 'Soja': 'Soybeans', 'Trigo': 'Wheat',
  'Café arábica': 'Arabica coffee', 'Açúcar nº 11': 'Sugar No. 11', 'Algodão': 'Cotton', 'Cacau': 'Cocoa', 'Suco de laranja': 'Orange juice',
  'Boi gordo': 'Live cattle', 'Gado vivo': 'Live cattle', 'Suíno magro': 'Lean hogs', 'Bezerro': 'Feeder cattle', 'Óleo de aquecimento': 'Heating oil',
  'Gasolina RBOB': 'RBOB gasoline', 'Energia': 'Energy', 'Metais': 'Metals', 'Metais preciosos': 'Precious metals', 'Metais industriais': 'Industrial metals',
  'Agrícolas': 'Agriculture', 'Pecuária': 'Livestock', 'Grãos': 'Grains', 'Softs': 'Softs',
  // indicadores (ECON / ECFC)
  'CPI EUA (índice)': 'US CPI (index)', 'Treasury 10 anos': '10-year Treasury', 'Dólar PTAX venda': 'USD PTAX (ask)',
  'Payroll (emprego não agrícola)': 'Nonfarm payrolls', 'índice': 'index', 'Taxa de desocupação (PNAD Contínua)': 'Unemployment rate (PNAD)',
  'IPCA – acumulado 12 meses': 'IPCA – 12-month', 'IBC-Br (índice dessazonalizado)': 'IBC-Br (seasonally adjusted index)',
  'IGP-M – variação mensal': 'IGP-M – monthly change', 'IPCA – acumulado 12 meses (% 12m) — BCB SGS 13522': 'IPCA – 12-month (% 12m) — BCB SGS 13522',
  'Balança comercial – saldo mensal': 'Trade balance – monthly', 'INPC – variação mensal': 'INPC – monthly change', 'IPCA – variação mensal': 'IPCA – monthly change',
  'Resultado primário setor público (12m, % PIB)': 'Public-sector primary balance (12m, % GDP)', 'Dívida bruta do governo geral (% PIB)': 'General government gross debt (% GDP)',
  'Balança comercial': 'Trade balance', 'Câmbio': 'BRL/USD', 'Investimento direto no país': 'Foreign direct investment', 'Dívida líquida do setor público': 'Public-sector net debt',
  'Resultado primário': 'Primary balance', 'Conta corrente': 'Current account', 'PIB Total': 'GDP', 'Selic': 'Selic',
  // fundos (ANB)
  'Renda Fixa': 'Fixed Income', 'Ações': 'Equities', 'Multimercado': 'Multimarket', 'Cambial': 'FX', 'Participações (FIP)': 'Private Equity (FIP)',
  'Não classificado': 'Unclassified', 'R$ milhões': 'R$ millions', 'Previdência': 'Pension', 'Imobiliário (FII)': 'Real Estate (FII)', 'Direitos Creditórios (FIDC)': 'Receivables (FIDC)',
  // acionistas (HDS)
  'Multimercados': 'Multimarket', 'Diversos': 'Miscellaneous', 'Resultado nominal': 'Nominal balance', 'Linha': 'Line',
  'Ações Tesouraria': 'Treasury shares', 'União Federal': 'Federal Government',
  // DES
  'ATIVO': 'ACTIVE',
  // comércio exterior (ECTR)
  'Coffee, tea, maté and spices': 'Coffee, tea, mate and spices', 'Curaçao': 'Curacao',
  // fontes/notas vindas do pipeline
  'B3 – Boletim Diário de Mercado, Negócios Consolidados – Derivativos (preço e taxa de ajuste do DI1); BCB – calendário do Copom, SGS 4389 (CDI a.a.) e 432 (Selic meta), Focus por reunião (Olinda)':
    'B3 – Daily Market Bulletin, Consolidated Trades – Derivatives (DI1 settlement price and rate); BCB – Copom calendar, SGS 4389 (CDI p.a.) and 432 (Selic target), Focus by meeting (Olinda)',
  'FRED (US Treasury constant maturity, OCDE long-term rates, índices ICE BofA total return e OAS); BCB SGS (Selic/CDI)':
    'FRED (US Treasury constant maturity, OECD long-term rates, ICE BofA total return and OAS indices); BCB SGS (Selic/CDI)',
  'BCB – Sistema Expectativas de Mercado (Focus), API Olinda ExpectativasMercadoAnuais (base de cálculo 0)':
    'BCB – Market Expectations System (Focus), Olinda API ExpectativasMercadoAnuais (calculation base 0)',
  'BCB Focus via Olinda (ExpectativaMercadoMensais / ExpectativasMercadoAnuais, indicator Câmbio = BRL/USD); BCB PTAX; B3 DI1; FRED Treasuries':
    'BCB Focus via Olinda (ExpectativaMercadoMensais / ExpectativasMercadoAnuais, indicator “Câmbio” = BRL/USD); BCB PTAX; B3 DI1; FRED Treasuries',
  'Tesouro Transparente – PrecoTaxaTesouroDireto.csv (taxa de compra, manhã)': 'Tesouro Transparente – PrecoTaxaTesouroDireto.csv (morning buy rate)',
  'Yahoo Finance via yfinance (barras intradiárias com atraso; 1m: ~5 pregões; 5m: ~60 dias)': 'Yahoo Finance via yfinance (delayed intraday bars; 1m: ~5 sessions; 5m: ~60 days)',
  'Yahoo Finance via yfinance – contrato futuro contínuo (front month, =F), fechamento diário com atraso': 'Yahoo Finance via yfinance – continuous futures contract (front month, =F), delayed daily close',
  'Yahoo Finance (USD/XXX, fechamento diário); BCB PTAX via API Olinda (boletim de fechamento)': 'Yahoo Finance (USD/XXX, daily close); BCB PTAX via Olinda API (closing bulletin)',
  'CVM – Formulário de Referência (FRE 2026), item posição acionária': 'CVM – Reference Form (FRE 2026), shareholding position item',
  'CVM – dados abertos DFP (anual) e ITR (trimestral), demonstrações consolidadas, contas até o 3º nível': 'CVM – DFP (annual) and ITR (quarterly) open data, consolidated statements, accounts up to level 3',
  'Black-Scholes (europeia), juro = CDI anualizado contínuo, prazo = dias úteis/252 (sem feriados)': 'Black-Scholes (European), rate = continuously compounded annualized CDI, time = business days/252 (no holidays)',
  'Banco Central do Brasil – Copom': 'Central Bank of Brazil – Copom',
  'alerts.yaml do repositório, avaliado no pipeline (fechamento diário)': 'Repository alerts.yaml, evaluated by the pipeline (daily close)',
  'Dólar acima de R$ 6,00': 'USD above R$ 6.00', 'Ibovespa caiu mais de 2% no dia': 'Ibovespa down more than 2% on the day',
  'CVM – Informe Diário de Fundos (dados abertos) + registro de classes CVM (RCVM 175). Captação líquida = captação − resgate. Classificação CVM, não ANBIMA.':
    'CVM – Daily Fund Report (open data) + CVM class registry (RCVM 175). Net flows = subscriptions − redemptions. CVM classification.',
  'Taxa DI1 = (100000/PU)^(252/du) − 1. CDI constante entre reuniões; mudança vale a partir do dia útil seguinte à decisão. Fatores log do DI1 interpolados linearmente em du (forwards constantes entre vencimentos); o CDI implícito de cada período entre reuniões é o forward médio do período (método flat-forward, como no pacote copom de Wilson Freitas). Est = taxa do contrato recalculada pelo caminho implícito; Last−Est em pb.':
    'DI1 rate = (100000/PU)^(252/bd) − 1. CDI is constant between meetings; a change takes effect on the business day after the decision. DI1 log factors are interpolated linearly in business days (constant forwards between expiries); the implied CDI of each inter-meeting period is that period\'s average forward (flat-forward method, as in Wilson Freitas\'s copom package). Est = contract rate recomputed from the implied path; Last−Est in bp.',
  // DFP/ITR (FA) – contas padrão CVM
  'Ativo Total': 'Total Assets', 'Ativo Circulante': 'Current Assets', 'Ativo Não Circulante': 'Non-current Assets', 'Passivo Circulante': 'Current Liabilities',
  'Passivo Não Circulante': 'Non-current Liabilities', 'Patrimônio Líquido Consolidado': 'Consolidated Equity', 'Passivo Total': 'Total Liabilities',
  'Receita de Venda de Bens e/ou Serviços': 'Revenue from Goods and/or Services', 'Custo dos Bens e/ou Serviços Vendidos': 'Cost of Goods and/or Services Sold',
  'Resultado Bruto': 'Gross Profit', 'Despesas/Receitas Operacionais': 'Operating Expenses/Income', 'Resultado Antes do Resultado Financeiro e dos Tributos': 'Operating Income (EBIT)',
  'Resultado Financeiro': 'Financial Result', 'Resultado Antes dos Tributos sobre o Lucro': 'Pre-tax Income', 'Imposto de Renda e Contribuição Social sobre o Lucro': 'Income Taxes',
  'Resultado Líquido das Operações Continuadas': 'Net Income from Continuing Operations', 'Resultado Líquido de Operações Descontinuadas': 'Net Income from Discontinued Operations',
  'Lucro/Prejuízo Consolidado do Período': 'Consolidated Net Income/Loss', 'Lucro por Ação - (Reais / Ação)': 'Earnings per Share (R$/share)',
  'Caixa Líquido Atividades Operacionais': 'Net Cash from Operating Activities', 'Caixa Líquido Atividades de Investimento': 'Net Cash from Investing Activities',
  'Caixa Líquido Atividades de Financiamento': 'Net Cash from Financing Activities', 'Variação Cambial s/ Caixa e Equivalentes': 'FX Effect on Cash and Equivalents',
  'Aumento (Redução) de Caixa e Equivalentes': 'Increase (Decrease) in Cash and Equivalents', 'Demonstração do resultado': 'Income statement',
  'Balanço – ativo': 'Balance sheet – assets', 'Balanço – passivo e PL': 'Balance sheet – liabilities & equity', 'Fluxo de caixa (método indireto)': 'Cash flow (indirect method)',
}
const MON_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON3_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MON3_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Tradução pura PT→EN (testável); devolve o original quando não há entrada. Aceita "1.01 Ativo Total (R$ mi)". */
let LONG_: string[] | null = null
const LONGK = () => (LONG_ ||= Object.keys(MAP).filter(k => k.length >= 24).sort((a, b) => b.length - a.length))
export function toEN(s: string): string {
  if (!s) return s
  const t = s.trim()
  if (MAP[t]) return MAP[t]
  const m = t.match(/^([\d.]+\s+)?(.*?)(\s*\(R\$ mi\))?$/)
  if (m && MAP[m[2]]) return `${m[1] || ''}${MAP[m[2]]}${m[3] ? ' (R$ mn)' : ''}`
  let u = t
  for (const k of LONGK()) if (u.includes(k)) u = u.split(k).join(MAP[k])
  u = u.replace(/\(([^()]+)\)/g, (w, x) => (MAP[x] ? `(${MAP[x]})` : w))
  u = u.replace(/^([^()—]+?)(?= \()/, x => MAP[x] || x)
  u = u.split(' — ').map(x => MAP[x] || x).join(' — ')
  if (u !== t) return u
  const M3 = '(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)'
  return t
    .replace(new RegExp('(?<!\\p{L})(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?!\\p{L})', 'giu'), w => MON_EN[MON_PT.indexOf(w.toLowerCase())])
    .replace(new RegExp(`(?<!\\p{L})${M3}(?=\\/\\d\\d(?!\\d)|\\s\\d{4}(?!\\d)|-${M3}(?!\\p{L}))|(?<=(?<!\\p{L})${M3}-)${M3}(?!\\p{L})`, 'gu'), w => MON3_EN[MON3_PT.indexOf(w)])
}
/** Texto de dados para exibição: EN por padrão, original em PT. */
export const en = (s: any): any => (typeof s === 'string' && lang() !== 'pt' ? toEN(s) : s)
/** Rótulo mês/ano curto ("out/26" → "Oct/26" em EN). */
export const monLabel = (iso: string) => {
  const i = +iso.slice(5, 7) - 1
  return `${lang() === 'pt' ? MON3_PT[i] : MON3_EN[i]}/${iso.slice(2, 4)}`
}
