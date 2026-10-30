// Universo de ativos por função, derivado de data/tickers.json (gerado pelo pipeline).
import tickers from '../../public/data/tickers.json'
import { FUNCTION_UNIVERSE } from './activeTicker.mjs'
import type { TickerMeta } from './static'

export const TICKERS = (tickers as unknown as { tickers: TickerMeta[] }).tickers

/** generateStaticParams de /<fn>/[ticker]: só os ativos que a função aceita (controla o tamanho do deploy) */
export function staticParams(code: string) {
  const own = (FUNCTION_UNIVERSE as Record<string, string[]>)[code.toUpperCase()]
  return TICKERS.filter(t => !own || own.includes(t.ticker.toUpperCase())).map(t => ({ ticker: t.ticker }))
}
