// Post-build: gera out/sw.js (service worker) versionado pelo build id do Next.
// Stale-while-revalidate para /data/*.json e assets estáticos (/_next/static, ícones, logos, fontes).
// HTML/navegação, requisições de outros domínios (GA, IBGE) e não-GET não são interceptados.
// Uso: node scripts/sw.mjs [dir=out]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** 'data' | 'static' | null — o que o service worker trata e com qual cache */
export function classify(url, origin, bp) {
  let u
  try { u = new URL(url) } catch { return null }
  if (u.origin !== origin) return null
  const p = u.pathname
  if (!p.startsWith(bp + '/') || p === bp + '/sw.js') return null
  if (p.startsWith(bp + '/data/')) return p.endsWith('.json') ? 'data' : null
  if (p.startsWith(bp + '/_next/static/')) return 'static'
  if (/\.(?:svg|png|ico|webp|jpe?g|woff2?|css)$/i.test(p)) return 'static'
  return null
}

export function swSource(version, bp) {
  return `/* Quant Terminal service worker — build ${version} (gerado por scripts/sw.mjs) */
'use strict'
const V = ${JSON.stringify(version)}, BP = ${JSON.stringify(bp)}
const STATIC = 'qt-static-' + V, DATA = 'qt-data-' + V, MAX_DATA = 400
const classify = ${classify.toString()}
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('qt-') && k !== STATIC && k !== DATA).map(k => caches.delete(k))))
    .then(() => self.clients.claim())))
async function trim(c) {
  const ks = await c.keys()
  for (let i = 0; i < ks.length - MAX_DATA; i++) await c.delete(ks[i])
}
self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET' || r.mode === 'navigate' || r.headers.has('range')) return
  const kind = classify(r.url, self.location.origin, BP)
  if (!kind) return
  const name = kind === 'data' ? DATA : STATIC
  const net = caches.open(name).then(c => fetch(r).then(res => {
    if (res.ok && res.type === 'basic') c.put(r, res.clone()).then(() => kind === 'data' && trim(c)).catch(() => {})
    return res
  }))
  e.respondWith(caches.open(name).then(c => c.match(r)).then(hit => hit || net))
  e.waitUntil(net.then(() => {}, () => {}))
})
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'out'
  const idFile = '.next/BUILD_ID'
  const version = existsSync(idFile) ? readFileSync(idFile, 'utf8').trim() : String(Date.now())
  const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'
  writeFileSync(join(out, 'sw.js'), swSource(version, bp))
  console.log(`sw: ${version}`)
}
