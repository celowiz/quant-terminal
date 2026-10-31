import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { inlineScriptHashes, injectCsp, buildPolicy } from './csp.mjs'

const html = '<!DOCTYPE html><html><head><meta charSet="utf-8"/><script src="/a.js"></script><script>boot()</script></head><body><script>self.__next_f.push([1])</script><script type="application/ld+json">{}</script></body></html>'
const h = s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`
test('hashes só de scripts inline executáveis', () => {
  assert.deepEqual(inlineScriptHashes(html), [h('boot()'), h('self.__next_f.push([1])')])
})
test('CSP entra logo após o charset, antes de qualquer script, e é idempotente', () => {
  const out = injectCsp(html)
  assert.ok(out.indexOf('Content-Security-Policy') < out.indexOf('<script'))
  assert.ok(out.includes('name="referrer" content="strict-origin-when-cross-origin"'))
  assert.equal(injectCsp(out), out)
})
test('política sem unsafe-inline/eval em scripts', () => {
  const p = buildPolicy([h('x')])
  const script = p.split('; ').find(d => d.startsWith('script-src'))
  assert.ok(!/unsafe-(inline|eval)/.test(script))
  assert.ok(p.includes("object-src 'none'") && p.includes("base-uri 'self'"))
})
