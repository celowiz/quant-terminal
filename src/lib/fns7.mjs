/** Matemática pura das telas FWCV, VAR, FRNT, BTST e SVOL (sem React, testada em fns7.test.mjs). */

// ---------- curvas e taxas a termo ----------
/** curva a partir de [prazo em anos, taxa % a.a.]; comp 'annual' (efetiva) ou 'cont' (contínua).
 *  Guarda o log do fator de desconto em cada vértice; entre vértices interpola linear (forward constante). */
export function curveFrom(points, comp = 'annual') {
  const pts = points.filter(p => p[0] > 0 && p[1] != null && isFinite(p[1])).map(p => [+p[0], +p[1]]).sort((a, b) => a[0] - b[0])
  const ln = pts.map(([t, y]) => comp === 'cont' ? -t * y / 100 : -t * Math.log(1 + y / 100))
  return { pts, t: [0, ...pts.map(p => p[0])], ln: [0, ...ln], tmax: pts.length ? pts[pts.length - 1][0] : 0 }
}
/** curva DI: [dias úteis, taxa % a.a.] → anos = du/252, capitalização efetiva anual */
export const curveFromDI = (pairs) => curveFrom(pairs.map(([du, r]) => [du / 252, r]), 'annual')
export const matYears = (m) => { const v = parseFloat(m); return /M$/i.test(m) ? v / 12 : v }
export function lnD(c, x) {
  if (x < 0 || x > c.tmax + 1e-9 || c.t.length < 2) return null
  for (let i = 1; i < c.t.length; i++) if (x <= c.t[i] + 1e-12) { const a = c.t[i - 1], b = c.t[i]; return c.ln[i - 1] + (c.ln[i] - c.ln[i - 1]) * (x - a) / (b - a) }
  return c.ln[c.ln.length - 1]
}
/** taxa a termo efetiva anual (%) de a até b anos: (D(a)/D(b))^(1/(b−a)) − 1 */
export function fwd(c, a, b) {
  if (!(b > a)) return null
  const la = lnD(c, a), lb = lnD(c, b)
  return la == null || lb == null ? null : (Math.exp((la - lb) / (b - a)) - 1) * 100
}

// ---------- estatística ----------
const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length
const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)) }
/** quantil empírico com interpolação linear (tipo 7) */
export function quant(x, p) {
  const s = [...x].sort((a, b) => a - b), h = (s.length - 1) * p, i = Math.floor(h)
  return i + 1 < s.length ? s[i] + (h - i) * (s[i + 1] - s[i]) : s[i]
}
/** inversa da normal padrão (Acklam) */
export function invNorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - lo) return -invNorm(1 - p)
  const q = p - 0.5, r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}
const phi = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)

export function histogram(x, bins = 40) {
  if (!x.length) return null
  let lo = Math.min(...x), hi = Math.max(...x)
  if (hi === lo) { lo -= 1; hi += 1 }
  const w = (hi - lo) / bins, counts = new Array(bins).fill(0)
  for (const v of x) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++
  return { lo, hi, w, counts }
}

/** retornos simples diários nas datas em que todos os ativos têm fechamento hoje e ontem; últimos maxN */
export function alignedReturns(dates, closes, maxN) {
  const dd = [], rets = []
  for (let i = 1; i < dates.length; i++) {
    const r = []
    for (const c of closes) { const a = c[i - 1], b = c[i]; if (a == null || b == null || !(a > 0) || !(b > 0)) { r.length = 0; break } r.push(b / a - 1) }
    if (r.length === closes.length && r.length) { dd.push(dates[i]); rets.push(r) }
  }
  if (!rets.length) return null
  const k = Math.max(0, rets.length - maxN)
  return { dates: dd.slice(k), rets: rets.slice(k) }
}

