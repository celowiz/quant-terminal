// Black-Scholes-Merton (OVME). Módulo puro (.mjs) para ser testado com `node --test` sem bundler.

/** CDF normal (Abramowitz–Stegun 7.1.26 via erf; erro absoluto < 1,5e-7) */
export const Nc = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2)
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2
}
export const npdf = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)

/** Black-Scholes-Merton: S, K, T (anos), r e q contínuos (decimal), σ (decimal). Theta por dia útil (/252), vega e rho por 1 p.p. */
export function bs(call, S, K, T, r, q, s) {
  if (!(S > 0 && K > 0 && T > 0 && s > 0)) return null
  const sq = s * Math.sqrt(T), d1 = (Math.log(S / K) + (r - q + s * s / 2) * T) / sq, d2 = d1 - sq
  const dq = Math.exp(-q * T), dr = Math.exp(-r * T)
  const price = call ? S * dq * Nc(d1) - K * dr * Nc(d2) : K * dr * Nc(-d2) - S * dq * Nc(-d1)
  const delta = call ? dq * Nc(d1) : dq * (Nc(d1) - 1)
  const gamma = dq * npdf(d1) / (S * sq), vega = S * dq * npdf(d1) * Math.sqrt(T) / 100
  const theta = (-(S * dq * npdf(d1) * s) / (2 * Math.sqrt(T)) + (call ? q * S * dq * Nc(d1) - r * K * dr * Nc(d2) : -q * S * dq * Nc(-d1) + r * K * dr * Nc(-d2))) / 252
  const rho = (call ? K * T * dr * Nc(d2) : -K * T * dr * Nc(-d2)) / 100
  return { price, delta, gamma, vega, theta, rho, d1, d2 }
}

/** vol implícita por bisseção (prêmio fora dos limites de não-arbitragem → null) */
export function impliedVol(call, prem, S, K, T, r, q) {
  if (!(prem > 0)) return null
  let lo = 1e-4, hi = 5
  const f = (s) => bs(call, S, K, T, r, q, s).price - prem
  if (f(lo) > 0 || f(hi) < 0) return null
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; if (hi - lo < 1e-7) break }
  return (lo + hi) / 2
}
