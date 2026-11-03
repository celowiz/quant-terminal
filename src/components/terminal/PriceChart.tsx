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
import type { HABar, BollPt, VolumeProfile } from '../../lib/studies.mjs'
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
  /** clique/toque numa barra (time da barra, shift pressionado, tipo de ponteiro) — régua e fixar barra no toque */
  onPick?: (time: string, shift: boolean, pointer: string) => void
  /** casas decimais do eixo/rótulos (mesma regra em GP, GPL e GPC) */
  dec?: number
  /** GPC: velas Heikin-Ashi no lugar das velas reais */
  ha?: HABar[] | null
  /** Bandas de Bollinger (20, 2σ) */
  boll?: BollPt[] | null
  /** perfil de volume (histograma lateral por faixa de preço) */
  vp?: VolumeProfile | null
  /** títulos POC/área de valor no eixo (EN/PT) */
  vpTitles?: [string, string]
  /** régua: faixa entre as duas barras */
  ruler?: Pick<RulerStats, 'from' | 'to' | 'up'> | null
}

const VOL = tc('#7189aa')
export const BOLL = tc('#26C6DA')
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

export default function PriceChart({ rows, history, mode, showVolume, smas, onHover, highLow, hlTitles, log, markers, onPick, ruler, dec = 2, ha, boll, vp, vpTitles }: Props) {
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
  // perfil de volume: barras horizontais à direita do painel de preço, alinhadas pelas coordenadas do eixo
  const vpRef = useRef<HTMLDivElement | null>(null)
  const seriesRef = useRef<any>(null)
  const vpData = useRef(vp); vpData.current = vp
  const placeVp = () => {
    const box = vpRef.current, chart = chartRef.current, s = seriesRef.current, d = vpData.current
    if (!box) return
    if (!chart || !s || !d) { box.style.display = 'none'; box.replaceChildren(); return }
    const w = chart.timeScale().width()
    const max = Math.max(...d.bins.map(b => b.vol)) || 1
    const full = Math.max(40, w * 0.22)
    box.style.display = 'block'
    box.style.left = `${Math.max(0, w - full)}px`
    box.style.width = `${full}px`
    box.style.height = `${chart.panes()[0]?.getHeight() ?? 0}px`
    const kids: HTMLElement[] = []
    d.bins.forEach((b, j) => {
      const y0 = s.priceToCoordinate(b.to), y1 = s.priceToCoordinate(b.from)
      if (y0 == null || y1 == null) return
      const el = document.createElement('div')
      const top = Math.min(y0, y1), hgt = Math.max(1, Math.abs(y1 - y0) - 1)
      el.style.cssText = `position:absolute;right:0;top:${top}px;height:${hgt}px;width:${(b.vol / max) * 100}%;background:${
        j === d.poc ? tc('rgba(255,160,40,0.55)') : b.inVA ? tc('rgba(113,137,170,0.42)') : tc('rgba(113,137,170,0.18)')}`
      el.dataset.vpBin = String(j)
      kids.push(el)
    })
    box.replaceChildren(...kids)
  }
  const placeVpRef = useRef(placeVp); placeVpRef.current = placeVp

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

    // mesmas casas decimais em toda a série (antes: 4 casas só abaixo de 10, ex.: mínima 7,6446 no GPL 5Y)
    const pf = { type: 'custom', minMove: dec === 4 ? 0.0001 : 0.01, formatter: (v: number) => v.toLocaleString(numLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }) } as any
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
    seriesRef.current = price
    if (mode === 'candle') {
      (price as any).setData(ha?.length ? ha : rows.map(r => ({ time: r.time, open: r.open, high: r.high, low: r.low, close: r.close })))
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

    if (boll?.length) {
      const line = (k: 'upper' | 'mid' | 'lower') => {
        const s = chart.addSeries(LineSeries, { color: BOLL, lineWidth: 1, lineStyle: k === 'mid' ? LineStyle.Dashed : LineStyle.Solid, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf })
        s.setData(boll.map(p => ({ time: p.time, value: p[k] })))
      }
      line('upper'); line('mid'); line('lower')
    }
    if (vp) {
      const mid = (j: number) => vp.lo + (j + 0.5) * vp.step
      price.createPriceLine({ price: mid(vp.poc), color: tc('#FFA028'), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: vpTitles?.[0] ?? 'POC' })
      price.createPriceLine({ price: vp.lo + (vp.vaHi + 1) * vp.step, color: tc('#7189aa'), lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: false, title: '' })
      price.createPriceLine({ price: vp.lo + vp.vaLo * vp.step, color: tc('#7189aa'), lineWidth: 1, lineStyle: LineStyle.SparseDotted, axisLabelVisible: false, title: vpTitles?.[1] ?? 'VA' })
    }

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
      pickRef.current(rows[Math.max(0, Math.min(rows.length - 1, Math.round(lg)))].time, e.shiftKey, e.pointerType)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    const onRange = () => { placeRef.current(); placeVpRef.current() }
    chart.subscribeCrosshairMove(onMove)
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    chart.timeScale().subscribeSizeChange(onRange)
    placeRef.current()
    // o eixo de preço só fica pronto depois do 1º desenho
    const raf = requestAnimationFrame(() => placeVpRef.current())
    const onWheel = () => requestAnimationFrame(() => placeVpRef.current())
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerup', onWheel)
    return () => {
      cancelAnimationFrame(raf); el.removeEventListener('wheel', onWheel); el.removeEventListener('pointerup', onWheel)
      chart.unsubscribeCrosshairMove(onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); chart.timeScale().unsubscribeSizeChange(onRange)
      chart.remove(); chartRef.current = null; seriesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, history, mode, showVolume, smas.join(','), highLow, log, markers, hlTitles?.join('|'), dec, ha, boll, vp, vpTitles?.join('|')])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { place() }, [ruler?.from, ruler?.to, ruler?.up])

  return (
    <>
      <div ref={ref} className="absolute inset-0" />
      {/* faixa da régua: só visual, não intercepta o mouse (a mira e o clique continuam no gráfico) */}
      {/* perfil de volume: só visual */}
      <div ref={vpRef} data-gpc-vp="" className="absolute top-0 z-[4] pointer-events-none overflow-hidden" style={{ display: 'none' }} />
      <div ref={bandRef} data-gp-ruler-band="" className="absolute top-0 bottom-[26px] z-[5] pointer-events-none border-x" style={{ display: 'none' }} />
    </>
  )
}
