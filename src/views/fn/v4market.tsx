'use client'
/** Funções sem ticker da v4: CDIE (refeita), CORR, EQS, GC, ECFC, ECST, WCRS, GLCO, MOST, BTMM. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, PALETTE, nf, pf, big, dBR, dBRfull, clr, useJSON, FnScreen, Panel, Grid, Btns, Field, inputCls, inputStyle, KV, Loading, Spark } from '@/components/fn/kit'
import { corr } from '@/lib/quant'
import { downloadCSV, CsvBtn, dayNum, fromDay, heat, HBars } from './v4util'

const bp = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${nf(v, d)}`
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mLabel = (iso: string) => `${MES[+iso.slice(5, 7) - 1]}/${iso.slice(2, 4)}`

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
    <FnScreen code="CDIE" title="Expectativa de CDI / Copom implícita no DI futuro" tabs={['Reuniões do Copom', 'Contratos DI1', 'Histórico']} tab={tab} setTab={setTab}
      source={d.source} note={<>{d.method} A taxa implícita é a precificada pelo mercado (não é previsão); inclui prêmio de risco, que cresce com o prazo. Focus = mediana da Selic por reunião (BCB).</>}>
      <div className="mb-2 grid gap-2 text-[12px] fn-kpi" style={{ gridTemplateColumns: 'repeat(6,minmax(0,1fr))' }}>
        {[
          ['Data de referência (ajuste)', dBRfull(d.ref_date), C.text],
          ['CDI atual (% a.a.)', nf(d.cdi, 2), C.amber],
          ['Selic meta (% a.a.)', nf(d.selic, 2), C.amber],
          ['Próxima reunião', v.nextM ? `${v.nextM.label} · ${dBR(v.nextM.decision)}` : '—', C.text],
          ['Movimento implícito (pb)', first ? bp(first.move_bp) : '—', clr(first?.move_bp)],
          [`Acumulado até ${v.path[v.path.length - 1]?.label ?? '—'} (pb)`, bp(v.cum), clr(v.cum)],
        ].map(([k, val, c]) => <div key={k as string} className="border px-2 py-1" style={{ borderColor: C.line, background: C.panel }}><div style={{ color: C.muted }}>{k}</div><div className="text-[16px]" style={{ color: c as string }}>{val}</div></div>)}
      </div>
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' }}>
        <Panel title="Caminho implícito por reunião">
          <Grid rows={v.path} cols={[
            { k: 'label', label: 'Reunião', color: () => C.amber },
            { k: 'decision', label: 'Decisão', fmt: x => dBR(x) },
            { k: 'contract', label: 'DI1 ref.' },
            { k: 'cdi', label: 'CDI impl.', align: 'r', fmt: x => nf(x, 2), color: () => C.amber },
            { k: 'move_bp', label: 'Δ reunião (pb)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'cum_bp', label: 'Δ acum. (pb)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'n25', label: 'Nº de 25 pb', align: 'r', fmt: (_, r: any) => nf(r.move_bp / 25, 2) },
            { k: 'selic', label: 'Selic impl.', align: 'r', fmt: x => nf(x, 2) },
            { k: 'focus', label: 'Focus (med.)', align: 'r', fmt: x => x ? nf(x.median, 2) : '—', color: () => C.purple },
            { k: 'dif', label: 'Impl.−Focus (pb)', align: 'r', fmt: (_, r: any) => r.focus ? bp((r.selic - r.focus.median) * 100) : '—', color: (_, r: any) => r.focus ? clr(r.selic - r.focus.median) : C.muted },
          ]} />
          <div className="p-2 text-[11px]" style={{ color: C.muted }}>Selic implícita = CDI implícito + spread atual Selic−CDI ({nf(d.spread_selic_cdi, 2)} p.p.). Δ reunião em relação ao período anterior; 25 pb = um corte/alta "padrão".</div>
        </Panel>
        <div>
          <XYChart height={330} legend zeroLine={false} xFmt={x => dBR(fromDay(Math.round(x)))} yFmt={y => nf(y, 2)} yLabel="% a.a." series={[
            { name: 'CDI implícito (DI1)', points: v.step(r => r.cdi, d.cdi), color: C.amber, width: 2 },
            { name: 'Selic implícita', points: v.step(r => r.selic, d.selic), color: C.cyan, dash: '4 3' },
            { name: 'Focus – mediana Selic', points: v.step(r => r.focus?.median ?? null, d.selic), color: C.purple, dash: '2 3' },
            { name: 'Taxa DI1 (ajuste, spot)', points: v.quoted, color: C.white, scatter: true },
          ]} />
          <div className="mt-2 text-[12px]" style={{ color: C.amber }}>Movimento implícito por reunião (pb)</div>
          <HBars rows={v.path.map((r: any) => ({ label: `${r.label} ${dBR(r.decision)}`, v: r.move_bp }))} fmt={x => bp(x)} />
        </div>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
        <Panel title={`DI1 – ajuste de ${dBRfull(d.ref_date)}`}>
          <Grid maxH={560} rows={d.contracts} cols={[
            { k: 'code', label: 'Contrato', color: () => C.amber },
            { k: 'mat', label: 'Vencimento', fmt: x => dBR(x) },
            { k: 'du', label: 'DU', align: 'r' },
            { k: 'pu', label: 'PU ajuste', align: 'r', fmt: x => nf(x, 2) },
            { k: 'rate', label: 'Taxa', align: 'r', fmt: x => nf(x, 3), color: () => C.amber },
            { k: 'est', label: 'Est.', align: 'r', fmt: x => nf(x, 3) },
            { k: 'last_est_bp', label: 'Taxa−Est (pb)', align: 'r', fmt: x => bp(x), color: x => x == null ? C.muted : Math.abs(x) > 2 ? C.yellow : C.text },
            { k: 'fwd', label: 'Forward', align: 'r', fmt: x => nf(x, 3) },
            { k: 'contracts', label: 'Contratos', align: 'r', fmt: x => big(x, 1) },
            { k: 'volume', label: 'Volume R$', align: 'r', fmt: x => big(x, 1) },
          ]} />
        </Panel>
        <div>
          <XYChart height={360} legend xLabel="anos úteis (du/252)" yLabel="% a.a." xFmt={x => nf(x, 1)} yFmt={y => nf(y, 2)} series={[
            { name: 'Taxa de ajuste', points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, scatter: true },
            { name: 'Curva DI1', points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, width: 1 },
            { name: 'Forward entre vencimentos', points: d.contracts.flatMap((c: any, i: number) => [[i ? d.contracts[i - 1].du / 252 : 0, c.fwd], [c.du / 252, c.fwd]]), color: C.cyan, width: 1, dash: '3 2' },
            { name: 'Est. (caminho Copom)', points: d.contracts.filter((c: any) => c.est != null).map((c: any) => [c.du / 252, c.est]), color: C.white, width: 1 },
          ]} />
          <div className="mt-1 p-2 text-[11px]" style={{ color: C.muted }}>Forward entre vencimentos i−1 → i: [(1+r<sub>i</sub>)<sup>du<sub>i</sub>/252</sup> / (1+r<sub>i−1</sub>)<sup>du<sub>i−1</sub>/252</sup>]<sup>252/(du<sub>i</sub>−du<sub>i−1</sub>)</sup> − 1. Est. só existe até o último vencimento coberto pelo calendário do Copom divulgado.</div>
        </div>
      </div>}
      {tab === 2 && <div>
        <FnChart height={420} panes={[
          { stretch: 0.5, series: [{ kind: 'hist', data: d.history.map((h: any) => ({ time: h.date, value: h.next_move_bp, color: h.next_move_bp >= 0 ? C.up : C.down })), title: 'Próxima reunião (pb)', decimals: 1 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cum_12m_bp })), color: C.amber, title: 'Acum. 12m (pb)', decimals: 1 }] },
          { stretch: 0.5, series: [{ kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.year_end_cdi })), color: C.cyan, title: 'CDI impl. fim do ano', decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.di1_1y })), color: C.white, title: 'DI1 ~1 ano', decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cdi })), color: '#777', dashed: true, title: 'CDI', decimals: 2 }] },
        ]} />
        <Panel title="Sessões" className="mt-2">
          <Grid maxH={260} rows={d.history.slice().reverse()} cols={[
            { k: 'date', label: 'Data', fmt: x => dBRfull(x) }, { k: 'cdi', label: 'CDI', align: 'r', fmt: x => nf(x, 2) }, { k: 'next', label: 'Próx. reunião' },
            { k: 'next_move_bp', label: 'Δ impl. (pb)', align: 'r', fmt: x => bp(x), color: x => clr(x) }, { k: 'cum_12m_bp', label: 'Acum. 12m (pb)', align: 'r', fmt: x => bp(x), color: x => clr(x) },
            { k: 'year_end_cdi', label: 'CDI fim do ano', align: 'r', fmt: x => nf(x, 2) }, { k: 'di1_1y', label: 'DI1 ~1A', align: 'r', fmt: x => nf(x, 3) },
          ]} />
          <div className="p-2 text-[11px]" style={{ color: C.muted }}>O histórico começa nas sessões disponíveis no Boletim Diário da B3 e cresce um pregão por dia a cada execução do pipeline.</div>
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
    <FnScreen code="CORR" title="Matriz de correlação – componentes do Ibovespa"
      right={<><Field label="Ativos"><Btns opts={[10, 15, 20]} value={n} onChange={setN} /></Field><Field label="Janela"><Btns opts={[{ v: 63, l: '3M' }, { v: 126, l: '6M' }, { v: 252, l: '1A' }, { v: 504, l: '2A' }, { v: 749, l: '3A' }]} value={win} onChange={setWin} /></Field><Btns opts={[{ v: 'd', l: 'Diário' }, { v: 'w', l: 'Semanal' }]} value={freq} onChange={setFreq} /></>}
      source="B3 (carteira teórica do Ibovespa) + Yahoo Finance (fechamentos ajustados), via universe.json."
      note={`Correlação de Pearson dos retornos ${freq === 'w' ? 'semanais' : 'diários'} entre ${dBR(M.from)} e ${dBR(M.to)}. Os maiores pesos do índice + o próprio Ibovespa. Clique numa célula para ver a correlação móvel de 63 pregões do par.`}>
      <div className="overflow-auto">
        <table className="border-collapse text-[11px]">
          <thead><tr><th></th>{M.codes.map(c => <th key={c} className="px-1 py-1 font-normal" style={{ color: C.amber }}>{lbl(c)}</th>)}<th className="px-2 font-normal" style={{ color: C.muted }}>Média</th></tr></thead>
          <tbody>{M.codes.map((p, i) => <tr key={p}><td className="px-2 py-[2px]" style={{ color: C.amber }}>{lbl(p)}</td>{M.m[i].map((x, j) => <td key={j} onClick={() => i !== j && setPair([p, M.codes[j]])} className="cursor-pointer px-1 py-[2px] text-right border border-[#111]" style={{ background: i === j ? '#1a1a1a' : heat(x, 1), color: '#fff', minWidth: 44, outline: pair && pair[0] === p && pair[1] === M.codes[j] ? `1px solid ${C.amber}` : undefined }}>{nf(x, 2)}</td>)}<td className="px-2 text-right" style={{ color: C.amber }}>{nf(M.avg[i], 2)}</td></tr>)}</tbody>
        </table>
      </div>
      {roll && pair && <div className="mt-2"><div className="text-[12px]" style={{ color: C.amber }}>Correlação móvel 63 pregões: {lbl(pair[0])} × {lbl(pair[1])}</div>
        <FnChart height={220} panes={[{ series: [{ kind: 'line', data: roll, color: C.amber, title: 'corr 63d', decimals: 2, lines: [{ price: 0, color: '#555' }] }] }]} /></div>}
    </FnScreen>
  )
}

// ======================= EQS =======================
type Flt = { sector: string; mcap: number; pe: number; pb: number; dy: number; roe: number; nd: number; liq: number; q: string }
const EQ_COLS: { k: string; label: string; fmt: (v: any) => string; num?: boolean }[] = [
  { k: 'cod', label: 'Ticker', fmt: x => x }, { k: 'name', label: 'Empresa', fmt: x => x }, { k: 'sector', label: 'Setor', fmt: x => x ?? '—' },
  { k: 'price', label: 'Preço', fmt: x => nf(x, 2), num: true }, { k: 'pct', label: 'Var. dia', fmt: x => pf(x), num: true }, { k: 'ytd', label: 'YTD', fmt: x => pf(x, 1), num: true },
  { k: 'mcap', label: 'Valor merc.', fmt: x => big(x, 1), num: true }, { k: 'vol_fin_avg30', label: 'Liq. média 30d', fmt: x => big(x, 1), num: true },
  { k: 'pe', label: 'P/L', fmt: x => nf(x, 1), num: true }, { k: 'pb', label: 'P/VPA', fmt: x => nf(x, 2), num: true }, { k: 'ev_ebitda', label: 'EV/EBITDA', fmt: x => nf(x, 1), num: true },
  { k: 'dy', label: 'DY 12m', fmt: x => pf(x, 1, false), num: true }, { k: 'roe', label: 'ROE', fmt: x => pf(x, 1, false), num: true }, { k: 'net_margin', label: 'Marg. líq.', fmt: x => pf(x, 1, false), num: true },
  { k: 'nd_ebitda', label: 'DL/EBITDA', fmt: x => nf(x, 2), num: true },
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
    <FnScreen code="EQS" title="Equity Screening – Ibovespa (fundamentos CVM + mercado)" right={<CsvBtn onClick={exp} />}
      source={s.source} note={<>{s.note} Fundamentos: últimos 12 meses (soma de 4 trimestres) do ITR/DFP mais recente de cada empresa; PL e dívida do último balanço. Clique no cabeçalho para ordenar.</>}>
      <div className="mb-2 flex items-center gap-2 lg:hidden">
        <button className="px-3 py-1 text-[12px] border font-bold" style={{ borderColor: drawer ? C.amber : C.line, color: drawer ? '#000' : C.amber, background: drawer ? C.amber : C.panel }} onClick={() => setDrawer(!drawer)}>
          Filtros{(() => { const n = Object.values(f).filter(v => v !== '' && v !== 0).length; return n ? ` (${n})` : '' })()} {drawer ? '▾' : '▸'}
        </button>
        <span className="ml-auto text-[12px]" style={{ color: C.amber }}>{rows.length} de {s.rows.length} ações</span>
      </div>
      <div className={`mb-2 flex flex-wrap items-end gap-3 border p-2 ${drawer ? '' : 'max-lg:hidden'}`} style={{ borderColor: C.line, background: C.panel }}>
        <Field label="Busca"><input className={inputCls + ' w-28'} style={inputStyle} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Setor"><select className={inputCls} style={inputStyle} value={f.sector} onChange={e => setF({ ...f, sector: e.target.value })}><option value="">Todos</option>{sectors.map(x => <option key={x}>{x}</option>)}</select></Field>
        {num('mcap', 'Valor merc. ≥ (R$ bi)')}{num('liq', 'Liq. 30d ≥ (R$ mi)')}{num('pe', 'P/L ≤')}{num('pb', 'P/VPA ≤', 'w-16', 0.1)}{num('dy', 'DY ≥ %', 'w-16', 0.5)}{num('roe', 'ROE ≥ %')}{num('nd', 'DL/EBITDA ≤', 'w-16', 0.5)}
        <button className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.line, color: C.muted }} onClick={() => setF({ sector: '', mcap: 0, pe: 0, pb: 0, dy: 0, roe: 0, nd: 0, liq: 0, q: '' })}>Limpar</button>
        <span className="ml-auto text-[12px] max-lg:hidden" style={{ color: C.amber }}>{rows.length} de {s.rows.length} ações</span>
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
  const LBL: Record<string, string> = { now: 'Atual', w1: '1 semana', m1: '1 mês', m3: '3 meses', y1: '1 ano' }
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
  const unit = tab === 2 ? 'Treasury (% a.a.)' : tab === 1 ? (td === 'pre' ? 'Prefixado (% a.a.)' : 'IPCA+ (juro real, % a.a.)') : 'DI1 (% a.a.)'
  return (
    <FnScreen code="GC" title="Curvas de juros – Brasil e EUA" tabs={['Brasil – DI1 (B3)', 'Brasil – Tesouro Direto', 'EUA – Treasuries']} tab={tab} setTab={setTab}
      right={<>{tab === 1 && <Btns opts={[{ v: 'pre', l: 'Prefixado' }, { v: 'ipca', l: 'IPCA+' }]} value={td} onChange={setTd} />}<span className="text-[12px]" style={{ color: C.muted }}>Comparar:</span>{avail.map(k => <button key={k} onClick={() => toggle(k)} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: COLS[k], color: cmp.includes(k) ? '#000' : COLS[k], background: cmp.includes(k) ? COLS[k] : 'transparent' }}>{LBL[k]}</button>)}</>}
      source={tab === 0 ? 'B3 – Boletim Diário (taxa de ajuste DI1), via cdie.json' : tab === 1 ? g.td_source : 'FRED – Treasury constant maturity (DGS1MO…DGS30)'}
      note={tab === 0 ? 'Eixo X em anos úteis (du/252). O histórico DI1 só cobre as sessões já coletadas do Boletim Diário; comparações mais longas aparecem conforme o pipeline acumula pregões.' : tab === 1 ? 'Títulos sem cupom (Tesouro Prefixado / Tesouro IPCA+), taxa de compra da manhã divulgada pelo Tesouro; eixo X em anos corridos até o vencimento.' : 'Curva par de Treasuries (constant maturity), eixo X em anos.'}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <XYChart height={440} legend xLabel={tab === 0 ? 'anos úteis' : 'anos'} yLabel={unit} xFmt={x => nf(x, 1)} yFmt={y => nf(y, 2)} series={shown.flatMap(k => [
          { name: `${LBL[k]} (${dBR(curves[k].date)})`, points: curves[k].pts.map(p => [p.x, p.y] as [number, number]), color: COLS[k], width: k === 'now' ? 2 : 1, dash: k === 'now' ? undefined : '4 3' },
        ])} />
        <Panel title={`${unit} — Δ em pb vs. datas anteriores`}>
          <Grid maxH={440} rows={tableRows} cols={[
            { k: 'l', label: tab === 1 ? 'Vencimento' : 'Vértice', color: () => C.amber },
            { k: 'now', label: dBR(now?.date), align: 'r', fmt: x => nf(x, 2) },
            ...avail.map(k => ({ k, label: `Δ ${LBL[k]}`, align: 'r' as const, fmt: (x: any) => bp(x, 0), color: (x: any) => clr(x) })),
          ]} />
        </Panel>
      </div>
      {tab === 2 && <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>{Object.entries(g.us_money).map(([k, v]: any) => <Panel key={k} title={`${({ DFF: 'Fed Funds efetiva', SOFR: 'SOFR', DTB3: 'T-bill 3 meses' } as any)[k] || k} · ${nf(v.last, 2)}% (${dBR(v.date)})`}><FnChart height={140} panes={[{ series: [{ kind: 'line', data: v.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, decimals: 2 }] }]} /></Panel>)}</div>}
    </FnScreen>
  )
}

// ======================= ECFC =======================
const FUNIT: Record<string, string> = { 'IPCA': '% a.a.', 'PIB Total': '% a.a.', 'Selic': '% a.a. (fim de ano)', 'Câmbio': 'R$/US$ (fim de ano)', 'IGP-M': '% a.a.', 'IPCA Administrados': '% a.a.', 'Conta corrente': 'US$ bi', 'Balança comercial': 'US$ bi', 'IDP': 'US$ bi', 'Dívida líquida do setor público': '% PIB', 'Resultado primário': '% PIB', 'Resultado nominal': '% PIB' }
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
    <FnScreen code="ECFC" title="Previsões econômicas – Brasil (Focus / BCB)"
      source={f.source} note="Mediana das projeções das instituições do Relatório Focus (anual). Seta = variação da mediana nas últimas 4 semanas. Clique numa linha para ver dispersão (média, desvio, mín., máx., nº de respondentes) e a evolução da mediana.">
      <Grid onRow={(r: any) => setSel(r.k)} rowStyle={(r: any) => r.k === sel ? { background: '#2a1d08' } : undefined} rows={rows} cols={[
        { k: 'k', label: 'Indicador', color: () => C.amber }, { k: 'unit', label: 'Unidade', color: () => C.muted },
        ...refs.map(y => ({ k: y, label: y, align: 'r' as const, fmt: (x: any, r: any) => <>{nf(x, 2)}<span style={{ color: r[y + 'd'] > 0 ? C.up : C.down }}>{arrow(r[y + 'd'])}</span></> })),
        { k: 'date', label: 'Data', align: 'r', fmt: x => dBR(x) },
      ]} />
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)' }}>
        <Panel title={`${sel} — dispersão das projeções (${dBR(I.date)})`}>
          <Grid rows={refs.map(y => ({ y, ...(I.snap?.[y] || {}) }))} cols={[
            { k: 'y', label: 'Ano', color: () => C.amber }, { k: 'median', label: 'Mediana', align: 'r', fmt: x => nf(x, 2), color: () => C.amber }, { k: 'mean', label: 'Média', align: 'r', fmt: x => nf(x, 2) },
            { k: 'sd', label: 'Desvio', align: 'r', fmt: x => nf(x, 2) }, { k: 'min', label: 'Mín.', align: 'r', fmt: x => nf(x, 2) }, { k: 'max', label: 'Máx.', align: 'r', fmt: x => nf(x, 2) },
            { k: 'n', label: 'Resp.', align: 'r' }, { k: 'w1', label: 'Há 1 sem.', align: 'r', fmt: x => nf(x, 2) }, { k: 'w4', label: 'Há 4 sem.', align: 'r', fmt: x => nf(x, 2) },
          ]} />
        </Panel>
        <Panel title={`${sel} — evolução da mediana`}>
          <FnChart height={240} panes={[{ series: refs.filter(y => I.hist?.[y]?.length).map((y, i) => ({ kind: 'line' as const, data: I.hist[y].map((p: any) => ({ time: p[0], value: p[1] })), color: PALETTE[(i + 1) % PALETTE.length], title: y, decimals: 2 })) }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= ECST =======================
type Row = { label: string; group: string; unit: string; pts: [string, number][]; period: (iso: string) => string; src: string; dec?: number }
const qLabel = (iso: string) => `${Math.ceil(+iso.slice(5, 7) / 3)}T${iso.slice(2, 4)}`
function sidraDate(id: string, code: string) { const y = code.slice(0, 4), n = +code.slice(4); return id.startsWith('pib') ? `${y}-${String(n * 3).padStart(2, '0')}-01` : `${y}-${String(n).padStart(2, '0')}-01` }
export function ECSTView() {
  const { data: e, err } = useJSON<any>('econ.json')
  const s = useJSON<any>('ecst.json')
  const [sel, setSel] = useState<string>('IPCA 12 meses')
  const rows = useMemo(() => {
    if (!e) return null
    const S = (id: string) => (e.series as any[]).find(x => x.id === id)?.points as [string, number][] | undefined
    const monthly = (p?: [string, number][]) => { if (!p) return []; const m = new Map<string, [string, number]>(); p.forEach(x => m.set(x[0].slice(0, 7), x)); return Array.from(m.values()) }
    const yoy = (p: [string, number][], k = 12) => p.slice(k).map((x, i) => [x[0], (x[1] / p[i][1] - 1) * 100] as [string, number])
    const diff = (p: [string, number][]) => p.slice(1).map((x, i) => [x[0], x[1] - p[i][1]] as [string, number])
    const X = (id: string) => { const q = s.data?.sidra?.find((x: any) => x.id === id); return q ? { pts: q.points.map((p: any) => [sidraDate(id, p[0]), p[2]] as [string, number]), lbl: Object.fromEntries(q.points.map((p: any) => [sidraDate(id, p[0]), p[1]])) as Record<string, string> } : null }
    const out: Row[] = []
    const add = (group: string, label: string, unit: string, pts: [string, number][] | undefined | null, period: (iso: string) => string, src: string, dec = 2) => { if (pts && pts.length) out.push({ group, label, unit, pts, period, src, dec }) }
    const sx = (id: string, label: string, unit: string, dec = 1) => { const q = X(id); if (q) add('Brasil', label, unit, q.pts, iso => q.lbl[iso] ?? mLabel(iso), 'IBGE SIDRA', dec) }
    add('Brasil', 'Selic meta', '% a.a.', monthly(S('SGS432')), mLabel, 'BCB SGS 432')
    sx('pib_qq', 'PIB – var. trimestral (dessaz.)', '% t/t'); sx('pib_aa', 'PIB – var. anual', '% a/a')
    add('Brasil', 'IPCA mensal', '% m/m', S('SGS433'), mLabel, 'BCB SGS 433')
    add('Brasil', 'IPCA 12 meses', '% 12m', S('SGS13522'), mLabel, 'BCB SGS 13522')
    sx('ipca15', 'IPCA-15 mensal', '% m/m', 2)
    add('Brasil', 'IGP-M mensal', '% m/m', S('SGS189'), mLabel, 'BCB SGS 189')
    sx('desemprego', 'Desemprego (PNAD, tri. móvel)', '%')
    add('Brasil', 'IBC-Br – var. 12m', '% a/a', S('SGS24363') ? yoy(S('SGS24363')!) : null, mLabel, 'BCB SGS 24363', 1)
    sx('pim', 'Produção industrial (m/m dessaz.)', '%'); sx('pmc', 'Vendas no varejo (m/m dessaz.)', '%'); sx('pms', 'Volume de serviços (m/m dessaz.)', '%')
    add('Brasil', 'Dívida bruta governo geral', '% PIB', S('SGS13762'), mLabel, 'BCB SGS 13762', 1)
    add('Brasil', 'Resultado primário 12m', '% PIB', S('SGS5793'), mLabel, 'BCB SGS 5793')
    add('Brasil', 'Balança comercial – saldo', 'US$ mi', S('SGS22707'), mLabel, 'BCB SGS 22707', 0)
    add('Brasil', 'Reservas internacionais', 'US$ mi', monthly(S('SGS3546')), mLabel, 'BCB SGS 3546', 0)
    add('Brasil', 'Dólar PTAX (venda)', 'R$/US$', monthly(S('SGS1')), mLabel, 'BCB SGS 1', 4)
    add('EUA', 'Fed Funds efetiva', '%', S('FEDFUNDS'), mLabel, 'FRED FEDFUNDS')
    add('EUA', 'CPI – var. 12m', '% a/a', S('CPIAUCSL') ? yoy(S('CPIAUCSL')!) : null, mLabel, 'FRED CPIAUCSL', 1)
    add('EUA', 'Desemprego', '%', S('UNRATE'), mLabel, 'FRED UNRATE', 1)
    add('EUA', 'Payroll – criação de vagas', 'mil', S('PAYEMS') ? diff(S('PAYEMS')!) : null, mLabel, 'FRED PAYEMS', 0)
    add('EUA', 'PIB real – t/t anualizado', '% a.a.', S('GDPC1') ? S('GDPC1')!.slice(1).map((x, i) => [x[0], ((x[1] / S('GDPC1')![i][1]) ** 4 - 1) * 100] as [string, number]) : null, qLabel, 'FRED GDPC1', 1)
    add('EUA', 'Treasury 10 anos', '%', monthly(S('DGS10')), mLabel, 'FRED DGS10')
    add('EUA', 'Spread 10a–2a', 'p.p.', monthly(S('T10Y2Y')), mLabel, 'FRED T10Y2Y')
    return out
  }, [e, s.data])
  if (!e || !rows) return <FnScreen code="ECST"><Loading err={err} /></FnScreen>
  const cur = rows.find(r => r.label === sel) || rows[0]
  return (
    <FnScreen code="ECST" title="Estatísticas econômicas – Brasil e EUA"
      source="BCB SGS, IBGE SIDRA (PIB, PNAD Contínua, PIM, PMC, PMS, IPCA-15) e FRED (EUA)."
      note="Último dado divulgado de cada indicador, o anterior e a variação; mini-gráfico com as últimas 24 observações. Séries diárias são amostradas no fim de cada mês. Clique numa linha para o histórico completo.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <Grid maxH={640} onRow={(r: any) => setSel(r.label)} rowStyle={(r: any) => r.label === cur.label ? { background: '#2a1d08' } : undefined}
          rows={rows.map(r => { const n = r.pts.length, l = r.pts[n - 1], p = r.pts[n - 2]; return { ...r, last: l[1], prev: p?.[1], per: r.period(l[0]), chg: p ? l[1] - p[1] : null, spark: r.pts.slice(-24).map(x => x[1]) } })}
          cols={[
            { k: 'group', label: 'País', color: () => C.muted }, { k: 'label', label: 'Indicador', color: () => C.amber }, { k: 'per', label: 'Período' },
            { k: 'last', label: 'Último', align: 'r', fmt: (x, r: any) => nf(x, r.dec), color: () => C.white }, { k: 'prev', label: 'Anterior', align: 'r', fmt: (x, r: any) => nf(x, r.dec) },
            { k: 'chg', label: 'Var.', align: 'r', fmt: (x, r: any) => x == null ? '—' : `${x > 0 ? '+' : ''}${nf(x, r.dec)}`, color: x => clr(x) },
            { k: 'unit', label: 'Unid.', color: () => C.muted }, { k: 'spark', label: '24 obs.', fmt: x => <Spark data={x} color={C.amber} /> }, { k: 'src', label: 'Fonte', color: () => C.muted },
          ]} />
        <Panel title={`${cur.label} (${cur.unit}) — ${cur.src}`}>
          <FnChart height={420} panes={[{ series: [{ kind: cur.unit.startsWith('% m') || cur.unit.includes('t/t') || cur.unit === 'mil' || cur.unit === '%' && cur.label.includes('m/m') ? 'hist' : 'line', data: cur.pts.map(p => ({ time: p[0], value: p[1], color: p[1] >= 0 ? C.amber : C.down })), color: C.amber, title: cur.label, decimals: cur.dec }] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= WCRS =======================
const CNAME: Record<string, string> = { USD: 'Dólar americano', BRL: 'Real', EUR: 'Euro', GBP: 'Libra esterlina', JPY: 'Iene', CHF: 'Franco suíço', CAD: 'Dólar canadense', AUD: 'Dólar australiano', CNY: 'Yuan', MXN: 'Peso mexicano', ARS: 'Peso argentino', CLP: 'Peso chileno', INR: 'Rúpia indiana', NZD: 'Dólar neozelandês', SEK: 'Coroa sueca', NOK: 'Coroa norueguesa', DKK: 'Coroa dinamarquesa', PLN: 'Zloty', ZAR: 'Rand', TRY: 'Lira turca', KRW: 'Won', HKD: 'Dólar de Hong Kong', SGD: 'Dólar de Singapura', COP: 'Peso colombiano', PEN: 'Sol peruano', IDR: 'Rupia indonésia', ILS: 'Shekel' }
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
    <FnScreen code="WCRS" title={`Ranking de moedas vs ${base === 'USD' ? 'dólar' : 'real'}`}
      right={<><Field label="Base"><Btns opts={[{ v: 'USD', l: 'USD' }, { v: 'BRL', l: 'BRL' }]} value={base} onChange={setBase} /></Field><Field label="Ordenar por"><Btns opts={P} value={per} onChange={setPer} /></Field></>}
      source={d.source} note={`Variação do valor de 1 unidade de cada moeda medido em ${base} (positivo = a moeda se valorizou contra o ${base}). Cotações de fechamento diário (spot), cruzadas via dólar. Data: ${dBRfull(T.date)}.`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <Grid rows={T.rows.map((r, i) => ({ ...r, rk: i + 1 }))} cols={[
          { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'c', label: 'Moeda', color: () => C.amber }, { k: 'name', label: 'Nome' },
          { k: 'v', label: `Cotação (${base})`, align: 'r', fmt: x => nf(x, x < 0.01 ? 6 : x < 1 ? 4 : 4) },
          ...P.map(k => ({ k, label: k, align: 'r' as const, fmt: (x: any) => pf(x), color: (x: any) => k === per ? (x >= 0 ? C.up : C.down) : clr(x) })),
        ]} />
        <Panel title={`Variação ${per} vs ${base}`}><HBars rows={T.rows.map(r => ({ label: r.c, v: r[per] }))} fmt={x => pf(x)} /></Panel>
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
    <FnScreen code="GLCO" title="Commodities globais – contratos futuros (1º vencimento)"
      source={f.source} note="Contrato contínuo de 1º vencimento (Yahoo, ticker =F), fechamento diário com atraso. Variações de período sobre o fechamento; 52s = faixa de mínima e máxima de 52 semanas. Clique numa linha para o gráfico.">
      <Grid onRow={(r: any) => setSel(r.ticker)} rowStyle={(r: any) => r.ticker === cur.ticker ? { background: '#2a1d08' } : undefined} rows={rows} cols={[
        { k: 'g', label: 'Grupo', color: () => C.amber }, { k: 'name', label: 'Commodity', color: () => C.white }, { k: 'ticker', label: 'Ticker', color: () => C.muted }, { k: 'exchange', label: 'Bolsa', color: () => C.muted }, { k: 'unit', label: 'Unidade', color: () => C.muted },
        { k: 'last', label: 'Último', align: 'r', fmt: x => nf(x, x >= 1000 ? 1 : 2), color: () => C.amber }, { k: 'chg', label: 'Var.', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'w1', label: '1S', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm1', label: '1M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm3', label: '3M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'ytd', label: 'YTD', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'y1', label: '1A', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
        { k: 'lo52', label: 'Mín. 52s', align: 'r', fmt: x => nf(x, 2) }, { k: 'hi52', label: 'Máx. 52s', align: 'r', fmt: x => nf(x, 2) }, { k: 'spark', label: '3 meses', fmt: x => <Spark data={x} color={C.amber} /> }, { k: 'date', label: 'Data', fmt: x => dBR(x), color: () => C.muted },
      ]} />
      <Panel title={`${cur.name} (${cur.ticker}) — ${cur.unit}`} className="mt-2">
        <FnChart height={260} panes={[{ series: [{ kind: 'area', data: cur.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, title: cur.ticker, lines: [{ price: cur.hi52, color: '#555', title: 'máx 52s' }, { price: cur.lo52, color: '#555', title: 'mín 52s' }] }] }]} />
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
    <FnScreen code="MOST" title={`Mais ativas – Ibovespa (${dBRfull(date)})`} tabs={['Volume financeiro', 'Maiores altas', 'Maiores baixas', 'Volume anormal', 'Perto da máx. 52s', 'Perto da mín. 52s']} tab={tab} setTab={setTab}
      source={s.source} note="Universo: ações do Ibovespa. Volume financeiro do último pregão (R$); volume anormal = volume do dia ÷ média de 30 pregões. Distância às máximas/mínimas de 52 semanas com fechamento diário.">
      <Grid rows={rows} cols={[
        { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Empresa', w: '200px' }, { k: 'sector', label: 'Setor', w: '170px', color: () => C.muted },
        { k: 'price', label: 'Último', align: 'r', fmt: x => nf(x, 2), color: () => C.white }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'vol_fin', label: 'Volume R$', align: 'r', fmt: x => big(x, 2) }, { k: 'vol_qty', label: 'Qtd. ações', align: 'r', fmt: x => big(x, 1) }, { k: 'vol_fin_avg30', label: 'Média 30d R$', align: 'r', fmt: x => big(x, 2) },
        { k: 'rel', label: 'Vol./média', align: 'r', fmt: x => x == null ? '—' : `${nf(x, 2)}×`, color: x => x > 1.5 ? C.yellow : C.text },
        { k: 'dhi', label: 'Dist. máx 52s', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'dlo', label: 'Dist. mín 52s', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
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
    const tdRows = (k: 'pre' | 'ipca') => { const n = cv.data.td[k]?.now, w = cv.data.td[k]?.w1; const name = k === 'pre' ? 'Tesouro Prefixado' : 'Tesouro IPCA+'; return (n?.points || []).filter((p: any) => p[2] === name).map((p: any) => { const q = w?.points.find((z: any) => z[3] === p[3] && z[2] === p[2]); return { l: `${k === 'pre' ? 'Pré' : 'IPCA+'} ${p[3].slice(0, 4)}`, v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } }) }
    const us = cv.data.us.now.points.map((p: any) => { const q = cv.data.us.w1?.points.find((z: any) => z[2] === p[2]); return { l: p[2], v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } })
    const mm = Object.entries(cv.data.us_money).map(([k, x]: any) => ({ l: ({ DFF: 'Fed Funds efetiva', SOFR: 'SOFR', DTB3: 'T-bill 3M' } as any)[k] || k, v: x.last, chg: x.prev != null ? (x.last - x.prev) * 100 : null, date: x.date }))
    return { d, pick, pre: tdRows('pre'), ipca: tdRows('ipca'), us, mm, prevK }
  }, [di.data, cv.data])
  if (!v) return <FnScreen code="BTMM"><Loading err={di.err || cv.err} /></FnScreen>
  const d = v.d, h = d.history?.[d.history.length - 1]
  const fxr = (() => { if (!fx.data) return []; const L = fx.data.dates.length - 1, b = fx.data.usd_per.BRL, e = fx.data.usd_per.EUR; return [{ l: 'USD/BRL', v: b[L], chg: (b[L] / b[L - 1] - 1) * 100 }, { l: 'EUR/BRL', v: b[L] / e[L], chg: ((b[L] / e[L]) / (b[L - 1] / e[L - 1]) - 1) * 100 }, { l: 'DXY', v: fx.data.dxy[L], chg: (fx.data.dxy[L] / fx.data.dxy[L - 1] - 1) * 100 }] })()
  const com = (fu.data?.rows || []).filter((r: any) => ['BZ=F', 'CL=F', 'GC=F'].includes(r.ticker)).map((r: any) => ({ l: r.name, v: r.last, chg: r.pct }))
  const tbl = (rows: any[], unit: 'bp' | '%', dec = 2) => <Grid rows={rows} cols={[{ k: 'l', label: 'Instrumento', color: () => C.amber }, { k: 'v', label: 'Último', align: 'r', fmt: x => nf(x, dec), color: () => C.white }, { k: 'chg', label: unit === 'bp' ? 'Δ pb' : 'Var.%', align: 'r', fmt: x => unit === 'bp' ? bp(x, 1) : pf(x), color: x => clr(x) }]} />
  const sgs = (id: string) => ((ec.data?.series as any[]) || []).find(x => x.id === id)?.points as [string, number][] | undefined
  const selic = sgs('SGS432'), dff = sgs('FEDFUNDS')
  return (
    <FnScreen code="BTMM" title="Monitor de juros e mercado monetário – Brasil e EUA"
      source="B3 (DI1, Boletim Diário), BCB (Selic, CDI, Copom), Tesouro Transparente (Tesouro Direto), FRED (Fed Funds, SOFR, T-bills, Treasuries), Yahoo (câmbio e commodities)."
      note={`Δ do DI1 vs sessão anterior (${dBR(v.prevK)}); Tesouro e Treasuries vs 1 semana; money market EUA vs dado anterior. Sem coluna de consenso de mercado (não há fonte aberta).`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <Panel title="Brasil – política monetária">
          <KV rows={[['Selic meta', `${nf(d.selic, 2)}%`, C.amber], ['CDI', `${nf(d.cdi, 2)}%`, C.amber], ['Spread Selic−CDI', `${nf(d.spread_selic_cdi, 2)} p.p.`], ['Próxima reunião', d.path?.[0] ? `${d.path[0].label} ${dBR(d.path[0].decision)}` : '—'], ['Mov. implícito', d.path?.[0] ? `${bp(d.path[0].move_bp)} pb` : '—', clr(d.path?.[0]?.move_bp)], ['Acum. 12 meses', h ? `${bp(h.cum_12m_bp)} pb` : '—', clr(h?.cum_12m_bp)], ['CDI impl. fim do ano', h ? `${nf(h.year_end_cdi, 2)}%` : '—'], ['Focus Selic próx. reunião', d.path?.[0]?.focus ? `${nf(d.path[0].focus.median, 2)}%` : '—', C.purple]]} />
        </Panel>
        <Panel title={`DI futuro – taxa de ajuste (${dBR(d.ref_date)})`}>{tbl(v.pick.map((c: any) => ({ l: `${c.code} ${dBR(c.mat)}`, v: c.rate, chg: c.chg })), 'bp', 3)}</Panel>
        <Panel title={`Tesouro Direto (${dBR(cv.data.td.pre?.now?.date)})`}>{tbl([...v.pre, ...v.ipca], 'bp')}</Panel>
        <Panel title="EUA – money market">{tbl(v.mm, 'bp')}<div className="mt-1" />{tbl([...fxr, ...com], '%', 2)}</Panel>
      </div>
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
        <Panel title={`Treasuries (${dBR(cv.data.us.now.date)})`}>{tbl(v.us, 'bp')}</Panel>
        <Panel title="Selic meta vs Fed Funds efetiva (% a.a.)">
          <FnChart height={280} panes={[{ series: [
            ...(selic ? [{ kind: 'line' as const, data: selic.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.amber, title: 'Selic', decimals: 2 }] : []),
            ...(dff ? [{ kind: 'line' as const, data: dff.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.cyan, title: 'Fed Funds', decimals: 2 }] : []),
          ] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}
