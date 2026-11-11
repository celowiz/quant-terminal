'use client'
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, PALETTE, useJSON, FnScreen, Panel, Grid, Btns, useDesktop, Loading, inputCls, inputStyle } from '@/components/fn/kit'
import { lang } from '@/lib/settings'
import { tc } from '@/lib/themeRuntime'
import { sectorName } from '@/lib/val.mjs'
import { brt, b3Open, type LiveInfo } from '@/lib/live.mjs'
import { useLive, liveFile, b3QuoteLive, watcherNext } from '@/lib/liveFetch'
import { rangeOf, aggregate, liveAggregate, mergeClasses, groupBy, breadth, turnover, cumulative, type MovFile, type MovRow, type MovAgg } from '@/lib/mov.mjs'
import { downloadCSV, CsvBtn } from './v4util'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
// vírgula decimal e ponto de milhar só nesta tela em PT (o formatador global do site fica como está)
const loc = () => (lang() === 'pt' ? 'pt-BR' : 'en-US')
const num = (v: any, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }))
const sgn = (v: any, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : `${+v > 0 ? '+' : +v < 0 ? '−' : ''}${num(Math.abs(+v), d)}`)
const pct = (v: any, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : `${sgn(v, d)}%`)
const clr = (v: any) => (v == null || !Number.isFinite(+v) || +v === 0 ? C.text : +v > 0 ? C.up : C.down)
const dmy = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')

export const MOV_INDICES: { v: string; l: string }[] = [
  { v: 'IBOV', l: 'IBOV' }, { v: 'IBXX', l: 'IBrX-100' }, { v: 'IBXL', l: 'IBrX-50' }, { v: 'SMLL', l: 'SMLL' }, { v: 'IDIV', l: 'IDIV' },
]
const idxName = (v: string) => ({ IBOV: 'Ibovespa', IBXX: 'IBrX-100', IBXL: 'IBrX-50', SMLL: L('Small Cap (SMLL)', 'Small Cap (SMLL)'), IDIV: L('Dividend index (IDIV)', 'Índice de dividendos (IDIV)') } as Record<string, string>)[v] || v
const secLabel = (s?: string | null) => (s ? sectorName(s.split('/')[0].trim(), lang() === 'pt') : L('Not classified', 'Sem classificação'))

type View = { group: 'none' | 'sector'; merge: boolean; current: boolean }

/** linhas exibidas: filtro de membros atuais, junção de classes e agrupamento por setor */
function shape(rows: MovRow[], v: View) {
  let r = v.current ? rows.filter(x => x.current !== false) : rows
  if (v.merge) r = mergeClasses(r)
  if (v.group === 'sector') r = groupBy(r, x => secLabel(x.sector))
  const lead = r.filter(x => (x.pts ?? 0) > 0).sort((a, b) => (b.pts as number) - (a.pts as number))
  const lag = r.filter(x => (x.pts ?? 0) < 0).sort((a, b) => (a.pts as number) - (b.pts as number))
  return { all: r, lead, lag }
}

function Controls({ idx, setIdx, v, setV, hist }: { idx: string; setIdx: (x: string) => void; v: View; setV: (x: View) => void; hist: boolean }) {
  const tog = (on: boolean, label: string, onClick: () => void, attr: string) => (
    <button type="button" {...{ [attr]: '' }} onClick={onClick} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.line, background: on ? C.amber : 'transparent', color: on ? tc('#000') : C.amber }}>{label}</button>
  )
  return (
    <>
      <span data-mov-index><Btns opts={MOV_INDICES} value={idx} onChange={setIdx} /></span>
      <span className="flex items-center gap-1"><span style={{ color: C.muted }}>{L('Group', 'Agrupar')}</span>
        <Btns opts={[{ v: 'none', l: L('None', 'Nenhum') }, { v: 'sector', l: L('Sector', 'Setor') }]} value={v.group} onChange={g => setV({ ...v, group: g })} /></span>
      {tog(v.merge, L('Merge classes', 'Juntar classes'), () => setV({ ...v, merge: !v.merge }), 'data-mov-merge')}
      {hist && tog(v.current, L('Current members only', 'Só membros atuais'), () => setV({ ...v, current: !v.current }), 'data-mov-current')}
    </>
  )
}

