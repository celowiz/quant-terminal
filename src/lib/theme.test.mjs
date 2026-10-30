import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapHex, mapCssValue, themeKey, scopeSelector, THEMES, DEFAULT_KEY } from './theme.mjs'

test('padrão (âmbar) é identidade', () => {
  for (const h of ['#FFA028', '#000000', '#3DDC84', '#FF4D4D', '#0b0c10', '#abc', '#FFA02855']) assert.equal(mapHex(h, DEFAULT_KEY), h)
  assert.equal(mapCssValue('rgb(255 160 40 / 0.2)', DEFAULT_KEY), 'rgb(255 160 40 / 0.2)')
})
test('themeKey valida', () => {
  assert.equal(themeKey(null), 'amber.std')
  assert.equal(themeKey({ theme: 'light', ud: 'cb' }), 'light.cb')
  assert.equal(themeKey({ theme: 'x', ud: 'y' }), 'amber.std')
})
test('tema claro inverte fundo e texto', () => {
  assert.equal(mapHex('#000000', 'light.std'), '#ffffff')
  assert.equal(mapHex('#e6e6e6', 'light.std'), '#191919')
})
test('verde fósforo troca o âmbar por verde', () => {
  const g = mapHex('#FFA028', 'green.std')
  const [r, gg] = [parseInt(g.slice(1, 3), 16), parseInt(g.slice(3, 5), 16)]
  assert.ok(gg > 200 && r < 100, g)
})
test('daltonismo: alta azul, baixa vermelhão, alfa preservado', () => {
  assert.equal(mapHex('#3DDC84', 'amber.cb'), '#56b4e9')
  assert.equal(mapHex('#FF4D4D', 'amber.cb'), '#e66100')
  assert.equal(mapHex('#3DDC8480', 'amber.cb'), '#56b4e980')
  assert.equal(mapHex('#FFA028', 'amber.cb'), '#ffa028')
})
test('CSS: rgb, oklch, nomes e seletores', () => {
  assert.equal(mapCssValue('rgba(0, 0, 0, 0.5)', 'light.std'), 'rgba(255, 255, 255, 0.5)')
  assert.match(mapCssValue('oklch(100% 0 0)', 'light.std'), /^#0{6}$/)
  assert.equal(mapCssValue('1px solid white', 'light.std'), '1px solid #000000')
  assert.equal(scopeSelector(':root, :host', 'light.std'), 'html[data-qt="light.std"],html[data-qt="light.std"]')
  assert.equal(scopeSelector('.a:hover', 'green.cb'), 'html[data-qt="green.cb"] .a:hover')
  assert.equal(THEMES[0], 'amber')
})
test('fundos quase pretos levemente azulados ficam neutros', () => {
  assert.equal(mapHex('#0b0c10', 'contrast.std'), '#000000')
})
