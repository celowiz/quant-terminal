'use client'
/** P4b – funções calculadas no navegador a partir dos arquivos já publicados:
 *  FWCV (curvas a termo), VAR (valor em risco), FRNT (fronteira eficiente), BTST (backtest de regras) e
 *  SVOL (vol implícita × realizada). Nada é inventado: sem dado, "—". VAR, FRNT e BTST são simulações educativas. */
import React, { useEffect, useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, inputCls, inputStyle, useFitH, useFit } from '@/components/fn/kit'
import { n, pc, cl, dUS, Kpis, Loading2, Unavailable, NumIn, addDays } from './fn11util'
import { usePrices } from './tech'
import { getPrices, tickerKey } from '@/lib/static'
import { smile, ivAt } from '@/lib/ivs.mjs'
import { lang } from '@/lib/settings'
import { tc } from '@/lib/themeRuntime'
import * as M from '@/lib/fns7.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const sgn = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${n(v, d)}`
const Edu = ({ en, pt }: { en: string; pt: string }) => (
  <div className="mb-2 border px-2 py-1 text-[11px]" style={{ borderColor: C.amberDim, color: C.amber, fontFamily: MONO }}>
    {L('EDUCATIONAL SIMULATION — not investment advice. ', 'SIMULAÇÃO EDUCATIVA — não é recomendação de investimento. ')}{L(en, pt)}
  </div>
)
const RANGE_D: Record<string, number> = { '1Y': 252, '2Y': 504, '3Y': 756 }

/** ativos do universo (componentes do índice) escolhidos pelo usuário, com peso opcional */
type Pos = { cod: string; w: number }
function Picker({ codes, pos, setPos, weights, def }: { codes: string[]; pos: Pos[]; setPos: (p: Pos[]) => void; weights: boolean; def: Pos[] }) {
  const [add, setAdd] = useState('')
  const free = codes.filter(c => !pos.find(p => p.cod === c))
  const sel = add && free.includes(add) ? add : free[0] || ''
  const tw = pos.reduce((s, p) => s + p.w, 0) || 1
  return (
    <div className="text-[12px]">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <select aria-label={L('Asset to add', 'Ativo a incluir')} className={inputCls} style={inputStyle} value={sel} onChange={e => setAdd(e.target.value)}>{free.map(c => <option key={c}>{c}</option>)}</select>
        <button className="px-2 border" style={{ borderColor: C.amber, color: C.amber }} disabled={pos.length >= 12 || !sel} onClick={() => setPos([...pos, { cod: sel, w: 10 }])}>+ {L('add', 'incluir')}</button>
        <button className="px-2 border" style={{ borderColor: C.line, color: C.muted }} onClick={() => setPos(def)}>{L('default', 'padrão')}</button>
      </div>
      <table className="w-full"><thead><tr style={{ color: C.amber }}><th className="px-2 text-left font-normal">{L('Asset', 'Ativo')}</th>{weights && <><th className="text-right font-normal">{L('Weight', 'Peso')}</th><th className="text-right font-normal">%</th></>}<th></th></tr></thead>
        <tbody>{pos.map((p, k) => <tr key={p.cod} className="border-t" style={{ borderColor: C.line }}>
          <td className="px-2" style={{ color: C.amber }}>{p.cod}</td>
          {weights && <><td className="text-right"><NumIn value={p.w} step={1} w={56} onChange={v => setPos(pos.map((x, j) => j === k ? { ...x, w: Math.max(0, v ?? 0) } : x))} /></td><td className="text-right">{n(p.w / tw * 100, 1)}</td></>}
          <td className="text-center"><button aria-label={L('remove', 'remover')} style={{ color: C.down }} disabled={pos.length <= 2} onClick={() => setPos(pos.filter((_, j) => j !== k))}>×</button></td></tr>)}</tbody></table>
    </div>
  )
}

/** histograma SVG simples (retornos diários) com linhas verticais marcadas */
function Hist({ x, marks, height = 260, fmt = (v: number) => n(v, 1) }: { x: number[]; marks: { v: number; color: string; label: string }[]; height?: number; fmt?: (v: number) => string }) {
  const box = React.useRef<HTMLDivElement | null>(null), [W, setW] = useState(600)
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth))); ro.observe(el); setW(Math.max(260, el.clientWidth)); return () => ro.disconnect() }, [])
  const fitH = useFitH(height, 110), { active } = useFit(), H = active ? Math.max(110, fitH - 30) : Math.min(height, 240)
  const h = useMemo(() => M.histogram(x, 40), [x])
  if (!h) return null
  const m = { l: 8, r: 40, t: 8, b: 22 }, top = Math.max(...h.counts) || 1
  const X = (v: number) => m.l + (v - h.lo) / (h.hi - h.lo) * (W - m.l - m.r)
  const Y = (c: number) => H - m.b - c / top * (H - m.t - m.b)
  const bw = (W - m.l - m.r) / h.counts.length
  const ticks = Array.from({ length: 5 }, (_, i) => h.lo + (h.hi - h.lo) * i / 4)
  return (
    <div ref={box} className="w-full" style={{ fontFamily: MONO }}>
      <svg width={W} height={H} className="block">
        {h.counts.map((c, i) => { const v0 = h.lo + i * h.w; const hit = marks.length && v0 + h.w <= marks[0].v; return <rect key={i} x={X(v0) + 0.5} width={Math.max(1, bw - 1)} y={Y(c)} height={H - m.b - Y(c)} fill={hit ? C.down : C.blue} opacity={0.85}><title>{`${fmt(v0)} … ${fmt(v0 + h.w)}: ${c}`}</title></rect> })}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke={tc('#555')} />
        {ticks.map((t, i) => <text key={i} x={X(t)} y={H - 6} fontSize={10} fill={C.muted} textAnchor="middle">{fmt(t)}</text>)}
        {marks.map((k, i) => <g key={i}><line x1={X(k.v)} x2={X(k.v)} y1={m.t} y2={H - m.b} stroke={k.color} strokeDasharray={i ? '4 3' : undefined} strokeWidth={1.5} /><text x={X(k.v) + 3} y={m.t + 10 + i * 12} fontSize={10} fill={k.color}>{k.label}</text></g>)}
      </svg>
    </div>
  )
}

