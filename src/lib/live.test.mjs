import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brt, b3Open, b3FutOpen, dolCodes, b3Sym, b3Quote, b3Day, liveSession, delayMin, liveLabel, mergeSgs, copomTitle, ptaxBulletins, mergeNews, feedDate, dmy } from './live.mjs'

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
  assert.deepEqual(q, { last: 44.95, open: 45.08, high: 45.69, low: 44.5, avg: 45.078, pct: -0.53 })
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
