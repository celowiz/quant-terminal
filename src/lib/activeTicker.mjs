// Ativo corrente global ("sticky ticker"): sobrevive à troca de função.
// Módulo puro (.mjs) para ser testado com `node --test` sem bundler.

/** Funções que aceitam ativo (têm rota /fn/[ticker] gerada a partir de data/tickers.json). */
export const TICKER_FUNCTIONS = [
  'GP', 'GPC', 'GIP', 'GR', 'MACD', 'RSI', 'SEAG', 'SEAH',
  'DES', 'CN', 'CF', 'FUND', 'FA', 'VAL', 'RV', 'HDS', 'OMON',
  'HP', 'TRA', 'COMP', 'DY', 'DVD', 'SPLIT', 'BETA', 'VOL', 'HS', 'HRA', 'MRR',
]

/** Ações com dados corporativos (CVM) — espelha EQUITIES em components/fn/kit.tsx. */
const EQUITIES = ['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA']
/** Universos restritos por função; as demais aceitam todo o data/tickers.json. */
export const FUNCTION_UNIVERSE = {
  DES: EQUITIES, CN: EQUITIES, CF: EQUITIES, FUND: EQUITIES, VAL: EQUITIES, DY: EQUITIES,
  DVD: EQUITIES, SPLIT: EQUITIES, OMON: EQUITIES, TRA: EQUITIES, HDS: EQUITIES, FA: EQUITIES,
  GIP: [...EQUITIES, '^BVSP'],
}

export const STORAGE_KEY = 'qt.ticker'

export const acceptsTicker = (code) => TICKER_FUNCTIONS.includes(String(code || '').toUpperCase())

/** O ticker está no universo da função? `universe` = lista completa de data/tickers.json. */
export function inUniverse(code, ticker, universe) {
  const c = String(code || '').toUpperCase(), tk = String(ticker || '').toUpperCase()
  if (!tk || !acceptsTicker(c)) return false
  if (!universe.map(u => u.toUpperCase()).includes(tk)) return false
  const own = FUNCTION_UNIVERSE[c]
  return !own || own.includes(tk)
}

/**
 * Caminho de destino ao trocar de função: /fn/TICKER/ quando a função aceita ativo e o ticker
 * guardado está no universo dela; senão a página padrão da função (/fn/). O ticker guardado
 * não é alterado aqui — continua valendo para a próxima função compatível.
 */
export function functionPath(code, ticker, universe) {
  const c = String(code || '').toUpperCase()
  if (!c || c === 'HOME') return '/'
  if (inUniverse(c, ticker, universe)) return `/${c.toLowerCase()}/${encodeURIComponent(String(ticker).toUpperCase())}/`
  return `/${c.toLowerCase()}/`
}

export function readStoredTicker(storage) {
  try { return (storage?.getItem(STORAGE_KEY) || '').toUpperCase() } catch { return '' }
}
export function writeStoredTicker(storage, ticker) {
  try { if (ticker) storage?.setItem(STORAGE_KEY, String(ticker).toUpperCase()) } catch { /* modo privado */ }
}

/** Rótulo limpo do ativo no campo de ticker: PETR4.SA → PETR4 (o valor real continua o ticker completo). */
export const displayTicker = (ticker) => String(ticker || '').toUpperCase().replace(/\.SA$/, '')
