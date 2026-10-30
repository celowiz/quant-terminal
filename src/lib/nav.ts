/** Navegação entre funções preservando o ativo corrente (ver activeTicker.mjs). */
import tickers from '../../public/data/tickers.json'
import { functionPath, readStoredTicker, writeStoredTicker } from './activeTicker.mjs'
import { go } from './static'
import { navFunction } from './track'
import type { FunctionSource } from './analytics.mjs'

export const UNIVERSE: string[] = (tickers as { tickers: { ticker: string }[] }).tickers.map(t => t.ticker)
const store = () => (typeof window === 'undefined' ? null : window.localStorage)

export const getActiveTicker = () => readStoredTicker(store())
export const setActiveTicker = (ticker: string) => writeStoredTicker(store(), ticker)

/** abre a função com o ativo guardado quando ela aceita (e o ativo está no universo dela) */
export function openFunction(code: string, source: FunctionSource) {
  navFunction(source, code || 'HOME')
  go(functionPath(code, getActiveTicker(), UNIVERSE))
}
