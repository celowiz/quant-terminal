// Universo de ativos por função, derivado de data/tickers.json (gerado pelo pipeline).
import tickers from '../../public/data/tickers.json'
import './coverage'
import { FUNCTION_UNIVERSE } from './activeTicker.mjs'
import type { TickerMeta } from './static'

export const TICKERS = (tickers as unknown as { tickers: TickerMeta[] }).tickers

/** generateStaticParams de /<fn>/[ticker]: só os ativos que a função aceita (controla o tamanho do deploy).
 *  A cobertura ampliada (`ext`) não gera página: o 404.html (app/not-found.tsx) renderiza a View no navegador. */
export function staticParams(code: string) {
  const own = (FUNCTION_UNIVERSE as Record<string, string[]>)[code.toUpperCase()]
  return TICKERS.filter(t => !t.ext && (!own || own.includes(t.ticker.toUpperCase()))).map(t => ({ ticker: t.ticker }))
}