function Stats({ agg, br, tv, mode }: { agg: MovAgg | null; br: { up: number; down: number; unch: number } | null; tv: { current: number; added: string[]; removed: string[] } | null; mode: 'mov' | 'hmov' }) {
  const it = (k: string, val: React.ReactNode, color?: string, title?: string) => (
    <div className="flex flex-col min-w-0" title={title}><span className="text-[11px]" style={{ color: C.muted }}>{k}</span><span className="text-[13px] font-bold truncate" style={{ color: color || C.white }}>{val}</span></div>
  )
  const n = (x: number | undefined | null) => (x == null ? '—' : String(x))
  return (
    <div data-mov-stats className="grid gap-x-3 gap-y-1 px-2 py-1 border mb-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-10" style={{ borderColor: C.line, background: C.panel }}>
      {it(L('Up', 'Altas'), n(br?.up), C.up)}
      {it(L('Down', 'Baixas'), n(br?.down), C.down)}
      {it(L('Unchanged', 'Estáveis'), n(br?.unch))}
      {it(L('End', 'Fim'), num(agg?.L1))}
      {it(L('Net change', 'Variação'), sgn(agg?.chg), clr(agg?.chg))}
      {it(L('% change', 'Var. %'), pct(agg?.pct), clr(agg?.pct))}
      {it(L('Current members', 'Membros atuais'), n(tv?.current))}
      {mode === 'hmov' ? it(L('Additions', 'Entradas'), n(tv?.added.length), undefined, tv?.added.join(', ')) : it(L('Previous close', 'Fech. anterior'), num(agg?.L0))}
      {mode === 'hmov' ? it(L('Removals', 'Saídas'), n(tv?.removed.length), undefined, tv?.removed.join(', ')) : it(L('Members with quote', 'Membros cotados'), agg ? String(agg.rows.filter(r => r.raw != null).length) : '—')}
      {it(L('Residual', 'Resíduo'), agg ? `${sgn(agg.resid)} ${L('pts', 'pts')}` : '—', C.muted, L('Difference between the official index change and the sum of raw contributions; spread across members by weight in Points.', 'Diferença entre a variação oficial do índice e a soma das contribuições brutas; distribuída pelo peso de cada ação na coluna Pontos.'))}
    </div>
  )
}

