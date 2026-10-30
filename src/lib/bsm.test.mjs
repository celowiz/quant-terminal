import test from 'node:test'
import assert from 'node:assert/strict'
import { bs, impliedVol, Nc } from './bsm.mjs'

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`)

test('OVME: CDF normal nos pontos de referência', () => {
  near(Nc(0), 0.5, 1e-7, 'N(0)'); near(Nc(1.96), 0.9750021, 2e-7, 'N(1.96)'); near(Nc(-1), 0.1586553, 2e-7, 'N(-1)')
})

test('OVME: preços BSM de referência (Hull) e paridade put-call', () => {
  // S=K=100, r=5%, σ=20%, T=1, sem dividendos: call 10,4506 · put 5,5735
  const c = bs(true, 100, 100, 1, 0.05, 0, 0.2), p = bs(false, 100, 100, 1, 0.05, 0, 0.2)
  near(c.price, 10.4506, 1e-4, 'call'); near(p.price, 5.5735, 1e-4, 'put')
  near(c.delta, 0.6368, 1e-4, 'delta call'); near(p.delta, 0.6368 - 1, 1e-4, 'delta put')
  near(c.gamma, 0.018762, 1e-5, 'gamma'); near(c.vega, 0.37524, 1e-4, 'vega / 1 p.p.')
  // Hull ex. 15.6: S=42, K=40, r=10%, σ=20%, T=0,5 → call 4,76 · put 0,81
  near(bs(true, 42, 40, 0.5, 0.1, 0, 0.2).price, 4.7594, 1e-3, 'Hull call'); near(bs(false, 42, 40, 0.5, 0.1, 0, 0.2).price, 0.8086, 1e-3, 'Hull put')
  // paridade com dividendo contínuo: C − P = S·e^(−qT) − K·e^(−rT)
  for (const [S, K, T, r, q, s] of [[30, 34, 0.25, 0.1475, 0.03, 0.45], [100, 80, 2, 0.02, 0.05, 0.3]]) {
    const C = bs(true, S, K, T, r, q, s).price, P = bs(false, S, K, T, r, q, s).price
    near(C - P, S * Math.exp(-q * T) - K * Math.exp(-r * T), 1e-6, `paridade S=${S} K=${K}`)
  }
})

test('OVME: vol implícita recupera o σ do prêmio (ida e volta) e rejeita prêmio sem arbitragem', () => {
  for (const [call, S, K, T, r, q, s] of [[true, 100, 100, 1, 0.05, 0, 0.2], [false, 30, 34, 0.25, 0.1475, 0.03, 0.45], [true, 42, 50, 0.1, 0.1, 0, 0.8]]) {
    const prem = bs(call, S, K, T, r, q, s).price
    near(impliedVol(call, prem, S, K, T, r, q), s, 1e-5, `IV ${call ? 'call' : 'put'} K=${K}`)
  }
  assert.equal(impliedVol(true, 0, 100, 100, 1, 0.05, 0), null)
  assert.equal(impliedVol(true, 0.5, 100, 50, 1, 0.05, 0), null)   // abaixo do valor intrínseco descontado
  assert.equal(impliedVol(true, 150, 100, 100, 1, 0.05, 0), null)  // acima de S: impossível
  assert.equal(bs(true, 100, 100, 0, 0.05, 0, 0.2), null)
})
