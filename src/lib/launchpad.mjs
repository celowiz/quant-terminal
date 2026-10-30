// Launchpad (LP): estado dos painéis (layout 2 ou 4 + caminho de cada painel), salvo no localStorage
// e codificado na URL de compartilhamento (?l=4&p=gp/PETR4.SA,cdie,…). Módulo puro para `node --test`.

export const LAYOUTS = [2, 4]
export const STORAGE_KEY = 'qt.lp.v1'
export const DEFAULT_PANELS = ['gp/PETR4.SA', 'cdie', 'wei', 'des/VALE3.SA']
export const DEFAULT_STATE = { n: 2, panels: DEFAULT_PANELS }

const TICKER = /^[A-Z0-9.^=_-]{1,24}$/

/** normaliza um caminho de painel ("/quant-terminal/gp/PETR4.SA/" → "gp/PETR4.SA"); null se inválido */
export function sanitizePanel(path, codes, basePath = '') {
  let p = String(path || '')
  try { p = decodeURIComponent(p) } catch { return null }
  p = p.split(/[?#]/)[0]
  if (basePath && p.startsWith(basePath)) p = p.slice(basePath.length)
  const seg = p.split('/').filter(Boolean)
  if (seg.length < 1 || seg.length > 2) return null
  const fn = seg[0].toUpperCase()
  if (fn === 'LP' || !codes.includes(fn)) return null
  if (seg.length === 1) return fn.toLowerCase()
  const tk = seg[1].toUpperCase()
  return TICKER.test(tk) ? `${fn.toLowerCase()}/${tk}` : null
}

/** completa/valida um estado: n ∈ {2,4}, sempre 4 caminhos (os ocultos ficam guardados para voltar ao 2x2) */
export function normalizeState(s, codes) {
  const n = LAYOUTS.includes(Number(s?.n)) ? Number(s.n) : DEFAULT_STATE.n
  const src = Array.isArray(s?.panels) ? s.panels : []
  const panels = DEFAULT_PANELS.map((d, i) => sanitizePanel(src[i], codes) || d)
  return { n, panels }
}

export function encodeState(s) {
  return `l=${s.n}&p=${s.panels.map(p => encodeURIComponent(p)).join(',')}`
}

/** lê ?l=&p= de uma query string; null quando a URL não traz layout */
export function decodeState(search, codes) {
  const q = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  if (!q.has('l') && !q.has('p')) return null
  const panels = (q.get('p') || '').split(',').map(x => { try { return decodeURIComponent(x) } catch { return '' } })
  return normalizeState({ n: q.get('l'), panels }, codes)
}

/** estado inicial: URL compartilhada > localStorage > padrão */
export function initialState(search, stored, codes) {
  const fromUrl = decodeState(search, codes)
  if (fromUrl) return fromUrl
  try { return normalizeState(JSON.parse(stored || 'null'), codes) } catch { return normalizeState(null, codes) }
}
