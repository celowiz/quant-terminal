import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as A from './analytics.mjs'

function fakeWin({ search = '', host = 'celowiz.github.io', ready = 'complete' } = {}) {
  const store = new Map()
  const appended = []
  return {
    location: { search, origin: `https://${host}`, host },
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: { readyState: ready, head: { appendChild: el => appended.push(el) }, createElement: () => ({}), getElementById: id => appended.find(e => e.id === id) || null },
    setTimeout: fn => fn(),
    addEventListener() {},
    appended,
  }
}
const calls = win => win.dataLayer.map(a => Array.from(a))
const events = (win, name) => calls(win).filter(c => c[0] === 'event' && (!name || c[1] === name))

test('sanitizeParams clips to 100 chars and drops empty / non-primitive values', () => {
  const p = A.sanitizeParams({ a: 'x'.repeat(150), b: '', c: null, d: undefined, e: 3, f: NaN, g: { x: 1 }, h: false })
  assert.equal(p.a.length, 100)
  assert.deepEqual(Object.keys(p).sort(), ['a', 'e', 'h'])
})

test('parseRoute strips basePath, uppercases and defaults to HOME', () => {
  assert.deepEqual(A.parseRoute('/quant-terminal/'), { functionCode: 'HOME', ticker: '' })
  assert.deepEqual(A.parseRoute('/quant-terminal/des/petr4/'), { functionCode: 'DES', ticker: 'PETR4' })
  assert.deepEqual(A.parseRoute('/quant-terminal/gp/%5EBVSP'), { functionCode: 'GP', ticker: '^BVSP' })
  assert.deepEqual(A.parseRoute('/cdie', ''), { functionCode: 'CDIE', ticker: '' })
})

test('page_view params: normalized path, title with ticker, location', () => {
  const p = A.buildPageViewParams({ functionCode: 'gpc', ticker: 'PETR4', origin: 'https://celowiz.github.io' })
  assert.equal(p.page_path, '/quant-terminal/GPC')
  assert.equal(p.page_title, 'GPC · PETR4')
  assert.equal(p.page_location, 'https://celowiz.github.io/quant-terminal/GPC')
  assert.equal(p.function_code, 'GPC')
  assert.equal(A.buildPageTitle('CDIE', ''), 'CDIE')
})

test('initGoogleAnalytics configures once with send_page_view false and the shared property', () => {
  const w = fakeWin()
  assert.equal(A.initGoogleAnalytics(w), true)
  assert.equal(A.initGoogleAnalytics(w), false)
  const cfg = calls(w).filter(c => c[0] === 'config')
  assert.equal(cfg.length, 1)
  assert.equal(cfg[0][1], 'G-QCBFGR39WG')
  assert.equal(cfg[0][2].send_page_view, false)
  assert.equal(cfg[0][2].content_group, 'quant-terminal')
})

test('debug mode via ?ga_debug', () => {
  const w = fakeWin({ search: '?ga_debug=1' })
  A.trackEvent('x', { a: 1 }, w)
  assert.equal(events(w)[0][2].debug_mode, true)
})

test('trackPageView dedupes the same route', () => {
  const w = fakeWin()
  assert.equal(A.trackPageView({ functionCode: 'GPC', ticker: 'PETR4' }, w), true)
  assert.equal(A.trackPageView({ functionCode: 'GPC', ticker: 'PETR4' }, w), false)
  assert.equal(A.trackPageView({ functionCode: 'GPC', ticker: 'VALE3' }, w), true)
  assert.equal(events(w, 'page_view').length, 2)
})

test('trackRouteLoad: no intent → function_open source url; runs once per load', () => {
  const w = fakeWin()
  A.trackRouteLoad({ functionCode: 'CDIE', ticker: '' }, w)
  A.trackRouteLoad({ functionCode: 'CDIE', ticker: '' }, w)
  const fo = events(w, 'function_open')
  assert.equal(fo.length, 1)
  assert.equal(fo[0][2].source, 'url')
  assert.equal(fo[0][2].function_code, 'CDIE')
  assert.equal(fo[0][2].ticker, undefined)
})

