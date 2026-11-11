// Post-build: injeta CSP + referrer policy em cada HTML do export estático (GitHub Pages não permite headers).
// Scripts inline (BOOT do layout + payloads RSC do Next) entram por hash sha256, sem 'unsafe-inline'.
// Uso: node scripts/csp.mjs [dir=out]
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const GA = ['https://*.googletagmanager.com']
const GA_DATA = ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com']

// Fontes ao vivo buscadas direto do navegador (CORS verificado num navegador real em 10/11/2026); só estes hosts.
export const LIVE_HOSTS = [
  'https://cotacao.b3.com.br',            // cotações com atraso e histórico do dia
  'https://api.bcb.gov.br',               // séries oficiais
  'https://olinda.bcb.gov.br',            // pesquisa de expectativas e PTAX
  'https://www.bcb.gov.br',               // comunicados do Copom e notas à imprensa
  'https://agenciabrasil.ebc.com.br',     // manchetes (licença aberta)
  'https://api.exchange.coinbase.com',    // lista de pares de cripto
  'wss://ws-feed.exchange.coinbase.com',  // cotações de cripto por websocket
  'https://raw.githubusercontent.com',   // arquivos pequenos do watcher (branch live do próprio repositório)
  'https://api.github.com',              // pulso: sha do último commit do branch live
  'https://api.bls.gov',                 // CPI, payroll e desemprego dos EUA no dia da divulgação
]

export function inlineScriptHashes(html) {
  const out = new Set()
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1]) || !m[2]) continue
    if (/\btype\s*=\s*["']?application\/(ld\+)?json/i.test(m[1])) continue
    out.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
  }
  return [...out]
}

export function buildPolicy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...hashes, ...GA].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${GA_DATA.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' data: blob: https://servicodados.ibge.gov.br ${LIVE_HOSTS.join(' ')} ${GA_DATA.join(' ')}`,
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export function injectCsp(html) {
  if (/http-equiv=["']Content-Security-Policy/i.test(html)) return html
  const metas = `<meta http-equiv="Content-Security-Policy" content="${buildPolicy(inlineScriptHashes(html))}"/>` +
    '<meta name="referrer" content="strict-origin-when-cross-origin"/>'
  const charset = /<meta\s+charSet=["']utf-8["']\s*\/?>/i
  if (charset.test(html)) return html.replace(charset, s => s + metas)
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, s => s + metas)
  throw new Error('html sem <head>')
}

function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '_next' && n !== 'data') walk(p, acc) }
    else if (n.endsWith('.html')) acc.push(p)
  }
  return acc
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = walk(process.argv[2] || 'out')
  for (const f of files) writeFileSync(f, injectCsp(readFileSync(f, 'utf8')))
  console.log(`csp: ${files.length} html`)
}
