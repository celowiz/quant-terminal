// Linha de comando do terminal: "PETR4 GP" + Enter (também "GP PETR4", "AAPL DES", "IBOV GP", "PETR4" sozinho).
// Módulo puro (.mjs) para ser testado com `node --test` sem bundler.
import { acceptsTicker, covers } from './activeTicker.mjs'

/** apelidos comuns → ticker do universo (só valem se o ticker existir em data/tickers.json) */
export const ALIASES = {
  IBOV: '^BVSP', IBOVESPA: '^BVSP', SPX: '^GSPC', SP500: '^GSPC', 'S&P500': '^GSPC', NDX: '^NDX', NASDAQ: '^IXIC',
  DXY: 'DX-Y.NYB', USDBRL: 'BRL=X', DOLAR: 'BRL=X', 'DÓLAR': 'BRL=X', BTC: 'BTC-USD', ETH: 'ETH-USD',
}
const IGNORE = new Set(['GO', '<GO>', 'ENTER'])

/** Resolve um token para um ticker do universo: exato, +.SA (B3), ^índice, apelido. '' se não houver. */
export function resolveTicker(tok, universe) {
  const u = String(tok || '').toUpperCase().trim()
  if (!u) return ''
  const set = new Set((universe || []).map(x => String(x).toUpperCase()))
  for (const c of [u, `${u}.SA`, `^${u}`, ALIASES[u]]) if (c && set.has(c)) return c
  return ''
}

/**
 * Interpreta o texto digitado. `codes` = códigos de função válidos (ex.: FUNCTION_LIST).
 * Devolve { code, ticker, unknown[] }; code/ticker vazios quando ausentes.
 */
export function parseCommand(input, universe, codes) {
  const C = new Set((codes || []).map(c => String(c).toUpperCase()).filter(Boolean))
  const out = { code: '', ticker: '', unknown: [] }
  for (const raw of String(input || '').toUpperCase().split(/\s+/)) {
    const tok = raw.trim()
    if (!tok || IGNORE.has(tok)) continue
    if (!out.code && (C.has(tok) || tok === 'HOME')) { out.code = tok; continue }
    const tk = !out.ticker && resolveTicker(tok, universe)
    if (tk) { out.ticker = tk; continue }
    out.unknown.push(tok)
  }
  return out
}

/**
 * Destino do comando. Só ticker → mantém a função atual se ela aceita ativo, senão GP.
 * Função sem ativo (ex.: WIRP) ignora o ticker. Devolve { path, code, ticker, note } ou null.
 * `note`: 'noTicker' (função não usa ativo) | 'notCovered' (sem dados para esse ativo) | ''.
 */
export function commandTarget(cmd, currentCode) {
  if (!cmd || cmd.unknown.length || (!cmd.code && !cmd.ticker)) return null
  const cur = String(currentCode || '').toUpperCase()
  const code = cmd.code || (acceptsTicker(cur) ? cur : 'GP')
  if (code === 'HOME') return { path: '/', code, ticker: cmd.ticker, note: '' }
  const lc = code.toLowerCase()
  if (!cmd.ticker) return { path: `/${lc}/`, code, ticker: '', note: '' }
  if (!acceptsTicker(code)) return { path: `/${lc}/`, code, ticker: cmd.ticker, note: 'noTicker' }
  if (!covers(code, cmd.ticker)) return { path: `/${lc}/`, code, ticker: cmd.ticker, note: 'notCovered' }
  return { path: `/${lc}/${encodeURIComponent(cmd.ticker)}/`, code, ticker: cmd.ticker, note: '' }
}
