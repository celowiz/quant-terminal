'use client'
import { numLocale } from '../../lib/settings'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { format, subMonths, subYears, startOfYear, parseISO } from 'date-fns'
import { t } from '../../lib/i18n'
import { getPrices, tickerMeta, go, type Price } from '../../lib/static'
import { trackPeriod } from '../../lib/track'
import { T, MONO } from './PriceChart'

const PriceChart = dynamic(() => import('./PriceChart'), { ssr: false })

const PERIODS: { k: string; label: string; from: (d: Date) => Date | null }[] = [
  { k: '1M', label: '1M', from: d => subMonths(d, 1) },
  { k: '3M', label: '3M', from: d => subMonths(d, 3) },
  { k: '6M', label: '6M', from: d => subMonths(d, 6) },
  { k: 'YTD', label: 'YTD', from: d => startOfYear(d) },
  { k: '1A', label: '1Y', from: d => subYears(d, 1) },
  { k: '2A', label: '2Y', from: d => subYears(d, 2) },
  { k: '5A', label: '5Y', from: d => subYears(d, 5) },
  { k: 'MAX', label: 'Max', from: () => null },
]
const TFS = [{ v: 'd', l: 'Daily' }, { v: 'w', l: 'Weekly' }, { v: 'm', l: 'Monthly' }, { v: 'q', l: 'Quarterly' }, { v: 'y', l: 'Yearly' }]

const nf = (v: number | undefined | null, d = 2) => v == null || isNaN(v) ? '—' : v.toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d })
const vf = (v: number) => v >= 1e9 ? `${nf(v / 1e9)}B` : v >= 1e6 ? `${nf(v / 1e6)}M` : v >= 1e3 ? `${nf(v / 1e3)}K` : String(v)
const df = (s?: string) => s ? format(parseISO(s), 'dd/MM/yy') : '—'

