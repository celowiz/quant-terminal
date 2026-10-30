'use client'
import React, { useMemo, useState } from 'react'
import { FitBox, FnScreen, Panel, Grid, Btns, Field, KV, Loading, NA, C, nf, pf, big, dBR, dBRfull, clr, short, useJSON, corpPath, isEquity, inputCls, inputStyle, isoMinus } from '../../components/fn/kit'
import FnChart, { type PaneDef } from '../../components/fn/FnChart'
import { usePrices } from './tech'
import { tickerKey } from '../../lib/static'

const SRC_CVM = 'CVM Open Data (DFP/ITR, FCA, IPE) + Yahoo Finance (profile, raw price, distributions). Scripts: tools/pipeline/build_corp.py.'
const useCorp = (t: string) => useJSON<any>(corpPath(t))
const Guard = ({ code, ticker, children }: { code: string; ticker: string; children: React.ReactNode }) =>
  isEquity(ticker) ? <>{children}</> : <FnScreen code={code} ticker={ticker}><NA ticker={ticker} what="corporate data (CVM)" code={code.toLowerCase()} /></FnScreen>

/** valor de mercado e múltiplos a partir do preço bruto e ações CVM */
function valuation(d: any) {
  const q = d.fundamentals.quarterly as any[], a = d.fundamentals.annual as any[]
  const last4 = q.slice(-4)
  const ltm = (k: string) => last4.length === 4 && last4.every(r => r[k] != null) ? last4.reduce((s, r) => s + r[k], 0) : null
  const px = d.raw_close[d.raw_close.length - 1]
  const shares = d.shares?.total ? d.shares.total - (d.shares.treasury || 0) : null
  const mcap = shares ? px[1] * shares : null
  const bs = q[q.length - 1] || a[a.length - 1]
  const netLtm = ltm('net'), ebitdaLtm = ltm('ebitda'), revLtm = ltm('revenue')
  const divs12 = (d.dividends_full as [string, number][]).filter(x => x[0] > isoMinus(px[0], 0, 0, 1)).reduce((s, x) => s + x[1], 0)
  const ev = mcap != null && bs?.netdebt != null ? mcap + bs.netdebt + (bs.minority || 0) : null
  return { px, shares, mcap, bs, netLtm, ebitdaLtm, revLtm, ev, divs12,
    pe: mcap && netLtm ? mcap / netLtm : null, pb: mcap && bs?.equity ? mcap / bs.equity : null,
    evEbitda: ev && ebitdaLtm ? ev / ebitdaLtm : null, dy: divs12 ? (divs12 / px[1]) * 100 : null,
    roe: netLtm && bs?.equity ? (netLtm / bs.equity) * 100 : null, margin: netLtm && revLtm ? (netLtm / revLtm) * 100 : null,
    ndEbitda: bs?.netdebt != null && ebitdaLtm ? bs.netdebt / ebitdaLtm : null }
}

