'use client'
/** Kit de UI das funções do terminal (estilo terminal financeiro: fundo preto, âmbar, tabelas densas, monoespaçada).
 *  Referências de design por função: /REFERENCIAS.md */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getJSON, href, tickerKey } from '../../lib/static'
import { FUNCTION_LIST } from '../../constants/functions'
import { lang, numLocale } from '../../lib/settings'
import { t } from '../../lib/i18n'
import { trackPeriod } from '../../lib/track'
import { setHelp } from '../../lib/help'
import { en as tx } from '../../lib/enText'

export const C = {
  bg: '#000000', panel: '#0d0d0d', panel2: '#151515', line: '#2a2a2a', text: '#e6e6e6', muted: '#8a8a8a',
  amber: '#FFA028', amberDim: '#b36b10', up: '#3DDC84', down: '#FF4D4D', blue: '#2F7BFF', cyan: '#4FC3F7',
  white: '#FFFFFF', purple: '#C77DFF', yellow: '#FFE14D',
}
export const MONO = "'IBM Plex Mono','Roboto Mono','SFMono-Regular',Menlo,Consolas,ui-monospace,monospace"
export const PALETTE = ['#FFFFFF', '#FFA028', '#2F7BFF', '#3DDC84', '#FF4D4D', '#C77DFF', '#4FC3F7', '#FFE14D', '#FF7AB6', '#9CCC65', '#B0BEC5', '#FF8A65']

