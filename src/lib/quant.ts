// Cálculos quantitativos client-side (sobre os JSON estáticos)
export type TV = { time: string; value: number }

export function ema(x: number[], n: number): (number | null)[] {
  const a = 2 / (n + 1); const out: (number | null)[] = []; let prev: number | null = null
  x.forEach((v, i) => {
    if (i < n - 1) { out.push(null); return }
    if (prev == null) { prev = x.slice(0, n).reduce((s, y) => s + y, 0) / n } else prev = a * v + (1 - a) * prev
    out.push(prev)
  })
  return out
}
export function macd(close: number[], f = 12, s = 26, sig = 9) {
  const ef = ema(close, f), es = ema(close, s)
  const m = close.map((_, i) => ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null)
  const first = m.findIndex(v => v != null)
  const sg: (number | null)[] = m.map(() => null)
  if (first >= 0) {
    const e = ema(m.slice(first) as number[], sig)
    e.forEach((v, i) => { sg[first + i] = v })
  }
  return { macd: m, signal: sg, hist: m.map((v, i) => v != null && sg[i] != null ? v - (sg[i] as number) : null) }
}
/** RSI de Wilder */
export function rsi(close: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = close.map(() => null)
  if (close.length <= n) return out
  let g = 0, l = 0
  for (let i = 1; i <= n; i++) { const d = close[i] - close[i - 1]; if (d > 0) g += d; else l -= d }
  g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  for (let i = n + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1]
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}
export const logret = (x: number[]) => x.slice(1).map((v, i) => Math.log(v / x[i]))
export function rollStd(r: number[], n: number): (number | null)[] {
  return r.map((_, i) => {
    if (i < n - 1) return null
    const w = r.slice(i - n + 1, i + 1), m = w.reduce((s, v) => s + v, 0) / n
    return Math.sqrt(w.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1))
  })
}
export function mean(x: number[]) { return x.reduce((s, v) => s + v, 0) / (x.length || 1) }
export function std(x: number[]) { const m = mean(x); return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, x.length - 1)) }
export function quantile(x: number[], q: number) {
  const s = x.slice().sort((a, b) => a - b); if (!s.length) return NaN
  const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p)
  return s[lo] + (s[hi] - s[lo]) * (p - lo)
}
export function regress(x: number[], y: number[]) {
  const n = x.length, mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  const beta = sxy / sxx, alpha = my - beta * mx
  const r2 = (sxy * sxy) / (sxx * syy)
  const resid = y.map((v, i) => v - alpha - beta * x[i])
  const se = Math.sqrt(resid.reduce((s, v) => s + v * v, 0) / (n - 2)) / Math.sqrt(sxx)
  return { beta, alpha, r2, corr: sxy / Math.sqrt(sxx * syy), se, n }
}
export function corr(x: number[], y: number[]) { return regress(x, y).corr }
/** alinha duas séries {time,value} pelas datas em comum */
export function align(a: TV[], b: TV[]) {
  const mb = new Map(b.map(p => [p.time, p.value]))
  const t: string[] = [], x: number[] = [], y: number[] = []
  a.forEach(p => { const v = mb.get(p.time); if (v != null) { t.push(p.time); x.push(p.value); y.push(v) } })
  return { t, a: x, b: y }
}
/** último ponto de cada semana (sexta) */
export function weekly(rows: TV[]) {
  const m = new Map<string, TV>()
  rows.forEach(r => {
    const d = new Date(r.time + 'T12:00:00Z'); const add = (5 - d.getUTCDay() + 7) % 7
    m.set(new Date(d.getTime() + add * 864e5).toISOString().slice(0, 10), r)
  })
  return Array.from(m.values())
}
export function monthEnds(rows: TV[]) {
  const m = new Map<string, TV>(); rows.forEach(r => m.set(r.time.slice(0, 7), r)); return Array.from(m.values())
}
/** retornos mensais (%) por ano/mês */
export function monthlyReturns(rows: TV[]) {
  const me = monthEnds(rows); const out: { y: number; m: number; r: number }[] = []
  for (let i = 1; i < me.length; i++) out.push({ y: +me[i].time.slice(0, 4), m: +me[i].time.slice(5, 7), r: (me[i].value / me[i - 1].value - 1) * 100 })
  return out
}
export function maxDrawdown(v: number[]) { let pk = -Infinity, dd = 0; v.forEach(x => { pk = Math.max(pk, x); dd = Math.min(dd, x / pk - 1) }); return dd * 100 }
