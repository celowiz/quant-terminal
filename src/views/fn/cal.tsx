'use client'
/** CAL v2 — calendário de resultados do Ibovespa (sites de RI checados todo dia; fallback CVM). Só dados reais: "—" quando falta. */
import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
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
const SLOTS = ['bmo', 'amc', 'tba'] as const
const slotOf = (r: CalRow) => (r.timing === 'bmo' ? 'bmo' : r.timing === 'amc' ? 'amc' : 'tba')

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

// ---------- peças ----------
const hue = (s: string) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
export function Logo({ r, size = 20 }: { r: CalRow; size?: number }) {
  const [bad, setBad] = useState(false)
  const box: React.CSSProperties = { width: size, height: size, minWidth: size, borderRadius: 3 }
  if (!r.logo || bad)
    return <span aria-hidden className="inline-flex items-center justify-center font-bold"
      style={{ ...box, background: `hsl(${hue(r.ticker)} 45% 28%)`, color: '#fff', fontSize: Math.max(7, size * 0.36) }}>{r.ticker.slice(0, 4)}</span>
  return <span className="inline-flex items-center justify-center overflow-hidden" style={{ ...box, background: '#fff' }}>
    <img src={href('/' + r.logo)} alt="" width={size - 2} height={size - 2} onError={() => setBad(true)} style={{ objectFit: 'contain', maxWidth: size - 2, maxHeight: size - 2 }} />
  </span>
}
export function Status({ s }: { s: CalRow['status'] }) {
  if (!s) return <span style={{ color: C.muted }}>—</span>
  return <span className="px-1 text-[10px] font-bold uppercase border" style={{ color: ST_COLOR[s], borderColor: ST_COLOR[s], borderStyle: s === 'expected' ? 'dashed' : 'solid' }}>{t(`cal.st.${s}` as any)}</span>
}
const A = ({ to, children }: { to?: string | null; children: React.ReactNode }) =>
  to ? <a href={to} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-white" style={{ color: C.cyan }}>{children}</a> : <span style={{ color: C.muted }}>—</span>
const timeTxt = (r: CalRow) => r.time ? `${r.time}${r.timing ? ' · ' + t(r.timing === 'bmo' ? 'cal.bmo' : 'cal.amc') : ''}` : r.timing ? t(r.timing === 'bmo' ? 'cal.bmo' : 'cal.amc') : '—'

function Chip({ r, sel, onPick, small }: { r: CalRow; sel: boolean; onPick: (r: CalRow) => void; small?: boolean }) {
  const st = r.status ? ST_COLOR[r.status] : C.muted
  return (
    <button type="button" onClick={() => onPick(r)} title={`${r.ticker} · ${r.name} · ${r.status ? t(`cal.st.${r.status}` as any) : '—'} (${r.source ?? '—'})`}
      className="inline-flex items-center gap-1 pr-1 border text-left hover:bg-[#1a1205]"
      style={{ borderColor: sel ? C.white : st, borderStyle: r.status === 'expected' ? 'dashed' : 'solid', background: sel ? '#1a1205' : '#080808' }}>
      <Logo r={r} size={small ? 14 : 20} />
      <span className={small ? 'text-[10px]' : 'text-[12px] font-bold'} style={{ color: r.status === 'released' ? C.up : C.white }}>{r.ticker}</span>
    </button>
  )
}