/** VaR/ES de um dia como fração positiva de perda; c = confiança (0.95, 0.99) */
export function varStats(x, c) {
  const q = quant(x, 1 - c), tail = x.filter(v => v <= q)
  const m = mean(x), s = sd(x), z = invNorm(c)
  return { hVar: -q, hEs: -mean(tail), pVar: -(m - z * s), pEs: -(m - s * phi(z) / (1 - c)), sd: s, mu: m, worst: Math.min(...x) }
}
export function covMatrix(rets) {
  const k = rets[0].length, N = rets.length, m = new Array(k).fill(0)
  for (const r of rets) for (let i = 0; i < k; i++) m[i] += r[i] / N
  const S = Array.from({ length: k }, () => new Array(k).fill(0))
  for (const r of rets) for (let i = 0; i < k; i++) for (let j = i; j < k; j++) S[i][j] += (r[i] - m[i]) * (r[j] - m[j]) / (N - 1)
  for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) S[i][j] = S[j][i]
  return { m, S }
}
const mv = (S, w) => S.map(row => row.reduce((s, v, j) => s + v * w[j], 0))
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0)
/** participação de cada ativo na variância da carteira: wᵢ(Σw)ᵢ / wᵀΣw (soma 1) */
export function componentVar(rets, w) {
  const { S } = covMatrix(rets), Sw = mv(S, w), v = dot(w, Sw)
  return w.map((wi, i) => wi * Sw[i] / v)
}
/** VaR histórico de 1 dia com janela móvel `win`, testado no último ano (≤ 252 dias) */
export function rollingVar(port, dates, win, c) {
  const pts = []
  for (let i = Math.max(win, port.length - 252); i < port.length; i++) {
    const v = -quant(port.slice(i - win, i), 1 - c)
    pts.push({ t: dates[i], r: port[i], v, hit: port[i] < -v })
  }
  return { pts, breaches: pts.filter(p => p.hit).length, expected: pts.length * (1 - c) }
}

// ---------- fronteira eficiente (só comprado, 100% investido) ----------
export function moments(rets) {
  const { m, S } = covMatrix(rets)
  return { mu: m.map(v => v * 252), cov: S.map(r => r.map(v => v * 252)) }
}
/** taxa anual equivalente a uma lista de taxas diárias (frações) */
export const annualizeDaily = (r) => Math.exp(r.reduce((s, v) => s + Math.log(1 + v), 0) * 252 / r.length) - 1
/** projeção euclidiana no simplex {w ≥ 0, Σw = 1} */
export function projSimplex(v) {
  const u = [...v].sort((a, b) => b - a); let css = 0, th = 0
  for (let i = 0; i < u.length; i++) { css += u[i]; const t = (css - 1) / (i + 1); if (u[i] - t > 0) th = t }
  return v.map(x => Math.max(0, x - th))
}
export const stats = (w, mu, cov) => ({ w, ret: dot(w, mu), vol: Math.sqrt(Math.max(0, dot(w, mv(cov, w)))) })
/** maximiza μᵀw − (λ/2)wᵀΣw por gradiente projetado; λ = Infinity dá a mínima variância */
export function solve(mu, cov, lam, w0, iters = 4000) {
  const L = Math.max(...cov.map(r => r.reduce((s, v) => s + Math.abs(v), 0))) || 1
  const minv = !isFinite(lam), step = minv ? 1 / L : 1 / (lam * L)
  let w = w0 ? [...w0] : new Array(mu.length).fill(1 / mu.length)
  for (let it = 0; it < iters; it++) {
    const Sw = mv(cov, w)
    const nw = projSimplex(w.map((x, i) => x + step * ((minv ? 0 : mu[i]) - (minv ? 1 : lam) * Sw[i])))
    let d = 0; for (let i = 0; i < w.length; i++) d = Math.max(d, Math.abs(nw[i] - w[i]))
    w = nw; if (d < 1e-10) break
  }
  return w
}
/** pontos da fronteira, da mínima variância até o ativo de maior retorno, ordenados por volatilidade */
export function frontier(mu, cov, K = 60) {
  const mvw = solve(mu, cov, Infinity), out = [stats(mvw, mu, cov)]
  let w = mvw
  for (let k = 0; k < K; k++) {
    const lam = Math.pow(10, 3 - 3.5 * k / (K - 1))   // 1000 → ~0.3
    w = solve(mu, cov, lam, w)
    const s = stats(w, mu, cov)
    if (s.ret > out[out.length - 1].ret + 1e-9) out.push(s)
  }
  return out.sort((a, b) => a.vol - b.vol)
}
export function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
/** carteiras aleatórias (pesos exponenciais ao cubo, normalizados), com semente fixa */
export function randomPortfolios(mu, cov, count, seed = 1) {
  const r = mulberry32(seed), out = []
  for (let k = 0; k < count; k++) {
    const e = mu.map(() => (-Math.log(1 - r())) ** 3), s = e.reduce((a, b) => a + b, 0)
    out.push(stats(e.map(x => x / s), mu, cov))
  }
  return out
}

