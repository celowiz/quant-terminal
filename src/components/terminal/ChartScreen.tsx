'use client'
import { tc } from '../../lib/themeRuntime'
import { numLocale, lang } from '../../lib/settings'
import { fmtDate, fmtDateFull } from '../../lib/dates'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { format, subMonths, subYears, startOfYear, parseISO } from 'date-fns'
import { t } from '../../lib/i18n'
import { getPrices, getJSON, tickerKey, tickerMeta, go, RECENT_PERIODS, type Price } from '../../lib/static'
import '../../lib/coverage'
import { covers } from '../../lib/activeTicker.mjs'
import { EVENT_KINDS, buildEvents, eventsByBar, eventMarkers, type Ev, type EvKind } from '../../lib/chartEvents.mjs'
import { rulerStats, rulerNext } from '../../lib/ruler.mjs'
import { heikinAshi, bollinger, volumeProfile, priceDecimals } from '../../lib/studies.mjs'
import { putCarry, takeCarry } from '../../lib/chartCarry'
import { trackPeriod } from '../../lib/track'
import { T, MONO } from './chartTheme'
const BOLL = tc('#26C6DA')
import { safeUrl } from '../../lib/safe.mjs'

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
const TFS = [{ v: 'd', l: 'Daily', pt: 'Diário' }, { v: 'w', l: 'Weekly', pt: 'Semanal' }, { v: 'm', l: 'Monthly', pt: 'Mensal' }, { v: 'q', l: 'Quarterly', pt: 'Trimestral' }, { v: 'y', l: 'Yearly', pt: 'Anual' }]
const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const TITLES = {
  GP: ['GP · Line Chart', 'GP · Gráfico de linha'],
  GPL: ['GPL · Line Chart (Log)', 'GPL · Gráfico de linha (log)'],
  GPC: ['GPC · Candle Chart', 'GPC · Gráfico de candles'],
} as const

const nf = (v: number | undefined | null, d = 2) => v == null || isNaN(v) ? '—' : v.toLocaleString(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d })
const vf = (v: number) => v >= 1e9 ? `${nf(v / 1e9)}B` : v >= 1e6 ? `${nf(v / 1e6)}M` : v >= 1e3 ? `${nf(v / 1e3)}K` : String(v)
const df = (s?: string) => s ? fmtDate(s) : '—'