// ---------------- DES ----------------
export function DESView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const { rows } = usePrices(ticker)
  const [tab, setTab] = useState(0)
  const v = useMemo(() => d ? valuation(d) : null, [d])
  return <Guard code="DES" ticker={ticker}>{!d || !v ? <FnScreen code="DES" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const p = d.profile || {}, cad = d.cad || {}
    const r1 = rows ? rows.filter(r => r.time >= isoMinus(rows[rows.length - 1].time, 0, 0, 1)) : []
    const hi = r1.length ? Math.max(...r1.map(r => r.high)) : null, lo = r1.length ? Math.min(...r1.map(r => r.low)) : null
    const ret1 = r1.length ? (r1[r1.length - 1].close / r1[0].close - 1) * 100 : null
    const ann = d.fundamentals.annual.slice(-5)
    return (
      <FnScreen code="DES" ticker={ticker} title={`Description — ${p.longName || cad.DENOM_SOCIAL}`} tabs={['Profile', 'Revenue & Earnings', 'CVM registry']} tab={tab} setTab={setTab}
        source={SRC_CVM} note="Market cap = raw closing price × shares outstanding (CVM capital breakdown, all classes). Multiples use trailing 4-quarter earnings/EBITDA.">
        {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <Panel title="Company description">
            <div className="p-2 text-[12px] leading-snug" style={{ color: C.text, maxHeight: 210, overflow: 'auto', borderBottom: `1px solid ${C.line}` }}>{p.longBusinessSummary}</div>
            <KV rows={[['Sector (Yahoo)', `${p.sector || '—'} / ${p.industry || '—'}`], ['CVM sector', cad.SETOR_ATIV || '—'], ['Employees', p.fullTimeEmployees ? nf(p.fullTimeEmployees, 0) : '—'], ['Headquarters', `${p.city || cad.MUN || '—'}, ${p.country || ''}`], ['Site', p.website || '—'], ['CNPJ', d.cnpj], ['Shareholder control', cad.CONTROLE_ACIONARIO || '—']]} />
          </Panel>
          <Panel title="Price — 1 year">
            {r1.length > 0 && <FnChart height={190} panes={[{ series: [{ kind: 'area', data: r1.map(r => ({ time: r.time, value: r.close })), color: C.white, title: short(ticker) }] }]} />}
            <KV rows={[['Last (raw)', `R$ ${nf(v.px[1])}`, C.amber], ['Date', dBR(v.px[0])], ['1Y return (adj.)', pf(ret1), clr(ret1)], ['52w High', nf(hi)], ['52w Low', nf(lo)]]} />
          </Panel>
          <Panel title="Key data">
            <KV rows={[['Market cap', `R$ ${big(v.mcap)}`, C.amber], ['Shares (ON+PN)', big(v.shares, 2)], ['EV', `R$ ${big(v.ev)}`], ['P/E (LTM)', nf(v.pe)], ['P/B', nf(v.pb)], ['EV/EBITDA (LTM)', nf(v.evEbitda)], ['Div. yield 12m', pf(v.dy, 2, false)], ['ROE (LTM)', pf(v.roe, 1, false)], ['Net margin', pf(v.margin, 1, false)], ['Net debt/EBITDA', nf(v.ndEbitda)], ['Revenue LTM', `R$ ${big(v.revLtm)}`], ['Earnings LTM', `R$ ${big(v.netLtm)}`]]} />
          </Panel>
        </div>}
        {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title="Annual revenue (R$ bn)"><FnChart height={300} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.annual.filter((r: any) => r.revenue).map((r: any) => ({ time: r.period, value: r.revenue / 1e9 })), color: C.amber, title: 'Revenue', decimals: 1 }] }]} /></Panel>
          <Panel title="Quarterly net income (R$ bn)"><FnChart height={300} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.quarterly.filter((r: any) => r.net != null).map((r: any) => ({ time: r.period, value: r.net / 1e9, color: r.net >= 0 ? C.up : C.down })), title: 'Earnings', decimals: 1 }] }]} /></Panel>
          <div className="col-span-2"><Panel title="Annual summary">
            <Grid cols={[{ k: 'period', label: 'Fiscal year', fmt: v => v.slice(0, 4) }, { k: 'revenue', label: 'Revenue', align: 'r', fmt: v => big(v) }, { k: 'ebitda', label: 'EBITDA', align: 'r', fmt: v => big(v) }, { k: 'net', label: 'Net income', align: 'r', fmt: v => big(v), color: clr }, { k: 'mg', label: 'Margin', align: 'r', fmt: v => pf(v, 1, false) }]} rows={ann.map((r: any) => ({ ...r, mg: r.net && r.revenue ? (r.net / r.revenue) * 100 : null }))} />
          </Panel></div>
        </div>}
        {tab === 2 && <Panel title="Registry (CVM cad_cia_aberta)"><KV cols={2} rows={Object.entries(cad).filter(([, x]) => x != null && x !== '').map(([k, x]) => [k, String(x)] as [string, string])} /></Panel>}
      </FnScreen>)
  })()}</Guard>
}