// ======================= FWCV =======================
type Mkt = 'BR' | 'US' | 'EU'
export function FWCVView() {
  const cdie = useJSON<any>('cdie.json'), crv = useJSON<any>('curves.json'), eu = useJSON<any>('eucv.json')
  const [mk, setMk] = useState<Mkt>('BR')
  const data = useMemo(() => {
    if (mk === 'BR') {
      const d = cdie.data; if (!d?.contracts?.length) return null
      const now = M.curveFromDI(d.contracts.map((c: any) => [c.du, c.rate]))
      const prevDate = Object.keys(d.curves || {}).sort().filter(x => x <= addDays(d.ref_date, -28)).pop()
      const prev = prevDate ? M.curveFromDI(d.curves[prevDate].map((c: any) => [c[2], c[3]])) : null
      return { date: d.ref_date, now, prev, prevDate }
    }
    if (mk === 'US') {
      const u = crv.data?.us; if (!u?.now?.points?.length) return null
      const f = (p: any) => M.curveFrom(p.points.map((x: any) => [x[0], x[1]]), 'annual')
      return { date: u.now.date, now: f(u.now), prev: u.m1?.points?.length ? f(u.m1) : null, prevDate: u.m1?.date }
    }
    const e = eu.data; if (!e?.dates?.length) return null
    const at = (i: number) => M.curveFrom(e.mats.map((m: string) => [M.matYears(m), e.curves.aaa[m][i]]).filter((p: any) => p[1] != null), 'cont')
    const last = e.dates.length - 1, lim = addDays(e.dates[last], -28)
    let j = -1; e.dates.forEach((x: string, i: number) => { if (x <= lim) j = i })
    return { date: e.dates[last], now: at(last), prev: j >= 0 ? at(j) : null, prevDate: j >= 0 ? e.dates[j] : null }
  }, [mk, cdie.data, crv.data, eu.data])
  const err = mk === 'BR' ? cdie.err : mk === 'US' ? crv.err : eu.err
  const loading = mk === 'BR' ? !cdie.data : mk === 'US' ? !crv.data : !eu.data
  const mkts: [Mkt, string][] = [['BR', L('Brazil DI', 'Brasil DI')], ['US', L('US Treasuries', 'Treasuries EUA')], ['EU', L('Euro area AAA', 'Euro AAA')]]
  const right = <Field label={L('Curve', 'Curva')}><Btns opts={mkts.map(([v, l]) => ({ v, l })) as any} value={mk} onChange={setMk as any} /></Field>
  const note = L(
    'Forward rates implied by today\'s spot curve: the rate, fixed today, for borrowing from a future date a to b. They come from discount factors, with log-discount interpolated linearly between vertices (flat forwards), and are shown as annual effective rates. Brazil uses DI futures settlement rates (business days / 252); the euro area uses the zero-coupon AAA curve (continuously compounded); for US Treasuries the constant-maturity par yields are used as an approximation of zero rates. Forwards are not forecasts: they also carry term premia.',
    'Taxas a termo implícitas na curva à vista de hoje: a taxa, travada hoje, para tomar de uma data futura a até b. Saem dos fatores de desconto, com o log do desconto interpolado linearmente entre os vértices (forward constante), e aparecem como taxa efetiva anual. Brasil usa as taxas de ajuste dos futuros de DI (dias úteis / 252); a área do euro usa a curva cupom zero AAA (capitalização contínua); nos Treasuries dos EUA os rendimentos par de prazo constante são usados como aproximação da taxa zero. Taxa a termo não é previsão: ela também carrega prêmio de prazo.')
  if (loading) return <FnScreen code="FWCV" title="Forward Curves" right={right}>{err ? <Unavailable what={L('the curve', 'a curva')} /> : <Loading2 />}</FnScreen>
  if (!data) return <FnScreen code="FWCV" title="Forward Curves" right={right} note={note}><Unavailable what={L('the curve', 'a curva')} /></FnScreen>
  const { now, prev } = data, T = now.tmax
  const grid = Array.from({ length: Math.max(0, Math.floor((T - 1) * 4)) + 1 }, (_, i) => i / 4).filter(t => t + 1 <= T + 1e-9)
  const spotPts = now.pts.map(([t]: number[]) => [t, M.fwd(now, 0, t)] as [number, number | null])
  const f1 = grid.map(t => [t, M.fwd(now, t, t + 1)] as [number, number | null])
  const f1p = prev ? grid.map(t => [t, prev.tmax >= t + 1 ? M.fwd(prev, t, t + 1) : null] as [number, number | null]) : []
  const starts = [0, 1, 2, 3, 5, 10], tenors = [1, 2, 5, 10]
  const rows = starts.filter(a => a + 1 <= T + 1e-9).map(a => ({ a, ...Object.fromEntries(tenors.map(b => [`t${b}`, a + b <= T + 1e-9 ? M.fwd(now, a, a + b) : null])), ...Object.fromEntries(tenors.map(b => [`d${b}`, prev && a + b <= Math.min(T, prev.tmax) + 1e-9 ? (M.fwd(now, a, a + b)! - M.fwd(prev, a, a + b)!) * 100 : null])) }))
  const k = (a: number, b: number) => a + b <= T + 1e-9 ? M.fwd(now, a, a + b) : null
  const lab = (a: number) => a === 0 ? L('spot', 'à vista') : `${a}Y`
  return (
    <FnScreen code="FWCV" title="Forward Curves" right={right} note={note} asOf={data.date}>
      <Kpis items={[
        [L('1Y spot', '1 ano à vista'), pc(k(0, 1), 2, false), C.white],
        ['1Y1Y', pc(k(1, 1), 2, false), C.amber],
        ['2Y1Y', pc(k(2, 1), 2, false), C.amber],
        ['5Y5Y', pc(k(5, 5), 2, false), C.amber],
        [L('Longest vertex', 'Vértice mais longo'), `${n(T, 1)} ${L('yrs', 'anos')}`],
        [L('Compared with', 'Comparado com'), data.prevDate ? dUS(data.prevDate) : '—'],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L('Spot curve and 1-year forward starting at t (% a.a.)', 'Curva à vista e termo de 1 ano começando em t (% a.a.)')}>
          <XYChart height={560} xLabel={L('years', 'anos')} xFmt={v => n(v, 0)} yFmt={v => n(v, 2)} series={[
            { name: L('Spot', 'À vista'), points: spotPts, color: C.white, width: 1.5 },
            { name: L('1Y forward', 'Termo 1 ano'), points: f1, color: C.amber, width: 2 },
            ...(f1p.length ? [{ name: `${L('1Y forward', 'Termo 1 ano')} ${data.prevDate ? dUS(data.prevDate) : ''}`, points: f1p, color: C.cyan, dash: '4 3' }] : []),
          ]} />
        </Panel>
        <Panel title={L('Forward matrix: start × length (% a.a.) and change vs comparison (bp)', 'Matriz a termo: início × prazo (% a.a.) e variação vs comparação (bp)')}>
          <Grid rows={rows} cols={[
            { k: 'a', label: L('Start', 'Início'), fmt: (v: number) => lab(v), color: () => C.amber },
            ...tenors.map(b => ({ k: `t${b}`, label: `${b}Y`, align: 'r' as const, fmt: (v: any) => n(v, 2), color: () => C.white })),
            ...tenors.map(b => ({ k: `d${b}`, label: `Δ${b}Y`, align: 'r' as const, fmt: (v: any) => sgn(v, 0), color: (v: any) => cl(v) })),
          ]} />
          <div className="p-2 text-[11px]" style={{ color: C.muted }}>{L('Row "spot" is the zero rate for each length. 1Y1Y = rate for 1 year starting in 1 year.', 'A linha "à vista" é a taxa zero de cada prazo. 1Y1Y = taxa de 1 ano começando daqui a 1 ano.')}</div>
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= VAR =======================
const DEF_VAR: Pos[] = [{ cod: 'PETR4', w: 25 }, { cod: 'VALE3', w: 25 }, { cod: 'ITUB4', w: 25 }, { cod: 'B3SA3', w: 25 }]
export function VARView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const [pos, setPos] = useState<Pos[]>(DEF_VAR)
  const [conf, setConf] = useState('99'), [hz, setHz] = useState('1'), [win, setWin] = useState('2Y'), [amt, setAmt] = useState<number | null>(100000)
  const c = +conf / 100, h = +hz, V = amt ?? 0
  const calc = useMemo(() => {
    if (!u) return null
    const R = M.alignedReturns(u.dates, pos.map(p => u.close[p.cod] || []), RANGE_D[win] + 250)
    if (!R || R.rets.length < 260) return null
    const tw = pos.reduce((s, p) => s + p.w, 0) || 1, w = pos.map(p => p.w / tw)
    const port = R.rets.map(r => r.reduce((s, x, i) => s + w[i] * x, 0))
    const N = Math.min(RANGE_D[win], port.length - 250), sample = port.slice(-N)
    const v = M.varStats(sample, c), comp = M.componentVar(R.rets.slice(-N), w)
    const bt = M.rollingVar(port, R.dates, 250, c)
    return { ...v, comp, bt, sample, from: R.dates[R.dates.length - N], to: R.dates[R.dates.length - 1] }
  }, [u, pos, c, win])
  const note = L(
    'Value at risk is the loss that should be exceeded only on (1 − c) of the days, if the past repeats. Historical: the empirical quantile of the portfolio\'s daily returns over the window. Parametric: normal distribution with the sample mean and volatility. Expected shortfall is the average loss on the days beyond the VaR. Horizons above one day scale by √h, which assumes independent days. Weights are rebalanced daily; adjusted closes of index members. The backtest counts the days in the last year whose loss exceeded the 1-day historical VaR estimated on the previous 250 days.',
    'O valor em risco é a perda que só deveria ser superada em (1 − c) dos dias, se o passado se repetir. Histórico: o quantil empírico dos retornos diários da carteira na janela. Paramétrico: distribuição normal com a média e a volatilidade da amostra. A perda esperada além do VaR (ES) é a média das perdas nos dias que passaram do VaR. Horizontes acima de um dia escalam por √h, o que supõe dias independentes. Pesos rebalanceados todo dia; fechamentos ajustados das ações do índice. O backtest conta os dias do último ano em que a perda passou do VaR histórico de 1 dia estimado nos 250 dias anteriores.')
  const right = <>
    <Field label={L('Confidence', 'Confiança')}><Btns opts={['95', '99'].map(v => ({ v, l: v + '%' })) as any} value={conf} onChange={setConf} /></Field>
    <Field label={L('Horizon', 'Horizonte')}><Btns opts={[{ v: '1', l: L('1D', '1d') }, { v: '10', l: L('10D', '10d') }] as any} value={hz} onChange={setHz} /></Field>
    <Field label={L('Window', 'Janela')}><Btns opts={['1Y', '2Y'].map(v => ({ v, l: v })) as any} value={win} onChange={setWin} /></Field>
  </>
  if (!u) return <FnScreen code="VAR" title="Value at Risk" right={right}><Loading2 err={err} /></FnScreen>
  const codes = (u.components || []).map((x: any) => x.cod).sort()
  const sq = Math.sqrt(h), money = (x: number | null | undefined) => x == null || !isFinite(x) ? '—' : `R$ ${Math.round(x * V * sq).toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US')}`
  const pct = (x: number | null | undefined) => x == null ? '—' : `${n(x * sq * 100, 2)}%`
  return (
    <FnScreen code="VAR" title="Value at Risk" right={right} note={note} asOf={calc?.to}>
      <Edu en="Past returns do not guarantee future losses stay within these numbers." pt="Retornos passados não garantem que perdas futuras fiquem dentro destes números." />
      {calc ? <Kpis items={[
        [`${L('Historical VaR', 'VaR histórico')} ${conf}% · ${hz}${L('D', 'd')}`, money(calc.hVar), C.down],
        [L('Parametric VaR', 'VaR paramétrico'), money(calc.pVar), C.down],
        [L('Expected shortfall (hist.)', 'Perda esperada além do VaR (hist.)'), money(calc.hEs), C.down],
        [L('Daily volatility', 'Volatilidade diária'), `${n(calc.sd * 100, 2)}%`],
        [L('Worst day in window', 'Pior dia na janela'), `${n(calc.worst * 100, 2)}%`, C.down],
        [L('Backtest breaches / expected', 'Violações / esperado (backtest)'), `${calc.bt.breaches} / ${n(calc.bt.expected, 1)}`, calc.bt.breaches > calc.bt.expected * 2 ? C.down : C.text],
      ]} /> : <Unavailable what={L('enough common history for these assets', 'histórico comum suficiente para estes ativos')} />}
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: '330px minmax(0,1fr) minmax(0,1fr)' }}>
        <Panel title={L('Portfolio (weights)', 'Carteira (pesos)')}>
          <div className="flex items-center gap-2 p-2 text-[12px]"><span style={{ color: C.muted }}>{L('Value (R$)', 'Valor (R$)')}</span><NumIn value={amt} step={1000} w={110} onChange={setAmt} /></div>
          <Picker codes={codes} pos={pos} setPos={setPos} weights def={DEF_VAR} />
          {calc && <KV rows={[
            [L('Window', 'Janela'), `${dUS(calc.from)} – ${dUS(calc.to)}`],
            [L('Days in sample', 'Dias na amostra'), String(calc.sample.length)],
            [`VaR ${L('hist.', 'hist.')} (% ${L('of value', 'do valor')})`, pct(calc.hVar), C.down],
            [`VaR ${L('param.', 'param.')} (%)`, pct(calc.pVar), C.down],
            [`ES ${L('param.', 'param.')}`, money(calc.pEs), C.down],
          ]} />}
          {calc && <><div className="px-2 pt-2 text-[12px]" style={{ color: C.amber }}>{L('Share of parametric VaR by asset', 'Participação no VaR paramétrico por ativo')}</div>
            <Grid rows={pos.map((p, i) => ({ cod: p.cod, s: calc.comp[i] }))} cols={[{ k: 'cod', label: L('Asset', 'Ativo'), color: () => C.amber }, { k: 's', label: '%', align: 'r', fmt: (v: number) => n(v * 100, 1), color: (v: number) => v < 0 ? C.up : C.text }]} /></>}
        </Panel>
        <Panel title={L('Daily returns in the window (%) and VaR', 'Retornos diários na janela (%) e VaR')}>
          {calc && <Hist x={calc.sample.map(x => x * 100)} height={540} fmt={v => n(v, 1)} marks={[
            { v: -calc.hVar * 100, color: C.down, label: `${L('hist.', 'hist.')} −${n(calc.hVar * 100, 2)}%` },
            { v: -calc.pVar * 100, color: C.amber, label: `${L('param.', 'param.')} −${n(calc.pVar * 100, 2)}%` },
          ]} />}
        </Panel>
        <Panel title={L('Backtest: daily return vs 1-day VaR from the previous 250 days', 'Backtest: retorno diário vs VaR de 1 dia dos 250 dias anteriores')}>
          {calc && <FnChart height={540} panes={[{ stretch: 1, series: [
            { kind: 'hist', data: calc.bt.pts.map(p => ({ time: p.t, value: p.r * 100, color: p.hit ? C.down : tc('#3a5f8a') })), title: L('Return %', 'Retorno %'), decimals: 2 },
            { kind: 'line', data: calc.bt.pts.map(p => ({ time: p.t, value: -p.v * 100 })), color: C.amber, title: 'VaR', decimals: 2 },
          ] }]} />}
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= FRNT =======================
const DEF_FR: Pos[] = ['PETR4', 'VALE3', 'ITUB4', 'WEGE3', 'ABEV3', 'SBSP3'].map(cod => ({ cod, w: 1 }))
export function FRNTView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const cdi = useJSON<any>('cdi.json')
  const [pos, setPos] = useState<Pos[]>(DEF_FR), [win, setWin] = useState('2Y'), [pick, setPick] = useState('ms')
  const calc = useMemo(() => {
    if (!u) return null
    const R = M.alignedReturns(u.dates, pos.map(p => u.close[p.cod] || []), RANGE_D[win])
    if (!R || R.rets.length < 120) return null
    const { mu, cov } = M.moments(R.rets)
    const cs = (cdi.data?.series || []) as [string, number][]
    const inWin = cs.filter(x => x[0] > R.dates[0] && x[0] <= R.dates[R.dates.length - 1])
    const rf = inWin.length > 100 ? M.annualizeDaily(inWin.map(x => x[1] / 100)) : null
    const fr = M.frontier(mu, cov, 70), cloud = M.randomPortfolios(mu, cov, 2500, 7)
    const ms = rf == null ? null : fr.reduce((b: any, p: any) => (p.ret - rf) / p.vol > (b ? (b.ret - rf) / b.vol : -Infinity) ? p : b, null)
    const mv = fr[0], eq = M.stats(pos.map(() => 1 / pos.length), mu, cov)
    return { mu, cov, rf, fr, cloud, ms, mv, eq, from: R.dates[0], to: R.dates[R.dates.length - 1], N: R.rets.length }
  }, [u, cdi.data, pos, win])
  const note = L(
    'Markowitz mean-variance frontier, long only and fully invested (weights ≥ 0 that add up to 100%). Expected returns and covariances are the sample estimates from daily adjusted closes in the window, annualized (×252). Each frontier point maximizes μᵀw − (λ/2)·wᵀΣw for one λ, solved by projected gradient. The grey cloud is random portfolios, for reference. The max-Sharpe portfolio uses the CDI accumulated in the window as the risk-free rate. Sample means are very noisy, so the optimal weights change a lot with the window: a lesson in estimation error, not an allocation.',
    'Fronteira média-variância de Markowitz, só comprada e 100% investida (pesos ≥ 0 que somam 100%). Retornos esperados e covariâncias são as estimativas da amostra de fechamentos ajustados diários na janela, anualizadas (×252). Cada ponto da fronteira maximiza μᵀw − (λ/2)·wᵀΣw para um λ, resolvido por gradiente projetado. A nuvem cinza são carteiras aleatórias, como referência. A carteira de Sharpe máximo usa o CDI acumulado na janela como taxa livre de risco. Médias amostrais têm muito ruído, então os pesos ótimos mudam bastante com a janela: é uma lição sobre erro de estimação, não uma alocação.')
  const right = <>
    <Field label={L('Window', 'Janela')}><Btns opts={['1Y', '2Y', '3Y'].map(v => ({ v, l: v })) as any} value={win} onChange={setWin} /></Field>
  </>
  if (!u) return <FnScreen code="FRNT" title="Efficient Frontier" right={right}><Loading2 err={err} /></FnScreen>
  const codes = (u.components || []).map((x: any) => x.cod).sort()
  const P = calc ? (pick === 'ms' && calc.ms ? calc.ms : pick === 'mv' ? calc.mv : calc.eq) : null
  const shp = (p: any) => calc?.rf == null || !p ? null : (p.ret - calc.rf) / p.vol
  return (
    <FnScreen code="FRNT" title="Efficient Frontier" right={right} note={note} asOf={calc?.to}>
      <Edu en="Historical estimates; optimal weights are unstable out of sample." pt="Estimativas históricas; os pesos ótimos são instáveis fora da amostra." />
      {calc ? <Kpis items={[
        [L('Min-variance: return / vol', 'Mínima variância: retorno / vol'), `${n(calc.mv.ret * 100, 1)}% / ${n(calc.mv.vol * 100, 1)}%`, C.cyan],
        [L('Max Sharpe: return / vol', 'Sharpe máximo: retorno / vol'), calc.ms ? `${n(calc.ms.ret * 100, 1)}% / ${n(calc.ms.vol * 100, 1)}%` : '—', C.amber],
        [L('Max Sharpe ratio', 'Índice de Sharpe máximo'), n(shp(calc.ms), 2), C.amber],
        [L('Equal weight: return / vol', 'Pesos iguais: retorno / vol'), `${n(calc.eq.ret * 100, 1)}% / ${n(calc.eq.vol * 100, 1)}%`],
        [L('Risk-free (CDI, ann.)', 'Livre de risco (CDI, a.a.)'), calc.rf == null ? '—' : `${n(calc.rf * 100, 2)}%`],
        [L('Days in sample', 'Dias na amostra'), String(calc.N)],
      ]} /> : <Unavailable what={L('enough common history for these assets', 'histórico comum suficiente para estes ativos')} />}
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: '300px minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L('Assets', 'Ativos')}><Picker codes={codes} pos={pos} setPos={setPos} weights={false} def={DEF_FR} /></Panel>
        <Panel title={L('Annual return × annual volatility (%)', 'Retorno anual × volatilidade anual (%)')}>
          {calc && <XYChart height={560} xLabel={L('volatility %', 'volatilidade %')} xFmt={v => n(v, 0)} yFmt={v => n(v, 0)} series={[
            { name: L('Random portfolios', 'Carteiras aleatórias'), points: calc.cloud.map((p: any) => [p.vol * 100, p.ret * 100]), color: tc('#555'), scatter: true, opacity: 0.5 },
            { name: L('Frontier', 'Fronteira'), points: calc.fr.map((p: any) => [p.vol * 100, p.ret * 100]), color: C.amber, width: 2 },
            { name: L('Assets', 'Ativos'), points: pos.map((_, i) => [Math.sqrt(calc.cov[i][i]) * 100, calc.mu[i] * 100]), color: C.cyan, scatter: true },
            ...(calc.ms && calc.rf != null ? [{ name: L('Capital market line', 'Linha de mercado de capitais'), points: [[0, calc.rf * 100], [calc.ms.vol * 150, (calc.rf + 1.5 * (calc.ms.ret - calc.rf)) * 100]] as [number, number][], color: C.white, dash: '4 3' }] : []),
          ]} />}
        </Panel>
        <Panel title={L('Weights', 'Pesos')} right={<Btns opts={[{ v: 'ms', l: L('Max Sharpe', 'Sharpe máx.') }, { v: 'mv', l: L('Min var', 'Mín. var.') }, { v: 'eq', l: L('Equal', 'Iguais') }] as any} value={pick} onChange={setPick} />}>
          {calc && P && <>
            <Grid rows={pos.map((p, i) => ({ cod: p.cod, w: P.w[i], mu: calc.mu[i], vol: Math.sqrt(calc.cov[i][i]) }))} cols={[
              { k: 'cod', label: L('Asset', 'Ativo'), color: () => C.amber },
              { k: 'w', label: L('Weight %', 'Peso %'), align: 'r', fmt: (v: number) => n(v * 100, 1), color: () => C.white },
              { k: 'mu', label: L('Ret. %', 'Ret. %'), align: 'r', fmt: (v: number) => n(v * 100, 1), color: (v: number) => cl(v) },
              { k: 'vol', label: L('Vol %', 'Vol %'), align: 'r', fmt: (v: number) => n(v * 100, 1) },
            ]} />
            <KV rows={[[L('Expected return (sample)', 'Retorno esperado (amostra)'), `${n(P.ret * 100, 2)}%`], [L('Volatility', 'Volatilidade'), `${n(P.vol * 100, 2)}%`], ['Sharpe', n(shp(P), 2)], [L('Window', 'Janela'), `${dUS(calc.from)} – ${dUS(calc.to)}`]]} />
          </>}
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= BTST =======================
export function BTSTView() {
  const { data: u } = useJSON<any>('universe.json')
  const cdi = useJSON<any>('cdi.json')
  const [tk, setTk] = useState('PETR4'), [rule, setRule] = useState('sma'), [fast, setFast] = useState<number | null>(50), [slow, setSlow] = useState<number | null>(200)
  const [look, setLook] = useState<number | null>(252), [cost, setCost] = useState<number | null>(10), [rng, setRng] = useState('5Y'), [cash, setCash] = useState('cdi')
  const { rows, err } = usePrices(tk === 'IBOV' ? '^BVSP' : `${tk}.SA`)
  const res = useMemo(() => {
    if (!rows || rows.length < 300) return null
    const t = rows.map(r => r.time), c = rows.map(r => r.close)
    const p = rule === 'sma' ? { kind: 'sma' as const, fast: Math.max(2, Math.round(fast ?? 50)), slow: Math.max(3, Math.round(slow ?? 200)) } : { kind: 'mom' as const, look: Math.max(5, Math.round(look ?? 252)) }
    const sig = M.signals(c, p)
    const yrs = rng === 'MAX' ? 99 : +rng.replace('Y', '')
    const from = rng === 'MAX' ? t[0] : addDays(t[t.length - 1], -Math.round(yrs * 365.25))
    const cs = new Map<string, number>(((cdi.data?.series || []) as [string, number][]).map(x => [x[0], x[1] / 100]))
    return M.backtest(t, c, sig, from, (cost ?? 0) / 1e4, cs, cash === 'cdi')
  }, [rows, rule, fast, slow, look, cost, rng, cash, cdi.data])
  const codes = ['IBOV', ...((u?.components || []).map((x: any) => x.cod).sort())]
  const note = L(
    'Backtest of a single rule on one asset, on adjusted daily closes. The signal is computed at the close and the position starts on the next day, so there is no look-ahead. Moving-average crossover: long while the fast average is above the slow one. Momentum: long while the price is above its level N days ago. Out of the market the money earns the CDI (or nothing). The cost is charged on every buy and every sell, in basis points of the value traded; taxes, slippage and dividends paid out are ignored. Indicators use data before the start of the chosen period, so the first signal is valid from day one.',
    'Backtest de uma regra em um ativo, com fechamentos diários ajustados. O sinal é calculado no fechamento e a posição começa no dia seguinte, então não há olhar para o futuro. Cruzamento de médias: comprado enquanto a média rápida está acima da lenta. Momento: comprado enquanto o preço está acima do nível de N dias atrás. Fora do mercado o dinheiro rende o CDI (ou nada). O custo é cobrado em cada compra e cada venda, em pontos-base do valor negociado; impostos, deslizamento e proventos pagos são ignorados. Os indicadores usam dados de antes do início do período escolhido, então o primeiro sinal já vale desde o primeiro dia.')
  const right = <>
    <Field label={L('Asset', 'Ativo')}><select aria-label={L('Asset', 'Ativo')} className={inputCls} style={inputStyle} value={tk} onChange={e => setTk(e.target.value)}>{codes.map(c => <option key={c}>{c}</option>)}</select></Field>
    <Field label={L('Period', 'Período')}><Btns opts={['3Y', '5Y', 'MAX']} value={rng} onChange={setRng} /></Field>
  </>
  const s = res?.s, b = res?.b
  const row = (k: string, f: (x: any) => string, col?: (x: any) => string) => [k, s ? f(s) : '—', b ? f(b) : '—', col] as const
  const statRows = [
    row(L('Total return', 'Retorno total'), x => pc(x.total * 100, 1)),
    row(L('Annual return', 'Retorno anual'), x => pc(x.cagr * 100, 2)),
    row(L('Annual volatility', 'Volatilidade anual'), x => pc(x.vol * 100, 2, false)),
    row(L('Sharpe (vs CDI)', 'Sharpe (vs CDI)'), x => n(x.sharpe, 2)),
    row(L('Max drawdown', 'Queda máxima'), x => pc(x.mdd, 1)),
    row(L('Time invested', 'Tempo investido'), x => `${n(x.expo * 100, 0)}%`),
  ]
  return (
    <FnScreen code="BTST" title="Strategy Backtest" right={right} note={note} asOf={res?.to}>
      <Edu en="Past results of a rule fitted on history say little about the future." pt="Resultados passados de uma regra ajustada ao histórico dizem pouco sobre o futuro." />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: '330px minmax(0,1fr)' }}>
        <div className="flex flex-col gap-2 min-h-0">
          <Panel title={L('Rule', 'Regra')}>
            <div className="flex flex-col gap-2 p-2 text-[12px]">
              <Btns opts={[{ v: 'sma', l: L('MA crossover', 'Cruzamento de médias') }, { v: 'mom', l: L('Momentum', 'Momento') }] as any} value={rule} onChange={setRule} />
              {rule === 'sma' ? <div className="flex items-center gap-2"><span style={{ color: C.muted }}>{L('Fast', 'Rápida')}</span><NumIn value={fast} step={1} w={56} onChange={setFast} /><span style={{ color: C.muted }}>{L('Slow', 'Lenta')}</span><NumIn value={slow} step={1} w={56} onChange={setSlow} /><span style={{ color: C.muted }}>{L('days', 'dias')}</span></div>
                : <div className="flex items-center gap-2"><span style={{ color: C.muted }}>{L('Lookback', 'Janela')}</span><NumIn value={look} step={1} w={56} onChange={setLook} /><span style={{ color: C.muted }}>{L('days', 'dias')}</span></div>}
              <div className="flex items-center gap-2"><span style={{ color: C.muted }}>{L('Cost per side (bp)', 'Custo por lado (bp)')}</span><NumIn value={cost} step={1} w={56} onChange={setCost} /></div>
              <div className="flex items-center gap-2"><span style={{ color: C.muted }}>{L('Out of market', 'Fora do mercado')}</span><Btns opts={[{ v: 'cdi', l: 'CDI' }, { v: 'zero', l: L('0%', '0%') }] as any} value={cash} onChange={setCash} /></div>
            </div>
          </Panel>
          <Panel title={L('Rule vs buy and hold', 'Regra vs comprar e segurar')}>
            <table className="w-full text-[12px]" style={{ fontFamily: MONO }}><thead><tr style={{ color: C.amber }}><th className="px-2 text-left font-normal"></th><th className="text-right font-normal">{L('Rule', 'Regra')}</th><th className="px-2 text-right font-normal">{L('Buy & hold', 'Comprar e segurar')}</th></tr></thead>
              <tbody>{statRows.map(([k, a, bb]) => <tr key={k} className="border-t" style={{ borderColor: C.line }}><td className="px-2" style={{ color: C.muted }}>{k}</td><td className="text-right" style={{ color: C.white }}>{a}</td><td className="px-2 text-right">{bb}</td></tr>)}
                <tr className="border-t" style={{ borderColor: C.line }}><td className="px-2" style={{ color: C.muted }}>{L('Round trips / win rate', 'Operações / acerto')}</td><td className="text-right" style={{ color: C.white }}>{res ? `${res.trades.length} / ${res.win != null ? n(res.win * 100, 0) + '%' : '—'}` : '—'}</td><td className="px-2 text-right">—</td></tr></tbody></table>
          </Panel>
          <Panel title={L('Last trades', 'Últimas operações')}>
            {res && <Grid maxH={220} rows={[...res.trades].reverse().slice(0, 40)} cols={[
              { k: 'in', label: L('Entry', 'Entrada'), fmt: (v: string) => dUS(v) },
              { k: 'out', label: L('Exit', 'Saída'), fmt: (v: string | null) => v ? dUS(v) : L('open', 'aberta') },
              { k: 'ret', label: '%', align: 'r', fmt: (v: number) => pc(v * 100, 1), color: (v: number) => cl(v) },
            ]} />}
          </Panel>
        </div>
        <Panel title={`${tk} · ${L('equity (start = 100) and drawdown (%)', 'patrimônio (início = 100) e queda (%)')}`}>
          {res ? <FnChart height={620} panes={[
            { stretch: 3, series: [{ kind: 'line', data: res.eq, color: C.amber, title: L('Rule', 'Regra'), decimals: 1 }, { kind: 'line', data: res.bh, color: C.white, title: L('Buy & hold', 'Comprar e segurar'), decimals: 1 }] },
            { stretch: 1, series: [{ kind: 'area', data: res.dd, color: C.down, title: L('Drawdown', 'Queda'), decimals: 1 }] },
          ]} /> : err ? <Unavailable what={L('the price history', 'o histórico de preços')} /> : <Loading2 />}
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= SVOL =======================
const RV_W = [10, 21, 42, 63, 126, 252]
export function SVOLView() {
  const tk = useJSON<any>('tickers.json')
  const unds = useMemo(() => ((tk.data?.tickers || []) as any[]).filter(t => (t.cov || []).includes('options')).map(t => t.ticker as string).sort(), [tk.data])
  const [sel, setSel] = useState<string | null>(null)
  const [all, setAll] = useState<Record<string, { opt: any; px: { time: string; close: number }[] } | 'na'>>({})
  useEffect(() => {
    let alive = true
    unds.forEach(t => {
      Promise.all([fetchOpt(t), getPrices(t, undefined, undefined, 'd', false)])
        .then(([opt, px]) => alive && setAll(o => ({ ...o, [t]: { opt, px } })))
        .catch(() => alive && setAll(o => ({ ...o, [t]: 'na' })))
    })
    return () => { alive = false }
  }, [unds])
  const rows = useMemo(() => unds.map(t => {
    const a = all[t]
    if (!a || a === 'na') return { t, st: a ? 'na' : 'loading' }
    const term = a.opt.expiries.map((e: any) => ({ date: e.date, bdays: e.bdays, iv: ivAt(smile(e, a.opt.spot), 1) })).filter((e: any) => e.iv != null && e.bdays >= 5)
    const c = a.px.map(p => p.close), lr = M.logRets(c)
    const rv = Object.fromEntries(RV_W.map(w => [w, M.realVol(lr, w)]))
    const iv1m = M.ivAtDays(term, 21)
    return { t, st: 'ok', date: a.opt.date, spot: a.opt.spot, term, rv, iv1m, front: term[0]?.iv ?? null, frontD: term[0]?.bdays ?? null, spread: iv1m != null && rv[21] != null ? iv1m - rv[21] : null, ratio: iv1m != null && rv[21] ? iv1m / rv[21] : null, px: a.px, lr }
  }), [unds, all])
  const cur: any = rows.find(r => r.t === (sel || unds.find(u => u === 'PETR4.SA') || unds[0]))
  const hist = useMemo(() => {
    if (!cur || cur.st !== 'ok') return null
    const roll = M.rollingVol(cur.lr, 21), t = cur.px.map((p: any) => p.time).slice(1)
    const from = addDays(t[t.length - 1], -730)
    return roll.map((v: number | null, i: number) => v == null || t[i] < from ? null : { time: t[i], value: v }).filter(Boolean) as { time: string; value: number }[]
  }, [cur])
  const note = L(
    'Implied volatility is the volatility priced into options; realized volatility is what the stock actually moved. At-the-money implied vol is interpolated at the spot from the out-of-the-money options that traded (puts below, calls above), on the official end-of-day data; the 1-month value interpolates total variance (σ²·T) between the expiries around 21 business days and is "—" when they do not bracket it. Realized vol is the standard deviation of daily log returns over the last N sessions × √252. Implied above realized is the usual volatility risk premium; it is not a signal by itself. Closing premiums and the spot close are not simultaneous, so thin series are noisy.',
    'A volatilidade implícita é a que está no preço das opções; a realizada é quanto a ação de fato oscilou. A vol implícita no dinheiro é interpolada no spot a partir das opções fora do dinheiro negociadas (puts abaixo, calls acima), nos dados oficiais de fechamento; o valor de 1 mês interpola a variância total (σ²·T) entre os vencimentos em torno de 21 dias úteis e fica "—" quando eles não o cercam. A vol realizada é o desvio-padrão dos retornos logarítmicos diários das últimas N sessões × √252. Implícita acima da realizada é o prêmio de risco de volatilidade usual; não é um sinal por si só. Prêmios e spot de fechamento não são simultâneos, então séries pouco negociadas têm ruído.')
  if (!tk.data) return <FnScreen code="SVOL" title="Implied vs Realized Vol"><Loading2 err={tk.err} /></FnScreen>
  const sh = (t: string) => t.replace('.SA', '')
  return (
    <FnScreen code="SVOL" title="Implied vs Realized Vol" note={note} asOf={cur?.date}>
      <Panel title={L('Underlyings with listed options · click a row', 'Ativos com opções listadas · clique numa linha')}>
        <Grid rows={rows} onRow={(r: any) => setSel(r.t)} rowStyle={(r: any) => r.t === cur?.t ? { background: C.panel2 } : undefined} cols={[
          { k: 't', label: L('Underlying', 'Ativo'), fmt: (v: string) => sh(v), color: () => C.amber },
          { k: 'spot', label: 'Spot', align: 'r', fmt: (v: any, r: any) => r.st === 'ok' ? n(v, 2) : r.st === 'na' ? '—' : '…' },
          { k: 'front', label: L('Front ATM IV', 'VI ATM 1º venc.'), align: 'r', fmt: (v: any, r: any) => v == null ? '—' : `${n(v, 1)} (${r.frontD}${L('bd', 'du')})` },
          { k: 'iv1m', label: L('ATM IV 1M', 'VI ATM 1M'), align: 'r', fmt: (v: any) => n(v, 1), color: () => C.white },
          { k: 'rv', label: L('RV 21d', 'VR 21d'), align: 'r', fmt: (v: any) => n(v?.[21], 1) },
          { k: 'rv', label: L('RV 63d', 'VR 63d'), align: 'r', fmt: (v: any) => n(v?.[63], 1) },
          { k: 'spread', label: L('IV − RV (pts)', 'VI − VR (pts)'), align: 'r', fmt: (v: any) => sgn(v, 1), color: (v: any) => cl(v) },
          { k: 'ratio', label: 'IV / RV', align: 'r', fmt: (v: any) => n(v, 2) },
        ]} />
      </Panel>
      <div className="mt-2 grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr)' }}>
        <Panel title={`${cur ? sh(cur.t) : ''} · ${L('ATM implied vol by expiry vs realized vol by window (% a.a.)', 'VI ATM por vencimento vs vol realizada por janela (% a.a.)')}`}>
          {cur?.st === 'ok' ? <XYChart height={430} xLabel={L('business days', 'dias úteis')} xFmt={v => n(v, 0)} yFmt={v => n(v, 0)} series={[
            { name: L('ATM implied', 'Implícita ATM'), points: cur.term.map((e: any) => [e.bdays, e.iv]), color: C.amber, width: 2 },
            { name: L('Realized', 'Realizada'), points: RV_W.map(w => [w, cur.rv[w]]), color: C.cyan, width: 2, dash: '4 3' },
          ]} /> : cur?.st === 'na' ? <Unavailable what={L('options data', 'os dados de opções')} /> : <Loading2 />}
        </Panel>
        <Panel title={L('21-day realized vol, last 2 years (% a.a.)', 'Vol realizada de 21 dias, últimos 2 anos (% a.a.)')}>
          {hist?.length ? <FnChart height={430} panes={[{ stretch: 1, series: [
            { kind: 'line', data: hist, color: C.cyan, title: L('RV 21d', 'VR 21d'), decimals: 1 },
            ...(cur.iv1m != null ? [{ kind: 'line' as const, data: hist.map(p => ({ time: p.time, value: cur.iv1m })), color: C.amber, title: L('ATM IV 1M today', 'VI ATM 1M hoje'), decimals: 1, dashed: true }] : []),
          ] }]} /> : cur?.st === 'na' ? <Unavailable what={L('the price history', 'o histórico de preços')} /> : <Loading2 />}
        </Panel>
        <Panel title={L('Term structure', 'Estrutura a termo')}>
          {cur?.st === 'ok' && <Grid rows={cur.term.map((e: any) => { const w = Math.min(252, Math.max(5, e.bdays)); const rv = M.realVol(cur.lr, w); return { ...e, rv, sp: rv == null ? null : e.iv - rv } })} cols={[
            { k: 'date', label: L('Expiry', 'Vencimento'), fmt: (v: string) => dUS(v), color: () => C.amber },
            { k: 'bdays', label: L('Bus. days', 'Dias úteis'), align: 'r' },
            { k: 'iv', label: L('ATM IV', 'VI ATM'), align: 'r', fmt: (v: number) => n(v, 1), color: () => C.white },
            { k: 'rv', label: L('RV same window', 'VR mesma janela'), align: 'r', fmt: (v: any) => n(v, 1) },
            { k: 'sp', label: 'IV − RV', align: 'r', fmt: (v: any) => sgn(v, 1), color: (v: any) => cl(v) },
          ]} />}
        </Panel>
      </div>
    </FnScreen>
  )
}
async function fetchOpt(t: string) {
  const { getJSON } = await import('@/lib/static')
  return getJSON<any>(`options/${tickerKey(t)}.json`)
}
