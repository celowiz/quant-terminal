import { isTicker } from './safe.mjs'
// Ativo corrente global ("sticky ticker"): sobrevive à troca de função.
// Módulo puro (.mjs) para ser testado com `node --test` sem bundler.

/** Funções que aceitam ativo (têm rota /fn/[ticker] gerada a partir de data/tickers.json). */
export const TICKER_FUNCTIONS = [
  'GP', 'GPC', 'GIP', 'GR', 'MACD', 'RSI', 'SEAG', 'SEAH',
  'DES', 'CN', 'CF', 'FUND', 'FA', 'VAL', 'RV', 'HDS', 'OMON', 'OVME', 'EVTS',
  'HP', 'TRA', 'COMP', 'DY', 'DVD', 'SPLIT', 'BETA', 'VOL', 'HS', 'HRA', 'MRR',
  'DCF', 'OSA', 'IVS',
]

/** Núcleo de ações com dados corporativos — reserva quando o tickers.json não traz cobertura (`cov`). */
const EQUITIES = ['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA']
/** Dataset por ativo que cada função restrita precisa (pipeline: corp/, holders/, fa/, options/, intraday/). */
export const FUNCTION_DATASET = {
  DES: 'corp', CN: 'corp', CF: 'corp', FUND: 'corp', VAL: 'corp', DY: 'corp', DVD: 'corp', SPLIT: 'corp', TRA: 'corp',
  HDS: 'holders', FA: 'fa', OMON: 'options', OVME: 'options', EVTS: 'corp', GIP: 'intraday',
  DCF: 'corp', OSA: 'options', IVS: 'options',
}
const STATIC_UNIVERSE = {
  corp: EQUITIES, holders: EQUITIES, fa: EQUITIES, options: EQUITIES, intraday: [...EQUITIES, '^BVSP'],
}
/** Universos restritos por função; as demais aceitam todo o data/tickers.json. Preenchido por registerCoverage. */
export const FUNCTION_UNIVERSE = {}
/** Datasets extras que também abrem a função: DES cobre ações (corp), FIIs, BDRs e ETFs (des/) e os ativos de mercado (market). */
export const EXTRA_DATASETS = { DES: ['des', 'market'] }
/** Classes cujo DES é montado só com a série de preços e o cadastro do tickers.json (índices, moedas, commodities, cripto). */
export const MARKET_CLASSES = ['index', 'fx', 'commodity', 'crypto']
function fill(byDataset) {
  for (const [fn, ds] of Object.entries(FUNCTION_DATASET)) {
    const u = [...(byDataset[ds] || [])]
    for (const x of EXTRA_DATASETS[fn] || []) for (const t of byDataset[x] || []) if (!u.includes(t)) u.push(t)
    FUNCTION_UNIVERSE[fn] = u
  }
}
fill(STATIC_UNIVERSE)

/**
 * Cobertura real a partir do tickers.json: cada ticker traz `cov` (datasets por ativo que o pipeline gerou).
 * Sem nenhum `cov` (seed antigo), mantém o núcleo fixo. Devolve o mapa dataset → tickers.
 */
export function registerCoverage(tickers) {
  const by = {}
  let any = false
  for (const t of tickers || []) {
    for (const ds of t.cov || []) { (by[ds] ||= []).push(String(t.ticker).toUpperCase()); any = true }
    if (MARKET_CLASSES.includes(t.class)) (by.market ||= []).push(String(t.ticker).toUpperCase())
  }
  if (!any) { const st = { ...STATIC_UNIVERSE, market: by.market || [] }; fill(st); return st }
  fill(by)
  return by
}

/** O ativo tem os dados da função? (DES → corp ou des; FUND… → corp, HDS → holders, FA → fa, OMON → options, GIP → intraday) */
export const covers = (code, ticker) => {
  const own = FUNCTION_UNIVERSE[String(code || '').toUpperCase()]
  return !own || own.includes(String(ticker || '').toUpperCase())
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
  try { const v = (storage?.getItem(STORAGE_KEY) || '').toUpperCase(); return isTicker(v) ? v : '' } catch { return '' }
}
export function writeStoredTicker(storage, ticker) {
  try { const v = String(ticker || '').toUpperCase(); if (isTicker(v)) storage?.setItem(STORAGE_KEY, v) } catch { /* modo privado */ }
}

/** Rótulo limpo do ativo no campo de ticker: PETR4.SA → PETR4 (o valor real continua o ticker completo). */
export const displayTicker = (ticker) => String(ticker || '').toUpperCase().replace(/\.SA$/, '')

/** Ativo que a página /fn/ sem ticker renderiza (GP/GPC sem ativo pedem a escolha). */
export const defaultTicker = (code) => (['GP', 'GPC'].includes(String(code || '').toUpperCase()) ? '' : 'PETR4.SA')

/**
 * Ticker mostrado na barra em /fn/ (sem ticker na URL): o guardado quando a função cobre;
 * senão o padrão que a página realmente renderiza. `fallbackFrom` = o guardado não coberto
 * (para o aviso), ou '' quando não houve troca.
 */
export function barTicker(code, stored, universe) {
  const c = String(code || '').toUpperCase(), tk = String(stored || '').toUpperCase()
  if (!acceptsTicker(c)) return { ticker: tk, fallbackFrom: '' }
  if (inUniverse(c, tk, universe)) return { ticker: tk, fallbackFrom: '' }
  const def = defaultTicker(c)
  return { ticker: def, fallbackFrom: tk && tk !== def ? tk : '' }
}

/** Lista de busca da função: só o universo que ela cobre (DES → ações com CVM). */
export function functionUniverse(code, universe) {
  const own = FUNCTION_UNIVERSE[String(code || '').toUpperCase()]
  return own ? universe.filter(u => own.includes(String(u).toUpperCase())) : universe
}
