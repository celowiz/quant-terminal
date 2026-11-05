import test from 'node:test'
import assert from 'node:assert/strict'
import { accountName, relLevels, yearAgoIndex, yoyChange, newestFirst, chartPoints, tabName, US_PT } from './fa.mjs'

test('BR account names: curated EN, PT as filed, company-specific lines flagged', () => {
  assert.deepEqual(accountName({ code: '3.03', name: 'Resultado Bruto' }, false, false), { text: 'Gross profit', asFiled: false })
  assert.equal(accountName({ code: '3.03', name: 'Resultado Bruto' }, false, true).text, 'Resultado Bruto')
  assert.equal(accountName({ code: '6.02.06', name: 'Aquisição de direito exploratório' }, false, false).asFiled, true)
  assert.equal(accountName({ code: 'gross', name: 'Gross profit' }, true, true).text, 'Lucro bruto')
  assert.equal(tabName('DFC_MI', 'x', true), 'Fluxo de caixa')
})

test('relative levels start at 1 (BR income statement starts at level 2)', () => {
  assert.deepEqual(relLevels([{ level: 2 }, { level: 3 }]).map(r => r.rel), [1, 2])
})

test('year-ago index works for yearly, quarterly and gaps', () => {
  assert.equal(yearAgoIndex(['2024-12-31', '2025-12-31'], 1), 0)
  const q = ['2024-09-30', '2024-12-31', '2025-03-31', '2025-06-30', '2025-09-30']
  assert.equal(yearAgoIndex(q, 4), 0)
  assert.equal(yearAgoIndex(['2023-12-31', '2025-12-31'], 1), -1)
})

test('YoY: magnitude change + effect direction; sign flip is not meaningful', () => {
  { const r = yoyChange(-120, -100); assert.ok(Math.abs(r.pct - 20) < 1e-9 && r.dir === -1 && !r.nm) }   // custo maior: +20% em tamanho, efeito negativo
  assert.equal(yoyChange(120, 100).dir, 1)
  assert.equal(yoyChange(10, -5).nm, true)
  assert.equal(yoyChange(null, 5), null)
})

test('newest first, chart skips gaps (no zeros)', () => {
  assert.deepEqual(newestFirst(['a', 'b', 'c']), [2, 1, 0])
  assert.deepEqual(chartPoints(['a', 'b', 'c'], [1e6, null, 3e6]), [{ time: 'a', value: 1 }, { time: 'c', value: 3 }])
  assert.ok(Object.keys(US_PT).length > 50)
})
