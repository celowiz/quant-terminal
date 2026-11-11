// Camada ao vivo: todo host que o navegador consulta precisa estar no connect-src (scripts/csp.mjs) e todo host
// liberado precisa ser usado (CSP justa: nada sobrando). Lê o código-fonte dos buscadores ao vivo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LIVE_HOSTS, buildPolicy } from './csp.mjs'

const src = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const origins = s => new Set([...s.matchAll(/\b(https|wss):\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(m => `${m[1].toLowerCase()}://${m[2].toLowerCase()}`))

test('hosts ao vivo ⊆ connect-src e connect-src sem sobra', () => {
  const news = (src('views/fn/market.tsx').match(/const NEWS_LIVE[\s\S]*?\n\]/) || [''])[0]
  assert.ok(news.includes('agenciabrasil'), 'lista de feeds ao vivo da NEWS encontrada')
  const used = new Set([...origins(src('lib/liveFetch.ts')), ...origins(src('lib/live.mjs')), ...origins(src('lib/ibgeLive.ts')), ...origins(news)])
  const allowed = new Set([...LIVE_HOSTS, 'https://servicodados.ibge.gov.br'])
  for (const h of used) assert.ok(allowed.has(h), `host ao vivo fora do connect-src: ${h}`)
  for (const h of LIVE_HOSTS) assert.ok(used.has(h), `host liberado e não usado: ${h}`)
  const cs = buildPolicy([]).split(';').find(d => d.trim().startsWith('connect-src'))
  for (const h of LIVE_HOSTS) assert.ok(cs.includes(h), h)
  for (const h of LIVE_HOSTS) assert.ok(!h.includes('*'), `sem curinga nos hosts ao vivo: ${h}`)
  for (const tok of cs.split(/\s+/).filter(t => t.includes('*'))) assert.match(tok, /google-analytics\.com|analytics\.google\.com|googletagmanager\.com/, `curinga fora da medição de audiência: ${tok}`)
})