export default function ChartScreen({ ticker, mode }: { ticker: string; mode: 'line' | 'candle' }) {
  const [meta, setMeta] = useState<any>(null)
  const [all, setAll] = useState<Price[]>([])
  const [period, setPeriod] = useState('1A')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [tf, setTf] = useState('d')
  const [showVol, setShowVol] = useState(true)
  const [smaOn, setSmaOn] = useState<number[]>(mode === 'candle' ? [50, 200] : [])
  const [hover, setHover] = useState<Price | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [h, setH] = useState(600)
  const [legOpen, setLegOpen] = useState(false)

  // altura = viewport inteira abaixo do cabeçalho/barra de comando
  useLayoutEffect(() => {
    const fit = () => {
      const el = boxRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const desk = window.matchMedia('(min-width: 1024px)').matches
      const fh = desk ? (document.querySelector('footer') as HTMLElement | null)?.offsetHeight || 0 : 0
      // celular: altura fixa (~300px preço + ~110px volume), a página rola; tablet: preenche a tela; desktop: preenche a viewport
      const tab = window.matchMedia('(min-width: 768px)').matches
      setH(desk ? Math.max(240, window.innerHeight - top - fh - 6) : tab ? Math.max(410, window.innerHeight - top - 6) : showVol ? 410 : 300)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [meta, showVol])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [m, rows] = await Promise.all([tickerMeta(ticker), getPrices(ticker, undefined, undefined, tf)])
        if (!alive) return
        setMeta(m); setAll(rows); setErr(null)
        if (!end && rows.length) {
          const last = rows[rows.length - 1].time
          setEnd(last)
          const f = PERIODS.find(p => p.k === period)!.from(parseISO(last))
          setStart(f ? format(f, 'yyyy-MM-dd') : rows[0].time)
        }
      } catch (e: any) { if (alive) setErr(String(e?.message || e)) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, tf])

  const pickPeriod = (k: string) => {
    trackPeriod(k)
    setPeriod(k)
    if (!all.length) return
    const last = all[all.length - 1].time
    const f = PERIODS.find(p => p.k === k)!.from(parseISO(last))
    setEnd(last); setStart(f ? format(f, 'yyyy-MM-dd') : all[0].time)
  }

  const rows = useMemo(() => all.filter(r => (!start || r.time >= start) && (!end || r.time <= end)), [all, start, end])
  const history = useMemo(() => all.filter(r => !end || r.time <= end), [all, end])
  const stats = useMemo(() => {
    if (!rows.length) return null
    const hk = mode === 'candle' ? 'high' : 'close', lk = mode === 'candle' ? 'low' : 'close'
    let hi = rows[0], lo = rows[0], s = 0
    for (const r of rows) { if (r[hk] > hi[hk]) hi = r; if (r[lk] < lo[lk]) lo = r; s += r.close }
    return { hi, lo, hiV: hi[hk], loV: lo[lk], avg: s / rows.length }
  }, [rows, mode])
  const highLow = useMemo(() => stats ? { high: stats.hi, low: stats.lo } : null, [stats])

  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const obs = hover || last
  const obsIdx = obs ? rows.indexOf(obs) : -1
  const obsPrev = obsIdx > 0 ? rows[obsIdx - 1] : prev
  const chg = obs && obsPrev ? obs.close - obsPrev.close : null
  const chgPct = chg != null && obsPrev ? (chg / obsPrev.close) * 100 : null
  const chgColor = chg == null ? T.text : chg > 0 ? T.high : chg < 0 ? T.low : T.text
  const smaVal = (n: number) => {
    const i = history.findIndex(r => r.time === obs?.time)
    if (i < n - 1) return null
    let s = 0; for (let k = i - n + 1; k <= i; k++) s += history[k].close
    return s / n
  }
  const dec = (last?.close ?? 10) < 10 ? 4 : 2

  const btn = (active: boolean) =>
    `px-2 py-[2px] text-[12px] leading-5 border ${active ? 'bg-[#FFA028] text-black border-[#FFA028] font-bold' : 'bg-black text-[#FFA028] border-[#5a3d12] hover:border-[#FFA028]'}`

  const legend: { c: string; l: string; v: string }[] = stats && obs ? [
    { c: mode === 'candle' ? T.up : T.line, l: hover ? `Close ${df(obs.time)}` : 'Last Price', v: nf(obs.close, dec) },
    { c: T.high, l: `High on ${df(stats.hi.time)}`, v: nf(stats.hiV, dec) },
    { c: '#9e9e9e', l: 'Average', v: nf(stats.avg, dec) },
    { c: T.low, l: `Low on ${df(stats.lo.time)}`, v: nf(stats.loV, dec) },
    ...smaOn.map(n => ({ c: n === 50 ? T.sma50 : T.sma200, l: `SMAVG (${n}) on Close`, v: nf(smaVal(n) ?? NaN, dec) })),
  ] : []

  return (
    <div className="flex flex-col w-full -mt-4 sm:-mt-6" style={{ fontFamily: MONO, background: '#000' }}>
      {/* Barra do ativo */}
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap px-3 py-1 border-b border-[#3a3a3a] text-[13px]" style={{ background: '#000' }}>
        <span className="font-bold text-black bg-[#FFA028] px-2">{ticker}</span>
        <span className="text-[#d9d9d9] truncate max-w-[320px] max-lg:max-w-[52vw]">{meta?.name || ''}</span>
        {meta?.unit && <span className="text-[#8a8a8a]">{meta.unit}</span>}
        <span className="font-bold text-white text-[15px]">{nf(obs?.close, dec)}</span>
        <span style={{ color: chgColor }}>{chg == null ? '' : `${chg > 0 ? '+' : ''}${nf(chg, dec)}`}</span>
        <span style={{ color: chgColor }}>{chgPct == null ? '' : `${chgPct > 0 ? '+' : ''}${nf(chgPct)}%`}</span>
        <span className="text-[#8a8a8a]">{obs ? format(parseISO(obs.time), 'dd/MM/yyyy') : ''}</span>
        <span className="text-[#8a8a8a]">O <b className="text-[#d9d9d9] font-normal">{nf(obs?.open, dec)}</b></span>
        <span className="text-[#8a8a8a]">H <b className="text-[#d9d9d9] font-normal">{nf(obs?.high, dec)}</b></span>
        <span className="text-[#8a8a8a]">L <b className="text-[#d9d9d9] font-normal">{nf(obs?.low, dec)}</b></span>
        <span className="text-[#8a8a8a]">C <b className="text-[#d9d9d9] font-normal">{nf(obs?.close, dec)}</b></span>
        <span className="text-[#8a8a8a]">Vol <b className="text-[#d9d9d9] font-normal">{obs?.volume ? vf(obs.volume) : '—'}</b></span>
        {meta?.close_only && <span className="text-[#8a8a8a] italic" data-close-only="">{t('asset.closeOnly')}</span>}
        {meta?.link && <a className="text-[#8a8a8a] underline hover:text-[#FFA028]" href={meta.link} target="_blank" rel="noopener noreferrer">{t('asset.official')}</a>}
        {meta?.ref && <a className="text-[#8a8a8a] underline hover:text-[#FFA028]" href={meta.ref} target="_blank" rel="noopener noreferrer">{t('asset.reference')}</a>}
        <span className="ml-auto text-[#FFA028] text-[12px]">{mode === 'candle' ? 'GPC · Candle Chart' : 'GP · Line Chart'}</span>
      </div>
      {/* Barra de ferramentas */}
      <div className="flex items-center gap-3 flex-wrap px-3 py-1 border-b border-[#3a3a3a] bg-[#0a0a0a] text-[12px] fn-strip max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:[&>*]:shrink-0 max-lg:whitespace-nowrap">
        <div className="flex gap-[2px]">{PERIODS.map(p => <button key={p.k} className={btn(period === p.k)} onClick={() => pickPeriod(p.k)}>{p.label}</button>)}</div>
        <div className="flex items-center gap-1 text-[#8a8a8a]">
          <input type="date" value={start} onChange={e => { setStart(e.target.value); setPeriod('') }} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[1px] outline-none focus:border-[#FFA028]" />
          <span>–</span>
          <input type="date" value={end} onChange={e => { setEnd(e.target.value); setPeriod('') }} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[1px] outline-none focus:border-[#FFA028]" />
        </div>
        <select value={tf} onChange={e => setTf(e.target.value)} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[2px] outline-none focus:border-[#FFA028]">
          {TFS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <div className="flex gap-[2px]">
          <button className={btn(showVol)} onClick={() => setShowVol(v => !v)}>Volume</button>
          {[50, 200].map(n => <button key={n} className={btn(smaOn.includes(n))} onClick={() => setSmaOn(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n].sort((a, b) => a - b))}>SMAVG {n}</button>)}
        </div>
        <div className="flex gap-[2px] ml-auto">
          <button className={btn(mode === 'line')} onClick={() => mode !== 'line' && go(`/gp/${encodeURIComponent(ticker)}/`)}>Linha (GP)</button>
          <button className={btn(mode === 'candle')} onClick={() => mode !== 'candle' && go(`/gpc/${encodeURIComponent(ticker)}/`)}>Candle (GPC)</button>
        </div>
      </div>
      {/* Gráfico: ocupa o resto da viewport */}
      <div ref={boxRef} className="relative w-full" style={{ height: h, background: T.bg }}>
        {err && <div className="absolute inset-0 flex items-center justify-center text-[#FF4D4D]">Error loading data: {err}</div>}
        {!err && !rows.length && <div className="absolute inset-0 flex items-center justify-center text-[#8a8a8a]">Loading…</div>}
        {rows.length > 0 && (
          <PriceChart rows={rows} history={history} mode={mode} showVolume={showVol} smas={smaOn} onHover={setHover} highLow={highLow} />
        )}
        {legend.length > 0 && (
          <button type="button" className="lg:hidden absolute top-1 left-1 z-20 text-[11px] px-2 py-[1px]" style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid #2a2a2a', color: '#FFA028' }} onClick={() => setLegOpen(o => !o)}>Legenda {legOpen ? '▾' : '▸'}</button>
        )}
        {legend.length > 0 && (
          <div className={`absolute top-2 left-2 z-10 pointer-events-none text-[12px] leading-[17px] px-2 py-1 max-lg:top-7 max-lg:left-1 max-lg:text-[11px] max-lg:leading-[15px] ${legOpen ? '' : 'max-lg:hidden'}`} style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid #2a2a2a' }}>
            {legend.map(r => (
              <div key={r.l} className="flex items-center gap-2">
                <span className="inline-block w-[9px] h-[9px]" style={{ background: r.c, border: r.c === T.up && mode === 'candle' ? '1px solid #fff' : undefined }} />
                <span className="text-[#d9d9d9] min-w-[170px] max-lg:min-w-[104px]">{r.l}</span>
                <span className="font-bold" style={{ color: r.c === '#9e9e9e' ? '#d9d9d9' : r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        )}
        {showVol && rows.length > 0 && (
          <div className="absolute left-2 z-10 pointer-events-none text-[11px] px-1" style={{ top: 'calc(78% + 4px)', color: '#d9d9d9', background: 'rgba(0,0,0,0.6)' }}>
            Volume <b>{obs?.volume ? vf(obs.volume) : '—'}</b>
          </div>
        )}
      </div>
    </div>
  )
}
