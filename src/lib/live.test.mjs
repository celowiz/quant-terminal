import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brt, b3Open, b3FutOpen, dolCodes, b3Sym, b3Quote, b3Day, liveSession, delayMin, liveLabel, mergeSgs, copomTitle, ptaxBulletins, mergeNews, feedDate, dmy, tradeDay, quoteFresh, applyQuote, quotesBadge, mergePoints, refSha, blsPoints, blsActual, blsPending, ecoFill, releaseNear, futBadge } from './live.mjs'

const at = s => Date.parse(s)
test('brt e pregão da B3', () => {
  assert.equal(brt(at('2026-11-10T13:05:00Z')).hhmm, '10:05')
  assert.ok(b3Open(at('2026-11-10T13:05:00Z')))        // ter 10:05
  assert.ok(!b3Open(at('2026-11-10T12:30:00Z')))       // 09:30
  assert.ok(!b3Open(at('2026-11-10T21:31:00Z')))       // 18:31
  assert.ok(!b3Open(at('2026-11-08T15:00:00Z')))       // domingo
  assert.ok(b3FutOpen(at('2026-11-10T12:30:00Z')))     // futuros às 09:30
  assert.deepEqual(dolCodes(at('2026-11-10T15:00:00Z')), ['DOLZ26'])
  assert.deepEqual(dolCodes(at('2026-12-02T15:00:00Z')), ['DOLZ26', 'DOLF27'])
})
test('código B3', () => {
  assert.equal(b3Sym('PETR4.SA'), 'PETR4'); assert.equal(b3Sym('^BVSP'), 'IBOV'); assert.equal(b3Sym('KLBN11.SA'), 'KLBN11')
  assert.equal(b3Sym('AAPL'), null); assert.equal(b3Sym('BRL=X'), null); assert.equal(b3Sym('^GSPC'), null)
})
test('cotação e histórico do dia', () => {
  const q = b3Quote({ BizSts: { cd: 'OK' }, Trad: [{ scty: { SctyQtn: { opngPric: 45.08, minPric: 44.5, maxPric: 45.69, avrgPric: 45.078, curPrc: 44.95, prcFlcn: -0.53 } } }] })
  assert.deepEqual(q, { last: 44.95, open: 45.08, high: 45.69, low: 44.5, avg: 45.078, pct: -0.53, qty: null })
  assert.equal(b3Quote({ BizSts: { cd: 'NOK' } }), null)
  const d = b3Day({ BizSts: { cd: 'OK' }, TradgFlr: { date: '2026-11-10', scty: { lstQtn: [{ closPric: 44.9, dtTm: '10:03:00' }, { closPric: 'x', dtTm: '10:04:00' }, { closPric: 44.95, dtTm: '18:05:00' }] } } })
  assert.equal(d.day, '2026-11-10'); assert.equal(d.pts.length, 2)
  assert.equal(d.pts[0][0], at('2026-11-10T13:03:00Z') / 1000)
  assert.equal(b3Day({ BizSts: { cd: 'OK' }, TradgFlr: { date: '2026-11-10', scty: { lstQtn: [] } } }), null)
})
test('sessão ao vivo só quando o arquivo não cobre', () => {
  const d = { day: '2026-11-10', pts: [[100, 1], [160, 2]] }
  assert.deepEqual(liveSession(d, [[50, 1, 1, 1, 1, 9]]), [[100, 1, 1, 1, 1, 0], [160, 2, 2, 2, 2, 0]])
  assert.equal(liveSession(d, [[160, 1, 1, 1, 1, 9]]), null)
  assert.equal(liveSession(null, []), null)
})
test('atraso e rótulos EN/PT', () => {
  assert.equal(delayMin(0, 15.9 * 60000), 15); assert.equal(delayMin(1000, 0), 0)
  const now = at('2026-11-10T17:32:05Z'), last = at('2026-11-10T21:05:00Z')
  assert.equal(liveLabel({ kind: 'delayed', delay: 15, at: now }, 'en'), 'Delayed 15 min · updated 14:32')
  assert.equal(liveLabel({ kind: 'delayed', delay: 15, at: now }, 'pt'), 'Atraso de 15 min · atualizado às 14:32')
  assert.equal(liveLabel({ kind: 'rt', at: now }, 'en'), 'Live · updated 14:32:05')
  assert.equal(liveLabel({ kind: 'rt', at: now }, 'pt'), 'Ao vivo · atualizado às 14:32:05')
  assert.equal(liveLabel({ kind: 'closed', last }, 'pt'), 'Pregão encerrado · último negócio às 18:05')
  assert.equal(liveLabel({ kind: 'closed', last }, 'en'), 'Session closed · last trade 18:05')
  assert.equal(liveLabel({ kind: 'checked', at: now }, 'pt'), 'Consultado às 14:32')
})
test('séries oficiais: substitui e acrescenta, nunca apaga', () => {
  const r = mergeSgs([['2026-09-01', 0.5], ['2026-10-01', 0.6]], [{ data: '01/10/2026', valor: '0.61' }, { data: '01/11/2026', valor: '0.3' }, { data: 'x', valor: '1' }, { data: '01/12/2026', valor: '' }])
  assert.deepEqual(r.points, [['2026-09-01', 0.5], ['2026-10-01', 0.61], ['2026-11-01', 0.3]]); assert.equal(r.fresh, 1)
  assert.equal(dmy('10/11/2026'), '2026-11-10')
  assert.equal(mergeSgs([], [{ data: '10/11/2026', valor: '1' }, { data: '07/12/2026', valor: '2' }], '2026-11-10').points.length, 1)
})
test('Copom e PTAX', () => {
  assert.deepEqual(copomTitle({ nro_reuniao: 282, dataReferencia: '2026-11-04', titulo: '282ª reunião - Copom mantém a taxa Selic em 13,75% a.a.' }), { n: 282, date: '2026-11-04', selic: 13.75, move: 'hold' })
  assert.equal(copomTitle({ titulo: '281ª reunião - Copom reduz a taxa Selic para  13,75% a.a.' }).move, 'cut')
  assert.equal(copomTitle({ titulo: 'Copom eleva a taxa Selic para 14,25% a.a.' }).selic, 14.25)
  assert.equal(copomTitle({ titulo: 'Comunicado' }).selic, null)
  const p = ptaxBulletins({ value: [{ cotacaoCompra: 5.5549, cotacaoVenda: 5.5555, dataHoraCotacao: '2026-11-10 10:03:10.9', tipoBoletim: 'Abertura' }, { cotacaoCompra: 5.58, cotacaoVenda: 5.584, dataHoraCotacao: '2026-11-10 13:06:01.3', tipoBoletim: 'Fechamento PTAX' }] })
  assert.deepEqual(p.map(x => [x.kind, x.time]), [['open', '10:03'], ['close', '13:06']])
})
test('manchetes: sem duplicar e em ordem', () => {
  const a = [{ link: 'a', date: '2026-11-10T10:00-03:00' }], b = [{ link: 'a', date: '2026-11-10T10:00-03:00' }, { link: 'b', date: '2026-11-10T11:00-03:00' }, { link: '', date: '2026-11-10T12:00-03:00' }]
  const r = mergeNews(a, b); assert.deepEqual(r.items.map(x => x.link), ['b', 'a']); assert.equal(r.fresh, 1)
  assert.equal(feedDate('Tue, 10 Nov 2026 20:26:00 GMT'), '2026-11-10T17:26-03:00')
  assert.equal(feedDate('2026-11-10T08:01:06-03:00'), '2026-11-10T08:01-03:00'); assert.equal(feedDate('x'), null)
})

