'use client'
import { tc } from '../../lib/themeRuntime'
/** Utilidades das 11 funções novas (WIRP, ECO, GMM, TAYL, WB, FOMC, DRSK, ECTR, FXC, FXFC, YAS): formatação en-US e peças de UI. */
import React, { useEffect, useRef, useState } from 'react'
import { C, MONO, useFitH, useFit } from '@/components/fn/kit'
import { numLocale } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { fmtDate, fmtDateFull, fmtDayMonth, fmtMonth } from '@/lib/dates'

const ok = (v: any) => v != null && v !== '' && isFinite(+v)
/** número no formato escolhido em Settings (padrão en-US) */
export const n = (v: any, d = 2) => !ok(v) ? '—' : (+v).toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d })
/** com sinal */
export const sn = (v: any, d = 2) => !ok(v) ? '—' : `${+v > 0 ? '+' : ''}${n(v, d)}`
export const pc = (v: any, d = 2, sign = true) => !ok(v) ? '—' : `${sign ? sn(v, d) : n(v, d)}%`
export const bps = (v: any, d = 1) => !ok(v) ? '—' : sn(v, d)
/** decimais automáticos pelo tamanho (câmbio) */
export const auto = (v: any) => { if (!ok(v)) return '—'; const a = Math.abs(+v); return n(v, a >= 1000 ? 1 : a >= 100 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : a >= 0.01 ? 5 : 7) }
export const bigE = (v: any, d = 1) => {
  if (!ok(v)) return '—'
  const a = Math.abs(+v), s = +v < 0 ? '-' : ''
  if (a >= 1e12) return `${s}${n(a / 1e12, d)}T`
  if (a >= 1e9) return `${s}${n(a / 1e9, d)}B`
  if (a >= 1e6) return `${s}${n(a / 1e6, d)}M`
  if (a >= 1e3) return `${s}${n(a / 1e3, d)}K`
  return `${s}${n(a, d)}`
}
/** ISO → MM/DD/YY */
export const dUS = fmtDate          // antes MM/DD/AA; agora segue o idioma (lib/dates)
export const dUSfull = fmtDateFull
/** ISO → 'Oct 23' */
export const dShort = fmtDayMonth
export const mLab = (iso: string) => fmtMonth(iso)
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const weekday = (iso: string) => WD[new Date(iso.slice(0, 10) + 'T12:00:00Z').getUTCDay()]
export const cl = (v: any) => !ok(v) || +v === 0 ? C.text : +v > 0 ? C.up : C.down
export const dayN = (iso: string) => Math.round(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / 864e5)
export const fromN = (x: number) => new Date(x * 864e5).toISOString().slice(0, 10)
export const addDays = (iso: string, k: number) => fromN(dayN(iso) + k)
/** data de hoje em São Paulo (YYYY-MM-DD) */
export const todaySP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

export function Loading2({ err }: { err?: string | null }) {
  return <div className="p-4 text-[12px]" style={{ fontFamily: MONO, color: err ? C.down : C.muted }}>{err ? `${t('fn.dataNA')}: ${err}` : t('fn.loading')}</div>
}
/** estado honesto de indisponibilidade */
export function Unavailable({ what, note }: { what: string; note?: string }) {
  return <div className="p-6 text-[13px]" style={{ fontFamily: MONO, color: C.muted }}><span style={{ color: C.down }}>N/A</span> — {what} {t('fn.na')}{note && <div className="mt-2 text-[12px]">{note}</div>}</div>
}

/** faixa de KPIs */
export function Kpis({ items, cols }: { items: [string, React.ReactNode, string?][]; cols?: number }) {
  return (
    <div className="mb-2 grid gap-2 text-[12px] fn-kpi" style={{ gridTemplateColumns: `repeat(${cols || items.length},minmax(0,1fr))` }}>
      {items.map(([k, v, c], i) => <div key={i} className="border px-2 py-1 min-w-0" style={{ borderColor: C.line, background: C.panel }}><div className="truncate" style={{ color: C.muted }}>{k}</div><div className="text-[16px] truncate" style={{ color: c || C.text }}>{v}</div></div>)}
    </div>
  )
}

