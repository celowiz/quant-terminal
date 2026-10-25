'use client'
/**
 * Gráfico de preços estilo terminal (GP = linha/montanha, GPC = candles).
 * Referências de design: ver /REFERENCIAS.md (GP, GPC).
 *  - fundo carvão, grid pontilhado discreto, eixo de preço à direita com etiqueta do último preço
 *  - GPC: candle de alta "vazio" (contorno branco), de baixa preenchido em azul
 *  - painel de volume embaixo; legenda no canto superior esquerdo (Last Price / High on / Average / Low on)
 */
import { numLocale } from '../../lib/settings'
import { useEffect, useRef } from 'react'
import {
  createChart, TrackingModeExitMode, CandlestickSeries, AreaSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode,
  type IChartApi, type MouseEventParams, type Time,
} from 'lightweight-charts'
import type { Price } from '../../lib/static'

export const T = {
  bg: '#101010',          // fundo "carvão"
  grid: '#262626',
  axis: '#8a8a8a',
  text: '#d9d9d9',
  amber: '#FFA028',
  up: '#FFFFFF',          // candle de alta: contorno/pavio branco, corpo vazio
  down: '#2F7BFF',        // candle de baixa: corpo e pavio azuis
  line: '#FFFFFF',
  mountain: 'rgba(47,123,255,0.28)',
  high: '#3DDC84',
  low: '#FF4D4D',
  sma50: '#FFA028',
  sma200: '#C77DFF',
}
export const MONO = "'IBM Plex Mono','Roboto Mono','SFMono-Regular',Menlo,Consolas,ui-monospace,monospace"

export function sma(rows: Price[], n: number) {
  const out: { time: string; value: number }[] = []
  let s = 0
  rows.forEach((r, i) => {
    s += r.close
    if (i >= n) s -= rows[i - n].close
    if (i >= n - 1) out.push({ time: r.time, value: s / n })
  })
  return out
}

type Props = {
  rows: Price[]              // série exibida (já filtrada pelo período)
  history?: Price[]          // série completa (para médias móveis desde antes do início)
  mode: 'line' | 'candle'
  showVolume: boolean
  smas: number[]
  onHover: (p: Price | null) => void
  highLow?: { high: Price; low: Price } | null
}

export default function PriceChart({ rows, history, mode, showVolume, smas, onHover, highLow }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !rows.length) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: T.bg }, textColor: T.axis, fontFamily: MONO, fontSize: 11,
        attributionLogo: false, // atribuição TradingView feita no rodapé (licença Apache-2.0)
        panes: { separatorColor: '#3a3a3a', separatorHoverColor: '#555', enableResize: true },
      },
      grid: {
        vertLines: { color: T.grid, style: LineStyle.Dotted },
        horzLines: { color: T.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: '#3a3a3a', scaleMargins: { top: 0.12, bottom: 0.06 } },
      leftPriceScale: { visible: false },
      timeScale: { borderColor: '#3a3a3a', rightOffset: 4, timeVisible: false, fixLeftEdge: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#777', style: LineStyle.Dashed, labelBackgroundColor: T.amber },
        horzLine: { color: '#777', style: LineStyle.Dashed, labelBackgroundColor: T.amber },
      },
      localization: {
        locale: numLocale(),
      },
      // toque: arrasto vertical rola a página; toque longo liga a mira (some ao soltar). Mouse/desktop inalterado.
      handleScroll: { vertTouchDrag: false },
      trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
    })
    chartRef.current = chart

    const pf = { type: 'custom', minMove: 0.0001, formatter: (v: number) => v.toLocaleString(numLocale(), { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 }) } as any
    const price = mode === 'candle'
      ? chart.addSeries(CandlestickSeries, {
          upColor: 'rgba(0,0,0,0)', borderUpColor: T.up, wickUpColor: T.up,
          downColor: T.down, borderDownColor: T.down, wickDownColor: T.down,
          borderVisible: true, wickVisible: true,
          priceLineColor: T.amber, priceLineStyle: LineStyle.Dotted,
          title: '', priceFormat: pf,
        })
      : chart.addSeries(AreaSeries, {
          lineColor: T.line, lineWidth: 2, topColor: T.mountain, bottomColor: 'rgba(47,123,255,0.02)',
          priceLineColor: T.amber, priceLineStyle: LineStyle.Dotted, priceFormat: pf,
        })
    if (mode === 'candle') {
      (price as any).setData(rows.map(r => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close })))
    } else {
      (price as any).setData(rows.map(r => ({ time: r.time, value: r.close })))
    }

    if (highLow) {
      const key = mode === 'candle' ? ['high', 'low'] as const : ['close', 'close'] as const
      price.createPriceLine({ price: highLow.high[key[0]], color: T.high, lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: 'High' })
      price.createPriceLine({ price: highLow.low[key[1]], color: T.low, lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: 'Low' })
    }

    const first = rows[0].time
    const colors: Record<number, string> = { 50: T.sma50, 200: T.sma200 }
    smas.forEach(n => {
      const src = history && history.length ? history : rows
      const data = sma(src, n).filter(p => p.time >= first)
      if (!data.length) return
      const s = chart.addSeries(LineSeries, { color: colors[n] || '#aaa', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, priceFormat: pf })
      s.setData(data)
    })

    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'custom', minMove: 1, formatter: (v: number) => v >= 1e9 ? (v/1e9).toLocaleString(numLocale(),{maximumFractionDigits:2})+'B' : v >= 1e6 ? (v/1e6).toLocaleString(numLocale(),{maximumFractionDigits:1})+'M' : v >= 1e3 ? (v/1e3).toLocaleString(numLocale(),{maximumFractionDigits:0})+'K' : String(Math.round(v)) } as any, priceLineVisible: false, lastValueVisible: true,
      }, 1)
      vol.setData(rows.map((r, i) => {
        const up = mode === 'candle' ? r.close >= r.open : i === 0 || r.close >= rows[i - 1].close
        return { time: r.time, value: r.volume, color: up ? 'rgba(220,220,220,0.55)' : 'rgba(47,123,255,0.75)' }
      }))
      const panes = chart.panes()
      panes[0].setStretchFactor(0.78)
      if (panes[1]) panes[1].setStretchFactor(0.22)
    }

    chart.timeScale().fitContent()

    const byTime = new Map(rows.map(r => [r.time, r]))
    const onMove = (p: MouseEventParams<Time>) => {
      if (!p.time) return onHover(null)
      const t = typeof p.time === 'string' ? p.time
        : typeof p.time === 'object' ? `${p.time.year}-${String(p.time.month).padStart(2, '0')}-${String(p.time.day).padStart(2, '0')}` : ''
      onHover(byTime.get(t) || null)
    }
    chart.subscribeCrosshairMove(onMove)
    return () => { chart.unsubscribeCrosshairMove(onMove); chart.remove(); chartRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, history, mode, showVolume, smas.join(','), highLow])

  return <div ref={ref} className="absolute inset-0" />
}
