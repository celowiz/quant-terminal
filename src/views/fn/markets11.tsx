'use client'
import { tc } from '../../lib/themeRuntime'
/** ECO (calendário econômico), GMM (movimentos macro globais), FXC (matriz de cruzamento), FXFC (projeções Focus de câmbio). Strings em inglês por tela. */
import React, { useEffect, useMemo, useState } from 'react'
import { fetchIbgeLive } from '@/lib/ibgeLive'
import { lang } from '@/lib/settings'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, useJSON, FnScreen, Panel, Grid, Btns, Field, Spark, useDesktop } from '@/components/fn/kit'
import { ecoPeriod, ecoUnit } from '@/lib/ecoPeriod.mjs'
import { n, sn, pc, bps, auto, cl, dUS, dUSfull, dShort, weekday, addDays, dayN, todaySP, Kpis, Loading2, Unavailable } from './fn11util'

// ======================= ECO =======================
const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
// país → nome EN/PT (ordem do filtro); só aparecem os países presentes no eco.json
const ECO_CTRY: [string, string, string][] = [
  ['BR', 'Brazil', 'Brasil'], ['US', 'United States', 'Estados Unidos'], ['EA', 'Euro area', 'Zona do euro'], ['DE', 'Germany', 'Alemanha'],
  ['FR', 'France', 'França'], ['IT', 'Italy', 'Itália'], ['ES', 'Spain', 'Espanha'], ['GB', 'United Kingdom', 'Reino Unido'],
  ['CA', 'Canada', 'Canadá'], ['MX', 'Mexico', 'México'], ['JP', 'Japan', 'Japão'], ['CN', 'China', 'China'], ['IN', 'India', 'Índia'], ['AU', 'Australia', 'Austrália'],
]
const WD_PT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const S_ECO = () => ({
  title: L('Economic Calendar', 'Calendário econômico'), country: L('Country', 'País'), all: L('All', 'Todos'), view: L('Importance', 'Importância'), week: L('Week', 'Semana'),
  imps: [{ v: 1, l: L('All', 'Todas') }, { v: 2, l: '●●+' }, { v: 3, l: '●●●' }],
  weeks: [{ v: -1, l: L('Prev', 'Anterior') }, { v: 0, l: L('This', 'Atual') }, { v: 1, l: L('Next', 'Próxima') }, { v: 9, l: L('All', 'Todas') }],
  c: { time: L('Date / time', 'Data / hora'), country: L('Ctry', 'País'), imp: L('Imp.', 'Imp.'), event: L('Event', 'Evento'), period: L('Period', 'Período'),
       survey: L('Survey', 'Expect.'), actual: L('Actual', 'Atual'), prior: L('Prior', 'Anterior'), unit: L('Unit', 'Unid.'), agency: L('Releaser', 'Divulgador') },
  empty: L('No releases in this window.', 'Nenhuma divulgação neste período.'), live: L('Brazil releases loaded live in the browser.', 'Divulgações do Brasil carregadas direto no navegador.'),
  liveNo: L('Brazil releases unavailable right now.', 'Divulgações do Brasil indisponíveis no momento.'), approx: L('≈ time approximate', '≈ horário aproximado'),
  allday: L('all day', 'dia todo'), count: L('events', 'eventos'), times: L('Times in Brasília time (BRT).', 'Horários de Brasília (BRT).'),
  imp3: (t: number) => L(`importance ${t} of 3`, `importância ${t} de 3`),
})
const fmtV = (v: any, u?: string) => v == null ? '' : n(v, u === 'US$ bn' || u === 'US$ mn' || u === 'R$ bn' ? 2 : Math.abs(+v) >= 100 ? 1 : 2)
const tierOf = (e: any) => e.tier ?? (e.key ? 3 : 1)
const actColor = (e: any) => e.survey != null && e.actual != null ? (e.actual > e.survey ? C.up : e.actual < e.survey ? C.down : C.white) : C.white
const Dots = ({ t, S }: { t: number; S: ReturnType<typeof S_ECO> }) =>
  <span title={`${t}/3`} aria-label={S.imp3(t)} style={{ color: t >= 3 ? C.amber : t === 2 ? C.text : C.muted }}>{'●'.repeat(t)}<span style={{ color: C.line }}>{'●'.repeat(3 - t)}</span></span>

/** ECO no celular/tablet (<1024px): um cartão por divulgação, sem rolagem horizontal. Nome do evento em destaque,
 *  linha de metadados (data/hora · país · importância · período · divulgador) e Expect./Atual/Anterior lado a lado. */
