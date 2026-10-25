'use client'
/** Funções por ticker da v4: COMP, HS, HRA, GIP, RV, HP, TRA, HDS, FA, MRR. */
import React, { useEffect, useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, PALETTE, nf, pf, big, dBR, dBRfull, clr, short, useJSON, FnScreen, Panel, Grid, Btns, Field, inputCls, inputStyle, KV, Loading, NA, isEquity, corpPath } from '@/components/fn/kit'
import { getPrices, listTickers, tickerKey, type Price } from '@/lib/static'
import { mean, std, regress, corr, align, weekly, monthEnds, monthlyReturns, maxDrawdown } from '@/lib/quant'
import { usePrices } from './tech'
import { downloadCSV, CsvBtn, heat, HBars, PERIODS, periodStart } from './v4util'

const SRC_PX = 'Yahoo Finance via yfinance (OHLCV diário ajustado por proventos e desdobramentos), gerado no pipeline.'
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const lbl = (t: string) => t === '^BVSP' ? 'IBOV' : short(t)
function useTickerList() { const [l, setL] = useState<string[]>([]); useEffect(() => { listTickers().then(setL).catch(() => {}) }, []); return l }
function useMulti(list: string[]) {
  const [m, setM] = useState<Record<string, Price[]>>({})
  useEffect(() => { list.forEach(t => { if (!m[t]) getPrices(t).then(r => setM(p => ({ ...p, [t]: r }))).catch(() => {}) }) }, [list.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  return m
}
const tv = (r: Price[]) => r.map(x => ({ time: x.time, value: x.close }))
const pairOf = (t: string) => ({ 'PETR4.SA': 'PETR3.SA', 'PETR3.SA': 'PETR4.SA', 'ITUB4.SA': 'ITUB3.SA', 'ITUB3.SA': 'ITUB4.SA', 'VALE3.SA': 'PETR4.SA', '^BVSP': 'PETR4.SA' } as Record<string, string>)[t] || '^BVSP'

// ======================= COMP =======================
export function COMPView({ ticker }: { ticker: string }) {
  const all = useTickerList()
  const [list, setList] = useState<string[]>(() => Array.from(new Set([ticker, '^BVSP', ticker === 'VALE3.SA' ? 'PETR4.SA' : 'VALE3.SA', 'ITUB4.SA'])))
  const [per, setPer] = useState('1A')
  const m = useMulti(list)
  const calc = useMemo(() => {
    const base = m[list[0]]; if (!base?.length) return null
    const last = base[base.length - 1].time, from = periodStart(last, per)
    const rets0 = (() => { const r = base.filter(x => x.time >= from); return r.slice(1).map((x, i) => x.close / r[i].close - 1) })()
    const rows = list.filter(t => m[t]).map((t, i) => {
      const r = m[t].filter(x => x.time >= from); if (r.length < 2) return null
      const c = r.map(x => x.close), ret = (c[c.length - 1] / c[0] - 1) * 100
      const dr = c.slice(1).map((x, j) => x / c[j] - 1), yrs = (Date.parse(r[r.length - 1].time) - Date.parse(r[0].time)) / 3.156e10
      const al = align(tv(base.filter(x => x.time >= from)), tv(r)), ra = al.a.slice(1).map((x, j) => x / al.a[j] - 1), rb = al.b.slice(1).map((x, j) => x / al.b[j] - 1)
      return { t, color: PALETTE[(i + 1) % PALETTE.length], last: c[c.length - 1], ret, ann: yrs > 1 ? (Math.pow(1 + ret / 100, 1 / yrs) - 1) * 100 : null, vol: std(dr) * Math.sqrt(252) * 100, dd: maxDrawdown(c), corr: i === 0 ? 1 : corr(ra, rb), hi: Math.max(...c), lo: Math.min(...c), series: r.map(x => ({ time: x.time, value: (x.close / c[0] - 1) * 100 })) }
    }).filter(Boolean) as any[]
    return { rows, from, n: rets0.length }
  }, [m, list, per])
  const panes = useMemo(() => calc ? [{ series: calc.rows.map((r: any) => ({ kind: 'line' as const, data: r.series, color: r.color, title: lbl(r.t), pct: true, width: r.t === list[0] ? 2 : 1 })) }] : [], [calc, list])
  return (
    <FnScreen code="COMP" ticker={ticker} title="Comparative Returns – retorno comparado"
      right={<><Field label="Adicionar"><select className={inputCls} style={inputStyle} value="" onChange={e => e.target.value && list.length < 6 && setList([...list, e.target.value])}><option value="">—</option>{all.filter(t => !list.includes(t)).map(t => <option key={t} value={t}>{lbl(t)}</option>)}</select></Field><Btns opts={PERIODS} value={per} onChange={setPer} /></>}
      source={SRC_PX} note="Retorno de preço ajustado (inclui proventos, pois o fechamento do Yahoo é ajustado) desde o início do período, todas as séries em base 0%. Volatilidade anualizada com retornos diários (√252). Correlação dos retornos diários com o primeiro ativo. Clique em × para remover.">
      {!calc ? <Loading /> : <>
        <FnChart height={380} panes={panes} />
        <Grid rows={calc.rows} cols={[
          { k: 't', label: 'Ativo', fmt: (x, r: any) => <span><span style={{ color: r.color }}>■ </span>{lbl(x)}{x !== list[0] && <button className="ml-2" style={{ color: C.muted }} onClick={e => { e.stopPropagation(); setList(list.filter(y => y !== x)) }}>×</button>}</span>, color: () => C.amber },
          { k: 'last', label: 'Último', align: 'r', fmt: x => nf(x, 2) }, { k: 'ret', label: `Retorno ${per}`, align: 'r', fmt: x => pf(x), color: x => clr(x) }, { k: 'ann', label: 'Anualizado', align: 'r', fmt: x => pf(x), color: x => clr(x) },
          { k: 'vol', label: 'Vol. anual', align: 'r', fmt: x => pf(x, 1, false) }, { k: 'dd', label: 'Máx. drawdown', align: 'r', fmt: x => pf(x, 1), color: () => C.down },
          { k: 'hi', label: 'Máx.', align: 'r', fmt: x => nf(x, 2) }, { k: 'lo', label: 'Mín.', align: 'r', fmt: x => nf(x, 2) }, { k: 'corr', label: `Corr. c/ ${lbl(list[0])}`, align: 'r', fmt: x => nf(x, 2) },
        ]} />
      </>}
    </FnScreen>
  )
}

// ======================= HS =======================
export function HSView({ ticker }: { ticker: string }) {
  const all = useTickerList()
  const [other, setOther] = useState(pairOf(ticker))
  const [mode, setMode] = useState<'ratio' | 'spread'>('ratio')
  const [yrs, setYrs] = useState('2A')
  const m = useMulti([ticker, other])
  const calc = useMemo(() => {
    const A = m[ticker], B = m[other]; if (!A?.length || !B?.length) return null
    const from = periodStart(A[A.length - 1].time, yrs), al = align(tv(A.filter(x => x.time >= from)), tv(B.filter(x => x.time >= from)))
    if (al.t.length < 30) return null
    const s = al.a.map((a, i) => mode === 'ratio' ? a / al.b[i] : a - al.b[i])
    const mu = mean(s), sd = std(s), z = s.map(x => (x - mu) / sd)
    const ra = al.a.slice(1).map((x, i) => Math.log(x / al.a[i])), rb = al.b.slice(1).map((x, i) => Math.log(x / al.b[i]))
    const hedge = regress(al.b.map(Math.log), al.a.map(Math.log))
    const ds = s.slice(1).map((x, i) => x - s[i]), ar = regress(s.slice(0, -1), ds), hl = ar.beta < 0 ? -Math.log(2) / Math.log(1 + ar.beta) : null
    const T = (v: number[]) => al.t.map((t, i) => ({ time: t, value: v[i] }))
    return { t: al.t, a: al.a, b: al.b, s, mu, sd, z, cur: s[s.length - 1], zc: z[z.length - 1], rc: corr(ra, rb), hedge: hedge.beta, hl, min: Math.min(...s), max: Math.max(...s), T }
  }, [m, ticker, other, mode, yrs])
  const panes = useMemo(() => calc ? [
    { stretch: 0.38, series: [{ kind: 'line' as const, data: calc.T(calc.a.map(x => x / calc.a[0] * 100)), color: C.amber, title: lbl(ticker) }, { kind: 'line' as const, data: calc.T(calc.b.map(x => x / calc.b[0] * 100)), color: C.white, title: lbl(other) }] },
    { stretch: 0.37, series: [{ kind: 'line' as const, data: calc.T(calc.s), color: C.cyan, title: mode === 'ratio' ? 'Razão' : 'Spread', decimals: 4, lines: [{ price: calc.mu, color: '#aaa', title: 'média' }, { price: calc.mu + calc.sd, color: '#666', title: '+1σ' }, { price: calc.mu - calc.sd, color: '#666', title: '−1σ' }, { price: calc.mu + 2 * calc.sd, color: C.down, title: '+2σ' }, { price: calc.mu - 2 * calc.sd, color: C.up, title: '−2σ' }] }] },
    { stretch: 0.25, series: [{ kind: 'hist' as const, data: calc.T(calc.z).map(p => ({ ...p, color: Math.abs(p.value) > 2 ? C.yellow : p.value >= 0 ? '#2F7BFF' : '#7a4cff' })), title: 'z-score', decimals: 2 }] },
  ] : [], [calc, ticker, other, mode])
  return (
    <FnScreen code="HS" ticker={ticker} title="Historical Spread – spread/razão entre dois ativos"
      right={<><Field label="vs"><select className={inputCls} style={inputStyle} value={other} onChange={e => setOther(e.target.value)}>{all.filter(t => t !== ticker).map(t => <option key={t} value={t}>{lbl(t)}</option>)}</select></Field><Btns opts={[{ v: 'ratio', l: 'Razão A/B' }, { v: 'spread', l: 'Spread A−B' }]} value={mode} onChange={setMode} /><Btns opts={['1A', '2A', '3A', '5A', '10A']} value={yrs} onChange={setYrs} /></>}
      source={SRC_PX} note="Painel 1: os dois ativos em base 100. Painel 2: razão (ou diferença) de preços com média e bandas de ±1σ/±2σ no período. Painel 3: z-score = (valor − média)/σ. Meia-vida de reversão por AR(1) do spread (ideia do projeto pairs-trading). Não é recomendação de operação.">
      {!calc ? <Loading /> : <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 270px' }}>
        <FnChart height={560} panes={panes} />
        <Panel title={`${lbl(ticker)} ${mode === 'ratio' ? '/' : '−'} ${lbl(other)}`}>
          <KV rows={[['Atual', nf(calc.cur, 4), C.amber], ['Média', nf(calc.mu, 4)], ['Desvio-padrão', nf(calc.sd, 4)], ['z-score atual', nf(calc.zc, 2), Math.abs(calc.zc) > 2 ? C.yellow : C.text], ['Mínimo', nf(calc.min, 4)], ['Máximo', nf(calc.max, 4)], ['Correlação (ret. diários)', nf(calc.rc, 3)], ['Hedge ratio (log-preços)', nf(calc.hedge, 3)], ['Meia-vida (pregões)', calc.hl ? nf(calc.hl, 1) : '—'], ['Observações', String(calc.t.length)], ['Período', `${dBR(calc.t[0])} – ${dBR(calc.t[calc.t.length - 1])}`]]} />
        </Panel>
      </div>}
    </FnScreen>
  )
}

// ======================= HRA =======================
export function HRAView({ ticker }: { ticker: string }) {
  const all = useTickerList()
  const [bench, setBench] = useState(ticker === '^BVSP' ? 'BRL=X' : '^BVSP')
  const [freq, setFreq] = useState<'d' | 'w' | 'm'>('w'), [per, setPer] = useState('2A')
  const m = useMulti([ticker, bench])
  const calc = useMemo(() => {
    const A = m[ticker], B = m[bench]; if (!A?.length || !B?.length) return null
    const from = periodStart(A[A.length - 1].time, per)
    let a = tv(A), b = tv(B); if (freq === 'w') { a = weekly(a); b = weekly(b) } else if (freq === 'm') { a = monthEnds(a); b = monthEnds(b) }
    const al = align(a, b), t: string[] = [], x: number[] = [], y: number[] = []
    for (let i = 1; i < al.t.length; i++) if (al.t[i] >= from) { t.push(al.t[i]); y.push((al.a[i] / al.a[i - 1] - 1) * 100); x.push((al.b[i] / al.b[i - 1] - 1) * 100) }
    if (x.length < 8) return null
    const r = regress(x, y), n = x.length, mx = mean(x), sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0)
    const resid = y.map((v, i) => v - r.alpha - r.beta * x[i]), s = Math.sqrt(resid.reduce((q, v) => q + v * v, 0) / (n - 2))
    const seA = s * Math.sqrt(1 / n + mx * mx / sxx)
    const obs = t.map((d, i) => ({ d, x: x[i], y: y[i], fit: r.alpha + r.beta * x[i], e: resid[i] })).reverse()
    return { r, n, s, seA, tA: r.alpha / seA, tB: r.beta / r.se, adjR2: 1 - (1 - r.r2) * (n - 1) / (n - 2), xs: [Math.min(...x), Math.max(...x)], x, y, obs, resid: t.map((d, i) => ({ time: d, value: resid[i] })) }
  }, [m, ticker, bench, freq, per])
  return (
    <FnScreen code="HRA" ticker={ticker} title="Historical Regression Analysis"
      right={<><Field label="X (independente)"><select className={inputCls} style={inputStyle} value={bench} onChange={e => setBench(e.target.value)}>{all.filter(t => t !== ticker).map(t => <option key={t} value={t}>{lbl(t)}</option>)}</select></Field><Btns opts={[{ v: 'd', l: 'Diário' }, { v: 'w', l: 'Semanal' }, { v: 'm', l: 'Mensal' }]} value={freq} onChange={setFreq} /><Btns opts={['1A', '2A', '3A', '5A', '10A']} value={per} onChange={setPer} /></>}
      source={SRC_PX} note="Regressão linear (MQO) dos retornos percentuais de Y (o ativo) contra X. Estatísticas t = coeficiente ÷ erro-padrão; |t| > 2 ≈ significativo a 5%. Resíduos = parte do retorno não explicada por X.">
      {!calc ? <Loading /> : <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div>
          <XYChart height={380} legend zeroLine xLabel={`Retorno ${lbl(bench)} (%)`} yLabel={`Retorno ${lbl(ticker)} (%)`} xFmt={v => nf(v, 1)} yFmt={v => nf(v, 1)} series={[
            { name: `Observações (${calc.n})`, points: calc.x.map((v, i) => [v, calc.y[i]]), color: C.amber, scatter: true, opacity: 0.6 },
            { name: `Y = ${nf(calc.r.alpha, 3)} + ${nf(calc.r.beta, 3)}·X`, points: calc.xs.map(v => [v, calc.r.alpha + calc.r.beta * v]), color: C.white, width: 2 },
          ]} />
          <FnChart height={170} panes={[{ series: [{ kind: 'hist', data: calc.resid.map(p => ({ ...p, color: p.value >= 0 ? C.up : C.down })), title: 'Resíduo (p.p.)', decimals: 2 }] }]} />
        </div>
        <div>
          <Panel title="Estatísticas"><KV rows={[['Beta (β)', nf(calc.r.beta, 4), C.amber], ['Erro-padrão β', nf(calc.r.se, 4)], ['t de β', nf(calc.tB, 2)], ['Alfa (α, % por período)', nf(calc.r.alpha, 4), C.amber], ['Erro-padrão α', nf(calc.seA, 4)], ['t de α', nf(calc.tA, 2)], ['R²', nf(calc.r.r2, 4)], ['R² ajustado', nf(calc.adjR2, 4)], ['Correlação', nf(calc.r.corr, 4)], ['Desvio dos resíduos', nf(calc.s, 3)], ['Observações', String(calc.n)]]} /></Panel>
          <Panel title="Observações recentes" className="mt-2"><Grid maxH={250} rows={calc.obs.slice(0, 60)} cols={[{ k: 'd', label: 'Data', fmt: x => dBR(x) }, { k: 'y', label: 'Y %', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'x', label: 'X %', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'e', label: 'Resíduo', align: 'r', fmt: x => nf(x, 2) }]} /></Panel>
        </div>
      </div>}
    </FnScreen>
  )
}

// ======================= GIP =======================
const INTRA = [...['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA'], '^BVSP']
export function GIPView({ ticker }: { ticker: string }) {
  const ok = INTRA.includes(ticker.toUpperCase())
  const { data: d, err } = useJSON<any>(ok ? `intraday/${tickerKey(ticker)}.json` : null)
  const [res, setRes] = useState<'m1' | 'm5'>('m1'), [day, setDay] = useState<string>(''), [kind, setKind] = useState<'line' | 'candle'>('line')
  const calc = useMemo(() => {
    if (!d) return null
    const off = 3 * 3600, bars: number[][] = d[res] || []
    const dayOf = (u: number) => new Date((u - off) * 1000).toISOString().slice(0, 10)
    const days = Array.from(new Set(bars.map(b => dayOf(b[0]))))
    const sel = day && days.includes(day) ? day : res === 'm1' ? days[days.length - 1] : 'all'
    const B = sel === 'all' ? bars : bars.filter(b => dayOf(b[0]) === sel)
    if (!B.length) return { days, sel, B, prevClose: null, st: null } as any
    const prevBars = sel === 'all' ? [] : bars.filter(b => dayOf(b[0]) < sel), prevClose = prevBars.length ? prevBars[prevBars.length - 1][4] : null
    const vol = B.reduce((s, b) => s + (b[5] || 0), 0), vwap = vol ? B.reduce((s, b) => s + (b[2] + b[3] + b[4]) / 3 * (b[5] || 0), 0) / vol : null
    const st = { open: B[0][1], high: Math.max(...B.map(b => b[2])), low: Math.min(...B.map(b => b[3])), last: B[B.length - 1][4], vol, vwap, n: B.length, t0: B[0][0] - off, t1: B[B.length - 1][0] - off }
    return { days, sel, B, prevClose, st, off }
  }, [d, res, day])
  const panes = useMemo(() => {
    if (!calc?.st) return []
    const o = calc.off, B = calc.B as number[][]
    const price = kind === 'candle' ? { kind: 'candle' as const, data: B.map(b => ({ time: b[0] - o, open: b[1], high: b[2], low: b[3], close: b[4] })), title: lbl(ticker) } : { kind: 'area' as const, data: B.map(b => ({ time: b[0] - o, value: b[4] })), color: C.white, title: lbl(ticker), lines: calc.prevClose ? [{ price: calc.prevClose, color: '#777', title: 'fech. ant.' }] : [] }
    return [{ stretch: 0.75, series: [price] }, { stretch: 0.25, series: [{ kind: 'hist' as const, data: B.map(b => ({ time: b[0] - o, value: b[5] || 0, color: b[4] >= b[1] ? 'rgba(61,220,132,.6)' : 'rgba(255,77,77,.6)' })), title: 'Volume', decimals: 0 }] }]
  }, [calc, kind, ticker])
  if (!ok) return <FnScreen code="GIP" ticker={ticker}><NA ticker={ticker} what="Histórico intradiário" code="GIP" /></FnScreen>
  if (!d || !calc) return <FnScreen code="GIP" ticker={ticker}><Loading err={err} /></FnScreen>
  const st = calc.st, chg = st && calc.prevClose ? (st.last / calc.prevClose - 1) * 100 : null
  const hhmm = (u: number) => new Date(u * 1000).toISOString().slice(11, 16)
  return (
    <FnScreen code="GIP" ticker={ticker} title="Intraday Graph – gráfico intradiário"
      right={<><Btns opts={[{ v: 'm1', l: '1 min' }, { v: 'm5', l: '5 min' }]} value={res} onChange={v => { setRes(v); setDay('') }} /><Field label="Pregão"><select className={inputCls} style={inputStyle} value={calc.sel} onChange={e => setDay(e.target.value)}><option value="all">Todos ({calc.days.length})</option>{calc.days.slice().reverse().map((x: string) => <option key={x} value={x}>{dBRfull(x)}</option>)}</select></Field><Btns opts={[{ v: 'line', l: 'Linha' }, { v: 'candle', l: 'Candle' }]} value={kind} onChange={setKind} /></>}
      source={d.source} note="Horário de Brasília. Limitação da fonte gratuita: barras de 1 minuto só cobrem os últimos ~5–7 pregões e de 5 minutos ~60 dias; dados com atraso (não é tempo real). VWAP = Σ(preço típico × volume) ÷ Σ volume do recorte.">
      {!st ? <Loading err="Sem barras para o recorte." /> : <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 240px' }}>
        <FnChart intraday height={520} panes={panes} />
        <Panel title={calc.sel === 'all' ? 'Todos os pregões do arquivo' : dBRfull(calc.sel)}>
          <KV rows={[['Último', nf(st.last, 2), C.amber], ['Variação', chg == null ? '—' : pf(chg), clr(chg)], ['Fech. anterior', nf(calc.prevClose, 2)], ['Abertura', nf(st.open, 2)], ['Máxima', nf(st.high, 2), C.up], ['Mínima', nf(st.low, 2), C.down], ['VWAP', nf(st.vwap, 2)], ['Volume (qtd.)', big(st.vol, 2)], ['Barras', String(st.n)], ['Das', `${calc.sel === 'all' ? dBR(new Date(st.t0 * 1000).toISOString().slice(0, 10)) + ' ' : ''}${hhmm(st.t0)}`], ['Até', `${calc.sel === 'all' ? dBR(new Date(st.t1 * 1000).toISOString().slice(0, 10)) + ' ' : ''}${hhmm(st.t1)}`]]} />
        </Panel>
      </div>}
    </FnScreen>
  )
}

// ======================= RV =======================
const RV_M: { k: string; l: string; f: (v: any) => string; lowGood?: boolean }[] = [
  { k: 'mcap', l: 'Valor merc.', f: x => big(x, 1) }, { k: 'pe', l: 'P/L', f: x => nf(x, 1), lowGood: true }, { k: 'pb', l: 'P/VPA', f: x => nf(x, 2), lowGood: true }, { k: 'ev_ebitda', l: 'EV/EBITDA', f: x => nf(x, 1), lowGood: true },
  { k: 'dy', l: 'DY 12m', f: x => pf(x, 1, false) }, { k: 'roe', l: 'ROE', f: x => pf(x, 1, false) }, { k: 'net_margin', l: 'Marg. líq.', f: x => pf(x, 1, false) }, { k: 'ebitda_margin', l: 'Marg. EBITDA', f: x => pf(x, 1, false) },
  { k: 'nd_ebitda', l: 'DL/EBITDA', f: x => nf(x, 2), lowGood: true }, { k: 'ytd', l: 'YTD', f: x => pf(x, 1) }, { k: 'y1', l: '1A', f: x => pf(x, 1) },
]
const med = (v: number[]) => { const s = v.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
export function RVView({ ticker }: { ticker: string }) {
  const { data: s, err } = useJSON<any>('screener.json')
  const [cod, setCod] = useState(short(ticker)), [metric, setMetric] = useState('pe'), [scope, setScope] = useState<'sub' | 'sec'>('sub')
  const calc = useMemo(() => {
    if (!s) return null
    const me = (s.rows as any[]).find(r => r.cod === cod); if (!me) return null
    let peers = (s.rows as any[]).filter(r => scope === 'sub' ? r.subsector === me.subsector : r.sector === me.sector)
    if (scope === 'sub' && peers.length < 3) peers = (s.rows as any[]).filter(r => r.sector === me.sector)
    peers = peers.sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0))
    const others = peers.filter(r => r.cod !== cod)
    const stat = (f: (v: number[]) => number | null) => Object.fromEntries(RV_M.map(m => [m.k, f(others.map(r => r[m.k]).filter((v: any) => v != null && isFinite(v)))]))
    return { me, peers, med: { cod: 'Mediana pares', name: '', ...stat(med) }, avg: { cod: 'Média pares', name: '', ...stat(v => v.length ? mean(v) : null) } }
  }, [s, cod, scope])
  if (!s) return <FnScreen code="RV" ticker={ticker}><Loading err={err} /></FnScreen>
  if (!calc) return <FnScreen code="RV" ticker={ticker}><NA ticker={ticker} what="Valor relativo (ação fora do Ibovespa / sem fundamentos)" code="RV" /></FnScreen>
  const M = RV_M.find(m => m.k === metric)!
  return (
    <FnScreen code="RV" ticker={ticker} title={`Relative Valuation – ${calc.me.cod} vs pares (${scope === 'sub' ? calc.me.subsector : calc.me.sector})`}
      right={<><Field label="Ação"><select className={inputCls} style={inputStyle} value={cod} onChange={e => setCod(e.target.value)}>{(s.rows as any[]).map(r => r.cod).sort().map(c => <option key={c}>{c}</option>)}</select></Field><Btns opts={[{ v: 'sub', l: 'Subsetor' }, { v: 'sec', l: 'Setor' }]} value={scope} onChange={setScope} /></>}
      source={s.source} note={<>Pares = empresas do Ibovespa no mesmo subsetor da classificação setorial da B3 (amplia para o setor se houver menos de 3). {s.note} Clique numa coluna para o gráfico.</>}>
      <Grid rows={[...calc.peers, calc.med, calc.avg]} rowStyle={(r: any) => r.cod === cod ? { background: '#2a1d08' } : r.cod.startsWith('M') && !r.name ? { background: '#151515' } : undefined} cols={[
        { k: 'cod', label: 'Ticker', color: (x: any) => x === cod ? C.amber : C.white }, { k: 'name', label: 'Empresa', w: '170px' },
        ...RV_M.map(m => ({ k: m.k, label: <span className="cursor-pointer" style={{ textDecoration: m.k === metric ? 'underline' : undefined }} onClick={() => setMetric(m.k)}>{m.l}</span>, align: 'r' as const, fmt: (x: any) => m.f(x), color: (x: any, r: any) => ['ytd', 'y1'].includes(m.k) ? clr(x) : r.cod === cod && calc.med[m.k] != null && x != null ? ((m.lowGood ? x < calc.med[m.k] : x > calc.med[m.k]) ? C.up : C.down) : C.text })),
      ]} />
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <Panel title={`${M.l} — ${calc.me.cod} vs pares`}><HBars hi={cod} rows={calc.peers.map((r: any) => ({ label: r.cod, v: r[metric] ?? null, color: r.cod === cod ? C.amber : C.blue })).concat([{ label: 'Mediana', v: calc.med[metric], color: '#888' }])} fmt={M.f} /></Panel>
        <Panel title="Leitura"><div className="p-2 text-[12px]" style={{ color: C.muted }}>Verde/vermelho na linha da ação = melhor/pior que a mediana dos pares para aquele indicador (múltiplos e alavancagem: menor é melhor; rentabilidade e DY: maior é melhor). Fundamentos do ITR {dBR(calc.me.fund_period)}; preço de {dBR(calc.me.date)}.</div></Panel>
      </div>
    </FnScreen>
  )
}

