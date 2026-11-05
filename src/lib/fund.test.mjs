import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepare, ttm, ratios, yoy, isOneOff, splitRows, last4 } from './fund.mjs'

const q = (p, o) => ({ period: p, ...o })
test('lucro bruto derivado só com receita e custo informados; banco não', () => {
  const f = prepare({ annual: [q('2025-12-31', { revenue: 100, cost: 40 }), q('2024-12-31', { revenue: 90 })], quarterly: [] })
  assert.equal(f.annual[0].gross, 60); assert.deepEqual(f.annual[0]._d, ['gross'])
  assert.equal(f.annual[1].gross, undefined)
  assert.equal(prepare({ bank_format: true, annual: [q('2025-12-31', { revenue: 100, cost: 40 })], quarterly: [] }).annual[0].gross, undefined)
  assert.equal(prepare({ annual: [q('2025-12-31', { revenue: 100, cost: 40, gross: 55 })], quarterly: [] }).annual[0].gross, 55)
})
test('D&A anual = soma dos 4 trimestres só quando todos informados', () => {
  const Q = [q('2025-03-31', { da: 1 }), q('2025-06-30', { da: 2 }), q('2025-09-30', { da: 3 }), q('2025-12-31', { da: 4 })]
  const f = prepare({ annual: [q('2025-12-31', { ebit: 10 })], quarterly: Q })
  assert.equal(f.annual[0].da, 10); assert.equal(f.annual[0].ebitda, 20); assert.deepEqual(f.annual[0]._d, ['da', 'ebitda'])
  const g = prepare({ annual: [q('2025-12-31', { ebit: 10 })], quarterly: Q.map((x, i) => i === 3 ? { ...x, da: null } : x) })
  assert.equal(g.annual[0].da, undefined); assert.equal(g.annual[0].ebitda, undefined)
})
test('TTM soma 4 trimestres consecutivos e usa o último saldo', () => {
  const Q = ['2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31'].map((p, i) => ({ period: p, net: i + 1, revenue: 10, equity: 100 + i, cost: null, _d: [] }))
  const t = ttm(Q); assert.equal(t.net, 10); assert.equal(t.revenue, 40); assert.equal(t.equity, 103); assert.equal(t.cost, null)
  assert.equal(last4([Q[0], Q[1], Q[3], { period: '2026-06-30' }]), null)
  const r = ratios([...Q, t], 'q')
  assert.equal(r[0].roe, 4); assert.equal(Math.round(r[3].roeTtm * 1000), Math.round(10 / 103 * 100000)); assert.equal(r[4].roe, r[4].roeTtm)
})
test('YoY contra o mesmo trimestre do ano anterior', () => {
  const R = [q('2025-06-30', { revenue: 100 }), q('2025-09-30', { revenue: 1 }), q('2026-06-30', { revenue: 120 })]
  assert.equal(yoy(R, 'revenue'), 20); assert.equal(yoy(R.slice(1), 'revenue'), null)
})
test('não recorrente e linhas vazias', () => {
  assert.equal(isOneOff({ pretax: 138753, ebit: 40770 }), true); assert.equal(isOneOff({ pretax: 41789, ebit: 30606 }), false); assert.equal(isOneOff({ pretax: 5, ebit: -1 }), false)
  const s = splitRows([['a'], ['b']], [{ a: 1, b: null }, { a: null }]); assert.deepEqual(s.shown, [['a']]); assert.deepEqual(s.hidden, [['b']])
})
