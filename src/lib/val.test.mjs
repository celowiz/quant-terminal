import test from 'node:test'
import assert from 'node:assert/strict'
import { sectorName, ebitdaOf, pxAt, companyMcap, classOf, multiple, diverges, dedupePeers } from './val.mjs'

test('sector names curated EN/PT', () => {
  assert.equal(sectorName('Financ e Outros / Interms Financs', false), 'Financials and others · Financial intermediaries')
  assert.equal(sectorName('Financ e Outros / Interms Financs', true), 'Financeiro e outros · Intermediários financeiros')
  assert.equal(sectorName('Cons N  Básico / Alimentos Processados', true), 'Consumo não cíclico · Alimentos processados')
  assert.equal(sectorName('Diversos', false), 'Diversified')
  assert.equal(sectorName('Banks - Diversified', true), 'Bancos diversificados')
  assert.equal(sectorName('Banks - Diversified', false), 'Banks – Diversified')
})
test('EBITDA: reported, else EBIT + D&A (derived), else null', () => {
  assert.deepEqual(ebitdaOf({ ebitda: 10 }), { v: 10, derived: false })
  assert.deepEqual(ebitdaOf({ ebit: 7, da: 3 }), { v: 10, derived: true })
  assert.deepEqual(ebitdaOf({ ebit: 7, da: null }), { v: null, derived: false })
})
test('company market cap sums share classes', () => {
  const sh = { on: 100, pn: 50, total: 150, treasury: 0 }
  const s3 = [['2026-01-01', 10]], s4 = [['2026-01-01', 8]]
  assert.equal(companyMcap(sh, '2026-02-01', { series: s4, kind: 'pn' }, { on: s3 }, false).v, 1400)
  assert.equal(companyMcap(sh, '2026-02-01', { series: s3, kind: 'on' }, { pn: s4 }, false).v, 1400)
  assert.equal(companyMcap(sh, '2026-02-01', { series: s4, kind: 'pn' }, {}, false).reason, 'class')
  assert.equal(companyMcap({ equiv: null }, '2026-02-01', { series: s3, kind: 'unit' }, {}, false).reason, 'unit')
  assert.equal(companyMcap({ total: 10, treasury: 0 }, '2026-02-01', { series: s3, kind: null }, {}, true).v, 100)
  assert.equal(pxAt(s3, '2025-12-31'), null)
})
test('classes, n.m. multiples, divergence, peer dedupe', () => {
  assert.equal(classOf('PETR4.SA').kind, 'pn'); assert.equal(classOf('PETR3.SA').base, 'PETR'); assert.equal(classOf('BPAC11.SA').kind, 'unit')
  assert.equal(multiple(100, -5), 'nm'); assert.equal(multiple(100, 4), 25); assert.equal(multiple(null, 4), null)
  assert.equal(diverges(7.81, 2.32), true); assert.equal(diverges(4.4, 4.49), false); assert.equal(diverges(null, 2), false)
  const r = dedupePeers([{ c: 'A', t: 'PETR4', v: 9 }, { c: 'A', t: 'PETR3', v: 2 }, { c: 'B', t: 'VALE3', v: 5 }], x => x.c, x => x.v)
  assert.deepEqual(r.map(x => x.t), ['PETR4', 'VALE3'])
})
