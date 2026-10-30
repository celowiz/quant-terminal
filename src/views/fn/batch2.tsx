'use client'
import { tc } from '../../lib/themeRuntime'
/** P2-H2 – funções novas: MEMB (carteira teórica do Ibovespa), OVME (calculadora Black-Scholes), EVTS (eventos sobre o gráfico).
 *  MEMB usa universe.json (B3 GetPortfolioDay + fechamentos); OVME roda no navegador com options/<t>.json; EVTS junta corp/<t>.json e calendar.json. */
import React, { useMemo, useState } from 'react'
import { bs, impliedVol } from '@/lib/bsm.mjs'
import Link from 'next/link'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, NA, corpPath, hasData, inputCls, inputStyle } from '@/components/fn/kit'
import { n, sn, pc, cl, dUS, bigE, Kpis, Loading2 } from './fn11util'
import { usePrices } from './tech'
import { tickerKey } from '@/lib/static'
import { lang } from '@/lib/settings'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const isoAgo = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10)
const short = (t: string) => t.replace(/\.SA$/, '')

// ======================= MEMB =======================
const PER = [{ v: '1D', l: '1D' }, { v: '5D', l: '5D' }, { v: '1M', l: '1M' }, { v: '3M', l: '3M' }, { v: 'YTD', l: 'YTD' }]
/** índice da data inicial do período na lista de datas (último pregão anterior ao corte) */
function startIdx(dates: string[], end: number, per: string) {
  if (per === '1D') return end - 1
  if (per === '5D') return end - 5
  const cut = per === '1M' ? isoAgo(dates[end], 30) : per === '3M' ? isoAgo(dates[end], 91) : `${dates[end].slice(0, 4)}-01-01`
  let i = end; while (i > 0 && dates[i - 1] >= cut) i--
  return per === 'YTD' ? Math.max(0, i - 1) : i
}
const valid = (arr: (number | null)[], i: number) => { for (let k = i; k >= 0; k--) if (arr[k] != null) return arr[k] as number; return null }

// setores da carteira B3 vêm abreviados e com grafias diferentes ('Financ e Outros' / 'Financeiro e Outros')
const SECT: [RegExp, string, string][] = [
  [/^financ/i, 'Financials & Other', 'Financeiro e outros'], [/^utilidade/i, 'Utilities', 'Utilidade pública'],
  [/^cons(umo)? c[ií]cl/i, 'Consumer Cyclical', 'Consumo cíclico'], [/^cons(umo)? n/i, 'Consumer Non-cyclical', 'Consumo não cíclico'],
  [/^mat/i, 'Basic Materials', 'Materiais básicos'], [/^petr/i, 'Oil, Gas & Biofuels', 'Petróleo, gás e biocombustíveis'],
  [/^bens/i, 'Industrials', 'Bens industriais'], [/^sa[uú]de/i, 'Health Care', 'Saúde'], [/^telec/i, 'Telecom', 'Telecomunicações'],
  [/^tec/i, 'Technology', 'Tecnologia da informação'], [/^divers/i, 'Diversified', 'Diversos'],
]
const sectorName = (raw: string) => { const x = (raw || '').replace(/\s+/g, ' ').trim(); const f = SECT.find(([re]) => re.test(x)); return f ? L(f[1], f[2]) : x }