// ---------- formatação de números (Settings → Number format: 1,234.56 ou 1.234,56) ----------
export const nf = (v: any, d = 2) => v == null || v === '' || Number.isNaN(+v) || !isFinite(+v) ? '—' : (+v).toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d })
export const pf = (v: any, d = 2, sign = true) => v == null || Number.isNaN(+v) || !isFinite(+v) ? '—' : `${sign && +v > 0 ? '+' : ''}${nf(v, d)}%`
export const big = (v: any, d = 2) => {
  if (v == null || Number.isNaN(+v)) return '—'
  const a = Math.abs(+v), s = +v < 0 ? '-' : ''
  if (a >= 1e12) return `${s}${nf(a / 1e12, d)}T`
  if (a >= 1e9) return `${s}${nf(a / 1e9, d)}B`
  if (a >= 1e6) return `${s}${nf(a / 1e6, d)}M`
  if (a >= 1e3) return `${s}${nf(a / 1e3, d)}K`
  return `${s}${nf(a, d)}`
}
export const dBR = (s?: string | null) => !s ? '—' : `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}`
export const dBRfull = (s?: string | null) => !s ? '—' : `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
export const clr = (v: any) => v == null || Number.isNaN(+v) || +v === 0 ? C.text : +v > 0 ? C.up : C.down
export const short = (t: string) => t.replace(/\.SA$/, '')

// ---------- dados ----------
export function useJSON<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!path) return
    let alive = true
    getJSON<T>(path).then(d => alive && setData(d)).catch(e => alive && setErr(String(e?.message || e)))
    return () => { alive = false }
  }, [path])
  return { data, err }
}
export const EQUITIES = ['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA']
export const isEquity = (t: string) => EQUITIES.includes(t.toUpperCase())
/** Benchmark padrão por mercado: ações e índices BR → Ibovespa; Ibovespa → dólar (BRL=X); S&P 500 → Nasdaq-100;
 *  demais (ações e ETFs dos EUA, índices externos, cripto, commodities) → S&P 500. Usado em GR, BETA, HS e HRA. */
export function defaultBench(t: string) {
  const u = t.toUpperCase()
  if (u === '^BVSP') return 'BRL=X'
  if (u.endsWith('.SA') || u.includes('BRL')) return '^BVSP'
  if (u === '^GSPC') return '^NDX'
  return '^GSPC'
}
export const isBR = (t: string) => { const u = t.toUpperCase(); return u.endsWith('.SA') || u === '^BVSP' || u.includes('BRL') }
export const corpPath = (t: string) => isEquity(t) ? `corp/${tickerKey(t)}.json` : null

// ---------- encaixe na viewport (desktop ≥1024px) ----------
/** Fator de escala das partes elásticas (gráficos e tabelas). active=false no mobile: alturas originais. */
export const FitCtx = createContext<{ s: number; active: boolean }>({ s: 1, active: false })
export const useFit = () => useContext(FitCtx)
/** altura elástica: base × s (mín. `min`) quando o encaixe está ativo */
export function FitBox({ base, min = 120, className, style, children }: { base: number; min?: number; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const mh = useFitH(base, min)
  return <div className={className} style={{ ...style, maxHeight: mh }}>{children}</div>
}
export function useFitH(base: number, min = 110) { const { s, active } = useFit(); return active ? Math.max(min, Math.round(base * s)) : base }
const DESKTOP_Q = '(min-width: 1024px)'
export function useDesktop() {
  const [d, setD] = useState(false)
  useEffect(() => { const m = window.matchMedia(DESKTOP_Q); const f = () => setD(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return d
}
/** Procura (busca binária) o maior fator s em que o conteúdo cabe na área da função, sem rolagem da página.
 *  Se nem no mínimo couber, libera rolagem interna da área (fallback, marcado com data-fit-overflow). */
export function FitArea({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement | null>(null), inner = useRef<HTMLDivElement | null>(null)
  const desktop = useDesktop()
  const [s, setS] = useState(1), [ov, setOv] = useState(false)
  const last = useRef({ h: -1, w: -1, oh: -1 }), busy = useRef(false), sRef = useRef(1)
  useEffect(() => {
    const o = outer.current, n = inner.current
    if (!o || !n) return
    if (!desktop) { setS(1); setOv(false); return }
    let raf = 0
    const fits = (x: number) => { sRef.current = x; flushSync(() => setS(x)); return n.getBoundingClientRect().height <= o.clientHeight + 0.5 }
    const run = () => {
      if (busy.current) return
      const nh = Math.round(n.getBoundingClientRect().height), oh = o.clientHeight, w = o.clientWidth
      if (Math.abs(nh - last.current.h) < 2 && oh === last.current.oh && w === last.current.w) return
      busy.current = true
      try {
        let lo = 0.25, hi = 2.6, best = lo, over = false
        if (fits(hi)) best = hi
        else if (!fits(lo)) over = true
        else { for (let i = 0; i < 11; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid } best = lo }
        flushSync(() => setOv(over)); fits(best)
        last.current = { h: Math.round(n.getBoundingClientRect().height), oh, w }
      } finally { busy.current = false }
    }
    const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run) }
    const ro = new ResizeObserver(sched); ro.observe(o); ro.observe(n)
    sched()
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [desktop])
  return (
    <FitCtx.Provider value={{ s, active: desktop }}>
      <div ref={outer} className={`lg:flex-1 lg:min-h-0 ${className}`} data-fit-scale={s.toFixed(3)} data-fit-overflow={ov ? '1' : '0'}
        style={desktop ? { overflowX: 'auto', overflowY: ov ? 'auto' : 'hidden' } : undefined}>
        <div ref={inner}>{children}</div>
      </div>
    </FitCtx.Provider>
  )
}

// ---------- layout ----------
export function FnScreen({ code, ticker, title, tabs, tab, setTab, right, children, source, note }: {
  code: string; ticker?: string; title?: string; tabs?: string[]; tab?: number; setTab?: (i: number) => void
  right?: React.ReactNode; children: React.ReactNode; source?: React.ReactNode; note?: React.ReactNode
}) {
  const fi = FUNCTION_LIST.find(f => f.code === code)
  const desc = lang() === 'pt' && fi ? fi.pt : tx(title) || fi?.desc || code
  // metodologia/fonte vão para o modal "?" (TopBar); a tela fica livre para gráficos e tabelas
  useEffect(() => { setHelp({ code, note, source }) }, [code, note, source])
  useEffect(() => () => setHelp(null), [])
  return (
    <div className="w-full px-2 pb-3 lg:pb-1 -mt-4 sm:-mt-6 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col" style={{ fontFamily: MONO, color: C.text }}>
      {/* mobile (<1024px): 2 linhas — código+título / controles numa faixa com rolagem horizontal */}
      <div className="flex items-center gap-0 border-b shrink-0 max-lg:flex-wrap" style={{ borderColor: C.line, background: C.panel }}>
        {ticker && <span className="px-2 py-1 text-[13px] font-bold max-lg:shrink-0" style={{ background: C.amber, color: '#000' }}>{short(ticker)}</span>}
        <span className="px-2 py-1 text-[13px] font-bold max-lg:shrink-0" style={{ color: C.amber }}>{code}</span>
        <span className="px-2 py-1 text-[13px] max-lg:flex-1 max-lg:min-w-0 max-lg:truncate" style={{ color: C.text }} title={desc}>{desc}</span>
        <div className={`ml-auto flex items-center gap-2 pr-2 text-[12px] fn-strip max-lg:ml-0 max-lg:w-full max-lg:pl-2 max-lg:py-1 max-lg:border-t max-lg:border-[#2a2a2a] max-lg:overflow-x-auto max-lg:whitespace-nowrap max-lg:[&>*]:shrink-0 ${right ? '' : 'max-lg:hidden'}`}>{right}</div>
      </div>
      {tabs && tabs.length > 0 && (
        <div className="flex flex-wrap gap-0 border-b shrink-0 fn-strip max-lg:flex-nowrap max-lg:overflow-x-auto" style={{ borderColor: C.line, background: '#050505' }}>
          {tabs.map((t, i) => (
            <button key={t} data-fn-tab onClick={() => setTab && setTab(i)} className="px-3 py-1 text-[12px] border-r max-lg:shrink-0 max-lg:whitespace-nowrap"
              style={{ borderColor: C.line, color: tab === i ? '#000' : C.amber, background: tab === i ? C.amber : 'transparent' }}>
              <span style={{ color: tab === i ? '#000' : C.white }}>{i + 1})</span> {tx(t)}
            </button>
          ))}
        </div>
      )}
      <FitArea className="pt-2">{children}</FitArea>
    </div>
  )
}

