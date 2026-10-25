'use client'
/** Gráfico genérico multi-painel (lightweight-charts v5) no estilo do terminal. */
import { useEffect, useRef } from 'react'
import { createChart, LineSeries, HistogramSeries, AreaSeries, CandlestickSeries, BaselineSeries, LineStyle, CrosshairMode, createSeriesMarkers } from 'lightweight-charts'
import { C, MONO, useFitH } from './kit'

export type Pt = { time: string; value: number; color?: string }
export type SeriesDef = {
  kind: 'line' | 'hist' | 'area' | 'candle' | 'baseline'
  data: any[]; color?: string; width?: number; title?: string; dashed?: boolean; base?: number
  lines?: { price: number; color?: string; title?: string }[]
  markers?: { time: string; text: string; color?: string; position?: 'aboveBar' | 'belowBar'; shape?: 'arrowDown' | 'arrowUp' | 'circle' | 'square' }[]
  decimals?: number; pct?: boolean; lastValue?: boolean
}
export type PaneDef = { stretch?: number; series: SeriesDef[] }

const fmt = (d = 2, pct = false) => ({ type: 'custom', minMove: 1 / 10 ** d, formatter: (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + (pct ? '%' : '') }) as any

export default function FnChartImpl({ panes, height = 420, log = false, intraday = false }: { panes: PaneDef[]; height?: number; log?: boolean; intraday?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const h = useFitH(height, 120)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: '#101010' }, textColor: '#8a8a8a', fontFamily: MONO, fontSize: 11, attributionLogo: false,
        panes: { separatorColor: '#3a3a3a', separatorHoverColor: '#555', enableResize: true } },
      grid: { vertLines: { color: '#262626', style: LineStyle.Dotted }, horzLines: { color: '#262626', style: LineStyle.Dotted } },
      rightPriceScale: { borderColor: '#3a3a3a', mode: log ? 1 : 0 },
      timeScale: { borderColor: '#3a3a3a', rightOffset: 3, fixLeftEdge: true, timeVisible: intraday, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#777', style: LineStyle.Dashed, labelBackgroundColor: C.amber }, horzLine: { color: '#777', style: LineStyle.Dashed, labelBackgroundColor: C.amber } },
      localization: { locale: 'pt-BR' },
    })
    panes.forEach((p, pi) => {
      p.series.forEach(s => {
        const priceFormat = fmt(s.decimals ?? 2, s.pct)
        const common = { priceFormat, priceLineVisible: false, lastValueVisible: s.lastValue ?? true, title: s.title || '' }
        let ser: any
        if (s.kind === 'line') ser = chart.addSeries(LineSeries, { ...common, color: s.color || C.white, lineWidth: (s.width || 1) as any, lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid, crosshairMarkerVisible: true }, pi)
        else if (s.kind === 'hist') ser = chart.addSeries(HistogramSeries, { ...common, color: s.color || C.blue }, pi)
        else if (s.kind === 'area') ser = chart.addSeries(AreaSeries, { ...common, lineColor: s.color || C.white, lineWidth: 2, topColor: 'rgba(47,123,255,0.28)', bottomColor: 'rgba(47,123,255,0.02)' }, pi)
        else if (s.kind === 'baseline') ser = chart.addSeries(BaselineSeries, { ...common, baseValue: { type: 'price', price: s.base ?? 0 }, topLineColor: C.up, bottomLineColor: C.down, topFillColor1: 'rgba(61,220,132,0.25)', topFillColor2: 'rgba(61,220,132,0.02)', bottomFillColor1: 'rgba(255,77,77,0.02)', bottomFillColor2: 'rgba(255,77,77,0.25)' }, pi)
        else ser = chart.addSeries(CandlestickSeries, { ...common, upColor: 'rgba(0,0,0,0)', borderUpColor: C.white, wickUpColor: C.white, downColor: C.blue, borderDownColor: C.blue, wickDownColor: C.blue }, pi)
        {
          // dados reais podem vir fora de ordem/duplicados (ex.: SGS mensal+diário) → ordena, remove duplicatas e nulos
          const m = new Map<any, any>()
          for (const d of s.data as any[]) { if (d && d.time != null && (d.value === undefined ? d.close != null : d.value != null && Number.isFinite(d.value))) m.set(d.time, d) }
          const arr = Array.from(m.values()).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
          ser.setData(arr as any)
        }
        s.lines?.forEach(l => ser.createPriceLine({ price: l.price, color: l.color || '#777', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title || '' }))
        if (s.markers?.length) createSeriesMarkers(ser, s.markers.map(m => ({ time: m.time, position: m.position || 'aboveBar', color: m.color || C.amber, shape: m.shape || 'arrowDown', text: m.text })) as any)
      })
    })
    const ps = chart.panes()
    panes.forEach((p, i) => ps[i] && p.stretch && ps[i].setStretchFactor(p.stretch))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [panes, log])
  return <div ref={ref} style={{ height: h, position: 'relative' }} />
}
