'use client'
/** YAS (calculadora de títulos públicos), DRSK (distância ao default de Merton), ECTR (comércio exterior Comex Stat). Strings em inglês por tela. */
import React, { useEffect, useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, useFitH, useFit } from '@/components/fn/kit'
import { HBars } from './v4util'
import { n, sn, pc, bps, bigE, cl, dUS, dUSfull, mLab, Kpis, NumIn, Loading2, Unavailable } from './fn11util'

// ======================= YAS =======================
const S_YAS = {
  title: 'Yield & Spread Analysis – Brazilian federal bonds', type: 'Type', all: 'All', bonds: 'Bonds (ANBIMA secondary market)',
  c: { bond: 'Bond', maturity: 'Maturity', rate: 'Ind. rate', bid: 'Bid', ask: 'Ask', pu: 'PU', du: 'BD' },
  calc: 'Calculator', yld: 'Yield (% p.a.)', price: 'Price (PU)', notional: 'Face (R$)', reset: 'ANBIMA',
  risk: 'Risk', spread: 'Spreads', invoice: 'Invoice', flows: 'Cash flows',
  k: { mac: 'Macaulay dur. (yrs)', mod: 'Modified dur.', cvx: 'Convexity', dv01: 'DV01 per face', dv01u: 'DV01 per bond', bd: 'Business days', vna: 'VNA', face: 'Face value per bond',
    di: 'DI1 at maturity', sp: 'Spread vs DI1 (bp)', z: 'Z-spread vs DI1 (bp)', be: 'Breakeven inflation (DI1 vs real)', lft: 'Rate is a spread over Selic', qty: 'Quantity', principal: 'Principal (R$)', anbima: 'ANBIMA PU' },
  fc: { date: 'Date', du: 'BD', cf: 'Flow (R$)', pv: 'PV (R$)', w: 'Weight' },
  curve: 'DI1 curve (B3 settlement) and bond rates', diLine: 'DI1 (% p.a.)',
}
type Bond = { id: string; bond: string; maturity: string; rate: number; bid: number; ask: number; pu: number; vna: number | null; du: number; flows: [number, number, string][] }
const pv = (f: [number, number, string][], y: number) => f.reduce((s, [du, cf]) => s + cf / Math.pow(1 + y / 100, du / 252), 0)
function solveY(f: [number, number, string][], P: number, y0: number) {
  let y = y0
  for (let i = 0; i < 60; i++) { const p = pv(f, y), d = (pv(f, y + 0.0001) - p) / 0.0001; if (!d) break; const ny = y - (p - P) / d; if (Math.abs(ny - y) < 1e-10) return ny; y = ny }
  return y
}
/** DI1 por flat-forward (log DF linear em du); extrapolação flat */
function diAt(curve: [number, number][], du: number) {
  if (!curve?.length) return null
  const lnDF = (d: number, r: number) => -d / 252 * Math.log(1 + r / 100)
  if (du <= curve[0][0]) return curve[0][1]
  if (du >= curve[curve.length - 1][0]) return curve[curve.length - 1][1]
  for (let i = 1; i < curve.length; i++) if (curve[i][0] >= du) {
    const [d0, r0] = curve[i - 1], [d1, r1] = curve[i], w = (du - d0) / (d1 - d0)
    const l = lnDF(d0, r0) + w * (lnDF(d1, r1) - lnDF(d0, r0))
    return (Math.exp(-l * 252 / du) - 1) * 100
  }
  return null
}
export function YASView() {
  const { data: d, err } = useJSON<any>('yas.json')
  const [typ, setTyp] = useState('All'), [id, setId] = useState<string | null>(null)
  const [y, setY] = useState<number | null>(null), [face, setFace] = useState<number | null>(1000000)
  const S = S_YAS
  const bonds: Bond[] = d?.bonds || []
  const b = bonds.find(x => x.id === id) || bonds.find(x => x.bond === 'NTN-F') || bonds[0]
  useEffect(() => { if (b) setY(b.rate) }, [b?.id])
  const r = useMemo(() => {
    if (!b || y == null) return null
    const f = b.flows, P = pv(f, y), t = (du: number) => du / 252, yy = 1 + y / 100
    const mac = f.reduce((s, [du, cf]) => s + t(du) * cf / Math.pow(yy, t(du)), 0) / P
    const cvx = f.reduce((s, [du, cf]) => s + t(du) * (t(du) + 1) * cf / Math.pow(yy, t(du) + 2), 0) / P
    const dv1 = (pv(f, y - 0.01) - pv(f, y + 0.01)) / 2
    const unit = b.bond === 'LTN' || b.bond === 'NTN-F' ? 1000 : (b.vna || 1000)
    const qty = face ? face / unit : null
    const di = diAt(d.di1, b.du)
    let z: number | null = null
    if (d.di1?.length && (b.bond === 'LTN' || b.bond === 'NTN-F')) {
      const g = (s: number) => f.reduce((a, [du, cf]) => { const r0 = diAt(d.di1, du)!; return a + cf / Math.pow(1 + r0 / 100, du / 252) / Math.pow(1 + s / 1e4, du / 252) }, 0) - P
      let lo = -2000, hi = 2000; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m } z = (lo + hi) / 2
    }
    const rows = f.map(([du, cf, dt]) => { const p = cf / Math.pow(yy, t(du)); return { date: dt, du, cf, pv: p, w: p / P * 100 } })
    return { P, mac, mod: mac / yy, cvx, dv1, unit, qty, di, z, rows, be: b.bond === 'NTN-B' && di != null ? ((1 + di / 100) / (1 + y / 100) - 1) * 100 : null }
  }, [b?.id, y, face, d])
  if (!d) return <FnScreen code="YAS" title={S.title}><Loading2 err={err} /></FnScreen>
  if (!bonds.length) return <FnScreen code="YAS" title={S.title} source={d.source}><Unavailable what="ANBIMA bond prices" note={d.note} /></FnScreen>
  const types = ['All', 'LTN', 'NTN-F', 'NTN-B', 'LFT']
  const isPre = b.bond === 'LTN' || b.bond === 'NTN-F'
  return (
    <FnScreen code="YAS" title={S.title} right={<Field label={S.type}><Btns opts={types.map(t => ({ v: t, l: t === 'All' ? S.all : t }))} value={typ} onChange={setTyp} /></Field>}
      source={d.source} note={<>Pricing date {dUSfull(d.ref_date)}; DI1 curve {dUSfull(d.di_ref_date)}. {Object.entries(d.conventions || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}{d.status !== 'ok' && d.note ? ` · ${d.note}` : ''}</>}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,0.95fr) minmax(0,1.05fr) minmax(0,1fr)' }}>
        <Panel title={S.bonds}>
          <Grid maxH={600} rows={bonds.filter(x => typ === 'All' || x.bond === typ)} onRow={(x: any) => setId(x.id)} rowStyle={(x: any) => x.id === b.id ? { background: '#1f2a44' } : undefined} cols={[
            { k: 'bond', label: S.c.bond, color: () => C.amber }, { k: 'maturity', label: S.c.maturity, fmt: x => dUS(x) },
            { k: 'rate', label: S.c.rate, align: 'r', fmt: x => n(x, 4), color: () => C.white },
            { k: 'bid', label: S.c.bid, align: 'r', fmt: x => n(x, 4), color: () => C.muted }, { k: 'ask', label: S.c.ask, align: 'r', fmt: x => n(x, 4), color: () => C.muted },
            { k: 'pu', label: S.c.pu, align: 'r', fmt: x => n(x, 6) },
          ]} />
        </Panel>
        <div className="min-w-0">
          <Panel title={`${S.calc} · ${b.bond} ${dUSfull(b.maturity)}`}>
            <div className="flex flex-wrap items-center gap-3 p-1 text-[12px]">
              <Field label={S.yld}><NumIn value={y == null ? null : +y.toFixed(6)} onChange={v => setY(v)} w={90} /></Field>
              <Field label={S.price}><NumIn value={r ? +r.P.toFixed(6) : null} onChange={v => { if (v && v > 0) setY(solveY(b.flows, v, y ?? b.rate)) }} w={110} /></Field>
              <Field label={S.notional}><NumIn value={face} onChange={setFace} w={100} /></Field>
              <button className="px-2 py-[1px] border text-[12px]" style={{ borderColor: C.line, color: C.amber }} onClick={() => setY(b.rate)}>{S.reset}</button>
            </div>
            {r && <KV cols={2} rows={[
              [S.k.anbima, n(b.pu, 6)], [S.k.bd, String(b.du)],
              [S.k.face, n(r.unit, 6)], ...(b.vna ? [[S.k.vna, n(b.vna, 6)] as [string, string]] : []),
            ]} />}
          </Panel>
          {r && <Panel title={S.risk} className="mt-2"><KV cols={2} rows={[
            [S.k.mac, n(r.mac, 4), C.white], [S.k.mod, n(r.mod, 4), C.white], [S.k.cvx, n(r.cvx, 4)], [S.k.dv01u, n(r.dv1, 6)],
            [S.k.dv01, r.qty != null ? `R$ ${n(r.dv1 * r.qty, 2)}` : '—', C.amber],
          ]} /></Panel>}
          {r && <Panel title={S.spread} className="mt-2"><KV cols={1} rows={b.bond === 'LFT' ? [[S.k.lft, `${sn(y! * 100, 2)} bp`, C.amber]] : [
            [S.k.di, r.di != null ? `${n(r.di, 4)}%` : '—'],
            ...(isPre ? [[S.k.sp, r.di != null ? bps((y! - r.di) * 100, 1) : '—', cl(y! - (r.di ?? y!))], [S.k.z, r.z != null ? bps(r.z, 1) : '—', C.amber]] as any : []),
            ...(b.bond === 'NTN-B' ? [[S.k.be, r.be != null ? `${n(r.be, 3)}%` : '—', C.amber]] as any : []),
          ]} /></Panel>}
          {r && <Panel title={S.invoice} className="mt-2"><KV cols={1} rows={[[S.k.qty, r.qty != null ? n(r.qty, 4) : '—'], [S.k.principal, r.qty != null ? `R$ ${n(r.qty * r.P, 2)}` : '—', C.white]]} /></Panel>}
        </div>
        <div className="min-w-0">
          <Panel title={S.flows}>
            <Grid maxH={300} rows={r?.rows || []} cols={[
              { k: 'date', label: S.fc.date, fmt: x => dUS(x), color: () => C.amber }, { k: 'du', label: S.fc.du, align: 'r' },
              { k: 'cf', label: S.fc.cf, align: 'r', fmt: x => n(x, 6) }, { k: 'pv', label: S.fc.pv, align: 'r', fmt: x => n(x, 6), color: () => C.white },
              { k: 'w', label: S.fc.w, align: 'r', fmt: x => `${n(x, 2)}%` },
            ]} />
          </Panel>
          <Panel title={S.curve} className="mt-2">
            <YasCurve di={d.di1} bonds={bonds.filter(x => x.bond === 'LTN' || x.bond === 'NTN-F')} sel={b} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}
