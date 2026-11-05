// Universo de ativos por função, derivado de data/tickers.json (gerado pelo pipeline).
import tickers from '../../public/data/tickers.json'
import './coverage'
import { FUNCTION_UNIVERSE } from './activeTicker.mjs'
import type { TickerMeta } from './static'

export const TICKERS = (tickers as unknown as { tickers: TickerMeta[] }).tickers

/** generateStaticParams de /<fn>/[ticker]: só os ativos que a função aceita (controla o tamanho do deploy).
 *  A cobertura ampliada (`ext`) só gera página nas funções de EXT_PAGES (GP/GPL/HP, as mais abertas por link direto, e SEAH):
 *  nas demais o 404.html (app/not-found.tsx) renderiza a View no navegador, mas o documento chega com status 404. */
export const EXT_PAGES = new Set(['GP', 'GPL', 'HP', 'SEAH'])
/** Funções com página para todo o núcleo (não-`ext`) mesmo sem dados: a View mostra uma página amigável em vez do 404
 *  (GIP: ativos sem barras intradiárias apontam para GP/GPC; CF: ativos sem documentos apontam para DES/GP). */
export const ALL_CORE_PAGES = new Set(['GIP', 'CF', 'FUND'])
export function staticParams(code: string) {
  const C = code.toUpperCase()
  const own = ALL_CORE_PAGES.has(C) ? undefined : (FUNCTION_UNIVERSE as Record<string, string[]>)[C]
  const ext = EXT_PAGES.has(C)
  return TICKERS.filter(t => (ext || !t.ext) && (!own || own.includes(t.ticker.toUpperCase()))).map(t => ({ ticker: t.ticker }))
}
