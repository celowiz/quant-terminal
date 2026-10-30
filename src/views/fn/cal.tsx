'use client'
/** CAL v2 — calendário de resultados do Ibovespa (sites de RI checados todo dia; reserva CVM). Só dados reais: "—" quando falta. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { FnScreen, Grid, type Col, Loading, C, dBR, dBRfull, useJSON, useDesktop, useFitH } from '../../components/fn/kit'
import { t } from '../../lib/i18n'
import { lang } from '../../lib/settings'
import { href } from '../../lib/static'
import { trackShare } from '../../lib/track'
import { toast } from '../../components/ShareMenu'

type Link = { date: string | null; link?: string | null; time?: string | null }
export type CalRow = {
  ticker: string; name: string; sector?: string | null; weight?: number | null; logo?: string | null; q: string
  date: string | null; time: string | null; timing: 'bmo' | 'amc' | null; source: 'RI' | 'CVM' | null; link: string | null
  status: 'expected' | 'confirmed' | 'released' | null; call?: Link | null; cvm_planned?: Link | null; filed?: Link | null
  ri_page?: string | null; ri_error?: string | null; stale?: boolean; checked_at?: string | null
}
type CalData = { generated_at: string; as_of: string; quarter: string; coverage: Record<string, number>; rows: CalRow[] }

const ST_COLOR: Record<string, string> = { expected: C.muted, confirmed: C.amber, released: C.up }

// ---------- datas (strings ISO, sem fuso) ----------
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
/** segunda-feira da semana; sábado/domingo pulam para a semana seguinte */
const mondayOf = (s: string) => { const wd = parse(s).getDay(); return addDays(s, wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd) }
const loc = () => (lang() === 'pt' ? 'pt-BR' : 'en-US')
const dayName = (s: string) => parse(s).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '')
const monthName = (s: string) => parse(s).toLocaleDateString(loc(), { month: 'long', year: 'numeric' })
const weekLabel = (mon: string) => {
  const fri = addDays(mon, 4), o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${parse(mon).toLocaleDateString(loc(), o)} – ${parse(fri).toLocaleDateString(loc(), o)} ${fri.slice(0, 4)}`.replace(/\./g, '')
}
const asOfLabel = (g?: string) => (!g ? '—' : `${dBRfull(g.slice(0, 10))} ${g.slice(11, 16)} BRT`)
/** empresas do dia em ordem de ticker (não há valor de mercado de todas no dado do calendário) */
const byTicker = (a: CalRow, b: CalRow) => a.ticker.localeCompare(b.ticker)

// ---------- peças ----------
const hue = (s: string) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
export function Logo({ r, size = 20 }: { r: CalRow; size?: number }) {
  const [bad, setBad] = useState(false)
  const box: React.CSSProperties = { width: size, height: size, minWidth: size, borderRadius: Math.round(size * 0.18) }
  if (!r.logo || bad)
    return <span aria-hidden className="inline-flex items-center justify-center font-bold"
      style={{ ...box, background: `hsl(${hue(r.ticker)} 45% 28%)`, color: '#fff', fontSize: Math.max(8, Math.round(size * 0.3)) }}>{r.ticker.slice(0, 4)}</span>
  return <span className="inline-flex items-center justify-center overflow-hidden" style={box}>
    <img src={href('/' + r.logo)} alt="" width={size} height={size} onError={() => setBad(true)} style={{ width: size, height: size, objectFit: 'contain' }} />
  </span>
}
export function Status({ s }: { s: CalRow['status'] }) {
  if (!s) return <span style={{ color: C.muted }}>—</span>
  return <span className="px-1 text-[10px] font-bold uppercase border whitespace-nowrap" style={{ color: ST_COLOR[s], borderColor: ST_COLOR[s], borderStyle: s === 'expected' ? 'dashed' : 'solid' }}>{t(`cal.st.${s}` as any)}</span>
}
const A = ({ to, children }: { to?: string | null; children: React.ReactNode }) =>
  to ? <a href={to} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-white" style={{ color: C.cyan }}>{children}</a> : <span style={{ color: C.muted }}>—</span>
const timeTxt = (r: CalRow) => {
  const tm = r.timing ? t(r.timing === 'bmo' ? 'cal.bmo' : 'cal.amc') : null
  return [r.time, tm].filter(Boolean).join(' · ') || '—'
}

/** card: logo em destaque + ticker embaixo; borda = status (tracejada = prevista) */
const cardDims = (size: number) => ({ w: size + 14, h: size + Math.max(12, Math.round(size * 0.26)) + 12 })
function Card({ r, size, sel, onPick }: { r: CalRow; size: number; sel?: boolean; onPick?: (r: CalRow) => void }) {
  const st = r.status ? ST_COLOR[r.status] : C.line, { w, h } = cardDims(size)
  return (
    <button type="button" onClick={() => onPick && onPick(r)} title={`${r.ticker} · ${r.name} · ${r.status ? t(`cal.st.${r.status}` as any) : '—'}`}
      className="flex flex-col items-center justify-center gap-[3px] border hover:bg-[#1a1205]"
      style={{ width: w, height: h, borderColor: sel ? C.white : st, borderStyle: r.status === 'expected' ? 'dashed' : 'solid', background: sel ? '#1a1205' : '#080808' }}>
      <Logo r={r} size={size} />
      <span className="font-bold leading-none" style={{ fontSize: Math.max(10, Math.round(size * 0.24)), color: r.status === 'released' ? C.up : C.white }}>{r.ticker}</span>
    </button>
  )
}

function useBox<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [sz, setSz] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSz(p => (p.w === el.clientWidth && p.h === el.clientHeight ? p : { w: el.clientWidth, h: el.clientHeight })))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...sz }
}

/** cards que cabem na célula; o excedente vira um card "+N" (abre a lista completa com rolagem interna ou chama onMore) */
function Cards({ rows, size, sel, onPick, onMore, all, gap = 4 }: { rows: CalRow[]; size: number; sel?: string | null; onPick?: (r: CalRow) => void; onMore?: () => void; all?: boolean; gap?: number }) {
  const { ref, w, h } = useBox<HTMLDivElement>()
  const [open, setOpen] = useState(false)
  const d = cardDims(size)
  const cap = Math.max(1, Math.floor((w + gap) / (d.w + gap))) * Math.max(1, Math.floor((h + gap) / (d.h + gap)))
  const cut = !all && !open && w > 0 && rows.length > cap
  const show = cut ? rows.slice(0, cap - 1) : rows
  return (
    <div ref={ref} className="h-full min-h-0 overflow-y-auto fn-strip">
      <div className="flex flex-wrap content-start" style={{ gap }}>
        {show.map(r => <Card key={r.ticker} r={r} size={size} sel={sel === r.ticker} onPick={onPick} />)}
        {cut && (
          <button type="button" onClick={() => (onMore ? onMore() : setOpen(true))} title={t('cal.showAll')}
            className="flex items-center justify-center border font-bold hover:bg-[#1a1205]" style={{ width: d.w, height: d.h, borderColor: C.amber, color: C.amber, fontSize: Math.max(11, Math.round(size * 0.3)) }}>
            +{rows.length - show.length}
          </button>
        )}
      </div>
    </div>
  )
}


/** colunas por dia: até 6 empresas → 1; 7–12 → 2; mais → 3 */
export const dayCols = (n: number) => (n <= 6 ? 1 : n <= 12 ? 2 : 3)

/** card fluido do dia: preenche a célula; sempre vertical (logo grande + ticker embaixo, sem nome) em 1, 2 ou 3 colunas.
 *  plain = exportação/captura: borda neutra, sem indicação de status. */
function DayCard({ r, w, h, sel, onPick, plain }: { r: CalRow; w: number; h: number; sel?: boolean; onPick?: (r: CalRow) => void; plain?: boolean }) {
  const st = plain ? C.line : r.status ? ST_COLOR[r.status] : C.line
  const logo = Math.max(20, Math.floor(Math.min(h - Math.max(14, h * 0.2) - 10, w - 12, 88)))
  const fs = Math.max(10, Math.min(18, Math.round(logo * 0.26)))
  return (
    <button type="button" data-cal-card="" onClick={() => onPick && onPick(r)} title={`${r.ticker} · ${r.name}${plain ? '' : ' · ' + (r.status ? t(`cal.st.${r.status}` as any) : '—')}`}
      className={`flex flex-col justify-center gap-[3px] items-center border hover:bg-[#1a1205] min-w-0 overflow-hidden`}
      style={{ width: '100%', height: h, borderColor: sel ? C.white : st, borderStyle: !plain && r.status === 'expected' ? 'dashed' : 'solid', background: sel ? '#1a1205' : '#080808' }}>
      <Logo r={r} size={logo} />
      <span className="min-w-0 flex flex-col items-center leading-tight">
        <span className="font-bold" style={{ fontSize: fs, color: !plain && r.status === 'released' ? C.up : C.white }}>{r.ticker}</span>
      </span>
    </button>
  )
}