// ======================= HP =======================
export function HPView({ ticker }: { ticker: string }) {
  const [tf, setTf] = useState<'d' | 'w' | 'm'>('d'), [per, setPer] = useState('3M')
  const [rows, setRows] = useState<Price[] | null>(null), [err, setErr] = useState<string | null>(null)
  useEffect(() => { setRows(null); getPrices(ticker, undefined, undefined, tf).then(setRows).catch(e => setErr(String(e?.message || e))) }, [ticker, tf])
  const calc = useMemo(() => {
    if (!rows?.length) return null
    const from = periodStart(rows[rows.length - 1].time, per), i0 = rows.findIndex(r => r.time >= from)
    const out = rows.slice(Math.max(0, i0)).map((r, k) => { const p = rows[Math.max(0, i0) + k - 1]; return { ...r, chg: p ? r.close - p.close : null, pct: p ? (r.close / p.close - 1) * 100 : null } }).reverse()
    const c = out.map(r => r.close)
    return { out, hi: Math.max(...out.map(r => r.high)), lo: Math.min(...out.map(r => r.low)), avgV: mean(out.map(r => r.volume || 0)), ret: (c[0] / (rows[Math.max(0, i0) - 1]?.close ?? c[c.length - 1]) - 1) * 100 }
  }, [rows, per])
  const exp = () => calc && downloadCSV(`hp_${tickerKey(ticker)}_${tf}.csv`, ['data', 'abertura', 'maxima', 'minima', 'fechamento', 'variacao', 'variacao_pct', 'volume'], calc.out.map(r => [r.time, +r.open.toFixed(4), +r.high.toFixed(4), +r.low.toFixed(4), +r.close.toFixed(4), r.chg == null ? null : +r.chg.toFixed(4), r.pct == null ? null : +r.pct.toFixed(4), r.volume]))
  return (
    <FnScreen code="HP" ticker={ticker} title="Historical Price Table – histórico de preços"
      right={<><Btns opts={[{ v: 'd', l: 'Diário' }, { v: 'w', l: 'Semanal' }, { v: 'm', l: 'Mensal' }]} value={tf} onChange={setTf} /><Btns opts={PERIODS} value={per} onChange={setPer} /><CsvBtn onClick={exp} /></>}
      source={SRC_PX} note="Mais recente no topo. Variação contra o fechamento do período anterior. Preços ajustados por proventos e desdobramentos (por isso podem diferir do fechamento nominal da época). O CSV usa ';' como separador e vírgula decimal (Excel pt-BR).">
      {!calc ? <Loading err={err} /> : <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 240px' }}>
        <Grid maxH={620} rows={calc.out} cols={[
          { k: 'time', label: 'Data', fmt: x => dBRfull(x), color: () => C.amber }, { k: 'open', label: 'Abertura', align: 'r', fmt: x => nf(x, 2) }, { k: 'high', label: 'Máxima', align: 'r', fmt: x => nf(x, 2) }, { k: 'low', label: 'Mínima', align: 'r', fmt: x => nf(x, 2) },
          { k: 'close', label: 'Fechamento', align: 'r', fmt: x => nf(x, 2), color: () => C.white }, { k: 'chg', label: 'Var.', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) }, { k: 'volume', label: 'Volume', align: 'r', fmt: x => big(x, 2) },
        ]} />
        <Panel title={`Resumo ${per}`}><KV rows={[['Períodos', String(calc.out.length)], ['Retorno', pf(calc.ret), clr(calc.ret)], ['Máxima', nf(calc.hi, 2), C.up], ['Mínima', nf(calc.lo, 2), C.down], ['Volume médio', big(calc.avgV, 2)], ['Último', nf(calc.out[0].close, 2), C.amber], ['Data', dBRfull(calc.out[0].time)]]} /></Panel>
      </div>}
    </FnScreen>
  )
}

