'use client'
/** Gráfico XY numérico em SVG (sazonalidade, cone de vol, curvas de juros, dispersão). */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { C, MONO, useFitH } from './kit'

export type XYSeries = { name: string; points: [number, number | null][]; color: string; width?: number; dash?: string; scatter?: boolean; band?: [number, number, number][]; opacity?: number }

export default function XYChart({ series, height = 360, xTicks, xFmt = v => String(v), yFmt = v => v.toFixed(1), zeroLine = false, xLabel, yLabel, legend = true }: {
  series: XYSeries[]; height?: number; xTicks?: { v: number; l: string }[]; xFmt?: (v: number) => string; yFmt?: (v: number) => string; zeroLine?: boolean; xLabel?: string; yLabel?: string; legend?: boolean
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const [W, setW] = useState(1000)
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)))
    ro.observe(el); setW(Math.max(300, el.clientWidth))
    return () => ro.disconnect()
  }, [])
  const H = useFitH(height, 120), m = { l: 10, r: 64, t: 10, b: 26 }
  const [hx, setHx] = useState<number | null>(null)
  const { x0, x1, y0, y1 } = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    series.forEach(s => {
      s.points.forEach(([x, y]) => { if (y == null || !isFinite(y)) return; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) })
      s.band?.forEach(([x, lo, hi]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, lo); y1 = Math.max(y1, hi) })
    })
    if (zeroLine) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0) }
    const pad = (y1 - y0) * 0.06 || 1
    return { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: y0 - pad, y1: y1 + pad }
  }, [series, zeroLine])
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r)
  const sy = (y: number) => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b)
  const yt = Array.from({ length: 6 }, (_, i) => y0 + ((y1 - y0) * i) / 5)
  const xt = xTicks || Array.from({ length: 7 }, (_, i) => ({ v: x0 + ((x1 - x0) * i) / 6, l: xFmt(x0 + ((x1 - x0) * i) / 6) }))
  const path = (pts: [number, number | null][]) => {
    let d = '', pen = false
    pts.forEach(([x, y]) => { if (y == null || !isFinite(y)) { pen = false; return } d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`; pen = true })
    return d
  }
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHx(x0 + ((px - m.l) / (W - m.l - m.r)) * (x1 - x0))
  }
  const hv = hx == null ? null : series.filter(s => !s.scatter).map(s => {
    let best: [number, number | null] | null = null
    s.points.forEach(p => { if (p[1] != null && (!best || Math.abs(p[0] - hx) < Math.abs(best[0] - hx))) best = p })
    return { s, p: best as [number, number | null] | null }
  })
  return (
    <div ref={box} style={{ fontFamily: MONO, background: '#101010', position: 'relative' }}>
      {legend && <div className="flex flex-wrap gap-3 px-2 pt-1 text-[11px]">{series.filter(s => s.name).map(s => <span key={s.name} style={{ color: s.color }}>■ <span style={{ color: C.text }}>{s.name}</span>{hv && (() => { const h = hv.find(x => x.s === s); return h?.p && h.p[1] != null ? <span style={{ color: s.color }}> {yFmt(h.p[1])}</span> : null })()}</span>)}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHx(null)}>
        {yt.map((y, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={sy(y)} y2={sy(y)} stroke="#262626" strokeDasharray="2,3" /><text x={W - m.r + 4} y={sy(y) + 4} fill="#8a8a8a" fontSize={11}>{yFmt(y)}</text></g>)}
        {xt.map((t, i) => <g key={i}><line x1={sx(t.v)} x2={sx(t.v)} y1={m.t} y2={H - m.b} stroke="#262626" strokeDasharray="2,3" /><text x={sx(t.v)} y={H - 8} fill="#8a8a8a" fontSize={11} textAnchor="middle">{t.l}</text></g>)}
        {zeroLine && <line x1={m.l} x2={W - m.r} y1={sy(0)} y2={sy(0)} stroke="#666" />}
        {series.map(s => s.band && <path key={s.name + 'b'} d={s.band.map(([x, , hi], i) => `${i ? 'L' : 'M'}${sx(x)},${sy(hi)}`).join('') + s.band.slice().reverse().map(([x, lo]) => `L${sx(x)},${sy(lo)}`).join('') + 'Z'} fill={s.color} opacity={0.15} />)}
        {series.map(s => s.scatter
          ? <g key={s.name}>{s.points.map(([x, y], i) => y == null ? null : <circle key={i} cx={sx(x)} cy={sy(y)} r={2.2} fill={s.color} opacity={s.opacity ?? 0.7} />)}</g>
          : <path key={s.name} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={s.width || 1.4} strokeDasharray={s.dash} opacity={s.opacity ?? 1} vectorEffect="non-scaling-stroke" />)}
        {hx != null && hx >= x0 && hx <= x1 && <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={H - m.b} stroke="#777" strokeDasharray="4,3" />}
        {hx != null && hx >= x0 && hx <= x1 && <g><rect x={sx(hx) - 34} y={H - m.b + 2} width={68} height={16} fill={C.amber} /><text x={sx(hx)} y={H - m.b + 14} fontSize={11} textAnchor="middle" fill="#000">{xFmt(hx)}</text></g>}
        {xLabel && <text x={(W - m.r) / 2} y={H - 1} fill="#666" fontSize={10} textAnchor="middle">{xLabel}</text>}
        {yLabel && <text x={W - 4} y={m.t + 8} fill="#666" fontSize={10} textAnchor="end">{yLabel}</text>}
      </svg>
    </div>
  )
}
