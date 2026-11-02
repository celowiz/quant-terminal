import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pickBench, benchMarket, validBench, BENCH_DEFAULTS, BENCH_OPTIONS, benchName, peersOf, tracksUS } from './bench.mjs'

const T = JSON.parse(readFileSync(new URL('../../public/data/tickers.json', import.meta.url))).tickers
const M = Object.fromEntries(T.map(x => [x.ticker, x]))
const pick = (t, p) => pickBench(t, M[t], p)

test('padrões por classe: EUA/BDR → S&P 500, Brasil → Ibovespa, cripto → Bitcoin, câmbio/commodities → DXY', () => {
  for (const t of ['GOOGL', 'AAPL', 'SPY', 'QQQ']) assert.equal(pick(t), '^GSPC', t)
  const bdr = T.find(x => x.class === 'bdr'); assert.equal(pick(bdr.ticker), '^GSPC')
  for (const t of ['PETR4.SA', 'BOVA11.SA', 'SMAL11.SA']) assert.equal(pick(t), '^BVSP', t)
  const fii = T.find(x => x.class === 'fii'); assert.equal(pick(fii.ticker), '^BVSP')
  assert.equal(pick('IVVB11.SA'), '^GSPC')
  assert.equal(pick('NASD11.SA'), '^GSPC')
  assert.equal(pick('ETH-USD'), 'BTC-USD')
  assert.equal(pick('BTC-USD'), '^GSPC')               // o próprio Bitcoin não é seu benchmark
  for (const t of ['EURUSD=X', 'BRL=X', 'GC=F', 'CL=F']) assert.equal(pick(t), 'DX-Y.NYB', t)
})

test('índices mantêm a regra anterior', () => {
  assert.equal(pick('^BVSP'), 'BRL=X')
  assert.equal(pick('^GSPC'), '^NDX')
  assert.equal(pick('^N225'), '^GSPC')
  assert.equal(pick('DX-Y.NYB'), '^GSPC')
})

test('preferências salvas são validadas por mercado e aplicadas', () => {
  assert.deepEqual(validBench(null), BENCH_DEFAULTS)
  assert.deepEqual(validBench({ us: 'PETR4.SA', br: '<script>', crypto: 'ETH-USD' }), { ...BENCH_DEFAULTS, crypto: 'ETH-USD' })
  assert.equal(pick('GOOGL', { us: '^NDX' }), '^NDX')
  assert.equal(pick('ETH-USD', { crypto: 'ETH-USD' }), '^GSPC')
  assert.equal(pick('GC=F', { cmd: '^GSPC' }), '^GSPC')
  for (const opts of Object.values(BENCH_OPTIONS)) for (const o of opts) assert.ok(M[o], `${o} existe no universo`)
})

test('sem cadastro: heurística pelo formato', () => {
  assert.equal(benchMarket('XYZ-USD'), 'crypto')
  assert.equal(benchMarket('ABC=X'), 'fx')
  assert.equal(benchMarket('ZZ=F'), 'cmd')
  assert.equal(benchMarket('ABCD3.SA'), 'br')
  assert.equal(benchMarket('MSFT'), 'us')
})

test('ETFs da B3 que replicam índice dos EUA', () => {
  assert.ok(tracksUS('iShares S&P 500 BRL (IVVB11)'))
  assert.ok(tracksUS('INVESTO MVIS®US BUSINESS DEVELOPMENT'))
  assert.ok(!tracksUS('GALAPAGOS FTSE GLOBAL EQUITIES EX US'))
  assert.ok(!tracksUS('BB ETF S&P DIVIDENDOS BRASIL'))
  assert.ok(!tracksUS('BTG PACTUAL REFERENCE S&P/B3 CAMBIAL'))
})

test('nomes legíveis EN/PT', () => {
  assert.equal(benchName('^GSPC'), 'S&P 500')
  assert.equal(benchName('^BVSP', 'pt'), 'Ibovespa')
  assert.equal(benchName('DX-Y.NYB'), 'US Dollar Index')
  assert.equal(benchName('DX-Y.NYB', 'pt'), 'Índice do Dólar (DXY)')
  assert.equal(benchName('PETR4.SA'), null)
})

test('pares da mesma classe', () => {
  const sc = [{ cod: 'AAPL', sector: 'Technology', subsector: 'Consumer Electronics', mcap: 5 }, { cod: 'MSFT', sector: 'Technology', subsector: 'Software', mcap: 4 },
    { cod: 'NVDA', sector: 'Technology', subsector: 'Semis', mcap: 6 }, { cod: 'XOM', sector: 'Energy', subsector: 'Oil', mcap: 1 }, { cod: 'GOOGL', sector: 'Communication', subsector: 'Internet', mcap: 3 }]
  assert.deepEqual(peersOf('MSFT', T, 2, sc), ['NVDA', 'AAPL'])
  assert.deepEqual(peersOf('XOM', T, 2, sc), ['NVDA', 'AAPL'])      // sem par no setor → maiores
  assert.deepEqual(peersOf('ETH-USD', T, 2), ['BTC-USD', 'SOL-USD'])
  const fx = peersOf('EURUSD=X', T, 2); assert.equal(fx.length, 2); assert.ok(fx.every(t => M[t].class === 'fx' && t !== 'EURUSD=X'))
  const br = peersOf('IVVB11.SA', T, 3); assert.ok(br.every(t => M[t].class === 'etf' && t.endsWith('.SA') && benchMarket(t, M[t]) === 'us'), br.join())
  assert.deepEqual(peersOf('SPY', T, 2), ['QQQ', 'IWM'])
  assert.deepEqual(peersOf('NOPE', T, 2), [])
})
