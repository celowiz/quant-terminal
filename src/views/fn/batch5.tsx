'use client'
/** P3-J3 – DCF (fluxo de caixa descontado educacional), OSA (montador de estratégias com opções) e IVS (smile/superfície de vol).
 *  Tudo calculado no navegador a partir de dados abertos já no pipeline: CVM DFP/ITR e SEC companyfacts (corp/), Tesouro Direto e FRED
 *  (curves.json), fechamentos (prices/) e B3 COTAHIST (options/). Premissas do usuário ficam em caixas âmbar e são rotuladas como premissas. */
import React, { useMemo, useState } from 'react'
import XYChart from '@/components/fn/XYChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, NA, corpPath, hasData, defaultBench, isBR, short, isoMinus, inputCls, inputStyle } from '@/components/fn/kit'
import { n, sn, pc, cl, dUS, bigE, Kpis, Loading2, NumIn, BarLine, Unavailable } from './fn11util'
import { usePrices } from './tech'
import { regress, weekly, align } from '@/lib/quant'
import { tickerKey } from '@/lib/static'
import { lang } from '@/lib/settings'
import { bs, impliedVol } from '@/lib/bsm.mjs'
import { fcfOf, fcfLtm, wacc, dcf, perShare, impliedG1, sensitivity } from '@/lib/dcf.mjs'
import { netCost, profile, greeks, preset, pnl, type Leg } from '@/lib/osa.mjs'
import { smile, ivAt, surface } from '@/lib/ivs.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const pct = (x: number | null | undefined, d = 1) => x == null || !isFinite(x) ? '—' : `${n(x * 100, d)}%`
const Row = ({ k, children, tag }: { k: string; children: React.ReactNode; tag?: string }) => (
  <div className="flex items-center justify-between gap-2 py-[2px] text-[12px]"><span className="min-w-0 truncate" style={{ color: C.muted }} title={k}>{k}{tag && <span className="ml-1 text-[10px]" style={{ color: tag === 'data' || tag === 'dado' ? C.up : C.amber }}>[{tag}]</span>}</span><span className="shrink-0">{children}</span></div>
)

// ======================= DCF =======================
function useBeta(ticker: string) {
  const a = usePrices(ticker), bench = defaultBench(ticker), b = usePrices(bench)
  return useMemo(() => {
    if (!a.rows?.length || !b.rows?.length) return null
    const last = a.rows[a.rows.length - 1].time, from = isoMinus(last, 0, 0, 2)
    const al = align(weekly(a.rows.map(r => ({ time: r.time, value: r.close }))), weekly(b.rows.map(r => ({ time: r.time, value: r.close }))))
    const x: number[] = [], y: number[] = []
    for (let i = 1; i < al.t.length; i++) if (al.t[i] >= from) { x.push(al.b[i] / al.b[i - 1] - 1); y.push(al.a[i] / al.a[i - 1] - 1) }
    if (x.length < 52) return null
    const raw = regress(x, y).beta
    return { raw, adj: 0.67 * raw + 0.33, n: x.length, bench }
  }, [a.rows, b.rows, bench])
}
/** taxa livre de risco: Tesouro prefixado mais perto de 10 anos (BR) ou Treasury 10 anos (EUA) */
function riskFree(cv: any, br: boolean): { r: number; label: string; date: string } | null {
  if (!cv) return null
  if (br) {
    const pts = (cv.td?.pre?.now?.points || []) as [number, number, string, string][]
    if (!pts.length) return null
    const p = pts.reduce((b, q) => Math.abs(q[0] - 10) < Math.abs(b[0] - 10) ? q : b)
    return { r: p[1] / 100, label: `${p[2]} ${p[3].slice(0, 4)}`, date: cv.td.pre.now.date }
  }
  const p = (cv.us?.now?.points || []).find((q: any) => q[2] === '10A')
  return p ? { r: p[1] / 100, label: 'UST 10Y', date: cv.us.now.date } : null
}
type DcfOv = Partial<Record<'rf' | 'beta' | 'erp' | 'kd' | 'tax' | 'g1' | 'gT', number | null>>
function NotApplicable({ what, note }: { what: string; note: string }) {
  return <div className="p-6 text-[13px]" style={{ fontFamily: MONO, color: C.muted }}><span style={{ color: C.down }}>N/A</span> — {what}<div className="mt-2 text-[12px]">{note}</div></div>
}

