'use client'
/** GIP: gráfico intradiário (lightweight-charts v5) — preço (linha/candle), VWAP com bandas, linhas de abertura e
 *  fechamento anterior (dentro da autoescala), separadores de pregão e volume. Cores dos candles = GP/GPC (chartTheme). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { TrackingModeExitMode, createChart, LineSeries, HistogramSeries, AreaSeries, CandlestickSeries, LineStyle, CrosshairMode, type IChartApi, type UTCTimestamp } from 'lightweight-charts'
import { numLocale, lang } from '../../lib/settings'
import { tc } from '../../lib/themeRuntime'
import { T } from '../terminal/chartTheme'
import { C, MONO, useFit, useFitH, big } from './kit'
import { BRT_OFF, vwapBands, type IBar } from '../../lib/intraday.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
export const GIP_COLORS = { vwap: tc('#FFA028'), band1: tc('#C77DFF'), band2: tc('#8e5cc0'), prev: tc('#9a9a9a'), open: tc('#4FC3F7'), vol: tc('#7189aa'), sep: tc('rgba(255,255,255,0.16)') }

export type IntradayProps = {
  bars: IBar[]; kind: 'line' | 'candle'; showVwap: boolean; prevClose: number | null; open: number | null
  separators: boolean; showVolume: boolean; decimals?: number; height?: number; label: string
}

export default function IntradayChartImpl({ bars, kind, showVwap, prevClose, open, separators, showVolume, decimals = 2, height = 520, label }: IntradayProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const fitH = useFitH(height, 160)
  const { active } = useFit()
  const h = active ? fitH : Math.min(height, showVolume ? 410 : 320)
  const vw = useMemo(() => (showVwap ? vwapBands(bars) : []), [bars, showVwap])
  const [hov, setHov] = useState<{ t: number; o: number; h: number; l: number; c: number; v: number; vw: number | null } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !bars.length) return
    const fmt = { type: 'custom', minMove: 1 / 10 ** decimals, formatter: (v: number) => v.toLocaleString(numLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) } as any
    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: { background: { color: T.bg }, textColor: T.axis, fontFamily: MONO, fontSize: 11, attributionLogo: false,
        panes: { separatorColor: tc('#3a3a3a'), separatorHoverColor: tc('#555'), enableResize: true } },
      grid: { vertLines: { color: T.grid, style: LineStyle.Dotted }, horzLines: { color: T.grid, style: LineStyle.Dotted } },
      rightPriceScale: { borderColor: tc('#3a3a3a') },
      timeScale: { borderColor: tc('#3a3a3a'), rightOffset: 3, fixLeftEdge: true, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: tc('#777'), style: LineStyle.Dashed, labelBackgroundColor: C.amber }, horzLine: { color: tc('#777'), style: LineStyle.Dashed, labelBackgroundColor: C.amber } },
      localization: { locale: numLocale() },
      handleScroll: { vertTouchDrag: false },
      trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
    })
    const tt = (u: number) => (u - BRT_OFF) as UTCTimestamp
    const levels = [prevClose, open].filter((x): x is number => x != null && Number.isFinite(x))
    // linhas de referência entram na autoescala: o eixo sempre mostra abertura e fechamento anterior
    const autoscaleInfoProvider = (orig: () => any) => {
      const r = orig()
      if (!r || !levels.length) return r
      return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...levels), maxValue: Math.max(r.priceRange.maxValue, ...levels) } }
    }
    const common = { priceFormat: fmt, priceLineVisible: false, lastValueVisible: true, autoscaleInfoProvider }
    if (separators) {
      const days = new Set<string>(), sep: { time: UTCTimestamp; value: number }[] = []
      for (const b of bars) { const d = new Date((b[0] - BRT_OFF) * 1000).toISOString().slice(0, 10); if (!days.has(d)) { days.add(d); if (days.size > 1) sep.push({ time: tt(b[0]), value: 1 }) } }
      const s = chart.addSeries(HistogramSeries, { color: GIP_COLORS.sep, priceScaleId: 'sep', priceLineVisible: false, lastValueVisible: false, base: 0, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }) }, 0)
      s.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false })
      s.setData(sep)
    }
    const main = kind === 'candle'
      ? chart.addSeries(CandlestickSeries, { ...common, upColor: T.up, borderUpColor: T.up, wickUpColor: T.up, downColor: T.down, borderDownColor: T.down, wickDownColor: T.down }, 0)
      : chart.addSeries(AreaSeries, { ...common, lineColor: T.line, lineWidth: 2, topColor: T.mountain, bottomColor: tc('rgba(47,123,255,0.02)') }, 0)
    main.setData(kind === 'candle' ? bars.map(b => ({ time: tt(b[0]), open: b[1], high: b[2], low: b[3], close: b[4] })) : bars.map(b => ({ time: tt(b[0]), value: b[4] })) as any)
    const tl = (en: string, pt: string) => (active ? L(en, pt) : '')
    if (prevClose != null) main.createPriceLine({ price: prevClose, color: GIP_COLORS.prev, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: tl('Prev close', 'Fech. ant.') })
    if (open != null) main.createPriceLine({ price: open, color: GIP_COLORS.open, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: tl('Open', 'Abertura') })
    if (vw.length) {
      const line = (color: string, k: number, style: LineStyle, w: number) => {
        const s = chart.addSeries(LineSeries, { priceFormat: fmt, color, lineWidth: w as any, lineStyle: style, priceLineVisible: false, lastValueVisible: k === 0, crosshairMarkerVisible: false }, 0)
        // pregões distintos não se ligam: whitespace na virada do dia
        const pts: any[] = []
        let prevDay = ''
        for (const p of vw) { const d = new Date((p.t - BRT_OFF) * 1000).toISOString().slice(0, 10); if (prevDay && d !== prevDay) pts.push({ time: (tt(p.t) - 1) as UTCTimestamp }); prevDay = d; pts.push({ time: tt(p.t), value: p.vwap + k * p.sd }) }
        s.setData(pts)
      }
      line(GIP_COLORS.band2, 2, LineStyle.Dotted, 1); line(GIP_COLORS.band2, -2, LineStyle.Dotted, 1)
      line(GIP_COLORS.band1, 1, LineStyle.Dashed, 1); line(GIP_COLORS.band1, -1, LineStyle.Dashed, 1)
      line(GIP_COLORS.vwap, 0, LineStyle.Solid, 2)
    }
    if (showVolume) {
      const v = chart.addSeries(HistogramSeries, { color: GIP_COLORS.vol, priceFormat: { type: 'custom', minMove: 1, formatter: (x: number) => big(x, 1) } as any, priceLineVisible: false, lastValueVisible: true }, 1)
      v.setData(bars.map(b => ({ time: tt(b[0]), value: b[5] > 0 ? b[5] : 0 })))
      const ps = chart.panes(); ps[0]?.setStretchFactor(0.76); ps[1]?.setStretchFactor(0.24)
    }
    const byT = new Map(bars.map(b => [b[0] - BRT_OFF, b]))
    const vwT = new Map(vw.map(p => [p.t - BRT_OFF, p.vwap]))
    chart.subscribeCrosshairMove(p => {
      const b = p.time != null ? byT.get(p.time as number) : undefined
      setHov(b ? { t: b[0], o: b[1], h: b[2], l: b[3], c: b[4], v: b[5], vw: vwT.get(p.time as number) ?? null } : null)
    })
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [bars, kind, vw, prevClose, open, separators, showVolume, decimals, active])
  const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString(numLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  const leg = [
    { c: T.line, t: label, k: 'p' },
    ...(vw.length ? [{ c: GIP_COLORS.vwap, t: 'VWAP', k: 'v' }, { c: GIP_COLORS.band1, t: '±1σ', k: 'b1', dash: true }, { c: GIP_COLORS.band2, t: '±2σ', k: 'b2', dash: true }] : []),
    ...(open != null ? [{ c: GIP_COLORS.open, t: L('Open', 'Abertura'), k: 'o', dash: true }] : []),
    ...(prevClose != null ? [{ c: GIP_COLORS.prev, t: L('Prev close', 'Fech. anterior'), k: 'pc', dash: true }] : []),
    ...(showVolume ? [{ c: GIP_COLORS.vol, t: 'Volume', k: 'vol' }] : []),
  ]
  const hh = (u: number) => new Date((u - BRT_OFF) * 1000).toISOString().slice(11, 16)
  return (
    <div data-gip-chart>
      <div className="flex flex-wrap gap-x-3 gap-y-[2px] px-1 pb-[2px] text-[11px]" data-gip-legend>
        {leg.map(l => <span key={l.k} className="whitespace-nowrap"><span style={{ color: l.c }}>{(l as any).dash ? '┄' : '■'}</span> <span style={{ color: C.text }}>{l.t}</span></span>)}
      </div>
      <div className="px-1 pb-[2px] text-[11px] min-h-[16px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: C.muted }} data-gip-hover>
        {hov ? <>
          <span style={{ color: C.white }}>{hh(hov.t)}</span>{' '}
          {kind === 'candle' ? <>{L('O', 'A')} {n(hov.o)} {L('H', 'M')} {n(hov.h)} {L('L', 'm')} {n(hov.l)} {L('C', 'F')} {n(hov.c)}</> : <>{n(hov.c)}</>}
          {hov.vw != null && <> · <span style={{ color: GIP_COLORS.vwap }}>VWAP</span> {n(hov.vw)}</>}
          {showVolume && <> · Vol {big(hov.v || 0, 1)}</>}
        </> : <span>{L('Hover or long-press for bar details', 'Passe o mouse ou toque longo: detalhes da barra')}</span>}
      </div>
      <div ref={ref} style={{ height: h, position: 'relative' }} />
    </div>
  )
}