// ---------------- FUND ----------------
const FROWS: [string, string, boolean?][] = [['revenue', 'Net revenue'], ['gross', 'Gross profit'], ['ebit', 'EBIT'], ['da', 'D&A'], ['ebitda', 'EBITDA'], ['fin', 'Financial result'], ['pretax', 'Pre-tax income'], ['net', 'Net income', true]]
const BROWS: [string, string, boolean?][] = [['assets', 'Total assets'], ['cash', 'Cash and equivalents'], ['stinv', 'Financial investments'], ['debt', 'Gross debt'], ['netdebt', 'Net debt', true], ['minority', 'Non-controlling interests'], ['equity', 'Shareholders\' equity', true]]
const CROWS: [string, string, boolean?][] = [['cfo', 'Operating cash flow'], ['capex', 'Capex (PP&E + intangibles)'], ['fcf', 'Free cash flow', true]]
export function FUNDView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const [tab, setTab] = useState(0)
  const [per, setPer] = useState<'a' | 'q'>('a')
  return <Guard code="FUND" ticker={ticker}>{!d ? <FnScreen code="FUND" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const src = (per === 'a' ? d.fundamentals.annual : d.fundamentals.quarterly.slice(-10)).map((r: any) => ({ ...r, fcf: r.cfo != null && r.capex != null ? r.cfo + r.capex : null, mg: r.net && r.revenue ? r.net / r.revenue * 100 : null, mge: r.ebitda && r.revenue ? r.ebitda / r.revenue * 100 : null, roe: r.net && r.equity ? r.net / r.equity * 100 * (per === 'q' ? 4 : 1) : null, lev: r.netdebt != null && r.equity ? r.netdebt / r.equity : null }))
    const IROWS: [string, string, boolean?][] = [['mge', 'EBITDA margin %'], ['mg', 'Net margin %'], ['roe', `ROE % ${per === 'q' ? '(annualized)' : ''}`], ['lev', 'Net debt / Equity']]
    const rowsDef = [FROWS, BROWS, CROWS, IROWS][tab]
    const lbl = (p: string) => per === 'a' ? p.slice(0, 4) : `Q${Math.ceil(+p.slice(5, 7) / 3)}'${p.slice(2, 4)}`
    const isRatio = tab === 3
    return (
      <FnScreen code="FUND" ticker={ticker} title="Fundamentals — financial statements" tabs={['Income Statement', 'Balance Sheet', 'Cash Flow', 'Ratios']} tab={tab} setTab={setTab}
        right={<Btns opts={[{ v: 'a', l: 'Yearly' }, { v: 'q', l: 'Quarterly' }] as any} value={per} onChange={setPer as any} />}
        source={SRC_CVM} note={<>{d.fundamentals.note} Values in R$ millions. Amber figures = reported (no consensus estimates in this version).{d.fundamentals.bank_format ? ' Bank: financial-institution layout — EBIT/EBITDA/debt do not apply.' : ''}</>}>
        <div className="overflow-auto border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr style={{ background: C.panel2 }}><th className="px-2 py-1 text-left font-normal" style={{ color: C.amber }}>R$ mi</th>{src.map((r: any) => <th key={r.period} className="px-2 py-1 text-right font-normal" style={{ color: C.amber }}>{lbl(r.period)}</th>)}</tr></thead>
            <tbody>{rowsDef.map(([k, l, bold]) => (
              <tr key={k} className="border-t" style={{ borderColor: '#1a1a1a' }}><td className="px-2 py-[3px]" style={{ fontWeight: bold ? 700 : 400 }}>{l}</td>
                {src.map((r: any) => <td key={r.period} className="px-2 py-[3px] text-right" style={{ color: r[k] == null ? C.muted : r[k] < 0 ? C.down : C.amber, fontWeight: bold ? 700 : 400 }}>{r[k] == null ? '—' : isRatio ? nf(r[k], k === 'lev' ? 2 : 1) : nf(r[k] / 1e6, 0)}</td>)}</tr>))}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <FnChart height={260} panes={[{ series: rowsDef.slice(0, 3).map(([k, l], i) => ({ kind: i === 0 ? 'hist' as const : 'line' as const, data: src.filter((r: any) => r[k] != null).map((r: any) => ({ time: r.period, value: isRatio ? r[k] : r[k] / 1e9 })), color: [C.amber, C.white, C.blue][i], title: l, decimals: isRatio ? 2 : 1 })) }]} />
        </div>
      </FnScreen>)
  })()}</Guard>
}

