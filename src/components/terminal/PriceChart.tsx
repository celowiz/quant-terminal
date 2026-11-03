'use client'
import { tc } from '../../lib/themeRuntime'
/**
 * Gráfico de preços estilo terminal (GP = linha/montanha, GPL = GP em escala log, GPC = candles).
 * Referências de design: ver /REFERENCIAS.md (GP, GPC).
 *  - fundo carvão, grid pontilhado discreto, eixo de preço à direita com etiqueta do último preço
 *  - GPC: candle de alta "vazio" (contorno branco), de baixa preenchido em azul
 *  - painel de volume embaixo; legenda no canto superior esquerdo (Last Price / High on / Average / Low on)
 */
import { numLocale } from '../../lib/settings'
import { useEffect, useRef } from 'react'
import type { RulerStats } from '../../lib/ruler.mjs'
import {
  createChart, createSeriesMarkers, PriceScaleMode, TrackingModeExitMode, CandlestickSeries, AreaSeries, LineSeries, HistogramSeries, LineStyle, CrosshairMode,
  type IChartApi, type MouseEventParams, type Time,
} from 'lightweight-charts'
import type { Price } from '../../lib/static'

import { T, MONO } from './chartTheme'
export { T, MONO }

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
  /** títulos das linhas de máxima/mínima no eixo (EN/PT) */
  hlTitles?: [string, string]
  /** GPL: escala de preço logarítmica */
  log?: boolean
  /** marcadores de eventos corporativos (EVTS) */
  markers?: { time: string; text: string; color: string; shape: 'arrowDown' | 'arrowUp' | 'circle' | 'square'; position: 'aboveBar' | 'belowBar' }[]
  /** clique/toque numa barra (time da barra, shift pressionado) — régua */
  onPick?: (time: string, shift: boolean) => void
  /** régua: faixa entre as duas barras */
  ruler?: Pick<RulerStats, 'from' | 'to' | 'up'> | null
}

const VOL = tc('#7189aa')
/** lightweight-charts não expõe peso de fonte: deixa em negrito só os canvases do eixo direito (valores de preço). */
function boldRightAxis(root: HTMLElement) {
  root.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll(':scope > td')
    const axis = tds[tds.length - 1]
    if (!axis || tds.length < 3) return
    axis.querySelectorAll('canvas').forEach(cv => {
      const ctx = (cv as HTMLCanvasElement).getContext('2d') as any
      if (!ctx || ctx.__qtBold) return
      const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font')
      if (!d?.set || !d.get) return
      Object.defineProperty(ctx, 'font', { configurable: true, get() { return d.get!.call(this) }, set(v: string) { d.set!.call(this, /\bbold\b/.test(v) ? v : `bold ${v}`) } })
      ctx.__qtBold = true
    })
  })
}

