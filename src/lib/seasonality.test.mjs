import test from 'node:test'
import assert from 'node:assert/strict'
import { monthly, weekly, dayOfWeek, stats, isoWeek, monthEnd, weekEnd, bestWorst } from './seasonality.mjs'

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`)

test('stats: vazio é null, sd exige n ≥ 2', () => {
  assert.deepEqual(stats([]), { n: 0, mean: null, median: null, sd: null, pos: null, min: null, max: null })
  const one = stats([2]); assert.equal(one.n, 1); assert.equal(one.mean, 2); assert.equal(one.sd, null); assert.equal(one.pos, 100)
  const s = stats([1, -1, 3, null]); assert.equal(s.n, 3); near(s.mean, 1); assert.equal(s.median, 1); near(s.sd, 2); near(s.pos, 200 / 3)
})

test('isoWeek / weekEnd / monthEnd', () => {
  assert.deepEqual(isoWeek('2021-01-01'), { y: 2020, w: 53 })
  assert.deepEqual(isoWeek('2021-01-04'), { y: 2021, w: 1 })
  assert.deepEqual(isoWeek('2024-12-30'), { y: 2025, w: 1 })
  assert.deepEqual(isoWeek('2026-11-03'), { y: 2026, w: 45 })
  assert.equal(weekEnd('2026-11-03'), '2026-11-06')
  assert.equal(weekEnd('2026-11-03', true), '2026-11-08')
  assert.equal(monthEnd(2026, 1), '2026-01-30') // 31/jan/2026 é sábado
  assert.equal(monthEnd(2026, 1, true), '2026-01-31')
})

test('bestWorst ignora nulos e exige 2 valores', () => {
  assert.deepEqual(bestWorst([null, 1, 3, -2]), { best: 2, worst: 3 })
  assert.deepEqual(bestWorst([null, 1]), { best: -1, worst: -1 })
})

// base 30/nov/2023; dez/2023 +5%; 2024–2025 alternando +10%/−5%; jan/2026 +2%; fev/2026 parcial (+1% até 02/02)
const rows = []
const add = (t, c) => rows.push({ time: t, close: c })
add('2023-11-29', 90); add('2023-11-30', 100); add('2023-12-29', 105)
let c = 105
for (let y = 2024; y <= 2025; y++) for (let m = 1; m <= 12; m++) { c *= m % 2 ? 1.1 : 0.95; add(monthEnd(y, m), c) }
const c25 = c
add('2026-01-30', c25 * 1.02); add('2026-02-02', c25 * 1.02 * 1.01)

test('monthly: base, MTD fora das estatísticas, tags de ano', () => {
  const M = monthly(rows)
  assert.deepEqual(M.years.map(y => y.y), [2026, 2025, 2024, 2023])
  const [y26, y25, y24, y23] = M.years
  assert.equal(y23.tag, 'partial'); near(y23.cells[11].r, 5); assert.equal(y23.cells[0], null)
  assert.equal(y24.tag, null); near(y24.ret, (1.1 ** 6 * 0.95 ** 6 - 1) * 100)
  assert.equal(y26.tag, 'ytd'); assert.equal(y26.cells[1].part, 'mtd'); near(y26.cells[1].r, 1); near(y26.ret, (1.02 * 1.01 - 1) * 100)
  assert.equal(M.partial, '2026-02')
  // fevereiro: 2024 e 2025 (−5%); o MTD de 2026 fica fora
  assert.equal(M.months[1].n, 2); near(M.months[1].mean, -5); near(M.months[1].sd, 0)
  assert.equal(M.months[0].n, 3) // jan 2024, 2025, 2026
  assert.equal(M.months[11].n, 3) // dez 2023, 2024, 2025
  assert.equal(M.months[2].n, 2)
  // coluna Ano: só anos completos (2024, 2025)
  assert.equal(M.year.n, 2)
  // melhor/pior mês do ano ignoram o MTD
  assert.equal(y26.best, -1)
  assert.equal(y24.best, 0); assert.equal(y24.worst, 1)
  assert.equal(M.complete, 26)
  const I = monthly(rows, { includePartial: true })
  assert.equal(I.months[1].n, 3)
})

test('monthly: mês fechado no último dia útil não é MTD; cripto usa dia corrido', () => {
  const r = [{ time: '2026-09-30', close: 10 }, { time: '2026-10-30', close: 11 }]
  assert.equal(monthly(r).partial, null)
  assert.equal(monthly(r, { allDays: true }).partial, '2026-10')
  assert.equal(monthly([]).years.length, 0)
  assert.equal(monthly([{ time: '2026-10-05', close: 1 }]).months[0].mean, null)
})

test('weekly: semana ISO e WTD', () => {
  const r = [
    { time: '2026-10-23', close: 100 }, // sexta, semana 43 (base)
    { time: '2026-10-30', close: 110 }, // semana 44
    { time: '2026-11-02', close: 99 }, { time: '2026-11-03', close: 104.5 }, // semana 45 parcial
  ]
  const W = weekly(r)
  const y = W.years[0]
  near(y.cells[43].r, 10); near(y.cells[44].r, -5); assert.equal(y.cells[44].part, 'wtd')
  assert.equal(W.weeks[44].n, 0); assert.equal(W.weeks[44].mean, null); assert.equal(W.weeks[43].n, 1); assert.equal(W.weeks[43].sd, null)
  assert.equal(weekly(r, { includePartial: true }).weeks[44].n, 1)
})

test('dayOfWeek: retorno diário pelo dia da data', () => {
  const r = [
    { time: '2026-10-30', close: 100 }, // sexta
    { time: '2026-11-02', close: 102 }, // segunda +2
    { time: '2026-11-03', close: 101.98 }, // terça −0,0196…
    { time: '2026-11-09', close: 104 }, // segunda (após feriado) vs terça anterior
  ]
  const D = dayOfWeek(r)
  assert.equal(D.n, 3)
  assert.equal(D.days[0].n, 2); near(D.days[0].mean, (2 + (104 / 101.98 - 1) * 100) / 2)
  assert.equal(D.days[1].n, 1); assert.equal(D.days[1].sd, null)
  assert.equal(D.days[4].n, 0); assert.equal(D.days[4].mean, null)
  assert.deepEqual(D.used, [0, 1])
  assert.equal(D.years[0].cells[0].n, 2)
})