// ---------------- VAL ----------------
export function VALView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const peers = ['PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'B3SA3.SA']
  const p0 = useJSON<any>('corp/PETR4.json'), p1 = useJSON<any>('corp/VALE3.json'), p2 = useJSON<any>('corp/ITUB4.json'), p3 = useJSON<any>('corp/B3SA3.json')
  const [metric, setMetric] = useState<'pe' | 'pb' | 'dy'>('pe')
  return <Guard code="VAL" ticker={ticker}>{!d ? <FnScreen code="VAL" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const v = valuation(d)
    // histórico: P/L e P/VPA com fundamentos vigentes em cada data (trimestre publicado ~45d depois)
    const q = d.fundamentals.quarterly as any[]
    const shares = v.shares || 0
    const hist = (d.raw_close as [string, number][]).filter(x => x[0] >= isoMinus(v.px[0], 0, 0, 3)).map(([t, px]) => {
      const avail = q.filter(r => isoMinus(r.period, -45) <= t)
      const l4 = avail.slice(-4), bs = avail[avail.length - 1]
      const net = l4.length === 4 && l4.every(r => r.net != null) ? l4.reduce((s, r) => s + r.net, 0) : null
      const dv = (d.dividends_full as [string, number][]).filter(x => x[0] <= t && x[0] > isoMinus(t, 0, 0, 1)).reduce((s, x) => s + x[1], 0)
      const mc = px * shares
      return { time: t, pe: net && net > 0 ? mc / net : null, pb: bs?.equity ? mc / bs.equity : null, dy: dv ? dv / px * 100 : null }
    })
    const ser = hist.filter(h => h[metric] != null).map(h => ({ time: h.time, value: h[metric] as number }))
    const avg = ser.reduce((s, x) => s + x.value, 0) / (ser.length || 1)
    const ys = d.yahoo_stats || {}
    const peerRows = [p0, p1, p2, p3].map((x, i) => x.data ? { t: short(peers[i]), ...valuation(x.data), cur: peers[i] === ticker } : null).filter(Boolean) as any[]
    return (
      <FnScreen code="VAL" ticker={ticker} title="Valuation — multiples and history" source={SRC_CVM}
        note="Multiples computed in the pipeline from raw price × CVM share count and trailing 4-quarter results (DFP/ITR). History assumes results are released 45 days after quarter end. Yahoo column shown for cross-checking; differences come from share-count/LTM criteria.">
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '300px 1fr' }}>
          <Panel title="Current multiples">
            <Grid cols={[{ k: 'l', label: 'Indicator' }, { k: 'v', label: 'Computed', align: 'r', color: () => C.amber }, { k: 'y', label: 'Yahoo', align: 'r', color: () => C.muted }]} rows={[
              { l: 'Price (raw)', v: nf(v.px[1]), y: '—' }, { l: 'Market cap', v: big(v.mcap), y: big(ys.marketCap) }, { l: 'EV', v: big(v.ev), y: '—' },
              { l: 'P/E LTM', v: nf(v.pe), y: nf(ys.trailingPE) }, { l: 'P/B', v: nf(v.pb), y: nf(ys.priceToBook) }, { l: 'EV/EBITDA', v: nf(v.evEbitda), y: nf(ys.enterpriseToEbitda) },
              { l: 'Div. yield 12m', v: pf(v.dy, 2, false), y: pf(ys.dividendYield, 2, false) }, { l: 'ROE', v: pf(v.roe, 1, false), y: '—' }, { l: 'Net debt/EBITDA', v: nf(v.ndEbitda), y: '—' },
            ]} />
          </Panel>
          <div>
            <div className="flex items-center gap-2 pb-1 text-[12px]"><span style={{ color: C.amber }}>3-year history</span><Btns opts={[{ v: 'pe', l: 'P/E' }, { v: 'pb', l: 'P/B' }, { v: 'dy', l: 'DY %' }] as any} value={metric} onChange={setMetric as any} /><span style={{ color: C.muted }}>average {nf(avg)}</span></div>
            <FnChart height={330} panes={[{ series: [{ kind: 'line', data: ser, color: C.amber, title: metric.toUpperCase(), lines: [{ price: avg, color: '#888', title: 'Average' }] }] }]} />
          </div>
        </div>
        <div className="mt-2"><Panel title="Peer comparison (same methodology)">
          <Grid cols={[{ k: 't', label: 'Ticker', color: (_, r: any) => r.cur ? C.amber : C.text }, { k: 'mcap', label: 'Mkt cap', align: 'r', fmt: (v: any) => big(v) }, { k: 'pe', label: 'P/E', align: 'r', fmt: (v: any) => nf(v) }, { k: 'pb', label: 'P/B', align: 'r', fmt: (v: any) => nf(v) }, { k: 'evEbitda', label: 'EV/EBITDA', align: 'r', fmt: (v: any) => nf(v) }, { k: 'dy', label: 'DY %', align: 'r', fmt: v => nf(v) }, { k: 'roe', label: 'ROE %', align: 'r', fmt: v => nf(v, 1) }, { k: 'margin', label: 'Net mg. %', align: 'r', fmt: v => nf(v, 1) }]} rows={peerRows} />
        </Panel></div>
      </FnScreen>)
  })()}</Guard>
}