const isoOf = (t: Time | undefined) => !t ? '' : typeof t === 'string' ? t
  : typeof t === 'object' ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}` : ''

export default function PriceChart({ rows, history, mode, showVolume, smas, onHover, highLow, hlTitles, log, markers, onPick, ruler }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const bandRef = useRef<HTMLDivElement | null>(null)
  const pickRef = useRef(onPick); pickRef.current = onPick
  const rulerRef = useRef(ruler); rulerRef.current = ruler
  // posiciona a faixa da régua pelas coordenadas das barras (acompanha zoom/rolagem/redimensionamento)
  const place = () => {
    const band = bandRef.current, chart = chartRef.current, r = rulerRef.current
    if (!band) return
    if (!chart || !r) { band.style.display = 'none'; return }
    const ts = chart.timeScale()
    const x0 = ts.timeToCoordinate(r.from as Time), x1 = ts.timeToCoordinate(r.to as Time)
    const w = ts.width()
    if (x0 == null && x1 == null) { band.style.display = 'none'; return }
    const a = Math.max(0, x0 ?? 0), b = Math.min(w, x1 ?? w)
    band.style.display = 'block'
    band.style.left = `${a}px`
    band.style.width = `${Math.max(2, b - a)}px`
    band.style.background = r.up ? tc('rgba(61,220,132,0.14)') : tc('rgba(255,77,77,0.14)')
    band.style.borderColor = r.up ? tc('#3ddc84') : tc('#FF4D4D')
  }
  const placeRef = useRef(place); placeRef.current = place

  useEffect(() => {
    const el = ref.current
    if (!el || !rows.length) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: T.bg }, textColor: T.axis, fontFamily: MONO, fontSize: 11,
        attributionLogo: false, // atribuição TradingView feita no rodapé (licença Apache-2.0)
        panes: { separatorColor: tc('#3a3a3a'), separatorHoverColor: tc('#555'), enableResize: true },
      },
      grid: {
        vertLines: { color: T.grid, style: LineStyle.Dotted },
        horzLines: { color: T.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: tc('#3a3a3a'), textColor: tc('#ffffff'), scaleMargins: { top: 0.12, bottom: 0.06 } },
      leftPriceScale: { visible: false },
      timeScale: { borderColor: tc('#3a3a3a'), rightOffset: 4, timeVisible: false, fixLeftEdge: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: tc('#777'), style: LineStyle.Dashed, labelBackgroundColor: T.amber },
        horzLine: { color: tc('#777'), style: LineStyle.Dashed, labelBackgroundColor: T.amber },
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
          upColor: T.up, borderUpColor: T.up, wickUpColor: T.up,
          downColor: T.down, borderDownColor: T.down, wickDownColor: T.down,
          borderVisible: true, wickVisible: true,
          priceLineColor: T.amber, priceLineStyle: LineStyle.Dotted, lastValueVisible: false,
          title: '', priceFormat: pf,
        })
      : chart.addSeries(AreaSeries, {
          lineColor: T.line, lineWidth: 2, topColor: T.mountain, bottomColor: tc('rgba(47,123,255,0.02)'),
          priceLineColor: T.amber, priceLineStyle: LineStyle.Dotted, lastValueVisible: false, priceFormat: pf,
        })
    if (mode === 'candle') {
      (price as any).setData(rows.map(r => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close })))
    } else {
      (price as any).setData(rows.map(r => ({ time: r.time, value: r.close })))
    }

    // rótulo do último preço no eixo: fundo branco, texto preto (linha pontilhada âmbar mantida pela série)
    const lastRow = rows[rows.length - 1]
    price.createPriceLine({ price: lastRow.close, color: tc('rgba(0,0,0,0)'), lineVisible: false, axisLabelVisible: true, axisLabelColor: tc('#ffffff'), axisLabelTextColor: tc('#000000'), title: '' } as any)

    if (highLow) {
      const key = mode === 'candle' ? ['high', 'low'] as const : ['close', 'close'] as const
      price.createPriceLine({ price: highLow.high[key[0]], color: T.high, lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: hlTitles?.[0] ?? 'High' })
      price.createPriceLine({ price: highLow.low[key[1]], color: T.low, lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: true, title: hlTitles?.[1] ?? 'Low' })
    }

    const first = rows[0].time
    const colors: Record<number, string> = { 50: T.sma50, 200: T.sma200 }
    smas.forEach(n => {
      const src = history && history.length ? history : rows
      const data = sma(src, n).filter(p => p.time >= first)
      if (!data.length) return
      const s = chart.addSeries(LineSeries, { color: colors[n] || tc('#aaa'), lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, priceFormat: pf })
      s.setData(data)
    })

    if (showVolume) {
      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'custom', minMove: 1, formatter: (v: number) => v >= 1e9 ? (v/1e9).toLocaleString(numLocale(),{maximumFractionDigits:2})+'B' : v >= 1e6 ? (v/1e6).toLocaleString(numLocale(),{maximumFractionDigits:1})+'M' : v >= 1e3 ? (v/1e3).toLocaleString(numLocale(),{maximumFractionDigits:0})+'K' : String(Math.round(v)) } as any, priceLineVisible: false, lastValueVisible: true,
      }, 1)
      vol.setData(rows.map((r, i) => {
        const up = mode === 'candle' ? r.close >= r.open : i === 0 || r.close >= rows[i - 1].close
        return { time: r.time, value: r.volume, color: VOL }
      }))
      const panes = chart.panes()
      panes[0].setStretchFactor(0.78)
      if (panes[1]) panes[1].setStretchFactor(0.22)
    }

    if (log) price.priceScale().applyOptions({ mode: PriceScaleMode.Logarithmic })
    if (markers?.length) createSeriesMarkers(price as any, markers as any)

    chart.timeScale().fitContent()
    boldRightAxis(el)
    chart.applyOptions({})

    const byTime = new Map(rows.map(r => [r.time, r]))
    const onMove = (p: MouseEventParams<Time>) => {
      if (!p.time) return onHover(null)
      onHover(byTime.get(isoOf(p.time)) || null)
    }
    // clique/toque: barra sob o cursor; à direita da última barra (margem) vale a barra mais próxima
    // a biblioteca descarta o 2º clique se vier em < 500 ms (vira tentativa de duplo clique): lemos o ponteiro direto,
    // pressionar+soltar sem arrastar (< 5 px) dentro do painel = um ponto
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      const d = down; down = null
      if (!pickRef.current || !d || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) >= 5) return
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
      const ts = chart.timeScale()
      if (x < 0 || x > ts.width() || y < 0 || y > r.height - ts.height()) return
      const lg = ts.coordinateToLogical(x)
      if (lg == null || !rows.length) return
      pickRef.current(rows[Math.max(0, Math.min(rows.length - 1, Math.round(lg)))].time, e.shiftKey)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    const onRange = () => placeRef.current()
    chart.subscribeCrosshairMove(onMove)
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    chart.timeScale().subscribeSizeChange(onRange)
    placeRef.current()
    return () => {
      chart.unsubscribeCrosshairMove(onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); chart.timeScale().unsubscribeSizeChange(onRange)
      chart.remove(); chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, history, mode, showVolume, smas.join(','), highLow, log, markers, hlTitles?.join('|')])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { place() }, [ruler?.from, ruler?.to, ruler?.up])

  return (
    <>
      <div ref={ref} className="absolute inset-0" />
      {/* faixa da régua: só visual, não intercepta o mouse (a mira e o clique continuam no gráfico) */}
      <div ref={bandRef} data-gp-ruler-band="" className="absolute top-0 bottom-[26px] z-[5] pointer-events-none border-x" style={{ display: 'none' }} />
    </>
  )
}
