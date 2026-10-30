import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizePanel, encodeState, decodeState, initialState, normalizeState, DEFAULT_PANELS } from './launchpad.mjs'

const CODES = ['GP', 'DES', 'CDIE', 'WEI', 'LP', 'OVME']

test('sanitizePanel', () => {
  assert.equal(sanitizePanel('/quant-terminal/gp/petr4.sa/', CODES, '/quant-terminal'), 'gp/PETR4.SA')
  assert.equal(sanitizePanel('cdie', CODES), 'cdie')
  assert.equal(sanitizePanel('/gp/%5EBVSP/', CODES), 'gp/^BVSP')
  assert.equal(sanitizePanel('lp', CODES), null)
  assert.equal(sanitizePanel('xyz/PETR4.SA', CODES), null)
  assert.equal(sanitizePanel('gp/<script>', CODES), null)
  assert.equal(sanitizePanel('gp/A/B', CODES), null)
})
test('encode/decode ida e volta', () => {
  const s = { n: 4, panels: ['gp/^BVSP', 'cdie', 'ovme/PETR4.SA', 'wei'] }
  const enc = encodeState(s)
  assert.equal(enc, 'l=4&p=gp%2F%5EBVSP,cdie,ovme%2FPETR4.SA,wei')
  assert.deepEqual(decodeState('?' + enc, CODES), s)
})
test('decode completa e valida', () => {
  assert.equal(decodeState('', CODES), null)
  assert.deepEqual(decodeState('?l=9&p=des%2FVALE3.SA', CODES), { n: 2, panels: ['des/VALE3.SA', ...DEFAULT_PANELS.slice(1)] })
})
test('initialState: URL > storage > padrão', () => {
  const st = JSON.stringify({ n: 4, panels: ['wei', 'cdie', 'gp/PETR4.SA', 'des/VALE3.SA'] })
  assert.equal(initialState('?l=2&p=cdie', st, CODES).panels[0], 'cdie')
  assert.equal(initialState('', st, CODES).n, 4)
  assert.deepEqual(initialState('', 'lixo{', CODES), normalizeState(null, CODES))
})