// ---------------- DY / DVD / SPLIT ----------------
export function DYView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  return <Guard code="DY" ticker={ticker}>{!d ? <FnScreen code="DY" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const divs = d.dividends_full as [string, number][], px = d.raw_close as [string, number][]
    const from = isoMinus(px[px.length - 1][0], 0, 0, 10)
    const ser = px.filter((_, i) => i % 3 === 0 || i === px.length - 1).filter(x => x[0] >= from).map(([t, p]) => ({ time: t, value: divs.filter(x => x[0] <= t && x[0] > isoMinus(t, 0, 0, 1)).reduce((s, x) => s + x[1], 0) / p * 100 }))
    const years = Array.from(new Set(divs.map(x => x[0].slice(0, 4)))).sort().reverse().slice(0, 12)
    const yr = years.map(y => { const pe = px.filter(x => x[0].startsWith(y)); const tot = divs.filter(x => x[0].startsWith(y)).reduce((s, x) => s + x[1], 0); const end = pe[pe.length - 1]?.[1], avg = pe.reduce((s, x) => s + x[1], 0) / (pe.length || 1); return { y, tot, n: divs.filter(x => x[0].startsWith(y)).length, end, dyEnd: end ? tot / end * 100 : null, dyAvg: avg ? tot / avg * 100 : null } })
    const cur = ser[ser.length - 1]?.value, avg = ser.reduce((s, x) => s + x.value, 0) / (ser.length || 1)
    return (
      <FnScreen code="DY" ticker={ticker} title="Dividend Yield" source={SRC_CVM} note="12m DY = sum of distributions (gross dividends + JCP, by ex-date) over the previous 12 months ÷ that day's raw price. Distributions and price unadjusted.">
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 380px' }}>
          <div><div className="flex gap-4 text-[12px] pb-1"><span>Current 12m DY <b style={{ color: C.amber }}>{pf(cur, 2, false)}</b></span><span style={{ color: C.muted }}>10y average {pf(avg, 2, false)}</span></div>
            <FnChart height={520} panes={[{ series: [{ kind: 'area', data: ser, color: C.amber, title: 'DY 12m', pct: true, lines: [{ price: avg, color: '#888', title: 'Average' }] }] }]} /></div>
          <Panel title="By year"><Grid cols={[{ k: 'y', label: 'Year' }, { k: 'n', label: 'Nº', align: 'r' }, { k: 'tot', label: 'R$/share', align: 'r', fmt: v => nf(v, 4) }, { k: 'end', label: 'End price', align: 'r', fmt: (v: any) => nf(v) }, { k: 'dyEnd', label: 'End DY', align: 'r', fmt: v => pf(v, 2, false), color: () => C.amber }, { k: 'dyAvg', label: 'Avg DY', align: 'r', fmt: v => pf(v, 2, false) }]} rows={yr} /></Panel>
        </div>
      </FnScreen>)
  })()}</Guard>
}

