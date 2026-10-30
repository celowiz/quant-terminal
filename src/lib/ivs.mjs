// IVS – smile e superfície de volatilidade implícita a partir da cadeia de fechamento. Módulo puro (.mjs).

/**
 * Smile de um vencimento: séries negociadas com VI, usando a opção fora do dinheiro em cada strike
 * (puts abaixo do spot, calls a partir do spot) — as OTM são as mais líquidas e não carregam valor intrínseco.
 * Devolve [{ k: K/S, K, iv, code, trades }] ordenado por moneyness.
 */
export function smile(exp, spot, { minTrades = 1, ivMin = 1, ivMax = 300 } = {}) {
  const ok = (o) => o.iv != null && o.trades >= minTrades && o.iv >= ivMin && o.iv <= ivMax
  const byK = new Map()
  for (const o of exp.puts || []) if (o.strike < spot && ok(o)) { const b = byK.get(o.strike); if (!b || o.trades > b.trades) byK.set(o.strike, o) }
  for (const o of exp.calls || []) if (o.strike >= spot && ok(o)) { const b = byK.get(o.strike); if (!b || o.trades > b.trades) byK.set(o.strike, o) }
  return [...byK.values()].map(o => ({ k: o.strike / spot, K: o.strike, iv: o.iv, code: o.code, trades: o.trades })).sort((a, b) => a.k - b.k)
}

/** interpolação linear da VI no moneyness m; null fora do intervalo observado (sem extrapolar) */
export function ivAt(pts, m) {
  if (!pts.length || m < pts[0].k || m > pts[pts.length - 1].k) return null
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].k === m) return pts[i].iv
    if (pts[i].k > m) { const a = pts[i - 1], b = pts[i]; return a.iv + (b.iv - a.iv) * (m - a.k) / (b.k - a.k) }
  }
  return null
}

/** superfície: linhas = vencimentos com pelo menos `minPts` pontos, colunas = grade de moneyness */
export function surface(expiries, spot, grid, minPts = 3, opt = {}) {
  return expiries.map(e => ({ date: e.date, bdays: e.bdays, pts: smile(e, spot, opt) }))
    .filter(r => r.pts.length >= minPts)
    .map(r => ({ ...r, row: grid.map(m => ivAt(r.pts, m)), atm: ivAt(r.pts, 1), skew: (() => { const a = ivAt(r.pts, 0.9), b = ivAt(r.pts, 1.1); return a != null && b != null ? a - b : null })() }))
}