test('cotações do watcher: dia no fuso da bolsa, troca/acrescenta, nunca volta no tempo', () => {
  // Tóquio abre às 21:00 de Brasília do dia anterior: o pregão é o do dia seguinte no fuso da bolsa
  const tk = [50000, 49000, Date.parse('2026-11-11T00:30:00Z') / 1000, 9 * 3600]
  assert.equal(tradeDay(tk), '2026-11-11')
  const ny = [7520.93, 7549.94, Date.parse('2026-11-10T21:00:00Z') / 1000, -5 * 3600]
  assert.equal(tradeDay(ny), '2026-11-10')
  const d = ['2026-11-09', '2026-11-10'], c = [7549.94, 7529.08]
  assert.deepEqual(applyQuote(d, c, ny), { dates: d, close: [7549.94, 7520.93], applied: true })
  assert.deepEqual(applyQuote(['2026-11-09'], [7549.94], ny).dates, ['2026-11-09', '2026-11-10'])
  assert.equal(applyQuote(['2026-11-11'], [1], ny).applied, false)
  assert.equal(applyQuote(d, c, null).applied, false); assert.equal(applyQuote(d, c, [0, 1, 2, 0]).applied, false)
  const now = Date.parse('2026-11-10T21:10:00Z')
  assert.equal(quoteFresh(ny, now), true); assert.equal(quoteFresh(ny, now + 31 * 60000), false)
  const b = quotesBadge([ny, [1, 1, ny[2] - 600, 0], [1, 1, ny[2] - 7200, 0]], now - 60000, now)
  assert.equal(b.kind, 'delayed'); assert.equal(b.delay, 10)
  assert.deepEqual(quotesBadge([ny], null, now + 3600e3), { kind: 'closed', last: ny[2] * 1000 })
  assert.deepEqual(quotesBadge([ny], now, now + 3600e3), { kind: 'checked', at: now })
  assert.equal(quotesBadge([], 0, now), null)
})
test('observações recentes sobre a série publicada', () => {
  const r = mergePoints([['2026-09-01', 1], ['2026-10-01', 2]], [['2026-10-01', 2.5], ['2026-11-01', 3], ['x', 1], ['2026-12-01', NaN]])
  assert.deepEqual(r.points, [['2026-09-01', 1], ['2026-10-01', 2.5], ['2026-11-01', 3]]); assert.equal(r.fresh, 1)
})

