'use client'
import { tc } from '../../lib/themeRuntime'
/** Utilidades compartilhadas pelas funções da v4 (CSV, datas numéricas, mapa de calor, barras). */
import React from 'react'
import { C, nf } from '@/components/fn/kit'
import { getSettings } from '@/lib/settings'
import { en } from '@/lib/enText'

export function downloadCSV(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  // Number format 1.234,56 → CSV com ';' e vírgula decimal (Excel pt-BR); 1,234.56 → ',' e ponto decimal
  const pt = getSettings().num === 'pt', sep = pt ? ';' : ','
  const esc = (v: any) => v == null ? '' : typeof v === 'number' ? (pt ? String(v).replace('.', ',') : String(v)) : new RegExp(`[${sep}"\\n]`).test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)
  const txt = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(sep)).join('\n')
  const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function CsvBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.amber, color: C.amber }}>Export CSV</button>
}
/** dias desde 1970 (para eixos X numéricos) */
export const dayNum = (iso: string) => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5)
export const fromDay = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10)
/** cor de fundo para mapa de calor (verde/vermelho), escala em |v|/max */
export const heat = (v: number | null | undefined, max = 5) => v == null || !isFinite(v) ? 'transparent' : `rgba(${v >= 0 ? '61,220,132' : '255,77,77'},${Math.min(0.85, Math.abs(v) / max * 0.85 + 0.05)})`
/** barras horizontais simples */
export function HBars({ rows, fmt = v => nf(v, 2), hi, height = 18 }: { rows: { label: string; v: number | null; color?: string }[]; fmt?: (v: number) => string; hi?: string; height?: number }) {
  const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.v ?? 0)))
  const neg = rows.some(r => (r.v ?? 0) < 0)
  return (
    <div className="text-[12px]">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2" style={{ height }}>
          <div className="w-28 max-lg:w-20 shrink-0 truncate text-right" style={{ color: r.label === hi ? C.amber : C.text }}>{en(r.label)}</div>
          <div className="relative flex-1 h-[70%]">
            {neg && <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: tc('#444') }} />}
            {r.v != null && <div className="absolute top-0 bottom-0" style={{
              background: r.color || (r.label === hi ? C.amber : r.v >= 0 ? C.up : C.down),
              left: neg ? (r.v >= 0 ? '50%' : `${50 - Math.abs(r.v) / max * 50}%`) : 0,
              width: `${Math.abs(r.v) / max * (neg ? 50 : 100)}%`,
            }} />}
          </div>
          <div className="w-20 max-lg:w-16 shrink-0 text-right" style={{ color: r.v == null ? C.muted : (r.color || (r.v >= 0 ? C.up : C.down)) }}>{r.v == null ? '—' : fmt(r.v)}</div>
        </div>
      ))}
    </div>
  )
}
export const PERIODS: { v: string; l: string }[] = [{ v: '1M', l: '1M' }, { v: '3M', l: '3M' }, { v: '6M', l: '6M' }, { v: 'YTD', l: 'YTD' }, { v: '1A', l: '1Y' }, { v: '3A', l: '3Y' }, { v: '5A', l: '5Y' }, { v: '10A', l: '10Y' }]
export function periodStart(last: string, p: string) {
  const d = new Date(last + 'T12:00:00Z')
  if (p === 'YTD') return `${last.slice(0, 4)}-01-01`
  const n = parseInt(p), u = p.replace(/\d+/g, '')
  if (u === 'D') d.setUTCDate(d.getUTCDate() - n)
  else if (u === 'S') d.setUTCDate(d.getUTCDate() - 7 * n)
  else if (u === 'M') d.setUTCMonth(d.getUTCMonth() - n)
  else d.setUTCFullYear(d.getUTCFullYear() - n)
  return d.toISOString().slice(0, 10)
}

/** Barras verticais de Δ (bp) por vértice; verde = positivo, vermelho = negativo. Uma barra por comparação (opacidade decrescente). */
export function VertexBars({ labels, groups, height = 150, fmt = v => nf(v, 0) }: {
  labels: string[]; groups: { name: string; values: (number | null)[] }[]; height?: number; fmt?: (v: number) => string
}) {
  const all = groups.flatMap(g => g.values).filter((v): v is number => v != null && isFinite(v))
  const pos = Math.max(0, ...all), neg = Math.max(0, ...all.map(v => -v))
  const span = Math.max(1e-9, pos + neg), zero = pos / span // fração da altura acima do zero
  const op = [1, 0.62, 0.42, 0.28]
  const plotH = height - 34
  return (
    <div className="text-[11px] select-none" style={{ height }} data-vertex-bars>
      <div className="flex items-center gap-3 pb-1" style={{ color: C.muted }}>
        <span style={{ color: C.amber }}>Δ (bp) by vertex</span>
        {groups.map((g, i) => <span key={g.name} className="flex items-center gap-1"><i className="inline-block w-3 h-2" style={{ background: C.up, opacity: op[i] ?? 0.3 }} />{g.name}</span>)}
      </div>
      <div className="relative flex items-stretch gap-[2px] border-b border-t" style={{ height: plotH, borderColor: tc('#1f1f1f') }}>
        <div className="absolute left-0 right-0" style={{ top: `${zero * 100}%`, height: 1, background: tc('#555') }} />
        {labels.map((l, j) => (
          <div key={l + j} className="relative flex-1 flex items-stretch justify-center gap-[1px] min-w-0">
            {groups.map((g, i) => {
              const v = g.values[j]
              if (v == null || !isFinite(v)) return <div key={i} className="flex-1 max-w-[18px]" />
              const h = Math.abs(v) / span * 100
              return <div key={i} className="relative flex-1 max-w-[18px]" title={`${l} · ${g.name}: ${fmt(v)} bp`}>
                <div className="absolute left-0 right-0" style={{ background: v >= 0 ? C.up : C.down, opacity: op[i] ?? 0.3, top: v >= 0 ? `${(zero * 100) - h}%` : `${zero * 100}%`, height: `${Math.max(h, 0.6)}%` }} />
              </div>
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] pt-[2px]" style={{ color: C.muted }}>
        {labels.map((l, j) => <div key={l + j} className="relative flex-1 min-w-0 h-[14px]">{j % Math.max(1, Math.ceil(labels.length / 12)) === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{l}</span>}</div>)}
      </div>
    </div>
  )
}
