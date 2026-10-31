import test from 'node:test'
import assert from 'node:assert/strict'
import { marketStats, closeAt } from './marketStats.mjs'

const day = (i) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10)
const series = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: day(i), open: c, high: c * 1.01, low: c * 0.99, close: c } })

test('closeAt: último fechamento em ou antes da data; antes do início → null', () => {
  const r = series(10, i => 100 + i)
  assert.equal(closeAt(r, day(3)).close, 103)
  assert.equal(closeAt(r, '2019-12-31'), null)
})

test('marketStats: retornos, prazo sem histórico vira null, máx/mín 52 sem. e drawdown', () => {
  const r = series(800, i => 100 * (1 + i / 800))
  const s = marketStats(r, 365)
  assert.ok(Math.abs(s.returns['1Y'] - (r[799].close / closeAt(r, '2021-03-10').close - 1)) < 1e-12)
  assert.equal(s.returns['3Y'], null)
  assert.equal(s.returns['5Y'], null)
  assert.equal(s.mdd, 0)
  assert.equal(s.hi.t, r[799].time)
  assert.ok(s.vol > 0 && s.vol < 0.05)
  assert.ok(s.years.every(y => y.year >= 2021))           // 2020 não tem o fechamento de 2019 na série
})

test('marketStats: série vazia → null; drawdown negativo', () => {
  assert.equal(marketStats([]), null)
  const r = series(300, i => i < 150 ? 100 + i : 250 - (i - 150))
  assert.ok(marketStats(r).mdd < -0.5)
})