export function DCFView({ ticker }: { ticker: string }) {
  const ok = hasData('DCF', ticker)
  const { data: d, err } = useJSON<any>(ok ? corpPath(ticker) : null)
  const { data: cv } = useJSON<any>(ok ? 'curves.json' : null)
  const beta = useBeta(ticker)
  const [basis, setBasis] = useState<'ltm' | 'fy' | 'avg3'>('ltm')
  const [ov, setOv] = useState<DcfOv>({})
  if (!ok) return <FnScreen code="DCF" ticker={ticker}><NA ticker={ticker} what={L('company financial statements (CVM / SEC)', 'demonstrações financeiras (CVM / SEC)')} code="dcf" /></FnScreen>
  if (!d) return <FnScreen code="DCF" ticker={ticker}><Loading2 err={err} /></FnScreen>
  const f = d.fundamentals, br = isBR(ticker), cur = br ? 'R$' : 'US$'
  if (f.bank_format) return <FnScreen code="DCF" ticker={ticker}><NotApplicable what={L('A free-cash-flow DCF does not apply to banks and insurers.', 'Um DCF por fluxo de caixa livre não se aplica a bancos e seguradoras.')} note={L('Banks and insurers fund themselves with deposits and float, so operating and financing cash flows cannot be separated; value them with dividend or residual-income models instead (see VAL and DVD).', 'Bancos e seguradoras se financiam com depósitos e reservas, então não dá para separar o caixa operacional do financeiro; avalie-os por dividendos ou lucro residual (veja VAL e DVD).')} /></FnScreen>
  const A = (f.annual as any[]).filter(r => fcfOf(r) != null), Q = f.quarterly as any[]
  const ltm = fcfLtm(Q), fy = A.length ? fcfOf(A[A.length - 1]) : null
  const avg3 = A.length >= 3 ? A.slice(-3).reduce((s, r) => s + (fcfOf(r) as number), 0) / 3 : null
  const fcf0 = basis === 'ltm' ? ltm : basis === 'fy' ? fy : avg3
  const px = d.raw_close[d.raw_close.length - 1]
  const shares = d.shares && 'equiv' in d.shares ? d.shares.equiv : d.shares?.total ? d.shares.total - (d.shares.treasury || 0) : null
  const bal = Q[Q.length - 1] || A[A.length - 1]
  const mcap = shares ? px[1] * shares : null
  const rf = riskFree(cv, br)
  const base = { rf: rf ? +(rf.r * 100).toFixed(2) : (br ? null : null), beta: beta ? +beta.adj.toFixed(2) : 1, erp: 5, kd: rf ? +(rf.r * 100 + 2).toFixed(2) : null, tax: br ? 34 : 21, g1: 5, gT: br ? 4 : 2.5 }
  const v: any = { ...base, ...Object.fromEntries(Object.entries(ov).filter(([, x]) => x != null)) }
  const set = (k: keyof DcfOv) => (x: number | null) => setOv(o => ({ ...o, [k]: x }))
  const W = v.rf != null && v.kd != null ? wacc({ rf: v.rf / 100, beta: v.beta, erp: v.erp / 100, kd: v.kd / 100, tax: v.tax / 100, E: mcap, D: bal?.debt ?? 0 }) : null
  const P = W && fcf0 != null ? { fcf0, g1: v.g1 / 100, gT: v.gT / 100, w: W.w, n1: 5, n: 10 } : null
  const B = { netdebt: bal?.netdebt ?? 0, minority: bal?.minority ?? 0, shares }
  const R = P ? dcf(P) : null
  const vps = R ? perShare(R.ev, B) : null
  const up = vps != null ? vps / px[1] - 1 : null
  const ig = P ? impliedG1(px[1], P, B) : null
  const ws = W ? [-0.02, -0.01, 0, 0.01, 0.02].map(x => W.w + x) : [], gs = [-0.01, -0.005, 0, 0.005, 0.01].map(x => v.gT / 100 + x)
  const sens = P ? sensitivity(P, B, ws, gs) : []
  const unit = (x: number | null | undefined) => x == null ? '—' : `${cur} ${bigE(x, 1)}`
  const hist = A.slice(-6)
  const labels = [...hist.map(r => `FY${r.period.slice(2, 4)}`), ...(R ? R.years.map(y => `+${y.t}`) : [])]
  const bars = [...hist.map(r => (fcfOf(r) as number) / 1e9), ...(R ? R.years.map(y => y.fcf / 1e9) : [])]
  const line = [...hist.map(() => null), ...(R ? R.years.map(y => y.pv / 1e9) : [])]
  const dataT = L('data', 'dado'), asmT = L('assumption', 'premissa')
  const note = L('Educational model, not a price target. Cash flows come from the company\'s filings (CVM DFP/ITR or SEC 10-K/10-Q); the risk-free rate, beta, market cap and debt are market data; ERP, cost of debt and growth rates are your assumptions (amber).',
    'Modelo didático, não é preço-alvo. Os fluxos vêm dos documentos da empresa (DFP/ITR da CVM ou 10-K/10-Q da SEC); juro livre de risco, beta, valor de mercado e dívida são dados de mercado; prêmio de risco, custo da dívida e crescimento são premissas suas (âmbar).')
  const src = <>{br ? 'CVM DFP/ITR' : 'SEC companyfacts'} · {rf ? (br ? `Tesouro Direto (${dUS(rf.date)})` : `FRED DGS10 (${dUS(rf.date)})`) : ''} · {L('prices', 'preços')} {dUS(px[0])}</>
  return (
    <FnScreen code="DCF" ticker={ticker} source={src} note={note} asOf={bal?.period}
      right={<><Field label={L('FCF base', 'Base do FCL')}><Btns opts={[{ v: 'ltm', l: 'LTM' }, { v: 'fy', l: A.length ? `FY${A[A.length - 1].period.slice(0, 4)}` : 'FY' }, { v: 'avg3', l: L('3Y avg', 'Média 3a') }]} value={basis} onChange={setBasis} /></Field>
        <button onClick={() => setOv({})} className="border px-2 py-[1px]" style={{ borderColor: C.line, color: C.cyan }}>{L('Reset', 'Restaurar')}</button></>}>
      <Kpis items={[
        [L('Price', 'Preço'), `${cur} ${n(px[1])}`, C.white],
        [L('DCF value / share', 'Valor DCF / ação'), vps == null ? '—' : `${cur} ${n(vps)}`, C.amber],
        [L('Upside', 'Potencial'), up == null ? '—' : pc(up * 100, 1), cl(up)],
        ['WACC', pct(W?.w, 2)],
        [L('Terminal value % EV', 'Valor terminal % EV'), pct(R?.tvShare, 0)],
        [L('Price-implied g (yrs 1–5)', 'g implícito no preço (anos 1–5)'), ig == null ? '—' : pct(ig, 1), C.cyan],
      ]} />
      {fcf0 != null && fcf0 <= 0 && <div className="mb-2 px-2 py-1 text-[12px] border" style={{ borderColor: C.down, color: C.down }}>{L('Base free cash flow is negative: a DCF on it gives a negative value. Try another base, or the company may be in a heavy investment cycle.', 'O fluxo de caixa livre base é negativo: o DCF dá valor negativo. Tente outra base; a empresa pode estar num ciclo forte de investimento.')}</div>}
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,0.85fr) minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L('Assumptions & cost of capital', 'Premissas e custo de capital')}>
          <div className="px-2 py-1">
            <Row k={`Rf · ${rf?.label || '—'}`} tag={dataT}><NumIn value={v.rf} onChange={set('rf')} /></Row>
            <Row k={beta ? `β · ${L('2Y weekly vs', '2a semanal vs')} ${short(beta.bench)}` : 'β'} tag={beta ? dataT : asmT}><NumIn value={v.beta} onChange={set('beta')} step={0.05} /></Row>
            <Row k={L('Equity risk premium', 'Prêmio de risco (ERP)')} tag={asmT}><NumIn value={v.erp} onChange={set('erp')} /></Row>
            <Row k={L('Cost of debt (pre-tax)', 'Custo da dívida (antes IR)')} tag={asmT}><NumIn value={v.kd} onChange={set('kd')} /></Row>
            <Row k={L('Tax rate (statutory)', 'Alíquota IR (nominal)')} tag={asmT}><NumIn value={v.tax} onChange={set('tax')} step={1} /></Row>
            <Row k={L('Growth yrs 1–5 (g1)', 'Crescimento anos 1–5 (g1)')} tag={asmT}><NumIn value={v.g1} onChange={set('g1')} step={0.5} /></Row>
            <Row k={L('Perpetual growth (g∞)', 'Crescimento perpétuo (g∞)')} tag={asmT}><NumIn value={v.gT} onChange={set('gT')} step={0.25} /></Row>
          </div>
          <KV rows={[
            [L('Cost of equity Ke', 'Custo do capital próprio Ke'), pct(W?.ke, 2)],
            [L('After-tax Kd', 'Kd após IR'), v.kd == null ? '—' : pct(v.kd / 100 * (1 - v.tax / 100), 2)],
            [L('Weights E / D', 'Pesos E / D'), W ? `${n(W.we * 100, 0)}% / ${n(W.wd * 100, 0)}%` : '—'],
            [L('Market cap (E)', 'Valor de mercado (E)'), unit(mcap)],
            [L('Gross debt (D)', 'Dívida bruta (D)'), unit(bal?.debt)],
            [L('Base FCF', 'FCL base'), unit(fcf0)],
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={L(`Free cash flow: reported and projected (${cur} bn) · line = present value`, `Fluxo de caixa livre: realizado e projetado (${cur} bi) · linha = valor presente`)}>
            <BarLine labels={labels} bars={bars} line={line} height={250} barName={L('FCF', 'FCL')} lineName={L('PV of FCF', 'VP do FCL')} barFmt={x => n(x, 1)} lineFmt={x => n(x, 1)} />
          </Panel>
          <Panel title={L('Reported cash flow (fiscal years)', 'Fluxo de caixa realizado (exercícios)')}>
            <Grid maxH={190} rows={[...hist].reverse()} cols={[
              { k: 'period', label: L('Fiscal year', 'Exercício'), fmt: x => dUS(x), color: () => C.amber },
              { k: 'revenue', label: L('Revenue', 'Receita'), align: 'r', fmt: x => bigE(x, 1) },
              { k: 'cfo', label: L('Op. cash flow', 'Caixa operac.'), align: 'r', fmt: x => bigE(x, 1) },
              { k: 'capex', label: 'Capex', align: 'r', fmt: x => bigE(x, 1), color: () => C.down },
              { k: 'fcf', label: L('FCF', 'FCL'), align: 'r', fmt: (_, r: any) => bigE(fcfOf(r), 1), color: (_, r: any) => cl(fcfOf(r)) },
              { k: 'm', label: L('FCF margin', 'Margem FCL'), align: 'r', fmt: (_, r: any) => r.revenue ? pc((fcfOf(r) as number) / r.revenue * 100, 1) : '—' },
            ]} />
          </Panel>
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={L('From enterprise value to value per share', 'Do valor da firma ao valor por ação')}>
            <KV rows={[
              [L('PV of FCF, years 1–10', 'VP do FCL, anos 1–10'), unit(R?.pvFcf)],
              [L('PV of terminal value', 'VP do valor terminal'), unit(R?.pvTv)],
              [L('Enterprise value (EV)', 'Valor da firma (EV)'), unit(R?.ev), C.white],
              [L('− Net debt', '− Dívida líquida'), unit(bal?.netdebt)],
              [L('− Minority interests', '− Minoritários'), unit(bal?.minority ?? 0)],
              [L('Equity value', 'Valor do patrimônio'), unit(R ? R.ev - B.netdebt - B.minority : null), C.white],
              [L('Shares (ex-treasury)', 'Ações (ex-tesouraria)'), shares ? bigE(shares, 2) : '—'],
              [L('Value per share', 'Valor por ação'), vps == null ? '—' : `${cur} ${n(vps)}`, C.amber],
            ]} />
          </Panel>
          <Panel title={L('Sensitivity: value per share (WACC × g∞)', 'Sensibilidade: valor por ação (WACC × g∞)')}>
            <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
              <thead><tr><th className="px-1 text-left" style={{ color: C.muted }}>WACC \ g∞</th>{gs.map((g, j) => <th key={j} className="px-1 text-right" style={{ color: j === 2 ? C.amber : C.muted }}>{pct(g, 1)}</th>)}</tr></thead>
              <tbody>{sens.map((row, i) => <tr key={i}><td className="px-1" style={{ color: i === 2 ? C.amber : C.muted }}>{pct(ws[i], 1)}</td>{row.map((x, j) => <td key={j} className="px-1 text-right" style={{ color: x == null ? C.muted : x >= px[1] ? C.up : C.down, background: i === 2 && j === 2 ? C.line : undefined }}>{x == null ? '—' : n(x)}</td>)}</tr>)}</tbody>
            </table>
            <div className="px-1 pt-1 text-[11px]" style={{ color: C.muted }}>{L('Green = above today\'s price; red = below. "—" where WACC ≤ g∞.', 'Verde = acima do preço atual; vermelho = abaixo. "—" quando WACC ≤ g∞.')}</div>
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= OSA =======================
type Spec = { kind: 'C' | 'P' | 'S'; side: 1 | -1; qty: number; K: number; exp: string }
const PRESETS: [string, string, string][] = [
  ['long_call', 'Long call', 'Compra de call'], ['long_put', 'Long put', 'Compra de put'], ['bull_call', 'Bull call spread', 'Trava de alta (calls)'],
  ['bear_put', 'Bear put spread', 'Trava de baixa (puts)'], ['straddle', 'Long straddle', 'Straddle comprado'], ['strangle', 'Long strangle', 'Strangle comprado'],
  ['butterfly', 'Call butterfly', 'Borboleta (calls)'], ['condor', 'Iron condor', 'Condor de ferro'], ['covered_call', 'Covered call', 'Venda coberta'], ['protective_put', 'Protective put', 'Put de proteção'],
]
const traded = (o: any) => o.trades > 0 && o.last > 0
function atmIv(e: any, spot: number) { const s = smile(e, spot); const a = ivAt(s, 1); return a != null ? a / 100 : s.length ? s.reduce((x, p) => x + p.iv, 0) / s.length / 100 : null }
export function OSAView({ ticker }: { ticker: string }) {
  const ok = hasData('OSA', ticker)
  const { data: d, err } = useJSON<any>(ok ? `options/${tickerKey(ticker)}.json` : null)
  const [ei, setEi] = useState<number | null>(null), [pre, setPre] = useState('bull_call')
  const [legs, setLegs] = useState<Spec[] | null>(null), [lot, setLot] = useState(100), [hd, setHd] = useState<number | null>(null)
  const exps = (d?.expiries || []) as any[]
  const defIdx = useMemo(() => { let b = 0, bn = -1; exps.forEach((e, i) => { const c = [...e.calls, ...e.puts].filter(traded).length; if (e.bdays >= 5 && c > bn) { b = i; bn = c } }); return b }, [exps])
  if (!ok) return <FnScreen code="OSA" ticker={ticker}><NA ticker={ticker} what={L('listed options (B3 COTAHIST)', 'opções listadas (COTAHIST B3)')} code="osa" /></FnScreen>
  if (!d) return <FnScreen code="OSA" ticker={ticker}><Loading2 err={err} /></FnScreen>
  const S = d.spot, r = d.r_cont, idx = ei ?? defIdx, e = exps[idx]
  const ks = (arr: any[]) => { const t = arr.filter(traded).map(o => o.strike); return (t.length >= 3 ? t : arr.map(o => o.strike)).sort((a, b) => a - b) }
  const specs: Spec[] = legs ?? preset(pre, S, ks(e.calls), ks(e.puts)).filter(l => l.K != null).map(l => ({ ...l, qty: lot, exp: e.date }))
  const expBy = (dt: string) => exps.find(x => x.date === dt) || e
  const resolve = (l: Spec): Leg & { src: string; code: string; exp: string } => {
    if (l.kind === 'S') return { ...l, prem: S, T: 0, iv: 0, src: L('spot', 'spot'), code: short(ticker) }
    const x = expBy(l.exp), T = x.bdays / 252, o = (l.kind === 'C' ? x.calls : x.puts).find((q: any) => q.strike === l.K)
    const a = atmIv(x, S) ?? 0.3
    if (o && traded(o)) return { ...l, prem: o.last, T, iv: o.iv != null ? o.iv / 100 : a, src: L('last', 'últ.'), code: o.code }
    if (o && o.bid > 0 && o.ask > 0) { const m = (o.bid + o.ask) / 2; return { ...l, prem: m, T, iv: impliedVol(l.kind === 'C', m, S, l.K, T, r, 0) ?? a, src: L('mid', 'meio'), code: o.code } }
    return { ...l, prem: bs(l.kind === 'C', S, l.K, T, r, 0, a)?.price ?? 0, T, iv: a, src: L('model', 'modelo'), code: o?.code || '—' }
  }
  const R = specs.map(resolve)
  const opts = R.filter(l => l.kind !== 'S'), Tmin = opts.length ? Math.min(...opts.map(l => l.T)) : 0
  const hMax = Math.round(Tmin * 252), h = Math.min(hd ?? Math.round(hMax / 2), hMax)
  const allK = opts.map(l => l.K), lo = Math.min(S * 0.7, ...allK.map(k => k * 0.9)), hi = Math.max(S * 1.3, ...allK.map(k => k * 1.1))
  const xs = Array.from({ length: 241 }, (_, i) => lo + (hi - lo) * i / 240)
  const atExp = profile(R, xs, Tmin, r), now = profile(R, xs, 0, r)
  const mid = h > 0 && h < hMax ? xs.map(s => pnl(R, s, h / 252, r)) : null
  const G = greeks(R, S, r), cost = netCost(R)
  const multi = new Set(opts.map(l => l.exp)).size > 1
  const edit = (i: number, p: Partial<Spec>) => setLegs(specs.map((l, j) => j === i ? { ...l, ...p } : l))
  const strikesOf = (l: Spec) => { const x = expBy(l.exp); return (l.kind === 'C' ? x.calls : x.puts).map((o: any) => o.strike).sort((a: number, b: number) => a - b) }
  const money = (x: number) => `R$ ${n(x, 0)}`
  const note = L('End-of-day B3 premiums (COTAHIST); P&L in R$ for the quantity of each leg (1 lot = 100 options). Values before expiry use Black-Scholes with each leg\'s implied vol, so they are model estimates.',
    'Prêmios de fechamento da B3 (COTAHIST); resultado em R$ para a quantidade de cada perna (1 lote = 100 opções). Os valores antes do vencimento usam Black-Scholes com a vol implícita de cada perna, então são estimativas do modelo.')
  return (
    <FnScreen code="OSA" ticker={ticker} source={<>B3 COTAHIST ({dUS(d.date)}) · {L('model computed in your browser', 'modelo calculado no navegador')}</>} note={note}
      right={<><span>Spot <b style={{ color: C.amber }}>{n(S)}</b></span><span style={{ color: C.muted }}>r {n(r * 100, 2)}%</span>
        <Field label={L('Expiry', 'Vencimento')}><select value={idx} onChange={x => { setEi(+x.target.value); setLegs(null); setHd(null) }} className={inputCls} style={inputStyle}>{exps.map((x, i) => <option key={x.date} value={i}>{dUS(x.date)} ({x.bdays} {L('bd', 'du')})</option>)}</select></Field>
        <Field label={L('Strategy', 'Estrutura')}><select data-osa-preset value={pre} onChange={x => { setPre(x.target.value); setLegs(null) }} className={inputCls} style={inputStyle}>{PRESETS.map(p => <option key={p[0]} value={p[0]}>{L(p[1], p[2])}</option>)}</select></Field>
        <Field label={L('Qty', 'Qtd.')}><NumIn value={lot} onChange={x => { if (x && x > 0) { setLot(x); setLegs(legs ? legs.map(l => ({ ...l, qty: x })) : null) } }} step={100} w={56} /></Field></>}>
      <Kpis items={[
        [cost >= 0 ? L('Net debit', 'Débito líquido') : L('Net credit', 'Crédito líquido'), money(Math.abs(cost)), cost >= 0 ? C.down : C.up],
        [L('Max gain (expiry)', 'Ganho máx. (venc.)'), atExp.unlimitedUp ? L('Unlimited', 'Ilimitado') : money(atExp.max), C.up],
        [L('Max loss (expiry)', 'Perda máx. (venc.)'), atExp.unlimitedDown ? L('Unlimited', 'Ilimitada') : money(atExp.min), C.down],
        [L('Breakevens', 'Pontos de equilíbrio'), atExp.be.length ? atExp.be.map(x => n(x)).join(' · ') : '—', C.white],
        [L('Net delta', 'Delta líquido'), sn(G.delta, 0)],
        [L('Theta / day', 'Theta / dia'), money(G.theta), cl(G.theta)],
        [L('Vega / 1 pp', 'Vega / 1 p.p.'), money(G.vega)],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.45fr) minmax(0,1fr)' }}>
        <Panel title={L(`Profit & loss vs underlying price${multi ? ' (solid = first expiry)' : ''}`, `Resultado vs preço do ativo${multi ? ' (sólida = primeiro vencimento)' : ''}`)}
          right={hMax > 1 ? <span className="flex items-center gap-1 text-[11px]" style={{ color: C.muted }}>{L('horizon', 'horizonte')}<input type="range" min={0} max={hMax} value={h} onChange={x => setHd(+x.target.value)} style={{ width: 90, accentColor: C.amber }} /><span style={{ color: C.white }}>+{h} {L('bd', 'du')}</span></span> : null}>
          <XYChart height={460} zeroLine xFmt={x => n(x)} yFmt={x => n(x, 0)} xLabel={L('underlying price at the date', 'preço do ativo na data')} series={[
            { name: L('At expiry', 'No vencimento'), points: xs.map((x, i) => [x, atExp.ys[i]]), color: C.amber, width: 2 },
            { name: L('Today', 'Hoje'), points: xs.map((x, i) => [x, now.ys[i]]), color: C.cyan, width: 1.5, dash: '4 3' },
            ...(mid ? [{ name: `+${h} ${L('bd', 'du')}`, points: xs.map((x, i) => [x, mid[i]] as [number, number]), color: C.white, width: 1, dash: '2 2' }] : []),
            { name: 'Spot', points: [[S, Math.min(atExp.min, now.min)], [S, Math.max(atExp.max, now.max)]], color: C.muted, width: 1, dash: '1 3' },
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={L('Legs · edit side, type, strike, expiry, quantity', 'Pernas · edite lado, tipo, strike, vencimento, quantidade')}
            right={<><button data-osa-add onClick={() => setLegs([...specs, { kind: 'C', side: 1, qty: lot, K: specs.find(l => l.kind !== 'S')?.K ?? ks(e.calls)[0], exp: e.date }])} style={{ color: C.cyan }}>+ {L('leg', 'perna')}</button></>}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
                <thead><tr style={{ color: C.muted }}>{[L('Side', 'Lado'), L('Type', 'Tipo'), 'Strike', L('Expiry', 'Venc.'), L('Qty', 'Qtd.'), L('Prem.', 'Prêmio'), L('Src', 'Fonte'), 'IV', L('Series', 'Série'), ''].map((h, i) => <th key={i} className={`px-1 py-[2px] ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
                <tbody>{specs.map((l, i) => { const x = R[i]; return (
                  <tr key={i} className="border-t" style={{ borderColor: C.line }}>
                    <td className="px-1"><button onClick={() => edit(i, { side: l.side === 1 ? -1 : 1 })} className="px-1 border" style={{ borderColor: C.line, color: l.side === 1 ? C.up : C.down }}>{l.side === 1 ? L('BUY', 'COMPRA') : L('SELL', 'VENDA')}</button></td>
                    <td className="px-1"><select value={l.kind} onChange={ev => { const k = ev.target.value as Spec['kind']; edit(i, { kind: k, K: k === 'S' ? 0 : (l.K || S) }) }} className={inputCls} style={inputStyle}><option value="C">Call</option><option value="P">Put</option><option value="S">{L('Stock', 'Ação')}</option></select></td>
                    <td className="px-1">{l.kind === 'S' ? '—' : <select value={l.K} onChange={ev => edit(i, { K: +ev.target.value })} className={inputCls} style={inputStyle}>{(strikesOf(l).includes(l.K) ? strikesOf(l) : [l.K, ...strikesOf(l)]).map((k: number) => <option key={k} value={k}>{n(k)}</option>)}</select>}</td>
                    <td className="px-1">{l.kind === 'S' ? '—' : <select value={l.exp} onChange={ev => edit(i, { exp: ev.target.value })} className={inputCls} style={inputStyle}>{exps.map(q => <option key={q.date} value={q.date}>{dUS(q.date)}</option>)}</select>}</td>
                    <td className="px-1 text-right"><NumIn value={l.qty} onChange={q => q && q > 0 && edit(i, { qty: q })} step={100} w={48} /></td>
                    <td className="px-1 text-right">{n(x.prem)}</td>
                    <td className="px-1 text-right" style={{ color: x.src === L('model', 'modelo') ? C.amber : C.muted }}>{x.src}</td>
                    <td className="px-1 text-right">{l.kind === 'S' ? '—' : n(x.iv * 100, 1)}</td>
                    <td className="px-1" style={{ color: C.amber }}>{x.code}</td>
                    <td className="px-1"><button onClick={() => setLegs(specs.filter((_, j) => j !== i))} style={{ color: C.down }} title={L('remove', 'remover')}>×</button></td>
                  </tr>) })}</tbody>
              </table>
            </div>
          </Panel>
          <Panel title={L('Scenario table (P&L in R$)', 'Tabela de cenários (resultado em R$)')}>
            <Grid maxH={260} rows={[-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map(m => ({ m, s: S * (1 + m), now: pnl(R, S * (1 + m), 0, r), mid: h > 0 ? pnl(R, S * (1 + m), Math.min(h, hMax) / 252, r) : null, exp: pnl(R, S * (1 + m), Tmin, r) }))} cols={[
              { k: 'm', label: L('Move', 'Variação'), fmt: x => pc(x * 100, 0), color: x => cl(x) },
              { k: 's', label: L('Price', 'Preço'), align: 'r', fmt: x => n(x) },
              { k: 'now', label: L('Today', 'Hoje'), align: 'r', fmt: x => n(x, 0), color: x => cl(x == null ? x : Math.round(x)) },
              { k: 'mid', label: `+${h} ${L('bd', 'du')}`, align: 'r', fmt: x => x == null ? '—' : n(x, 0), color: x => cl(x == null ? x : Math.round(x)) },
              { k: 'exp', label: L('Expiry', 'Venc.'), align: 'r', fmt: x => n(x, 0), color: x => cl(x == null ? x : Math.round(x)) },
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= IVS =======================
const GRID = [0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2]
const SMILE_COLORS = [C.amber, C.cyan, C.up, C.white, '#C77DFF', '#FF4D4D', '#FFE14D', '#4FC3F7']
function heat(v: number | null, lo: number, hi: number) {
  if (v == null) return 'transparent'
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)))
  // azul (baixa) → âmbar → vermelho (alta)
  const c = t < 0.5 ? [47 + (255 - 47) * t * 2, 123 + (160 - 123) * t * 2, 255 + (40 - 255) * t * 2] : [255, 160 - (160 - 77) * (t - 0.5) * 2, 40 + (77 - 40) * (t - 0.5) * 2]
  return `rgba(${c.map(Math.round).join(',')},0.55)`
}
export function IVSView({ ticker }: { ticker: string }) {
  const ok = hasData('IVS', ticker)
  const { data: d, err } = useJSON<any>(ok ? `options/${tickerKey(ticker)}.json` : null)
  const [minT, setMinT] = useState(1), [ax, setAx] = useState<'m' | 'K'>('m')
  const sf = useMemo(() => d ? surface(d.expiries, d.spot, GRID, 3, { minTrades: minT }) : [], [d, minT])
  if (!ok) return <FnScreen code="IVS" ticker={ticker}><NA ticker={ticker} what={L('listed options (B3 COTAHIST)', 'opções listadas (COTAHIST B3)')} code="ivs" /></FnScreen>
  if (!d) return <FnScreen code="IVS" ticker={ticker}><Loading2 err={err} /></FnScreen>
  const S = d.spot
  const all = sf.flatMap(r => r.row).filter((x): x is number => x != null)
  const lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1
  const front = sf[0], next = sf[1]
  const nPts = sf.reduce((s, r) => s + r.pts.length, 0)
  const note = L('Implied vols from the B3 closing premiums (COTAHIST), out-of-the-money series only, that traded at least the minimum number of times. Premium and spot closes are not simultaneous; read short-dated and thinly traded points with care.',
    'Vols implícitas dos prêmios de fechamento da B3 (COTAHIST), só séries fora do dinheiro com o mínimo de negócios escolhido. Prêmio e fechamento do ativo não são simultâneos; leia com cuidado os pontos de vencimentos curtos e pouco negociados.')
  return (
    <FnScreen code="IVS" ticker={ticker} source={<>B3 COTAHIST ({dUS(d.date)}) · {d.model || 'Black-Scholes'}</>} note={note}
      right={<><span>Spot <b style={{ color: C.amber }}>{n(S)}</b></span>
        <Field label={L('X axis', 'Eixo X')}><Btns opts={[{ v: 'm', l: 'K/S' }, { v: 'K', l: 'Strike' }]} value={ax} onChange={setAx} /></Field>
        <Field label={L('Min. trades', 'Mín. negócios')}><Btns opts={[1, 5, 20]} value={minT} onChange={setMinT} /></Field></>}>
      <Kpis items={[
        [L('Front ATM vol', 'Vol ATM 1º venc.'), front?.atm != null ? `${n(front.atm, 1)}%` : '—', C.amber],
        [L('Front expiry', '1º vencimento'), front ? `${dUS(front.date)} · ${front.bdays} ${L('bd', 'du')}` : '—', C.white],
        [L('Next ATM vol', 'Vol ATM 2º venc.'), next?.atm != null ? `${n(next.atm, 1)}%` : '—'],
        [L('Front skew 90–110', 'Skew 90–110 (1º)'), front?.skew != null ? `${sn(front.skew, 1)} pp` : '—', cl(front?.skew)],
        [L('Expiries in surface', 'Vencimentos na superfície'), `${sf.length} / ${d.expiries.length}`],
        [L('Quotes used', 'Cotações usadas'), String(nPts)],
      ]} />
      {!sf.length ? <Unavailable what={L('An implied-vol surface', 'Uma superfície de vol implícita')} note={L('No expiry has 3 or more traded out-of-the-money series with this filter.', 'Nenhum vencimento tem 3 ou mais séries fora do dinheiro negociadas com este filtro.')} /> : (
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L('Volatility smile by expiry (OTM series, % a.a.)', 'Smile de volatilidade por vencimento (séries OTM, % a.a.)')}>
          <XYChart height={300} xFmt={x => ax === 'm' ? `${n(x * 100, 0)}%` : n(x)} yFmt={x => n(x, 0)} xLabel={ax === 'm' ? L('moneyness K/S', 'moneyness K/S') : 'strike'} series={[
            ...sf.map((r, i) => ({ name: `${dUS(r.date)} (${r.bdays}${L('bd', 'du')})`, points: r.pts.map(p => [ax === 'm' ? p.k : p.K, p.iv] as [number, number]), color: SMILE_COLORS[i % SMILE_COLORS.length], width: i < 2 ? 2 : 1.2 })),
            { name: 'ATM', points: [[ax === 'm' ? 1 : S, lo], [ax === 'm' ? 1 : S, hi]], color: C.muted, width: 1, dash: '1 3' },
          ]} />
        </Panel>
        <Panel title={L('Term structure: ATM vol and 90–110 skew', 'Estrutura a termo: vol ATM e skew 90–110')}>
          <XYChart height={300} xFmt={x => `${n(x, 0)}${L('bd', 'du')}`} yFmt={x => n(x, 0)} xLabel={L('business days to expiry', 'dias úteis até o vencimento')} series={[
            { name: L('ATM vol %', 'Vol ATM %'), points: sf.filter(r => r.atm != null).map(r => [r.bdays, r.atm] as [number, number]), color: C.amber, width: 2 },
            { name: L('Skew 90–110 (pp)', 'Skew 90–110 (p.p.)'), points: sf.filter(r => r.skew != null).map(r => [r.bdays, r.skew] as [number, number]), color: C.cyan, width: 1.5, dash: '4 3' },
          ]} />
        </Panel>
        <div className="min-w-0" style={{ gridColumn: "1 / -1" }}>
          <Panel title={L('Implied-vol surface (% a.a.) · expiry × moneyness · interpolated between traded strikes, blank = no data', 'Superfície de vol implícita (% a.a.) · vencimento × moneyness · interpolada entre strikes negociados, vazio = sem dado')}>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
                <thead><tr style={{ color: C.muted }}><th className="px-1 text-left">{L('Expiry', 'Vencimento')}</th><th className="px-1 text-right">{L('bd', 'du')}</th>{GRID.map(m => <th key={m} className="px-1 text-right" style={{ color: m === 1 ? C.amber : C.muted }}>{n(m * 100, 0)}%</th>)}<th className="px-1 text-right">{L('Skew', 'Skew')}</th><th className="px-1 text-right">{L('Quotes', 'Cotações')}</th></tr></thead>
                <tbody>{sf.map(r => (
                  <tr key={r.date} className="border-t" style={{ borderColor: C.line }}>
                    <td className="px-1" style={{ color: C.amber }}>{dUS(r.date)}</td><td className="px-1 text-right" style={{ color: C.muted }}>{r.bdays}</td>
                    {r.row.map((v, j) => <td key={j} className="px-1 text-right" style={{ background: heat(v, lo, hi), color: v == null ? C.muted : C.white }}>{v == null ? '' : n(v, 1)}</td>)}
                    <td className="px-1 text-right" style={{ color: cl(r.skew) }}>{r.skew == null ? '—' : sn(r.skew, 1)}</td><td className="px-1 text-right" style={{ color: C.muted }}>{r.pts.length}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>)}
    </FnScreen>
  )
}