function Detail({ r }: { r: CalRow | null }) {
  if (!r) return <div className="text-[12px] p-2" style={{ color: C.muted }}>{t('cal.pick')}</div>
  const kv = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-2 py-[2px] border-b" style={{ borderColor: '#1c1c1c' }}><span style={{ color: C.muted }}>{k}</span><span className="text-right">{v}</span></div>
  return (
    <div className="text-[12px] p-2 flex flex-col gap-1">
      <div className="flex items-center gap-2"><Logo r={r} size={32} /><div><div className="font-bold" style={{ color: C.amber }}>{r.ticker}</div><div>{r.name}</div></div></div>
      {kv(t('cal.sector'), r.sector || '—')}
      {kv(t('cal.date'), `${dBRfull(r.date)} (${r.q})`)}
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

// ---------- semana (estilo board: seg–sex × antes/depois/a definir) ----------
function WeekBoard({ mon, byDate, sel, onPick, exporting }: { mon: string; byDate: Map<string, CalRow[]>; sel: string | null; onPick: (r: CalRow) => void; exporting: boolean }) {
  const desk = useDesktop()
  const rowH = useFitH(150, 60), tbaH = useFitH(250, 90)
  const days = [0, 1, 2, 3, 4].map(i => addDays(mon, i))
  const today = iso(new Date())
  const cell = (d: string, s: string) => (byDate.get(d) || []).filter(r => slotOf(r) === s).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  const label = (s: string) => t(s === 'bmo' ? 'cal.bmo' : s === 'amc' ? 'cal.amc' : 'cal.tba')
  if (!desk && !exporting)
    return (
      <div className="flex flex-col gap-2">
        {days.map(d => {
          const n = (byDate.get(d) || []).length
          return (
            <div key={d} className="border" style={{ borderColor: d === today ? C.amber : C.line }}>
              <div className="px-2 py-1 text-[12px] font-bold flex justify-between" style={{ background: C.panel2, color: C.amber }}><span>{dayName(d)} {dBR(d).slice(0, 5)}</span><span style={{ color: C.muted }}>{n || '—'}</span></div>
              {SLOTS.map(s => { const rs = cell(d, s); return rs.length ? (
                <div key={s} className="px-2 py-1"><div className="text-[10px] uppercase mb-1" style={{ color: C.muted }}>{label(s)}</div>
                  <div className="flex flex-wrap gap-1">{rs.map(r => <Chip key={r.ticker} r={r} sel={sel === r.ticker} onPick={onPick} />)}</div></div>) : null })}
            </div>
          )
        })}
      </div>
    )
  return (
    <div className="grid" style={{ gridTemplateColumns: `110px repeat(5, minmax(0, 1fr))`, border: `1px solid ${C.line}` }}>
      <div style={{ background: C.panel2 }} />
      {days.map(d => (
        <div key={d} className="px-2 py-1 text-[12px] font-bold border-l text-center" style={{ borderColor: C.line, background: d === today ? C.amber : C.panel2, color: d === today ? '#000' : C.amber }}>
          {dayName(d).toUpperCase()} {dBR(d).slice(0, 5)}
        </div>
      ))}
      {SLOTS.map(s => [
        <div key={s} className="px-2 py-1 text-[11px] font-bold uppercase border-t flex items-center" style={{ borderColor: C.line, color: s === 'tba' ? C.muted : C.white, background: C.panel }}>{label(s)}</div>,
        ...days.map(d => {
          const rs = cell(d, s)
          return (
            <div key={s + d} className="p-1 border-t border-l overflow-y-auto fn-strip" style={{ borderColor: C.line, height: exporting ? undefined : s === 'tba' ? tbaH : rowH, minHeight: exporting ? (s === 'tba' ? 160 : 70) : undefined }}>
              <div className="flex flex-wrap gap-1 content-start">{rs.map(r => <Chip key={r.ticker} r={r} sel={!exporting && sel === r.ticker} onPick={onPick} />)}</div>
            </div>
          )
        }),
      ])}
    </div>
  )
}

// ---------- mês (seg–sex) ----------
function MonthView({ month, byDate, onDay }: { month: string; byDate: Map<string, CalRow[]>; onDay: (d: string) => void }) {
  const cellH = useFitH(96, 44)
  const first = month + '-01', wd = parse(first).getDay()
  // semana que contém o dia 1 (se cair no fim de semana, começa na segunda seguinte)
  const s0 = wd >= 1 && wd <= 5 ? addDays(first, 1 - wd) : mondayOf(first)
  const weeks: string[][] = []
  for (let w = s0; w.slice(0, 7) <= month; w = addDays(w, 7)) weeks.push([0, 1, 2, 3, 4].map(i => addDays(w, i)))
  const today = iso(new Date())
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', border: `1px solid ${C.line}` }}>
      {weeks[0]?.map(d => <div key={'h' + d} className="px-2 py-1 text-[12px] font-bold text-center border-l first:border-l-0" style={{ borderColor: C.line, background: C.panel2, color: C.amber }}>{dayName(d).toUpperCase()}</div>)}
      {weeks.flat().map(d => {
        const rs = (byDate.get(d) || []).slice().sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)), out = d.slice(0, 7) !== month
        return (
          <button type="button" key={d} onClick={() => onDay(d)} className="p-1 border-t border-l text-left align-top overflow-hidden hover:bg-[#111]" style={{ borderColor: C.line, height: cellH, opacity: out ? 0.35 : 1 }}>
            <div className="text-[11px] font-bold mb-[2px]" style={{ color: d === today ? C.amber : C.muted }}>{d.slice(8)}{rs.length ? <span className="font-normal"> · {rs.length}</span> : null}</div>
            <div className="flex flex-wrap gap-[3px]">{rs.map(r => <span key={r.ticker} className="inline-flex items-center gap-[2px] text-[10px]" style={{ color: r.status ? ST_COLOR[r.status] : C.muted }}><Logo r={r} size={12} />{r.ticker}</span>)}</div>
          </button>
        )
      })}
    </div>
  )
}

