import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeUrl, safeSite, safeDecode, safeLogo, readStoredJSON, validPortfolio, validLocalAlerts, isTicker } from './safe.mjs'

test('safeUrl aceita só http(s) absoluto', () => {
  assert.equal(safeUrl('https://www.rad.cvm.gov.br/x?a=1'), 'https://www.rad.cvm.gov.br/x?a=1')
  assert.equal(safeUrl(' http://example.com '), 'http://example.com/')
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.com', '/relative', 'https://user:pw@evil.com', 'https://', '', null, 42, {}])
    assert.equal(safeUrl(bad), undefined, String(bad))
})
test('safeSite completa domínio sem esquema', () => {
  assert.equal(safeSite('www.petrobras.com.br'), 'https://www.petrobras.com.br/')
  assert.equal(safeSite('https://ri.vale.com/'), 'https://ri.vale.com/')
  assert.equal(safeSite('javascript:alert(1)'), undefined)
  assert.equal(safeSite('not a site'), undefined)
})
test('safeDecode não lança', () => {
  assert.equal(safeDecode('PETR4.SA'), 'PETR4.SA')
  assert.equal(safeDecode('%5EBVSP'), '^BVSP')
  assert.equal(safeDecode('%E0%A4%A'), '%E0%A4%A')
})
test('safeLogo', () => {
  assert.equal(safeLogo('logos/PETR.png'), 'logos/PETR.png')
  for (const bad of ['../x.png', 'logos/../../x.png', 'https://evil/x.png', 'logos/a.svg', 'javascript:x', null]) assert.equal(safeLogo(bad), undefined)
})
const mem = o => ({ getItem: k => (k in o ? o[k] : null) })
test('readStoredJSON + validadores', () => {
  assert.deepEqual(readStoredJSON(mem({ p: '[{"cod":"PETR4","w":50},{"cod":"x<y","w":1},{"cod":"VALE3","w":"9"}]' }), 'p', validPortfolio, 'fb'), [{ cod: 'PETR4', w: 50 }])
  assert.equal(readStoredJSON(mem({ p: '{"a":1}' }), 'p', validPortfolio, 'fb'), 'fb')
  assert.equal(readStoredJSON(mem({ p: 'not json' }), 'p', validPortfolio, 'fb'), 'fb')
  assert.equal(readStoredJSON(mem({}), 'p', validPortfolio, 'fb'), 'fb')
  assert.equal(readStoredJSON({ getItem() { throw new Error('denied') } }, 'p', validPortfolio, 'fb'), 'fb')
  assert.deepEqual(validLocalAlerts([{ id: '1', ticker: 'PETR4.SA', op: 'above', value: 60, x: 1 }, { id: '2', ticker: '<img>', op: 'above', value: 1 }, { id: '3', ticker: 'VALE3.SA', op: 'eval', value: 1 }]),
    [{ id: '1', ticker: 'PETR4.SA', op: 'above', value: 60 }])
  assert.equal(validLocalAlerts('x'), undefined)
})
test('isTicker', () => {
  for (const ok of ['PETR4.SA', '^BVSP', 'BRL=X', 'DX-Y.NYB', 'BTC-USD']) assert.ok(isTicker(ok), ok)
  for (const bad of ['', 'a b', '<script>', 'PETR4.SA/../x', 'X'.repeat(30)]) assert.ok(!isTicker(bad), bad)
})