export function Panel({ title, children, className = '', right }: { title?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={`border ${className}`} style={{ borderColor: C.line, background: C.panel }}>
      {title && <div className="flex items-center px-2 py-[3px] text-[12px] font-bold border-b" style={{ color: C.amber, borderColor: C.line, background: C.panel2 }}>{tx(title)}<div className="ml-auto font-normal">{right}</div></div>}
      <div>{children}</div>
    </div>
  )
}

export type Col<R = any> = { k: string; label: React.ReactNode; align?: 'l' | 'r' | 'c'; fmt?: (v: any, r: R) => React.ReactNode; color?: (v: any, r: R) => string | undefined; w?: string }
export function Grid<R = any>({ cols, rows, dense = true, onRow, maxH, rowStyle }: { cols: Col<R>[]; rows: R[]; dense?: boolean; onRow?: (r: R) => void; maxH?: number; rowStyle?: (r: R, i: number) => React.CSSProperties | undefined }) {
  const fit = useFit()
  const mh = fit.active ? Math.max(90, Math.round((maxH ?? 480) * fit.s)) : maxH
  const desk = useDesktop()
  const scRef = useRef<HTMLDivElement | null>(null)
  const [more, setMore] = useState(false)
  const chk = () => { const el = scRef.current; if (el) setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4) }
  useEffect(() => { if (desk) return; const el = scRef.current; if (!el) return; chk(); const ro = new ResizeObserver(chk); ro.observe(el); return () => ro.disconnect() }, [desk, rows.length, cols.length])
  const body = (
    <div ref={desk ? undefined : scRef} onScroll={desk ? undefined : chk} className="overflow-auto fn-gridwrap" style={{ maxHeight: mh }}>
      <table className="w-full border-collapse text-[12px] fn-table">
        <thead className="sticky top-0" style={{ background: C.panel2 }}>
          <tr>{cols.map(c => <th key={c.k} className={`${dense ? 'px-2 py-[3px]' : 'px-3 py-1.5'} font-normal whitespace-nowrap border-b ${c.align === 'r' ? 'text-right' : c.align === 'c' ? 'text-center' : 'text-left'}`} style={{ color: C.amber, borderColor: C.line, width: c.w, ['--rb' as any]: C.panel2 }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r: any, i) => (
            <tr key={i} onClick={() => onRow && onRow(r)} className={onRow ? 'cursor-pointer hover:bg-[#1d1d1d]' : ''} style={{ background: i % 2 ? '#0a0a0a' : 'transparent', ...(rowStyle ? rowStyle(r, i) : {}) }}>
              {cols.map(c => (
                <td key={c.k} className={`${dense ? 'px-2 py-[2px]' : 'px-3 py-1'} whitespace-nowrap border-b ${c.align === 'r' ? 'text-right' : c.align === 'c' ? 'text-center' : 'text-left'}`}
                  style={{ borderColor: '#1a1a1a', color: c.color ? c.color(r[c.k], r) : C.text, ['--rb' as any]: (rowStyle && (rowStyle(r, i)?.background as string)) || (i % 2 ? '#0a0a0a' : C.panel) }}>
                  {c.w && c.align !== 'r' ? <div style={{ maxWidth: c.w, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.fmt ? tx(c.fmt(r[c.k], r)) : tx(r[c.k]) ?? '—'}</div> : c.fmt ? tx(c.fmt(r[c.k], r)) : tx(r[c.k]) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
  if (desk) return body
  // mobile: sombra na borda direita indica colunas escondidas (some ao chegar no fim da rolagem)
  return <div className="relative">{body}{more && <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-8" style={{ zIndex: 5, background: 'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.9))' }} />}</div>
}

/** rótulo de período: códigos internos em PT (1S, 1A, 5A) exibidos como 1W, 1Y, 5Y */
export const perLabel = (x: any) => String(x).replace(/^(\d+)A$/, '$1Y').replace(/^(\d+)S$/, '$1W')
export function Btns({ opts, value, onChange }: { opts: { v: any; l: string }[] | (string | number)[]; value: any; onChange: (v: any) => void }) {
  const list = (opts as any[]).map(o => typeof o === 'object' ? o : { v: o, l: perLabel(o) })
  return (
    <div className="flex gap-0 border" style={{ borderColor: C.line }}>
      {list.map(o => (
        <button key={String(o.v)} onClick={() => { if (value !== o.v) trackPeriod(o.v); onChange(o.v) }} className="px-2 py-[1px] text-[12px] border-r last:border-r-0"
          style={{ borderColor: C.line, background: value === o.v ? C.amber : 'transparent', color: value === o.v ? '#000' : C.amber }}>{perLabel(o.l)}</button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center gap-1 text-[12px]"><span style={{ color: C.muted }}>{label}</span>{children}</label>
}
export const inputCls = 'bg-black border px-1 py-[1px] text-[12px] outline-none focus:border-[#FFA028]'
export const inputStyle: React.CSSProperties = { borderColor: C.line, color: C.amber, fontFamily: MONO }

export function KV({ rows, cols = 1 }: { rows: [string, React.ReactNode, string?][]; cols?: number }) {
  return (
    <div className="grid text-[12px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {rows.map(([k, v, c], i) => (
        <div key={i} className="flex justify-between gap-2 px-2 py-[2px] border-b" style={{ borderColor: '#1a1a1a' }}>
          <span style={{ color: C.muted }}>{k}</span><span className="text-right" style={{ color: c || C.text }}>{tx(v)}</span>
        </div>
      ))}
    </div>
  )
}

export function Loading({ err }: { err?: string | null }) {
  return <div className="p-4 text-[12px]" style={{ fontFamily: MONO, color: err ? C.down : C.muted }}>{err ? `${t('fn.error')}: ${err}` : t('fn.loading')}</div>
}
export function NA({ ticker, what, code }: { ticker: string; what: string; code: string }) {
  return (
    <div className="p-6 text-[13px]" style={{ fontFamily: MONO, color: C.muted }}>
      N/A — {what} not available for <span style={{ color: C.amber }}>{short(ticker)}</span>.
      <div className="mt-2">Stocks with corporate data: {EQUITIES.map(t => <a key={t} className="mr-2 underline" style={{ color: C.amber }} href={href(`/${code.toLowerCase()}/${t}/`)}>{short(t)}</a>)}</div>
    </div>
  )
}

/** Sparkline SVG simples */
export function Spark({ data, w = 90, h = 18, color }: { data: (number | null)[]; w?: number; h?: number; color?: string }) {
  const v = data.filter((x): x is number => x != null && isFinite(x))
  if (v.length < 2) return <span style={{ color: C.muted }}>—</span>
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - ((y - mn) / r) * (h - 2) - 1}`).join(' ')
  const c = color || (v[v.length - 1] >= v[0] ? C.up : C.down)
  return <svg width={w} height={h} className="inline-block align-middle"><polyline points={pts} fill="none" stroke={c} strokeWidth={1} /></svg>
}

/** retorno % entre último valor e o valor na data alvo (ou anterior) */
export function retSince(dates: string[], vals: (number | null)[], target: string) {
  let last = vals.length - 1
  while (last >= 0 && vals[last] == null) last--
  if (last < 0) return null
  let i = dates.length - 1
  while (i >= 0 && (dates[i] > target || vals[i] == null)) i--
  if (i < 0) return null
  return ((vals[last] as number) / (vals[i] as number) - 1) * 100
}
export const isoMinus = (iso: string, days = 0, months = 0, years = 0) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() - years); d.setUTCMonth(d.getUTCMonth() - months); d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
