// Saneamento de valores vindos de dados públicos (data/*.json), URL e localStorage.
// Módulo puro (.mjs) para `node --test` sem bundler.

/** Só http(s) absoluto: devolve a URL normalizada ou undefined (bloqueia javascript:, data:, vbscript:, //host, relativos). */
export function safeUrl(v) {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s || s.length > 2048 || !/^https?:\/\//i.test(s)) return undefined
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    if (!u.hostname || u.username || u.password) return undefined
    return u.href
  } catch { return undefined }
}

/** Domínio sem esquema (ex.: 'www.petrobras.com.br') → https://...; demais regras de safeUrl. */
export function safeSite(v) {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return safeUrl(/^https?:\/\//i.test(s) ? s : /^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(s) ? `https://${s}` : '')
}

/** rel para links externos */
export const EXTERNAL_REL = 'noopener noreferrer'

/** decodeURIComponent que não lança em '%' malformado */
export function safeDecode(s) {
  try { return decodeURIComponent(s) } catch { return s }
}

/** caminho de logo vendorizado: logos/<TICKER>.png */
export function safeLogo(v) {
  return typeof v === 'string' && /^logos\/[A-Z0-9]{1,12}\.png$/.test(v) ? v : undefined
}

/** JSON.parse do localStorage com validação de forma; qualquer falha devolve o fallback */
export function readStoredJSON(storage, key, validate, fallback) {
  try {
    const raw = storage?.getItem(key)
    if (raw == null || raw.length > 200000) return fallback
    const v = validate(JSON.parse(raw))
    return v === undefined ? fallback : v
  } catch { return fallback }
}

const TICKER_RE = /^[A-Z0-9^][A-Z0-9.=^_-]{0,19}$/
export const isTicker = v => typeof v === 'string' && TICKER_RE.test(v)
const num = v => typeof v === 'number' && Number.isFinite(v)

/** qt_port: [{cod, w}] — códigos B3 (PETR4, BOVA11...), pesos finitos 0..1000, até 50 posições */
export function validPortfolio(v) {
  if (!Array.isArray(v)) return undefined
  const out = [], seen = new Set()
  for (const p of v.slice(0, 50)) {
    if (!p || typeof p.cod !== 'string' || !/^[A-Z0-9]{4,8}$/.test(p.cod) || !num(p.w) || p.w < 0 || p.w > 1000 || seen.has(p.cod)) continue
    seen.add(p.cod); out.push({ cod: p.cod, w: p.w })
  }
  return out.length ? out : undefined
}

/** qt_alerts: [{id, ticker, op: above|below, value}] — até 100 alertas */
export function validLocalAlerts(v) {
  if (!Array.isArray(v)) return undefined
  return v.slice(0, 100).filter(a => a && typeof a.id === 'string' && a.id.length <= 40 && isTicker(a.ticker) &&
    (a.op === 'above' || a.op === 'below') && num(a.value))
    .map(a => ({ id: a.id, ticker: a.ticker, op: a.op, value: a.value }))
}
