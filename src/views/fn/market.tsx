'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFit, FitBox, FnScreen, Panel, Grid, Btns, Field, KV, Loading, Spark, C, nf, pf, big, dBR, dBRfull, clr, useJSON, retSince, isoMinus, inputCls, inputStyle, PALETTE } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import XYChart from '../../components/fn/XYChart'
import { href } from '../../lib/static'
import { mean, std, maxDrawdown, regress } from '../../lib/quant'

const lastIdx = (a: (number | null)[]) => { let i = a.length - 1; while (i >= 0 && a[i] == null) i--; return i }
const prevVal = (a: (number | null)[], i: number) => { let j = i - 1; while (j >= 0 && a[j] == null) j--; return j >= 0 ? a[j] : null }

// ---------------- WEI ----------------
export function WEIView() {
  const { data: d, err } = useJSON<any>('world.json')
  const [sel, setSel] = useState<any>(null)
  if (!d) return <FnScreen code="WEI"><Loading err={err} /></FnScreen>
  const rowsOf = (r: any) => r.rows.map((x: any) => {
    const i = lastIdx(x.close), last = x.close[i], prev = prevVal(x.close, i), dt = x.dates[i]
    return { ...x, last, chg: last != null && prev != null ? last - prev : null, pct: last != null && prev != null ? (last / prev - 1) * 100 : null, date: dt, ytd: retSince(x.dates, x.close, `${dt.slice(0, 4)}-01-00`), y1: retSince(x.dates, x.close, isoMinus(dt, 0, 0, 1)), m1: retSince(x.dates, x.close, isoMinus(dt, 0, 1)), spark: x.close.slice(-22) }
  })
  const cur = sel || d.regions[0].rows.find((x: any) => x.ticker === '^BVSP') || d.regions[0].rows[0]
  return (
    <FnScreen code="WEI" title="World Equity Indices" source="Yahoo Finance via yfinance (fechamentos diários dos índices), tools/pipeline/build_markets.py." note="Valores de fechamento (não tempo real). Clique numa linha para ver o gráfico de 2 anos. Sparkline = último mês.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="flex flex-col gap-2">{d.regions.map((r: any) => (
          <Panel key={r.region} title={r.region}>
            <Grid onRow={(x: any) => setSel(x)} rowStyle={(x: any) => x.ticker === cur.ticker ? { background: '#1a1205' } : undefined} cols={[
              { k: 'name', label: 'Índice', color: () => C.amber, w: '170px' }, { k: 'last', label: 'Valor', align: 'r', fmt: v => nf(v) }, { k: 'chg', label: 'Var', align: 'r', fmt: v => nf(v), color: clr }, { k: 'pct', label: 'Var%', align: 'r', fmt: v => pf(v), color: clr },
              { k: 'spark', label: '1M', align: 'c', fmt: v => <Spark data={v} w={70} h={14} /> }, { k: 'm1', label: '1M%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'ytd', label: 'Ano%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'y1', label: '12M%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'date', label: 'Data', align: 'r', fmt: dBR }]} rows={rowsOf(r)} />
          </Panel>))}</div>
        <Panel title={`${cur.name} (${cur.ticker}) — 2 anos`}>
          <FnChart height={420} panes={[{ series: [{ kind: 'area', data: cur.dates.map((t: string, i: number) => ({ time: t, value: cur.close[i] })).filter((p: any) => p.value != null), color: C.amber, title: cur.name }] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ---------------- WFI ----------------
export function WFIView() {
  const { data: d, err } = useJSON<any>('wfi.json')
  const [tab, setTab] = useState(0)
  if (!d) return <FnScreen code="WFI"><Loading err={err} /></FnScreen>
  const uc = d.us_curve, tn = uc.tenors as number[]
  const ret = (p: [string, number][], months: number) => { const t = isoMinus(p[p.length - 1][0], 0, months); const b = p.filter(x => x[0] <= t).pop(); return b ? (p[p.length - 1][1] / b[1] - 1) * 100 : null }
  const chgBp = (p: [string, number][], months: number) => { const t = isoMinus(p[p.length - 1][0], 0, months); const b = p.filter(x => x[0] <= t).pop(); return b ? (p[p.length - 1][1] - b[1]) * 100 : null }
  return (
    <FnScreen code="WFI" title="World Fixed Income" tabs={['Curva EUA', 'Soberanos 10 anos', 'Crédito (índices / spreads)', 'Brasil']} tab={tab} setTab={setTab}
      source="FRED (St. Louis Fed): Treasuries (DGS*), OCDE 10 anos (IRLTLT01*), ICE BofA índices e OAS; BCB SGS (Selic/CDI)."
      note="Curva de juros brasileira (DI/NTN) ausente: o Tesouro Direto e a B3 não oferecem mais arquivo público estável para automação. Soberanos OCDE são médias mensais.">
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 360px' }}>
        <XYChart height={480} series={[['y1', '#555', '1 ano atrás'], ['m1', '#888', '1 mês atrás'], ['w1', C.blue, '1 semana atrás'], ['now', C.amber, 'Atual']].map(([k, c, n]) => ({ name: `${n} (${dBR(uc[k].date)})`, points: tn.map((t, i) => [t, uc[k].y[i]] as [number, number]), color: c, width: k === 'now' ? 2.5 : 1.3 }))} xTicks={tn.filter(t => t >= 1 || t === tn[0]).map((t, i) => ({ v: t, l: uc.labels[tn.indexOf(t)] }))} xFmt={v => `${nf(v, 1)}a`} yFmt={v => nf(v, 2) + '%'} />
        <Panel title="US Treasuries"><Grid cols={[{ k: 'l', label: 'Prazo', color: () => C.amber }, { k: 'now', label: 'Taxa', align: 'r', fmt: v => nf(v, 2) }, { k: 'w', label: '1S bp', align: 'r', fmt: v => nf(v, 0), color: clr }, { k: 'm', label: '1M bp', align: 'r', fmt: v => nf(v, 0), color: clr }, { k: 'y', label: '1A bp', align: 'r', fmt: v => nf(v, 0), color: clr }]} rows={tn.map((_, i) => ({ l: uc.labels[i], now: uc.now.y[i], w: (uc.now.y[i] - uc.w1.y[i]) * 100, m: (uc.now.y[i] - uc.m1.y[i]) * 100, y: (uc.now.y[i] - uc.y1.y[i]) * 100 }))} /></Panel>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="Rendimento 10 anos (% a.a.)"><Grid cols={[{ k: 'name', label: 'País', color: () => C.amber }, { k: 'last', label: 'Último', align: 'r', fmt: v => nf(v, 2) }, { k: 'date', label: 'Ref.', align: 'r', fmt: v => v?.slice(0, 7) }, { k: 'm1', label: '1M bp', align: 'r', fmt: v => nf(v, 0), color: clr }, { k: 'y1', label: '1A bp', align: 'r', fmt: v => nf(v, 0), color: clr }, { k: 'sp', label: '24M', align: 'c', fmt: v => <Spark data={v} w={80} h={14} /> }]} rows={d.sovereign10y.map((s: any) => ({ name: s.name, last: s.points[s.points.length - 1][1], date: s.points[s.points.length - 1][0], m1: chgBp(s.points, 1), y1: chgBp(s.points, 12), sp: s.points.slice(-24).map((p: any) => p[1]) }))} /></Panel>
        <Panel title="Histórico (países selecionados)"><FnChart height={440} panes={[{ series: d.sovereign10y.filter((s: any) => ['US', 'DE', 'JP', 'GB', 'IT', 'MX'].includes(s.country)).map((s: any, i: number) => ({ kind: 'line' as const, data: s.points.map((p: any) => ({ time: p[0], value: p[1] })), color: PALETTE[i], title: s.country, pct: true })) }]} /></Panel>
      </div>}
      {tab === 2 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="Índices de retorno total (ICE BofA)"><Grid cols={[{ k: 'name', label: 'Índice', color: () => C.amber }, { k: 'last', label: 'Nível', align: 'r', fmt: v => nf(v, 1) }, { k: 'm1', label: '1M%', align: 'r', fmt: v => pf(v), color: clr }, { k: 'ytd', label: 'Ano%', align: 'r', fmt: v => pf(v), color: clr }, { k: 'y1', label: '12M%', align: 'r', fmt: v => pf(v), color: clr }]} rows={d.indexes.map((s: any) => { const p = s.points; const lt = p[p.length - 1]; return { name: s.name, last: lt[1], m1: ret(p, 1), y1: ret(p, 12), ytd: retSince(p.map((x: any) => x[0]), p.map((x: any) => x[1]), `${lt[0].slice(0, 4)}-01-00`) } })} />
          <div className="mt-2"><Grid cols={[{ k: 'name', label: 'Spread (OAS)', color: () => C.amber }, { k: 'last', label: 'bp', align: 'r', fmt: v => nf(v, 0) }, { k: 'm1', label: '1M bp', align: 'r', fmt: v => nf(v, 0), color: clr }, { k: 'y1', label: '1A bp', align: 'r', fmt: v => nf(v, 0), color: clr }]} rows={d.spreads.map((s: any) => ({ name: s.name, last: s.points[s.points.length - 1][1] * 100, m1: chgBp(s.points, 1), y1: chgBp(s.points, 12) }))} /></div></Panel>
        <Panel title="Spreads OAS (p.p.)"><FnChart height={440} panes={[{ series: d.spreads.map((s: any, i: number) => ({ kind: 'line' as const, data: s.points.map((p: any) => ({ time: p[0], value: p[1] })), color: [C.amber, C.down, C.blue][i], title: s.id })) }]} /></Panel>
      </div>}
      {tab === 3 && <Panel title="Brasil — juros de referência"><KV rows={[['Selic meta (Copom)', `${nf(d.br.selic.v)}% a.a.`, C.amber], ['Vigência', dBRfull(d.br.selic.date)], ['CDI anualizado (252)', `${nf(d.br.cdi_aa.v)}% a.a.`, C.amber], ['Data CDI', dBRfull(d.br.cdi_aa.date)], ['Curva DI / NTN-B', 'indisponível em fonte aberta automatizável (ver nota)', C.muted]]} /></Panel>}
    </FnScreen>
  )
}

// ---------------- ECON ----------------
export function ECONView() {
  const { data: d, err } = useJSON<any>('econ.json')
  const [sel, setSel] = useState<string>('SGS13522')
  if (!d) return <FnScreen code="ECON"><Loading err={err} /></FnScreen>
  const rows = (cty: string) => d.series.filter((s: any) => s.country === cty).map((s: any) => { const p = s.points, n = p.length; return { ...s, last: p[n - 1]?.[1], prev: p[n - 2]?.[1], date: p[n - 1]?.[0], chg: n > 1 ? p[n - 1][1] - p[n - 2][1] : null, spark: p.slice(-24).map((x: any) => x[1]) } })
  const s = d.series.find((x: any) => x.id === sel)
  const cols = [{ k: 'name', label: 'Indicador', color: () => C.amber }, { k: 'date', label: 'Ref.', align: 'r' as const, fmt: (v: string, r: any) => r.freq === 'D' ? dBR(v) : v?.slice(0, 7) }, { k: 'last', label: 'Último', align: 'r' as const, fmt: (v: number) => nf(v, Math.abs(v) > 1000 ? 0 : 2) }, { k: 'prev', label: 'Anterior', align: 'r' as const, fmt: (v: number) => nf(v, Math.abs(v) > 1000 ? 0 : 2) }, { k: 'chg', label: 'Var', align: 'r' as const, fmt: (v: number) => nf(v, 2), color: clr }, { k: 'unit', label: 'Unid.', color: () => C.muted }, { k: 'spark', label: 'Tend.', align: 'c' as const, fmt: (v: any) => <Spark data={v} w={70} h={14} /> }]
  const focus = d.focus as any[]
  const fInd = Array.from(new Set(focus.map(f => f.indicator))), fYears = Array.from(new Set(focus.map(f => f.year))).sort()
  return (
    <FnScreen code="ECON" title="Economic Indicators / Expectativas" source="BCB SGS e Relatório Focus (API Olinda), FRED; tools/pipeline/build_markets.py." note="Clique num indicador para ver o histórico. Não há calendário de divulgações com consenso/previsão por evento (dado proprietário); a coluna de expectativas usa as medianas do Focus.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="flex flex-col gap-2">
          <Panel title="Brasil"><Grid onRow={(r: any) => setSel(r.id)} rowStyle={(r: any) => r.id === sel ? { background: '#1a1205' } : undefined} cols={cols} rows={rows('BR')} /></Panel>
          <Panel title="Estados Unidos"><Grid onRow={(r: any) => setSel(r.id)} rowStyle={(r: any) => r.id === sel ? { background: '#1a1205' } : undefined} cols={cols} rows={rows('US')} /></Panel>
        </div>
        <div className="flex flex-col gap-2">
          <Panel title={`${s?.name} (${s?.unit}) — ${s?.source || ''}`}><FnChart height={300} panes={[{ series: [{ kind: s?.freq === 'M' && /variação|saldo/.test(s?.name) ? 'hist' : 'line', data: (s?.points || []).map((p: any) => ({ time: p[0], value: p[1], color: p[1] >= 0 ? C.amber : C.down })), color: C.amber, title: (s?.name || '').split(' – ')[0].slice(0, 18), decimals: 2 }] }]} /></Panel>
          <Panel title={`Focus — medianas (${dBR(focus[0]?.date)})`}>
            <table className="w-full text-[12px]"><thead><tr><th className="px-2 py-1 text-left font-normal" style={{ color: C.amber }}>Indicador</th>{fYears.map(y => <th key={y} className="px-2 py-1 text-right font-normal" style={{ color: C.amber }}>{y}</th>)}</tr></thead>
              <tbody>{fInd.map(ind => <tr key={ind} className="border-t" style={{ borderColor: '#1a1a1a' }}><td className="px-2 py-[2px]">{ind}</td>{fYears.map(y => { const f = focus.find(x => x.indicator === ind && x.year === y); return <td key={y} className="px-2 py-[2px] text-right">{f ? nf(f.median, 2) : '—'}</td> })}</tr>)}</tbody></table>
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ---------------- FX ----------------
const CCY = ['USD', 'BRL', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'MXN']
export function FXView() {
  const { data: d, err } = useJSON<any>('fx.json')
  const [tab, setTab] = useState(0)
  const [pair, setPair] = useState('BRL')
  if (!d) return <FnScreen code="FX"><Loading err={err} /></FnScreen>
  const up = (c: string, i: number) => c === 'USD' ? 1 : d.usd_per[c]?.[i]
  const L = d.dates.length - 1
  const at = (c: string, i: number) => { let j = i; while (j > 0 && up(c, j) == null) j--; return up(c, j) }
  // convenção: quantidade da moeda da LINHA por 1 unidade da moeda da COLUNA
  const x = (row: string, col: string, i: number) => at(row, i) / at(col, i)
  const ptax = d.ptax?.USD || []
  return (
    <FnScreen code="FX" title="Currency Monitor" tabs={['Matriz cruzada', 'Variação 1D %', 'PTAX (BCB)', 'DXY / USDBRL']} tab={tab} setTab={setTab}
      source="Yahoo Finance (fechamento de moedas vs USD, DXY) e BCB PTAX (API Olinda); tools/pipeline/build_markets.py." note="Matriz: unidades da moeda da linha por 1 unidade da moeda da coluna. Cruzamentos derivados via USD. Fechamentos diários, não tempo real.">
      {tab <= 1 && <div className="overflow-auto"><table className="border-collapse text-[12px] w-full">
        <thead><tr><th className="px-2 py-1" style={{ color: C.muted }}>{dBRfull(d.dates[L])}</th>{CCY.map(c => <th key={c} className="px-2 py-1 text-right" style={{ color: C.amber }}>{c}</th>)}</tr></thead>
        <tbody>{CCY.map(r => <tr key={r} className="border-t" style={{ borderColor: '#1a1a1a' }}><td className="px-2 py-1 font-bold" style={{ color: C.amber }}>{r}</td>{CCY.map(c => { if (r === c) return <td key={c} className="px-2 py-1 text-right" style={{ background: '#111', color: C.muted }}>—</td>; const v = x(r, c, L), p = x(r, c, L - 1), ch = (v / p - 1) * 100; return <td key={c} className="px-2 py-1 text-right border border-[#151515]" style={tab === 1 ? { background: `rgba(${ch >= 0 ? '61,220,132' : '255,77,77'},${Math.min(0.8, Math.abs(ch) / 1.5)})` } : undefined}>{tab === 0 ? nf(v, v >= 100 ? 2 : 4) : pf(ch)}</td> })}</tr>)}</tbody>
      </table></div>}
      {tab === 2 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="PTAX — último boletim"><Grid cols={[{ k: 'c', label: 'Moeda', color: () => C.amber }, { k: 'date', label: 'Data', fmt: dBRfull }, { k: 'buy', label: 'Compra', align: 'r', fmt: v => nf(v, 4) }, { k: 'sell', label: 'Venda', align: 'r', fmt: v => nf(v, 4) }, { k: 'ch', label: 'Var%', align: 'r', fmt: v => pf(v), color: clr }]} rows={Object.entries(d.ptax).map(([c, a]: any) => ({ c, ...a[a.length - 1], ch: a.length > 1 ? (a[a.length - 1].sell / a[a.length - 2].sell - 1) * 100 : null }))} /></Panel>
        <Panel title="PTAX USD venda"><FnChart height={380} panes={[{ series: [{ kind: 'line', data: ptax.map((p: any) => ({ time: p.date, value: p.sell })), color: C.amber, title: 'PTAX', decimals: 4 }] }]} /></Panel>
      </div>}
      {tab === 3 && <div><div className="pb-1"><Btns opts={CCY.filter(c => c !== 'USD')} value={pair} onChange={setPair} /></div>
        <FnChart height={560} panes={[{ stretch: 0.5, series: [{ kind: 'line', data: d.dates.map((t: string, i: number) => ({ time: t, value: d.usd_per[pair][i] })).filter((p: any) => p.value != null), color: C.amber, title: `USD${pair}`, decimals: 4 }] }, { stretch: 0.5, series: [{ kind: 'line', data: d.dates.map((t: string, i: number) => ({ time: t, value: d.dxy[i] })).filter((p: any) => p.value != null), color: C.white, title: 'DXY' }] }]} /></div>}
    </FnScreen>
  )
}

// ---------------- HEAT (treemap) ----------------
type TM = { x: number; y: number; w: number; h: number }
function squarify<T extends { v: number }>(items: T[], r: TM): (T & TM)[] {
  const out: (T & TM)[] = []; const tot = items.reduce((s, i) => s + i.v, 0); if (!tot) return out
  const sc = (r.w * r.h) / tot; let rest = items.slice().sort((a, b) => b.v - a.v).map(i => ({ ...i, a: i.v * sc })); let rr = { ...r }
  const worst = (row: any[], side: number) => { const s = row.reduce((p, i) => p + i.a, 0); const mx = Math.max(...row.map(i => i.a)), mn = Math.min(...row.map(i => i.a)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)) }
  while (rest.length) {
    const side = Math.min(rr.w, rr.h); let row = [rest[0]]; let k = 1
    while (k < rest.length && worst([...row, rest[k]], side) <= worst(row, side)) { row.push(rest[k]); k++ }
    const s = row.reduce((p, i) => p + i.a, 0)
    if (rr.w >= rr.h) { const w = s / rr.h; let y = rr.y; row.forEach(i => { const h = i.a / w; out.push({ ...(i as any), x: rr.x, y, w, h }); y += h }); rr = { x: rr.x + w, y: rr.y, w: rr.w - w, h: rr.h } }
    else { const h = s / rr.w; let x = rr.x; row.forEach(i => { const w = i.a / h; out.push({ ...(i as any), x, y: rr.y, w, h }); x += w }); rr = { x: rr.x, y: rr.y + h, w: rr.w, h: rr.h - h } }
    rest = rest.slice(k)
  }
  return out
}
const PER = [{ v: '1D', l: '1D' }, { v: '1S', l: '1S' }, { v: '1M', l: '1M' }, { v: 'YTD', l: 'Ano' }, { v: '1A', l: '12M' }]
// A carteira teórica da B3 grafa o mesmo setor de formas diferentes (ex.: 'Financ e Outros' / 'Financeiro e Outros')
const normSector = (x: string) => (x || '').replace(/\s+/g, ' ').replace(/^Financeiro e Outros$/, 'Financ e Outros').replace(/^Cons N Básico$/, 'Cons N Básico').trim()

function useUniverseChanges(per: string) {
  const { data: u, err } = useJSON<any>('universe.json')
  const rows = useMemo(() => {
    if (!u) return null
    const dates = u.dates as string[], L = dates.length - 1
    const tgt = per === '1D' ? dates[L - 1] : per === '1S' ? isoMinus(dates[L], 7) : per === '1M' ? isoMinus(dates[L], 0, 1) : per === 'YTD' ? `${dates[L].slice(0, 4)}-01-00` : isoMinus(dates[L], 0, 0, 1)
    return u.components.map((c: any) => { const cl = u.close[c.cod] || []; const i = lastIdx(cl); const fv = u.fin_volume_30d?.[c.cod]; return { ...c, sector: normSector(c.sector), last: cl[i], chg: per === '1D' ? (cl[i] != null && prevVal(cl, i) != null ? (cl[i] / (prevVal(cl, i) as number) - 1) * 100 : null) : retSince(dates, cl, tgt), vol: Array.isArray(fv) ? (fv.length ? fv.reduce((a: number, b: number) => a + (b || 0), 0) / fv.length : null) : fv } })
  }, [u, per])
  const ibov = u ? (() => { const cl = u.close['^BVSP']; const i = lastIdx(cl); return { last: cl[i], date: u.dates[i], chg: (cl[i] / (prevVal(cl, i) as number) - 1) * 100 } })() : null
  return { u, rows, err, ibov }
}
const heatColor = (v: number | null, s: number) => v == null ? '#222' : v >= 0 ? `rgb(${Math.round(20 + 10 * Math.min(1, v / s))},${Math.round(70 + 120 * Math.min(1, v / s))},${Math.round(40 + 50 * Math.min(1, v / s))})` : `rgb(${Math.round(70 + 150 * Math.min(1, -v / s))},${Math.round(30 + 10 * Math.min(1, -v / s))},${Math.round(30 + 10 * Math.min(1, -v / s))})`
function HeatMap({ rows, scale }: { rows: any[]; scale: number }) {
  // desktop: preenche a área disponível (largura medida × altura elástica); mobile: proporção fixa 1400×720
  const { s, active } = useFit()
  const ref = useRef<HTMLDivElement | null>(null)
  const [bw, setBw] = useState(1400)
  useEffect(() => { const el = ref.current; if (!el) return; const f = () => setBw(el.clientWidth || 1400); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect() }, [])
  // mobile/tablet (<1024px): largura do painel e altura fixa legível (retrato), toque mostra o detalhe
  const [tip, setTip] = useState<any>(null)
  const W = active ? Math.max(600, bw) : Math.max(300, bw), H = active ? Math.max(260, Math.round(720 * s)) : Math.round(Math.min(680, Math.max(420, bw * 1.35)))
  const sectors = Array.from(new Set(rows.map((r: any) => r.sector))).map(s => ({ s, v: rows.filter((r: any) => r.sector === s).reduce((p: number, r: any) => p + r.weight, 0) }))
  const secRects = squarify(sectors as any[], { x: 0, y: 0, w: W, h: H })
  return <div ref={ref} style={{ width: '100%' }}>
      {!active && <div className="mb-1 min-h-[34px] px-2 py-1 text-[12px] leading-[16px] border" style={{ borderColor: C.line, background: C.panel, color: C.text }}>
        {tip ? <><b style={{ color: C.amber }}>{tip.cod}</b> {tip.name}<br /><span style={{ color: clr(tip.chg) }}>{pf(tip.chg)}</span> · peso {nf(tip.weight, 2)}% · R$ {nf(tip.last)}</> : <span style={{ color: C.muted }}>Toque num papel para ver variação, peso e preço.</span>}
      </div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={active ? H : undefined} style={{ display: 'block', background: '#000', fontFamily: 'inherit' }}>
        {secRects.map((sr: any) => {
          const items = squarify(rows.filter((r: any) => r.sector === sr.s).map((r: any) => ({ ...r, v: r.weight })), { x: sr.x + 1, y: sr.y + 16, w: sr.w - 2, h: sr.h - 17 })
          return <g key={sr.s}>
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} fill="#000" stroke="#000" />
            <text x={sr.x + 4} y={sr.y + 12} fontSize={11} fill={C.amber}>{sr.s} {nf(sr.v, 1)}%</text>
            {items.map((it: any) => <g key={it.cod} onClick={active ? undefined : () => setTip(it)} style={active ? undefined : { cursor: 'pointer' }}><title>{`${it.cod} ${it.name}\n${pf(it.chg)} | peso ${nf(it.weight, 2)}% | R$ ${nf(it.last)}`}</title>
              <rect x={it.x} y={it.y} width={Math.max(0, it.w - 1)} height={Math.max(0, it.h - 1)} fill={heatColor(it.chg, scale)} stroke={!active && tip?.cod === it.cod ? C.amber : undefined} strokeWidth={!active && tip?.cod === it.cod ? 2 : undefined} />
              {it.w > 38 && it.h > 22 && <><text x={it.x + it.w / 2} y={it.y + it.h / 2 - 1} textAnchor="middle" fontSize={Math.min(16, Math.max(9, it.w / 6))} fill="#fff" fontWeight={700}>{it.cod}</text><text x={it.x + it.w / 2} y={it.y + it.h / 2 + 12} textAnchor="middle" fontSize={Math.min(13, Math.max(8, it.w / 7))} fill="#fff">{pf(it.chg, 1)}</text></>}
            </g>)}
          </g>
        })}
      </svg>
  </div>
}

export function HEATView() {
  const [per, setPer] = useState('1D')
  const { rows, err, u, ibov } = useUniverseChanges(per)
  if (!rows) return <FnScreen code="HEAT"><Loading err={err} /></FnScreen>
  const scale = per === '1D' ? 3 : per === '1S' ? 6 : per === '1M' ? 10 : 25
  return (
    <FnScreen code="HEAT" title="Mapa de calor — Ibovespa por setor" right={<><span>IBOV <b style={{ color: C.amber }}>{nf(ibov?.last, 0)}</b> <span style={{ color: clr(ibov?.chg) }}>{pf(ibov?.chg)}</span></span><Btns opts={PER} value={per} onChange={setPer} /></>}
      source={`B3 — carteira teórica do Ibovespa (${u?.date_portfolio || ''}) + fechamentos Yahoo Finance.`} note={`Área = peso na carteira teórica; cor = variação no período (escala ±${scale}%). Agrupado por setor B3.`}>
      <HeatMap rows={rows} scale={scale} />
    </FnScreen>
  )
}

// ---------------- TOP ----------------
export function TOPView() {
  const [per, setPer] = useState('1D')
  const { rows, err, ibov } = useUniverseChanges(per)
  if (!rows) return <FnScreen code="TOP"><Loading err={err} /></FnScreen>
  const v = rows.filter((r: any) => r.chg != null)
  const up = v.slice().sort((a: any, b: any) => b.chg - a.chg).slice(0, 15), dn = v.slice().sort((a: any, b: any) => a.chg - b.chg).slice(0, 15)
  const act = v.slice().sort((a: any, b: any) => (b.vol || 0) - (a.vol || 0)).slice(0, 15)
  const adv = v.filter((r: any) => r.chg > 0).length, dec = v.filter((r: any) => r.chg < 0).length
  const cols = [{ k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Nome' }, { k: 'last', label: 'Últ', align: 'r' as const, fmt: (x: number) => nf(x) }, { k: 'chg', label: 'Var%', align: 'r' as const, fmt: (x: number) => pf(x), color: clr }, { k: 'weight', label: 'Peso', align: 'r' as const, fmt: (x: number) => nf(x, 2) }]
  return (
    <FnScreen code="TOP" title="Maiores altas / baixas — Ibovespa" right={<><span>Altas <b style={{ color: C.up }}>{adv}</b> · Baixas <b style={{ color: C.down }}>{dec}</b></span><span>IBOV <span style={{ color: clr(ibov?.chg) }}>{pf(ibov?.chg)}</span></span><Btns opts={PER} value={per} onChange={setPer} /></>}
      source="B3 (carteira teórica do Ibovespa) + Yahoo Finance (fechamento); volume financeiro médio 30d." note="Universo: componentes do Ibovespa. Fechamentos, não tempo real.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Panel title="▲ Maiores altas"><Grid cols={cols} rows={up} /></Panel>
        <Panel title="▼ Maiores baixas"><Grid cols={cols} rows={dn} /></Panel>
        <Panel title="Mais negociadas (vol. fin. 30d)"><Grid cols={[cols[0], { k: 'vol', label: 'R$/dia', align: 'r' as const, fmt: (x: number) => big(x) }, cols[3]]} rows={act} /></Panel>
      </div>
      <div className="mt-2"><Panel title="Distribuição das variações (ordenadas)"><XYChart height={200} legend={false} zeroLine series={[{ name: 'Var%', points: v.slice().sort((a: any, b: any) => a.chg - b.chg).map((r: any, i: number) => [i + 1, r.chg] as [number, number]), color: C.amber, width: 2 }]} xFmt={x => `#${Math.round(x)}`} yFmt={y => nf(y, 1) + '%'} /></Panel></div>
    </FnScreen>
  )
}

// ---------------- CAL ----------------
export function CALView() {
  const { data: d, err } = useJSON<any>('calendar.json')
  const [tab, setTab] = useState(0)
  const [ym, setYm] = useState<string | null>(null)
  if (!d) return <FnScreen code="CAL"><Loading err={err} /></FnScreen>
  const today = new Date().toISOString().slice(0, 10)
  const ev: { date: string; t: string; kind: string; name: string; link?: string }[] = []
  d.rows.forEach((r: any) => { (r.earnings || []).forEach((e: string) => ev.push({ date: e, t: r.ticker, kind: 'Resultado', name: r.name })); if (r.ex_div) ev.push({ date: r.ex_div, t: r.ticker, kind: 'Data-ex', name: r.name }) })
  ev.sort((a, b) => a.date.localeCompare(b.date))
  const m = ym || today.slice(0, 7)
  const [Y, M] = m.split('-').map(Number), first = new Date(Date.UTC(Y, M - 1, 1)).getUTCDay(), nd = new Date(Date.UTC(Y, M, 0)).getUTCDate()
  const shift = (k: number) => { const dt = new Date(Date.UTC(Y, M - 1 + k, 1)); setYm(dt.toISOString().slice(0, 7)) }
  return (
    <FnScreen code="CAL" title="Calendário corporativo — Ibovespa" tabs={['Mês', 'Lista', 'Por empresa']} tab={tab} setTab={setTab}
      source="Yahoo Finance (datas de resultado/ex-dividendo) + CVM IPE (Calendário de Eventos Corporativos e últimos documentos de resultados)." note="Datas de resultado do Yahoo podem ser estimadas; o calendário oficial anual que cada companhia envia à CVM está linkado na aba 3.">
      {tab === 0 && <div>
        <div className="flex items-center gap-2 pb-2 text-[13px]"><button onClick={() => shift(-1)} style={{ color: C.amber }}>◀</button><b style={{ color: C.amber }}>{['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][M - 1]} {Y}</b><button onClick={() => shift(1)} style={{ color: C.amber }}>▶</button><span className="text-[11px]" style={{ color: C.muted }}><span style={{ color: C.cyan }}>■</span> resultado <span style={{ color: C.up }}>■</span> data-ex</span></div>
        <FitBox base={640} min={160} className="overflow-y-auto"><div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', border: `1px solid ${C.line}` }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(w => <div key={w} className="px-2 py-1 text-[11px]" style={{ background: C.panel2, color: C.amber }}>{w}</div>)}
          {Array.from({ length: first }).map((_, i) => <div key={'e' + i} style={{ borderTop: `1px solid ${C.line}` }} />)}
          {Array.from({ length: nd }).map((_, i) => { const ds = `${m}-${String(i + 1).padStart(2, '0')}`; const es = ev.filter(e => e.date === ds); return (
            <div key={ds} className="p-1 text-[11px]" style={{ minHeight: 92, borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}`, background: ds === today ? '#1a1205' : undefined }}>
              <div style={{ color: ds === today ? C.amber : C.muted }}>{i + 1}</div>
              {es.slice(0, 6).map((e, k) => <div key={k} style={{ color: e.kind === 'Resultado' ? C.cyan : C.up }}>{e.t}</div>)}{es.length > 6 && <div style={{ color: C.muted }}>+{es.length - 6}</div>}
            </div>) })}
        </div></FitBox></div>}
      {tab === 1 && <Grid maxH={680} rowStyle={(r: any) => r.date < today ? { opacity: 0.55 } : undefined} cols={[{ k: 'date', label: 'Data', fmt: dBRfull }, { k: 'kind', label: 'Evento', color: (v: string) => v === 'Resultado' ? C.cyan : C.up }, { k: 't', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Empresa' }]} rows={ev.filter(e => e.date >= isoMinus(today, 60))} />}
      {tab === 2 && <Grid maxH={680} cols={[{ k: 'ticker', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Empresa' }, { k: 'sector', label: 'Setor', color: () => C.muted }, { k: 'earnings', label: 'Próx. resultado', fmt: (v: string[]) => v?.length ? v.map(dBR).join(', ') : '—' }, { k: 'ex_div', label: 'Últ. data-ex', fmt: dBR }, { k: 'cvm_calendar', label: 'Calendário CVM', fmt: (v: any) => v ? <a href={v.link} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{dBR(v.date)} ↗</a> : '—' }, { k: 'last_results_doc', label: 'Últ. doc. resultados', fmt: (v: any) => v ? <a href={v.link} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{dBR(v.date)} {String(v.subject || '').slice(0, 28)} ↗</a> : '—' }]} rows={d.rows} />}
    </FnScreen>
  )
}

// ---------------- NEWS ----------------
export function NEWSView() {
  const { data: d, err } = useJSON<any>('news.json')
  const [src, setSrc] = useState('Todas'); const [q, setQ] = useState('')
  if (!d) return <FnScreen code="NEWS"><Loading err={err} /></FnScreen>
  const srcs = ['Todas', ...Array.from(new Set(d.items.map((n: any) => n.source))) as string[]]
  const rows = d.items.filter((n: any) => (src === 'Todas' || n.source === src) && (!q || n.title.toLowerCase().includes(q.toLowerCase())))
  return (
    <FnScreen code="NEWS" title="Top News — manchetes" right={<Field label="Busca"><input className={inputCls + ' w-48'} style={inputStyle} value={q} onChange={e => setQ(e.target.value)} /></Field>}
      source={<>Feeds RSS de licença aberta: {Array.from(new Set(d.items.map((n: any) => `${n.source.split('–')[0].trim()} (${n.license})`))).join(', ')}. Só título + link (sem reproduzir texto).</>} note="Sem agência de notícias paga. Horário = publicação no feed, convertido para Brasília.">
      <div className="flex flex-wrap gap-0 pb-2">{srcs.map(s => <button key={s} onClick={() => setSrc(s)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: src === s ? C.amber : 'transparent', color: src === s ? '#000' : C.amber }}>{s}</button>)}</div>
      <Grid maxH={700} cols={[{ k: 'date', label: 'Hora', w: '110px', fmt: (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}` }, { k: 'source', label: 'Fonte', w: '220px', color: () => C.amber, fmt: (v: string) => v.length > 30 ? v.slice(0, 29) + '…' : v }, { k: 'title', label: 'Manchete', fmt: (v: string, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.text }}>{v}</a> }]} rows={rows} />
    </FnScreen>
  )
}

// ---------------- ANB (fluxo de fundos, CVM) ----------------
export function ANBView() {
  const { data: d, err } = useJSON<any>('funds_flow.json')
  const [view, setView] = useState<'d' | 'm'>('m')
  if (!d) return <FnScreen code="ANB"><Loading err={err} /></FnScreen>
  const ser = view === 'd' ? d.daily : d.monthly, xs = view === 'd' ? ser.dates : ser.months
  const classes = Object.keys(ser.series)
  const colors: Record<string, string> = { 'Renda Fixa': C.blue, 'Ações': C.amber, 'Multimercados': C.purple, 'Cambial': C.cyan, 'FIDC': C.up, 'FMP-FGTS': '#B0BEC5', 'Participações (FIP)': '#FF7AB6', 'Não classificado': '#555' }
  const total = d.rows.find((r: any) => /total/i.test(r.class_name))
  return (
    <FnScreen code="ANB" title="Fluxo de fundos por classe (captação líquida)" right={<><span style={{ color: C.muted }}>Data ref. {d.data_ref} · {d.unit}</span><Btns opts={[{ v: 'd', l: 'Diário' }, { v: 'm', l: 'Mensal' }] as any} value={view} onChange={setView as any} /></>}
      source={<>{d.source}</>} note="Captação líquida = captações − resgates do Informe Diário de fundos (CVM), agregada pela classe do cadastro CVM (RCVM 175). Metodologia própria, não é o boletim ANBIMA (cujos termos vedam automação). FICs entram junto com fundos-alvo, então o PL tem dupla contagem.">
      <Grid rowStyle={(r: any) => /total/i.test(r.class_name) ? { background: '#151515', fontWeight: 700 } : undefined} cols={[{ k: 'class_name', label: 'Classe', color: () => C.amber }, ...(['day', 'month', 'year', 'twelve_months'] as const).map(k => ({ k, label: { day: 'Dia', month: 'Mês', year: 'Ano', twelve_months: '12 meses' }[k], align: 'r' as const, fmt: (v: number) => nf(v, 0), color: clr })), { k: 'pl_bi', label: 'PL (R$ bi)', align: 'r' as const, fmt: (v: number) => nf(v, 1) }]} rows={d.rows} />
      <div className="mt-2"><Panel title={`Captação líquida ${view === 'd' ? 'diária' : 'mensal'} por classe (R$ mi)`}>
        <FnChart height={360} panes={[{ series: classes.filter(c => c !== 'Não classificado').map(c => ({ kind: (view === 'm' ? 'line' : 'line') as 'line', data: xs.map((t: string, i: number) => ({ time: view === 'm' ? t + '-28' : t, value: ser.series[c][i] })).filter((p: any) => p.value != null), color: colors[c] || C.white, title: c, decimals: 0 })) }]} />
      </Panel></div>
      {total && <div className="pt-1 text-[11px]" style={{ color: C.muted }}>Total 12 meses: <span style={{ color: clr(total.twelve_months) }}>R$ {nf(total.twelve_months / 1e3, 1)} bi</span></div>}
    </FnScreen>
  )
}

// ---------------- CDIE ----------------
// ---------------- PORT ----------------
const DEF_PORT = [{ cod: 'PETR4', w: 25 }, { cod: 'VALE3', w: 25 }, { cod: 'ITUB4', w: 25 }, { cod: 'B3SA3', w: 25 }]
export function PORTView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const cdi = useJSON<any>('cdi.json')
  const [pos, setPos] = useState<{ cod: string; w: number }[]>(DEF_PORT)
  const [add, setAdd] = useState('WEGE3'), [reb, setReb] = useState<'d' | 'm' | 'n'>('m')
  useEffect(() => { try { const s = localStorage.getItem('qt_port'); if (s) setPos(JSON.parse(s)) } catch { } }, [])
  useEffect(() => { try { localStorage.setItem('qt_port', JSON.stringify(pos)) } catch { } }, [pos])
  const calc = useMemo(() => {
    if (!u || !pos.length) return null
    const dates = u.dates as string[], tw = pos.reduce((s, p) => s + p.w, 0) || 1
    const W = pos.map(p => p.w / tw), cl = pos.map(p => u.close[p.cod] || [])
    let start = 0; while (start < dates.length && cl.some((c: any) => c[start] == null)) start++
    let hold = W.slice(), val = 1; const nav: { time: string; value: number }[] = [{ time: dates[start], value: 100 }], ib: { time: string; value: number }[] = [], rets: number[] = [], ibr: number[] = []
    const ibc = u.close['^BVSP']; const ib0 = ibc[start]; ib.push({ time: dates[start], value: 100 })
    for (let i = start + 1; i < dates.length; i++) {
      const r = cl.map((c: any) => c[i] != null && c[i - 1] != null ? c[i] / c[i - 1] - 1 : 0)
      const pr = hold.reduce((s, h, k) => s + h * r[k], 0)
      hold = hold.map((h, k) => h * (1 + r[k]) / (1 + pr)); val *= 1 + pr
      if (reb === 'd' || (reb === 'm' && dates[i].slice(5, 7) !== dates[i - 1].slice(5, 7))) hold = W.slice()
      nav.push({ time: dates[i], value: val * 100 }); rets.push(pr)
      if (ibc[i] != null && ibc[i - 1] != null) { ib.push({ time: dates[i], value: ibc[i] / ib0 * 100 }); ibr.push(ibc[i] / ibc[i - 1] - 1) } else ibr.push(0)
    }
    const cs = (cdi.data?.series || []) as [string, number][]
    const cdiMap = new Map(cs.map(x => [x[0], x[1] / 100])); let cf = 1; const cdiNav = [{ time: dates[start], value: 100 }]
    for (let i = start + 1; i < dates.length; i++) { cf *= 1 + (cdiMap.get(dates[i]) || 0); cdiNav.push({ time: dates[i], value: cf * 100 }) }
    const yrs = rets.length / 252, ann = (Math.pow(val, 1 / yrs) - 1) * 100, cdiAnn = (Math.pow(cf, 1 / yrs) - 1) * 100
    const vol = std(rets) * Math.sqrt(252) * 100, reg = regress(ibr, rets)
    const ibAnn = (Math.pow(ib[ib.length - 1].value / 100, 1 / yrs) - 1) * 100
    const contrib = pos.map((p, k) => { const c = cl[k]; return { ...p, wn: W[k] * 100, ret: (c[c.length - 1] / c[start] - 1) * 100, last: c[c.length - 1] } })
    return { nav, ib, cdiNav, ann, cdiAnn, ibAnn, vol, sharpe: (ann - cdiAnn) / vol, mdd: maxDrawdown(nav.map(x => x.value)), beta: reg.beta, corr: reg.corr, from: dates[start], contrib, total: (val - 1) * 100 }
  }, [u, cdi.data, pos, reb])
  if (!u) return <FnScreen code="PORT"><Loading err={err} /></FnScreen>
  const codes = u.components.map((c: any) => c.cod).sort()
  return (
    <FnScreen code="PORT" title="Portfolio — backtest de carteira" right={<><Field label="Rebalancear"><Btns opts={[{ v: 'd', l: 'Diário' }, { v: 'm', l: 'Mensal' }, { v: 'n', l: 'Nunca' }] as any} value={reb} onChange={setReb as any} /></Field></>}
      source="B3 (componentes do Ibovespa) + Yahoo Finance (fechamento ajustado) + BCB SGS 12 (CDI)." note="Simulação sem custos, impostos ou slippage. Carteira salva só no seu navegador (localStorage). Sharpe = (retorno anual − CDI anual) ÷ volatilidade.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '380px 1fr' }}>
        <Panel title="Posições (pesos-alvo %)">
          <div className="flex items-center gap-2 p-2 text-[12px]"><select className={inputCls} style={inputStyle} value={add} onChange={e => setAdd(e.target.value)}>{codes.map((c: string) => <option key={c}>{c}</option>)}</select>
            <button className="px-2 border text-[12px]" style={{ borderColor: C.amber, color: C.amber }} onClick={() => !pos.find(p => p.cod === add) && setPos([...pos, { cod: add, w: 10 }])}>+ adicionar</button>
            <button className="px-2 border text-[12px]" style={{ borderColor: C.line, color: C.muted }} onClick={() => setPos(DEF_PORT)}>padrão</button></div>
          <table className="w-full text-[12px]"><thead><tr style={{ color: C.amber }}><th className="px-2 text-left font-normal">Ativo</th><th className="text-right font-normal">Peso</th><th className="text-right font-normal">Norm.</th><th className="text-right font-normal">Ret.</th><th></th></tr></thead>
            <tbody>{calc?.contrib.map((p, k) => <tr key={p.cod} className="border-t" style={{ borderColor: '#1a1a1a' }}><td className="px-2" style={{ color: C.amber }}>{p.cod}</td><td className="text-right"><input className={inputCls + ' w-14 text-right'} style={inputStyle} type="number" value={p.w} onChange={e => setPos(pos.map((x, j) => j === k ? { ...x, w: Math.max(0, +e.target.value) } : x))} /></td><td className="text-right">{nf(p.wn, 1)}%</td><td className="text-right" style={{ color: clr(p.ret) }}>{pf(p.ret, 1)}</td><td className="text-center"><button style={{ color: C.down }} onClick={() => setPos(pos.filter((_, j) => j !== k))}>×</button></td></tr>)}</tbody></table>
          {calc && <KV rows={[['Início da série', dBRfull(calc.from)], ['Retorno total', pf(calc.total, 1), clr(calc.total)], ['Retorno anualizado', pf(calc.ann, 2), C.amber], ['Ibovespa anualizado', pf(calc.ibAnn, 2)], ['CDI anualizado', pf(calc.cdiAnn, 2, false)], ['Volatilidade anual', pf(calc.vol, 2, false)], ['Sharpe (vs CDI)', nf(calc.sharpe, 2)], ['Máx. drawdown', pf(calc.mdd, 1), C.down], ['Beta vs IBOV', nf(calc.beta, 2)], ['Correlação vs IBOV', nf(calc.corr, 2)]]} />}
        </Panel>
        {calc && <FnChart height={600} panes={[{ stretch: 0.72, series: [{ kind: 'line', data: calc.nav, color: C.amber, width: 2, title: 'Carteira' }, { kind: 'line', data: calc.ib, color: C.white, title: 'IBOV' }, { kind: 'line', data: calc.cdiNav, color: '#888', title: 'CDI', dashed: true }] }, { stretch: 0.28, series: [{ kind: 'area', data: (() => { let pk = 0; return calc.nav.map(x => { pk = Math.max(pk, x.value); return { time: x.time, value: (x.value / pk - 1) * 100 } }) })(), color: C.down, title: 'Drawdown', pct: true }] }]} />}
      </div>
    </FnScreen>
  )
}

// ---------------- ALERT ----------------
type LA = { id: string; ticker: string; op: 'above' | 'below'; value: number }
export function ALERTView() {
  const { data: d, err } = useJSON<any>('alerts.json')
  const [loc, setLoc] = useState<LA[]>([])
  const [f, setF] = useState<LA>({ id: '', ticker: 'PETR4.SA', op: 'above', value: 60 })
  const [px, setPx] = useState<Record<string, { last: number; date: string }>>({})
  useEffect(() => { try { setLoc(JSON.parse(localStorage.getItem('qt_alerts') || '[]')) } catch { } }, [])
  useEffect(() => { try { localStorage.setItem('qt_alerts', JSON.stringify(loc)) } catch { } }, [loc])
  useEffect(() => { if (d) setPx(Object.fromEntries(d.rules.map((r: any) => [r.ticker, { last: r.last, date: r.date }]))) }, [d])
  useEffect(() => { import('../../lib/static').then(m => loc.forEach(a => !px[a.ticker] && m.getPrices(a.ticker).then(p => { const l = p[p.length - 1]; setPx(o => ({ ...o, [a.ticker]: { last: l.close, date: l.time } })) }).catch(() => { }))) }, [loc]) // eslint-disable-line
  if (!d) return <FnScreen code="ALERT"><Loading err={err} /></FnScreen>
  const opL = (o: string, v: number) => o === 'above' ? `≥ ${nf(v)}` : o === 'below' ? `≤ ${nf(v)}` : o === 'change_pct_below' ? `var. dia ≤ ${nf(v)}%` : `var. dia ≥ ${nf(v)}%`
  const tickers = ['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA', '^BVSP', 'BRL=X', 'EURUSD=X', 'DX-Y.NYB']
  return (
    <FnScreen code="ALERT" title="Alertas de preço" source={d.source} note="Regras do repositório (alerts.yaml) são avaliadas no fechamento pelo GitHub Actions; quando disparam, o workflow abre uma issue (notificação por e-mail do GitHub). Alertas locais ficam só no seu navegador e são checados ao abrir esta página. Não há push em tempo real.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title={`Regras do pipeline (alerts.yaml) — ${dBRfull(d.generated_at?.slice(0, 10))}`}>
          <Grid rowStyle={(r: any) => r.triggered ? { background: '#2a1010' } : undefined} cols={[{ k: 'triggered', label: '', fmt: (v: boolean) => v ? '🔔' : '·', w: '24px' }, { k: 'ticker', label: 'Ativo', color: () => C.amber }, { k: 'op', label: 'Condição', fmt: (v: string, r: any) => opL(v, r.value) }, { k: 'last', label: 'Último', align: 'r', fmt: (v: number) => nf(v) }, { k: 'change_pct', label: 'Var%', align: 'r', fmt: (v: number) => pf(v), color: clr }, { k: 'note', label: 'Descrição', color: () => C.muted }, { k: 'triggered', label: 'Status', fmt: (v: boolean) => v ? 'DISPARADO' : 'aguardando', color: (v: boolean) => v ? C.down : C.muted }]} rows={d.rules} />
        </Panel>
        <Panel title="Alertas locais (navegador)">
          <div className="flex flex-wrap items-center gap-2 p-2 text-[12px]">
            <select className={inputCls} style={inputStyle} value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })}>{tickers.map(t => <option key={t}>{t}</option>)}</select>
            <select className={inputCls} style={inputStyle} value={f.op} onChange={e => setF({ ...f, op: e.target.value as any })}><option value="above">acima de</option><option value="below">abaixo de</option></select>
            <input className={inputCls + ' w-20'} style={inputStyle} type="number" value={f.value} onChange={e => setF({ ...f, value: +e.target.value })} />
            <button className="px-2 border" style={{ borderColor: C.amber, color: C.amber }} onClick={() => setLoc([...loc, { ...f, id: String(Date.now()) }])}>+ criar</button>
          </div>
          <Grid rowStyle={(r: any) => r.hit ? { background: '#2a1010' } : undefined} cols={[{ k: 'ticker', label: 'Ativo', color: () => C.amber }, { k: 'op', label: 'Condição', fmt: (v: string, r: any) => opL(v, r.value) }, { k: 'last', label: 'Último', align: 'r', fmt: (v: number) => nf(v) }, { k: 'hit', label: 'Status', fmt: (v: boolean) => v ? 'DISPARADO' : 'aguardando', color: (v: boolean) => v ? C.down : C.muted }, { k: 'id', label: '', fmt: (v: string) => <button style={{ color: C.down }} onClick={() => setLoc(loc.filter(a => a.id !== v))}>×</button> }]}
            rows={loc.map(a => { const l = px[a.ticker]?.last; return { ...a, last: l, hit: l != null && (a.op === 'above' ? l >= a.value : l <= a.value) } })} />
          {!loc.length && <div className="p-2 text-[12px]" style={{ color: C.muted }}>Nenhum alerta local. Crie um acima.</div>}
        </Panel>
      </div>
      <div className="mt-2 text-[11px]" style={{ color: C.muted }}>Para adicionar regras permanentes, edite <span style={{ color: C.amber }}>alerts.yaml</span> no repositório; o próximo run do workflow avalia e, se disparar, abre uma issue. <a href={href('/')} style={{ color: C.amber }}>Início</a></div>
    </FnScreen>
  )
}
