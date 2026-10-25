// Camada de dados estática: substitui a API FastAPI por JSON gerado no GitHub Actions
// e publicado junto com o site (GitHub Pages). Sem servidor em runtime.
import { RRGResponse, RRGFormData, RRGAssetData, RRGPoint } from '@/types/rrg'

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''
export const href = (path: string) => `${BASE_PATH}${path.startsWith('/') ? path : '/' + path}`
export const go = (path: string) => { if (typeof window !== 'undefined') window.location.assign(href(path)) }
/** pathname sem o basePath, ex: /quant-terminal/gp/PETR4.SA/ -> ['gp','PETR4.SA'] */
export const pathParts = (): string[] => {
  if (typeof window === 'undefined') return []
  let p = window.location.pathname
  if (BASE_PATH && p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length)
  return p.split('/').filter(Boolean).map(decodeURIComponent)
}

const cache = new Map<string, Promise<any>>()
export function getJSON<T = any>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(path, fetch(href(`/data/${path}`)).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em ${path}`)
      return r.json()
    }))
  }
  return cache.get(path)!
}

// Mesma transformação que o backend usava para nomes de tabela
export const tickerKey = (t: string) => t.toUpperCase().replace(/^\^/, 'IDX_').replace(/\.SA$/, '').replace(/[.=\-]/g, '_')

export type TickerMeta = { ticker: string; key: string; name: string; first: string; last: string; n: number }
export type TickersFile = { generated_at: string; source: string; tickers: TickerMeta[] }
export type Price = { time: string; open: number; high: number; low: number; close: number; volume: number }

export const listTickers = async () => (await getJSON<TickersFile>('tickers.json')).tickers.map(t => t.ticker).sort()
export const tickerMeta = async (ticker: string) => {
  const k = tickerKey(ticker)
  return (await getJSON<TickersFile>('tickers.json')).tickers.find(t => t.key === k) || null
}

function periodKey(d: string, tf: string) {
  const [y, m, day] = d.split('-').map(Number)
  if (tf === 'y') return `${y}`
  if (tf === 'q') return `${y}-Q${Math.floor((m - 1) / 3)}`
  if (tf === 'm') return `${y}-${m}`
  // semana (pandas 'W' = semana terminando no domingo)
  const dt = new Date(Date.UTC(y, m - 1, day))
  const dow = dt.getUTCDay() // 0=dom
  const end = new Date(dt.getTime() + ((7 - dow) % 7) * 86400000)
  return end.toISOString().slice(0, 10)
}

/** Equivalente a GET /prices/{ticker}?start_date&end_date&timeframe */
export async function getPrices(ticker: string, start?: string, end?: string, timeframe = 'd'): Promise<Price[]> {
  const rows = (await getJSON<Price[]>(`prices/${tickerKey(ticker)}.json`))
    .filter(r => (!start || r.time >= start) && (!end || r.time <= end))
  if (timeframe === 'd' || !['w', 'm', 'q', 'y'].includes(timeframe)) return rows
  const out: Price[] = []
  let cur: Price | null = null, curKey = ''
  for (const r of rows) {
    const k = periodKey(r.time, timeframe)
    if (!cur || k !== curKey) {
      if (cur) out.push(cur)
      cur = { ...r }; curKey = k
    } else {
      cur.high = Math.max(cur.high, r.high); cur.low = Math.min(cur.low, r.low)
      cur.close = r.close; cur.volume += r.volume; cur.time = r.time
    }
  }
  if (cur) out.push(cur)
  return out
}

// ---------- RRG (porte fiel de backend/api/routers/rrg.py) ----------
const DEFAULT_RRG_TICKERS = ['PETR4', 'VALE3', 'B3SA3', 'IDX_BVSP']

function weeklyFri(rows: Price[]): Map<string, number> {
  // resample('W-FRI').last()
  const m = new Map<string, number>()
  for (const r of rows) {
    const [y, mo, d] = r.time.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    const add = (5 - dt.getUTCDay() + 7) % 7
    m.set(new Date(dt.getTime() + add * 86400000).toISOString().slice(0, 10), r.close)
  }
  return m
}
function ma(x: (number | null)[], w: number, ema: boolean): (number | null)[] {
  const out: (number | null)[] = []
  if (ema) {
    const a = 2 / (w + 1); let prev: number | null = null; let cnt = 0
    for (const v of x) {
      if (v == null) { out.push(prev != null && cnt >= w ? prev : null); continue }
      prev = prev == null ? v : a * v + (1 - a) * prev; cnt++
      out.push(cnt >= w ? prev : null)
    }
  } else {
    for (let i = 0; i < x.length; i++) {
      const win = x.slice(Math.max(0, i - w + 1), i + 1)
      out.push(win.length === w && win.every(v => v != null) ? (win as number[]).reduce((s, v) => s + v, 0) / w : null)
    }
  }
  return out
}
// Savitzky-Golay janela 5, ordem 2, mode='interp' (como scipy)
function polyfitEval(ys: number[], xsEval: number[]): number[] {
  const n = ys.length, xs = ys.map((_, i) => i)
  const S = (p: number) => xs.reduce((s, x) => s + x ** p, 0)
  const T = (p: number) => xs.reduce((s, x, i) => s + x ** p * ys[i], 0)
  const A = [[n, S(1), S(2)], [S(1), S(2), S(3)], [S(2), S(3), S(4)]], b = [T(0), T(1), T(2)]
  const det = (M: number[][]) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  const D = det(A)
  const c = [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D)
  return xsEval.map(x => c[0] + c[1] * x + c[2] * x * x)
}
function savgol(y: number[]): number[] {
  const n = y.length
  if (n < 3) return y
  const w = Math.min(5, n) % 2 === 0 ? Math.min(5, n) - 1 : Math.min(5, n)
  if (w < 3) return y
  const h = (w - 1) / 2, out = y.slice()
  for (let i = h; i < n - h; i++) out[i] = polyfitEval(y.slice(i - h, i + h + 1), [h])[0]
  const head = polyfitEval(y.slice(0, w), Array.from({ length: h }, (_, i) => i))
  const tail = polyfitEval(y.slice(n - w), Array.from({ length: h }, (_, i) => w - h + i))
  head.forEach((v, i) => (out[i] = v)); tail.forEach((v, i) => (out[n - h + i] = v))
  return out
}
function smooth(s: (number | null)[]): (number | null)[] {
  const idx = s.map((v, i) => (v != null ? i : -1)).filter(i => i >= 0)
  const sm = savgol(idx.map(i => s[i] as number))
  const out: (number | null)[] = s.map(() => null)
  idx.forEach((i, k) => (out[i] = sm[k]))
  return out
}
const quadrant = (r: number, m: number) => (r >= 100 && m >= 100 ? 'Leading' : r < 100 && m >= 100 ? 'Improving' : r < 100 && m < 100 ? 'Lagging' : 'Weakening')

/** Equivalente a GET /rrg — calculado no navegador a partir dos JSON de preços */
export async function computeRRG(p: RRGFormData): Promise<RRGResponse> {
  const bench = tickerKey(p.benchmark)
  let list = p.tickers ? p.tickers.split(',').map(t => tickerKey(t.trim())).filter(Boolean) : DEFAULT_RRG_TICKERS.slice()
  if (!list.includes(bench)) list.push(bench)
  // como o backend: merge diário (outer) + dropna => só datas com todos os ativos; depois W-FRI last
  const daily: Record<string, Price[]> = {}
  for (const k of list) {
    try { daily[k] = await getJSON<Price[]>(`prices/${k}.json`) } catch { /* ticker ausente: ignora, como o backend */ }
  }
  const sets = Object.values(daily).map(rows => new Set(rows.map(r => r.time)))
  const common = (rows: Price[]) => rows.filter(r => sets.every(st => st.has(r.time)))
  const series: Record<string, Map<string, number>> = {}
  for (const k of Object.keys(daily)) series[k] = weeklyFri(common(daily[k]))
  if (!series[bench]) throw new Error(`Benchmark '${bench}' não encontrado nos dados`)
  // inner join (dropna) nas datas semanais
  const keys = Object.keys(series)
  const dates = Array.from(series[bench].keys()).filter(d => keys.every(k => series[k].has(d))).sort()
  const assets = keys.filter(k => k !== bench)
  const out: RRGAssetData[] = []
  let tailDates: string[] = []
  for (const a of assets) {
    const rs = dates.map(d => series[a].get(d)! / series[bench].get(d)!)
    const rsMa = ma(rs, p.lookback_ratio, p.use_ema)
    const ratio = rs.map((v, i) => (rsMa[i] != null ? 100 * (v / (rsMa[i] as number)) : null))
    const mom = ratio.map((v, i) => (v != null && i >= p.lookback_mom && ratio[i - p.lookback_mom] != null ? 100 * (v / (ratio[i - p.lookback_mom] as number)) : null))
    const r2 = smooth(ratio), m2 = smooth(mom)
    const start = Math.max(0, dates.length - (p.tail + 1))
    tailDates = dates.slice(start)
    const points: RRGPoint[] = []
    for (let i = start; i < dates.length; i++) {
      if (r2[i] != null && m2[i] != null) points.push({ date: `${dates[i]}T00:00:00`, rs_ratio: r2[i]!, rs_momentum: m2[i]!, quadrant: quadrant(r2[i]!, m2[i]!) })
    }
    if (points.length) {
      const c = points[points.length - 1]
      out.push({ ticker: a, points, current_rs_ratio: c.rs_ratio, current_rs_momentum: c.rs_momentum, current_quadrant: c.quadrant })
    }
  }
  return {
    config: { benchmark_col: bench, lookback_ratio: p.lookback_ratio, lookback_mom: p.lookback_mom, tail: p.tail, use_ema: p.use_ema },
    benchmark: bench, assets: out,
    date_range: { start: tailDates[0] ? `${tailDates[0]}T00:00:00` : null, end: tailDates.length ? `${tailDates[tailDates.length - 1]}T00:00:00` : null },
  }
}