export function DVDView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const [tab, setTab] = useState(0)
  return <Guard code="DVD" ticker={ticker}>{!d ? <FnScreen code="DVD" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const divs = (d.dividends_full as [string, number][]).slice().reverse()
    const px = new Map((d.raw_close as [string, number][]))
    const prev = (t: string) => { let v: number | undefined; for (const [k, p] of d.raw_close as [string, number][]) { if (k < t) v = p; else break } return v }
    const rows = divs.map(([t, a]) => { const p = prev(t); return { ex: t, amt: a, px: p, y: p ? a / p * 100 : null, freq: 'Irregular', type: 'Dividend/JCP' } })
    const relat = (d.filings as any[]).filter(f => /provento|dividend|juros sobre/i.test(f.cat + ' ' + f.subject)).slice(0, 40)
    const byY = new Map<string, number>(); divs.forEach(([t, a]) => byY.set(t.slice(0, 4), (byY.get(t.slice(0, 4)) || 0) + a))
    void px
    return (
      <FnScreen code="DVD" ticker={ticker} title="Dividend / Split History" tabs={['Distribution history', 'CVM notices (IPE)']} tab={tab} setTab={setTab} source={SRC_CVM}
        note="Yahoo only provides the ex-date and gross amount per share. Declaration/record/payment dates and the type (dividend vs JCP) are in the CVM notices (tab 2), linked to the original document.">
        {tab === 0 ? <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title={`Distributions (${rows.length})`}><Grid maxH={560} cols={[{ k: 'ex', label: 'Ex-date', fmt: dBRfull }, { k: 'amt', label: 'Amount R$', align: 'r', fmt: v => nf(v, 6), color: () => C.amber }, { k: 'px', label: 'Prev. price', align: 'r', fmt: (v: any) => nf(v) }, { k: 'y', label: 'Yield', align: 'r', fmt: v => pf(v, 2, false) }, { k: 'type', label: 'Type' }]} rows={rows} /></Panel>
          <Panel title="Total per year (R$/share)"><FnChart height={560} panes={[{ series: [{ kind: 'hist', data: Array.from(byY.entries()).sort().map(([y, v]) => ({ time: `${y}-12-31`, value: v })), color: C.amber, title: 'R$/share', decimals: 3 }] }]} /></Panel>
        </div> : <Panel title="Dividend notices / meetings"><Grid maxH={600} cols={[{ k: 'date', label: 'Date', fmt: dBRfull }, { k: 'cat', label: 'Category' }, { k: 'subject', label: 'Subject', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{v || r.type}</a> }]} rows={relat} /></Panel>}
      </FnScreen>)
  })()}</Guard>
}

export function SPLITView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  return <Guard code="SPLIT" ticker={ticker}>{!d ? <FnScreen code="SPLIT" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const sp = (d.splits_full as [string, number][]).slice().reverse()
    const raw = d.raw_close as [string, number][]
    const rows = sp.map(([t, r]) => ({ date: t, ratio: r, desc: r >= 1 ? `Split ${r >= 1 ? `1:${nf(r, r % 1 ? 2 : 0)}` : ''}` : `Reverse split ${nf(1 / r, 0)}:1`, factor: r }))
    const cum = sp.reduce((p, [, r]) => p * r, 1)
    const months = raw.filter((_, i) => i % 5 === 0)
    return (
      <FnScreen code="SPLIT" ticker={ticker} title="Splits / reverse splits" source={SRC_CVM} note="Split events from Yahoo (ratio = new shares per old share). Chart: raw price (as traded) with markers on event dates. Stock bonuses also appear as fractional splits.">
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '420px 1fr' }}>
          <Panel title={`Events (${rows.length})`}>
            {rows.length ? <Grid cols={[{ k: 'date', label: 'Ex-date', fmt: dBRfull }, { k: 'desc', label: 'Event', color: () => C.amber }, { k: 'factor', label: 'Factor', align: 'r', fmt: v => nf(v, 4) }]} rows={rows} /> : <div className="p-2 text-[12px]" style={{ color: C.muted }}>No events in the available history.</div>}
            <KV rows={[['Cumulative factor', nf(cum, 4), C.amber], ['1 share before the 1st event =', `${nf(cum, 2)} shares today`]]} />
          </Panel>
          <FnChart height={520} log panes={[{ series: [{ kind: 'line', data: months.map(([t, v]) => ({ time: t, value: v })), color: C.white, title: 'Raw price', markers: sp.filter(([t]) => months.length && t >= months[0][0]).map(([t, r]) => ({ time: months.find(m => m[0] >= t)?.[0] || t, text: r >= 1 ? `1:${nf(r, 2)}` : `G ${nf(1 / r, 0)}:1`, color: C.amber, position: 'aboveBar' as const, shape: 'arrowDown' as const })) }] }]} />
        </div>
      </FnScreen>)
  })()}</Guard>
}

