import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pickerGroups, flatItems, withTicker, cleanName, scoreMatch, groupLabel, PICKER_GROUPS } from './tickerPicker.mjs'

const U = JSON.parse(readFileSync(new URL('../../public/data/tickers.json', import.meta.url))).tickers
const M = [
  { ticker: 'VALE3.SA', name: 'VALE ON', class: 'br_equity' },
  { ticker: 'PETR4.SA', name: 'PETROBRAS PN', class: 'br_equity' },
  { ticker: 'SMAL11.SA', name: 'iShares Small Cap (SMAL11)', class: 'etf' },
  { ticker: 'XLK', name: 'Technology Select Sector SPDR', class: 'etf' },
  { ticker: 'BTC-USD', name: 'Bitcoin', class: 'crypto' },
  { ticker: 'IBIT', name: 'iShares Bitcoin Trust (BTC)', class: 'etf' },
  { ticker: 'VALE', name: 'Vale S.A. ADR', class: 'us_equity' },
  { ticker: 'HGLG11.SA', name: 'CSHG Logística', class: 'fii' },
  { ticker: '^BVSP', name: 'IBOVESPA', class: 'index' },
  { ticker: 'BRL=X', name: 'USD/BRL', class: 'fx' },
  { ticker: 'GC=F', name: 'Gold', class: 'commodity' },
  { ticker: 'AAPL34.SA', name: 'APPLE DRN', class: 'bdr' },
]

test('withTicker não duplica o ticker já presente no nome', () => {
  assert.equal(withTicker('Brazil small caps (SMAL11)', 'SMAL11.SA'), 'Brazil small caps (SMAL11)')
  assert.equal(withTicker('Ibovespa (BOVA11)', 'BOVA11'), 'Ibovespa (BOVA11)')
  assert.equal(withTicker('Bitcoin', 'BTC-USD'), 'Bitcoin (BTC-USD)')
  assert.equal(withTicker('PETR4', 'PETR4.SA'), 'PETR4')
  assert.equal(withTicker('', 'VALE3.SA'), 'VALE3')
  // substring sem fronteira não conta: 'VALE ON' não contém o código VALE3
  assert.equal(withTicker('VALE ON', 'VALE3.SA'), 'VALE ON (VALE3)')
})

test('cleanName remove o ticker repetido do fim do nome', () => {
  assert.equal(cleanName('iShares Small Cap (SMAL11)', 'SMAL11.SA'), 'iShares Small Cap')
  assert.equal(cleanName('XLK', 'XLK'), '')
  assert.equal(cleanName('VALE ON', 'VALE3.SA'), 'VALE ON')
})

test('scoreMatch: código antes de nome, sem acento', () => {
  assert.equal(scoreMatch(M[0], 'vale3'), 0)
  assert.equal(scoreMatch(M[0], 'vale'), 1)
  assert.equal(scoreMatch(M[7], 'logistica'), 3)
  assert.equal(scoreMatch(M[4], 'zzz'), null)
})

test('pickerGroups: sugeridos no topo, sem repetir, excluídos fora', () => {
  const g = pickerGroups(M, '', { suggested: ['^BVSP', 'SMAL11.SA', 'NOPE'], exclude: ['PETR4.SA'] })
  assert.equal(g[0].group, 'suggested')
  assert.deepEqual(g[0].items.map(m => m.ticker), ['^BVSP', 'SMAL11.SA'])
  const all = flatItems(g).map(m => m.ticker)
  assert.equal(new Set(all).size, all.length)
  assert.ok(!all.includes('PETR4.SA'))
  // ordem fixa dos grupos sem busca
  const order = g.slice(1).map(x => x.group)
  assert.deepEqual(order, PICKER_GROUPS.filter(c => order.includes(c)))
})

test('pickerGroups: busca agrupa por classe e sobe o melhor grupo', () => {
  const v = pickerGroups(M, 'vale')
  assert.deepEqual(v.map(x => x.group), ['us_equity', 'br_equity']) // código exato (VALE) antes de prefixo (VALE3)
  const b = pickerGroups(M, 'btc')
  assert.equal(b[0].group, 'crypto')
  assert.equal(b[0].items[0].ticker, 'BTC-USD')
  assert.ok(b.some(x => x.group === 'etf' && x.items[0].ticker === 'IBIT'))
  const x = pickerGroups(M, 'xlk')
  assert.equal(flatItems(x)[0].ticker, 'XLK')
  assert.equal(pickerGroups(M, 'qqqzzz').length, 0)
})

test('pickerGroups no universo real: vale, btc, xlk e limite por grupo', () => {
  assert.equal(flatItems(pickerGroups(U, 'vale'))[0].ticker, 'VALE3.SA')
  assert.equal(flatItems(pickerGroups(U, 'btc'))[0].ticker, 'BTC-USD')
  const g = pickerGroups(U, '')
  assert.ok(g.every(x => x.items.length <= 8))
  assert.ok(g.length >= 9)
  assert.ok(flatItems(pickerGroups(U, 'a', { perGroup: 30 })).length <= 30 * 10)
})

test('groupLabel EN/PT', () => {
  assert.equal(groupLabel('br_equity'), 'BR stocks')
  assert.equal(groupLabel('br_equity', 'pt'), 'Ações BR')
  assert.equal(groupLabel('commodity', 'pt'), 'Commodities e futuros')
  assert.equal(groupLabel('suggested', 'pt'), 'Sugeridos')
})
