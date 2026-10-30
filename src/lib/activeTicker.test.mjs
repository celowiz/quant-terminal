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
  assert.deepEqual(new Set(d.tickers.map(t => t.class)), new Set(['br_equity', 'us_equity', 'index', 'etf', 'commodity', 'crypto', 'fx']))
  for (const tk of ['GOOGL', 'TIO=F', 'I0.DCE', 'BTC-USD', '^GSPC']) {
    assert.ok(inUniverse('GPC', tk, all), tk)
    assert.ok(!inUniverse('DES', tk, all), tk)
  }
  const corp = d.tickers.filter(t => t.corp).map(t => t.ticker).sort()
  assert.deepEqual([...FUNCTION_UNIVERSE.DES].sort(), corp)
  assert.equal(functionPath('GPC', 'I0.DCE', all), '/gpc/I0.DCE/')
  assert.equal(functionPath('DES', 'GOOGL', all), '/des/')
})
