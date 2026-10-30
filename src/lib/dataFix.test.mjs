import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanUniverse, lastValid } from './dataFix.mjs'

test('cleanUniverse corta a barra final sem ações', () => {
  const u = { dates: ['a', 'b', 'c'], close: { '^BVSP': [1, 2, 3], PETR4: [1, 2, null], VALE3: [1, 2, null], ITUB4: [1, 2, 3] }, fin_volume_30d: { PETR4: [5, 6, 0] } }
  const c = cleanUniverse(u)
  assert.deepEqual(c.dates, ['a', 'b'])
  assert.deepEqual(c.close.PETR4, [1, 2])
  assert.deepEqual(c.close['^BVSP'], [1, 2])
  assert.deepEqual(c.fin_volume_30d.PETR4, [5, 6])
  assert.equal(c.trimmed, 1)
})
test('cleanUniverse mantém quando a cobertura é suficiente', () => {
  const u = { dates: ['a', 'b'], close: { PETR4: [1, 2], VALE3: [1, null] } }
  assert.equal(cleanUniverse(u), u)
})
test('lastValid', () => {
  assert.equal(lastValid([1, null, 3, null]), 2)
  assert.equal(lastValid([null, null]), -1)
  assert.equal(lastValid([1, 2, 3], 1), 1)
})
