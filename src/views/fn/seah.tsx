'use client'
// SEAH: mapa de calor de sazonalidade (mensal, semanal ISO e dia da semana) a partir dos fechamentos diários ajustados.
// Cálculo em lib/seasonality.mjs (testado); aqui só a apresentação.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { tc } from '../../lib/themeRuntime'
import { lang } from '../../lib/settings'
import { FnScreen, Btns, Loading, C, nf } from '../../components/fn/kit'
import { usePrices } from './tech'
import { monthly, weekly, dayOfWeek, NEAR0, type SStats, type SCell } from '../../lib/seasonality.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const MONTHS = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] }
const DOWS = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] }
const DOW_ZERO = 0.01 // faixa neutra das médias diárias (escala bem menor que a dos meses)
const SHORT_MONTHS = 24
const DIM_N = 5

function useMedia(q: string) {
  const [m, setM] = useState(false)
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); f(); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f) }, [q])
  return m
}

const GREEN = (a: number) => `rgba(61,220,132,${a})`
const RED = (a: number) => `rgba(255,77,77,${a})`
const GREY = 'rgba(128,128,128,0.32)'
export const heat = (v: number | null | undefined, s: number, z = NEAR0) => {
  if (v == null || !Number.isFinite(v)) return 'transparent'
  if (Math.abs(v) < z) return GREY
  const a = 0.12 + Math.min(1, Math.abs(v) / s) * 0.75
  return v > 0 ? GREEN(a) : RED(a)
}
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${nf(v, d)}%`)
const STRIPES = 'repeating-linear-gradient(135deg, rgba(0,0,0,0.38) 0 3px, transparent 3px 7px)'

type Row = { label: string; cells: SCell[]; best: number; worst: number; total?: { v: number | null; tag: string | null } }
type TableProps = {
  cols: string[]; show: number[]; rows: Row[]; stats: SStats[]; totalStats?: SStats; best: number; worst: number
  scale: number; totalScale?: number; zero?: number; compact: boolean; narrow: boolean; tiny?: boolean; shortLabels: boolean; partLabel: string
  head: string; nUnit: string; digits?: number
}

function HeatTable(p: TableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [sc, setSc] = useState({ more: false, any: false })
  const upd = () => { const e = ref.current; if (!e) return; const any = e.scrollWidth > e.clientWidth + 1; setSc({ any, more: any && e.scrollLeft + e.clientWidth < e.scrollWidth - 2 }) }
  useEffect(() => { upd(); const e = ref.current; if (!e || typeof ResizeObserver === 'undefined') return; const o = new ResizeObserver(upd); o.observe(e); return () => o.disconnect() })
  const pad = p.tiny ? 'px-[3px] text-[10px]' : p.narrow ? 'px-[2px] text-[11px]' : p.compact ? 'px-[4px] text-[11px]' : 'px-2 text-[12px]'
  const td = `${pad} py-[3px] text-right border border-[#1a1a1a] whitespace-nowrap`
  const stick: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: C.panel }
  const stickR: React.CSSProperties = { position: 'sticky', right: 0, zIndex: 2 }
  const hasTotal = p.rows.some(r => r.total)
  const cellTitle = (row: string, col: string, c: SCell) => c ? `${row} ${col}: ${pct(c.r, 2)}${c.n != null ? ` · n=${c.n}` : ''}${c.part ? ` — ${p.partLabel}: ${L('partial, not in statistics', 'parcial, fora das estatísticas')}` : ''}` : `${row} ${col}: ${L('no data', 'sem dados')}`
  const outline = (best: boolean, worst: boolean): React.CSSProperties => best ? { outline: `2px solid ${tc('#ffffff')}`, outlineOffset: -2 } : worst ? { outline: `2px dotted ${tc('#ffffff')}`, outlineOffset: -2 } : {}
  const SL = p.shortLabels
    ? [['n', 'n', 'n'], [L('Avg', 'Méd'), 'mean'], [L('Med', 'Mdn'), 'median'], [L('SD', 'DP'), 'sd'], ['%+', 'pos']]
    : [[`n (${p.nUnit})`, 'n'], [L('Average', 'Média'), 'mean'], [L('Median', 'Mediana'), 'median'], [L('Std. dev.', 'Desvio-padrão'), 'sd'], [L('% positive', '% positivos'), 'pos']]
  const statCell = (s: SStats | undefined, k: string, i: number | 'total') => {
    if (!s) return <td key={String(i)} className={td} />
    const dim = s.n < DIM_N
    const v = (s as any)[k] as number | null
    const mark = k === 'mean' && i !== 'total' ? (i === p.best ? ' ▲' : i === p.worst ? ' ▼' : '') : ''
    const txt = k === 'n' ? String(s.n) : v == null ? '—' : k === 'pos' ? `${nf(v, 0)}%` : k === 'sd' ? nf(v, 1) : `${v > 0 ? '+' : ''}${nf(v, p.tiny ? 1 : 2)}`
    const color = k === 'n' ? C.muted : v == null ? C.muted : k === 'pos' ? (v >= 50 ? C.up : C.down) : k === 'sd' ? C.text : v > 0 ? C.up : v < 0 ? C.down : C.text
    return <td key={String(i)} data-seah-stat={k} data-dim={dim ? 1 : undefined} className={td} title={dim ? L(`only ${s.n} observation(s): not meaningful`, `só ${s.n} observação(ões): pouco significativo`) : undefined}
      style={{ color, opacity: dim ? 0.45 : 1, ...(mark ? outline(mark === ' ▲', mark === ' ▼') : {}), ...(i === 'total' ? { ...stickR, background: tc('#151515') } : {}) }}>{txt}{mark}</td>
  }
  return (
    <div className="relative">
      {sc.any && <div data-seah-hint className="text-[11px] pb-1" style={{ color: C.muted }}>{L('Scroll sideways for more columns →', 'Role para o lado para ver mais colunas →')}</div>}
      <div ref={ref} onScroll={upd} className="overflow-x-auto" data-seah-scroll>
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead><tr>
            <th className={`${pad} py-1 text-left font-normal`} style={{ ...stick, color: C.amber }}>{p.head}</th>
            {p.show.map(i => <th key={i} className={`${pad} py-1 text-right font-normal`} style={{ color: C.amber }}>{p.cols[i]}</th>)}
            {hasTotal && <th className={`${pad} py-1 text-right font-normal`} style={{ ...stickR, background: C.panel, color: C.amber }}>{L('Year', 'Ano')}</th>}
          </tr></thead>
          <tbody>
            {p.rows.map(r => (
              <tr key={r.label}>
                <td className={`${pad} py-[3px]`} style={{ ...stick, color: C.amber }}>{r.label}</td>
                {p.show.map(i => {
                  const c = r.cells[i]
                  const v = c?.r
                  return <td key={i} data-seah-cell={`${r.label}-${i}`} data-part={c?.part || undefined} data-best={i === r.best ? 1 : undefined} data-worst={i === r.worst ? 1 : undefined}
                    className={td} title={cellTitle(r.label, p.cols[i], c)}
                    style={{ background: heat(v, p.scale, p.zero), backgroundImage: c?.part ? STRIPES : undefined, color: c ? tc('#fff') : C.muted, fontStyle: c?.part ? 'italic' : undefined, ...outline(i === r.best, i === r.worst) }}>
                    {c ? nf(v, p.digits ?? 1) : '—'}{c?.part ? <span className="block text-[8px] leading-[9px] not-italic" style={{ color: C.amber }}>{p.partLabel}</span> : null}
                  </td>
                })}
                {hasTotal && (() => {
                  const t = r.total
                  const tag = t?.tag === 'ytd' ? 'YTD' : t?.tag === 'partial' ? L('partial', 'parcial') : null
                  return <td data-seah-total={r.label} data-tag={t?.tag || undefined} className={td} title={tag ? `${r.label}: ${tag} — ${L('not in the Year statistics', 'fora das estatísticas do Ano')}` : undefined}
                    style={{ ...stickR, background: `linear-gradient(${heat(t?.v, p.totalScale || 30)}, ${heat(t?.v, p.totalScale || 30)}), ${C.panel}`, color: tc('#fff'), fontWeight: 700 }}>
                    {t?.v == null ? '—' : nf(t.v, 1)}{tag ? <span className="block text-[8px] leading-[9px] font-normal" style={{ color: C.amber }}>{tag}</span> : null}
                  </td>
                })()}
              </tr>
            ))}
            {SL.map(([label, k]) => (
              <tr key={k} style={{ background: tc('#151515') }}>
                <td className={`${pad} py-[3px] font-bold whitespace-nowrap`} style={{ ...stick, background: tc('#151515'), color: C.amber }}>{label}</td>
                {p.show.map(i => statCell(p.stats[i], k, i))}
                {hasTotal && statCell(p.totalStats, k, 'total')}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sc.more && <div aria-hidden data-seah-fade className="pointer-events-none absolute top-0 bottom-0 right-0 w-8" style={{ background: `linear-gradient(to right, transparent, ${C.bg || '#000'})` }} />}
    </div>
  )
}

function Legend({ scale, zero, totalScale, part, unit }: { scale: number; zero: number; totalScale?: number; part?: string; unit: string }) {
  const sw = (bg: string, extra: React.CSSProperties = {}) => <span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: bg, ...extra }} />
  return (
    <div data-seah-legend className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[11px]" style={{ color: C.muted }}>
      <span className="flex items-center gap-1">{pct(-scale, scale < 1 ? 1 : 0)}<span className="inline-block h-2 w-24" style={{ background: `linear-gradient(to right, ${RED(0.87)}, ${RED(0.12)}, ${GREY}, ${GREEN(0.12)}, ${GREEN(0.87)})` }} />{pct(scale, scale < 1 ? 1 : 0)}{totalScale ? <span className="ml-1">({L('Year', 'Ano')} ±{totalScale}%)</span> : null}</span>
      <span>{sw(GREY)}|r| &lt; {nf(zero, 2)}%</span>
      {part && <span>{sw(GREEN(0.5), { backgroundImage: STRIPES })}{part} = {L('partial, not in statistics', 'parcial, fora das estatísticas')}</span>}
      <span>{sw('transparent', { outline: `2px solid ${tc('#ffffff')}`, outlineOffset: -2 })}{L(`best ${unit} of the year`, `melhor ${unit} do ano`)}</span>
      <span>{sw('transparent', { outline: `2px dotted ${tc('#ffffff')}`, outlineOffset: -2 })}{L(`worst ${unit} of the year`, `pior ${unit} do ano`)}</span>
      <span>▲/▼ {L('best/worst average', 'melhor/pior média')}</span>
      <span style={{ opacity: 0.6 }}>{L(`dimmed = n < ${DIM_N}`, `esmaecido = n < ${DIM_N}`)}</span>
    </div>
  )
}

