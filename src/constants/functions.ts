import { lang } from '../lib/settings'

export type FnCategory = 'charts' | 'rates' | 'company' | 'macro' | 'equity' | 'tools' | 'monitors' | 'fxcmd'
/** desc = nome em inglês (padrão); pt = nome em português (Settings → Language) */
export type FunctionItem = { code: string; desc: string; pt: string; cat: FnCategory }

export const FUNCTION_LIST: FunctionItem[] = [
  { code: '', desc: 'Homepage', pt: 'Página inicial', cat: 'tools' },
  { code: 'GP', desc: 'Line Graph', pt: 'Gráfico de linha', cat: 'charts' },
  { code: 'GPC', desc: 'Candle Chart', pt: 'Gráfico de candles', cat: 'charts' },
  { code: 'GIP', desc: 'Intraday Graph', pt: 'Gráfico intradiário', cat: 'charts' },
  { code: 'GR', desc: 'Graph Relationship', pt: 'Relação entre ativos', cat: 'charts' },
  { code: 'MACD', desc: 'MACD Indicator', pt: 'Indicador MACD', cat: 'charts' },
  { code: 'RSI', desc: 'RSI Indicator', pt: 'Indicador RSI', cat: 'charts' },
  { code: 'SEAG', desc: 'Seasonality Graph', pt: 'Gráfico de sazonalidade', cat: 'charts' },
  { code: 'SEAH', desc: 'Seasonality Heatmap', pt: 'Mapa de calor de sazonalidade', cat: 'charts' },
  { code: 'RRG', desc: 'Relative Rotation Graph', pt: 'Gráfico de rotação relativa', cat: 'charts' },
  { code: 'CDIE', desc: 'CDI/Copom Expectations (DI1)', pt: 'Expectativas CDI/Copom (DI1)', cat: 'rates' },
  { code: 'GC', desc: 'Yield Curves (BR/US)', pt: 'Curvas de juros (BR/EUA)', cat: 'rates' },
  { code: 'WFI', desc: 'World Fixed Income Indexes', pt: 'Renda fixa mundial', cat: 'rates' },
  { code: 'BTMM', desc: 'Rates & Money Market Monitor', pt: 'Monitor de juros e mercado monetário', cat: 'rates' },
  { code: 'DES', desc: 'Company Description', pt: 'Descrição da empresa', cat: 'company' },
  { code: 'CN', desc: 'Company News', pt: 'Notícias da empresa', cat: 'company' },
  { code: 'CF', desc: 'Company Filings', pt: 'Documentos da empresa (CVM)', cat: 'company' },
  { code: 'FUND', desc: 'Company Fundamentals', pt: 'Fundamentos da empresa', cat: 'company' },
  { code: 'FA', desc: 'Financial Analysis', pt: 'Análise financeira', cat: 'company' },
  { code: 'VAL', desc: 'Valuation Multiples', pt: 'Múltiplos de valuation', cat: 'company' },
  { code: 'RV', desc: 'Relative Valuation', pt: 'Valuation relativo', cat: 'company' },
  { code: 'HDS', desc: 'Holders / Shareholders', pt: 'Acionistas', cat: 'company' },
  { code: 'CAL', desc: 'Calendar of Results', pt: 'Calendário de resultados', cat: 'company' },
  { code: 'OMON', desc: 'Options Monitor', pt: 'Monitor de opções', cat: 'company' },
  { code: 'ECON', desc: 'Economic Indicators', pt: 'Indicadores econômicos', cat: 'macro' },
  { code: 'ECFC', desc: 'Economic Forecasts (Focus)', pt: 'Projeções econômicas (Focus)', cat: 'macro' },
  { code: 'ECST', desc: 'Economic Statistics', pt: 'Estatísticas econômicas', cat: 'macro' },
  { code: 'HP', desc: 'Historical Price Table', pt: 'Tabela de preços históricos', cat: 'equity' },
  { code: 'TRA', desc: 'Total Return Analysis', pt: 'Análise de retorno total', cat: 'equity' },
  { code: 'COMP', desc: 'Comparative Returns', pt: 'Retornos comparativos', cat: 'equity' },
  { code: 'DY', desc: 'Dividend Yield History', pt: 'Histórico de dividend yield', cat: 'equity' },
  { code: 'DVD', desc: 'Historical Dividends', pt: 'Histórico de dividendos', cat: 'equity' },
  { code: 'SPLIT', desc: 'Historical Splits', pt: 'Histórico de desdobramentos', cat: 'equity' },
  { code: 'BETA', desc: 'Beta and Correlation', pt: 'Beta e correlação', cat: 'equity' },
  { code: 'VOL', desc: 'Historical Volatility', pt: 'Volatilidade histórica', cat: 'equity' },
  { code: 'HS', desc: 'Historical Spread', pt: 'Spread histórico', cat: 'equity' },
  { code: 'HRA', desc: 'Historical Regression', pt: 'Regressão histórica', cat: 'equity' },
  { code: 'MRR', desc: 'Member Returns / Monthly', pt: 'Retornos mensais', cat: 'equity' },
  { code: 'PORT', desc: 'Portfolio Simulator', pt: 'Simulador de carteira', cat: 'tools' },
  { code: 'ALERT', desc: 'Price Alerts', pt: 'Alertas de preço', cat: 'tools' },
  { code: 'WEI', desc: 'World Equity Indexes', pt: 'Índices de ações mundiais', cat: 'monitors' },
  { code: 'HEAT', desc: 'Sector Heatmap', pt: 'Mapa de calor setorial', cat: 'monitors' },
  { code: 'TOP', desc: 'Top Winners/Losers', pt: 'Maiores altas e baixas', cat: 'monitors' },
  { code: 'MOST', desc: 'Most Active Stocks', pt: 'Ações mais negociadas', cat: 'monitors' },
  { code: 'EQS', desc: 'Equity Screening', pt: 'Screener de ações', cat: 'monitors' },
  { code: 'CORR', desc: 'Correlation Matrix', pt: 'Matriz de correlação', cat: 'monitors' },
  { code: 'ANB', desc: 'Flows of Funds by Category', pt: 'Captação de fundos por categoria', cat: 'monitors' },
  { code: 'NEWS', desc: 'Market News', pt: 'Notícias do mercado', cat: 'monitors' },
  { code: 'FX', desc: 'Currency Quotes', pt: 'Cotações de moedas', cat: 'fxcmd' },
  { code: 'WCRS', desc: 'World Currency Ranker', pt: 'Ranking de moedas', cat: 'fxcmd' },
  { code: 'GLCO', desc: 'Global Commodities', pt: 'Commodities globais', cat: 'fxcmd' },
]

/** nome da função no idioma atual */
export const fnName = (f: FunctionItem) => (lang() === 'pt' ? f.pt : f.desc)
export const fnNameByCode = (code: string) => {
  const f = FUNCTION_LIST.find(x => x.code === code.toUpperCase())
  return f ? fnName(f) : code
}

/** colunas da página inicial (desktop): categorias agrupadas para equilibrar a altura */
export const HOME_COLUMNS: FnCategory[][] = [['charts', 'rates'], ['company', 'macro'], ['equity', 'tools'], ['monitors', 'fxcmd']]
