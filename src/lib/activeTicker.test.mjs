import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { TICKER_FUNCTIONS, FUNCTION_UNIVERSE, acceptsTicker, inUniverse, functionPath, readStoredTicker, writeStoredTicker, STORAGE_KEY } from './activeTicker.mjs'

const UNIVERSE = JSON.parse(readFileSync(new URL('../../public/data/tickers.json', import.meta.url))).tickers.map(t => t.ticker)
const APP = new URL('../app/', import.meta.url)

test('TICKER_FUNCTIONS = rotas com /[ticker]', () => {
  const routes = readdirSync(APP).filter(d => existsSync(new URL(`${d}/[ticker]`, APP))).map(d => d.toUpperCase()).sort()
  assert.deepEqual([...TICKER_FUNCTIONS].sort(), routes)
})

test('GP → GPC preserva o ativo', () => {
  assert.equal(functionPath('GPC', 'PETR4.SA', UNIVERSE), '/gpc/PETR4.SA/')
  assert.equal(functionPath('gp', 'petr4.sa', UNIVERSE), '/gp/PETR4.SA/')
})

test('função sem ativo abre a página padrão; o ativo guardado não é usado', () => {
  assert.equal(acceptsTicker('WIRP'), false)
  assert.equal(functionPath('WIRP', 'PETR4.SA', UNIVERSE), '/wirp/')
  assert.equal(functionPath('', 'PETR4.SA', UNIVERSE), '/')
})

test('ativo fora do universo da função → padrão da função', () => {
  assert.equal(inUniverse('DES', 'BRL=X', UNIVERSE), false)
  assert.equal(functionPath('DES', 'BRL=X', UNIVERSE), '/des/')
  assert.equal(functionPath('GP', 'BRL=X', UNIVERSE), '/gp/BRL%3DX/')
  assert.equal(functionPath('GP', 'XXXX3.SA', UNIVERSE), '/gp/')
  assert.equal(functionPath('GPC', '', UNIVERSE), '/gpc/')
})

test('localStorage', () => {
  const m = new Map(); const s = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
  assert.equal(readStoredTicker(s), '')
  writeStoredTicker(s, 'petr4.sa'); assert.equal(m.get(STORAGE_KEY), 'PETR4.SA'); assert.equal(readStoredTicker(s), 'PETR4.SA')
  assert.equal(readStoredTicker({ getItem: () => { throw new Error('x') } }), '')
  assert.equal(readStoredTicker(null), '')
})

test('universo ampliado: tickers.json com mínimo de ativos e classes; funções corporativas só nas ações com dados', async () => {
  const { readFileSync } = await import('node:fs')
  const d = JSON.parse(readFileSync(new URL('../../public/data/tickers.json', import.meta.url), 'utf8'))
  const all = d.tickers.map(t => t.ticker)
  assert.ok(all.length >= 200, `só ${all.length} tickers`)
  assert.deepEqual(new Set(d.tickers.map(t => t.class)), new Set(['br_equity', 'fii', 'bdr', 'us_equity', 'index', 'etf', 'commodity', 'crypto', 'fx']))
  for (const tk of ['GOOGL', 'TIO=F', 'I0.DCE', 'BTC-USD', '^GSPC']) {
    assert.ok(inUniverse('GPC', tk, all), tk)
    assert.ok(!inUniverse('DES', tk, all), tk)
  }
  // o universo das funções corporativas vem do `cov` que o pipeline grava (no CI o tickers.json é o gerado, com todas as ações com dados)
  const m = await import('./activeTicker.mjs')
  m.registerCoverage(d.tickers)
  const corp = d.tickers.filter(t => t.corp).map(t => t.ticker.toUpperCase()).sort()
  assert.ok(corp.length >= 6, `só ${corp.length} ações com dados corporativos`)
  // DES: ações (corp) + FIIs, BDRs e ETFs com descrição (des); as demais funções corporativas só nas ações
  const des = [...new Set([...corp, ...d.tickers.filter(t => (t.cov || []).includes('des') || ['index', 'fx', 'commodity', 'crypto'].includes(t.class)).map(t => t.ticker.toUpperCase())])].sort()
  assert.deepEqual([...FUNCTION_UNIVERSE.DES].sort(), des)
  assert.deepEqual([...FUNCTION_UNIVERSE.FUND].sort(), corp)
  m.registerCoverage([{ ticker: 'X' }])                         // volta ao núcleo fixo para os demais testes
  assert.equal(functionPath('GPC', 'I0.DCE', all), '/gpc/I0.DCE/')
  assert.equal(functionPath('DES', 'GOOGL', all), '/des/')
})

