// OSA – montador de estratégias com opções. Módulo puro (.mjs) testado com `node --test`.
import { bs } from './bsm.mjs'

/** perna: { kind: 'C'|'P'|'S', side: +1 compra / −1 venda, qty, K, prem (prêmio pago/recebido por unidade), T (anos até o vencimento), iv (decimal) } */
export const intrinsic = (leg, S) => leg.kind === 'S' ? S : leg.kind === 'C' ? Math.max(0, S - leg.K) : Math.max(0, leg.K - S)

/** custo de montagem: >0 = débito (paga), <0 = crédito (recebe) */
export const netCost = (legs) => legs.reduce((s, l) => s + l.side * l.qty * l.prem, 0)

/** valor da perna quando faltam tau anos para o vencimento (tau ≤ 0 = payoff) */
export function legValue(leg, S, tau, r) {
  if (leg.kind === 'S' || tau <= 1e-9) return intrinsic(leg, S)
  const g = bs(leg.kind === 'C', S, leg.K, tau, r, 0, leg.iv)
  return g ? g.price : intrinsic(leg, S)
}

/** resultado da estratégia ao preço S, `dt` anos à frente (0 = hoje) */
export function pnl(legs, S, dt, r) {
  return legs.reduce((s, l) => s + l.side * l.qty * (legValue(l, S, (l.kind === 'S' ? 0 : l.T) - dt, r) - l.prem), 0)
}

/** gregas líquidas hoje (delta e gamma por R$ do ativo; vega por 1 p.p.; theta por dia útil) */
export function greeks(legs, S, r) {
  const o = { delta: 0, gamma: 0, vega: 0, theta: 0 }
  for (const l of legs) {
    const k = l.side * l.qty
    if (l.kind === 'S') { o.delta += k; continue }
    const g = bs(l.kind === 'C', S, l.K, l.T, r, 0, l.iv)
    if (!g) continue
    o.delta += k * g.delta; o.gamma += k * g.gamma; o.vega += k * g.vega; o.theta += k * g.theta
  }
  return o
}

/** curva de P&L numa grade de preços + pontos de equilíbrio (cruzamentos de zero, interpolados) e extremos */
export function profile(legs, xs, dt, r) {
  const ys = xs.map(S => pnl(legs, S, dt, r))
  const be = []
  for (let i = 1; i < xs.length; i++) {
    const a = ys[i - 1], b = ys[i]
    if (a === 0 && (i === 1 || ys[i - 2] !== 0)) be.push(xs[i - 1])
    else if (a * b < 0) be.push(xs[i - 1] + (xs[i] - xs[i - 1]) * (-a) / (b - a))
  }
  const max = Math.max(...ys), min = Math.min(...ys)
  // inclinação na ponta de cima: perna sem limite (ex.: call vendida a descoberto); embaixo S ≥ 0 limita o resultado
  const n = xs.length, slopeHi = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2])
  return { ys, be, max, min, unlimitedUp: slopeHi > 1e-6, unlimitedDown: slopeHi < -1e-6 }
}

/** strike disponível mais próximo de x */
export const nearest = (strikes, x) => strikes.reduce((b, k) => (b == null || Math.abs(k - x) < Math.abs(b - x) ? k : b), null)

/** estruturas prontas: devolve pernas (sem prêmio) a partir dos strikes disponíveis e do spot */
export function preset(name, S, callK, putK, step = 0.05) {
  const c = (m) => nearest(callK, S * m), p = (m) => nearest(putK, S * m)
  const C = (side, K) => ({ kind: 'C', side, qty: 1, K }), P = (side, K) => ({ kind: 'P', side, qty: 1, K })
  switch (name) {
    case 'long_call': return [C(1, c(1))]
    case 'long_put': return [P(1, p(1))]
    case 'bull_call': return [C(1, c(1)), C(-1, c(1 + step))]
    case 'bear_put': return [P(1, p(1)), P(-1, p(1 - step))]
    case 'straddle': { const K = nearest(callK.filter(k => putK.includes(k)), S) ?? c(1); return [C(1, K), P(1, K)] }
    case 'strangle': return [C(1, c(1 + step)), P(1, p(1 - step))]
    case 'butterfly': { const m = c(1), lo = c(1 - step), hi = c(1 + step); return [C(1, lo), C(-1, m), C(-1, m), C(1, hi)] }
    case 'condor': return [P(1, p(1 - 2 * step)), P(-1, p(1 - step)), C(-1, c(1 + step)), C(1, c(1 + 2 * step))]
    case 'covered_call': return [{ kind: 'S', side: 1, qty: 1, K: 0 }, C(-1, c(1 + step))]
    case 'protective_put': return [{ kind: 'S', side: 1, qty: 1, K: 0 }, P(1, p(1 - step))]
    default: return []
  }
}