export function MEMBView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const [per, setPer] = useState('1D'), [sort, setSort] = useState('weight'), [sec, setSec] = useState<string | null>(null)
  const m = useMemo(() => {
    if (!u) return null
    const dates: string[] = u.dates, bv: (number | null)[] = u.close['^BVSP'] || []
    // último pregão com o índice e a maioria das ações (a barra do dia pode sair antes das ações no Yahoo)
    let end = dates.length - 1
    while (end > 0 && (bv[end] == null || u.components.filter((c: any) => u.close[c.cod]?.[end] != null).length < u.components.length / 2)) end--
    const st = Math.max(0, startIdx(dates, end, per)), red = u.reductor
    const rows = (u.components as any[]).map(c => {
      const s = u.close[c.cod] || [], p1 = valid(s, end), p0 = valid(s, st)
      const ret = p1 != null && p0 ? (p1 / p0 - 1) * 100 : null
      const pts = c.qty && red && p1 != null ? c.qty * p1 / red : null
      const contrib = c.qty && red && p1 != null && p0 != null ? c.qty * (p1 - p0) / red : null
      return { ...c, sector: sectorName(c.sector), px: p1, ret, pts, contrib }
    })
    const idx1 = valid(bv, end), idx0 = valid(bv, st)
    const sectors = new Map<string, { w: number; c: number; k: number }>()
    rows.forEach(r => { const o = sectors.get(r.sector) || { w: 0, c: 0, k: 0 }; o.w += r.weight || 0; o.c += r.contrib || 0; o.k++; sectors.set(r.sector, o) })
    const w = rows.map(r => (r.weight || 0) / 100)
    return { rows, dates, end, st, idx1, idx0, sumC: rows.reduce((s, r) => s + (r.contrib || 0), 0), implied: red ? rows.reduce((s, r) => s + (r.pts || 0), 0) : null,
      sectors: Array.from(sectors.entries()).map(([k, v]) => ({ sector: k, ...v })).sort((a, b) => b.w - a.w),
      top10: rows.map(r => r.weight || 0).sort((a, b) => b - a).slice(0, 10).reduce((s, x) => s + x, 0), effN: 1 / w.reduce((s, x) => s + x * x, 0) }
  }, [u, per])
  if (!u || !m) return <FnScreen code="MEMB" title="Index Members (Ibovespa)"><Loading2 err={err} /></FnScreen>
  const hasQ = !!u.reductor
  const key = sort === 'weight' ? 'weight' : sort === 'ret' ? 'ret' : 'contrib'
  const rows = m.rows.filter(r => !sec || r.sector === sec).sort((a, b) => (b[key] ?? -1e9) - (a[key] ?? -1e9))
  const byC = m.rows.filter(r => r.contrib != null).sort((a, b) => b.contrib - a.contrib)
  const movers = [...byC.slice(0, 6), ...byC.slice(-6)].filter((r, i, a) => a.indexOf(r) === i)
  const maxC = Math.max(...movers.map(r => Math.abs(r.contrib)), 1e-9), maxW = Math.max(...m.sectors.map(s => s.w), 1)
  const dIdx = m.idx1 != null && m.idx0 != null ? m.idx1 - m.idx0 : null
  const note = L('Weights and theoretical quantities are B3\'s official portfolio of the day. Index points per member = theoretical quantity × price ÷ reductor. Contributions use today\'s quantities and Yahoo adjusted closes (the Ibovespa is a total-return index, so dividends count), so for periods spanning a rebalance (Jan, May, Sep) they are an approximation; compare their sum with the actual index change.',
    'Pesos e quantidades teóricas são a carteira oficial do dia da B3. Pontos do índice por ação = quantidade teórica × preço ÷ redutor. As contribuições usam as quantidades de hoje e fechamentos ajustados do Yahoo (o Ibovespa é um índice de retorno total, então proventos contam); em períodos que cruzam um rebalanceamento (jan, mai, set) são aproximação — compare a soma com a variação real do índice.')
  return (
    <FnScreen code="MEMB" title={L('Index Members (Ibovespa)', 'Composição do índice (Ibovespa)')} source={u.source} note={note}
      right={<><span style={{ color: C.muted }}>{L('Portfolio', 'Carteira')} {u.date_portfolio}</span><Field label={L('Period', 'Período')}><Btns opts={PER} value={per} onChange={setPer} /></Field>
        <Field label={L('Sort', 'Ordem')}><Btns opts={[{ v: 'weight', l: L('Weight', 'Peso') }, { v: 'contrib', l: L('Contrib.', 'Contrib.') }, { v: 'ret', l: L('Return', 'Retorno') }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('Members', 'Ações'), String(m.rows.length), C.white],
        ['Ibovespa · ' + dUS(m.dates[m.end]), <span key="i">{n(m.idx1, 0)} <span className="text-[12px]" style={{ color: cl(dIdx) }}>{sn(dIdx, 0)} {L('pts', 'pts')} · {pc(m.idx1 && m.idx0 ? (m.idx1 / m.idx0 - 1) * 100 : null)}</span></span>, C.amber],
        [L(`Σ contributions ${per}`, `Σ contribuições ${per}`), hasQ ? `${sn(m.sumC, 0)} pts` : '—', cl(m.sumC)],
        [L('Implied level (Σ q·P / reductor)', 'Nível implícito (Σ q·P / redutor)'), hasQ ? n(m.implied, 0) : '—', C.white],
        [L('Top-10 weight', 'Peso das 10 maiores'), pc(m.top10, 1, false), C.white],
        [L('Effective N (1/Σw²)', 'N efetivo (1/Σw²)'), n(m.effN, 1), C.cyan],
      ]} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L(`Members (${rows.length})${sec ? ' · ' + sec : ''}`, `Ações (${rows.length})${sec ? ' · ' + sec : ''}`)} right={sec ? <button className="text-[11px]" style={{ color: C.cyan }} onClick={() => setSec(null)}>{L('clear filter', 'limpar filtro')}</button> : undefined}>
          <Grid maxH={600} rows={rows} cols={[
            { k: 'cod', label: L('Ticker', 'Ação'), color: () => C.amber, fmt: (v: any) => <Link href={`/des/${v}.SA/`} style={{ color: C.amber }}>{v}</Link> },
            { k: 'name', label: L('Name', 'Nome') },
            { k: 'type', label: L('Class', 'Tipo'), color: () => C.muted },
            { k: 'sector', label: L('Sector', 'Setor'), color: () => C.muted },
            { k: 'weight', label: L('Weight %', 'Peso %'), align: 'r', fmt: (v: any) => n(v, 3), color: () => C.white },
            { k: 'qty', label: L('Theor. qty', 'Qtd. teórica'), align: 'r', fmt: (v: any) => bigE(v, 2) },
            { k: 'px', label: L('Price', 'Preço'), align: 'r', fmt: (v: any) => n(v, 2) },
            { k: 'ret', label: `${per} %`, align: 'r', fmt: (v: any) => pc(v), color: (v: any) => cl(v) },
            { k: 'contrib', label: L('Contrib. pts', 'Contrib. pts'), align: 'r', fmt: (v: any) => sn(v, 1), color: (v: any) => cl(v) },
          ]} />
        </Panel>
        <div className="min-w-0">
          <Panel title={L('Weight by sector (click to filter)', 'Peso por setor (clique para filtrar)')}>
            <div className="overflow-auto p-2 text-[11.5px]" style={{ fontFamily: MONO, maxHeight: 205 }}>{m.sectors.map(s => (
              <button key={s.sector} onClick={() => setSec(sec === s.sector ? null : s.sector)} className="flex w-full items-center gap-2 py-[2px] text-left" style={{ opacity: sec && sec !== s.sector ? 0.45 : 1 }}>
                <span className="w-[150px] shrink-0 truncate" style={{ color: C.amber }}>{s.sector}</span>
                <span className="flex-1"><span className="block h-[10px]" style={{ width: `${s.w / maxW * 100}%`, background: C.blue }} /></span>
                <span className="w-[52px] text-right">{n(s.w, 1)}%</span><span className="w-[60px] text-right" style={{ color: cl(s.c) }}>{hasQ ? sn(s.c, 0) : ''}</span>
              </button>))}</div>
          </Panel>
          <Panel title={L(`Biggest contributors · ${per} (index points)`, `Maiores contribuições · ${per} (pontos)`)} className="mt-2">
            <div className="p-2 text-[11.5px]" style={{ fontFamily: MONO }}>{hasQ ? movers.map(r => (
              <div key={r.cod} className="flex items-center gap-2 py-[1px]">
                <span className="w-[58px] shrink-0" style={{ color: C.amber }}>{r.cod}</span>
                <span className="relative h-[10px] flex-1"><span className="absolute top-0 h-[10px]" style={{ left: r.contrib >= 0 ? '50%' : `${50 - Math.abs(r.contrib) / maxC * 50}%`, width: `${Math.abs(r.contrib) / maxC * 50}%`, background: r.contrib >= 0 ? C.up : C.down }} /><span className="absolute left-1/2 top-[-2px] h-[14px] w-px" style={{ background: C.line }} /></span>
                <span className="w-[56px] text-right" style={{ color: cl(r.contrib) }}>{sn(r.contrib, 1)}</span>
              </div>)) : <div style={{ color: C.muted }}>{L('Theoretical quantities not in this data build yet.', 'Quantidades teóricas ainda não estão nesta geração de dados.')}</div>}</div>
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= OVME =======================
function ResList({ rows }: { rows: { k: string; v: string; c?: string }[] }) {
  return <div className="px-2 py-1 text-[12px]" style={{ fontFamily: MONO }}>{rows.map((r, i) => (
    <div key={i} className="flex items-baseline justify-between gap-3 border-b py-[3px]" style={{ borderColor: tc('#1a1a1a') }}>
      <span className="min-w-0" style={{ color: C.muted }}>{r.k}</span><span className="shrink-0 text-right tabular-nums" style={{ color: r.c || C.text }}>{r.v}</span>
    </div>))}</div>
}
// Black-Scholes-Merton e vol implícita: módulo puro testado em src/lib/bsm.test.mjs
export { bs, impliedVol }