function YasCurve({ di, bonds, sel }: { di: [number, number][]; bonds: Bond[]; sel: Bond }) {
  const fitH = useFitH(230, 120), { active } = useFit(), H = active ? fitH : 220, W = 440, m = { l: 40, r: 8, t: 8, b: 20 }
  const xs = [...di.map(p => p[0]), ...bonds.map(b => b.du)], ys = [...di.map(p => p[1]), ...bonds.map(b => b.rate)]
  const x0 = 0, x1 = Math.max(...xs), y0 = Math.min(...ys) - 0.1, y1 = Math.max(...ys) + 0.1
  const X = (v: number) => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), Y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b)
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ fontFamily: MONO, maxHeight: H }}>
    {Array.from({ length: 5 }, (_, i) => y0 + (y1 - y0) * i / 4).map((t, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="#1c1c1c" /><text x={m.l - 3} y={Y(t) + 3} fontSize={9} fill={C.muted} textAnchor="end">{n(t, 2)}</text></g>)}
    {Array.from({ length: Math.floor(x1 / 252) + 1 }, (_, i) => i * 252).map(t => <text key={t} x={X(t)} y={H - 6} fontSize={9} fill={C.muted} textAnchor="middle">{t / 252}y</text>)}
    <polyline points={di.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke={C.cyan} strokeWidth={1.5} />
    {bonds.map(b => <circle key={b.id} cx={X(b.du)} cy={Y(b.rate)} r={b.id === sel.id ? 4.5 : 2.5} fill={b.bond === 'LTN' ? C.amber : C.white} stroke={b.id === sel.id ? C.down : 'none'}><title>{`${b.id}: ${n(b.rate, 4)}%`}</title></circle>)}
    <text x={m.l + 4} y={m.t + 10} fontSize={10} fill={C.cyan}>━ DI1</text><text x={m.l + 50} y={m.t + 10} fontSize={10} fill={C.amber}>● LTN</text><text x={m.l + 100} y={m.t + 10} fontSize={10} fill={C.white}>● NTN-F</text>
  </svg>
}

// ======================= DRSK =======================
const S_DRSK = {
  title: 'Default Risk – Merton distance-to-default (B3 non-financials)', sector: 'Sector', all: 'All',
  c: { cod: 'Ticker', name: 'Company', sector: 'Sector', dd: 'DD', pd: '1Y PD %', lev: 'Lev. %', sigma_e: 'σE %', sigma_v: 'σV %', mcap: 'Mkt cap', dp: 'Default pt.', bal: 'Balance' },
  sectors: 'Median DD by sector', detail: 'Details', hist: 'DD history (monthly)', pdl: '1Y PD % (risk-neutral)',
  k: { price: 'Price (R$)', mcap: 'Market cap (R$)', st: 'Short-term debt', lt: 'Long-term debt', dp: 'Default point', V: 'Asset value V', sv: 'Asset vol σV', se: 'Equity vol σE', lev: 'Leverage DP/V', dd: 'Distance to default', pd: '1Y PD', bal: 'Balance sheet', sub: 'B3 subsector (PT)' },
  skipped: 'Skipped', banks: 'Banks excluded (deposits are not comparable debt)',
}
const ddColor = (v: number | null) => v == null ? C.text : v < 1.5 ? C.down : v < 3 ? C.yellow : C.up
export function DRSKView() {
  const { data: d, err } = useJSON<any>('drsk.json')
  const [sec, setSec] = useState('All'), [cod, setCod] = useState<string | null>(null)
  const S = S_DRSK
  if (!d) return <FnScreen code="DRSK" title={S.title}><Loading2 err={err} /></FnScreen>
  if (!d.rows?.length) return <FnScreen code="DRSK" title={S.title} source={d.source}><Unavailable what="Distance-to-default" note={d.note} /></FnScreen>
  const rows = (d.rows as any[]).filter(r => sec === 'All' || r.sector === sec).slice().sort((a, b) => (a.dd ?? 99) - (b.dd ?? 99))
  const r = (d.rows as any[]).find(x => x.cod === cod) || rows[0]
  return (
    <FnScreen code="DRSK" title={S.title}
      right={<Field label={S.sector}><select className="bg-black border px-1 py-[1px] text-[12px] outline-none" style={{ borderColor: C.line, color: C.amber, fontFamily: MONO }} value={sec} onChange={e => setSec(e.target.value)}>
        <option value="All">{S.all}</option>{(d.sectors as any[]).map(s => <option key={s.sector} value={s.sector}>{s.sector}</option>)}</select></Field>}
      source={d.source} note={<>{d.method} {S.skipped}: {(d.skipped || []).map((s: any) => `${s.cod} (${s.reason})`).join('; ')}. {S.banks}: {(d.banks_excluded || []).join(', ')}.</>}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={`${rows.length} · ${dUSfull(d.date)} · CDI ${n(d.r_cdi, 2)}%`}>
          <Grid maxH={620} rows={rows} onRow={(x: any) => setCod(x.cod)} rowStyle={(x: any) => x.cod === r?.cod ? { background: '#1f2a44' } : undefined} cols={[
            { k: 'cod', label: S.c.cod, color: () => C.amber }, { k: 'name', label: S.c.name }, { k: 'sector', label: S.c.sector, color: () => C.muted },
            { k: 'dd', label: S.c.dd, align: 'r', fmt: x => n(x, 2), color: x => ddColor(x) },
            { k: 'pd', label: S.c.pd, align: 'r', fmt: x => n(x, x < 0.01 ? 4 : 2), color: x => ddColor(null) && (x > 5 ? C.down : x > 1 ? C.yellow : C.text) },
            { k: 'lev', label: S.c.lev, align: 'r', fmt: x => n(x, 1) }, { k: 'sigma_e', label: S.c.sigma_e, align: 'r', fmt: x => n(x, 1) }, { k: 'sigma_v', label: S.c.sigma_v, align: 'r', fmt: x => n(x, 1) },
            { k: 'mcap', label: S.c.mcap, align: 'r', fmt: x => bigE(x) }, { k: 'dp', label: S.c.dp, align: 'r', fmt: x => bigE(x) },
            { k: 'balance_date', label: S.c.bal, fmt: x => dUS(x), color: () => C.muted },
          ]} />
        </Panel>
        <div className="min-w-0">
          {r && <Panel title={`${r.cod} – ${r.name}`}>
            <KV cols={2} rows={[
              [S.k.dd, n(r.dd, 3), ddColor(r.dd)], [S.k.pd, `${n(r.pd, 4)}%`, ddColor(r.dd)], [S.k.price, n(r.price, 2)], [S.k.mcap, bigE(r.mcap, 2)],
              [S.k.st, bigE(r.st_debt, 2)], [S.k.lt, bigE(r.lt_debt, 2)], [S.k.dp, bigE(r.dp, 2)], [S.k.V, bigE(r.V, 2)],
              [S.k.se, `${n(r.sigma_e, 1)}%`], [S.k.sv, `${n(r.sigma_v, 1)}%`], [S.k.lev, `${n(r.lev, 1)}%`], [S.k.bal, dUSfull(r.balance_date)], [S.k.sub, r.subsector],
            ]} />
          </Panel>}
          {r && <Panel title={S.hist} className="mt-2">
            <FnChart height={200} panes={[{ series: [{ kind: 'line', data: (r.hist || []).map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, title: 'DD', decimals: 2, lines: [{ price: 1.5, color: C.down, title: '1.5' }] }] },
              { stretch: 0.5, series: [{ kind: 'hist', data: (r.hist || []).map((p: any) => ({ time: p[0], value: p[2], color: C.down })), title: S.pdl, decimals: 2 }] }]} />
          </Panel>}
          <Panel title={S.sectors} className="mt-2">
            <HBars rows={(d.sectors as any[]).slice().sort((a, b) => a.median_dd - b.median_dd).map(s => ({ label: `${s.sector} (${s.n})`, v: s.median_dd, color: ddColor(s.median_dd) }))} fmt={(v: number) => n(v, 2)} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= ECTR =======================
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const S_ECTR = {
  title: 'Trade Flows – Brazil exports & imports by partner', tabs: ['Partners', 'Products & monthly'], year: 'Year', flow: 'Flow',
  flows: [{ v: 'both', l: 'Both' }, { v: 'exp', l: 'Exports' }, { v: 'imp', l: 'Imports' }],
  c: { country: 'Partner', exp: 'Exports', imp: 'Imports', tot: 'Total', bal: 'Balance', share: 'Share %', yoy: 'YoY %' },
  chord: 'Brazil ↔ top partners (US$ FOB)', other: 'Other', partial: 'YTD', k: { exp: 'Exports', imp: 'Imports', bal: 'Trade balance', upd: 'Data through' },
  chapExp: 'Top export chapters (YTD)', chapImp: 'Top import chapters (YTD)', monthly: 'Monthly exports vs imports (US$ bn)',
}
const TOPN = 15
export function ECTRView() {
  const { data: d, err } = useJSON<any>('ectr.json')
  const [tab, setTab] = useState(0), [flow, setFlow] = useState<'both' | 'exp' | 'imp'>('both'), [yr, setYr] = useState<number | null>(null)
  const S = S_ECTR
  const year = yr ?? d?.last_year
  const v = useMemo(() => {
    if (!d?.rows?.length) return null
    const g = (o: any, y: number) => o?.[y] ?? o?.[String(y)] ?? 0
    const all = (d.rows as any[]).map(r => ({ country: r.country, exp: g(r.exp, year), imp: g(r.imp, year), pe: g(r.exp, year - 1), pi: g(r.imp, year - 1) }))
      .map(r => ({ ...r, tot: r.exp + r.imp, bal: r.exp - r.imp })).filter(r => r.tot > 0)
    const key = flow === 'both' ? 'tot' : flow
    all.sort((a: any, b: any) => b[key] - a[key])
    const T = all.reduce((s: number, r: any) => s + r[key], 0)
    const rows = all.map((r: any) => ({ ...r, share: T ? r[key] / T * 100 : null, yoy: (flow === 'both' ? r.pe + r.pi : flow === 'exp' ? r.pe : r.pi) ? (r[key] / (flow === 'both' ? r.pe + r.pi : flow === 'exp' ? r.pe : r.pi) - 1) * 100 : null }))
    const top = rows.slice(0, TOPN), rest = rows.slice(TOPN)
    const other = { country: S.other, exp: rest.reduce((s, r) => s + r.exp, 0), imp: rest.reduce((s, r) => s + r.imp, 0) }
    return { rows, chord: [...top, other], tot: (d.totals as any[]).find(t => t.year === year) }
  }, [d, year, flow])
  if (!d) return <FnScreen code="ECTR" title={S.title}><Loading2 err={err} /></FnScreen>
  if (!v) return <FnScreen code="ECTR" title={S.title} source={d.source}><Unavailable what="Comex Stat trade data" note={d.note} /></FnScreen>
  const yrs = (d.years as number[]).slice(-6)
  return (
    <FnScreen code="ECTR" title={S.title} tabs={S.tabs} tab={tab} setTab={setTab}
      right={<><Field label={d.last_month < 12 ? `${S.year} (Jan–${MON[d.last_month - 1]})` : S.year}><Btns opts={yrs.map(y => ({ v: y, l: String(y) }))} value={year} onChange={setYr} /></Field>
        {tab === 0 && <Field label={S.flow}><Btns opts={S.flows} value={flow} onChange={setFlow} /></Field>}</>}
      source={d.source} note={<>{d.unit}. {d.status !== 'ok' && d.note ? d.note : ''} {d.last_month < 12 ? `Partner and total figures cover Jan–${MON[d.last_month - 1]} of every year (same months as the latest data), so YoY is like-for-like.` : ''}</>}>
      <Kpis items={[[S.k.exp, `US$ ${bigE(v.tot?.exp, 2)}`, C.amber], [S.k.imp, `US$ ${bigE(v.tot?.imp, 2)}`, C.blue], [S.k.bal, `US$ ${bigE(v.tot?.bal, 2)}`, cl(v.tot?.bal)], [S.k.upd, `${mLab(`${d.last_year}-${String(d.last_month).padStart(2, '0')}-01`)}${d.updated ? ` (upd. ${dUS(d.updated)})` : ''}`]]} />
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>
        <Panel title={S.chord}><Chord parts={v.chord} flow={flow} /></Panel>
        <Panel title={`${year}`}>
          <Grid maxH={560} rows={v.rows} cols={[
            { k: 'country', label: S.c.country, color: () => C.amber },
            { k: 'exp', label: S.c.exp, align: 'r', fmt: x => bigE(x, 2) }, { k: 'imp', label: S.c.imp, align: 'r', fmt: x => bigE(x, 2) },
            { k: 'tot', label: S.c.tot, align: 'r', fmt: x => bigE(x, 2), color: () => C.white }, { k: 'bal', label: S.c.bal, align: 'r', fmt: x => bigE(x, 2), color: x => cl(x) },
            { k: 'share', label: S.c.share, align: 'r', fmt: x => n(x, 2) }, { k: 'yoy', label: S.c.yoy, align: 'r', fmt: x => pc(x, 1), color: x => cl(x) },
          ]} />
        </Panel>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="min-w-0">
          <Panel title={S.chapExp}><HBars rows={(d.chapters?.exp || []).map((c: any) => ({ label: c.name, v: c.fob / 1e9, color: C.amber }))} fmt={(x: number) => `${n(x, 2)}B`} /></Panel>
          <Panel title={S.chapImp} className="mt-2"><HBars rows={(d.chapters?.imp || []).map((c: any) => ({ label: c.name, v: c.fob / 1e9, color: C.blue }))} fmt={(x: number) => `${n(x, 2)}B`} /></Panel>
        </div>
        <Panel title={S.monthly}>
          <FnChart height={460} panes={[{ series: [
            { kind: 'line', data: (d.monthly || []).filter((m: any) => m.exp != null).map((m: any) => ({ time: m.month + '-01', value: +(m.exp / 1e9).toFixed(3) })), color: C.amber, title: S.k.exp, decimals: 2, width: 2 },
            { kind: 'line', data: (d.monthly || []).filter((m: any) => m.imp != null).map((m: any) => ({ time: m.month + '-01', value: +(m.imp / 1e9).toFixed(3) })), color: C.blue, title: S.k.imp, decimals: 2, width: 2 },
          ] }, { stretch: 0.4, series: [
            { kind: 'hist', data: (d.monthly || []).filter((m: any) => m.exp != null && m.imp != null).map((m: any) => ({ time: m.month + '-01', value: +((m.exp - m.imp) / 1e9).toFixed(3), color: m.exp >= m.imp ? C.up : C.down })), title: S.k.bal, decimals: 2 },
          ] }]} />
        </Panel>
      </div>}
    </FnScreen>
  )
}
/** Diagrama de cordas: arco do Brasil (esquerda) ligado aos parceiros (direita); fitas âmbar = exportações, azuis = importações */
function Chord({ parts, flow }: { parts: { country: string; exp: number; imp: number }[]; flow: 'both' | 'exp' | 'imp' }) {
  const fitH = useFitH(470, 220), { active } = useFit(), S = active ? fitH : 380
  const W = S + 260, cx = W / 2, cy = S / 2, R = S / 2 - 16, R2 = R - 10
  const [hov, setHov] = useState<string | null>(null)
  const use = (p: any) => (flow !== 'imp' ? p.exp : 0) + (flow !== 'exp' ? p.imp : 0)
  const T = parts.reduce((s, p) => s + use(p), 0) || 1
  const gap = 0.012, half = Math.PI - 0.08, avail = half - gap * parts.length
  const pt = (a: number, r = R2) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const arc = (a0: number, a1: number, r: number) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}` }
  // parceiros: lado direito de -π/2+.04 a π/2-.04; Brasil: lado esquerdo π/2+.04 a 3π/2-.04
  let pa = -Math.PI / 2 + 0.04, ba = Math.PI / 2 + 0.04
  const segs: any[] = []
  parts.forEach(p => {
    const f = [...(flow !== 'imp' ? [['exp', p.exp]] : []), ...(flow !== 'exp' ? [['imp', p.imp]] : [])] as [string, number][]
    const a0 = pa
    f.forEach(([k, v]) => { const w = v / T * avail; segs.push({ c: p.country, k, v, p0: pa, p1: pa + w, b0: ba, b1: ba + w }); pa += w; ba += w })
    segs.push({ label: p.country, a0, a1: pa, tot: use(p) }); pa += gap; ba += gap
  })
  const ribbons = segs.filter(s => s.k), labels = segs.filter(s => s.label)
  const rib = (s: any) => { const [px0, py0] = pt(s.p0), [bx1, by1] = pt(s.b1); return `${arc(s.p0, s.p1, R2)} Q${cx},${cy} ${pt(s.b0).join(',')} A${R2},${R2} 0 0 1 ${bx1},${by1} Q${cx},${cy} ${px0},${py0}Z` }
  return <div className="w-full overflow-hidden" style={{ fontFamily: MONO }}>
    <svg viewBox={`0 0 ${W} ${S}`} className="block mx-auto" style={{ width: '100%', maxHeight: S }}>
      {ribbons.map((s, i) => <path key={i} d={rib(s)} fill={s.k === 'exp' ? C.amber : C.blue} opacity={hov == null ? 0.55 : hov === s.c ? 0.9 : 0.08} onMouseEnter={() => setHov(s.c)} onMouseLeave={() => setHov(null)}><title>{`Brazil ${s.k === 'exp' ? '→' : '←'} ${s.c}: US$ ${bigE(s.v, 2)}`}</title></path>)}
      <path d={arc(Math.PI / 2 + 0.04, ba - gap, R)} stroke={C.up} strokeWidth={12} fill="none" />
      <text x={cx - R - 8} y={cy} fontSize={13} fill={C.up} textAnchor="end">BRAZIL</text>
      {labels.map((s, i) => { const m = (s.a0 + s.a1) / 2, [x, y] = pt(m, R + 14); return <g key={i} onMouseEnter={() => setHov(s.label)} onMouseLeave={() => setHov(null)}>
        <path d={arc(s.a0, s.a1, R)} stroke={C.white} strokeWidth={12} fill="none" opacity={hov == null || hov === s.label ? 1 : 0.3} />
        {s.a1 - s.a0 > 0.035 && <text x={x} y={y + 4} fontSize={10.5} fill={hov === s.label ? C.amber : C.text}>{s.label.length > 22 ? s.label.slice(0, 21) + '…' : s.label} <tspan fill={C.muted}>{n(s.tot / T * 100, 1)}%</tspan></text>}
      </g> })}
    </svg>
    <div className="flex gap-4 text-[11px] px-1"><span style={{ color: C.amber }}>■ Exports</span><span style={{ color: C.blue }}>■ Imports</span><span style={{ color: C.muted }}>Hover a partner to isolate</span></div>
  </div>
}
