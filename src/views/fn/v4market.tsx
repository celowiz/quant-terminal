'use client'
/** Funções sem ticker da v4: CDIE (refeita), CORR, EQS, GC, ECFC, ECST, WCRS, GLCO, MOST, BTMM. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, PALETTE, nf, pf, big, dBR, dBRfull, clr, useJSON, FnScreen, Panel, Grid, Btns, perLabel, Field, inputCls, inputStyle, KV, Loading, Spark } from '@/components/fn/kit'
import { corr } from '@/lib/quant'
import { en, monLabel } from '@/lib/enText'
import { downloadCSV, CsvBtn, dayNum, fromDay, heat, HBars, VertexBars } from './v4util'

const bp = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${nf(v, d)}`
const mLabel = monLabel

// ======================= CDIE =======================
export function CDIEView() {
  const { data: d, err } = useJSON<any>('cdie.json')
  const [tab, setTab] = useState(0)
  const v = useMemo(() => {
    if (!d) return null
    const path: any[] = d.path, ref = d.ref_date
    const meetings: any[] = d.meetings
    const endOf = (r: any) => { const i = meetings.findIndex(m => m.label === r.label); return meetings[i + 1]?.effective || fromDay(dayNum(r.effective) + 45) }
    const step = (get: (r: any) => number | null, v0: number | null) => {
      const pts: [number, number | null][] = [[dayNum(ref), v0]]
      let prev = v0
      path.forEach(r => { const val = get(r); pts.push([dayNum(r.effective), prev]); pts.push([dayNum(r.effective), val]); prev = val })
      if (path.length) pts.push([dayNum(endOf(path[path.length - 1])), prev])
      return pts
    }
    const last = path.length ? endOf(path[path.length - 1]) : ref
    const quoted = (d.contracts as any[]).filter(c => c.mat <= last).map(c => [dayNum(c.mat), c.rate] as [number, number])
    const nextM = meetings.find(m => m.decision >= ref)
    const h = d.history?.[d.history.length - 1]
    return { path, step, quoted, nextM, h, cum: path.length ? path[path.length - 1].cum_bp : null }
  }, [d])
  if (!d || !v) return <FnScreen code="CDIE"><Loading err={err} /></FnScreen>
  const first = v.path[0]
  return (
    <FnScreen code="CDIE" title="CDI / Copom expectations implied by DI futures" tabs={['Copom meetings', 'DI1 contracts', 'History']} tab={tab} setTab={setTab}
      source={d.source} note={<>{en(d.method)} The implied rate is what the market prices in (not a forecast); it includes a risk premium that grows with maturity. Focus = median Selic per meeting (BCB). Implied Selic = implied CDI + current Selic−CDI spread ({nf(d.spread_selic_cdi, 2)} p.p.). Δ meeting vs the previous period; 25 bp = a &quot;standard&quot; cut/hike. Est. only exists up to the last expiry covered by the published Copom calendar. History starts with the sessions available in the B3 Daily Bulletin and grows by one session per day with each pipeline run.</>}>
      <div className="mb-2 grid gap-2 text-[12px] fn-kpi" style={{ gridTemplateColumns: 'repeat(6,minmax(0,1fr))' }}>
        {[
          ['Reference date (settlement)', dBRfull(d.ref_date), C.text],
          ['Current CDI (% p.a.)', nf(d.cdi, 2), C.amber],
          ['Selic target (% p.a.)', nf(d.selic, 2), C.amber],
          ['Next meeting', v.nextM ? `${v.nextM.label} · ${dBR(v.nextM.decision)}` : '—', C.text],
          ['Implied move (bp)', first ? bp(first.move_bp) : '—', clr(first?.move_bp)],
          [`Cumulative to ${v.path[v.path.length - 1]?.label ?? '—'} (bp)`, bp(v.cum), clr(v.cum)],
        ].map(([k, val, c]) => <div key={k as string} className="border px-2 py-1" style={{ borderColor: C.line, background: C.panel }}><div style={{ color: C.muted }}>{k}</div><div className="text-[16px]" style={{ color: c as string }}>{val}</div></div>)}
      </div>
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' }}>
        <Panel title="Implied path by meeting">
          <Grid rows={v.path} cols={[
            { k: 'label', label: 'Meeting', color: () => C.amber },
            { k: 'decision', label: 'Decision', fmt: x => dBR(x) },
            { k: 'contract', label: 'DI1 ref.' },
            { k: 'cdi', label: 'CDI impl.', align: 'r', fmt: x => nf(x, 2), color: () => C.amber },
            { k: 'move_bp', label: 'Δ meeting (bp)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'cum_bp', label: 'Δ cum. (bp)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'n25', label: 'No. of 25 bp', align: 'r', fmt: (_, r: any) => nf(r.move_bp / 25, 2) },
            { k: 'selic', label: 'Selic impl.', align: 'r', fmt: x => nf(x, 2) },
            { k: 'focus', label: 'Focus (med.)', align: 'r', fmt: x => x ? nf(x.median, 2) : '—', color: () => C.purple },
            { k: 'dif', label: 'Impl.−Focus (bp)', align: 'r', fmt: (_, r: any) => r.focus ? bp((r.selic - r.focus.median) * 100) : '—', color: (_, r: any) => r.focus ? clr(r.selic - r.focus.median) : C.muted },
          ]} />
        </Panel>
        <div>
          <XYChart height={330} legend zeroLine={false} xFmt={x => dBR(fromDay(Math.round(x)))} yFmt={y => nf(y, 2)} yLabel="% p.a." series={[
            { name: 'Implied CDI (DI1)', points: v.step(r => r.cdi, d.cdi), color: C.amber, width: 2 },
            { name: 'Implied Selic', points: v.step(r => r.selic, d.selic), color: C.cyan, dash: '4 3' },
            { name: 'Focus – Selic median', points: v.step(r => r.focus?.median ?? null, d.selic), color: C.purple, dash: '2 3' },
            { name: 'DI1 rate (settlement, spot)', points: v.quoted, color: C.white, scatter: true },
          ]} />
          <div className="mt-2 text-[12px]" style={{ color: C.amber }}>Implied move by meeting (bp)</div>
          <HBars rows={v.path.map((r: any) => ({ label: `${r.label} ${dBR(r.decision)}`, v: r.move_bp }))} fmt={x => bp(x)} />
        </div>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
        <Panel title={`DI1 – settlement of ${dBRfull(d.ref_date)}`}>
          <Grid maxH={560} rows={d.contracts} cols={[
            { k: 'code', label: 'Contract', color: () => C.amber },
            { k: 'mat', label: 'Expiry', fmt: x => dBR(x) },
            { k: 'du', label: 'DU', align: 'r' },
            { k: 'pu', label: 'Settlement PU', align: 'r', fmt: x => nf(x, 2) },
            { k: 'rate', label: 'Rate', align: 'r', fmt: x => nf(x, 3), color: () => C.amber },
            { k: 'est', label: 'Est.', align: 'r', fmt: x => nf(x, 3) },
            { k: 'last_est_bp', label: 'Rate−Est (bp)', align: 'r', fmt: x => bp(x), color: x => x == null ? C.muted : Math.abs(x) > 2 ? C.yellow : C.text },
            { k: 'fwd', label: 'Forward', align: 'r', fmt: x => nf(x, 3) },
            { k: 'contracts', label: 'Contracts', align: 'r', fmt: x => big(x, 1) },
            { k: 'volume', label: 'Volume R$', align: 'r', fmt: x => big(x, 1) },
          ]} />
        </Panel>
        <div>
          <XYChart height={360} legend xLabel="business years (bd/252)" yLabel="% p.a." xFmt={x => nf(x, 1)} yFmt={y => nf(y, 2)} series={[
            { name: 'Settlement rate', points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, scatter: true },
            { name: 'DI1 curve', points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, width: 1 },
            { name: 'Forward between expiries', points: d.contracts.flatMap((c: any, i: number) => [[i ? d.contracts[i - 1].du / 252 : 0, c.fwd], [c.du / 252, c.fwd]]), color: C.cyan, width: 1, dash: '3 2' },
            { name: 'Est. (Copom path)', points: d.contracts.filter((c: any) => c.est != null).map((c: any) => [c.du / 252, c.est]), color: C.white, width: 1 },
          ]} />
        </div>
      </div>}
      {tab === 2 && <div>
        <FnChart height={420} panes={[
          { stretch: 0.5, series: [{ kind: 'hist', data: d.history.map((h: any) => ({ time: h.date, value: h.next_move_bp, color: h.next_move_bp >= 0 ? C.up : C.down })), title: 'Next meeting (bp)', decimals: 1 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cum_12m_bp })), color: C.amber, title: 'Cum. 12m (bp)', decimals: 1 }] },
          { stretch: 0.5, series: [{ kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.year_end_cdi })), color: C.cyan, title: 'Implied year-end CDI', decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.di1_1y })), color: C.white, title: 'DI1 ~1 year', decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cdi })), color: '#777', dashed: true, title: 'CDI', decimals: 2 }] },
        ]} />
        <Panel title="Sessions" className="mt-2">
          <Grid maxH={260} rows={d.history.slice().reverse()} cols={[
            { k: 'date', label: 'Date', fmt: x => dBRfull(x) }, { k: 'cdi', label: 'CDI', align: 'r', fmt: x => nf(x, 2) }, { k: 'next', label: 'Next meeting' },
            { k: 'next_move_bp', label: 'Δ impl. (bp)', align: 'r', fmt: x => bp(x), color: x => clr(x) }, { k: 'cum_12m_bp', label: 'Cum. 12m (bp)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'year_end_cdi', label: 'Year-end CDI', align: 'r', fmt: x => nf(x, 2) }, { k: 'di1_1y', label: 'DI1 ~1Y', align: 'r', fmt: x => nf(x, 3) },
          ]} />
        </Panel>
      </div>}
    </FnScreen>
  )
}

// ======================= CORR =======================
export function CORRView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const [n, setN] = useState(15), [win, setWin] = useState(252), [freq, setFreq] = useState<'d' | 'w'>('d')
  const [pair, setPair] = useState<[string, string] | null>(null)
  const M = useMemo(() => {
    if (!u) return null
    const top = u.components.slice().sort((a: any, b: any) => b.weight - a.weight).slice(0, n).map((c: any) => c.cod)
    const codes = ['^BVSP', ...top].filter(c => u.close[c])
    const L = u.dates.length, step = freq === 'w' ? 5 : 1
    const idx: number[] = []; for (let i = L - 1; i >= Math.max(0, L - 1 - win); i -= step) idx.unshift(i)
    const R: Record<string, (number | null)[]> = {}
    codes.forEach(c => { const s = u.close[c]; R[c] = idx.slice(1).map((i, k) => s[i] != null && s[idx[k]] != null ? s[i] / s[idx[k]] - 1 : null) })
    const cc = (p: string, q: string) => { const a: number[] = [], b: number[] = []; R[p].forEach((x, i) => { const y = R[q][i]; if (x != null && y != null) { a.push(x); b.push(y) } }); return a.length > 10 ? corr(a, b) : NaN }
    const m = codes.map(p => codes.map(q => p === q ? 1 : cc(p, q)))
    const avg = codes.map((_, i) => { const xs = m[i].filter((x, j) => j !== i && isFinite(x)); return xs.reduce((s, x) => s + x, 0) / (xs.length || 1) })
    return { codes, m, avg, from: u.dates[idx[0]], to: u.dates[L - 1] }
  }, [u, n, win, freq])
  const roll = useMemo(() => {
    if (!u || !pair) return null
    const [p, q] = pair, a = u.close[p], b = u.close[q], out: { time: string; value: number }[] = []
    const ra = a.map((x: number, i: number) => i && x != null && a[i - 1] != null ? x / a[i - 1] - 1 : null), rb = b.map((x: number, i: number) => i && x != null && b[i - 1] != null ? x / b[i - 1] - 1 : null)
    for (let i = 64; i < u.dates.length; i++) { const xa: number[] = [], xb: number[] = []; for (let j = i - 62; j <= i; j++) if (ra[j] != null && rb[j] != null) { xa.push(ra[j]); xb.push(rb[j]) } if (xa.length > 40) out.push({ time: u.dates[i], value: corr(xa, xb) }) }
    return out
  }, [u, pair])
  if (!u || !M) return <FnScreen code="CORR"><Loading err={err} /></FnScreen>
  const lbl = (c: string) => c === '^BVSP' ? 'IBOV' : c
  return (
    <FnScreen code="CORR" title="Correlation matrix – Ibovespa components"
      right={<><Field label="Assets"><Btns opts={[10, 15, 20]} value={n} onChange={setN} /></Field><Field label="Window"><Btns opts={[{ v: 63, l: '3M' }, { v: 126, l: '6M' }, { v: 252, l: '1Y' }, { v: 504, l: '2Y' }, { v: 749, l: '3Y' }]} value={win} onChange={setWin} /></Field><Btns opts={[{ v: 'd', l: 'Daily' }, { v: 'w', l: 'Weekly' }]} value={freq} onChange={setFreq} /></>}
      source="B3 (Ibovespa theoretical portfolio) + Yahoo Finance (adjusted closes), via universe.json."
      note={`Pearson correlation of ${freq === 'w' ? 'weekly' : 'daily'} returns between ${dBR(M.from)} and ${dBR(M.to)}. The index's largest weights + the Ibovespa itself. Click a cell to see the pair's 63-session rolling correlation.`}>
      <div className="overflow-auto">
        <table className="border-collapse text-[11px]">
          <thead><tr><th></th>{M.codes.map(c => <th key={c} className="px-1 py-1 font-normal" style={{ color: C.amber }}>{lbl(c)}</th>)}<th className="px-2 font-normal" style={{ color: C.muted }}>Average</th></tr></thead>
          <tbody>{M.codes.map((p, i) => <tr key={p}><td className="px-2 py-[2px]" style={{ color: C.amber }}>{lbl(p)}</td>{M.m[i].map((x, j) => <td key={j} onClick={() => i !== j && setPair([p, M.codes[j]])} className="cursor-pointer px-1 py-[2px] text-right border border-[#111]" style={{ background: i === j ? '#1a1a1a' : heat(x, 1), color: '#fff', minWidth: 44, outline: pair && pair[0] === p && pair[1] === M.codes[j] ? `1px solid ${C.amber}` : undefined }}>{nf(x, 2)}</td>)}<td className="px-2 text-right" style={{ color: C.amber }}>{nf(M.avg[i], 2)}</td></tr>)}</tbody>
        </table>
      </div>
      {roll && pair && <div className="mt-2"><div className="text-[12px]" style={{ color: C.amber }}>63-session rolling correlation: {lbl(pair[0])} × {lbl(pair[1])}</div>
        <FnChart height={220} panes={[{ series: [{ kind: 'line', data: roll, color: C.amber, title: 'corr 63d', decimals: 2, lines: [{ price: 0, color: '#555' }] }] }]} /></div>}
    </FnScreen>
  )
}

// ======================= EQS =======================
type Flt = { sector: string; mcap: number; pe: number; pb: number; dy: number; roe: number; nd: number; liq: number; q: string }
const EQ_COLS: { k: string; label: string; fmt: (v: any) => string; num?: boolean }[] = [
  { k: 'cod', label: 'Ticker', fmt: x => x }, { k: 'name', label: 'Company', fmt: x => x }, { k: 'sector', label: 'Sector', fmt: x => x ?? '—' },
  { k: 'price', label: 'Price', fmt: x => nf(x, 2), num: true }, { k: 'pct', label: 'Day chg', fmt: x => pf(x), num: true }, { k: 'ytd', label: 'YTD', fmt: x => pf(x, 1), num: true },
  { k: 'mcap', label: 'Mkt cap', fmt: x => big(x, 1), num: true }, { k: 'vol_fin_avg30', label: '30d avg liquidity', fmt: x => big(x, 1), num: true },
  { k: 'pe', label: 'P/E', fmt: x => nf(x, 1), num: true }, { k: 'pb', label: 'P/B', fmt: x => nf(x, 2), num: true }, { k: 'ev_ebitda', label: 'EV/EBITDA', fmt: x => nf(x, 1), num: true },
  { k: 'dy', label: 'DY 12m', fmt: x => pf(x, 1, false), num: true }, { k: 'roe', label: 'ROE', fmt: x => pf(x, 1, false), num: true }, { k: 'net_margin', label: 'Net mg.', fmt: x => pf(x, 1, false), num: true },
  { k: 'nd_ebitda', label: 'ND/EBITDA', fmt: x => nf(x, 2), num: true },
]
export function EQSView() {
  const { data: s, err } = useJSON<any>('screener.json')
  const [f, setF] = useState<Flt>({ sector: '', mcap: 0, pe: 0, pb: 0, dy: 0, roe: 0, nd: 0, liq: 0, q: '' })
  const [sort, setSort] = useState<{ k: string; asc: boolean }>({ k: 'mcap', asc: false })
  const [drawer, setDrawer] = useState(false) // mobile: filtros num painel recolhível
  const rows = useMemo(() => {
    if (!s) return []
    const r = (s.rows as any[]).filter(x =>
      (!f.sector || x.sector === f.sector) && (!f.q || (x.cod + ' ' + x.name).toUpperCase().includes(f.q.toUpperCase())) &&
      (!f.mcap || (x.mcap ?? 0) >= f.mcap * 1e9) && (!f.pe || (x.pe != null && x.pe > 0 && x.pe <= f.pe)) && (!f.pb || (x.pb != null && x.pb <= f.pb)) &&
      (!f.dy || (x.dy ?? 0) >= f.dy) && (!f.roe || (x.roe ?? -1e9) >= f.roe) && (!f.nd || (x.nd_ebitda != null && x.nd_ebitda <= f.nd)) && (!f.liq || (x.vol_fin_avg30 ?? 0) >= f.liq * 1e6))
    return r.sort((a, b) => { const x = a[sort.k], y = b[sort.k]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * (sort.asc ? 1 : -1) })
  }, [s, f, sort])
  if (!s) return <FnScreen code="EQS"><Loading err={err} /></FnScreen>
  const sectors = Array.from(new Set((s.rows as any[]).map(x => x.sector).filter(Boolean))).sort() as string[]
  const num = (k: keyof Flt, label: string, w = 'w-16', step = 1) => <Field label={label}><input className={inputCls + ' ' + w} style={inputStyle} type="number" step={step} value={(f[k] as number) || ''} placeholder="—" onChange={e => setF({ ...f, [k]: +e.target.value || 0 })} /></Field>
  const exp = () => downloadCSV(`eqs_${s.generated_at?.slice(0, 10)}.csv`, EQ_COLS.map(c => c.label), rows.map(r => EQ_COLS.map(c => r[c.k] ?? null)))
  return (
    <FnScreen code="EQS" title="Equity Screening – Ibovespa (CVM fundamentals + market)" right={<CsvBtn onClick={exp} />}
      source={s.source} note={<>{s.note} Fundamentals: last 12 months (sum of 4 quarters) from each company's latest ITR/DFP; equity and debt from the latest balance sheet. Click a header to sort.</>}>
      <div className="mb-2 flex items-center gap-2 lg:hidden">
        <button className="px-3 py-1 text-[12px] border font-bold" style={{ borderColor: drawer ? C.amber : C.line, color: drawer ? '#000' : C.amber, background: drawer ? C.amber : C.panel }} onClick={() => setDrawer(!drawer)}>
          Filtros{(() => { const n = Object.values(f).filter(v => v !== '' && v !== 0).length; return n ? ` (${n})` : '' })()} {drawer ? '▾' : '▸'}
        </button>
        <span className="ml-auto text-[12px]" style={{ color: C.amber }}>{rows.length} of {s.rows.length} stocks</span>
      </div>
      <div className={`mb-2 flex flex-wrap items-end gap-3 border p-2 ${drawer ? '' : 'max-lg:hidden'}`} style={{ borderColor: C.line, background: C.panel }}>
        <Field label="Search"><input className={inputCls + ' w-28'} style={inputStyle} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Sector"><select className={inputCls} style={inputStyle} value={f.sector} onChange={e => setF({ ...f, sector: e.target.value })}><option value="">All</option>{sectors.map(x => <option key={x} value={x}>{en(x)}</option>)}</select></Field>
        {num('mcap', 'Mkt cap ≥ (R$ bn)')}{num('liq', 'Liq. 30d ≥ (R$ mn)')}{num('pe', 'P/E ≤')}{num('pb', 'P/B ≤', 'w-16', 0.1)}{num('dy', 'DY ≥ %', 'w-16', 0.5)}{num('roe', 'ROE ≥ %')}{num('nd', 'ND/EBITDA ≤', 'w-16', 0.5)}
        <button className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.line, color: C.muted }} onClick={() => setF({ sector: '', mcap: 0, pe: 0, pb: 0, dy: 0, roe: 0, nd: 0, liq: 0, q: '' })}>Clear</button>
        <span className="ml-auto text-[12px] max-lg:hidden" style={{ color: C.amber }}>{rows.length} of {s.rows.length} stocks</span>
      </div>
      <Grid maxH={600} rows={rows} cols={EQ_COLS.map(c => ({
        k: c.k, align: c.num ? 'r' : 'l', w: c.k === 'name' ? '170px' : c.k === 'sector' ? '150px' : undefined,
        label: <span className="cursor-pointer" onClick={() => setSort({ k: c.k, asc: sort.k === c.k ? !sort.asc : !c.num })}>{c.label}{sort.k === c.k ? (sort.asc ? ' ▲' : ' ▼') : ''}</span>,
        fmt: (x: any) => c.fmt(x), color: (x: any) => c.k === 'cod' ? C.amber : ['pct', 'ytd'].includes(c.k) ? clr(x) : C.text,
      })) as any} />
    </FnScreen>
  )
}

// ======================= GC =======================
function nearestKey(keys: string[], target: string) { let best: string | null = null; keys.forEach(k => { if (k <= target) best = k }); return best }
export function GCView() {
  const { data: g, err } = useJSON<any>('curves.json')
  const di = useJSON<any>('cdie.json')
  const [tab, setTab] = useState(0)
  const [cmp, setCmp] = useState<string[]>(['w1', 'm1'])
  const [td, setTd] = useState<'pre' | 'ipca'>('pre')
  const LBL: Record<string, string> = { now: 'Current', w1: '1 week', m1: '1 month', m3: '3 months', y1: '1 year' }
  const COLS: Record<string, string> = { now: C.amber, w1: C.white, m1: C.cyan, m3: C.purple, y1: '#888' }
  const curves = useMemo(() => {
    if (!g) return null
    const sets: Record<string, { date: string; pts: { x: number; y: number; l: string }[] }> = {}
    if (tab === 0 && di.data) {
      const keys = Object.keys(di.data.curves).sort(), last = keys[keys.length - 1]
      const off: Record<string, number> = { now: 0, w1: 7, m1: 30, m3: 91, y1: 365 }
      Object.entries(off).forEach(([k, dd]) => { const key = nearestKey(keys, fromDay(dayNum(last) - dd)); if (key && (k === 'now' || key !== last)) sets[k] = { date: key, pts: di.data.curves[key].map((c: any) => ({ x: c[2] / 252, y: c[3], l: c[0] })) } })
    } else if (tab === 1) {
      const name = td === 'pre' ? 'Tesouro Prefixado' : 'Tesouro IPCA+'
      Object.entries(g.td[td] || {}).forEach(([k, v]: any) => { sets[k] = { date: v.date, pts: v.points.filter((p: any) => p[2] === name).map((p: any) => ({ x: p[0], y: p[1], l: dBR(p[3]) })) } })
    } else if (tab === 2) {
      Object.entries(g.us).forEach(([k, v]: any) => { sets[k] = { date: v.date, pts: v.points.map((p: any) => ({ x: p[0], y: p[1], l: p[2] })) } })
    }
    return sets
  }, [g, di.data, tab, td])
  if (!g || !curves) return <FnScreen code="GC"><Loading err={err} /></FnScreen>
  const now = curves.now
  const avail = ['w1', 'm1', 'm3', 'y1'].filter(k => curves[k])
  const shown = ['now', ...cmp].filter(k => curves[k])
  const tableRows = now ? now.pts.map(p => { const r: any = { l: p.l, x: p.x, now: p.y }; avail.forEach(k => { const q = curves[k].pts.find(z => z.l === p.l); r[k] = q ? (p.y - q.y) * 100 : null }); return r }) : []
  const toggle = (k: string) => setCmp(cmp.includes(k) ? cmp.filter(x => x !== k) : [...cmp, k])
  const unit = tab === 2 ? 'Treasury (% p.a.)' : tab === 1 ? (td === 'pre' ? 'Fixed-rate (% p.a.)' : 'IPCA+ (real rate, % p.a.)') : 'DI1 (% p.a.)'
  return (
    <FnScreen code="GC" title="Yield curves – Brazil and US" tabs={['Brazil – DI1 (B3)', 'Brazil – Tesouro Direto', 'US – Treasuries']} tab={tab} setTab={setTab}
      right={<>{tab === 1 && <Btns opts={[{ v: 'pre', l: 'Fixed-rate' }, { v: 'ipca', l: 'IPCA+' }]} value={td} onChange={setTd} />}<span className="text-[12px]" style={{ color: C.muted }}>Compare:</span>{avail.map(k => <button key={k} onClick={() => toggle(k)} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: COLS[k], color: cmp.includes(k) ? '#000' : COLS[k], background: cmp.includes(k) ? COLS[k] : 'transparent' }}>{LBL[k]}</button>)}</>}
      source={tab === 0 ? 'B3 – Daily Bulletin (DI1 settlement rate), via cdie.json' : tab === 1 ? g.td_source : 'FRED – Treasury constant maturity (DGS1MO…DGS30)'}
      note={tab === 0 ? 'X axis in business years (bd/252). DI1 history only covers sessions already collected from the Daily Bulletin; longer comparisons appear as the pipeline accumulates sessions.' : tab === 1 ? 'Zero-coupon bonds (Tesouro Prefixado / Tesouro IPCA+), morning bid rate published by the Treasury; X axis in calendar years to maturity.' : 'Treasury par curve (constant maturity), X axis in years.'}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <div className="min-w-0"><XYChart height={300} legend xLabel={tab === 0 ? 'business years' : 'years'} yLabel={unit} xFmt={x => nf(x, 1)} yFmt={y => nf(y, 2)} series={shown.flatMap(k => [
          { name: `${LBL[k]} (${dBR(curves[k].date)})`, points: curves[k].pts.map(p => [p.x, p.y] as [number, number]), color: COLS[k], width: k === 'now' ? 2 : 1, dash: k === 'now' ? undefined : '4 3' },
        ])} />
        <div className="mt-2"><VertexBars height={170} labels={tableRows.map((r: any) => String(r.l))}
          groups={avail.filter(k => cmp.includes(k)).map(k => ({ name: `vs ${LBL[k]} (${dBR(curves[k].date)})`, values: tableRows.map((r: any) => r[k]) }))} /></div></div>
        <Panel title={`${unit} — Δ in bp vs. previous dates`}>
          <Grid maxH={440} rows={tableRows} cols={[
            { k: 'l', label: tab === 1 ? 'Expiry' : 'Tenor', color: () => C.amber },
            { k: 'now', label: dBR(now?.date), align: 'r', fmt: x => nf(x, 2) },
            ...avail.map(k => ({ k, label: `Δ ${LBL[k]}`, align: 'r' as const, fmt: (x: any) => bp(x, 0), color: (x: any) => clr(x) })),
          ]} />
        </Panel>
      </div>
      {tab === 2 && <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>{Object.entries(g.us_money).map(([k, v]: any) => <Panel key={k} title={`${({ DFF: 'Effective Fed Funds', SOFR: 'SOFR', DTB3: 'T-bill 3M' } as any)[k] || k} · ${nf(v.last, 2)}% (${dBR(v.date)})`}><FnChart height={140} panes={[{ series: [{ kind: 'line', data: v.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, decimals: 2 }] }]} /></Panel>)}</div>}
    </FnScreen>
  )
}

// ======================= ECFC =======================
const FUNIT: Record<string, string> = { 'IPCA': '% p.a.', 'PIB Total': '% p.a.', 'Selic': '% p.a. (year-end)', 'Câmbio': 'R$/US$ (year-end)', 'IGP-M': '% p.a.', 'IPCA Administrados': '% p.a.', 'Conta corrente': 'US$ bn', 'Balança comercial': 'US$ bn', 'IDP': 'US$ bn', 'Dívida líquida do setor público': '% GDP', 'Resultado primário': '% GDP', 'Resultado nominal': '% GDP' }
export function ECFCView() {
  const { data: f, err } = useJSON<any>('focus.json')
  const [sel, setSel] = useState('IPCA')
  if (!f) return <FnScreen code="ECFC"><Loading err={err} /></FnScreen>
  const refs: string[] = f.refs.map(String), inds = Object.keys(f.indicators)
  const I = f.indicators[sel] || f.indicators[inds[0]]
  const unitOf = (k: string) => FUNIT[k] ?? Object.entries(FUNIT).find(([p]) => k.startsWith(p))?.[1] ?? ''
  const rows = inds.map(k => { const r: any = { k, unit: unitOf(k), date: f.indicators[k].date }; refs.forEach(y => { const s = f.indicators[k].snap?.[y]; r[y] = s?.median; r[y + 'd'] = s && s.w4 != null ? s.median - s.w4 : null }); return r })
  const arrow = (d: number | null) => d == null || Math.abs(d) < 1e-9 ? '' : d > 0 ? ' ▲' : ' ▼'
  return (
    <FnScreen code="ECFC" title="Economic forecasts – Brazil (Focus / BCB)"
      source={f.source} note="Median of the institutions' forecasts in the Focus Report (annual). Arrow = change in the median over the last 4 weeks. Click a row to see the dispersion (mean, std. dev., min, max, no. of respondents) and the median's evolution.">
      <Grid onRow={(r: any) => setSel(r.k)} rowStyle={(r: any) => r.k === sel ? { background: '#2a1d08' } : undefined} rows={rows} cols={[
        { k: 'k', label: 'Indicator', color: () => C.amber }, { k: 'unit', label: 'Unit', color: () => C.muted },
        ...refs.map(y => ({ k: y, label: y, align: 'r' as const, fmt: (x: any, r: any) => <>{nf(x, 2)}<span style={{ color: r[y + 'd'] > 0 ? C.up : C.down }}>{arrow(r[y + 'd'])}</span></> })),
        { k: 'date', label: 'Date', align: 'r', fmt: x => dBR(x) },
      ]} />
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)' }}>
        <Panel title={`${sel} — forecast dispersion (${dBR(I.date)})`}>
          <Grid rows={refs.map(y => ({ y, ...(I.snap?.[y] || {}) }))} cols={[
            { k: 'y', label: 'Year', color: () => C.amber }, { k: 'median', label: 'Median', align: 'r', fmt: x => nf(x, 2), color: () => C.amber }, { k: 'mean', label: 'Average', align: 'r', fmt: x => nf(x, 2) },
            { k: 'sd', label: 'Std. dev.', align: 'r', fmt: x => nf(x, 2) }, { k: 'min', label: 'Min', align: 'r', fmt: x => nf(x, 2) }, { k: 'max', label: 'Max', align: 'r', fmt: x => nf(x, 2) },
            { k: 'n', label: 'Resp.', align: 'r' }, { k: 'w1', label: '1 wk ago', align: 'r', fmt: x => nf(x, 2) }, { k: 'w4', label: '4 wk ago', align: 'r', fmt: x => nf(x, 2) },
          ]} />
        </Panel>
        <Panel title={`${sel} — median evolution`}>
          <FnChart height={240} panes={[{ series: refs.filter(y => I.hist?.[y]?.length).map((y, i) => ({ kind: 'line' as const, data: I.hist[y].map((p: any) => ({ time: p[0], value: p[1] })), color: PALETTE[(i + 1) % PALETTE.length], title: y, decimals: 2 })) }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= ECST =======================
type Row = { label: string; group: string; unit: string; pts: [string, number][]; period: (iso: string) => string; src: string; dec?: number }
const qLabel = (iso: string) => `Q${Math.ceil(+iso.slice(5, 7) / 3)}'${iso.slice(2, 4)}`
function sidraDate(id: string, code: string) { const y = code.slice(0, 4), n = +code.slice(4); return id.startsWith('pib') ? `${y}-${String(n * 3).padStart(2, '0')}-01` : `${y}-${String(n).padStart(2, '0')}-01` }
export function ECSTView() {
  const { data: e, err } = useJSON<any>('econ.json')
  const s = useJSON<any>('ecst.json')
  const [sel, setSel] = useState<string>('IPCA 12m')
  const rows = useMemo(() => {
    if (!e) return null
    const S = (id: string) => (e.series as any[]).find(x => x.id === id)?.points as [string, number][] | undefined
    const monthly = (p?: [string, number][]) => { if (!p) return []; const m = new Map<string, [string, number]>(); p.forEach(x => m.set(x[0].slice(0, 7), x)); return Array.from(m.values()) }
    const yoy = (p: [string, number][], k = 12) => p.slice(k).map((x, i) => [x[0], (x[1] / p[i][1] - 1) * 100] as [string, number])
    const diff = (p: [string, number][]) => p.slice(1).map((x, i) => [x[0], x[1] - p[i][1]] as [string, number])
    const X = (id: string) => { const q = s.data?.sidra?.find((x: any) => x.id === id); return q ? { pts: q.points.map((p: any) => [sidraDate(id, p[0]), p[2]] as [string, number]), lbl: Object.fromEntries(q.points.map((p: any) => [sidraDate(id, p[0]), p[1]])) as Record<string, string> } : null }
    const out: Row[] = []
    const add = (group: string, label: string, unit: string, pts: [string, number][] | undefined | null, period: (iso: string) => string, src: string, dec = 2) => { if (pts && pts.length) out.push({ group, label, unit, pts, period, src, dec }) }
    const sx = (id: string, label: string, unit: string, dec = 1) => { const q = X(id); if (q) add('Brazil', label, unit, q.pts, iso => q.lbl[iso] ?? mLabel(iso), 'IBGE SIDRA', dec) }
    add('Brazil', 'Selic target', '% p.a.', monthly(S('SGS432')), mLabel, 'BCB SGS 432')
    sx('pib_qq', 'GDP – q/q (SA)', '% t/t'); sx('pib_aa', 'GDP – y/y', '% y/y')
    add('Brazil', 'IPCA monthly', '% m/m', S('SGS433'), mLabel, 'BCB SGS 433')
    add('Brazil', 'IPCA 12m', '% 12m', S('SGS13522'), mLabel, 'BCB SGS 13522')
    sx('ipca15', 'IPCA-15 monthly', '% m/m', 2)
    add('Brazil', 'IGP-M monthly', '% m/m', S('SGS189'), mLabel, 'BCB SGS 189')
    sx('desemprego', 'Unemployment (PNAD, rolling quarter)', '%')
    add('Brazil', 'IBC-Br – 12m chg', '% y/y', S('SGS24363') ? yoy(S('SGS24363')!) : null, mLabel, 'BCB SGS 24363', 1)
    sx('pim', 'Industrial production (m/m SA)', '%'); sx('pmc', 'Retail sales (m/m SA)', '%'); sx('pms', 'Services volume (m/m SA)', '%')
    add('Brazil', 'General government gross debt', '% GDP', S('SGS13762'), mLabel, 'BCB SGS 13762', 1)
    add('Brazil', 'Primary balance 12m', '% GDP', S('SGS5793'), mLabel, 'BCB SGS 5793')
    add('Brazil', 'Trade balance', 'US$ mn', S('SGS22707'), mLabel, 'BCB SGS 22707', 0)
    add('Brazil', 'International reserves', 'US$ mn', monthly(S('SGS3546')), mLabel, 'BCB SGS 3546', 0)
    add('Brazil', 'USD PTAX (ask)', 'R$/US$', monthly(S('SGS1')), mLabel, 'BCB SGS 1', 4)
    add('US', 'Effective Fed Funds', '%', S('FEDFUNDS'), mLabel, 'FRED FEDFUNDS')
    add('US', 'CPI – 12m chg', '% y/y', S('CPIAUCSL') ? yoy(S('CPIAUCSL')!) : null, mLabel, 'FRED CPIAUCSL', 1)
    add('US', 'Unemployment', '%', S('UNRATE'), mLabel, 'FRED UNRATE', 1)
    add('US', 'Payrolls – jobs created', 'thousand', S('PAYEMS') ? diff(S('PAYEMS')!) : null, mLabel, 'FRED PAYEMS', 0)
    add('US', 'Real GDP – q/q annualized', '% p.a.', S('GDPC1') ? S('GDPC1')!.slice(1).map((x, i) => [x[0], ((x[1] / S('GDPC1')![i][1]) ** 4 - 1) * 100] as [string, number]) : null, qLabel, 'FRED GDPC1', 1)
    add('US', 'Treasury 10Y', '%', monthly(S('DGS10')), mLabel, 'FRED DGS10')
    add('US', 'Spread 10Y–2Y', 'p.p.', monthly(S('T10Y2Y')), mLabel, 'FRED T10Y2Y')
    return out
  }, [e, s.data])
  if (!e || !rows) return <FnScreen code="ECST"><Loading err={err} /></FnScreen>
  const cur = rows.find(r => r.label === sel) || rows[0]
  return (
    <FnScreen code="ECST" title="Economic statistics – Brazil and US"
      source="BCB SGS, IBGE SIDRA (GDP, PNAD Contínua, PIM, PMC, PMS, IPCA-15) and FRED (US)."
      note="Latest released value of each indicator, the previous one and the change; sparkline with the last 24 observations. Daily series are sampled at each month end. Click a row for the full history.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <Grid maxH={640} onRow={(r: any) => setSel(r.label)} rowStyle={(r: any) => r.label === cur.label ? { background: '#2a1d08' } : undefined}
          rows={rows.map(r => { const n = r.pts.length, l = r.pts[n - 1], p = r.pts[n - 2]; return { ...r, last: l[1], prev: p?.[1], per: r.period(l[0]), chg: p ? l[1] - p[1] : null, spark: r.pts.slice(-24).map(x => x[1]) } })}
          cols={[
            { k: 'group', label: 'Country', color: () => C.muted }, { k: 'label', label: 'Indicator', color: () => C.amber }, { k: 'per', label: 'Period' },
            { k: 'last', label: 'Last', align: 'r', fmt: (x, r: any) => nf(x, r.dec), color: () => C.white }, { k: 'prev', label: 'Previous', align: 'r', fmt: (x, r: any) => nf(x, r.dec) },
            { k: 'chg', label: 'Var.', align: 'r', fmt: (x, r: any) => x == null ? '—' : `${x > 0 ? '+' : ''}${nf(x, r.dec)}`, color: x => clr(x) },
            { k: 'unit', label: 'Unit', color: () => C.muted }, { k: 'spark', label: '24 obs.', fmt: x => <Spark data={x} color={C.amber} /> }, { k: 'src', label: 'Source', color: () => C.muted },
          ]} />
        <Panel title={`${cur.label} (${cur.unit}) — ${cur.src}`}>
          <FnChart height={420} panes={[{ series: [{ kind: cur.unit.startsWith('% m') || cur.unit.includes('t/t') || cur.unit === 'thousand' || cur.unit === '%' && cur.label.includes('m/m') ? 'hist' : 'line', data: cur.pts.map(p => ({ time: p[0], value: p[1], color: p[1] >= 0 ? C.amber : C.down })), color: C.amber, title: cur.label, decimals: cur.dec }] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= WCRS =======================
const CNAME: Record<string, string> = { USD: 'US dollar', BRL: 'Brazilian real', EUR: 'Euro', GBP: 'British pound', JPY: 'Japanese yen', CHF: 'Swiss franc', CAD: 'Canadian dollar', AUD: 'Australian dollar', CNY: 'Chinese yuan', MXN: 'Mexican peso', ARS: 'Argentine peso', CLP: 'Chilean peso', INR: 'Indian rupee', NZD: 'New Zealand dollar', SEK: 'Swedish krona', NOK: 'Norwegian krone', DKK: 'Danish krone', PLN: 'Zloty', ZAR: 'Rand', TRY: 'Turkish lira', KRW: 'Won', HKD: 'Hong Kong dollar', SGD: 'Singapore dollar', COP: 'Colombian peso', PEN: 'Peruvian sol', IDR: 'Indonesian rupiah', ILS: 'Shekel' }
export function WCRSView() {
  const { data: d, err } = useJSON<any>('fx.json')
  const [base, setBase] = useState<'USD' | 'BRL'>('USD')
  const [per, setPer] = useState('1M')
  const T = useMemo(() => {
    if (!d) return null
    const dates: string[] = d.dates, L = dates.length - 1
    const ccys = ['USD', ...Object.keys(d.usd_per)].filter(c => c !== base)
    const up = (c: string, i: number) => c === 'USD' ? 1 : d.usd_per[c]?.[i]
    const px = (c: string, i: number) => { const a = up(c, i), b = up(base, i); return a && b ? b / a : null } // valor de 1 unidade da moeda na base
    const at = (t: string) => { let i = L; while (i > 0 && dates[i] > t) i--; return i }
    const off: Record<string, number> = { '1D': L - 1, '1S': at(fromDay(dayNum(dates[L]) - 7)), '1M': at(fromDay(dayNum(dates[L]) - 30)), '3M': at(fromDay(dayNum(dates[L]) - 91)), 'YTD': at(`${dates[L].slice(0, 4)}-01-01`) - 0, '1A': at(fromDay(dayNum(dates[L]) - 365)) }
    const last = (c: string) => { let i = L; while (i > 0 && px(c, i) == null) i--; return i }
    const rows = ccys.map(c => { const li = last(c), v = px(c, li); const r: any = { c, name: CNAME[c] || c, v, date: dates[li] }; Object.entries(off).forEach(([k, i]) => { let j = i; while (j > 0 && px(c, j) == null) j--; const p = px(c, j); r[k] = v != null && p ? (v / p - 1) * 100 : null }); return r })
    return { rows: rows.sort((a, b) => (b[per] ?? -1e9) - (a[per] ?? -1e9)), date: dates[L] }
  }, [d, base, per])
  if (!d || !T) return <FnScreen code="WCRS"><Loading err={err} /></FnScreen>
  const P = ['1D', '1S', '1M', '3M', 'YTD', '1A']
  return (
    <FnScreen code="WCRS" title={`Currency ranking vs ${base === 'USD' ? 'dollar' : 'real'}`}
      right={<><Field label="Base"><Btns opts={[{ v: 'USD', l: 'USD' }, { v: 'BRL', l: 'BRL' }]} value={base} onChange={setBase} /></Field><Field label="Sort by"><Btns opts={P} value={per} onChange={setPer} /></Field></>}
      source={d.source} note={`Change in the value of 1 unit of each currency measured in ${base} (positive = the currency appreciated against the ${base}). Daily closing quotes (spot), crossed via the dollar. Date: ${dBRfull(T.date)}.`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <Grid rows={T.rows.map((r, i) => ({ ...r, rk: i + 1 }))} cols={[
          { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'c', label: 'Currency', color: () => C.amber }, { k: 'name', label: 'Name' },
          { k: 'v', label: `Quote (${base})`, align: 'r', fmt: x => nf(x, x < 0.01 ? 6 : x < 1 ? 4 : 4) },
          ...P.map(k => ({ k, label: perLabel(k), align: 'r' as const, fmt: (x: any) => pf(x), color: (x: any) => k === per ? (x >= 0 ? C.up : C.down) : clr(x) })),
        ]} />
        <Panel title={`${perLabel(per)} change vs ${base}`}><HBars rows={T.rows.map(r => ({ label: r.c, v: r[per] }))} fmt={x => pf(x)} /></Panel>
      </div>
    </FnScreen>
  )
}

// ======================= GLCO =======================
export function GLCOView() {
  const { data: f, err } = useJSON<any>('futures.json')
  const [sel, setSel] = useState('CL=F')
  if (!f) return <FnScreen code="GLCO"><Loading err={err} /></FnScreen>
  const rows = (f.rows as any[]).map((r, i, a) => ({ ...r, g: i === 0 || a[i - 1].group !== r.group ? r.group : '', spark: r.series.slice(-60).map((p: any) => p[1]) }))
  const cur = rows.find(r => r.ticker === sel) || rows[0]
  return (
    <FnScreen code="GLCO" title="Global commodities – futures (front month)"
      source={f.source} note="Front-month continuous contract (Yahoo, ticker =F), delayed daily close. Period changes are on the close; 52w = 52-week low/high range. Click a row for the chart.">
      <Grid onRow={(r: any) => setSel(r.ticker)} rowStyle={(r: any) => r.ticker === cur.ticker ? { background: '#2a1d08' } : undefined} rows={rows} cols={[
        { k: 'g', label: 'Group', color: () => C.amber }, { k: 'name', label: 'Commodity', color: () => C.white }, { k: 'ticker', label: 'Ticker', color: () => C.muted }, { k: 'exchange', label: 'Exchange', color: () => C.muted }, { k: 'unit', label: 'Unit', color: () => C.muted },
        { k: 'last', label: 'Last', align: 'r', fmt: x => nf(x, x >= 1000 ? 1 : 2), color: () => C.amber }, { k: 'chg', label: 'Var.', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'w1', label: '1W', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm1', label: '1M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm3', label: '3M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'ytd', label: 'YTD', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'y1', label: '1Y', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
        { k: 'lo52', label: '52w Low', align: 'r', fmt: x => nf(x, 2) }, { k: 'hi52', label: '52w High', align: 'r', fmt: x => nf(x, 2) }, { k: 'spark', label: '3 months', fmt: x => <Spark data={x} color={C.amber} /> }, { k: 'date', label: 'Date', fmt: x => dBR(x), color: () => C.muted },
      ]} />
      <Panel title={`${cur.name} (${cur.ticker}) — ${cur.unit}`} className="mt-2">
        <FnChart height={260} panes={[{ series: [{ kind: 'area', data: cur.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.white, title: cur.ticker, lines: [{ price: cur.hi52, color: '#555', title: '52w high' }, { price: cur.lo52, color: '#555', title: '52w low' }] }] }]} />
      </Panel>
    </FnScreen>
  )
}

// ======================= MOST =======================
export function MOSTView() {
  const { data: s, err } = useJSON<any>('screener.json')
  const [tab, setTab] = useState(0)
  if (!s) return <FnScreen code="MOST"><Loading err={err} /></FnScreen>
  const R = (s.rows as any[]).filter(r => r.price != null).map(r => ({ ...r, rel: r.vol_fin && r.vol_fin_avg30 ? r.vol_fin / r.vol_fin_avg30 : null, dhi: r.hi52 ? (r.price / r.hi52 - 1) * 100 : null, dlo: r.lo52 ? (r.price / r.lo52 - 1) * 100 : null }))
  const sorters: ((a: any, b: any) => number)[] = [(a, b) => (b.vol_fin ?? 0) - (a.vol_fin ?? 0), (a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9), (a, b) => (a.pct ?? 1e9) - (b.pct ?? 1e9), (a, b) => (b.rel ?? 0) - (a.rel ?? 0), (a, b) => (b.dhi ?? -1e9) - (a.dhi ?? -1e9), (a, b) => (a.dlo ?? 1e9) - (b.dlo ?? 1e9)]
  const rows = R.slice().sort(sorters[tab]).slice(0, 30).map((r, i) => ({ ...r, rk: i + 1 }))
  const date = R.find(r => r.date)?.date
  return (
    <FnScreen code="MOST" title={`Most active – Ibovespa (${dBRfull(date)})`} tabs={['Traded value', 'Top gainers', 'Top losers', 'Unusual volume', 'Near 52w high', 'Near 52w low']} tab={tab} setTab={setTab}
      source={s.source} note="Universe: Ibovespa stocks. Traded value of the last session (R$); abnormal volume = day volume ÷ 30-session average. Distance to 52-week highs/lows using daily closes.">
      <Grid rows={rows} cols={[
        { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Company', w: '200px' }, { k: 'sector', label: 'Sector', w: '170px', color: () => C.muted },
        { k: 'price', label: 'Last', align: 'r', fmt: x => nf(x, 2), color: () => C.white }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'vol_fin', label: 'Volume R$', align: 'r', fmt: x => big(x, 2) }, { k: 'vol_qty', label: 'No. of stocks', align: 'r', fmt: x => big(x, 1) }, { k: 'vol_fin_avg30', label: '30d avg R$', align: 'r', fmt: x => big(x, 2) },
        { k: 'rel', label: 'Vol./avg', align: 'r', fmt: x => x == null ? '—' : `${nf(x, 2)}×`, color: x => x > 1.5 ? C.yellow : C.text },
        { k: 'dhi', label: 'Dist. 52w high', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'dlo', label: 'Dist. 52w low', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
      ]} />
    </FnScreen>
  )
}

// ======================= BTMM =======================
export function BTMMView() {
  const di = useJSON<any>('cdie.json'), cv = useJSON<any>('curves.json'), fx = useJSON<any>('fx.json'), fu = useJSON<any>('futures.json'), ec = useJSON<any>('econ.json')
  const v = useMemo(() => {
    if (!di.data || !cv.data) return null
    const d = di.data, keys = Object.keys(d.curves).sort(), prevK = keys[keys.length - 2]
    const prev = new Map<string, number>((prevK ? d.curves[prevK] : []).map((c: any) => [c[0], c[3]]))
    const pick = (d.contracts as any[]).filter((c, i) => i < 3 || c.code.startsWith('DI1F')).slice(0, 12).map(c => ({ ...c, chg: prev.has(c.code) ? (c.rate - prev.get(c.code)!) * 100 : null }))
    const tdRows = (k: 'pre' | 'ipca') => { const n = cv.data.td[k]?.now, w = cv.data.td[k]?.w1; const name = k === 'pre' ? 'Tesouro Prefixado' : 'Tesouro IPCA+'; return (n?.points || []).filter((p: any) => p[2] === name).map((p: any) => { const q = w?.points.find((z: any) => z[3] === p[3] && z[2] === p[2]); return { l: `${k === 'pre' ? 'Fixed' : 'IPCA+'} ${p[3].slice(0, 4)}`, v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } }) }
    const us = cv.data.us.now.points.map((p: any) => { const q = cv.data.us.w1?.points.find((z: any) => z[2] === p[2]); return { l: p[2], v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } })
    const mm = Object.entries(cv.data.us_money).map(([k, x]: any) => ({ l: ({ DFF: 'Effective Fed Funds', SOFR: 'SOFR', DTB3: 'T-bill 3M' } as any)[k] || k, v: x.last, chg: x.prev != null ? (x.last - x.prev) * 100 : null, date: x.date }))
    return { d, pick, pre: tdRows('pre'), ipca: tdRows('ipca'), us, mm, prevK }
  }, [di.data, cv.data])
  if (!v) return <FnScreen code="BTMM"><Loading err={di.err || cv.err} /></FnScreen>
  const d = v.d, h = d.history?.[d.history.length - 1]
  const fxr = (() => { if (!fx.data) return []; const L = fx.data.dates.length - 1, b = fx.data.usd_per.BRL, e = fx.data.usd_per.EUR; return [{ l: 'USD/BRL', v: b[L], chg: (b[L] / b[L - 1] - 1) * 100 }, { l: 'EUR/BRL', v: b[L] / e[L], chg: ((b[L] / e[L]) / (b[L - 1] / e[L - 1]) - 1) * 100 }, { l: 'DXY', v: fx.data.dxy[L], chg: (fx.data.dxy[L] / fx.data.dxy[L - 1] - 1) * 100 }] })()
  const com = (fu.data?.rows || []).filter((r: any) => ['BZ=F', 'CL=F', 'GC=F'].includes(r.ticker)).map((r: any) => ({ l: r.name, v: r.last, chg: r.pct }))
  const tbl = (rows: any[], unit: 'bp' | '%', dec = 2) => <Grid rows={rows} cols={[{ k: 'l', label: 'Instrument', color: () => C.amber }, { k: 'v', label: 'Last', align: 'r', fmt: x => nf(x, dec), color: () => C.white }, { k: 'chg', label: unit === 'bp' ? 'Δ pb' : 'Var.%', align: 'r', fmt: x => unit === 'bp' ? bp(x, 1) : pf(x), color: x => clr(x) }]} />
  const sgs = (id: string) => ((ec.data?.series as any[]) || []).find(x => x.id === id)?.points as [string, number][] | undefined
  const selic = sgs('SGS432'), dff = sgs('FEDFUNDS')
  return (
    <FnScreen code="BTMM" title="Rates and money-market monitor – Brazil and US"
      source="B3 (DI1, Daily Bulletin), BCB (Selic, CDI, Copom), Tesouro Transparente (Tesouro Direto), FRED (Fed Funds, SOFR, T-bills, Treasuries), Yahoo (FX and commodities)."
      note={`DI1 Δ vs previous session (${dBR(v.prevK)}); Tesouro and Treasuries vs 1 week; US money market vs previous print. No market-consensus column (no open source).`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <Panel title="Brazil – monetary policy">
          <KV rows={[['Selic target', `${nf(d.selic, 2)}%`, C.amber], ['CDI', `${nf(d.cdi, 2)}%`, C.amber], ['Spread Selic−CDI', `${nf(d.spread_selic_cdi, 2)} p.p.`], ['Next meeting', d.path?.[0] ? `${d.path[0].label} ${dBR(d.path[0].decision)}` : '—'], ['Implied move', d.path?.[0] ? `${bp(d.path[0].move_bp)} pb` : '—', clr(d.path?.[0]?.move_bp)], ['12m cumulative', h ? `${bp(h.cum_12m_bp)} pb` : '—', clr(h?.cum_12m_bp)], ['Implied year-end CDI', h ? `${nf(h.year_end_cdi, 2)}%` : '—'], ['Focus Selic next meeting', d.path?.[0]?.focus ? `${nf(d.path[0].focus.median, 2)}%` : '—', C.purple]]} />
        </Panel>
        <Panel title={`DI futures – settlement rate (${dBR(d.ref_date)})`}>{tbl(v.pick.map((c: any) => ({ l: `${c.code} ${dBR(c.mat)}`, v: c.rate, chg: c.chg })), 'bp', 3)}</Panel>
        <Panel title={`Tesouro Direto (${dBR(cv.data.td.pre?.now?.date)})`}>{tbl([...v.pre, ...v.ipca], 'bp')}</Panel>
        <Panel title="US – money market">{tbl(v.mm, 'bp')}<div className="mt-1" />{tbl([...fxr, ...com], '%', 2)}</Panel>
      </div>
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
        <Panel title={`Treasuries (${dBR(cv.data.us.now.date)})`}>{tbl(v.us, 'bp')}</Panel>
        <Panel title="Selic target vs effective Fed Funds (% p.a.)">
          <FnChart height={280} panes={[{ series: [
            ...(selic ? [{ kind: 'line' as const, data: selic.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.amber, title: 'Selic', decimals: 2 }] : []),
            ...(dff ? [{ kind: 'line' as const, data: dff.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.cyan, title: 'Fed Funds', decimals: 2 }] : []),
          ] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}