export function CALView() {
  const { data, err } = useJSON<CalData>('calendar.json')
  const [tab, setTab] = useState(0)
  const [mon, setMon] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [sel, setSel] = useState<CalRow | null>(null)
  const [exporting, setExporting] = useState(false)
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
  const cov = data.coverage || {}
  const nWeek = [0, 1, 2, 3, 4].reduce((a, i) => a + (byDate.get(addDays(curMon, i)) || []).length, 0)

  const exportPng = async () => {
    if (!board.current) return
    setExporting(true); toast(t('cal.exporting'), 8000)
    try {
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
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
      {tab === 0 && <button type="button" className={btn + ' gap-1 px-2'} style={{ borderColor: C.amber, color: C.amber }} onClick={exportPng} data-capture-hide=""><Download className="w-3.5 h-3.5" aria-hidden />{t('cal.export')}</button>}
    </>
  )
  const asOf = <>{t('cal.asOf')} {asOfLabel(data.generated_at)} · {data.quarter} {t('cal.season')} · {cov.n ?? '—'} cos: {cov.ri_date ?? '—'} {t('cal.cov')} · {cov.cvm_only ?? '—'} {t('cal.covCvm')} · {cov.no_date ?? '—'} {t('cal.covNone')}</>
  const legend = (
    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: C.muted }}>
      {(['expected', 'confirmed', 'released'] as const).map(s => <span key={s} className="inline-flex items-center gap-1"><Status s={s} /><span>{t(s === 'expected' ? 'cal.cvmPlanned' : s === 'confirmed' ? 'cal.irSite' : 'cal.filed')}</span></span>)}
      <span className="ml-auto">{asOf}</span>
    </div>
  )
  const list = [...data.rows].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || (b.weight ?? 0) - (a.weight ?? 0))
  const cols: Col<CalRow>[] = [
    { k: 'logo', label: '', fmt: (_v: any, r: CalRow) => <Logo r={r} size={16} /> },
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
    <FnScreen code="CAL" tabs={[t('cal.tabWeek'), t('cal.tabMonth'), t('cal.tabList')]} tab={tab} setTab={setTab} right={right}
      source={t('cal.source')} note={t('cal.note')}>
      <div className="flex flex-col gap-2">
        {legend}
        {tab === 0 && (
          <div className="flex gap-2 max-lg:flex-col">
            <div ref={board} className="relative flex-1 min-w-0" style={exporting ? { width: 1400, background: '#000', padding: 16 } : undefined}>
              {exporting && <div className="flex items-baseline justify-between mb-2"><span className="text-[18px] font-bold" style={{ color: C.amber }}>{t('cal.title')} · {data.quarter}</span><span className="text-[14px]" style={{ color: C.white }}>{weekLabel(curMon)}</span></div>}
              <WeekBoard mon={curMon} byDate={byDate} sel={sel?.ticker ?? null} onPick={setSel} exporting={exporting} />
              {!nWeek && <div className="text-[12px] mt-1" style={{ color: C.muted }}>{t('cal.noEvents')}</div>}
              {exporting && <>
                <div className="flex justify-between mt-2 text-[11px]" style={{ color: C.muted }}><span>{asOf}</span><span>{t('fn.edu')}</span></div>
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: 0.07 }}>
                  <span className="text-[160px] font-bold" style={{ color: C.white, transform: 'rotate(-12deg)' }}>celowiz</span></div>
                <div className="absolute right-4 bottom-1 text-[12px] font-bold" style={{ color: C.amber }}>celowiz · quant-terminal</div>
              </>}
            </div>
            {(desk || sel) && <div className="border lg:w-[280px] shrink-0" style={{ borderColor: C.line, background: C.panel }}><Detail r={sel} /></div>}
          </div>
        )}
        {tab === 1 && <MonthView month={curMonth} byDate={byDate} onDay={d => { setMon(mondayOf(d)); setTab(0) }} />}
        {tab === 2 && <Grid<CalRow> cols={cols} rows={list} maxH={560} />}
      </div>
    </FnScreen>
  )
}