/** input numérico âmbar (parâmetros editáveis) */
export function NumIn({ value, onChange, step = 0.25, w = 64 }: { value: number | null; onChange: (v: number | null) => void; step?: number; w?: number }) {
  const [t, setT] = useState(value == null ? '' : String(value))
  useEffect(() => { setT(value == null ? '' : String(value)) }, [value])
  return <input value={t} inputMode="decimal" step={step} onChange={e => { setT(e.target.value); const x = parseFloat(e.target.value.replace(',', '.')); onChange(e.target.value.trim() === '' ? null : isFinite(x) ? x : value) }}
    className="bg-black border px-1 py-[1px] text-[12px] outline-none text-right" style={{ borderColor: C.amberDim, color: tc('#000'), background: C.amber, width: w, fontFamily: MONO }} />
}

/** barras + linha (estilo WIRP): barras no eixo direito, linha no esquerdo; SVG responsivo */
export function BarLine({ labels, bars, line, height = 240, barName, lineName, barFmt = (v: number) => n(v, 2), lineFmt = (v: number) => n(v, 2) }: {
  labels: string[]; bars: (number | null)[]; line: (number | null)[]; height?: number; barName: string; lineName: string; barFmt?: (v: number) => string; lineFmt?: (v: number) => string
}) {
  const box = useRef<HTMLDivElement | null>(null), [W, setW] = useState(600)
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth))); ro.observe(el); setW(Math.max(260, el.clientWidth)); return () => ro.disconnect() }, [])
  const fitH = useFitH(height, 110), { active } = useFit(), H = active ? fitH : Math.min(height, 240)
  const m = { l: 52, r: 52, t: 10, b: 22 }, N = labels.length
  const bv = bars.filter((x): x is number => x != null), lv = line.filter((x): x is number => x != null)
  const b0 = Math.min(0, ...bv), b1 = Math.max(0, ...bv), bpad = (b1 - b0) * 0.08 || 1
  const l0 = Math.min(...lv), l1 = Math.max(...lv), lpad = (l1 - l0) * 0.1 || 0.1
  const cw = (W - m.l - m.r) / Math.max(1, N)
  const x = (i: number) => m.l + cw * (i + 0.5)
  const yb = (v: number) => m.t + (1 - (v - (b0 - bpad)) / (b1 + bpad - (b0 - bpad))) * (H - m.t - m.b)
  const yl = (v: number) => m.t + (1 - (v - (l0 - lpad)) / (l1 + lpad - (l0 - lpad))) * (H - m.t - m.b)
  const ticks = (a: number, b: number) => Array.from({ length: 5 }, (_, i) => a + (b - a) * i / 4)
  const pts = line.map((v, i) => v == null ? null : `${x(i)},${yl(v)}`).filter(Boolean).join(' ')
  const step = Math.ceil(N / Math.max(1, Math.floor((W - m.l - m.r) / 64)))
  return (
    <div ref={box} className="w-full" style={{ fontFamily: MONO }}>
      <svg width={W} height={H} className="block">
        {ticks(b0 - bpad, b1 + bpad).map((t, i) => <g key={'b' + i}><line x1={m.l} x2={W - m.r} y1={yb(t)} y2={yb(t)} stroke={tc(tc('#1c1c1c'))} /><text x={W - m.r + 4} y={yb(t) + 4} fontSize={10} fill={C.amber}>{barFmt(t)}</text></g>)}
        {ticks(l0 - lpad, l1 + lpad).map((t, i) => <text key={'l' + i} x={m.l - 4} y={yl(t) + 4} fontSize={10} fill={C.blue} textAnchor="end">{lineFmt(t)}</text>)}
        <line x1={m.l} x2={W - m.r} y1={yb(0)} y2={yb(0)} stroke={tc(tc('#555'))} />
        {bars.map((v, i) => v == null ? null : <rect key={i} x={x(i) - cw * 0.32} width={cw * 0.64} y={Math.min(yb(0), yb(v))} height={Math.max(1, Math.abs(yb(v) - yb(0)))} fill={C.amber} opacity={0.9}><title>{`${labels[i]}: ${barFmt(v)}`}</title></rect>)}
        <polyline points={pts} fill="none" stroke={C.blue} strokeWidth={2} />
        {line.map((v, i) => v == null ? null : <circle key={i} cx={x(i)} cy={yl(v)} r={2.5} fill={C.blue}><title>{`${labels[i]}: ${lineFmt(v)}`}</title></circle>)}
        {labels.map((l, i) => i % step ? null : <text key={i} x={x(i)} y={H - 6} fontSize={10} fill={C.muted} textAnchor="middle">{l}</text>)}
      </svg>
      <div className="flex gap-4 text-[11px] px-1"><span style={{ color: C.blue }}>━ {lineName}</span><span style={{ color: C.amber }}>■ {barName}</span></div>
    </div>
  )
}