function MoverTable({ rows, chg, desk, more, open, setOpen, kind }: { rows: MovRow[]; chg: number | null; desk: boolean; more: boolean; open: Set<string>; setOpen: (s: Set<string>) => void; kind: 'lead' | 'lag' }) {
  const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.pts ?? 0)))
  const flat: (MovRow & { _child?: boolean })[] = []
  for (const r of rows) {
    flat.push(r)
    if (r.group && open.has(r.cod)) for (const c of (r.items || []).slice().sort((a, b) => kind === 'lead' ? (b.pts ?? 0) - (a.pts ?? 0) : (a.pts ?? 0) - (b.pts ?? 0))) flat.push({ ...c, _child: true })
  }
  const nameCell = (_: any, r: any) => {
    if (r.group) return <span><span style={{ color: C.amber }}>{open.has(r.cod) ? '▾' : '▸'} {r.name}</span> <span style={{ color: C.muted }}>({r.n})</span></span>
    const tag = r.left ? L(`left ${dmy(r.left).slice(0, 5)}`, `saiu ${dmy(r.left).slice(0, 5)}`) : r.joined ? L(`joined ${dmy(r.joined).slice(0, 5)}`, `entrou ${dmy(r.joined).slice(0, 5)}`) : r.current === false ? L('left', 'saiu') : ''
    return (
      <span style={{ paddingLeft: r._child ? 12 : 0 }}>
        <span style={{ color: C.amber }}>{r.cod}</span>
        {(desk || more) && <span style={{ color: C.muted }}> {r.name}</span>}
        {tag && <span className="ml-1 px-1 text-[10px] border" style={{ borderColor: C.line, color: C.muted }}>{tag}</span>}
      </span>
    )
  }
  const bar = (v: any) => (
    <span className="inline-flex items-center justify-end gap-1 w-full">
      {desk && <span className="inline-block h-[8px]" style={{ width: `${Math.round(Math.abs(v ?? 0) / max * 60)}px`, background: (v ?? 0) >= 0 ? C.up : C.down, opacity: 0.6 }} />}
      <span style={{ color: clr(v) }}>{sgn(v)}</span>
    </span>
  )
  const cols: any[] = [
    { k: 'cod', label: L('Name', 'Nome'), fmt: nameCell },
    { k: 'px', label: L('End price', 'Preço final'), align: 'r', fmt: (v: any) => num(v) },
    { k: 'ret', label: L('% chg', 'Var. %'), align: 'r', fmt: (v: any) => pct(v == null ? null : v * 100), color: clr },
    { k: 'pts', label: L('Points', 'Pontos'), align: 'r', fmt: bar },
    { k: 'raw', label: L('Raw pts', 'Pts brutos'), align: 'r', fmt: (v: any) => sgn(v), color: () => C.muted, tip: L('Before spreading the residual', 'Antes de distribuir o resíduo') },
    { k: 'mv', label: L('% of move', '% do movimento'), align: 'r', fmt: (_: any, r: any) => (chg ? pct((r.pts ?? 0) / chg * 100, 1) : '—') },
  ]
  const show = desk || more ? cols : cols.filter(c => ['cod', 'ret', 'pts'].includes(c.k))
  return (
    <Grid stickyFirst maxH={desk ? 560 : 520} cols={show} rows={flat}
      onRow={(r: any) => { if (!r.group) return; const s = new Set(open); if (s.has(r.cod)) s.delete(r.cod); else s.add(r.cod); setOpen(s) }}
      rowStyle={(r: any) => (r._child ? { background: tc('#0d0d0d') } : r.group ? { background: tc('#14100a') } : undefined)} />
  )
}

function Movers({ agg, desk, v, tag, chart }: { agg: MovAgg; desk: boolean; v: View; tag: string; chart?: React.ReactNode }) {
  const [tab, setTab] = useState<'lead' | 'lag'>('lead')
  const [more, setMore] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const s = useMemo(() => shape(agg.rows, v), [agg, v])
  const lead = <Panel title={`▲ ${L('Leaders', 'Líderes')} (${s.lead.length})`}><div data-mov-leaders><MoverTable rows={s.lead} chg={agg.chg} desk={desk} more={more} open={open} setOpen={setOpen} kind="lead" /></div></Panel>
  const lag = <Panel title={`▼ ${L('Laggards', 'Retardatários')} (${s.lag.length})`}><div data-mov-laggards><MoverTable rows={s.lag} chg={agg.chg} desk={desk} more={more} open={open} setOpen={setOpen} kind="lag" /></div></Panel>
  return (
    <div className="flex flex-col gap-2 min-w-0" data-mov-tag={tag}>
      {desk ? <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>{lead}{lag}</div> : (
        <>
          <div className="flex items-center gap-1">
            <Btns opts={[{ v: 'lead', l: L('Leaders', 'Líderes') }, { v: 'lag', l: L('Laggards', 'Retardatários') }]} value={tab} onChange={setTab} />
            <button data-mov-more type="button" className="ml-auto px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? L('Fewer columns', 'Menos colunas') : L('More columns', 'Mais colunas')}</button>
          </div>
          <div data-mov-tab={tab}>{tab === 'lead' ? lead : lag}</div>
        </>
      )}
      {chart}
    </div>
  )
}