function Num({ label, value, onChange, step = 0.01, w = 84 }: { label: string; value: number; onChange: (v: number) => void; step?: number; w?: number }) {
  return <label className="flex items-center justify-between gap-2 py-[2px] text-[12px]"><span style={{ color: C.muted }}>{label}</span>
    <input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={e => onChange(parseFloat(e.target.value))} className={inputCls} style={{ ...inputStyle, width: w, textAlign: 'right' }} /></label>
}

export function OVMEView({ ticker }: { ticker: string }) {
  const ok = hasData('OMON', ticker)
  const { data: d, err } = useJSON<any>(ok ? `options/${tickerKey(ticker)}.json` : null)
  const [ei, setEi] = useState<number | null>(null), [code, setCode] = useState<string | null>(null)
  const [ov, setOv] = useState<Record<string, number | boolean>>({})
  if (!ok) return <FnScreen code="OVME" ticker={ticker}><NA ticker={ticker} what={L('listed options (B3 COTAHIST)', 'opções listadas (COTAHIST B3)')} code="ovme" /></FnScreen>
  if (!d) return <FnScreen code="OVME" ticker={ticker}><Loading2 err={err} /></FnScreen>
  const exps = d.expiries as any[]
  const idx = ei ?? Math.max(0, exps.findIndex(e => e.bdays >= 15))
  const e = exps[idx]
  const series = [...e.calls.map((o: any) => ({ ...o, call: true })), ...e.puts.map((o: any) => ({ ...o, call: false }))].sort((a, b) => a.strike - b.strike || +b.call - +a.call)
  const atm = series.filter(o => o.call).reduce((b: any, o: any) => !b || Math.abs(o.strike - d.spot) < Math.abs(b.strike - d.spot) ? o : b, null) || series[0]
  const opt = series.find(o => o.code === code) || atm
  // valores do mercado (fechamento) com sobreposições do usuário
  const base = { call: opt.call, S: d.spot, K: opt.strike, days: e.bdays, r: +(d.r_cont * 100).toFixed(3), q: 0, vol: opt.iv ?? 30, prem: opt.last }
  const v: any = { ...base, ...ov }
  const T = v.days / 252, r = v.r / 100, q = v.q / 100
  const g = bs(v.call, v.S, v.K, T, r, q, v.vol / 100), other = bs(!v.call, v.S, v.K, T, r, q, v.vol / 100)
  const iv = impliedVol(v.call, v.prem, v.S, v.K, T, r, q)
  const set = (k: string) => (x: number | boolean) => setOv(o => ({ ...o, [k]: x }))
  const pick = (c: string) => { setCode(c); setOv({}) }
  // valor teórico hoje e no vencimento em função do preço do ativo
  const xs = Array.from({ length: 61 }, (_, i) => v.K * (0.7 + i * 0.01))
  const today: [number, number | null][] = xs.map(s => [s, bs(v.call, s, v.K, T, r, q, v.vol / 100)?.price ?? null])
  const expiry: [number, number | null][] = xs.map(s => [s, v.call ? Math.max(0, s - v.K) : Math.max(0, v.K - s)])
  const pnl: [number, number | null][] = xs.map(s => [s, (v.call ? Math.max(0, s - v.K) : Math.max(0, v.K - s)) - (v.prem || 0)])
  const smile = (call: boolean) => (call ? e.calls : e.puts).filter((o: any) => o.iv != null && o.trades > 0).map((o: any) => [o.strike, o.iv] as [number, number]).sort((a: any, b: any) => a[0] - b[0])
  const parity = g && other ? (v.call ? g.price - other.price : other.price - g.price) : null
  const fwdGap = v.S * Math.exp(-q * T) - v.K * Math.exp(-r * T)
  const note = L('Black-Scholes-Merton for European options: B3 stock options are mostly American (calls on non-dividend days behave like European ones; puts can be exercised early, so the model can underprice them). Market inputs are the end-of-day COTAHIST snapshot used by OMON; edit any field to run scenarios. Theta is per business day (÷252); vega and rho per 1 percentage point.',
    'Black-Scholes-Merton para opções europeias: as opções de ações da B3 são em geral americanas (calls sem proventos no período equivalem às europeias; puts podem ser exercidas antes, e o modelo pode subprecificá-las). Os dados de mercado são o fechamento do COTAHIST usado no OMON; edite qualquer campo para simular cenários. Theta por dia útil (÷252); vega e rho por 1 ponto percentual.')
  return (
    <FnScreen code="OVME" ticker={ticker} title={L('Option Valuation (Black-Scholes)', 'Calculadora de opções (Black-Scholes)')} source={<>B3 COTAHIST ({dUS(d.date)}) · {L('model computed in your browser', 'modelo calculado no navegador')}</>} note={note}
      right={<><span>Spot <b style={{ color: C.amber }}>{n(d.spot)}</b></span><span style={{ color: C.muted }}>r {n(d.r_cont * 100, 2)}%</span></>}>
      <div className="flex flex-wrap items-center gap-2 pb-2 text-[11px]">
        <Field label={L('Expiry', 'Vencimento')}><select value={idx} onChange={x => { setEi(+x.target.value); setCode(null); setOv({}) }} className={inputCls} style={inputStyle}>{exps.map((x, i) => <option key={x.date} value={i}>{dUS(x.date)} ({x.bdays} {L('bd', 'du')}) · {x.calls.length + x.puts.length}</option>)}</select></Field>
        <Field label={L('Series', 'Série')}><select value={opt.code} onChange={x => pick(x.target.value)} className={inputCls} style={inputStyle}>{series.map(o => <option key={o.code} value={o.code}>{o.code} · {o.call ? 'C' : 'P'} {n(o.strike)} · {L('last', 'últ.')} {n(o.last)}</option>)}</select></Field>
        <button onClick={() => setOv({})} className="border px-2 py-[1px]" style={{ borderColor: C.line, color: C.cyan }}>{L('Reset to market', 'Voltar ao mercado')}</button>
      </div>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.6fr)' }}>
        <div className="min-w-0">
          <Panel title={L('Inputs', 'Parâmetros')}>
            <div className="px-2 py-1">
              <div className="flex items-center justify-between py-[2px] text-[12px]"><span style={{ color: C.muted }}>{L('Type', 'Tipo')}</span><Btns opts={[{ v: true, l: 'Call' }, { v: false, l: 'Put' }]} value={v.call} onChange={set('call')} /></div>
              <Num label={L('Underlying price S', 'Preço do ativo S')} value={v.S} onChange={set('S')} />
              <Num label={L('Strike K', 'Strike K')} value={v.K} onChange={set('K')} />
              <Num label={L('Business days to expiry', 'Dias úteis até o vencimento')} value={v.days} onChange={set('days')} step={1} />
              <Num label={L('Rate r (% p.a., continuous)', 'Juro r (% a.a., contínuo)')} value={v.r} onChange={set('r')} />
              <Num label={L('Dividend yield q (% p.a.)', 'Dividend yield q (% a.a.)')} value={v.q} onChange={set('q')} />
              <Num label={L('Volatility σ (% p.a.)', 'Volatilidade σ (% a.a.)')} value={v.vol} onChange={set('vol')} step={0.5} />
              <Num label={L('Premium (for implied vol)', 'Prêmio (para vol implícita)')} value={v.prem} onChange={set('prem')} />
            </div>
          </Panel>
          <Panel title={L('Results', 'Resultados')} className="mt-2">
            <ResList rows={[
              { k: L('Theoretical price', 'Preço teórico'), v: n(g?.price, 4), c: C.amber },
              { k: L('Market premium', 'Prêmio de mercado'), v: n(v.prem, 2) + (g && v.prem ? `  (${sn(v.prem - g.price, 3)})` : ''), c: C.white },
              { k: L('Implied vol from premium', 'Vol implícita do prêmio'), v: iv != null ? pc(iv * 100, 2, false) : '—', c: C.cyan },
              { k: 'Delta Δ', v: n(g?.delta, 4) }, { k: 'Gamma Γ', v: n(g?.gamma, 5) }, { k: L('Vega (per 1 pp σ)', 'Vega (por 1 p.p. σ)'), v: n(g?.vega, 4) },
              { k: L('Theta Θ (per bus. day)', 'Theta Θ (por dia útil)'), v: n(g?.theta, 4) }, { k: L('Rho ρ (per 1 pp r)', 'Rho ρ (por 1 p.p. r)'), v: n(g?.rho, 4) },
              { k: `d₁ / d₂`, v: `${n(g?.d1, 3)} / ${n(g?.d2, 3)}` },
              { k: L(`${v.call ? 'Put' : 'Call'} same strike`, `${v.call ? 'Put' : 'Call'} mesmo strike`), v: n(other?.price, 4) },
              { k: L('Parity: C − P vs S·e⁻ᵠᵀ − K·e⁻ʳᵀ', 'Paridade: C − P vs S·e⁻ᵠᵀ − K·e⁻ʳᵀ'), v: `${n(parity, 4)} / ${n(fwdGap, 4)}`, c: C.muted },
            ]} />
          </Panel>
        </div>
        <div className="min-w-0">
          <Panel title={L(`Value vs underlying · ${v.call ? 'call' : 'put'} K ${n(v.K)}`, `Valor vs ativo · ${v.call ? 'call' : 'put'} K ${n(v.K)}`)}>
            <XYChart height={270} xFmt={x => n(x, 2)} yFmt={y => n(y, 2)} zeroLine xLabel={L('underlying price', 'preço do ativo')} series={[
              { name: L(`Today (${v.days} bd, σ ${n(v.vol, 1)}%)`, `Hoje (${v.days} du, σ ${n(v.vol, 1)}%)`), points: today, color: C.amber, width: 2 },
              { name: L('At expiry (payoff)', 'No vencimento (payoff)'), points: expiry, color: C.white, dash: '5 4' },
              { name: L('P&L at expiry (bought at premium)', 'Resultado no vencimento (compra pelo prêmio)'), points: pnl, color: C.cyan, opacity: 0.8 },
            ]} />
          </Panel>
          <Panel title={L(`Volatility smile · ${dUS(e.date)} (traded series, IV % p.a.)`, `Smile de volatilidade · ${dUS(e.date)} (séries negociadas, VI % a.a.)`)} className="mt-2">
            <XYChart height={230} xFmt={x => n(x, 2)} yFmt={y => n(y, 0)} xLabel="strike" series={[
              { name: 'Calls', points: smile(true), color: C.up, scatter: true },
              { name: 'Puts', points: smile(false), color: C.down, scatter: true },
              { name: 'Spot', points: [[d.spot, Math.min(...[...smile(true), ...smile(false)].map(p => p[1]), 100)], [d.spot, Math.max(...[...smile(true), ...smile(false)].map(p => p[1]), 0)]], color: C.muted, dash: '2 3' },
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= EVTS =======================
type Ev = { date: string; kind: 'D' | 'S' | 'F' | 'R' | 'N'; text: string; link?: string; value?: number }
const KIND: Record<Ev['kind'], { en: string; pt: string; color: string; shape: 'arrowDown' | 'arrowUp' | 'circle' | 'square'; pos: 'aboveBar' | 'belowBar' }> = {
  R: { en: 'Results', pt: 'Resultados', color: tc('#2f7bff'), shape: 'square', pos: 'aboveBar' },
  F: { en: 'Material facts / 8-K', pt: 'Fatos relevantes / 8-K', color: tc('#FFA028'), shape: 'arrowDown', pos: 'aboveBar' },
  D: { en: 'Dividends', pt: 'Proventos', color: tc('#3ddc84'), shape: 'circle', pos: 'belowBar' },
  S: { en: 'Splits', pt: 'Desdobramentos', color: tc('#c77dff'), shape: 'arrowUp', pos: 'belowBar' },
  N: { en: 'Next results (CAL)', pt: 'Próximo resultado (CAL)', color: tc('#ffffff'), shape: 'square', pos: 'aboveBar' },
}
/** eventos a partir do corp/<t>.json (IPE da CVM ou EDGAR) e do calendar.json */
export function buildEvents(d: any, cal: any, ticker: string): Ev[] {
  const us = d?.country === 'US', out: Ev[] = []
  for (const [t, a] of (d?.dividends_full || []) as [string, number][]) out.push({ date: t, kind: 'D', text: `${us ? 'US$' : 'R$'} ${a.toFixed(4)}`, value: a })
  for (const [t, a] of (d?.splits_full || []) as [string, number][]) out.push({ date: t, kind: 'S', text: a >= 1 ? `${a}:1` : `1:${+(1 / a).toFixed(2)}`, value: a })
  const seen = new Set<string>()
  for (const f of (d?.filings || []) as any[]) {
    const res = us ? /^10-[KQ]/.test(f.cat) || /Results of Operations/i.test(f.subject || '') : f.cat === 'Dados Econômico-Financeiros' && /press/i.test(f.type || '')
    const mat = us ? /^8-K/.test(f.cat) : f.cat === 'Fato Relevante'
    if (!res && !mat) continue
    const kind = res ? 'R' : 'F', k = kind + f.date
    if (kind === 'R' && seen.has(k)) continue
    seen.add(k)
    out.push({ date: f.date, kind, text: (f.subject || f.type || f.cat || '').trim(), link: f.link })
  }
  const row = (cal?.rows || []).find((r: any) => r.ticker === short(ticker).toUpperCase())
  if (row?.date) out.push({ date: row.date, kind: 'N', text: `${row.q || ''} · ${row.status || ''}${row.call?.date ? ` · call ${row.call.date}` : ''}`.trim(), link: row.link || row.ri_page })
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function EVTSView({ ticker }: { ticker: string }) {
  const ok = hasData('EVTS', ticker)
  const { data: d, err } = useJSON<any>(ok ? corpPath(ticker) : null)
  const { data: cal } = useJSON<any>('calendar.json')
  const { rows: px } = usePrices(ticker)
  const [on, setOn] = useState<Record<string, boolean>>({ R: true, F: true, D: true, S: true, N: true })
  const [rng, setRng] = useState('2Y')
  const evs = useMemo(() => (d ? buildEvents(d, cal, ticker) : []), [d, cal, ticker])
  if (!ok) return <FnScreen code="EVTS" ticker={ticker}><NA ticker={ticker} what={L('corporate events (CVM/SEC)', 'eventos corporativos (CVM/SEC)')} code="evts" /></FnScreen>
  if (!d || !px) return <FnScreen code="EVTS" ticker={ticker}><Loading2 err={err} /></FnScreen>
  const last = px[px.length - 1]?.time || ''
  const from = rng === '1Y' ? isoAgo(last, 366) : rng === '2Y' ? isoAgo(last, 731) : rng === '5Y' ? isoAgo(last, 1827) : ''
  const shown = evs.filter(e => on[e.kind] && e.date >= from)
  const pxs = px.filter(p => p.time >= from)
  // marcador no pregão do evento (ou no seguinte, se caiu em dia sem negócio)
  const times = pxs.map(p => p.time)
  const snap = (t: string) => { let lo = 0, hi = times.length; while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] < t) lo = m + 1; else hi = m } return times[lo] }
  const markers = shown.filter(e => e.kind !== 'N').map(e => ({ e, t: snap(e.date) })).filter(x => x.t).map(({ e, t }) => ({ time: t!, text: e.kind, color: KIND[e.kind].color, shape: KIND[e.kind].shape, position: KIND[e.kind].pos }))
  const counts = (k: string) => evs.filter(e => e.kind === k && e.date >= from).length
  const next = evs.find(e => e.kind === 'N')
  const react = (e: Ev) => { const i = times.indexOf(snap(e.date) || ''); return i > 0 && i < times.length ? (pxs[i].close / pxs[i - 1].close - 1) * 100 : null }
  const note = L('Markers sit on the first trading day on or after each event. R = results release (CVM IPE press release / SEC 10-Q, 10-K or 8-K item 2.02), F = material fact (CVM) or other 8-K (SEC), D = dividend ex-date, S = split. The "day %" column is the close-to-close move on that trading day (adjusted prices), useful to see how the market reacted.',
    'Os marcadores ficam no primeiro pregão na data do evento ou depois. R = divulgação de resultados (press release no IPE da CVM / 10-Q, 10-K ou 8-K item 2.02 na SEC), F = fato relevante (CVM) ou outro 8-K (SEC), D = data ex de proventos, S = desdobramento. A coluna "dia %" é a variação de fechamento a fechamento naquele pregão (preços ajustados), útil para ver a reação do mercado.')
  return (
    <FnScreen code="EVTS" ticker={ticker} title={L('Events on Chart', 'Eventos no gráfico')} note={note}
      source={d.country === 'US' ? 'SEC EDGAR (submissions) · Yahoo Finance (distributions, adjusted prices)' : 'CVM open data (IPE) · company IR calendar (CAL) · Yahoo Finance (distributions, adjusted prices)'}
      right={<><Field label={L('Range', 'Período')}><Btns opts={['1Y', '2Y', '5Y', 'MAX']} value={rng} onChange={setRng} /></Field></>}>
      <div className="flex flex-wrap gap-1 pb-2 text-[11px]">{(Object.keys(KIND) as Ev['kind'][]).filter(k => k !== 'N' || next).map(k => (
        <button key={k} onClick={() => setOn(o => ({ ...o, [k]: !o[k] }))} className="border px-2 py-[1px]" style={{ borderColor: KIND[k].color, color: on[k] ? tc('#000') : KIND[k].color, background: on[k] ? KIND[k].color : 'transparent' }}>
          {k} · {L(KIND[k].en, KIND[k].pt)}{k !== 'N' ? ` (${counts(k)})` : ''}</button>))}
        {next && <span className="px-2" style={{ color: C.muted }}>{L('Next results', 'Próximo resultado')}: <b style={{ color: C.white }}>{dUS(next.date)}</b> {next.text}</span>}
      </div>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <Panel title={L(`${short(ticker)} · adjusted close with events`, `${short(ticker)} · fechamento ajustado com eventos`)}>
          <FnChart height={560} panes={[{ series: [{ kind: 'line', data: pxs.map(p => ({ time: p.time, value: p.close })), color: C.white, title: short(ticker), markers }] }, { stretch: 0.25, series: [{ kind: 'hist', data: pxs.map(p => ({ time: p.time, value: p.volume })), color: tc('#3a3a3a'), title: 'Vol', decimals: 0 }] }]} />
        </Panel>
        <Panel title={L(`Events (${shown.length})`, `Eventos (${shown.length})`)}>
          <Grid maxH={590} rows={shown.map(e => ({ ...e, r: e.kind === 'N' ? null : react(e) }))} cols={[
            { k: 'date', label: L('Date', 'Data'), fmt: (v: any) => dUS(v) },
            { k: 'kind', label: '', fmt: (v: any) => <b style={{ color: KIND[v as Ev['kind']].color }}>{v}</b> },
            { k: 'text', label: L('Event', 'Evento'), fmt: (v: any, r: any) => r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{v || '—'}</a> : v },
            { k: 'r', label: L('Day %', 'Dia %'), align: 'r', fmt: (v: any) => pc(v, 1), color: (v: any) => cl(v) },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}