function EcoCards({ rows, S, pt, today, showSurvey, when }: { rows: any[]; S: ReturnType<typeof S_ECO>; pt: boolean; today: string; showSurvey: boolean; when: (e: any) => React.ReactNode }) {
  const lg = pt ? 'pt' : 'en'
  const val = (x: any, e: any) => x == null ? '—' : <>{fmtV(x, e.unit)}{e.unit ? <span style={{ color: C.muted }}> {ecoUnit(e.unit, lg)}</span> : null}</>
  let last = ''
  return (
    <ul data-eco-cards className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: '70vh', overscrollBehavior: 'contain' }}>
      {rows.map((e, i) => {
        const day = e.time.slice(0, 10), t = tierOf(e), first = day !== last; last = day
        const cells: [string, React.ReactNode, string][] = [
          ...(showSurvey ? [[S.c.survey, val(e.survey, e), C.purple] as [string, React.ReactNode, string]] : []),
          [S.c.actual, val(e.actual, e), actColor(e)], [S.c.prior, val(e.prior, e), C.text]]
        return (
          <li key={i} data-eco-card className="min-w-0 px-2 py-[6px] border-b"
            style={{ borderColor: tc('#1a1a1a'), borderTop: first ? `1px solid ${C.amberDim}` : undefined, background: day === today ? tc('#1a1405') : i % 2 ? tc('#0a0a0a') : 'transparent' }}>
            <div data-eco-title className="whitespace-normal break-words text-[13px] leading-[1.35]" style={{ color: t >= 3 ? C.amber : C.text, fontWeight: t >= 3 ? 700 : 400 }}>{(pt && e.event_pt) || e.event}</div>
            <div data-eco-meta className="mt-[2px] text-[11px] leading-[1.3] flex flex-wrap gap-x-[6px]" style={{ color: C.muted }}>
              {when(e)}<span>·</span><span style={{ color: e.country === 'BR' ? C.up : e.country === 'US' ? C.cyan : C.text }}>{e.country}</span><span>·</span><Dots t={t} S={S} />
              {e.period ? <><span>·</span><span>{ecoPeriod(e.period, lg)}</span></> : null}{e.agency ? <><span>·</span><span>{e.agency}</span></> : null}
            </div>
            <div data-eco-vals className="mt-[3px] grid gap-x-2 text-[12px] leading-[1.3]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
              {cells.map(([k, v, col]) => <div key={k} className="min-w-0 truncate"><span className="text-[10px] uppercase" style={{ color: C.muted }}>{k} </span><span style={{ color: col }}>{v}</span></div>)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ECOView() {
  const { data: d0, err } = useJSON<any>('eco.json')
  const [cty, setCty] = useState('All'), [imp, setImp] = useState(1), [wk, setWk] = useState(0)
  const [live, setLive] = useState<any[] | null | undefined>(undefined)
  const S = S_ECO(), pt = lang() === 'pt', lg = pt ? 'pt' : 'en'
  const desk = useDesktop()
  const today = todaySP()
  const noBR = !!d0 && !(d0.events as any[]).some(e => e.agency === 'IBGE')
  // eco.json sem o IBGE: completa a agenda do Brasil direto do navegador
  useEffect(() => { if (noBR) fetchIbgeLive(d0.from, d0.to, today).then(setLive) }, [noBR]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = useMemo(() => d0 && live?.length ? { ...d0, events: [...d0.events, ...live] } : d0, [d0, live])
  const ctys = useMemo(() => {
    const have = new Set(((d?.events || []) as any[]).map(e => e.country))
    return ECO_CTRY.filter(c => have.has(c[0]))
  }, [d])
  const v = useMemo(() => {
    if (!d) return null
    // semana de referência: segunda-feira da semana do próximo dia útil
    let ref = today; const wd = new Date(ref + 'T12:00:00Z').getUTCDay(); if (wd === 6) ref = addDays(ref, 2); if (wd === 0) ref = addDays(ref, 1)
    const mon = addDays(ref, -((new Date(ref + 'T12:00:00Z').getUTCDay() + 6) % 7))
    const a = wk === 9 ? '0000' : addDays(mon, 7 * wk), b = wk === 9 ? '9999' : addDays(mon, 7 * wk + 7)
    const ev = (d.events as any[]).filter(e => (cty === 'All' || e.country === cty) && tierOf(e) >= imp && e.time.slice(0, 10) >= a && e.time.slice(0, 10) < b)
      .sort((x, y) => x.time.slice(0, 10).localeCompare(y.time.slice(0, 10)) || (+!!y.allday - +!!x.allday) || x.time.localeCompare(y.time) || tierOf(y) - tierOf(x))
    return { ev, a, b: wk === 9 ? null : addDays(b, -1) }
  }, [d, cty, imp, wk, today])
  if (!d || !v) return <FnScreen code="ECO" title={S.title}><Loading2 err={err} /></FnScreen>
  const cName = (c: string) => { const x = ECO_CTRY.find(k => k[0] === c); return x ? (pt ? x[2] : x[1]) : c }
  const note = (pt && d.note_pt) || d.note || S.times
  // sem nenhuma expectativa nas linhas visíveis, a coluna some (a nota explica onde há consenso)
  const showSurvey = v.ev.some((e: any) => e.survey != null)
  const when = (e: any) => { const x = e.time; return <span className="whitespace-nowrap"><span style={{ color: C.muted }}>{pt ? WD_PT[new Date(x.slice(0, 10) + 'T12:00:00Z').getUTCDay()] : weekday(x)} </span>{dUS(x)} {e.allday ? <span style={{ color: C.muted }}>{S.allday}</span> : <span style={{ color: C.white }}>{x.slice(11, 16)}</span>}{e.time_approx && !e.allday ? <span style={{ color: C.muted }}>≈</span> : ''}</span> }
  let last = ''
  return (
    <FnScreen code="ECO" title={S.title}
      right={<>
        <Field label={S.week}><Btns opts={S.weeks} value={wk} onChange={setWk} /></Field>
        <Field label={S.country}>
          <select aria-label={S.country} value={cty} onChange={e => setCty(e.target.value)} className="bg-black border px-1 py-[1px] text-[12px] outline-none"
            style={{ borderColor: C.line, color: C.amber }}>
            <option value="All">{S.all}</option>
            {ctys.map(c => <option key={c[0]} value={c[0]}>{c[0]} · {pt ? c[2] : c[1]}</option>)}
          </select>
        </Field>
        <Field label={S.view}><Btns opts={S.imps} value={imp} onChange={setImp} /></Field>
      </>}
      note={<>{note}{d.note ? '' : ` ${S.approx}.`}{noBR && live !== undefined ? <> {live?.length ? S.live : S.liveNo}</> : null}</>}>
      <Panel title={`${wk === 9 ? `${dUS(d.from)} – ${dUS(d.to)}` : `${dShort(v.a)} – ${dShort(v.b)}`} · ${v.ev.length} ${S.count}`}>
        {!v.ev.length ? <div className="p-4 text-[12px]" style={{ color: C.muted }}>{S.empty}</div> :
          !desk ? <EcoCards rows={v.ev} S={S} pt={pt} today={today} showSurvey={showSurvey} when={when} /> :
          <Grid maxH={640} rows={v.ev} rowStyle={(e: any) => { const day = e.time.slice(0, 10); const st: any = day === today ? { background: tc('#1a1405') } : {}; if (day !== last) { last = day; st.borderTop = `1px solid ${C.amberDim}` } return st }} cols={[
            { k: 'time', label: S.c.time, fmt: (_x, e: any) => when(e) },
            { k: 'country', label: S.c.country, align: 'c', fmt: (x: any) => <span title={cName(x)}>{x}</span>, color: x => x === 'BR' ? C.up : x === 'US' ? C.cyan : C.text },
            { k: 'tier', label: S.c.imp, align: 'c', fmt: (_x, e: any) => <Dots t={tierOf(e)} S={S} /> },
            { k: 'event', label: S.c.event, fmt: (x, e: any) => <span style={{ color: tierOf(e) >= 3 ? C.amber : C.text }}>{(pt && e.event_pt) || x}</span> },
            { k: 'period', label: S.c.period, fmt: (x: any) => <span className="whitespace-nowrap" title={x || undefined}>{ecoPeriod(x, lg)}</span>, color: () => C.muted },
            ...(showSurvey ? [{ k: 'survey', label: S.c.survey, align: 'r' as const, fmt: (x: any, e: any) => fmtV(x, e.unit), color: () => C.purple }] : []),
            { k: 'actual', label: S.c.actual, align: 'r', fmt: (x, e: any) => fmtV(x, e.unit), color: (_x, e: any) => actColor(e) },
            { k: 'prior', label: S.c.prior, align: 'r', fmt: (x, e: any) => fmtV(x, e.unit) },
            { k: 'unit', label: S.c.unit, fmt: (x: any) => ecoUnit(x, lg), color: () => C.muted },
            { k: 'agency', label: S.c.agency, color: () => C.muted },
          ]} />}
      </Panel>
    </FnScreen>
  )
}

// ======================= GMM =======================
const S_GMM = { title: 'Global Macro Movers', metric: 'Change', c: { name: 'Name', last: 'Last', chg: 'Chg', spark: '30D', date: 'Date' }, ms: [{ v: 'd1', l: '1D' }, { v: 'w1', l: '1W' }, { v: 'mtd', l: 'MTD' }, { v: 'ytd', l: 'YTD' }], sort: 'Sort', sorts: [{ v: 'def', l: 'Default' }, { v: 'abs', l: '|Move|' }], best: 'Top gainer', worst: 'Top loser' }
export function GMMView() {
  const { data: d, err } = useJSON<any>('gmm.json')
  const [m, setM] = useState<'d1' | 'w1' | 'mtd' | 'ytd'>('d1'), [srt, setSrt] = useState('def')
  const S = S_GMM
  if (!d) return <FnScreen code="GMM" title={S.title}><Loading2 err={err} /></FnScreen>
  const fmtC = (t: any) => t[m] == null ? '—' : t.kind === 'bp' ? `${bps(t[m], 0)}bp` : pc(t[m], 2)
  const all = (d.groups as any[]).flatMap(g => g.tiles.filter((t: any) => t.kind === 'pct' && t[m] != null))
  const best = all.reduce((a: any, b: any) => !a || b[m] > a[m] ? b : a, null), worst = all.reduce((a: any, b: any) => !a || b[m] < a[m] ? b : a, null)
  return (
    <FnScreen code="GMM" title={S.title}
      right={<><Field label={S.metric}><Btns opts={S.ms} value={m} onChange={setM} /></Field><Field label={S.sort}><Btns opts={S.sorts} value={srt} onChange={setSrt} /></Field></>}
      source={d.source} note={d.note}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        {(d.groups as any[]).map(g => {
          const rows = srt === 'abs' ? g.tiles.slice().sort((a: any, b: any) => Math.abs(b[m] ?? 0) - Math.abs(a[m] ?? 0)) : g.tiles
          const mx = Math.max(1e-9, ...g.tiles.map((t: any) => Math.abs(t[m] ?? 0)))
          return <Panel key={g.group} title={g.group}>
            <Grid maxH={330} rows={rows} cols={[
              { k: 'name', label: S.c.name, color: () => C.amber },
              { k: 'last', label: S.c.last, align: 'r', fmt: (x, t: any) => t.kind === 'bp' ? n(x, 3) : auto(x), color: () => C.white },
              { k: 'chg', label: `${S.c.chg} ${S.ms.find(o => o.v === m)!.l}`, align: 'r', fmt: (_, t: any) => fmtC(t), color: (_, t: any) => cl(t[m]) },
              { k: 'bar', label: '', fmt: (_, t: any) => { const v = t[m] ?? 0, w = Math.round(Math.abs(v) / mx * 40); return <span className="inline-flex w-[84px]"><span className="w-[42px] flex justify-end">{v < 0 && <span style={{ width: w, height: 8, background: C.down, display: 'inline-block' }} />}</span><span className="w-[42px]">{v > 0 && <span style={{ width: w, height: 8, background: C.up, display: 'inline-block' }} />}</span></span> } },
              { k: 'spark', label: S.c.spark, fmt: (x, t: any) => <Spark data={x || []} w={80} h={14} color={cl(t[m])} /> },
              { k: 'date', label: S.c.date, fmt: x => dUS(x), color: () => C.muted },
            ]} />
          </Panel>
        })}
      </div>
      {best && worst && <div className="mt-2 text-[12px]" style={{ color: C.muted }}>{S.best}: <span style={{ color: C.up }}>{best.name} {pc(best[m])}</span> · {S.worst}: <span style={{ color: C.down }}>{worst.name} {pc(worst[m])}</span></div>}
    </FnScreen>
  )
}

// ======================= FXC =======================
const S_FXC = { title: 'Currency Cross Rates', mode: 'Mode', modes: [{ v: 'last', l: 'Last' }, { v: 'd1', l: '1D %' }, { v: 'w1', l: '1W %' }], ptax: 'PTAX (BRL per unit)', c: { ccy: 'Ccy', buy: 'Buy', sell: 'Sell', chg: '1D %', date: 'Date', spark: '60D vs USD' }, base: 'Row → column: units of column per 1 row', usd: 'vs USD (units per USD)' }
export function FXCView() {
  const { data: d, err } = useJSON<any>('fxc.json')
  const [mode, setMode] = useState<'last' | 'd1' | 'w1'>('last'), [hi, setHi] = useState<string | null>(null)
  const S = S_FXC
  if (!d) return <FnScreen code="FXC" title={S.title}><Loading2 err={err} /></FnScreen>
  const u = (o: any, c: string) => c === 'USD' ? 1 : o?.[c]
  const cross = (o: any, r: string, c: string) => u(o, r) && u(o, c) ? u(o, c) / u(o, r) : null
  const val = (r: string, c: string) => {
    const x = cross(d.usd_per, r, c); if (mode === 'last' || x == null) return x
    const p = cross(mode === 'd1' ? d.usd_per_prev : d.usd_per_week, r, c); return p ? (x / p - 1) * 100 : null
  }
  const ccys: string[] = d.ccys
  return (
    <FnScreen code="FXC" title={S.title} right={<Field label={S.mode}><Btns opts={S.modes} value={mode} onChange={setMode} /></Field>} source={d.source} note={d.note}>
      <Kpis items={[['Date', dUSfull(d.date), C.white], ['Prev', dUSfull(d.prev_date)], ['1W ref', dUSfull(d.week_date)], ['USD/BRL', auto(d.usd_per.BRL), C.amber], ['EUR/USD', auto(cross(d.usd_per, 'EUR', 'USD')), C.amber], ['USD/JPY', auto(d.usd_per.JPY), C.amber]]} />
      <Panel title={`${S.modes.find(x => x.v === mode)!.l} · ${S.base}`}>
        <div className="overflow-auto fn-scroll" style={{ maxHeight: 480 }}>
          <table className="w-full text-[12px] border-collapse" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr><th className="sticky top-0 left-0 z-20 px-1 text-left" style={{ background: C.panel2, color: C.muted }}>↓/→</th>
              {ccys.map(c => <th key={c} className="sticky top-0 z-10 px-1 text-right" style={{ background: C.panel2, color: hi === c ? C.white : C.amber }}>{c}</th>)}</tr></thead>
            <tbody>{ccys.map(r => <tr key={r} onMouseEnter={() => setHi(r)} style={{ background: hi === r ? tc('#1a1a1a') : undefined }}>
              <td className="sticky left-0 px-1" style={{ background: C.panel2, color: C.amber }}>{r}</td>
              {ccys.map(c => { const x = r === c ? null : val(r, c); return <td key={c} className="px-1 text-right whitespace-nowrap border-l" style={{ borderColor: tc('#1a1a1a'), color: r === c ? C.muted : mode === 'last' ? C.text : cl(x) }}>{r === c ? '—' : mode === 'last' ? auto(x) : x == null ? '—' : sn(x, 2)}</td> })}
            </tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-2 mt-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <Panel title={S.ptax}>
          <Grid maxH={190} rows={Object.entries(d.ptax || {}).map(([c, p]: any) => ({ ccy: c, ...p, chg: p.prev_sell ? (p.sell / p.prev_sell - 1) * 100 : null }))} cols={[
            { k: 'ccy', label: S.c.ccy, color: () => C.amber }, { k: 'buy', label: S.c.buy, align: 'r', fmt: x => n(x, 4) }, { k: 'sell', label: S.c.sell, align: 'r', fmt: x => n(x, 4), color: () => C.white },
            { k: 'chg', label: S.c.chg, align: 'r', fmt: x => pc(x), color: x => cl(x) }, { k: 'date', label: S.c.date, fmt: x => dUS(x), color: () => C.muted },
          ]} />
        </Panel>
        <Panel title={S.usd}>
          <Grid maxH={190} rows={ccys.filter(c => c !== 'USD').map(c => ({ ccy: c, last: d.usd_per[c], d1: d.usd_per_prev?.[c] ? (d.usd_per[c] / d.usd_per_prev[c] - 1) * 100 : null, spark: d.spark?.[c] }))} cols={[
            { k: 'ccy', label: S.c.ccy, color: () => C.amber }, { k: 'last', label: 'USD/ccy', align: 'r', fmt: x => auto(x), color: () => C.white },
            { k: 'd1', label: S.c.chg, align: 'r', fmt: x => pc(x), color: x => cl(x) }, { k: 'spark', label: S.c.spark, fmt: x => <Spark data={x || []} w={90} h={14} /> },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= FXFC =======================
const S_FXFC = { title: 'FX Forecasts – USD/BRL (market survey)', tabs: ['Monthly', 'Annual'], c: { ref: 'Reference', median: 'Median', mean: 'Mean', sd: 'Std dev', min: 'Min', max: 'Max', n: 'N', w1: '1W ago', w4: '4W ago', forward: 'CIP fwd', vsSpot: 'vs spot' },
  chart: 'USD/BRL spot, survey median (min–max band) and CIP forward', spot: 'Spot', med: 'Survey median', fwd: 'CIP forward', band: 'Min–max',
  hist: 'Median history', k: { spot: 'Spot USD/BRL', survey: 'Survey date', ye: 'Year-end median', fwd: 'Year-end CIP fwd', n: 'Respondents' } }
export function FXFCView() {
  const { data: d, err } = useJSON<any>('fxfc.json')
  const [tab, setTab] = useState(0), [sel, setSel] = useState<string | null>(null)
  const S = S_FXFC
  if (!d) return <FnScreen code="FXFC" title={S.title}><Loading2 err={err} /></FnScreen>
  if (!d.monthly?.length && !d.annual?.length) return <FnScreen code="FXFC" title={S.title}><Unavailable what="FX survey" /></FnScreen>
  const list: any[] = tab === 0 ? d.monthly : d.annual
  const cur = list.find(x => x.ref === sel) || list[0]
  const ye = d.annual?.[0]
  const x = (iso: string) => dayN(iso)
  const series: any[] = [
    { name: S.spot, points: (d.spot_hist || []).map((p: any) => [x(p[0]), p[1]]), color: C.white, width: 2 },
    { name: S.med, points: list.map(r => [x(r.end), r.median]), color: C.amber, width: 2, band: list.map(r => [x(r.end), r.min, r.max]) },
    { name: S.fwd, points: list.filter(r => r.forward != null).map(r => [x(r.end), r.forward]), color: C.cyan, dash: '4 3' },
  ]
  const fx = (v: number) => dUS(new Date(v * 864e5).toISOString().slice(0, 10))
  return (
    <FnScreen code="FXFC" title={S.title} tabs={S.tabs} tab={tab} setTab={t => { setTab(t); setSel(null) }} source={d.source} note={d.note}>
      <Kpis items={[[S.k.spot, `${n(d.spot, 4)} (${dUS(d.spot_date)})`, C.white], [S.k.survey, dUSfull(d.survey_date)], [S.k.ye, ye ? `${ye.ref}: ${n(ye.median, 4)}` : '—', C.amber], [S.k.fwd, ye?.forward != null ? n(ye.forward, 4) : '—', C.cyan], [S.k.n, ye?.n ?? '—']]} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
        <div className="min-w-0">
          <Panel title={S.chart}><XYChart series={series} height={300} xFmt={fx} yFmt={(v: number) => n(v, 2)} legend /></Panel>
          <Panel title={`${S.hist} – ${cur?.ref ?? ''}`} className="mt-2">
            <FnChart height={200} panes={[{ series: [{ kind: 'line', data: (cur?.hist || []).map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, title: S.med, decimals: 4 }] }]} />
          </Panel>
        </div>
        <Panel title={S.tabs[tab]}>
          <Grid maxH={560} rows={list} onRow={(r: any) => setSel(r.ref)} rowStyle={(r: any) => r === cur ? { background: tc('#1f2a44') } : undefined} cols={[
            { k: 'ref', label: S.c.ref, color: () => C.amber },
            { k: 'median', label: S.c.median, align: 'r', fmt: v => n(v, 4), color: () => C.white },
            { k: 'vsSpot', label: S.c.vsSpot, align: 'r', fmt: (_, r: any) => pc((r.median / d.spot - 1) * 100), color: (_, r: any) => cl(r.median - d.spot) },
            { k: 'w1', label: S.c.w1, align: 'r', fmt: v => n(v, 4) }, { k: 'w4', label: S.c.w4, align: 'r', fmt: v => n(v, 4) },
            { k: 'min', label: S.c.min, align: 'r', fmt: v => n(v, 2) }, { k: 'max', label: S.c.max, align: 'r', fmt: v => n(v, 2) },
            { k: 'sd', label: S.c.sd, align: 'r', fmt: v => n(v, 3) }, { k: 'n', label: S.c.n, align: 'r' },
            { k: 'forward', label: S.c.forward, align: 'r', fmt: v => n(v, 4), color: () => C.cyan },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}