function exportCSV(name: string, agg: MovAgg, v: View) {
  const s = shape(agg.rows, { ...v, group: 'none' })
  const head = [L('Ticker', 'Código'), L('Name', 'Nome'), L('Sector', 'Setor'), L('End price', 'Preço final'), L('% change', 'Var. %'), L('Points', 'Pontos'), L('Raw points', 'Pontos brutos'), L('% of index move', '% do movimento do índice'), L('Joined', 'Entrou'), L('Left', 'Saiu')]
  const body = s.all.slice().sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0)).map(r => [r.cod, r.name, secLabel(r.sector), r.px, r.ret == null ? null : +(r.ret * 100).toFixed(4), r.pts == null ? null : +r.pts.toFixed(3), r.raw == null ? null : +r.raw.toFixed(3), agg.chg && r.pts != null ? +(r.pts / agg.chg * 100).toFixed(3) : null, r.joined, r.left])
  downloadCSV(name, head, body)
}

const NOTE = () => L(
  'Contribution of each member to the index move. Daily points = previous index level × weight at the previous close × the member\'s total return that day (the index reinvests distributions); a period adds up the days. Weights come from the official portfolio of the day and drift with prices until the next rebalance (first Monday of January, May and September). The raw sum does not match the official change exactly (the exchange applies distributions and corporate events in its own way); the difference (Residual) is spread across members by their weight that day, so Points add up to the index change. Raw pts show the value before that step. Removed members count while they were in the index. Missing values appear as —. Educational content, not investment advice.',
  'Contribuição de cada ação para a variação do índice. Pontos do dia = nível anterior do índice × peso no fechamento anterior × retorno total da ação no dia (o índice reinveste proventos); o período soma os dias. Os pesos vêm da carteira oficial do dia e mudam com os preços até o próximo rebalanceamento (primeira segunda-feira de janeiro, maio e setembro). A soma bruta não fecha exatamente com a variação oficial (a bolsa aplica proventos e eventos societários do seu jeito); a diferença (Resíduo) é distribuída pelo peso de cada ação no dia, e os Pontos somam a variação do índice. Pts brutos mostram o valor antes desse passo. Ações que saíram contam enquanto estiveram no índice. Valores ausentes aparecem como —. Conteúdo educacional, não é recomendação de investimento.')

// ---------------------------------------------------------------- HMOV
const PRESETS = ['1D', 'MTD', 'YTD', '1Y', 'CUSTOM']
const presetLabel = (p: string) => (p === 'CUSTOM' ? L('Custom', 'Personalizado') : p === '1Y' ? L('1Y', '12M') : p === 'MTD' ? L('MTD', 'No mês') : p === 'YTD' ? L('YTD', 'No ano') : p)