// ======================= TRA =======================
export function TRAView({ ticker }: { ticker: string }) {
  const { data: c, err } = useJSON<any>(corpPath(ticker))
  const [per, setPer] = useState('5A')
  const calc = useMemo(() => {
    if (!c?.raw_close?.length) return null
    const px: [string, number][] = c.raw_close, last = px[px.length - 1][0], from = periodStart(last, per)
    const dv = new Map<string, number>(); (c.dividends || []).forEach(([d, v]: [string, number]) => dv.set(d, (dv.get(d) || 0) + v))
    const r = px.filter(p => p[0] >= from); if (r.length < 2) return null
    let units = 1, divSum = 0, nDiv = 0; const pr: any[] = [], tr: any[] = []
    const years: Record<string, { p0: number; u0: number; p1: number; u1: number; div: number }> = {}
    r.forEach(([d, p], i) => {
      const D = i > 0 ? dv.get(d) : undefined
      if (D) { units *= 1 + D / p; divSum += D; nDiv++ }
      pr.push({ time: d, value: (p / r[0][1] - 1) * 100 }); tr.push({ time: d, value: (units * p / r[0][1] - 1) * 100 })
      const y = d.slice(0, 4); if (!years[y]) years[y] = { p0: i ? r[i - 1][1] : p, u0: i ? units / (D ? 1 + D / p : 1) : 1, p1: p, u1: units, div: 0 }
      years[y].p1 = p; years[y].u1 = units; if (D) years[y].div += D
    })
    const yrs = (Date.parse(last) - Date.parse(r[0][0])) / 3.156e10, P = pr[pr.length - 1].value, T = tr[tr.length - 1].value
    const yt = Object.entries(years).map(([y, v]) => ({ y, price: (v.p1 / v.p0 - 1) * 100, total: (v.u1 * v.p1 / (v.u0 * v.p0) - 1) * 100, div: v.div, dy: v.div / v.p0 * 100 })).reverse()
    return { pr, tr, P, T, ann: yrs > 1 ? (Math.pow(1 + T / 100, 1 / yrs) - 1) * 100 : null, annP: yrs > 1 ? (Math.pow(1 + P / 100, 1 / yrs) - 1) * 100 : null, divSum, nDiv, yt, from: r[0][0], last }
  }, [c, per])
  const panes = useMemo(() => calc ? [{ series: [{ kind: 'line' as const, data: calc.tr, color: C.amber, title: 'Retorno total', pct: true, width: 2 }, { kind: 'line' as const, data: calc.pr, color: C.white, title: 'Só preço', pct: true }] }] : [], [calc])
  if (!isEquity(ticker)) return <FnScreen code="TRA" ticker={ticker}><NA ticker={ticker} what="Retorno total com proventos" code="TRA" /></FnScreen>
  if (!calc) return <FnScreen code="TRA" ticker={ticker}><Loading err={err} /></FnScreen>
  return (
    <FnScreen code="TRA" ticker={ticker} title="Total Return Analysis – retorno total com proventos reinvestidos" right={<Btns opts={PERIODS} value={per} onChange={setPer} />}
      source="Yahoo Finance: fechamento nominal (não ajustado por proventos, ajustado por desdobramentos) e histórico de dividendos/JCP por data ex; pipeline build_corp.py."
      note="Retorno total = proventos (dividendos + JCP, valores brutos) reinvestidos no fechamento da data ex: cotas × (1 + provento ÷ preço). Sem impostos e custos. Comparar com a linha de preço mostra quanto do retorno veio dos proventos.">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px' }}>
        <FnChart height={400} panes={panes} />
        <Panel title={`${dBR(calc.from)} – ${dBR(calc.last)}`}><KV rows={[['Retorno total', pf(calc.T), C.amber], ['Retorno de preço', pf(calc.P), clr(calc.P)], ['Contribuição dos proventos', pf(calc.T - calc.P), C.up], ['Total anualizado', pf(calc.ann), clr(calc.ann)], ['Preço anualizado', pf(calc.annP), clr(calc.annP)], ['Proventos por ação (R$)', nf(calc.divSum, 4)], ['Nº de pagamentos (data ex)', String(calc.nDiv)]]} /></Panel>
      </div>
      <Panel title="Por ano civil" className="mt-2"><Grid rows={calc.yt} cols={[{ k: 'y', label: 'Ano', color: () => C.amber }, { k: 'price', label: 'Preço', align: 'r', fmt: x => pf(x), color: x => clr(x) }, { k: 'total', label: 'Total', align: 'r', fmt: x => pf(x), color: x => clr(x) }, { k: 'div', label: 'Proventos R$/ação', align: 'r', fmt: x => nf(x, 4) }, { k: 'dy', label: 'Yield s/ preço inicial', align: 'r', fmt: x => pf(x, 2, false) }]} /></Panel>
    </FnScreen>
  )
}

