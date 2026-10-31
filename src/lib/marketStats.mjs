// Estatísticas do DES de mercado (índices, moedas, commodities, cripto) calculadas só com a série diária.
// Sem histórico suficiente para um prazo → null (a tela mostra —), nunca extrapola.

const minus = (iso, months = 0, years = 0) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - years); d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}
/** último fechamento em ou antes de `iso`; null se a série começa depois */
export function closeAt(rows, iso) {
  let lo = 0, hi = rows.length - 1, k = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rows[m].time <= iso) { k = m; lo = m + 1 } else hi = m - 1 }
  return k < 0 ? null : rows[k]
}
const ret = (a, b) => a && b && a.close > 0 ? b.close / a.close - 1 : null

/** rows: [{time, open, high, low, close}] em ordem; perYear: 252 (pregões) ou 365 (cripto, negocia todo dia) */
export function marketStats(rows, perYear = 252) {
  if (!rows || !rows.length) return null
  const last = rows[rows.length - 1], prev = rows.length > 1 ? rows[rows.length - 2] : null, t = last.time
  const from = (months, years) => { const s = minus(t, months, years); return rows[0].time <= s ? closeAt(rows, s) : null }
  const y0 = closeAt(rows, `${+t.slice(0, 4) - 1}-12-31`)
  const returns = { '1M': ret(from(1, 0), last), '3M': ret(from(3, 0), last), '6M': ret(from(6, 0), last), YTD: ret(y0, last), '1Y': ret(from(0, 1), last), '3Y': ret(from(0, 3), last), '5Y': ret(from(0, 5), last) }
  const s1 = minus(t, 0, 1), r1 = rows.filter(r => r.time > s1)
  let hi = null, lo = null
  for (const r of r1) { if (!hi || r.high > hi.v) hi = { v: r.high, t: r.time }; if (!lo || r.low < lo.v) lo = { v: r.low, t: r.time } }
  const lr = []
  for (let i = 1; i < r1.length; i++) if (r1[i - 1].close > 0 && r1[i].close > 0) lr.push(Math.log(r1[i].close / r1[i - 1].close))
  let vol = null
  if (lr.length >= 20) { const m = lr.reduce((a, b) => a + b, 0) / lr.length; vol = Math.sqrt(lr.reduce((a, b) => a + (b - m) ** 2, 0) / (lr.length - 1) * perYear) }
  let peak = -Infinity, mdd = r1.length > 1 ? 0 : null
  for (const r of r1) { peak = Math.max(peak, r.close); if (peak > 0) mdd = Math.min(mdd, r.close / peak - 1) }
  // retornos por ano civil: só anos com o fechamento do ano anterior na série
  const years = []
  for (let y = +rows[0].time.slice(0, 4) + 1; y <= +t.slice(0, 4); y++) {
    const a = closeAt(rows, `${y - 1}-12-31`), b = closeAt(rows, `${y}-12-31`)
    if (a && b && a.time.slice(0, 4) === String(y - 1) && b.time.slice(0, 4) === String(y)) years.push({ year: y, ret: ret(a, b), ytd: y === +t.slice(0, 4) })
  }
  return { last, chg1d: ret(prev, last), returns, hi, lo, vol, mdd, years }
}
