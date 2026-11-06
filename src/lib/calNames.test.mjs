import assert from 'node:assert/strict'
import { calName, dayCols } from './calNames.mjs'
assert.equal(calName('ITUB4'), 'Itaú Unibanco')
assert.equal(calName('BBSE3', '', true), 'BB Seguridade')
assert.equal(calName('SUZB3'), 'Suzano')
assert.equal(calName('VIVA3'), 'Vivara')
assert.equal(calName('ZZZZ', 'FOO S.A.'), 'FOO')
assert.equal(dayCols(5), 1)
assert.equal(dayCols(9), 2)
assert.equal(dayCols(15), 3)
console.log('calNames ok')
