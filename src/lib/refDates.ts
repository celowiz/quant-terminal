/** Datas de referência (as of) dos dados que a tela atual carregou.
 *  getJSON registra cada arquivo; FnScreen zera a lista ao trocar de função/ativo e mostra a data mais recente;
 *  o modal "?" lista a data de cada arquivo. Nada é estimado: a data vem do próprio JSON. */
import tickers from '../../public/data/tickers.json'

export type RefDate = { path: string; date: string; kind: 'data' | 'generated'; official?: boolean }

const ISO = /^\d{4}-\d{2}-\d{2}/
const KEYS = ['as_of', 'date', 'ref_date', 'last', 'time']
const SKIP = new Set(['tickers.json'])

/** Data de referência de um JSON: última barra (`time`) em séries; campo de data no topo; senão a geração. */
export function refDateOf(d: any): { date: string; kind: RefDate['kind'] } | null {
  if (Array.isArray(d)) {
    const last = d[d.length - 1]
    const v = last && (last.time ?? last.date)
    return typeof v === 'string' && ISO.test(v) ? { date: v.slice(0, 10), kind: 'data' } : null
  }
  if (!d || typeof d !== 'object') return null
  for (const k of KEYS) { const v = d[k]; if (typeof v === 'string' && ISO.test(v)) return { date: v.slice(0, 10), kind: 'data' } }
  if (d.official_close && typeof d.official_close.date === 'string') return { date: d.official_close.date, kind: 'data' }
  if (Array.isArray(d.raw_close) && d.raw_close.length) return { date: String(d.raw_close[d.raw_close.length - 1][0]), kind: 'data' }
  if (typeof d.generated_at === 'string' && ISO.test(d.generated_at)) return { date: d.generated_at.slice(0, 10), kind: 'generated' }
  return null
}

let cur: RefDate[] = []
// tickers.json do build (o mesmo que gera as rotas): `official` = data da última barra vinda do COTAHIST
const officialByKey: Record<string, string> = Object.fromEntries(
  ((tickers as unknown as { tickers: { key: string; official?: string }[] }).tickers || []).filter(t => t.official).map(t => [t.key, t.official as string]))
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())

export function recordRef(path: string, d: any) {
  if (SKIP.has(path)) return
  const r = refDateOf(d)
  if (!r) return
  const m = /^prices\/(.+)\.json$/.exec(path)
  const official = (m && officialByKey[m[1]] === r.date) || (d && !Array.isArray(d) && d.official_close?.date === r.date) || undefined
  const i = cur.findIndex(x => x.path === path)
  const e: RefDate = { path, ...r, ...(official ? { official: true } : {}) }
  if (i >= 0 && cur[i].date === e.date && cur[i].official === e.official) return
  cur = i >= 0 ? cur.map((x, j) => j === i ? e : x) : [...cur, e]
  emit()
}

let scope = ''
/** Chamado no render do FnScreen: nova função/ativo → começa lista nova (efeitos dos filhos rodam depois). */
export function refScope(key: string) {
  if (key === scope) return
  scope = key; cur = []
  queueMicrotask(emit)
}
export const getRefs = () => cur
export const subscribeRefs = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** Data mais recente entre os dados (não a geração do arquivo), ou a geração quando é tudo o que há. */
export function latestRef(list: RefDate[]): RefDate | null {
  const data = list.filter(r => r.kind === 'data')
  const pool = data.length ? data : list
  return pool.reduce<RefDate | null>((b, r) => !b || r.date > b.date ? r : b, null)
}
