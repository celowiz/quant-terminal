import test from 'node:test'
import assert from 'node:assert/strict'
import { rulerStats, rulerNext } from './ruler.mjs'
import { buildEvents, snapTime, eventsByBar, eventMarkers, EVENT_KINDS } from './chartEvents.mjs'

const rows = [['2026-01-02', 10], ['2026-01-05', 11], ['2026-01-06', 12.1], ['2026-01-07', 9.9], ['2026-01-09', 12]].map(([time, close]) => ({ time, close }))

test('ruler: variação absoluta e %, pregões e dias corridos', () => {
  const r = rulerStats(rows, '2026-01-02', '2026-01-06')
  assert.equal(r.from, '2026-01-02'); assert.equal(r.to, '2026-01-06')
  assert.ok(Math.abs(r.abs - 2.1) < 1e-9); assert.ok(Math.abs(r.pct - 21) < 1e-9)
  assert.equal(r.sessions, 2); assert.equal(r.days, 4); assert.equal(r.up, true)
})
test('ruler: ordem invertida, queda e data sem pregão (vale a barra anterior)', () => {
  const r = rulerStats(rows, '2026-01-08', '2026-01-06')   // 08 não tem pregão → 07
  assert.equal(r.from, '2026-01-06'); assert.equal(r.to, '2026-01-07')
  assert.equal(r.sessions, 1); assert.equal(r.up, false); assert.ok(r.pct < 0)
  assert.equal(rulerStats(rows, '2026-01-02', null), null)
  assert.equal(rulerStats([], 'a', 'b'), null)
  assert.equal(rulerStats(rows, '2025-12-01', '2026-01-02').sessions, 0)
})
test('ruler: ciclo de cliques', () => {
  assert.deepEqual(rulerNext([], 'a'), ['a'])
  assert.deepEqual(rulerNext(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(rulerNext(['a', 'b'], 'c'), ['c'])
})

const times = rows.map(r => r.time)
test('evento → pregão: mesma data, fim de semana/feriado vai ao seguinte, fora da faixa some', () => {
  assert.equal(snapTime(times, '2026-01-05'), '2026-01-05')
  assert.equal(snapTime(times, '2026-01-03'), '2026-01-05')     // sábado
  assert.equal(snapTime(times, '2026-01-08'), '2026-01-09')
  assert.equal(snapTime(times, '2026-01-10'), null)
  const evs = [
    { date: '2026-01-03', kind: 'D', text: 'x' }, { date: '2026-01-04', kind: 'F', text: 'y' }, { date: '2026-01-05', kind: 'D', text: 'z' },
    { date: '2025-12-30', kind: 'D', text: 'antes' }, { date: '2026-02-01', kind: 'N', text: 'futuro' },
  ]
  const m = eventsByBar(evs, times)
  assert.deepEqual([...m.keys()], ['2026-01-05'])
  assert.equal(m.get('2026-01-05').length, 3)
  const mk = eventMarkers(m)
  assert.deepEqual(mk.map(x => x.text), ['D', 'F'])      // um marcador por tipo por barra
  assert.equal(mk[0].shape, EVENT_KINDS.D.shape)
})
test('buildEvents: proventos, desdobramentos, resultados (BR press release / EUA 10-Q) e fatos', () => {
  const br = buildEvents({ dividends_full: [['2026-01-05', 0.5]], splits_full: [['2008-04-28', 2]], filings: [
    { date: '2026-01-06', cat: 'Dados Econômico-Financeiros', type: 'Press-release' }, { date: '2026-01-07', cat: 'Fato Relevante', subject: 'Fato' },
    { date: '2026-01-07', cat: 'Comunicado ao Mercado' }] }, null, 'PETR4.SA')
  assert.deepEqual(br.map(e => e.kind), ['F', 'R', 'D', 'S'])
  assert.equal(br.find(e => e.kind === 'D').text, 'R$ 0.5000')
  const us = buildEvents({ country: 'US', splits_full: [['2022-07-18', 20]], filings: [{ date: '2026-10-29', cat: '10-Q' }, { date: '2026-10-29', cat: '10-Q' }, { date: '2026-10-01', cat: '8-K' }] },
    { rows: [{ ticker: 'GOOGL', date: '2027-02-01', q: 'Q4' }] }, 'GOOGL')
  assert.deepEqual(us.map(e => e.kind), ['N', 'R', 'F', 'S'])
  assert.equal(us.find(e => e.kind === 'S').text, '20:1')
})