export function SEAHView({ ticker }: { ticker: string }) {
  const { rows, err } = usePrices(ticker)
  const [tab, setTab] = useState(0)
  const [half, setHalf] = useState<'H1' | 'H2' | 'ALL'>('H1')
  const [incl, setIncl] = useState(false)
  const narrow = useMedia('(max-width: 390px)')
  const small = useMedia('(max-width: 767px)')
  const mid = useMedia('(max-width: 1023px)')
  const pt = lang() === 'pt'
  const calc = useMemo(() => {
    if (!rows?.length) return null
    const R = rows.map(r => ({ time: r.time, close: r.close }))
    // pregões em fim de semana (cripto 24/7) mudam o último dia esperado do mês/semana
    const allDays = R.some(r => { const d = new Date(r.time + 'T00:00:00Z').getUTCDay(); return d === 0 || d === 6 })
    return { M: monthly(R, { allDays, includePartial: incl }), W: weekly(R, { allDays, includePartial: incl }), D: dayOfWeek(R) }
  }, [rows, incl])
  const note = L(
    'Monthly, weekly (ISO week) and day-of-week returns from adjusted daily closes. The current month/week is partial (MTD/WTD), marked and kept out of the statistics by default. Statistics rows: n, average, median, sample standard deviation (n ≥ 2) and % positive; dimmed when n < 5. Past seasonality does not predict future returns.',
    'Retornos mensais, semanais (semana ISO) e por dia da semana a partir dos fechamentos diários ajustados. O mês/semana corrente é parcial (MTD/WTD), fica marcado e, por padrão, fora das estatísticas. Linhas de estatística: n, média, mediana, desvio-padrão amostral (n ≥ 2) e % positivos; esmaecidas quando n < 5. Sazonalidade passada não prevê retornos futuros.')
  const tabs = [L('Monthly', 'Mensal'), L('Weekly', 'Semanal'), L('Day of week', 'Dia da semana')]
  if (!calc) return <FnScreen code="SEAH" ticker={ticker}><Loading err={err} /></FnScreen>
  const { M, W, D } = calc
  const h = narrow ? half : 'ALL'
  const range = (n: number, cut: number) => Array.from({ length: n }, (_, i) => i).filter(i => h === 'ALL' || (h === 'H1' ? i < cut : i >= cut))
  const partNow = tab === 0 ? (M.partial ? 'MTD' : null) : tab === 1 ? (W.partial ? 'WTD' : null) : null
  const right = <>
    {narrow && tab < 2 && <Btns opts={[{ v: 'H1', l: tab === 0 ? L('Jan–Jun', 'Jan–Jun') : L('Wk 1–26', 'Sem 1–26') }, { v: 'H2', l: tab === 0 ? L('Jul–Dec', 'Jul–Dez') : L('Wk 27–53', 'Sem 27–53') }, { v: 'ALL', l: L('All', 'Todos') }]} value={half} onChange={setHalf} />}
    {partNow && <Btns opts={[{ v: false, l: L(`Excl. ${partNow}`, `Sem ${partNow}`) }, { v: true, l: L(`Incl. ${partNow}`, `Com ${partNow}`) }]} value={incl} onChange={setIncl} />}
  </>
  const short = M.complete < SHORT_MONTHS
  const common = { compact: mid, narrow, shortLabels: small, head: L('Year', 'Ano') }
  return (
    <FnScreen code="SEAH" ticker={ticker} title={L('Seasonality Heatmap', 'Mapa de calor de sazonalidade')} tabs={tabs} tab={tab} setTab={setTab} right={right} note={note}>
      {short && <div data-seah-short className="mb-2 px-2 py-1 text-[12px] border" style={{ borderColor: C.amber, color: C.amber }}>
        {L(`Short history: ${M.complete} complete month(s) of data. With fewer than ${SHORT_MONTHS} months each column has only one or two observations, so the statistics are not meaningful yet.`,
          `Histórico curto: ${M.complete} mês(es) completo(s) de dados. Com menos de ${SHORT_MONTHS} meses cada coluna tem só uma ou duas observações, então as estatísticas ainda não são significativas.`)}
      </div>}
      {tab === 0 && <>
        <HeatTable {...common} cols={MONTHS[pt ? 'pt' : 'en']} show={range(12, 6)} scale={8} totalScale={30} partLabel="MTD" nUnit={L('years', 'anos')}
          rows={M.years.map(Y => ({ label: String(Y.y), cells: Y.cells, best: Y.best, worst: Y.worst, total: { v: Y.ret ?? null, tag: Y.tag ?? null } }))}
          stats={M.months} totalStats={M.year} best={M.best} worst={M.worst} />
        <Legend scale={8} zero={NEAR0} totalScale={30} part={M.partial ? 'MTD' : undefined} unit={L('month', 'mês')} />
      </>}
      {tab === 1 && <>
        <HeatTable {...common} tiny cols={Array.from({ length: 53 }, (_, i) => String(i + 1))} show={range(53, 26)} scale={4} partLabel="WTD" nUnit={L('years', 'anos')}
          rows={W.years.map(Y => ({ label: String(Y.y), cells: Y.cells, best: Y.best, worst: Y.worst }))} stats={W.weeks} best={W.best} worst={W.worst} />
        <div className="pt-1 text-[11px]" style={{ color: C.muted }}>{L('Columns = ISO week of the year (Monday to Sunday; week 1 holds the first Thursday). Week 53 exists only in some years.', 'Colunas = semana ISO do ano (segunda a domingo; a semana 1 contém a primeira quinta-feira). A semana 53 só existe em alguns anos.')}</div>
        <Legend scale={4} zero={NEAR0} part={W.partial ? 'WTD' : undefined} unit={L('week', 'semana')} />
      </>}
      {tab === 2 && <>
        <HeatTable {...common} cols={DOWS[pt ? 'pt' : 'en']} show={D.used} scale={0.5} zero={DOW_ZERO} partLabel="" digits={2} nUnit={L('days', 'dias')}
          rows={D.years.map(Y => ({ label: String(Y.y), cells: Y.cells, best: Y.best, worst: Y.worst }))} stats={D.days} best={D.best} worst={D.worst} />
        <div className="pt-1 text-[11px]" style={{ color: C.muted }}>{L(`Cells = average daily return (%) of that weekday in the year (n in the tooltip). Statistics rows pool all ${D.n} daily returns; a Monday return includes the weekend.`, `Células = retorno diário médio (%) daquele dia da semana no ano (n na dica). As linhas de estatística reúnem todos os ${D.n} retornos diários; o retorno de segunda inclui o fim de semana.`)}</div>
        <Legend scale={0.5} zero={DOW_ZERO} unit={L('weekday', 'dia')} />
      </>}
    </FnScreen>
  )
}