test('nav intent from the command line / list survives the page load', () => {
  const w = fakeWin()
  A.rememberNavIntent({ kind: 'function', source: 'command', functionCode: 'GPC' }, w)
  A.trackRouteLoad({ functionCode: 'GPC', ticker: 'PETR4' }, w)
  assert.equal(events(w, 'function_open')[0][2].source, 'command')
  assert.equal(A.consumeNavIntent(w), null, 'intent is consumed')
})

test('ticker intent → ticker_select instead of function_open', () => {
  const w = fakeWin()
  A.rememberNavIntent({ kind: 'ticker', ticker: 'VALE3' }, w)
  A.trackRouteLoad({ functionCode: 'GPC', ticker: 'VALE3' }, w)
  assert.equal(events(w, 'function_open').length, 0)
  assert.deepEqual(events(w, 'ticker_select')[0][2], { send_to: 'G-QCBFGR39WG', ticker: 'VALE3', function_code: 'GPC' })
})

test('stale intent (> 60 s) is ignored', () => {
  const w = fakeWin()
  w.sessionStorage.setItem(A.NAV_INTENT_KEY, JSON.stringify({ kind: 'function', source: 'list', at: 0 }))
  assert.equal(A.consumeNavIntent(w, 120000), null)
})

test('invalid function source falls back to url', () => {
  assert.equal(A.buildFunctionOpenParams({ functionCode: 'des', source: 'bogus' }).source, 'url')
})

test('settings_change only for known settings; reset → defaults', () => {
  assert.deepEqual(A.buildSettingsChangeParams('language', 'pt'), { setting: 'language', value: 'pt' })
  assert.deepEqual(A.buildSettingsChangeParams('reset'), { setting: 'reset', value: 'defaults' })
  assert.equal(A.buildSettingsChangeParams('email', 'x'), null)
})

test('outbound params: external http(s) only, query string stripped', () => {
  assert.deepEqual(A.buildOutboundParams('https://www.rad.cvm.gov.br/ENET/frmExibir.aspx?id=123&u=x', 'celowiz.github.io'),
    { link_url: 'https://www.rad.cvm.gov.br/ENET/frmExibir.aspx', link_domain: 'rad.cvm.gov.br' })
  assert.equal(A.buildOutboundParams('https://celowiz.github.io/quant-terminal/des/', 'celowiz.github.io'), null)
  assert.equal(A.buildOutboundParams('mailto:a@b.c', 'celowiz.github.io'), null)
  assert.equal(A.buildOutboundParams('not a url', 'celowiz.github.io'), null)
  assert.ok(A.buildOutboundParams(`https://example.com/${'a'.repeat(200)}`, 'x').link_url.length <= 100)
})

test('share params validate the method', () => {
  assert.deepEqual(A.buildShareParams({ functionCode: 'gpc', ticker: 'PETR4', method: 'image' }), { function_code: 'GPC', ticker: 'PETR4', method: 'image' })
  assert.equal(A.buildShareParams({ functionCode: 'gpc', method: 'x' }), null)
  A.trackEvent('share', null, fakeWin()) // null params (invalid) → no-op, no throw
})

test('chart_interaction params', () => {
  assert.deepEqual(A.buildChartInteractionParams({ functionCode: 'macd', period: '1A' }), { function_code: 'MACD', interaction: 'period_change', period: '1A' })
})

test('gtag.js script is injected once after load', () => {
  const w = fakeWin()
  A.scheduleGtagScriptLoad(w)
  A.injectGtagScript(w)
  assert.equal(w.appended.length, 1)
  assert.match(w.appended[0].src, /gtag\/js\?id=G-QCBFGR39WG$/)
})

test('event names and params are snake_case and <= 40 chars', () => {
  const ps = [A.buildPageViewParams({ functionCode: 'A', ticker: 'B', origin: 'o' }), A.buildFunctionOpenParams({ functionCode: 'A', ticker: 'B' }),
    A.buildTickerSelectParams({ ticker: 'B', functionCode: 'A' }), A.buildSettingsChangeParams('timezone', 'local'),
    A.buildOutboundParams('https://x.com/a', 'y'), A.buildChartInteractionParams({ functionCode: 'A', period: 1 }), A.buildShareParams({ functionCode: 'A', ticker: 'B', method: 'link' })]
  for (const p of ps) for (const k of Object.keys(p)) assert.match(k, /^[a-z][a-z0-9_]{0,39}$/)
})
