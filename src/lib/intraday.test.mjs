import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionOf, dropTrailingSnapshot, hasVolume, sessions, vwapBands, windowStats, sessionStats } from './intraday.mjs'

const t0 = Date.UTC(2026, 10, 3, 13, 0) / 1000 // 10:00 BRT de 03/11/2026
const bar = (k, o, h, l, c, v, day = 0) => [t0 + day * 86400 + k * 60, o, h, l, c, v]

test('sessionOf usa o horário de Brasília', () => {
  assert.equal(sessionOf(t0), '2026-11-03')
  assert.equal(sessionOf(Date.UTC(2026, 10, 4, 2, 30) / 1000), '2026-11-03') // 23:30 BRT ainda é 03/11
})

test('dropTrailingSnapshot remove só a barra final plana e sem volume', () => {
  const B = [bar(0, 10, 11, 9, 10, 100), bar(1, 10, 10, 10, 10, 0)]
  assert.equal(dropTrailingSnapshot(B).length, 1)
  const C = [bar(0, 10, 11, 9, 10, 0), bar(1, 10, 10.5, 10, 10.2, 0)] // índice: sem volume, mas com variação → fica
  assert.equal(dropTrailingSnapshot(C).length, 2)
  assert.equal(dropTrailingSnapshot([bar(0, 1, 1, 1, 1, 0), bar(1, 1, 1, 1, 1, 0)]).length, 0)
  assert.equal(dropTrailingSnapshot([bar(0, 10, 11, 9, 10, 5), [t0, null, 1, 1, 1, 0]]).length, 1)
})

test('hasVolume / sessions', () => {
  const B = [bar(0, 10, 11, 9, 10, 0, 0), bar(1, 10, 11, 9, 10, 0, 1)]
  assert.equal(hasVolume(B), false)
  assert.deepEqual(sessions(B).map(s => s.day), ['2026-11-03', '2026-11-04'])
})

test('vwapBands: VWAP e σ ponderados pelo volume, reiniciando por pregão', () => {
  const B = [bar(0, 10, 10, 10, 10, 100), bar(1, 12, 12, 12, 12, 100), bar(0, 20, 20, 20, 20, 50, 1)]
  const r = vwapBands(B)
  assert.equal(r.length, 3)
  assert.equal(r[0].vwap, 10); assert.equal(r[0].sd, 0)
  assert.ok(Math.abs(r[1].vwap - 11) < 1e-9); assert.ok(Math.abs(r[1].sd - 1) < 1e-9)
  assert.equal(r[2].vwap, 20); assert.equal(r[2].sd, 0) // novo pregão
  assert.equal(vwapBands([bar(0, 10, 11, 9, 10, 0)]).length, 0) // sem volume → sem VWAP
})

test('windowStats / sessionStats', () => {
  const B = [bar(0, 10, 11, 9, 10.5, 100), bar(1, 10.5, 12, 10, 11, 300), bar(0, 11, 11.5, 10.8, 11.2, 10, 1)]
  const w = windowStats(B)
  assert.equal(w.high, 12); assert.equal(w.low, 9); assert.equal(w.open, 10); assert.equal(w.last, 11.2); assert.equal(w.n, 3); assert.equal(w.vol, 410)
  const s = sessionStats(B)
  assert.equal(s.length, 2)
  assert.equal(s[0].prevClose, null); assert.equal(s[1].prevClose, 11)
  assert.ok(Math.abs(s[1].chg - (11.2 / 11 - 1) * 100) < 1e-9)
  assert.equal(windowStats([]), null)
})