export function HMOVView() {
  const [idx, setIdx] = useState('IBOV')
  const [per, setPer] = useState('YTD')
  const [cus, setCus] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [v, setV] = useState<View>({ group: 'none', merge: false, current: false })
  const desk = useDesktop()
  const { data: raw, err } = useJSON<MovFile>(`mov/${idx}.json`)
  const { data: pv } = useJSON<any>('mov/preview.json')
  const o = raw && raw.index === idx ? raw : null
  const title = L('Index movers — history', 'Contribuição por ação — histórico')
  const calc = useMemo(() => {
    if (!o) return null
    const custom = cus.from && cus.to ? cus : { from: cus.from || o.dates[1], to: cus.to || o.dates[o.dates.length - 1] }
    const r = rangeOf(o.dates, per, per === 'CUSTOM' ? custom : null)
    if (!r) return { r: null as null }
    const agg = aggregate(o, r.a, r.b)
    return { r, agg, br: breadth(agg.rows), tv: turnover(o, r.a, r.b) }
  }, [o, per, cus])
  const chartData = useMemo(() => {
    if (!o || !calc || !calc.r) return null
    const s = shape(calc.agg!.rows, v)
    const top = s.all.filter(x => x.pts != null).sort((a, b) => Math.abs(b.pts as number) - Math.abs(a.pts as number)).slice(0, 5)
    const groups = top.map(x => (x.group ? (x.items || []).map(i => i.cod) : x.classes ? x.classes : [x.cod]))
    const cu = cumulative(o, calc.r.a, calc.r.b, groups)
    return { top, cu }
  }, [o, calc, v])
  const panes = useMemo(() => chartData && [{ series: [
    { kind: 'line' as const, data: chartData.cu.index.map(([t, x]) => ({ time: t, value: x })), color: C.white, width: 2, title: L('Index', 'Índice'), decimals: 0, locale: loc() },
    ...chartData.top.map((x, k) => ({ kind: 'line' as const, data: chartData.cu.series[k].map(([t, y]) => ({ time: t, value: y })), color: PALETTE[(k + 1) % PALETTE.length], title: x.group ? x.name : x.cod, decimals: 0, locale: loc() })),
  ] }], [chartData])
  if (!o) return <FnScreen code="HMOV" title={title} ownTitle wrap><Loading err={err} /></FnScreen>
  const first = o.dates[1], last = o.dates[o.dates.length - 1]
  const right = (
    <>
      <Controls idx={idx} setIdx={x => setIdx(x)} v={v} setV={setV} hist />
      <span data-mov-period><Btns opts={PRESETS.map(p => ({ v: p, l: presetLabel(p) }))} value={per} onChange={setPer} /></span>
      {per === 'CUSTOM' && <span className="flex items-center gap-1">
        <input data-mov-from type="date" className={inputCls} style={inputStyle} min={first} max={last} value={cus.from || first} onChange={e => setCus({ ...cus, from: e.target.value })} />
        <span style={{ color: C.muted }}>→</span>
        <input data-mov-to type="date" className={inputCls} style={inputStyle} min={first} max={last} value={cus.to || last} onChange={e => setCus({ ...cus, to: e.target.value })} />
      </span>}
      <span data-mov-csv>{calc?.r ? <CsvBtn onClick={() => exportCSV(`hmov-${idx}-${calc.agg!.from}-${calc.agg!.to}.csv`, calc.agg!, v)} /> : null}</span>
    </>
  )
  const pvi = pv?.indices?.[idx]
  const preview = (
    <Panel title={L('Next rebalance', 'Próximo rebalanceamento')}>
      <div data-mov-preview className="px-2 py-1 text-[12px]">
        {!pvi ? <span style={{ color: C.muted }}>—</span> : !pvi.window ? (
          <span style={{ color: C.muted }}>{L(`The next portfolio takes effect on ${dmy(pvi.next_rebalance)}. The exchange publishes previews during the last month before it; they will appear here.`, `A próxima carteira vale a partir de ${dmy(pvi.next_rebalance)}. A bolsa publica prévias no último mês antes da virada; elas aparecem aqui.`)}</span>
        ) : !pvi.rows ? <span style={{ color: C.muted }}>{L('Preview not available right now.', 'Prévia indisponível no momento.')}</span> : (
          <PreviewBody p={pvi} />
        )}
      </div>
    </Panel>
  )
  const chart = chartData && (
    <Panel title={L('Cumulative contribution (points)', 'Contribuição acumulada (pontos)')}>
      <div data-mov-chart>
        <FnChart height={desk ? 300 : 240} alwaysLegend panes={panes!} />
      </div>
    </Panel>
  )
  return (
    <FnScreen code="HMOV" title={title} ownTitle wrap note={NOTE()} asOf={last}
      source={L('Official index portfolios and closing levels; daily closing prices adjusted for distributions.', 'Carteiras e fechamentos oficiais dos índices; preços de fechamento ajustados por proventos.')}
      right={right}>
      <div className="px-1 pb-1 text-[12px]" style={{ color: C.muted }}>
        {idxName(idx)} · {calc?.r ? <>{dmy(calc.agg!.base)} → {dmy(calc.agg!.to)}</> : '—'} · {L(`history since ${dmy(o.dates[0])}`, `histórico desde ${dmy(o.dates[0])}`)}
      </div>
      {!calc?.r ? (
        <>
          <Stats agg={null} br={null} tv={null} mode="hmov" />
          <div data-mov-nodata className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>{L(`No data for this period: the history of this index starts on ${dmy(o.dates[0])}. Pick a shorter period or a custom range.`, `Sem dados para este período: o histórico deste índice começa em ${dmy(o.dates[0])}. Escolha um período menor ou um intervalo personalizado.`)}</div>
          {preview}
        </>
      ) : (
        <>
          <Stats agg={calc.agg!} br={calc.br!} tv={calc.tv!} mode="hmov" />
          <Movers agg={calc.agg!} desk={desk} v={v} tag="hmov" chart={<div className="grid gap-2" style={{ gridTemplateColumns: desk ? '2fr 1fr' : 'minmax(0,1fr)' }}>{chart}{preview}</div>} />
        </>
      )}
    </FnScreen>
  )
}

