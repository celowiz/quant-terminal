import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { classify, swSource } from './sw.mjs'

const O = 'https://celowiz.github.io', BP = '/quant-terminal'
test('classify: data JSON e assets estáticos; resto fica de fora', () => {
  assert.equal(classify(`${O}${BP}/data/prices/r/PETR4.SA.json`, O, BP), 'data')
  assert.equal(classify(`${O}${BP}/data/notes.txt`, O, BP), null)
  assert.equal(classify(`${O}${BP}/_next/static/chunks/main-abc.js`, O, BP), 'static')
  assert.equal(classify(`${O}${BP}/favicon.svg`, O, BP), 'static')
  assert.equal(classify(`${O}${BP}/logos/PETR4.png`, O, BP), 'static')
  assert.equal(classify(`${O}${BP}/rrg/`, O, BP), null)
  assert.equal(classify(`${O}${BP}/rrg/index.txt?_rsc=1`, O, BP), null)
  assert.equal(classify(`${O}${BP}/sw.js`, O, BP), null)
  assert.equal(classify(`${O}/portfolio/favicon.svg`, O, BP), null)
  assert.equal(classify('https://www.google-analytics.com/g/collect?v=2', O, BP), null)
  assert.equal(classify('https://www.googletagmanager.com/gtag/js?id=G-X', O, BP), null)
  assert.equal(classify('not a url', O, BP), null)
})

test('swSource: versão no nome do cache e script válido', () => {
  const src = swSource('abc123', BP)
  assert.match(src, /qt-static-/)
  assert.match(src, /"abc123"/)
  const handlers = {}
  const ctx = { self: { addEventListener: (t, f) => { handlers[t] = f }, location: { origin: O }, skipWaiting() {}, clients: { claim() {} } }, caches: {} }
  vm.runInNewContext(src, ctx)
  assert.deepEqual(Object.keys(handlers).sort(), ['activate', 'fetch', 'install'])
  // não-GET e navegação: não chama respondWith
  let called = false
  const ev = req => ({ request: req, respondWith() { called = true }, waitUntil() {} })
  handlers.fetch(ev({ method: 'POST', mode: 'cors', url: `${O}${BP}/data/x.json`, headers: new Map() }))
  handlers.fetch(ev({ method: 'GET', mode: 'navigate', url: `${O}${BP}/rrg/`, headers: new Map() }))
  handlers.fetch(ev({ method: 'GET', mode: 'no-cors', url: 'https://www.google-analytics.com/g/collect', headers: new Map() }))
  assert.equal(called, false)
})