// ======================= HDS =======================
export function HDSView({ ticker }: { ticker: string }) {
  const { data: h, err } = useJSON<any>(isEquity(ticker) ? `holders/${tickerKey(ticker)}.json` : null)
  const [tab, setTab] = useState(0)
  const calc = useMemo(() => {
    if (!h) return null
    const rest = (n: string) => /^(Outros|Ações Tesouraria)/i.test(n)
    const top = (h.top as any[]).slice().sort((a, b) => (rest(a.name) ? 1 : 0) - (rest(b.name) ? 1 : 0) || b.pct - a.pct)
    const byParent = new Map<string | null, any[]>(); (h.all as any[]).forEach(r => { const k = r.parent ?? null; byParent.set(k, [...(byParent.get(k) || []), r]) })
    const tree: any[] = []; const walk = (p: string | null, lv: number, seen: Set<string>) => (byParent.get(p) || []).slice().sort((a, b) => b.pct - a.pct).forEach(r => { if (seen.has(r.id)) return; tree.push({ ...r, lv }); walk(r.id, lv + 1, new Set(Array.from(seen).concat(r.id))) })
    walk(null, 0, new Set())
    const upd = (h.top as any[]).map(r => r.updated).filter(Boolean).sort().pop()
    return { top, tree, upd }
  }, [h])
  if (!isEquity(ticker)) return <FnScreen code="HDS" ticker={ticker}><NA ticker={ticker} what="Composição acionária" code="HDS" /></FnScreen>
  if (!calc) return <FnScreen code="HDS" ticker={ticker}><Loading err={err} /></FnScreen>
  const yn = (x: any) => x === 'S' ? 'Sim' : x === 'N' ? 'Não' : '—'
  return (
    <FnScreen code="HDS" ticker={ticker} title="Holdings – principais acionistas" tabs={['Acionistas diretos', 'Cadeia de controle (indiretos)']} tab={tab} setTab={setTab}
      source={h.source} note={`Posição declarada pela companhia no Formulário de Referência (versão ${h.version}, última atualização ${dBRfull(calc.upd)}): acionistas com ≥5% de alguma classe, controladores, tesouraria e "Outros". Não inclui posições de fundos abaixo do limite nem movimentações diárias.`}>
      {tab === 0 ? <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Grid rows={calc.top} cols={[
          { k: 'name', label: 'Acionista', w: '280px', color: (_, r: any) => r.controller === 'S' ? C.amber : C.white }, { k: 'controller', label: 'Controlador', align: 'c', fmt: x => yn(x) },
          { k: 'qty_on', label: 'Ações ON', align: 'r', fmt: x => big(x, 2) }, { k: 'pct_on', label: '% ON', align: 'r', fmt: x => pf(x, 2, false) },
          { k: 'qty_pn', label: 'Ações PN', align: 'r', fmt: x => big(x, 2) }, { k: 'pct_pn', label: '% PN', align: 'r', fmt: x => pf(x, 2, false) },
          { k: 'pct', label: '% Total', align: 'r', fmt: x => pf(x, 2, false), color: () => C.amber }, { k: 'updated', label: 'Atualizado', fmt: x => dBR(x), color: () => C.muted },
        ]} />
        <Panel title="% do capital total"><HBars rows={calc.top.map((r: any) => ({ label: r.name.replace(/ - .*$/, '').slice(0, 26), v: r.pct, color: r.controller === 'S' ? C.amber : /^Outros/.test(r.name) ? '#666' : C.blue }))} fmt={x => pf(x, 2, false)} /></Panel>
      </div> : <Grid maxH={620} rows={calc.tree} cols={[
        { k: 'name', label: 'Entidade (nível)', fmt: (x, r: any) => <span style={{ paddingLeft: r.lv * 16 }}>{r.lv ? '└ ' : ''}{x}</span>, color: (_, r: any) => r.lv === 0 ? C.amber : C.white },
        { k: 'controller', label: 'Controlador', align: 'c', fmt: x => yn(x) }, { k: 'pct_on', label: '% ON', align: 'r', fmt: x => pf(x, 2, false) }, { k: 'pct_pn', label: '% PN', align: 'r', fmt: x => pf(x, 2, false) }, { k: 'pct', label: '% Total', align: 'r', fmt: x => pf(x, 2, false) },
      ]} />}
    </FnScreen>
  )
}

