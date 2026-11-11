import test from 'node:test'
import assert from 'node:assert/strict'
import { adjAt, idxOnOrBefore, rangeOf, aggregate, liveAggregate, mergeClasses, groupBy, breadth, turnover, cumulative } from './mov.mjs'

const dates = ['2025-12-30', '2026-01-02', '2026-01-05', '2026-01-06']
const o = {
  dates, level: [100, 101, 99, 102],
  members: [{ cod: 'PETR3', name: 'PETROBRAS', root: 'PETR', sector: 'Petróleo', first: '2026-01-02', last: '2026-01-06', current: true },
    { cod: 'PETR4', name: 'PETROBRAS', root: 'PETR', sector: 'Petróleo', first: '2026-01-02', last: '2026-01-06', current: true },
    { cod: 'XYZ3', name: 'XYZ', root: 'XYZ3', sector: 'Outro', first: '2026-01-02', last: '2026-01-05', current: false }],
  px: { PETR3: [10, 11, 10, 12], PETR4: [20, 21, 20, 22], XYZ3: [5, 5, 4, 4] },
  adj: { PETR3: [[0, 1]], PETR4: [[0, 1]], XYZ3: [[0, 1]] },
  pts: { PETR3: [null, 0.6, -0.5, 1], PETR4: [null, 0.5, -0.9, 1.6], XYZ3: [null, 0, -0.5, null] },
  w: { PETR3: [null, 0.3, 0.3, 0.5], PETR4: [null, 0.5, 0.5, 0.5], XYZ3: [null, 0.2, 0.2, null] },
}

test('helpers', () => {
  assert.equal(adjAt([[0, 0.9], [5, 1]], 3), 0.9)
  assert.equal(adjAt([[0, 0.9], [5, 1]], 5), 1)
  assert.equal(idxOnOrBefore(dates, '2026-01-04'), 2 - 1)
  assert.equal(idxOnOrBefore(dates, '2025-01-01'), -1)
})

test('ranges: YTD base is the last close of the previous year; uncovered → null', () => {
  assert.deepEqual(rangeOf(dates, 'YTD'), { a: 0, b: 3 })
  assert.deepEqual(rangeOf(dates, '1D'), { a: 2, b: 3 })
  assert.deepEqual(rangeOf(dates, 'MTD'), { a: 0, b: 3 })
  assert.equal(rangeOf(dates, '1Y'), null)
  assert.deepEqual(rangeOf(dates, 'CUSTOM', { from: '2026-01-05', to: '2026-01-05' }), { a: 1, b: 2 })
  assert.equal(rangeOf(dates, 'CUSTOM', { from: '2025-06-01', to: '2026-01-05' }), null)
})

test('Points sum to the index change (residual by weight); raw kept', () => {
  const g = aggregate(o, 0, 3)
  const sum = g.rows.reduce((s, r) => s + r.pts, 0)
  assert.ok(Math.abs(sum - 2) < 1e-9)
  assert.equal(g.chg, 2)
  const raw = g.rows.reduce((s, r) => s + r.raw, 0)
  assert.ok(Math.abs(raw - 1.8) < 1e-9)
  assert.ok(Math.abs(g.resid - 0.2) < 1e-9)
  const x = g.rows.find(r => r.cod === 'XYZ3')
  assert.equal(x.left, '2026-01-05')
  assert.ok(Math.abs(x.ret - (-0.2)) < 1e-9)
  assert.equal(x.px, 4)
  assert.deepEqual(breadth(g.rows), { up: 2, down: 1, unch: 0 })
})

test('turnover and cumulative', () => {
  assert.deepEqual(turnover(o, 0, 3), { current: 2, added: [], removed: ['XYZ3'] })
  const c = cumulative(o, 0, 3, [['PETR3', 'PETR4']])
  assert.equal(c.index.at(-1)[1], 2)
  assert.equal(c.series[0].length, 3)
})

test('merge classes and group by sector', () => {
  const g = aggregate(o, 0, 3)
  const m = mergeClasses(g.rows)
  const p = m.find(r => r.cod === 'PETR3/PETR4')
  assert.ok(p && Math.abs(p.pts - g.rows.filter(r => r.root === 'PETR').reduce((s, r) => s + r.pts, 0)) < 1e-9)
  assert.equal(p.px, null)
  const s = groupBy(g.rows, r => r.sector)
  assert.equal(s.length, 2)
  assert.equal(s.find(r => r.cod === 'Petróleo').n, 2)
})

test('live: points from previous-close weights and delayed % change; sum = index change', () => {
  const r = liveAggregate({ A: 60, B: 40 }, { A: [10, 2], B: [5, -1] }, [1010, 1], null)
  const L0 = 1010 / 1.01
  assert.ok(Math.abs(r.chg - (1010 - L0)) < 1e-9)
  assert.ok(Math.abs(r.rows.reduce((s, x) => s + x.pts, 0) - r.chg) < 1e-9)
  assert.ok(Math.abs(r.rows.find(x => x.cod === 'A').raw - L0 * 0.6 * 0.02) < 1e-9)
  assert.equal(liveAggregate({ A: 1 }, {}, null, null), null)
  const miss = liveAggregate({ A: 50, B: 50 }, { A: [1, 1] }, [101, 1], null)
  assert.equal(miss.rows.find(x => x.cod === 'B').pts, null)
})
