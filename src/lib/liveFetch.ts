/**
 * Camada ao vivo no navegador: busca direta nas fontes oficiais que aceitam CORS sem chave
 * (verificado num navegador real em 10/11/2026). Toda falha devolve null e a tela fica com o retrato diário publicado.
 * Cada host aqui precisa estar no connect-src de scripts/csp.mjs (LIVE_HOSTS).
 */
import { useEffect, useRef, useState } from 'react'
import { b3Quote, b3Day, copomTitle, ptaxBulletins, feedDate, type B3Quote } from './live.mjs'

const B3 = 'https://cotacao.b3.com.br/mds/api/v1'

/** GET com tempo-limite e sem cache do navegador; null em qualquer falha */
export async function getLive<T = any>(url: string, opt: { ms?: number; text?: boolean } = {}): Promise<T | null> {
  if (typeof window === 'undefined') return null
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), opt.ms ?? 8000)
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!r.ok) return null
    return (opt.text ? await r.text() : await r.json()) as T
  } catch { return null } finally { clearTimeout(tm) }
}

/**
 * Executa fn ao montar e de novo após next(agora) ms (null = para). Só busca com a aba visível;
 * ao voltar para a aba, busca na hora. Devolve o último resultado não nulo e o instante da busca.
 */
export function useLive<T>(fn: (() => Promise<T | null>) | null, next: (now: number) => number | null, deps: any[]): { data: T | null; at: number | null; tried: boolean } {
  const [st, setSt] = useState<{ data: T | null; at: number | null; tried: boolean }>({ data: null, at: null, tried: false })
  const nextRef = useRef(next); nextRef.current = next
  useEffect(() => {
    if (!fn) { setSt({ data: null, at: null, tried: false }); return }
    let alive = true, tm: any = null
    setSt({ data: null, at: null, tried: false })
    const run = async () => {
      if (tm) { clearTimeout(tm); tm = null }
      if (document.visibilityState === 'hidden') return
      const v = await fn()
      if (!alive) return
      setSt(s => (v != null ? { data: v, at: Date.now(), tried: true } : { ...s, tried: true }))
      const n = nextRef.current(Date.now())
      if (n != null) tm = setTimeout(run, Math.max(5000, n))
    }
    const vis = () => { if (document.visibilityState === 'visible') run() }
    run(); document.addEventListener('visibilitychange', vis)
    return () => { alive = false; if (tm) clearTimeout(tm); document.removeEventListener('visibilitychange', vis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return st
}

export const b3QuoteLive = async (sym: string): Promise<B3Quote | null> => b3Quote(await getLive(`${B3}/instrumentQuotation/${encodeURIComponent(sym)}`))
export const b3DayLive = async (sym: string) => b3Day(await getLive(`${B3}/DailyFluctuationHistory/${encodeURIComponent(sym)}`))

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
/** valores recentes de uma série oficial do BC: mensais = últimos n; diárias = janela de 10 dias até hoje (a meta da Selic traz datas futuras) */
export const sgsLive = (code: number | string, daily: boolean, today: string, n = 3) => getLive<{ data: string; valor: string }[]>(daily
  ? `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${ddmmyyyy(new Date(Date.parse(today + 'T12:00:00Z') - 10 * 864e5).toISOString().slice(0, 10))}&dataFinal=${ddmmyyyy(today)}`
  : `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${n}?formato=json`)
  .then(r => (Array.isArray(r) ? r : null))

/** medianas mais recentes da pesquisa de expectativas (mesmo filtro do pipeline: base de cálculo 0, última data) */
export async function focusLive(ind: string) {
  const u = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=40&$format=json'
    + `&$filter=Indicador%20eq%20'${encodeURIComponent(ind)}'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc`
  const v = (await getLive<any>(u))?.value
  if (!Array.isArray(v) || !v.length) return null
  const d0 = v[0].Data
  return v.filter((r: any) => r.Data === d0).map((r: any) => ({ indicator: ind, date: d0, year: r.DataReferencia, median: r.Mediana, mean: r.Media, n: r.numeroRespondentes }))
}

/** comunicados mais recentes do Copom */
export async function copomLive(n = 3) {
  const j = await getLive<any>(`https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados?quantidade=${n}`)
  const c = j?.conteudo
  return Array.isArray(c) && c.length ? c.map(copomTitle) : null
}

/** boletins PTAX do dia (dia em AAAA-MM-DD, Brasília) */
export async function ptaxLive(day: string, ccy = 'USD') {
  const [y, m, d] = day.split('-')
  const u = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${ccy}'&@dataCotacao='${m}-${d}-${y}'&$format=json`
  const j = await getLive<any>(u)
  return j?.value ? ptaxBulletins(j) : null
}

export type FeedItem = { source: string; license: string; title: string; link: string; date: string; tags: string[]; live?: boolean }
/** RSS 2.0 ou Atom → manchetes (título + link); só links http(s) */
export async function feedLive(url: string, source: string, license: string, max = 30): Promise<FeedItem[] | null> {
  const xml = await getLive<string>(url, { text: true })
  if (!xml || typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  const out: FeedItem[] = []
  const nodes = Array.from(doc.querySelectorAll('item, entry')).slice(0, max)
  for (const n of nodes) {
    const title = (n.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim()
    const le = n.querySelector('link')
    let link = (le?.getAttribute('href') || le?.textContent || '').trim()
    if (link.startsWith('/')) { try { link = new URL(link, url).href } catch { link = '' } }
    const date = feedDate(n.querySelector('pubDate')?.textContent || n.querySelector('updated')?.textContent || n.querySelector('published')?.textContent || '')
    if (!title || !date || !/^https?:\/\/[^\s/]+/i.test(link)) continue
    out.push({ source, license, title, link, date, tags: [], live: true })
  }
  return out
}

/** cotações de cripto por websocket (canal de ticker público); reconecta com espera crescente; Map vazio = sem dado ao vivo */
export function useCryptoTicker(products: string[]): { px: Map<string, { price: number; open24: number | null; at: number }>; up: boolean } {
  const [px, setPx] = useState(new Map<string, { price: number; open24: number | null; at: number }>())
  const [up, setUp] = useState(false)
  const key = products.join(',')
  useEffect(() => {
    if (!products.length || typeof WebSocket === 'undefined') return
    let ws: WebSocket | null = null, alive = true, wait = 2000, tm: any = null, buf = new Map<string, any>(), flush: any = null
    const connect = () => {
      try { ws = new WebSocket('wss://ws-feed.exchange.coinbase.com') } catch { return }
      ws.onopen = () => { wait = 2000; ws?.send(JSON.stringify({ type: 'subscribe', product_ids: products, channels: ['ticker'] })) }
      ws.onmessage = ev => {
        let m: any; try { m = JSON.parse(String(ev.data)) } catch { return }
        if (m.type === 'subscriptions') setUp(true)
        if (m.type !== 'ticker' || !Number.isFinite(+m.price)) return
        buf.set(m.product_id, { price: +m.price, open24: Number.isFinite(+m.open_24h) ? +m.open_24h : null, at: Date.now() })
        if (!flush) flush = setTimeout(() => { flush = null; const b = buf; buf = new Map(); setPx(p => { const n = new Map(p); b.forEach((v, k) => n.set(k, v)); return n }) }, 1000)
      }
      ws.onclose = () => { setUp(false); if (alive) { tm = setTimeout(connect, wait); wait = Math.min(60000, wait * 2) } }
      ws.onerror = () => { try { ws?.close() } catch { /* fecha */ } }
    }
    connect()
    return () => { alive = false; if (tm) clearTimeout(tm); if (flush) clearTimeout(flush); try { ws?.close() } catch { /* fecha */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { px, up }
}

/** produtos de cripto em US$ disponíveis no canal público (lista de pares); null se a lista falhar */
export async function cryptoProducts(): Promise<Set<string> | null> {
  const j = await getLive<any[]>('https://api.exchange.coinbase.com/products', { ms: 10000 })
  if (!Array.isArray(j)) return null
  return new Set(j.filter(p => p.quote_currency === 'USD' && !p.trading_disabled && p.status === 'online').map(p => p.id as string))
}