// ======================= FA =======================
const perLabel = (iso: string, q: boolean) => q ? `${Math.ceil(+iso.slice(5, 7) / 3)}T${iso.slice(2, 4)}` : iso.slice(0, 4)
export function FAView({ ticker }: { ticker: string }) {
  const { data: f, err } = useJSON<any>(isEquity(ticker) ? `fa/${tickerKey(ticker)}.json` : null)
  const [tab, setTab] = useState(0), [q, setQ] = useState(false), [sel, setSel] = useState<string | null>(null), [depth, setDepth] = useState(2)
  if (!isEquity(ticker)) return <FnScreen code="FA" ticker={ticker}><NA ticker={ticker} what="Demonstrações financeiras" code="FA" /></FnScreen>
  if (!f) return <FnScreen code="FA" ticker={ticker}><Loading err={err} /></FnScreen>
  const keys = Object.keys(f.stmts), st = f.stmts[keys[tab]] || f.stmts[keys[0]], blk = q ? st.quarterly : st.annual
  const periods: string[] = blk.periods, rows = (blk.rows as any[]).filter(r => r.level <= depth)
  const n = periods.length, cur = rows.find(r => r.code === sel) || rows[0]
  return (
    <FnScreen code="FA" ticker={ticker} title="Financial Analysis – demonstrações financeiras (CVM)" tabs={keys.map(k => f.stmts[k].name)} tab={tab} setTab={i => { setTab(i); setSel(null) }}
      right={<><Btns opts={[{ v: false, l: 'Anual' }, { v: true, l: 'Trimestral' }]} value={q} onChange={setQ} /><Field label="Detalhe"><Btns opts={[{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }]} value={depth} onChange={setDepth} /></Field></>}
      source={f.source} note={<>{f.note} Valores em R$ milhões, consolidados. Trimestres de DRE/DFC isolados a partir dos acumulados do ITR (4º tri = anual − 9 meses); balanço = posição no fim do período. Clique numa conta para o gráfico.</>}>
      <Grid maxH={470} onRow={(r: any) => setSel(r.code)} rowStyle={(r: any) => r.code === cur?.code ? { background: '#2a1d08' } : r.level === 1 ? { background: '#141414' } : undefined} rows={rows.map(r => ({ ...r, ...Object.fromEntries(r.vals.map((v: number | null, i: number) => [`p${i}`, v])), yoy: q ? (r.vals[n - 1] != null && r.vals[n - 5] ? (r.vals[n - 1] / Math.abs(r.vals[n - 5]) - Math.sign(r.vals[n - 5])) * 100 : null) : (r.vals[n - 1] != null && r.vals[n - 2] ? (r.vals[n - 1] / Math.abs(r.vals[n - 2]) - Math.sign(r.vals[n - 2])) * 100 : null) }))} cols={[
        { k: 'code', label: 'Conta', color: () => C.muted }, { k: 'name', label: 'Descrição', fmt: (x, r: any) => <span style={{ paddingLeft: (r.level - 1) * 12, fontWeight: r.level === 1 ? 700 : 400 }}>{x}</span>, color: (_, r: any) => r.level === 1 ? C.amber : C.text },
        ...periods.map((p, i) => ({ k: `p${i}`, label: perLabel(p, q), align: 'r' as const, fmt: (x: any) => x == null ? '—' : nf(x / 1e6, 0), color: (x: any) => x < 0 ? C.down : C.text })),
        { k: 'yoy', label: q ? 'Δ a/a' : 'Δ anual', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
      ]} />
      {cur && <Panel title={`${cur.code} ${cur.name} (R$ mi)`} className="mt-2"><FnChart height={200} panes={[{ series: [{ kind: 'hist', data: periods.map((p, i) => ({ time: p, value: cur.vals[i] == null ? 0 : cur.vals[i] / 1e6, color: (cur.vals[i] ?? 0) >= 0 ? C.amber : C.down })), title: cur.name.slice(0, 30), decimals: 0 }] }]} /></Panel>}
    </FnScreen>
  )
}

// ======================= MRR =======================
export function MRRView({ ticker }: { ticker: string }) {
  const { data: u, err } = useJSON<any>('universe.json')
  const { rows: px } = usePrices(ticker)
  const [tab, setTab] = useState(0), [per, setPer] = useState('1M')
  const rank = useMemo(() => {
    if (!u) return null
    const D: string[] = u.dates, L = D.length - 1
    const start = per === '1D' ? D[L - 1] : periodStart(D[L], per)
    let i0 = D.findIndex(d => d >= start); if (per !== '1D' && i0 > 0) i0--
    const rt = (s: (number | null)[]) => { let a = i0; while (a < L && s[a] == null) a++; const b = s[L]; return b != null && s[a] != null ? (b / (s[a] as number) - 1) * 100 : null }
    const rows = (u.components as any[]).map(c => { const r = u.close[c.cod] ? rt(u.close[c.cod]) : null; return { ...c, r, contrib: r == null ? null : r * c.weight / 100 } }).filter(x => x.r != null).sort((a, b) => b.r - a.r).map((x, i) => ({ ...x, rk: i + 1 }))
    const rs = rows.map(x => x.r as number)
    return { rows, from: D[i0], to: D[L], idx: u.close['^BVSP'] ? rt(u.close['^BVSP']) : null, up: rs.filter(x => x > 0).length, dn: rs.filter(x => x < 0).length, avg: mean(rs), med: med(rs), contrib: rows.reduce((s, x) => s + (x.contrib || 0), 0) }
  }, [u, per])
  const heatm = useMemo(() => {
    if (!px?.length) return null
    const mr = monthlyReturns(tv(px)), years = Array.from(new Set(mr.map(x => x.y))).sort((a, b) => b - a)
    const ye = new Map<number, number>(); monthEnds(tv(px)).forEach(p => ye.set(+p.time.slice(0, 4), p.value))
    const yr = (y: number) => ye.get(y) != null && ye.get(y - 1) != null ? (ye.get(y)! / ye.get(y - 1)! - 1) * 100 : null
    const byM = MES.map((_, m) => mr.filter(x => x.m === m + 1).map(x => x.r))
    return { years, get: (y: number, m: number) => mr.find(x => x.y === y && x.m === m)?.r ?? null, yr, avg: byM.map(v => v.length ? mean(v) : null), pos: byM.map(v => v.length ? v.filter(x => x > 0).length / v.length * 100 : null) }
  }, [px])
  return (
    <FnScreen code="MRR" ticker={ticker} title="Member Returns – retorno dos membros do índice e mapa mensal" tabs={['Membros do Ibovespa', `Retornos mensais ${lbl(ticker)}`]} tab={tab} setTab={setTab}
      right={tab === 0 && <Btns opts={['1D', '1S', '1M', '3M', 'YTD', '1A']} value={per} onChange={setPer} />}
      source={tab === 0 ? 'B3 (carteira teórica do Ibovespa e pesos) + Yahoo Finance (fechamentos ajustados), via universe.json.' : SRC_PX}
      note={tab === 0 ? 'Retorno de cada componente no período e contribuição aproximada = peso atual na carteira × retorno (não considera a variação dos pesos ao longo do período).' : 'Retorno de cada mês = fechamento do último pregão do mês ÷ fechamento do mês anterior. Linha "Média" e "% positivos" por mês do calendário (sazonalidade).'}>
      {tab === 0 ? (!rank ? <Loading err={err} /> : <>
        <div className="mb-2 grid gap-2 text-[12px]" style={{ gridTemplateColumns: 'repeat(6,minmax(0,1fr))' }}>
          {[['Período', `${dBR(rank.from)} – ${dBR(rank.to)}`, C.text], ['Ibovespa', pf(rank.idx), clr(rank.idx)], ['Soma das contribuições', pf(rank.contrib), clr(rank.contrib)], ['Média / mediana', `${pf(rank.avg)} / ${pf(rank.med)}`, C.text], ['Em alta', String(rank.up), C.up], ['Em queda', String(rank.dn), C.down]].map(([k, v, c]) => <div key={k} className="border px-2 py-1" style={{ borderColor: C.line, background: C.panel }}><div style={{ color: C.muted }}>{k}</div><div className="text-[15px]" style={{ color: c }}>{v}</div></div>)}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
          <Grid maxH={560} rows={rank.rows} cols={[{ k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Empresa', w: '170px' }, { k: 'sector', label: 'Setor', w: '140px', color: () => C.muted }, { k: 'weight', label: 'Peso %', align: 'r', fmt: x => nf(x, 2) }, { k: 'r', label: `Retorno ${per}`, align: 'r', fmt: x => pf(x), color: x => clr(x) }, { k: 'contrib', label: 'Contrib. (p.p.)', align: 'r', fmt: x => nf(x, 3), color: x => clr(x) }]} />
          <Panel title="Maiores e menores contribuições (p.p.)"><HBars rows={[...rank.rows.slice().sort((a: any, b: any) => b.contrib - a.contrib).slice(0, 10), ...rank.rows.slice().sort((a: any, b: any) => a.contrib - b.contrib).slice(0, 10).reverse()].map((x: any) => ({ label: x.cod, v: x.contrib }))} fmt={x => nf(x, 3)} /></Panel>
        </div>
      </>) : (!heatm ? <Loading /> : (
        <div className="overflow-auto">
          <table className="border-collapse text-[12px]">
            <thead><tr><th className="px-2 py-1" style={{ color: C.muted }}>Ano</th>{MES.map(m => <th key={m} className="px-2 py-1 font-normal" style={{ color: C.amber }}>{m}</th>)}<th className="px-2 py-1 font-normal" style={{ color: C.white }}>Ano</th></tr></thead>
            <tbody>
              {heatm.years.map(y => <tr key={y}><td className="px-2 py-[3px]" style={{ color: C.amber }}>{y}</td>{MES.map((_, m) => { const v = heatm.get(y, m + 1); return <td key={m} className="px-2 py-[3px] text-right border border-[#111]" style={{ background: heat(v, 12), color: '#fff', minWidth: 58 }}>{v == null ? '' : pf(v, 1)}</td> })}<td className="px-2 text-right font-bold border border-[#111]" style={{ background: heat(heatm.yr(y), 40), color: '#fff', minWidth: 66 }}>{pf(heatm.yr(y), 1)}</td></tr>)}
              <tr><td className="px-2 py-[3px]" style={{ color: C.white }}>Média</td>{heatm.avg.map((v, i) => <td key={i} className="px-2 text-right" style={{ color: clr(v) }}>{pf(v, 1)}</td>)}<td /></tr>
              <tr><td className="px-2 py-[3px]" style={{ color: C.white }}>% positivos</td>{heatm.pos.map((v, i) => <td key={i} className="px-2 text-right" style={{ color: C.muted }}>{nf(v, 0)}%</td>)}<td /></tr>
            </tbody>
          </table>
        </div>
      ))}
    </FnScreen>
  )
}