/** GP (linha), GPL (linha em escala log, `log`) e GPC (candles) compartilham esta tela. */
export default function ChartScreen({ ticker, mode, log = false }: { ticker: string; mode: 'line' | 'candle'; log?: boolean }) {
  const code = mode === 'candle' ? 'GPC' : log ? 'GPL' : 'GP'
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
  // começa pelo arquivo recente (~2 anos); 2Y/5Y/Max, data inicial mais antiga ou timeframe ≠ diário pedem o histórico completo
  const [full, setFull] = useState(false)
  // régua: dois pontos (shift+clique no desktop; botão Régua + dois toques/cliques)
  const [rulerOn, setRulerOn] = useState(false)
  const [pts, setPts] = useState<string[]>([])
  // eventos corporativos (mesma montagem do EVTS); só ações com corp/<t>.json
  const evOk = covers('EVTS', ticker)
  // GPC: estudos opcionais (Heikin-Ashi, Bollinger 20/2σ, perfil de volume)
  const [haOn, setHaOn] = useState(false)
  const [bollOn, setBollOn] = useState(false)
  const [vpOn, setVpOn] = useState(false)
  // toque numa vela fixa O/H/L/C dela no cabeçalho; novo toque volta à última barra
  const [pinned, setPinned] = useState<Price | null>(null)
  const [evOn, setEvOn] = useState(false)
  const [evs, setEvs] = useState<Ev[] | null>(null)
  const [evErr, setEvErr] = useState(false)
  const carryRead = useRef(false)

  // altura = viewport inteira abaixo do cabeçalho/barra de comando
  useLayoutEffect(() => {
    const fit = () => {
      const el = boxRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const desk = window.matchMedia('(min-width: 1024px)').matches
      const tab = window.matchMedia('(min-width: 768px)').matches
      const fh = (document.querySelector('footer') as HTMLElement | null)?.offsetHeight || 0
      // celular: preenche até o rodapé (antes ficava fixo em 410px e sobrava um vão vazio acima do rodapé),
      // com mínimo de ~300px preço + ~110px volume; tablet e desktop: preenchem a viewport com o rodapé visível
      const emb = document.documentElement.hasAttribute('data-embed')   // painel do Launchpad: iframe baixo
      const min = desk ? (emb ? 140 : 240) : tab || showVol ? 410 : 300
      setH(Math.max(min, window.innerHeight - top - fh - 6))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [meta, showVol])

  useEffect(() => {
    let alive = true
    // primeira carga: aplica o estado trazido da tela irmã (GP ↔ GPL ↔ GPC), se houver
    let c = null as ReturnType<typeof takeCarry>
    if (!carryRead.current) {
      carryRead.current = true
      c = takeCarry(ticker)
      if (c) {
        if (c.period === '' || PERIODS.some(p => p.k === c!.period)) setPeriod(c.period)
        if (c.start) setStart(c.start)
        if (c.end) setEnd(c.end)
        setShowVol(c.showVol); setSmaOn(c.smaOn)
        if (c.events && evOk) setEvOn(true)
        if (c.tf !== tf || (c.full && !full)) { setTf(c.tf); setFull(c.full || full); return }
      }
    }
    ;(async () => {
      try {
        const [m, rows] = await Promise.all([tickerMeta(ticker), getPrices(ticker, undefined, undefined, tf, !full && tf === 'd')])
        if (!alive) return
        setMeta(m); setAll(rows); setErr(null)
        if (!c?.end && (!end || period === 'MAX') && rows.length) {
          const last = rows[rows.length - 1].time
          if (!end) setEnd(last)
          const f = PERIODS.find(p => p.k === period)!.from(parseISO(last))
          setStart(f ? format(f, 'yyyy-MM-dd') : rows[0].time)
        }
      } catch (e: any) { if (alive) setErr(String(e?.message || e)) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, tf, full])

  // data inicial digitada antes do começo do arquivo recente → histórico completo
  useEffect(() => { if (!full && start && all.length && start < all[0].time) setFull(true) }, [start, all, full])

  const pickPeriod = (k: string) => {
    trackPeriod(k)
    setPeriod(k)
    if (!RECENT_PERIODS.has(k)) setFull(true)
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
  const obs = hover || pinned || last
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
  // casas decimais pela série exibida inteira (não pelo último preço): eixo, rótulos e legenda iguais em GP/GPL/GPC
  const dec = useMemo(() => priceDecimals(rows), [rows])
  const first = rows[0]?.time
  const haAll = useMemo(() => (mode === 'candle' && haOn ? heikinAshi(history) : null), [mode, haOn, history])
  const ha = useMemo(() => (haAll && first ? haAll.filter(b => b.time >= first) : null), [haAll, first])
  const haMap = useMemo(() => (ha ? new Map(ha.map(b => [b.time, b])) : null), [ha])
  const boll = useMemo(() => (mode === 'candle' && bollOn && first ? bollinger(history, 20, 2).filter(p => p.time >= first) : null), [mode, bollOn, history, first])
  const bollMap = useMemo(() => (boll ? new Map(boll.map(p => [p.time, p])) : null), [boll])
  const vp = useMemo(() => (mode === 'candle' && vpOn ? volumeProfile(rows, 24, 0.7) : null), [mode, vpOn, rows])
  const vpTitles = useMemo(() => ['POC', L('Value area', 'Área de valor')] as [string, string], [])

  // eventos: carrega corp + calendário só quando o botão é ligado
  useEffect(() => {
    if (!evOn || !evOk || evs) return
    let alive = true
    Promise.all([getJSON<any>(`corp/${tickerKey(ticker)}.json`), getJSON<any>('calendar.json').catch(() => null)])
      .then(([d, cal]) => { if (alive) setEvs(buildEvents(d, cal, ticker)) })
      .catch(() => { if (alive) { setEvErr(true); setEvOn(false) } })
    return () => { alive = false }
  }, [evOn, evOk, evs, ticker])
  const byBar = useMemo(() => (evOn && evs ? eventsByBar(evs, rows.map(r => r.time)) : null), [evOn, evs, rows])
  const markers = useMemo(() => (byBar ? eventMarkers(byBar, EVENT_KINDS, tc) : undefined), [byBar])
  const hoverEvs = hover && byBar ? byBar.get(hover.time) || [] : []

  const ruler = useMemo(() => (pts.length === 2 ? rulerStats(rows, pts[0], pts[1]) : null), [pts, rows])
  const onPick = (time: string, shift: boolean, pointer: string) => {
    if (shift || rulerOn) { setPts(p => rulerNext(p, time)); return }
    if (pointer === 'touch') setPinned(p => (p ? null : rows.find(r => r.time === time) || null))
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPts([]); setRulerOn(false) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  // período/timeframe novos: a régua antiga deixa de valer
  useEffect(() => { setPts([]); setPinned(null) }, [start, end, tf])
  const hlTitles = useMemo(() => [L('High', 'Máx'), L('Low', 'Mín')] as [string, string], [])

  const goTo = (path: string) => {
    putCarry({ ticker, period, start, end, tf, full, showVol, smaOn, events: evOn })
    go(path)
  }
  const tk = encodeURIComponent(ticker)

  const btn = (active: boolean) =>
    `px-2 py-[2px] text-[12px] leading-5 border ${active ? 'bg-[#FFA028] text-black border-[#FFA028] font-bold' : 'bg-black text-[#FFA028] border-[#5a3d12] hover:border-[#FFA028]'}`

  const legend: { c: string; l: string; v: string }[] = stats && obs ? [
    { c: mode === 'candle' ? T.up : T.line, l: hover || pinned ? `${L('Close', 'Fechamento')} ${df(obs.time)}` : L('Last Price', 'Último preço'), v: nf(obs.close, dec) },
    { c: T.high, l: `${L('High on', 'Máxima em')} ${df(stats.hi.time)}`, v: nf(stats.hiV, dec) },
    { c: tc('#9e9e9e'), l: L('Average', 'Média'), v: nf(stats.avg, dec) },
    { c: T.low, l: `${L('Low on', 'Mínima em')} ${df(stats.lo.time)}`, v: nf(stats.loV, dec) },
    ...smaOn.map(n => ({ c: n === 50 ? T.sma50 : T.sma200, l: L(`SMAVG (${n}) on Close`, `SMAVG (${n}) do fechamento`), v: nf(smaVal(n) ?? NaN, dec) })),
    ...(haMap && obs && haMap.get(obs.time) ? [{ c: T.up, l: L('Heikin-Ashi O / H / L / C', 'Heikin-Ashi A / M / m / F'), v: (b => [b.open, b.high, b.low, b.close].map(x => nf(x, dec)).join(' / '))(haMap.get(obs.time)!) }] : []),
    ...(bollMap ? (b => [
      { c: BOLL, l: L('Bollinger (20, 2σ) upper', 'Bollinger (20, 2σ) superior'), v: nf(b?.upper ?? NaN, dec) },
      { c: BOLL, l: L('Bollinger (20) middle', 'Bollinger (20) média'), v: nf(b?.mid ?? NaN, dec) },
      { c: BOLL, l: L('Bollinger (20, 2σ) lower', 'Bollinger (20, 2σ) inferior'), v: nf(b?.lower ?? NaN, dec) },
    ])(obs ? bollMap.get(obs.time) : undefined) : []),
    ...(vp ? [
      { c: tc('#FFA028'), l: L('Volume profile POC (approx.)', 'Perfil de volume POC (aprox.)'), v: nf(vp.lo + (vp.poc + 0.5) * vp.step, dec) },
      { c: tc('#7189aa'), l: L('Value area 70%', 'Área de valor 70%'), v: `${nf(vp.lo + vp.vaLo * vp.step, dec)} – ${nf(vp.lo + (vp.vaHi + 1) * vp.step, dec)}` },
    ] : []),
    // eventos ligados: chave dos marcadores com a contagem no período exibido
    ...(byBar ? (['R', 'F', 'D', 'S'] as EvKind[]).map(k => ({ c: tc(EVENT_KINDS[k].color), l: `${k} · ${L(EVENT_KINDS[k].en, EVENT_KINDS[k].pt)}`, v: String(Array.from(byBar.values()).reduce((n, es) => n + es.filter(e => e.kind === k).length, 0)) })) : []),
  ] : []

  return (
    <div className="flex flex-col w-full -mt-4 sm:-mt-6" style={{ fontFamily: MONO, background: tc('#000') }}>
      {/* Barra do ativo */}
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap px-3 py-1 border-b border-[#3a3a3a] text-[13px]" style={{ background: tc('#000') }}>
        {/* ticker + nome ficam só na barra do topo (evita a linha duplicada logo abaixo) */}
        {meta?.unit && <span className="text-[#8a8a8a]">{meta.unit}</span>}
        <span className="font-bold text-white text-[15px]">{nf(obs?.close, dec)}</span>
        <span style={{ color: chgColor }}>{chg == null ? '' : `${chg > 0 ? '+' : ''}${nf(chg, dec)}`}</span>
        <span style={{ color: chgColor }}>{chgPct == null ? '' : `${chgPct > 0 ? '+' : ''}${nf(chgPct)}%`}</span>
        <span className="text-[#8a8a8a]">{obs ? fmtDateFull(obs.time) : ''}</span>
        <span className="text-[#8a8a8a]">O <b className="text-[#d9d9d9] font-normal">{nf(obs?.open, dec)}</b></span>
        <span className="text-[#8a8a8a]">H <b className="text-[#d9d9d9] font-normal">{nf(obs?.high, dec)}</b></span>
        <span className="text-[#8a8a8a]">L <b className="text-[#d9d9d9] font-normal">{nf(obs?.low, dec)}</b></span>
        <span className="text-[#8a8a8a]">C <b className="text-[#d9d9d9] font-normal">{nf(obs?.close, dec)}</b></span>
        <span className="text-[#8a8a8a]">Vol <b className="text-[#d9d9d9] font-normal">{obs?.volume ? vf(obs.volume) : '—'}</b></span>
        {pinned && !hover && <button type="button" data-gpc-pin className="text-[#FFA028] text-[12px] underline" onClick={() => setPinned(null)}>{L('Pinned · tap again for the last bar', 'Fixado · toque de novo para a última barra')}</button>}
        {meta?.close_only && <span className="text-[#8a8a8a] italic" data-close-only="">{t('asset.closeOnly')}</span>}
        {safeUrl(meta?.link) && <a className="text-[#8a8a8a] underline hover:text-[#FFA028]" href={safeUrl(meta?.link)} target="_blank" rel="noopener noreferrer">{t('asset.official')}</a>}
        {safeUrl(meta?.ref) && <a className="text-[#8a8a8a] underline hover:text-[#FFA028]" href={safeUrl(meta?.ref)} target="_blank" rel="noopener noreferrer">{t('asset.reference')}</a>}
        <span className="ml-auto text-[#FFA028] text-[12px]">{L(TITLES[code][0], TITLES[code][1])}</span>
      </div>
      {/* Barra de ferramentas */}
      {/* No mobile: períodos numa linha; as ferramentas quebram em linhas (sem rolagem lateral interna). No desktop `contents` mantém uma linha só. */}
      <div className="flex items-center gap-3 flex-wrap px-3 py-1 border-b border-[#3a3a3a] bg-[#0a0a0a] text-[12px] max-lg:gap-y-1 max-lg:whitespace-nowrap">
        <div data-gp-periods className="flex gap-[2px] max-lg:w-full max-lg:overflow-x-auto fn-strip max-lg:[&>*]:shrink-0">{PERIODS.map(p => <button key={p.k} className={btn(period === p.k)} onClick={() => pickPeriod(p.k)}>{p.label}</button>)}</div>
        <div data-gp-tools className="contents max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-1 max-lg:w-full">
        <div data-gp-dates className="flex items-center gap-1 text-[#8a8a8a]">
          <input type="date" value={start} onChange={e => { setStart(e.target.value); setPeriod('') }} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[1px] outline-none focus:border-[#FFA028]" />
          <span>–</span>
          <input type="date" value={end} onChange={e => { setEnd(e.target.value); setPeriod('') }} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[1px] outline-none focus:border-[#FFA028]" />
        </div>
        <select value={tf} onChange={e => setTf(e.target.value)} className="bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[2px] outline-none focus:border-[#FFA028]">
          {TFS.map(o => <option key={o.v} value={o.v}>{L(o.l, o.pt)}</option>)}
        </select>
        <div className="flex gap-[2px]">
          <button className={btn(showVol)} onClick={() => setShowVol(v => !v)}>Volume</button>
          {[50, 200].map(n => <button key={n} className={btn(smaOn.includes(n))} onClick={() => setSmaOn(s => s.includes(n) ? s.filter(x => x !== n) : [...s, n].sort((a, b) => a - b))}>SMAVG {n}</button>)}
        </div>
        {mode === 'candle' && (
          <div className="flex flex-wrap gap-[2px]" data-gpc-studies>
            <button className={btn(haOn)} data-gpc-ha aria-pressed={haOn}
              title={L('Heikin-Ashi candles: close = (O+H+L+C)/4, open = average of the previous HA open and close. Smooths the trend; the header keeps the real prices.', 'Velas Heikin-Ashi: fechamento = (A+M+m+F)/4, abertura = média da abertura e do fechamento HA anteriores. Suaviza a tendência; o cabeçalho mantém os preços reais.')}
              onClick={() => setHaOn(v => !v)}>Heikin-Ashi</button>
            <button className={btn(bollOn)} data-gpc-boll aria-pressed={bollOn}
              title={L('Bollinger Bands: 20-bar average of the close ± 2 standard deviations. Wide bands = high volatility; touches of a band are not signals by themselves.', 'Bandas de Bollinger: média de 20 barras do fechamento ± 2 desvios-padrão. Bandas largas = volatilidade alta; tocar uma banda não é sinal por si só.')}
              onClick={() => setBollOn(v => !v)}>Bollinger</button>
            <button className={btn(vpOn)} data-gpc-vp-btn aria-pressed={vpOn}
              title={L('Volume profile (approximation from daily bars): each bar\'s volume is spread evenly across its low–high range in 24 price bins. POC = busiest bin; value area = bins holding 70% of the volume.', 'Perfil de volume (aproximação a partir de barras diárias): o volume de cada barra é espalhado por igual entre a mínima e a máxima, em 24 faixas de preço. POC = faixa com mais volume; área de valor = faixas com 70% do volume.')}
              onClick={() => setVpOn(v => !v)}>{L('Vol. profile', 'Perfil de vol.')}</button>
          </div>
        )}
        {(
          <div className="flex flex-wrap gap-[2px]" data-gp-studies>
            <button className={btn(rulerOn || pts.length > 0)} data-gp-ruler aria-pressed={rulerOn}
              title={L('Measure the change between two points: shift+click two points on the chart (or turn this on and click/tap twice). Esc clears.', 'Meça a variação entre dois pontos: shift+clique em dois pontos do gráfico (ou ligue este botão e clique/toque duas vezes). Esc limpa.')}
              onClick={() => { if (rulerOn || pts.length) { setRulerOn(false); setPts([]) } else setRulerOn(true) }}>{L('Ruler', 'Régua')}</button>
            {evOk && !evErr && (
              <button className={btn(evOn)} data-gp-events aria-pressed={evOn}
                title={L('Corporate events on the chart: R results, F material facts / 8-K, D dividends (ex-date), S splits. Hover a marker for details.', 'Eventos corporativos no gráfico: R resultados, F fatos relevantes / 8-K, D proventos (data ex), S desdobramentos. Passe o mouse sobre o marcador para ver os detalhes.')}
                onClick={() => setEvOn(v => !v)}>{L('Events', 'Eventos')}</button>
            )}
          </div>
        )}
        {mode === 'line' && (
          <div className="flex gap-[2px]" data-gp-scale>
            <button className={btn(!log)} aria-pressed={!log} title={L('Linear price scale (GP)', 'Escala de preço linear (GP)')} onClick={() => log && goTo(`/gp/${tk}/`)}>Linear</button>
            <button className={btn(log)} aria-pressed={log} title={L('Logarithmic price scale (GPL): equal % moves take equal heights', 'Escala de preço logarítmica (GPL): variações % iguais ocupam alturas iguais')} onClick={() => !log && goTo(`/gpl/${tk}/`)}>Log</button>
          </div>
        )}
        <div className="flex gap-[2px] ml-auto">
          <button className={btn(mode === 'line')} onClick={() => (mode !== 'line' || log) && goTo(`/gp/${tk}/`)}>{L('Line', 'Linha')} (GP)</button>
          <button className={btn(mode === 'candle')} onClick={() => mode !== 'candle' && goTo(`/gpc/${tk}/`)}>Candle (GPC)</button>
        </div>
        </div>
      </div>
      {/* Gráfico: ocupa o resto da viewport */}
      <div ref={boxRef} className="relative w-full" style={{ height: h, background: T.bg }}>
        {err && <div className="absolute inset-0 flex items-center justify-center text-[#FF4D4D]">{L('Error loading data', 'Erro ao carregar os dados')}: {err}</div>}
        {!err && !rows.length && <div className="absolute inset-0 flex items-center justify-center text-[#8a8a8a]">{L('Loading…', 'Carregando…')}</div>}
        {rows.length > 0 && (
          <PriceChart rows={rows} history={history} mode={mode} showVolume={showVol} smas={smaOn} onHover={setHover} highLow={highLow}
            hlTitles={hlTitles} log={log} markers={markers} onPick={onPick} ruler={ruler} dec={dec} ha={ha} boll={boll} vp={vp} vpTitles={vpTitles} />
        )}
        {legend.length > 0 && (
          <button type="button" className="lg:hidden absolute top-1 left-1 z-20 text-[11px] px-2 py-[1px]" style={{ background: tc('rgba(0,0,0,0.72)'), border: '1px solid #2a2a2a', color: tc('#FFA028') }} onClick={() => setLegOpen(o => !o)}>{lang() === 'pt' ? 'Legenda' : 'Legend'} {legOpen ? '▾' : '▸'}</button>
        )}
        {legend.length > 0 && (
          <div className={`absolute top-2 left-2 z-10 pointer-events-none text-[12px] leading-[17px] px-2 py-1 max-lg:top-7 max-lg:left-1 max-lg:text-[11px] max-lg:leading-[15px] ${legOpen ? '' : 'max-lg:hidden'}`} style={{ background: tc('rgba(0,0,0,0.72)'), border: '1px solid #2a2a2a' }}>
            {legend.map(r => (
              <div key={r.l} className="flex items-center gap-2">
                <span className="inline-block w-[9px] h-[9px]" style={{ background: r.c, border: r.c === T.up && mode === 'candle' ? '1px solid #fff' : undefined }} />
                <span className="text-[#d9d9d9] min-w-[170px] max-lg:min-w-[104px]">{r.l}</span>
                <span className="font-bold" style={{ color: r.c === tc('#9e9e9e') ? tc('#d9d9d9') : r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        )}
        {/* régua: resumo da medição (ou instrução enquanto falta o 2º ponto) */}
        {(ruler || rulerOn || pts.length === 1) && (
          <div data-gp-ruler-box className="absolute top-2 right-[78px] z-20 text-[12px] leading-[17px] px-2 py-1 max-lg:top-1 max-lg:right-[64px] max-lg:text-[11px] max-lg:leading-[15px] max-w-[60%]"
            style={{ background: tc('rgba(0,0,0,0.8)'), border: `1px solid ${ruler ? (ruler.up ? tc('#3ddc84') : tc('#FF4D4D')) : tc('#5a3d12')}` }}>
            {ruler ? (
              <>
                <div className="font-bold" style={{ color: ruler.up ? tc('#3ddc84') : tc('#FF4D4D') }}>
                  {ruler.abs > 0 ? '+' : ''}{nf(ruler.abs, dec)} ({ruler.pct == null ? '—' : `${ruler.pct > 0 ? '+' : ''}${nf(ruler.pct)}%`})
                </div>
                <div className="text-[#d9d9d9]">{df(ruler.from)} → {df(ruler.to)}</div>
                <div className="text-[#8a8a8a]">{nf(ruler.v0, dec)} → {nf(ruler.v1, dec)} · {ruler.sessions} {tf === 'd' ? L(ruler.sessions === 1 ? 'session' : 'sessions', ruler.sessions === 1 ? 'pregão' : 'pregões') : L('bars', 'barras')} · {ruler.days} {L('days', 'dias')}</div>
              </>
            ) : (
              <div className="text-[#d9d9d9]">{pts.length === 1 ? L('Pick the second point', 'Escolha o segundo ponto') : L('Click or tap two points on the chart', 'Clique ou toque em dois pontos do gráfico')} <span className="text-[#8a8a8a]">· Esc</span></div>
            )}
          </div>
        )}
        {/* eventos sob o cursor */}
        {hoverEvs.length > 0 && (
          <div data-gp-event-tip className="absolute bottom-[34px] left-2 z-20 pointer-events-none text-[11px] leading-[15px] px-2 py-1 max-w-[min(520px,90%)]" style={{ background: tc('rgba(0,0,0,0.85)'), border: '1px solid #3a3a3a' }}>
            {hoverEvs.slice(0, 6).map((e, i) => (
              <div key={i} className="truncate">
                <b style={{ color: tc(EVENT_KINDS[e.kind as EvKind].color) }}>{e.kind} · {L(EVENT_KINDS[e.kind as EvKind].en, EVENT_KINDS[e.kind as EvKind].pt)}</b>
                <span className="text-[#8a8a8a]"> {df(e.date)}</span> <span className="text-[#d9d9d9]">{e.text}</span>
              </div>
            ))}
            {hoverEvs.length > 6 && <div className="text-[#8a8a8a]">+{hoverEvs.length - 6}</div>}
          </div>
        )}
        {showVol && rows.length > 0 && (
          <div className="absolute left-2 z-10 pointer-events-none text-[11px] px-1" style={{ top: 'calc(78% + 4px)', color: tc('#d9d9d9'), background: tc('rgba(0,0,0,0.6)') }}>
            Volume <b>{obs?.volume ? vf(obs.volume) : '—'}</b>
          </div>
        )}
      </div>
    </div>
  )
}