test('pulso: sha do branch live', () => {
  assert.equal(refSha({ object: { sha: 'a'.repeat(40) } }), 'a'.repeat(40))
  assert.equal(refSha({ object: { sha: 'x' } }), null); assert.equal(refSha(null), null)
})
test('divulgações dos EUA: pontos, realizado e preenchimento sem estimar', () => {
  const j = { status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [
    { year: '2026', period: 'M10', value: '159293' }, { year: '2026', period: 'M09', value: '159128' }, { year: '2025', period: 'M13', value: '1' },
    { year: '2025', period: 'M10', value: '-' }, { year: '2025', period: 'M09', value: '152000' }] }] } }
  const p = blsPoints(j)
  assert.deepEqual(p, [['2025-09-01', 152000], ['2026-09-01', 159128], ['2026-10-01', 159293]])
  assert.equal(blsPoints({ status: 'REQUEST_NOT_PROCESSED' }), null)
  assert.equal(blsActual(p, 'PAYEMS', '10/2026'), 165)
  assert.equal(blsActual(p, 'CPIAUCSL', '10/2026'), null) // mês de comparação sem valor: não estima
  assert.equal(blsActual(p, 'CPIAUCSL', '09/2026'), +((159128 / 152000 - 1) * 100).toFixed(2))
  assert.equal(blsActual([['2026-01-01', 4.24]], 'UNRATE', '01/2026'), 4.2)
  assert.equal(blsActual([['2026-01-01', 10], ['2025-12-01', 7]], 'PAYEMS', '01/2026'), 3)
  const now = Date.parse('2026-11-10T23:00:00-03:00')
  const ev = [{ country: 'US', series: 'PAYEMS', period: '10/2026', time: '2026-11-06T10:30-03:00', actual: null, prior: null },
              { country: 'US', series: 'PAYEMS', period: '11/2026', time: '2026-12-04T10:30-03:00', actual: null },
              { country: 'US', series: 'UNRATE', period: '10/2026', time: '2026-11-06T10:30-03:00', actual: 4.1, prior: 4.2 },
              { country: 'US', series: 'PAYEMS', period: '01/2026', time: '2026-02-06T10:30-03:00', actual: null }]
  assert.equal(blsPending(ev, now).length, 1)
  const r = ecoFill(ev, { PAYEMS: p }, now)
  assert.equal(r.filled, 1); assert.equal(r.events[0].actual, 165); assert.equal(r.events[0].prior, null); assert.equal(r.events[0].live, true)
  assert.equal(r.events[1], ev[1]); assert.equal(r.events[2], ev[2])
  assert.equal(ecoFill(ev, null, now).filled, 0)
})
test('modo rápido da agenda: perto de uma divulgação', () => {
  const ev = [{ country: 'BR', time: '2026-11-12T09:00-03:00' }, { country: 'US', time: '2026-11-12T10:30-03:00', time_approx: true }]
  assert.equal(releaseNear(ev, Date.parse('2026-11-12T09:10:00-03:00'), ['BR']), true)
  assert.equal(releaseNear(ev, Date.parse('2026-11-12T08:57:00-03:00'), ['BR']), false)
  assert.equal(releaseNear(ev, Date.parse('2026-11-12T09:31:00-03:00'), ['BR']), false)
  assert.equal(releaseNear(ev, Date.parse('2026-11-12T10:31:00-03:00'), ['US']), false) // horário aproximado não acelera
})

test('selo do BTMM: atraso só quando medido', () => {
  const at = Date.parse('2026-11-11T11:53:00-03:00'), last = Date.parse('2026-11-11T11:38:00-03:00')
  assert.deepEqual(futBadge(last, at, true, true), { kind: 'delayed', delay: 15, at })
  assert.deepEqual(futBadge(last, at, false, true), { kind: 'closed', last })
  assert.deepEqual(futBadge(null, at, true, true), { kind: 'checked', at })  // sem histórico: só a hora da consulta
  assert.equal(futBadge(null, null, true, true), null); assert.equal(futBadge(last, at, true, false), null)
})