// ---------- backtest ----------
function smaArr(c, w) {
  const out = new Array(c.length).fill(null); let s = 0
  for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= w) s -= c[i - w]; if (i >= w - 1) out[i] = s / w }
  return out
}
/** sinal no fechamento de cada dia: 1 comprado, 0 fora, null sem histórico suficiente */
export function signals(c, p) {
  if (p.kind === 'sma') { const f = smaArr(c, p.fast), s = smaArr(c, p.slow); return c.map((_, i) => f[i] == null || s[i] == null ? null : f[i] > s[i] ? 1 : 0) }
  return c.map((v, i) => i < p.look ? null : v > c[i - p.look] ? 1 : 0)
}
function summary(eq, cdiOf, t, held) {
  const r = eq.slice(1).map((v, i) => v / eq[i] - 1), ex = r.map((v, i) => v - cdiOf(t[i + 1]))
  let pk = eq[0], mdd = 0; for (const v of eq) { pk = Math.max(pk, v); mdd = Math.min(mdd, v / pk - 1) }
  const s = sd(r), se = sd(ex)
  return { total: eq[eq.length - 1] / eq[0] - 1, cagr: Math.pow(eq[eq.length - 1] / eq[0], 252 / r.length) - 1, vol: s * Math.sqrt(252), sharpe: se > 0 ? mean(ex) / se * Math.sqrt(252) : null, mdd: mdd * 100, expo: held == null ? 1 : held }
}
/** posição do dia i = sinal do fechamento i−1; custo `cost` (fração) a cada compra/venda; fora do mercado rende
 *  o CDI do dia se `cashEarns`. cdi: Map data → taxa diária (fração), também usado no Sharpe. */
export function backtest(t, c, sig, from, cost, cdi, cashEarns = true) {
  let s = t.findIndex((d, i) => d >= from && sig[i] != null)
  if (s < 0 || t.length - s < 20) return null
  const cdiOf = (d) => cdi?.get(d) ?? 0
  const eq = [100], bh = [100], trades = []
  let pos = 0, held = 0, open = null
  for (let i = s + 1; i < t.length; i++) {
    const want = sig[i - 1] ?? 0
    let e = eq[eq.length - 1]
    if (want !== pos) { e *= 1 - cost; if (want) open = { in: t[i - 1], px: c[i - 1] }; else if (open) { trades.push({ in: open.in, out: t[i - 1], ret: (c[i - 1] / open.px) * (1 - cost) ** 2 - 1 }); open = null } pos = want }
    e *= pos ? c[i] / c[i - 1] : 1 + (cashEarns ? cdiOf(t[i]) : 0)
    held += pos; eq.push(e); bh.push(100 * c[i] / c[s])
  }
  if (open) trades.push({ in: open.in, out: null, ret: (c[c.length - 1] / open.px) * (1 - cost) - 1 })
  const tt = t.slice(s), closed = trades.filter(x => x.out)
  let pk = 0
  return {
    s: summary(eq, cdiOf, tt, held / (eq.length - 1)), b: summary(bh, cdiOf, tt, null),
    eq: eq.map((v, i) => ({ time: tt[i], value: v })), bh: bh.map((v, i) => ({ time: tt[i], value: v })),
    dd: eq.map((v, i) => { pk = Math.max(pk, v); return { time: tt[i], value: (v / pk - 1) * 100 } }),
    trades, win: closed.length ? closed.filter(x => x.ret > 0).length / closed.length : null, to: t[t.length - 1],
  }
}

// ---------- volatilidade ----------
export const logRets = (c) => c.slice(1).map((v, i) => Math.log(v / c[i]))
/** vol realizada anualizada (%) das últimas w sessões */
export const realVol = (lr, w) => lr.length < w || w < 2 ? null : sd(lr.slice(-w)) * Math.sqrt(252) * 100
export function rollingVol(lr, w) { return lr.map((_, i) => i + 1 < w ? null : sd(lr.slice(i + 1 - w, i + 1)) * Math.sqrt(252) * 100) }
/** vol implícita em `d` dias úteis interpolando a variância total entre os vencimentos vizinhos; sem extrapolar */
export function ivAtDays(term, d) {
  const s = [...term].sort((a, b) => a.bdays - b.bdays)
  for (let i = 0; i < s.length; i++) {
    if (s[i].bdays === d) return s[i].iv
    if (s[i].bdays > d) { if (!i) return null; const a = s[i - 1], b = s[i]; const va = a.iv ** 2 * a.bdays, vb = b.iv ** 2 * b.bdays; return Math.sqrt((va + (vb - va) * (d - a.bdays) / (b.bdays - a.bdays)) / d) }
  }
  return null
}