// ---------------- CF / CN ----------------
export function CFView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('')
  return <Guard code="CF" ticker={ticker}>{!d ? <FnScreen code="CF" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const cats = ['All', ...Array.from(new Set((d.filings as any[]).map(f => f.cat))).slice(0, 10)]
    const rows = (d.filings as any[]).filter(f => (cat === 'All' || f.cat === cat) && (!q || (f.subject + f.type).toLowerCase().includes(q.toLowerCase())))
    return (
      <FnScreen code="CF" ticker={ticker} title="Company Filings — CVM documents" right={<Field label="Search"><input className={inputCls + ' w-48'} style={inputStyle} value={q} onChange={e => setQ(e.target.value)} /></Field>}
        source="CVM Open Data – IPE (periodic and ad-hoc filings), links to RAD/ENET." note="Brazilian equivalent of 10-K/10-Q/8-K: DFP/ITR, Material Facts, Notices, Minutes. Latest 400 documents.">
        <div className="flex flex-wrap gap-0 pb-2">{cats.map(c => <button key={c} onClick={() => setCat(c)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: cat === c ? C.amber : 'transparent', color: cat === c ? '#000' : C.amber }}>{c.length > 34 ? c.slice(0, 32) + '…' : c}</button>)}</div>
        <Grid maxH={640} cols={[{ k: 'date', label: 'Date', fmt: dBRfull, w: '90px' }, { k: 'cat', label: 'Category', color: () => C.amber, w: '230px' }, { k: 'type', label: 'Type', color: () => C.muted, w: '220px' }, { k: 'subject', label: 'Subject / document', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.text }}>{v || r.type || r.cat}</a> }, { k: 'version', label: 'V', align: 'r', w: '30px' }]} rows={rows} />
      </FnScreen>)
  })()}</Guard>
}

export function CNView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const news = useJSON<any>('news.json')
  return <Guard code="CN" ticker={ticker}>{!d ? <FnScreen code="CN" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const k = tickerKey(ticker), nm = (d.profile?.longName || '').split(/[ .-]/)[0]
    const fil = (d.filings as any[]).filter(f => /Fato Relevante|Comunicado|Aviso|Assembleia|Dados Econ/i.test(f.cat)).map(f => ({ date: f.date, src: f.cat === 'Fato Relevante' ? 'MAT FACT' : 'CVM', title: f.subject || f.type, link: f.link, hot: f.cat === 'Fato Relevante' }))
    const nw = (news.data?.items || []).filter((n: any) => n.tags?.includes(k) || (nm.length > 3 && n.title.toLowerCase().includes(nm.toLowerCase()))).map((n: any) => ({ date: n.date.slice(0, 10), src: n.source.split('–')[0].trim(), title: n.title, link: n.link, hot: false }))
    const rows = [...nw, ...fil].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200)
    return (
      <FnScreen code="CN" ticker={ticker} title="Company News" source="CVM IPE (Material Facts, Market Notices, Notices) + open-license RSS (Agência Brasil, CC BY 4.0) filtered by company name."
        note="No paid news-agency feed: the stream is the company's official regulatory news. Material Facts highlighted.">
        <Grid maxH={700} rowStyle={(r: any) => r.hot ? { background: '#1a1205' } : undefined} cols={[{ k: 'date', label: 'Date', fmt: dBR, w: '70px' }, { k: 'src', label: 'Source', w: '90px', color: (_, r: any) => r.hot ? C.down : C.amber }, { k: 'title', label: 'Headline', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: r.hot ? C.white : C.text, fontWeight: r.hot ? 700 : 400 }}>{v}</a> }]} rows={rows} />
      </FnScreen>)
  })()}</Guard>
}

