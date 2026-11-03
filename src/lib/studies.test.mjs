import test from 'node:test'
import assert from 'node:assert/strict'
import { heikinAshi, bollinger, volumeProfile, priceDecimals } from './studies.mjs'

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`)
const bars = [
  { time: '2026-01-02', open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { time: '2026-01-05', open: 11, high: 13, low: 10.5, close: 12.5, volume: 200 },
  { time: '2026-01-06', open: 12.5, high: 12.6, low: 10, close: 10.2, volume: 300 },
]

test('Heikin-Ashi: fórmula barra a barra', () => {
  const h = heikinAshi(bars)
  near(h[0].close, (10 + 12 + 9 + 11) / 4); near(h[0].open, (10 + 11) / 2)
  near(h[0].high, 12); near(h[0].low, 9)
  near(h[1].open, (h[0].open + h[0].close) / 2); near(h[1].close, (11 + 13 + 10.5 + 12.5) / 4)
  near(h[1].high, Math.max(13, h[1].open, h[1].close)); near(h[1].low, Math.min(10.5, h[1].open, h[1].close))
  near(h[2].open, (h[1].open + h[1].close) / 2)
  assert.equal(h.length, 3); assert.equal(h[2].time, '2026-01-06')
  assert.deepEqual(heikinAshi([]), [])
})

test('Bollinger: média ± 2σ populacional; começa na n-ésima barra', () => {
  const rows = [1, 2, 3, 4, 5].map((c, i) => ({ time: `t${i}`, close: c }))
  const b = bollinger(rows, 3, 2)
  assert.equal(b.length, 3); assert.equal(b[0].time, 't2')
  near(b[0].mid, 2); near(b[0].upper, 2 + 2 * Math.sqrt(2 / 3)); near(b[0].lower, 2 - 2 * Math.sqrt(2 / 3))
  near(b[2].mid, 4)
  const flat = bollinger([5, 5, 5].map((c, i) => ({ time: `${i}`, close: c })), 3)
  near(flat[0].upper, 5); near(flat[0].lower, 5)
})

test('perfil de volume: conserva o volume, POC e área de valor ≥ 70%', () => {
  const vp = volumeProfile(bars, 4)
  near(vp.lo, 9); near(vp.hi, 13); near(vp.step, 1)
  near(vp.total, 600)
  near(vp.bins.reduce((s, b) => s + b.vol, 0), 600)
  // bin 1 (10–11) recebe parte das três barras → POC
  assert.equal(vp.poc, 1)
  const inVA = vp.bins.filter(b => b.inVA).reduce((s, b) => s + b.vol, 0)
  assert.ok(inVA >= 0.7 * 600)
  assert.ok(vp.vaLo <= vp.poc && vp.vaHi >= vp.poc)
  assert.equal(volumeProfile([]), null)
  assert.equal(volumeProfile([{ time: 'a', open: 1, high: 1, low: 1, close: 1, volume: 5 }]), null)
})

test('casas decimais: 4 só para séries de preço baixo', () => {
  assert.equal(priceDecimals([{ close: 7.64, high: 7.7 }, { close: 59.68, high: 60 }]), 2)
  assert.equal(priceDecimals([{ close: 5.31, high: 5.4 }]), 4)
  assert.equal(priceDecimals([]), 2)
})