function PreviewBody({ p }: { p: any }) {
  const rows: any[] = p.rows || []
  const adds = rows.filter(r => r.cur == null)
  const ch = rows.filter(r => r.cur != null && r.part != null).map(r => ({ ...r, d: r.part - r.cur })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 8)
  return (
    <div className="flex flex-col gap-1">
      <div style={{ color: C.muted }}>{L(`Preview checked on ${dmy(p.checked)} for the portfolio starting ${dmy(p.next_rebalance)}.`, `Prévia consultada em ${dmy(p.checked)} para a carteira que começa em ${dmy(p.next_rebalance)}.`)}</div>
      <div><span style={{ color: C.up }}>{L('In', 'Entram')}:</span> {adds.length ? adds.map(r => `${r.cod} (${num(r.part, 3)}%)`).join(', ') : '—'}</div>
      <div><span style={{ color: C.down }}>{L('Out', 'Saem')}:</span> {p.removed?.length ? p.removed.map((r: any) => `${r.cod} (${num(r.cur, 3)}%)`).join(', ') : '—'}</div>
      <div style={{ color: C.muted }}>{L('Largest weight changes', 'Maiores mudanças de peso')}:</div>
      {ch.length ? ch.map(r => <div key={r.cod}><span style={{ color: C.amber }}>{r.cod}</span> {num(r.cur, 3)}% → {num(r.part, 3)}% <span style={{ color: clr(r.d) }}>({sgn(r.d, 3)} p.p.)</span></div>) : <div>—</div>}
    </div>
  )
}

// ---------------------------------------------------------------- MOV
type MovLive = { generated_at: string; day: string; session: boolean; indices: Record<string, { quote: [number, number | null] | null; parts: Record<string, number> }>; quotes: Record<string, [number, number | null]> }
const STALE_MS = 12 * 60000

