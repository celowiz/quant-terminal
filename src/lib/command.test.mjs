import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCommand, resolveTicker, commandTarget } from './command.mjs'
import { registerCoverage } from './activeTicker.mjs'

const U = ['PETR4.SA', 'VALE3.SA', 'AAPL', '^BVSP', 'BRL=X', 'BTC-USD', 'WEGE3.SA']
const CODES = ['', 'GP', 'GPC', 'DES', 'WIRP', 'RRG', 'FUND']

test('resolveTicker: exato, .SA, ^índice e apelidos só se existirem no universo', () => {
  assert.equal(resolveTicker('petr4', U), 'PETR4.SA')
  assert.equal(resolveTicker('AAPL', U), 'AAPL')
  assert.equal(resolveTicker('BVSP', U), '^BVSP')
  assert.equal(resolveTicker('IBOV', U), '^BVSP')
  assert.equal(resolveTicker('SPX', U), '')
  assert.equal(resolveTicker('XPTO3', U), '')
})

test('parseCommand: ordem livre, GO ignorado, tokens desconhecidos reportados', () => {
  assert.deepEqual(parseCommand('PETR4 GP', U, CODES), { code: 'GP', ticker: 'PETR4.SA', unknown: [] })
  assert.deepEqual(parseCommand('gp petr4 go', U, CODES), { code: 'GP', ticker: 'PETR4.SA', unknown: [] })
  assert.deepEqual(parseCommand('  aapl   des ', U, CODES), { code: 'DES', ticker: 'AAPL', unknown: [] })
  assert.deepEqual(parseCommand('WIRP', U, CODES), { code: 'WIRP', ticker: '', unknown: [] })
  assert.deepEqual(parseCommand('XPTO3 GP', U, CODES).unknown, ['XPTO3'])
})

test('commandTarget: caminho, função atual quando só ticker, função sem ativo, cobertura', () => {
  registerCoverage([{ ticker: 'PETR4.SA', cov: ['corp'] }, { ticker: 'AAPL', cov: ['corp'] }])
  const t = (s, cur) => commandTarget(parseCommand(s, U, CODES), cur)
  assert.equal(t('PETR4 GP').path, '/gp/PETR4.SA/')
  assert.equal(t('AAPL DES').path, '/des/AAPL/')
  assert.equal(t('VALE3', 'GPC').path, '/gpc/VALE3.SA/')
  assert.equal(t('VALE3', 'WIRP').path, '/gp/VALE3.SA/')
  assert.deepEqual(t('PETR4 WIRP'), { path: '/wirp/', code: 'WIRP', ticker: 'PETR4.SA', note: 'noTicker' })
  assert.deepEqual(t('VALE3 DES'), { path: '/des/', code: 'DES', ticker: 'VALE3.SA', note: 'notCovered' })
  assert.equal(t('XPTO3 GP'), null)
  assert.equal(t(''), null)
})