test('displayTicker strips the .SA suffix only', async () => {
  const { displayTicker } = await import('./activeTicker.mjs')
  assert.equal(displayTicker('petr4.sa'), 'PETR4')
  assert.equal(displayTicker('AAPL'), 'AAPL')
  assert.equal(displayTicker('^BVSP'), '^BVSP')
  assert.equal(displayTicker(''), '')
})

import { barTicker, functionUniverse, defaultTicker } from './activeTicker.mjs'
test('barTicker: DES com GOOGL guardado mostra o PETR4 que a página renderiza', () => {
  const U = ['PETR4.SA', 'VALE3.SA', 'GOOGL']
  assert.deepEqual(barTicker('DES', 'GOOGL', U), { ticker: 'PETR4.SA', fallbackFrom: 'GOOGL' })
  assert.deepEqual(barTicker('DES', 'VALE3.SA', U), { ticker: 'VALE3.SA', fallbackFrom: '' })
  assert.deepEqual(barTicker('DES', '', U), { ticker: 'PETR4.SA', fallbackFrom: '' })
  assert.deepEqual(barTicker('ECO', 'GOOGL', U), { ticker: 'GOOGL', fallbackFrom: '' })
  assert.equal(defaultTicker('GP'), '')
})
test('functionUniverse: DES lista só ações com CVM', () => {
  const U = ['PETR4.SA', 'GOOGL', 'VALE3.SA', '^BVSP']
  assert.deepEqual(functionUniverse('DES', U), ['PETR4.SA', 'VALE3.SA'])
  assert.deepEqual(functionUniverse('GP', U), U)
})

test('registerCoverage: universo por função vem do cov do tickers.json; sem cov, núcleo fixo', async () => {
  const m = await import('./activeTicker.mjs')
  m.registerCoverage([{ ticker: 'WEGE3.SA', cov: ['corp', 'holders', 'fa'] }, { ticker: 'PETR4.SA', cov: ['corp', 'options'] }, { ticker: '^BVSP', cov: ['intraday'] }])
  assert.ok(m.covers('DES', 'WEGE3.SA') && m.covers('HDS', 'wege3.sa') && m.covers('FA', 'WEGE3.SA'))
  assert.ok(!m.covers('OMON', 'WEGE3.SA') && m.covers('OMON', 'PETR4.SA') && !m.covers('HDS', 'PETR4.SA'))
  assert.ok(m.covers('GP', 'ANYTHING'))                       // função sem universo próprio
  assert.deepEqual(m.functionUniverse('GIP', ['^BVSP', 'WEGE3.SA']), ['^BVSP'])
  m.registerCoverage([{ ticker: 'KNRI11.SA', cov: ['des'] }, { ticker: 'PETR4.SA', cov: ['corp'] }])   // DES = corp ∪ des
  assert.ok(m.covers('DES', 'KNRI11.SA') && !m.covers('FUND', 'KNRI11.SA') && !m.covers('EVTS', 'KNRI11.SA') && m.covers('DES', 'PETR4.SA'))
  m.registerCoverage([{ ticker: 'TIO=F', class: 'commodity' }, { ticker: 'BTC-USD', class: 'crypto', cov: [] }, { ticker: 'AAPL', class: 'us_equity', cov: ['corp'] }])
  assert.ok(m.covers('DES', 'TIO=F') && m.covers('DES', 'BTC-USD') && !m.covers('FUND', 'TIO=F') && !m.covers('DVD', 'BTC-USD'))   // DES de mercado pela classe
  m.registerCoverage([{ ticker: 'X' }])                        // seed antigo sem cov
  assert.ok(m.covers('DES', 'PETR4.SA') && !m.covers('DES', 'WEGE3.SA'))
})