/** empresas de um dia num grid de 1–3 colunas; os cards crescem para preencher a célula e, se não couberem, a célula rola */
function DayCards({ rows, sel, onPick, plain, minH = 54, fixedH }: { rows: CalRow[]; sel?: string | null; onPick?: (r: CalRow) => void; plain?: boolean; minH?: number; fixedH?: number }) {
  const { ref, w, h } = useBox<HTMLDivElement>()
  const gap = 4, cols = dayCols(rows.length), nRows = Math.ceil(rows.length / cols)
  const slots = cols === 1 ? Math.max(nRows, 4) : nRows
  const cw = w ? (w - gap * (cols - 1)) / cols : 0
  const fit = h ? (h - gap * (slots - 1)) / slots : minH
  const ch = fixedH ?? Math.floor(Math.max(minH, Math.min(fit, cols === 1 ? 110 : cw * 1.1, 140)))
  return (
    <div ref={ref} className="h-full min-h-0 overflow-y-auto fn-strip">
      {(w > 0 || fixedH) && (
        <div className="grid content-start" style={{ gap, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {rows.map(r => <DayCard key={r.ticker} r={r} w={cw || 120} h={ch} sel={sel === r.ticker} onPick={onPick} plain={plain} />)}
        </div>
      )}
    </div>
  )
}

function Detail({ r }: { r: CalRow | null }) {
  if (!r) return <div className="text-[12px] p-2" style={{ color: C.muted }}>{t('cal.pick')}</div>
  const kv = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-2 py-[2px] border-b" style={{ borderColor: '#1c1c1c' }}><span style={{ color: C.muted }}>{k}</span><span className="text-right">{v}</span></div>
  return (
    <div className="text-[12px] p-2 flex flex-col gap-1">
      <div className="flex items-center gap-3 mb-1"><Logo r={r} size={72} /><div className="min-w-0"><div className="text-[18px] font-bold" style={{ color: C.amber }}>{r.ticker}</div><div className="truncate">{r.name}</div></div></div>
      {kv(t('cal.sector'), r.sector || '—')}
      {kv(t('cal.date'), r.date ? `${dBRfull(r.date)} (${r.q})` : '—')}
      {kv(t('cal.time'), timeTxt(r))}
      {kv(t('cal.status'), <Status s={r.status} />)}
      {kv(t('cal.src'), r.source ? <A to={r.link}>{r.source === 'RI' ? t('cal.irSite') : 'CVM'}</A> : '—')}
      {kv(t('cal.call'), r.call?.date ? `${dBR(r.call.date)}${r.call.time ? ' ' + r.call.time : ''}` : '—')}
      {kv(t('cal.cvmPlanned'), r.cvm_planned?.date ? <A to={r.cvm_planned.link}>{dBR(r.cvm_planned.date)}</A> : '—')}
      {kv(t('cal.filed'), r.filed?.date ? <A to={r.filed.link}>{dBR(r.filed.date)}</A> : '—')}
      {r.stale && <div style={{ color: C.yellow }}>{t('cal.stale')} {dBR(r.checked_at)}</div>}
    </div>
  )
}

// ---------- semana: uma coluna por dia (seg–sex) ----------
function WeekBoard({ mon, byDate, sel, onPick, exporting }: { mon: string; byDate: Map<string, CalRow[]>; sel: string | null; onPick: (r: CalRow) => void; exporting: boolean }) {
  const desk = useDesktop()
  const bodyH = useFitH(600, 220)
  const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  const today = iso(new Date())
  const list = (d: string) => (byDate.get(d) || []).slice().sort(byTicker)
  const head = (d: string) => (
    <div className="px-2 py-1 font-bold flex justify-between items-baseline" style={{ background: d === today && !exporting ? C.amber : C.panel2, color: d === today && !exporting ? '#000' : C.amber, fontSize: exporting ? 16 : 12 }}>
      <span>{dayName(d).toUpperCase()} {dBR(d).slice(0, 5)}</span><span style={{ opacity: 0.75 }}>{list(d).length || '—'}</span>
    </div>
  )
  if (!desk && !exporting)
    return (
      <div className="flex flex-col gap-2">
        {days.map(d => (
          <div key={d} className="border" style={{ borderColor: d === today ? C.amber : C.line }}>
            {head(d)}
            {list(d).length > 0 && <div className="p-2"><DayCards rows={list(d)} sel={sel} onPick={onPick} fixedH={78} /></div>}
          </div>
        ))}
      </div>
    )
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', border: `1px solid ${C.line}` }}>
      {days.map((d, i) => (
        <div key={d} className={i ? 'border-l' : ''} style={{ borderColor: C.line }}>
          {head(d)}
          <div className="p-1 border-t" style={{ borderColor: C.line, height: exporting ? 640 : bodyH }}>
            <DayCards rows={list(d)} sel={exporting ? null : sel} onPick={onPick} plain={exporting} minH={exporting ? 40 : 54} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- mês (seg–sex) ----------
function MonthView({ month, byDate, onDay }: { month: string; byDate: Map<string, CalRow[]>; onDay: (d: string) => void }) {
  const cellH = useFitH(112, 56)
  const first = month + '-01', wd = parse(first).getDay()
  // semana que contém o dia 1 (se cair no fim de semana, começa na segunda seguinte)
  const s0 = wd >= 1 && wd <= 5 ? addDays(first, 1 - wd) : mondayOf(first)
  const weeks: string[][] = []
  for (let w = s0; w.slice(0, 7) <= month; w = addDays(w, 7)) weeks.push([0, 1, 2, 3, 4].map(i => addDays(w, i)))
  const today = iso(new Date())
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', border: `1px solid ${C.line}` }}>
      {weeks[0]?.map((d, i) => <div key={'h' + d} className={`px-2 py-1 text-[12px] font-bold text-center ${i ? 'border-l' : ''}`} style={{ borderColor: C.line, background: C.panel2, color: C.amber }}>{dayName(d).toUpperCase()}</div>)}
      {weeks.flat().map((d, i) => {
        const rs = (byDate.get(d) || []).slice().sort(byTicker), out = d.slice(0, 7) !== month
        return (
          <div key={d} className={`p-1 border-t flex flex-col ${i % 5 ? 'border-l' : ''}`} style={{ borderColor: C.line, height: cellH, opacity: out ? 0.35 : 1 }}>
            <button type="button" onClick={() => onDay(d)} className="text-left text-[11px] font-bold mb-[2px] hover:text-white shrink-0" style={{ color: d === today ? C.amber : C.muted }}>
              {d.slice(8)}{rs.length ? <span className="font-normal"> · {rs.length}</span> : null}
            </button>
            <div className="flex-1 min-h-0"><Cards rows={rs} size={30} gap={3} onPick={() => onDay(d)} onMore={() => onDay(d)} /></div>
          </div>
        )
      })}
    </div>
  )
}

const PANEL_KEY = 'qt.cal.panel'

export function CALView() {
  const { data, err } = useJSON<CalData>('calendar.json')
  const [tab, setTab] = useState(0)
  const [mon, setMon] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [sel, setSel] = useState<CalRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const [panel, setPanel] = useState(true)
  useEffect(() => { try { if (localStorage.getItem(PANEL_KEY) === '0') setPanel(false) } catch { /* sem storage */ } }, [])
  const togglePanel = () => setPanel(p => { try { localStorage.setItem(PANEL_KEY, p ? '0' : '1') } catch { /* sem storage */ } return !p })
  const [modal, setModal] = useState(false)
  const pick = (r: CalRow) => { setSel(r); if (!panel) setModal(true) }
  const board = useRef<HTMLDivElement | null>(null)
  const desk = useDesktop()
  const byDate = useMemo(() => {
    const m = new Map<string, CalRow[]>()
    for (const r of data?.rows || []) if (r.date) m.set(r.date, [...(m.get(r.date) || []), r])
    return m
  }, [data])
  const curMon = mon ?? mondayOf(iso(new Date()))
  const curMonth = month ?? curMon.slice(0, 7)
  if (!data) return <FnScreen code="CAL"><Loading err={err} /></FnScreen>
  const nDated = data.rows.filter(r => r.date).length
  const undated = data.rows.filter(r => !r.date).sort(byTicker)
  const nWeek = [0, 1, 2, 3, 4].reduce((a, i) => a + (byDate.get(addDays(curMon, i)) || []).length, 0)

  const exportPng = async () => {
    if (!board.current) return
    setExporting(true); toast(t('cal.exporting'), 8000)
    try {
      await new Promise<void>(r => window.setTimeout(r, 350))
      const { domToBlob } = await import('modern-screenshot')
      const blob = await domToBlob(board.current, { scale: 2, backgroundColor: '#000000' })
      if (!blob) throw new Error('empty')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `quant-terminal_CAL_week_${curMon}.png`
      document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast(t('cal.exported')); trackShare('image_download')
    } catch { toast(t('share.failed')) } finally { setExporting(false) }
  }

  const nav = (n: number) => tab === 1
    ? setMonth(addDays(curMonth + '-15', n * 30).slice(0, 7))
    : setMon(addDays(curMon, 7 * n))
  const btn = 'inline-flex items-center px-1 border hover:text-white'
  const right = tab === 2 ? null : (
    <>
      <button type="button" aria-label="previous" className={btn} style={{ borderColor: C.line, color: C.amber }} onClick={() => nav(-1)}><ChevronLeft className="w-4 h-4" /></button>
      <span className="font-bold" style={{ color: C.white }}>{tab === 1 ? monthName(curMonth + '-01') : weekLabel(curMon)}</span>
      <button type="button" aria-label="next" className={btn} style={{ borderColor: C.line, color: C.amber }} onClick={() => nav(1)}><ChevronRight className="w-4 h-4" /></button>
      <button type="button" className={btn + ' px-2'} style={{ borderColor: C.line, color: C.amber }} onClick={() => { setMon(null); setMonth(null) }}>{t('cal.today')}</button>
      {tab === 0 && <button type="button" className={btn + ' px-1'} style={{ borderColor: C.line, color: C.amber }} onClick={togglePanel} data-capture-hide=""
        aria-pressed={panel} aria-label={t(panel ? 'cal.hidePanel' : 'cal.showPanel')} title={t(panel ? 'cal.hidePanel' : 'cal.showPanel')}>
        {panel ? <PanelRightClose className="w-4 h-4" aria-hidden /> : <PanelRightOpen className="w-4 h-4" aria-hidden />}</button>}
      {tab === 0 && <button type="button" className={btn + ' gap-1 px-2'} style={{ borderColor: C.amber, color: C.amber }} onClick={exportPng} aria-label={t('cal.export')} title={t('cal.export')} data-capture-hide=""><Download className="w-3.5 h-3.5" aria-hidden /><span className="max-lg:hidden">{t('cal.export')}</span></button>}
    </>
  )
  const asOf = `${t('cal.asOf')} ${asOfLabel(data.generated_at)} · ${data.quarter} ${t('cal.season')} · ${nDated}/${data.rows.length} ${t('cal.withDate')}`
  const legend = (
    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: C.muted }}>
      {(['expected', 'confirmed', 'released'] as const).map(s => <span key={s} data-capture-hide=""><Status s={s} /></span>)}
      <span className="ml-auto lg:hidden">{asOf}</span>
    </div>
  )
  const list = [...data.rows].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || byTicker(a, b))
  const cols: Col<CalRow>[] = [
    { k: 'logo', label: '', fmt: (_v: any, r: CalRow) => <Logo r={r} size={28} /> },
    { k: 'ticker', label: 'Ticker', fmt: (_v: any, r: CalRow) => <span className="font-bold" style={{ color: C.amber }}>{r.ticker}</span> },
    { k: 'name', label: t('cal.company'), fmt: (_v: any, r: CalRow) => r.name },
    { k: 'sector', label: t('cal.sector'), fmt: (_v: any, r: CalRow) => r.sector || '—' },
    { k: 'date', label: t('cal.date'), fmt: (_v: any, r: CalRow) => r.date ? `${dayName(r.date)} ${dBR(r.date)}` : '—' },
    { k: 'time', label: t('cal.time'), fmt: (_v: any, r: CalRow) => timeTxt(r) },
    { k: 'status', label: t('cal.status'), fmt: (_v: any, r: CalRow) => <Status s={r.status} /> },
    { k: 'src', label: t('cal.src'), fmt: (_v: any, r: CalRow) => r.source ? <A to={r.link}>{r.source}</A> : '—' },
    { k: 'call', label: t('cal.call'), fmt: (_v: any, r: CalRow) => r.call?.date ? `${dBR(r.call.date)}${r.call.time ? ' ' + r.call.time : ''}` : '—' },
    { k: 'cvm', label: t('cal.cvmPlanned'), fmt: (_v: any, r: CalRow) => r.cvm_planned?.date ? <A to={r.cvm_planned.link}>{dBR(r.cvm_planned.date)}</A> : '—' },
    { k: 'filed', label: t('cal.filed'), fmt: (_v: any, r: CalRow) => r.filed?.date ? <A to={r.filed.link}>{dBR(r.filed.date)}</A> : '—' },
  ]
  return (
    <FnScreen code="CAL" tabs={[t('cal.tabWeek'), t('cal.tabMonth'), t('cal.tabList')]} tab={tab} setTab={setTab} right={right} note={asOf}>
      <div className="flex flex-col gap-2">
        {legend}
        {tab === 0 && (
          <div className="flex gap-2 max-lg:flex-col">
            <div ref={board} className="relative flex-1 min-w-0" style={exporting ? { width: 1600, minWidth: 1600, background: '#000', padding: 20 } : undefined}>
              {exporting && <div className="flex items-baseline justify-between mb-3"><span className="text-[24px] font-bold" style={{ color: C.amber }}>{t('cal.title')} · {data.quarter}</span><span className="text-[18px] font-bold" style={{ color: C.white }}>{weekLabel(curMon)}</span></div>}
              <WeekBoard mon={curMon} byDate={byDate} sel={sel?.ticker ?? null} onPick={pick} exporting={exporting} />
              {!nWeek && <div className="text-[12px] mt-1" style={{ color: C.muted }}>{t('cal.noEvents')}</div>}
              {!exporting && undated.length > 0 && (
                <div className="mt-2 border flex items-center gap-2 p-1 max-lg:flex-col max-lg:items-start" style={{ borderColor: C.line }}>
                  <span className="px-1 text-[12px] font-bold whitespace-nowrap" style={{ color: C.amber }}>{t('cal.none')} · {undated.length}</span>
                  <div className="flex flex-wrap gap-1">{undated.map(r => <Card key={r.ticker} r={r} size={desk ? 28 : 40} sel={sel?.ticker === r.ticker} onPick={pick} />)}</div>
                </div>
              )}
              {exporting && <>
                <div className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: C.muted }}>
                  <span>{asOf}</span><span className="ml-auto">{t('fn.edu')}</span>
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: 0.07 }}>
                  <span className="text-[200px] font-bold" style={{ color: C.white, transform: 'rotate(-12deg)' }}>celowiz</span></div>
                <div className="text-right text-[14px] font-bold mt-1" style={{ color: C.amber }}>celowiz · quant-terminal</div>
              </>}
            </div>
            {panel && (desk || sel) && <div data-cal-panel="" className="border lg:w-[260px] shrink-0" style={{ borderColor: C.line, background: C.panel }}><Detail r={sel} /></div>}
          </div>
        )}
        {modal && sel && !panel && (
          <div data-capture-hide="" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70" onClick={() => setModal(false)}>
            <div role="dialog" aria-modal="true" aria-label={sel.ticker} className="relative border w-[min(92vw,360px)]" style={{ borderColor: C.amber, background: C.panel }} onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') setModal(false) }}>
              <button type="button" autoFocus aria-label={t('cal.close')} className="absolute right-1 top-1 hover:text-white" style={{ color: C.amber }} onClick={() => setModal(false)}><X className="w-4 h-4" /></button>
              <Detail r={sel} />
            </div>
          </div>
        )}
        {tab === 1 && <MonthView month={curMonth} byDate={byDate} onDay={d => { setMon(mondayOf(d)); setTab(0) }} />}
        {tab === 2 && <Grid<CalRow> cols={cols} rows={list} maxH={560} />}
      </div>
    </FnScreen>
  )
}
