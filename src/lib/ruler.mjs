// Régua do GP/GPL: variação entre dois pontos do gráfico. Módulo puro.

/** rows: barras ordenadas por time (ISO). a, b: times clicados (qualquer ordem; ajusta para a barra existente mais próxima ≤).
 *  Retorna null se faltar ponto ou a série estiver vazia. */
export function rulerStats(rows, a, b, key = 'close') {
  if (!rows?.length || !a || !b) return null
  const idx = t => {
    let lo = 0, hi = rows.length - 1, ans = 0
    if (t <= rows[0].time) return 0
    while (lo <= hi) { const m = (lo + hi) >> 1; if (rows[m].time <= t) { ans = m; lo = m + 1 } else hi = m - 1 }
    return ans
  }
  let i = idx(a), j = idx(b)
  if (i > j) [i, j] = [j, i]
  const p0 = rows[i], p1 = rows[j]
  const v0 = p0[key], v1 = p1[key]
  const abs = v1 - v0
  const pct = v0 ? (v1 / v0 - 1) * 100 : null
  const days = Math.round((Date.parse(p1.time + 'T00:00:00Z') - Date.parse(p0.time + 'T00:00:00Z')) / 86400000)
  return { from: p0.time, to: p1.time, v0, v1, abs, pct, sessions: j - i, days, up: abs >= 0 }
}

/** Próximo estado dos pontos ao clicar: 0 → [t], 1 → [a, t], 2 → recomeça em [t]. */
export const rulerNext = (pts, t) => (pts.length === 1 ? [pts[0], t] : [t])
