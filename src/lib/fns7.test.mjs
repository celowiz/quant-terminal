import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from './fns7.mjs'

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`)

test('forward de curva plana é a própria taxa; forward implícito reproduz a curva', () => {
  const flat = M.curveFrom([[1, 10], [5, 10]], 'annual')
  close(M.fwd(flat, 1, 3), 10)
  const c = M.curveFrom([[1, 10], [2, 12]], 'annual')
  close(M.fwd(c, 0, 2), 12)
  close(M.fwd(c, 1, 2), (1.12 ** 2 / 1.10 - 1) * 100)
  assert.equal(M.fwd(c, 1, 3), null)              // sem extrapolação
  const k = M.curveFrom([[1, 5]], 'cont')
  close(M.fwd(k, 0, 1), (Math.exp(0.05) - 1) * 100)
  close(M.curveFromDI([[252, 14]]).tmax, 1)
  close(M.matYears('6M'), 0.5); close(M.matYears('10Y'), 10)
})

test('VaR histórico, paramétrico e ES', () => {
  const x = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000)   // −5% … +4,9%
  const v = M.varStats(x, 0.95)
  close(v.hVar, -M.quant(x, 0.05))
  assert.ok(v.hEs >= v.hVar)
  close(M.invNorm(0.975), 1.959964, 1e-5)
  close(M.invNorm(0.01), -2.326348, 1e-5)
  assert.ok(v.pEs > v.pVar)
})

test('participação no risco soma 1 e backtest conta violações', () => {
  const r = M.mulberry32(3), rets = Array.from({ length: 300 }, () => [r() - 0.5, r() - 0.5, (r() - 0.5) * 2])
  const s = M.componentVar(rets, [0.3, 0.3, 0.4])
  close(s.reduce((a, b) => a + b, 0), 1)
  const port = rets.map(x => x[0]), bt = M.rollingVar(port, port.map((_, i) => String(i)), 250, 0.95)
  assert.equal(bt.pts.length, 50); close(bt.expected, 2.5)
  assert.equal(bt.breaches, bt.pts.filter(p => p.r < -p.v).length)
})

test('fronteira: simplex, mínima variância analítica para 2 ativos sem correlação', () => {
  const p = M.projSimplex([0.8, 0.6, -1]); close(p.reduce((a, b) => a + b, 0), 1); assert.ok(p.every(x => x >= 0))
  const cov = [[0.04, 0], [0, 0.01]], mu = [0.1, 0.05]
  const w = M.solve(mu, cov, Infinity)
  close(w[0], 0.2, 1e-4); close(w[1], 0.8, 1e-4)
  const fr = M.frontier(mu, cov, 30)
  assert.ok(fr.length > 5)
  for (let i = 1; i < fr.length; i++) assert.ok(fr[i].ret >= fr[i - 1].ret - 1e-9)
  close(fr[fr.length - 1].ret, 0.1, 2e-3)
  const rp = M.randomPortfolios(mu, cov, 10, 7); assert.equal(rp.length, 10)
  close(M.annualizeDaily(new Array(252).fill(0.0005)), 1.0005 ** 252 - 1)
})

test('backtest: sinal de ontem, custo e caixa no CDI, sem olhar o futuro', () => {
  const t = Array.from({ length: 40 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`)
  const c = t.map((_, i) => 100 * 1.01 ** i)
  const sig = c.map(() => 1)
  const cdi = new Map(t.map(d => [d, 0.0005]))
  const r = M.backtest(t, c, sig, t[0], 0.001, cdi)
  close(r.eq[r.eq.length - 1].value, 100 * 0.999 * 1.01 ** 39)
  close(r.s.expo, 1); assert.equal(r.trades.length, 1); assert.equal(r.trades[0].out, null)
  const off = M.backtest(t, c, c.map(() => 0), t[0], 0.001, cdi)
  close(off.eq[off.eq.length - 1].value, 100 * 1.0005 ** 39)
  close(off.s.expo, 0)
  // sinal que só liga no último dia não altera nada (posição começa no dia seguinte)
  const late = M.backtest(t, c, c.map((_, i) => i === 39 ? 1 : 0), t[0], 0, null, false)
  close(late.eq[late.eq.length - 1].value, 100)
  assert.deepEqual(M.signals([1, 2, 3, 2, 1], { kind: 'mom', look: 2 }), [null, null, 1, 0, 0])
  assert.deepEqual(M.signals([1, 2, 3, 4], { kind: 'sma', fast: 1, slow: 2 }), [null, 1, 1, 1])
})

test('vol realizada e interpolação em variância total', () => {
  const lr = [0.01, -0.01, 0.01, -0.01]
  close(M.realVol(lr, 4), Math.sqrt(4 / 3 * 1e-4) * Math.sqrt(252) * 100)
  assert.equal(M.realVol(lr, 5), null)
  const term = [{ bdays: 10, iv: 30 }, { bdays: 30, iv: 40 }]
  close(M.ivAtDays(term, 21), Math.sqrt((900 * 10 + (1600 * 30 - 900 * 10) * 11 / 20) / 21))
  assert.equal(M.ivAtDays(term, 5), null); assert.equal(M.ivAtDays(term, 40), null)
  assert.equal(M.rollingVol(lr, 3)[1], null)
})
