import test from 'node:test'
import assert from 'node:assert/strict'
import { fcfOf, fcfLtm, wacc, dcf, perShare, impliedG1, sensitivity } from './dcf.mjs'
import { netCost, pnl, profile, preset, greeks } from './osa.mjs'
import { smile, ivAt, surface } from './ivs.mjs'

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`)

test('DCF: FCF, LTM e WACC', () => {
  assert.equal(fcfOf({ cfo: 100, capex: -30 }), 70)
  assert.equal(fcfOf({ cfo: 100 }), null)
  assert.equal(fcfLtm([{ cfo: 10, capex: -1 }, { cfo: 10, capex: -1 }, { cfo: 10, capex: -1 }]), null)
  assert.equal(fcfLtm([{ cfo: 9, capex: 0 }, { cfo: 10, capex: -1 }, { cfo: 10, capex: -2 }, { cfo: 10, capex: -3 }, { cfo: 10, capex: -4 }]), 30)
  const w = wacc({ rf: 0.10, beta: 1.2, erp: 0.05, kd: 0.12, tax: 0.34, E: 600, D: 400 })
  near(w.ke, 0.16, 1e-12, 'Ke'); near(w.w, 0.6 * 0.16 + 0.4 * 0.12 * 0.66, 1e-12, 'WACC')
  near(wacc({ rf: 0.04, beta: 1, erp: 0.05, kd: 0.06, tax: 0.21, E: 100, D: 0 }).w, 0.09, 1e-12, 'sem dívida')
})

test('DCF: g constante reproduz Gordon (EV = FCF1/(W−g)) e valor por ação', () => {
  const r = dcf({ fcf0: 100, g1: 0.03, gT: 0.03, w: 0.10 })
  near(r.ev, 100 * 1.03 / 0.07, 1e-6, 'Gordon')
  near(r.years[0].fcf, 103, 1e-9, 'ano 1')
  assert.equal(dcf({ fcf0: 100, g1: 0.05, gT: 0.10, w: 0.10 }), null)
  // fase de convergência: ano 10 cresce g∞
  const f = dcf({ fcf0: 100, g1: 0.15, gT: 0.04, w: 0.12 })
  near(f.years[4].g, 0.15, 1e-12, 'g ano 5'); near(f.years[9].g, 0.04, 1e-12, 'g ano 10')
  near(perShare(1000, { netdebt: 200, minority: 50, shares: 10 }), 75, 1e-12, 'por ação')
  assert.equal(perShare(1000, { shares: 0 }), null)
})

test('DCF: reverso recupera o g1 e sensibilidade cai com o WACC', () => {
  const p = { fcf0: 100, gT: 0.04, w: 0.11, n1: 5, n: 10 }, bal = { netdebt: 300, minority: 0, shares: 10 }
  const px = perShare(dcf({ ...p, g1: 0.08 }).ev, bal)
  near(impliedG1(px, p, bal), 0.08, 1e-6, 'g implícito')
  const t = sensitivity({ ...p, g1: 0.08 }, bal, [0.09, 0.11, 0.13], [0.03, 0.04])
  assert.ok(t[0][0] > t[1][0] && t[1][0] > t[2][0]); assert.ok(t[1][1] > t[1][0])
})

test('OSA: payoff no vencimento de travas, straddle e borboleta', () => {
  const r = 0.1
  // trava de alta 30/33 paga 1,20: perda máx −1,20, ganho máx 1,80, equilíbrio 31,20
  const bull = [{ kind: 'C', side: 1, qty: 1, K: 30, prem: 2.0, T: 0.1, iv: 0.3 }, { kind: 'C', side: -1, qty: 1, K: 33, prem: 0.8, T: 0.1, iv: 0.3 }]
  near(netCost(bull), 1.2, 1e-12, 'débito')
  const xs = Array.from({ length: 401 }, (_, i) => 20 + i * 0.05)
  const pr = profile(bull, xs, 0.1, r)
  near(pr.min, -1.2, 1e-9, 'perda máx'); near(pr.max, 1.8, 1e-9, 'ganho máx'); near(pr.be[0], 31.2, 1e-9, 'equilíbrio')
  assert.equal(pr.unlimitedUp, false); assert.equal(pr.unlimitedDown, false)
  // straddle comprado K=30 por 3: dois equilíbrios (27 e 33), ganho ilimitado
  const st = [{ kind: 'C', side: 1, qty: 1, K: 30, prem: 1.6, T: 0.1, iv: 0.3 }, { kind: 'P', side: 1, qty: 1, K: 30, prem: 1.4, T: 0.1, iv: 0.3 }]
  const ps = profile(st, xs, 0.1, r)
  near(ps.be[0], 27, 1e-9, 'BE−'); near(ps.be[1], 33, 1e-9, 'BE+'); assert.equal(ps.unlimitedUp, true)
  // borboleta 28/30/32 por 0,50: ganho máx 1,50 em 30
  const bf = [[28, 1, 2.6], [30, -2, 1.3], [32, 1, 0.5]].map(([K, s, p]) => ({ kind: 'C', side: Math.sign(s), qty: Math.abs(s), K, prem: p, T: 0.1, iv: 0.3 }))
  near(pnl(bf, 30, 0.1, r), 1.5, 1e-9, 'pico'); near(pnl(bf, 40, 0.1, r), -0.5, 1e-9, 'asa')
  // hoje (dt=0) o valor da trava fica entre os extremos e o delta é positivo
  const today = pnl(bull, 31.5, 0, r); assert.ok(today > -1.2 && today < 1.8)
  assert.ok(greeks(bull, 31.5, r).delta > 0)
  // venda coberta: ação + call vendida = delta < 1
  assert.ok(greeks([{ kind: 'S', side: 1, qty: 1, K: 0, prem: 31, T: 0, iv: 0 }, { kind: 'C', side: -1, qty: 1, K: 33, prem: 0.8, T: 0.1, iv: 0.3 }], 31, r).delta < 1)
})

test('OSA: estruturas prontas usam strikes da cadeia', () => {
  const K = [26, 28, 30, 32, 34]
  assert.deepEqual(preset('bull_call', 30.2, K, K).map(l => [l.kind, l.side, l.K]), [['C', 1, 30], ['C', -1, 32]])
  assert.deepEqual(preset('butterfly', 30, K, K).map(l => l.K), [28, 30, 30, 32])
  assert.equal(preset('condor', 30, K, K).length, 4)
})

test('IVS: smile OTM, interpolação sem extrapolar e superfície', () => {
  const e = { date: '2026-11-19', bdays: 14,
    calls: [{ code: 'A', strike: 28, iv: 40, trades: 5 }, { code: 'B', strike: 30, iv: 30, trades: 9 }, { code: 'C', strike: 32, iv: 28, trades: 3 }, { code: 'D', strike: 34, iv: 26, trades: 2 }, { code: 'H', strike: 36, iv: null, trades: 0 }],
    puts: [{ code: 'E', strike: 26, iv: 45, trades: 2 }, { code: 'F', strike: 28, iv: 36, trades: 4 }, { code: 'G', strike: 30, iv: 31, trades: 1 }] }
  const s = smile(e, 30)
  assert.deepEqual(s.map(p => p.code), ['E', 'F', 'B', 'C', 'D'])  // put 28 (OTM) no lugar da call 28 (ITM); call 30 (spot) no lugar da put
  near(ivAt(s, 1), 30, 1e-12, 'ATM'); near(ivAt(s, 0.9), (45 + 36) / 2, 1e-9, 'meio'); near(ivAt(s, 1.1), 27, 1e-9, 'asa call')
  assert.equal(ivAt(s, 1.2), null); assert.equal(ivAt(s, 0.85), null); assert.equal(ivAt(s, 0.8), null)
  const sf = surface([e, { date: 'x', bdays: 2, calls: [], puts: [] }], 30, [0.9, 1, 1.1])
  assert.equal(sf.length, 1); near(sf[0].skew, 13.5, 1e-9, 'skew 90−110')
})