// ---------------- OMON ----------------
export function OMONView({ ticker }: { ticker: string }) {
  const { data: d, err } = useJSON<any>(isEquity(ticker) ? `options/${tickerKey(ticker)}.json` : null)
  const { rows: px } = usePrices(ticker)
  const [ei, setEi] = useState<number | null>(null)
  const [range, setRange] = useState(10)
  return <Guard code="OMON" ticker={ticker}>{!d ? <FnScreen code="OMON" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const exps = d.expiries as any[]
    const idx = ei ?? Math.max(0, exps.reduce((b: number, e: any, i: number) => (e.calls.length + e.puts.length) > (exps[b].calls.length + exps[b].puts.length) ? i : b, 0))
    const e = exps[idx]
    const strikes = Array.from(new Set([...e.calls, ...e.puts].map((o: any) => o.strike))).sort((a, b) => a - b)
    const atm = strikes.reduce((b, s) => Math.abs(s - d.spot) < Math.abs(b - d.spot) ? s : b, strikes[0])
    const ai = strikes.indexOf(atm), sel = strikes.slice(Math.max(0, ai - range), ai + range + 1)
    const byK = (arr: any[], k: number) => arr.filter(o => o.strike === k).sort((a, b) => b.vol - a.vol)[0]
    const chg = px && px.length > 1 ? (px[px.length - 1].close / px[px.length - 2].close - 1) * 100 : null
    const cell = (v: any, d2 = 2, color?: string) => <td className="px-1 py-[2px] text-right" style={{ color: color || C.text }}>{v == null || v === 0 ? '' : nf(v, d2)}</td>
    const cv = e.calls.reduce((s: number, o: any) => s + o.vol, 0), pv = e.puts.reduce((s: number, o: any) => s + o.vol, 0)
    return (
      <FnScreen code="OMON" ticker={ticker} title="Option Monitor"
        right={<><span>Spot <b style={{ color: C.amber }}>{nf(d.spot)}</b> <span style={{ color: clr(chg) }}>{pf(chg)}</span></span><span style={{ color: C.muted }}>{dBR(d.date)} · r {nf(d.r_cont * 100, 2)}%</span><Field label="Strikes ±"><Btns opts={[5, 10, 20]} value={range} onChange={setRange} /></Field></>}
        source={<>Daily B3 COTAHIST (public end-of-day file). Greeks/IV: {d.model}.</>}
        note="End-of-day snapshot (not real time). Bid/Ask = best quotes at the close (0 = no quote). Shaded rows = in the money. Amber center strike = closest to spot. Expiries with few series are weeklies.">
        <div className="flex flex-wrap gap-0 pb-2">{exps.map((x, i) => <button key={x.date} onClick={() => setEi(i)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: i === idx ? C.amber : 'transparent', color: i === idx ? '#000' : C.amber }}>{dBR(x.date)} ({x.bdays}du) [{x.calls.length + x.puts.length}]</button>)}</div>
        <div className="flex gap-6 text-[12px] pb-1"><span>Expiry <b style={{ color: C.amber }}>{dBRfull(e.date)}</b></span><span>Calls volume R$ {big(cv)}</span><span>Puts volume R$ {big(pv)}</span><span>Put/Call (vol.) {nf(pv / (cv || 1), 2)}</span></div>
        <FitBox base={560} min={140} className="overflow-auto border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead className="sticky top-0 z-10" style={{ background: C.bg }}>
              <tr style={{ background: C.panel2 }}><th colSpan={9} className="py-1 font-bold" style={{ color: C.up }}>CALLS</th><th className="py-1" style={{ color: C.amber }}>Strike</th><th colSpan={9} className="py-1 font-bold" style={{ color: C.down }}>PUTS</th></tr>
              <tr style={{ color: C.amber }}>{['Series', 'Bid', 'Ask', 'Last', 'Trades', 'Vol R$', 'IV', 'Delta', 'Gamma'].map(h => <th key={'c' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}<th></th>{['Bid', 'Ask', 'Last', 'Trades', 'Vol R$', 'IV', 'Delta', 'Gamma', 'Series'].map(h => <th key={'p' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>{sel.map(k => { const c = byK(e.calls, k), p = byK(e.puts, k), itmC = k < d.spot, itmP = k > d.spot
              return <tr key={k} className="border-t" style={{ borderColor: '#1a1a1a' }}>
                <td className="px-1 text-right" style={{ background: itmC ? '#14202a' : undefined, color: C.muted }}>{c?.code || ''}</td>
                {[c?.bid, c?.ask, c?.last].map((v, i) => <React.Fragment key={i}>{cell(v, 2, i === 2 ? C.white : undefined)}</React.Fragment>)}{cell(c?.trades, 0)}{cell(c?.vol ? c.vol / 1e3 : null, 0)}{cell(c?.iv, 1, C.cyan)}{cell(c?.delta, 3)}{cell(c?.gamma, 4)}
                <td className="px-2 text-center font-bold" style={{ background: k === atm ? C.amber : '#111', color: k === atm ? '#000' : C.amber }}>{nf(k)}</td>
                {[p?.bid, p?.ask, p?.last].map((v, i) => <React.Fragment key={i}>{cell(v, 2, i === 2 ? C.white : undefined)}</React.Fragment>)}{cell(p?.trades, 0)}{cell(p?.vol ? p.vol / 1e3 : null, 0)}{cell(p?.iv, 1, C.cyan)}{cell(p?.delta, 3)}{cell(p?.gamma, 4)}
                <td className="px-1 text-right" style={{ background: itmP ? '#2a1414' : undefined, color: C.muted }}>{p?.code || ''}</td>
              </tr> })}</tbody>
          </table>
        </FitBox>
        <div className="text-[11px] pt-1" style={{ color: C.muted }}>Vol R$ in thousands. IV in % p.a.</div>
      </FnScreen>)
  })()}</Guard>
}