export function MOVView() {
  const [idx, setIdx] = useState('IBOV')
  const [v, setV] = useState<View>({ group: 'none', merge: false, current: false })
  const desk = useDesktop()
  const { data: raw, err } = useJSON<MovFile>(`mov/${idx}.json`)
  const o = raw && raw.index === idx ? raw : null
  const title = L('Index movers — today', 'Contribuição por ação — hoje')
  const lv = useLive(() => liveFile<MovLive>('mov.json').then(j => (j && j.indices && j.quotes ? j : null)), watcherNext, [])
  const today = brt(Date.now()).day
  const w = lv.data
  const fresh = !!w && w.day === today && !!w.indices?.[idx] && (!b3Open(Date.now()) || Date.now() - Date.parse(w.generated_at) < STALE_MS)
  // reserva: o arquivo do watcher falta ou está velho no pregão → cotações direto da bolsa no navegador,
  // com os pesos do último fechamento do arquivo diário (válidos se o arquivo é do pregão anterior)
  const lastDay = o ? o.dates[o.dates.length - 1] : null
  const needFb = !!o && !fresh && lastDay! < today && b3Open(Date.now()) && lv.tried
  const fbKey = needFb ? `${idx}|${Object.keys(o!.last_w).length}` : ''
  const fb = useLive(needFb ? async () => {
    const cods = Object.keys(o!.last_w)
    const out: Record<string, [number, number | null]> = {}
    const pool = [...cods, idx]
    let i = 0
    const worker = async () => { while (i < pool.length) { const s = pool[i++]; const q = await b3QuoteLive(s); if (q) out[s] = [q.last, q.pct] } }
    await Promise.all(Array.from({ length: 6 }, worker))
    return Object.keys(out).length > cods.length / 2 && out[idx] ? out : null
  } : null, now => (b3Open(now) ? 180000 : null), [fbKey])
  const meta = useMemo(() => new Map((o?.members || []).map(m => [m.cod, m])), [o])
  const calc = useMemo(() => {
    if (!o) return null
    if (fresh && w) {
      const I = w.indices[idx]
      const agg = liveAggregate(I.parts, w.quotes, I.quote, meta)
      if (agg) return { agg, src: 'watcher' as const, at: Date.parse(w.generated_at), session: w.session }
    }
    if (needFb && fb.data) {
      const parts = Object.fromEntries(Object.entries(o.last_w).map(([c, x]) => [c, x * 100]))
      const agg = liveAggregate(parts, fb.data, fb.data[idx], meta)
      if (agg) return { agg, src: 'browser' as const, at: fb.at as number, session: true }
    }
    const r = rangeOf(o.dates, '1D')
    if (!r) return null
    return { agg: aggregate(o, r.a, r.b), src: 'daily' as const, at: null, session: false, day: o.dates[r.b] }
  }, [o, fresh, w, needFb, fb.data, fb.at, idx, meta])
  if (!o) return <FnScreen code="MOV" title={title} ownTitle wrap><Loading err={err} /></FnScreen>
  const agg = calc?.agg || null
  const br = agg ? breadth(agg.rows.filter(r => r.raw != null)) : null
  const tv = agg ? { current: agg.rows.length, added: [], removed: [] } : null
  const live: LiveInfo | null = calc && calc.src !== 'daily' && calc.at ? { kind: 'checked', at: calc.at } : null
  const right = (
    <>
      <Controls idx={idx} setIdx={setIdx} v={v} setV={setV} hist={false} />
      <span data-mov-csv>{agg ? <CsvBtn onClick={() => exportCSV(`mov-${idx}-${calc && calc.src === 'daily' ? (calc as any).day : today}.csv`, agg, v)} /> : null}</span>
    </>
  )
  const when = !calc ? '—' : calc.src === 'daily' ? L(`last session ${dmy((calc as any).day)} (closing prices)`, `último pregão ${dmy((calc as any).day)} (fechamento)`)
    : calc.session ? L('today, delayed quotes (about 15 min)', 'hoje, cotações com atraso (cerca de 15 min)') : L('today, after the session', 'hoje, após o pregão')
  return (
    <FnScreen code="MOV" title={title} ownTitle wrap note={<>{NOTE()} {L('During the session the screen uses the exchange\'s delayed quotes (about 15 minutes) and the weights of the official portfolio of the day, refreshed every few minutes; outside the session it shows the last full session.', 'Durante o pregão a tela usa as cotações com atraso da bolsa (cerca de 15 minutos) e os pesos da carteira oficial do dia, atualizados a cada poucos minutos; fora do pregão mostra o último pregão completo.')}</>}
      source={L('Official index portfolio of the day and delayed exchange quotes; official closing levels.', 'Carteira oficial do dia e cotações com atraso da bolsa; fechamentos oficiais.')}
      right={right} live={live}>
      <div data-mov-when={calc?.src || 'none'} className="px-1 pb-1 text-[12px]" style={{ color: C.muted }}>{idxName(idx)} · {when}</div>
      <Stats agg={agg} br={br} tv={tv} mode="mov" />
      {agg ? <Movers agg={agg} desk={desk} v={v} tag="mov" /> : <div className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>—</div>}
    </FnScreen>
  )
}
