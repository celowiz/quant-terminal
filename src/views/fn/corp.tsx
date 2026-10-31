'use client'
import { tc } from '../../lib/themeRuntime'
import React, { useEffect, useMemo, useState } from 'react'
import { FitBox, FnScreen, Panel, Grid, Btns, Field, KV, Loading, NA, C, nf, pf, big, dBR, dBRfull, clr, short, useJSON, corpPath, hasData, isEquity, inputCls, inputStyle, isoMinus } from '../../components/fn/kit'
import FnChart, { type PaneDef } from '../../components/fn/FnChart'
import { usePrices } from './tech'
import { getJSON, tickerKey } from '../../lib/static'
import { L, regLabel, regValue, sectorEN, fyEnd, isoDate } from './desLabels'
import { DESClassView } from './desClasses'
import { DESMarket, marketMeta } from './desMarket'
import { MARKET_CLASSES } from '../../lib/activeTicker.mjs'

const SRC_CVM = 'CVM Open Data (DFP/ITR, FCA, IPE) + Yahoo Finance (profile, raw price, distributions). Scripts: tools/pipeline/build_corp.py.'
const SRC_SEC = 'SEC EDGAR (XBRL companyfacts, submissions) + Yahoo Finance (profile, raw price, distributions). Script: pipeline/build_sec.py.'
/** ações dos EUA: fundamentos da SEC (10-K/10-Q), valores em US$ */
const isUS = (d: any) => d?.country === 'US'
const ccy = (d: any) => isUS(d) ? 'US$' : 'R$'
const srcOf = (d: any) => isUS(d) ? SRC_SEC : SRC_CVM
const US_NOTE = 'Quarterly flows: the standalone quarter as filed, or the difference between consecutive year-to-date figures (10-Q cash flows are cumulative); Q4 = fiscal year − 9 months. Columns are labelled by the calendar quarter in which the fiscal period ends. EBIT = operating income (pre-tax income + interest expense when operating income is not tagged). Lines the company does not tag in XBRL (without dimensions) show —.'
const useCorp = (t: string) => useJSON<any>(corpPath(t))
const Guard = ({ code, ticker, children }: { code: string; ticker: string; children: React.ReactNode }) =>
  hasData(code, ticker) ? <>{children}</> : <FnScreen code={code} ticker={ticker}><NA ticker={ticker} what="corporate data" code={code.toLowerCase()} /></FnScreen>

/** valor de mercado e múltiplos a partir do preço bruto e ações CVM */
function valuation(d: any) {
  const q = d.fundamentals.quarterly as any[], a = d.fundamentals.annual as any[]
  const last4 = q.slice(-4)
  const fy = a[a.length - 1], lastQ = q[q.length - 1]
  let basis = 'LTM'
  // LTM = soma dos 4 últimos trimestres; sem os 4, o último exercício completo (se recente) — rotulado FYaaaa
  const ltm = (k: string) => {
    if (last4.length === 4 && last4.every(r => r[k] != null)) return last4.reduce((s, r) => s + r[k], 0)
    if (fy?.[k] != null && (!lastQ || fy.period >= isoMinus(lastQ.period, 0, 3, 1))) { basis = `FY${fy.period.slice(0, 4)}`; return fy[k] }
    return null
  }
  const px = d.raw_close[d.raw_close.length - 1]
  // units (código 11): ações equivalentes calculadas no pipeline com os fechamentos oficiais das classes ON/PN
  const shares = d.shares && 'equiv' in d.shares ? d.shares.equiv : d.shares?.total ? d.shares.total - (d.shares.treasury || 0) : null
  const mcap = shares ? px[1] * shares : null
  const bs = q[q.length - 1] || a[a.length - 1]
  const netLtm = ltm('net'), ebitdaLtm = ltm('ebitda'), revLtm = ltm('revenue')
  const divs12 = (d.dividends_full as [string, number][]).filter(x => x[0] > isoMinus(px[0], 0, 0, 1)).reduce((s, x) => s + x[1], 0)
  const ev = mcap != null && bs?.netdebt != null ? mcap + bs.netdebt + (bs.minority || 0) : null
  return { px, shares, mcap, bs, netLtm, ebitdaLtm, revLtm, ev, divs12, basis,
    pe: mcap && netLtm ? mcap / netLtm : null, pb: mcap && bs?.equity ? mcap / bs.equity : null,
    evEbitda: ev && ebitdaLtm ? ev / ebitdaLtm : null, dy: divs12 ? (divs12 / px[1]) * 100 : null,
    roe: netLtm && bs?.equity ? (netLtm / bs.equity) * 100 : null, margin: netLtm && revLtm ? (netLtm / revLtm) * 100 : null,
    ndEbitda: bs?.netdebt != null && ebitdaLtm ? bs.netdebt / ebitdaLtm : null }
}

// ---------------- DES ----------------
/** DES: ações → perfil corporativo; FIIs, ETFs e BDRs → layout da classe (desClasses); índices, moedas, commodities e cripto → desMarket. */
export function DESView({ ticker }: { ticker: string }) {
  const mk = marketMeta(ticker)
  if (mk && MARKET_CLASSES.includes(mk.class || '')) return <DESMarket ticker={ticker} />
  return !isEquity(ticker) && hasData('DES', ticker) ? <DESClassView ticker={ticker} /> : <DESCorp ticker={ticker} />
}
function DESCorp({ ticker }: { ticker: string }) {
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
    const us = isUS(d), $ = ccy(d)
    const reg = (k: string) => cad[k] != null && cad[k] !== '' ? regValue(k, String(cad[k]), us) : null
    const profRows: [string, string][] = [
      [L('Sector / industry', 'Setor / indústria'), p.sector || p.industry ? `${p.sector || '—'} / ${p.industry || '—'}` : '—'],
      us ? [L('Industry (SIC)', 'Indústria (SIC)'), cad.SIC ? `${cad.SIC}${cad.SETOR_ATIV ? ` · ${cad.SETOR_ATIV}` : ''}` : '—'] : [L('Registered sector', 'Setor no registro'), cad.SETOR_ATIV ? sectorEN(cad.SETOR_ATIV) : '—'],
      [L('Employees', 'Funcionários'), p.fullTimeEmployees ? nf(p.fullTimeEmployees, 0) : '—'],
      [L('Headquarters', 'Sede'), [p.city || cad.MUN, p.country].filter(Boolean).join(', ') || '—'],
      [L('Website', 'Site'), p.website || '—'],
      ...(us ? [['CIK', d.cik || '—'], [L('Fiscal year end', 'Fim do exercício fiscal'), cad.FISCAL_YEAR_END ? fyEnd(cad.FISCAL_YEAR_END) : '—']] as [string, string][]
        : [['CNPJ', d.cnpj], [L('Shareholder control', 'Controle acionário'), reg('CONTROLE_ACIONARIO') || '—'],
          ...(cad.DT_CONST ? [[L('Founded', 'Constituição'), isoDate(cad.DT_CONST)]] : []),
          ...(cad.AUDITOR ? [[L('Auditor', 'Auditor'), cad.AUDITOR]] : []),
          ...(cad.RESP ? [[L('IR officer', 'Diretor de RI'), cad.RESP]] : [])] as [string, string][]),
    ]
    return (
      <FnScreen code="DES" ticker={ticker} title={`${L('Description', 'Descrição')} — ${p.longName || cad.DENOM_SOCIAL}`} tabs={[L('Profile', 'Perfil'), L('Revenue & Earnings', 'Receita e lucro'), L('Registry', 'Cadastro')]} tab={tab} setTab={setTab}
        source={srcOf(d)} note={us ? L(`Market cap = raw closing price × shares outstanding. Multiples use trailing 4-quarter earnings/EBITDA from 10-K/10-Q (latest fiscal year when 4 quarters are not available). EV = market cap + net debt + non-controlling interests; — when debt is not tagged in XBRL. Net margin = net income / revenue; EBITDA margin = EBITDA / revenue.`, `Valor de mercado = preço de fechamento bruto × ações em circulação. Os múltiplos usam lucro/EBITDA dos últimos 4 trimestres (10-K/10-Q; último exercício quando não há 4 trimestres). EV = valor de mercado + dívida líquida + participação de não controladores; — quando a dívida não é informada em XBRL. Margem líquida = lucro líquido / receita; margem EBITDA = EBITDA / receita.`)
          : L(`Market cap = raw closing price × shares outstanding (capital breakdown, all classes). Multiples use trailing 4-quarter earnings/EBITDA. Net margin = net income / revenue; EBITDA margin = EBITDA / revenue.${d.shares?.note ? ` ${d.shares.note}.` : ''}`, `Valor de mercado = preço de fechamento bruto × ações (composição do capital, todas as classes). Os múltiplos usam lucro/EBITDA dos últimos 4 trimestres. Margem líquida = lucro líquido / receita; margem EBITDA = EBITDA / receita.${d.shares?.note ? ` ${d.shares.note}.` : ''}`)}>
        {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <Panel title={L('Company description', 'Descrição da empresa')}>
            <div className="p-2 text-[12px] leading-snug" style={{ color: C.text, maxHeight: 210, overflow: 'auto', borderBottom: `1px solid ${C.line}` }}>{p.longBusinessSummary || '—'}</div>
            <KV rows={profRows} />
          </Panel>
          <Panel title={L('Price — 1 year', 'Preço — 1 ano')} asOf={v.px[0]}>
            {r1.length > 0 && <FnChart height={190} panes={[{ series: [{ kind: 'area', data: r1.map(r => ({ time: r.time, value: r.close })), color: C.white, title: short(ticker) }] }]} />}
            <KV rows={[[L('Last (raw)', 'Último (bruto)'), `${$} ${nf(v.px[1])}`, C.amber], [L('Date', 'Data'), dBR(v.px[0])], [L('1Y return (adj.)', 'Retorno 1 ano (ajust.)'), pf(ret1), clr(ret1)], [L('52w high', 'Máxima 52 sem.'), nf(hi)], [L('52w low', 'Mínima 52 sem.'), nf(lo)]]} />
          </Panel>
          <Panel title={L('Key data', 'Dados principais')} asOf={v.bs?.period}>
            <KV rows={[[L('Market cap', 'Valor de mercado'), v.mcap != null ? `${$} ${big(v.mcap)}` : '—', C.amber], [us ? L('Shares outstanding', 'Ações em circulação') : L('Shares (ON+PN)', 'Ações (ON+PN)'), big(v.shares, 2)], ['EV', v.ev != null ? `${$} ${big(v.ev)}` : '—'], [`${L('P/E', 'P/L')} (${v.basis})`, nf(v.pe)], [L('P/B', 'P/VP'), nf(v.pb)], [`EV/EBITDA (${v.basis})`, nf(v.evEbitda)], [L('Div. yield 12m', 'Div. yield 12m'), pf(v.dy, 2, false)], [`ROE (${v.basis})`, pf(v.roe, 1, false)], [L('Net margin', 'Margem líquida'), pf(v.margin, 1, false)], [L('Net debt/EBITDA', 'Dív. líq./EBITDA'), nf(v.ndEbitda)], [`${L('Revenue', 'Receita')} ${v.basis}`, v.revLtm != null ? `${$} ${big(v.revLtm)}` : '—'], [`${L('Earnings', 'Lucro')} ${v.basis}`, v.netLtm != null ? `${$} ${big(v.netLtm)}` : '—']]} />
          </Panel>
        </div>}
        {tab === 1 && <div className="grid gap-2 fn-grid pb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title={`${L('Annual revenue', 'Receita anual')} (${$} ${L('bn', 'bi')})`}><FnChart height={240} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.annual.filter((r: any) => r.revenue).map((r: any) => ({ time: r.period, value: r.revenue / 1e9 })), color: C.amber, title: L('Revenue', 'Receita'), decimals: 1 }] }]} /></Panel>
          <Panel title={`${L('Quarterly net income', 'Lucro líquido trimestral')} (${$} ${L('bn', 'bi')})`}><FnChart height={240} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.quarterly.filter((r: any) => r.net != null).map((r: any) => ({ time: r.period, value: r.net / 1e9, color: r.net >= 0 ? C.up : C.down })), title: L('Earnings', 'Lucro'), decimals: 1 }] }]} /></Panel>
          <div className="col-span-2"><Panel title={L('Annual summary', 'Resumo anual')}>
            <Grid cols={[{ k: 'period', label: L('Fiscal year', 'Exercício'), fmt: v => v.slice(0, 4) }, { k: 'revenue', label: L('Revenue', 'Receita'), align: 'r', fmt: v => big(v) }, { k: 'ebitda', label: 'EBITDA', align: 'r', fmt: v => big(v) }, { k: 'mge', label: L('EBITDA margin', 'Margem EBITDA'), align: 'r', fmt: v => pf(v, 1, false) }, { k: 'net', label: L('Net income', 'Lucro líquido'), align: 'r', fmt: v => big(v), color: clr }, { k: 'mg', label: L('Net margin', 'Margem líquida'), align: 'r', fmt: v => pf(v, 1, false) }]} rows={ann.map((r: any) => ({ ...r, mg: r.net != null && r.revenue ? (r.net / r.revenue) * 100 : null, mge: r.ebitda != null && r.revenue ? (r.ebitda / r.revenue) * 100 : null }))} />
          </Panel></div>
        </div>}
        {tab === 2 && <Panel title={L('Registry', 'Cadastro')}><KV cols={2} rows={Object.entries(cad).filter(([, x]) => x != null && x !== '').map(([k, x]) => [regLabel(k, us), regValue(k, String(x), us)] as [string, string])} /></Panel>}
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
      <FnScreen code="FUND" ticker={ticker} asOf={src.length ? src[src.length - 1].period : null} title="Fundamentals — financial statements" tabs={['Income Statement', 'Balance Sheet', 'Cash Flow', 'Ratios']} tab={tab} setTab={setTab}
        right={<Btns opts={[{ v: 'a', l: 'Yearly' }, { v: 'q', l: 'Quarterly' }] as any} value={per} onChange={setPer as any} />}
        source={srcOf(d)} note={<>{d.fundamentals.note}{isUS(d) ? ` ${US_NOTE}` : ''} Values in {ccy(d)} millions. Amber figures = reported (no consensus estimates in this version).{d.fundamentals.bank_format ? ' Bank: financial-institution layout — EBIT/EBITDA/debt do not apply.' : ''}{d.fundamentals.basis === 'individual' && !isUS(d) ? ' Individual (parent-only) statements: the company does not file consolidated statements with CVM.' : ''}</>}>
        <div className="overflow-auto border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr style={{ background: C.panel2 }}><th className="px-2 py-1 text-left font-normal" style={{ color: C.amber }}>{ccy(d)} mn</th>{src.map((r: any) => <th key={r.period} className="px-2 py-1 text-right font-normal" style={{ color: C.amber }}>{lbl(r.period)}</th>)}</tr></thead>
            <tbody>{rowsDef.map(([k, l, bold]) => (
              <tr key={k} className="border-t" style={{ borderColor: tc('#1a1a1a') }}><td className="px-2 py-[3px]" style={{ fontWeight: bold ? 700 : 400 }}>{l}</td>
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
/** Pares do VAL: mesmo subsetor (senão setor) no screener (IBOV/CVM ou EUA/SEC), com dados; até 5, maior valor de mercado primeiro. */
function usePeers(ticker: string) {
  const us = !ticker.toUpperCase().endsWith('.SA')
  const { data: sc } = useJSON<any>(us ? 'screener_us.json' : 'screener.json')
  const [rows, setRows] = useState<[string, any][]>([])
  const [sector, setSector] = useState('')
  useEffect(() => {
    if (!sc) return
    const tk = (r: any) => us ? String(r.cod) : `${r.cod}.SA`
    const all = sc.rows as any[], me = all.find(r => tk(r) === ticker.toUpperCase())
    const pick = (k: 'subsector' | 'sector') => me ? all.filter(r => me[k] && r[k] === me[k] && tk(r) !== ticker.toUpperCase() && hasData('VAL', tk(r))) : []
    let list = pick('subsector'), label = me?.subsector || ''
    if (list.length < 2) { list = pick('sector'); label = me?.sector || '' }
    if (!me) { list = all.filter(r => (us ? ['AAPL', 'MSFT', 'GOOGL', 'AMZN'] : ['PETR4', 'VALE3', 'ITUB4', 'B3SA3']).includes(r.cod) && tk(r) !== ticker.toUpperCase()); label = '' }
    const top = list.sort((a, b) => (b.mcap || 0) - (a.mcap || 0)).slice(0, 5).map(tk)
    let alive = true
    Promise.all(top.map(t => getJSON<any>(`corp/${tickerKey(t)}.json`).then(x => [t, x] as [string, any]).catch(() => null)))
      .then(r => { if (alive) { setRows(r.filter(Boolean) as [string, any][]); setSector(label) } })
    return () => { alive = false }
  }, [sc, ticker])
  return { rows, sector }
}
export function VALView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const peerData = usePeers(ticker)
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
    const peerRows = [[ticker, d] as [string, any], ...peerData.rows].map(([t, x]) => ({ t: short(t), ...valuation(x), cur: t === ticker }))
    return (
      <FnScreen code="VAL" ticker={ticker} title="Valuation — multiples and history" source={srcOf(d)}
        note={isUS(d) ? `Multiples computed from raw price × share count (10-K/10-Q cover) and trailing 4-quarter results (10-K/10-Q XBRL; latest fiscal year when 4 quarters are not available, shown as ${v.basis}). History assumes results are released 45 days after quarter end. Ref. column shown for cross-checking; differences come from share-count/LTM criteria.` : 'Multiples computed in the pipeline from raw price × share count and trailing 4-quarter results (DFP/ITR). History assumes results are released 45 days after quarter end. Ref. column shown for cross-checking; differences come from share-count/LTM criteria.'}>
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '300px 1fr' }}>
          <Panel title="Current multiples" asOf={v.px[0]}>
            <Grid cols={[{ k: 'l', label: 'Indicator' }, { k: 'v', label: 'Computed', align: 'r', color: () => C.amber }, { k: 'y', label: 'Ref.', align: 'r', color: () => C.muted }]} rows={[
              { l: 'Price (raw)', v: nf(v.px[1]), y: '—' }, { l: 'Market cap', v: big(v.mcap), y: big(ys.marketCap) }, { l: 'EV', v: big(v.ev), y: '—' },
              { l: `P/E ${v.basis}`, v: nf(v.pe), y: nf(ys.trailingPE) }, { l: 'P/B', v: nf(v.pb), y: nf(ys.priceToBook) }, { l: 'EV/EBITDA', v: nf(v.evEbitda), y: nf(ys.enterpriseToEbitda) },
              { l: 'Div. yield 12m', v: pf(v.dy, 2, false), y: pf(ys.dividendYield, 2, false) }, { l: 'ROE', v: pf(v.roe, 1, false), y: '—' }, { l: 'Net debt/EBITDA', v: nf(v.ndEbitda), y: '—' },
            ]} />
          </Panel>
          <div>
            <div className="flex items-center gap-2 pb-1 text-[12px]"><span style={{ color: C.amber }}>3-year history</span><Btns opts={[{ v: 'pe', l: 'P/E' }, { v: 'pb', l: 'P/B' }, { v: 'dy', l: 'DY %' }] as any} value={metric} onChange={setMetric as any} /><span style={{ color: C.muted }}>average {nf(avg)}</span></div>
            <FnChart height={330} panes={[{ series: [{ kind: 'line', data: ser, color: C.amber, title: metric.toUpperCase(), lines: [{ price: avg, color: tc('#888'), title: 'Average' }] }] }]} />
          </div>
        </div>
        <div className="mt-2"><Panel title={`Peer comparison (same methodology)${peerData.sector ? ` — ${peerData.sector}` : ''}`}>
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
      <FnScreen code="DY" ticker={ticker} title="Dividend Yield" source={srcOf(d)} note={`12m DY = sum of distributions (${isUS(d) ? 'cash dividends' : 'gross dividends + JCP'}, by ex-date) over the previous 12 months ÷ that day's raw price. Distributions and price unadjusted.`}>
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 380px' }}>
          <div><div className="flex gap-4 text-[12px] pb-1"><span>Current 12m DY <b style={{ color: C.amber }}>{pf(cur, 2, false)}</b></span><span style={{ color: C.muted }}>10y average {pf(avg, 2, false)}</span></div>
            <FnChart height={520} panes={[{ series: [{ kind: 'area', data: ser, color: C.amber, title: 'DY 12m', pct: true, lines: [{ price: avg, color: tc('#888'), title: 'Average' }] }] }]} /></div>
          <Panel title="By year"><Grid cols={[{ k: 'y', label: 'Year' }, { k: 'n', label: 'Nº', align: 'r' }, { k: 'tot', label: `${ccy(d)}/share`, align: 'r', fmt: v => nf(v, 4) }, { k: 'end', label: 'End price', align: 'r', fmt: (v: any) => nf(v) }, { k: 'dyEnd', label: 'End DY', align: 'r', fmt: v => pf(v, 2, false), color: () => C.amber }, { k: 'dyAvg', label: 'Avg DY', align: 'r', fmt: v => pf(v, 2, false) }]} rows={yr} /></Panel>
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
    const us = isUS(d), $ = ccy(d)
    const rows = divs.map(([t, a]) => { const p = prev(t); return { ex: t, amt: a, px: p, y: p ? a / p * 100 : null, freq: 'Irregular', type: us ? 'Dividend' : 'Dividend/JCP' } })
    const relat = (d.filings as any[]).filter(f => /provento|dividend|juros sobre/i.test(f.cat + ' ' + f.subject)).slice(0, 40)
    const byY = new Map<string, number>(); divs.forEach(([t, a]) => byY.set(t.slice(0, 4), (byY.get(t.slice(0, 4)) || 0) + a))
    void px
    return (
      <FnScreen code="DVD" ticker={ticker} title="Dividend / Split History" tabs={us ? undefined : ['Distribution history', 'Company notices']} tab={tab} setTab={setTab} source={srcOf(d)}
        note={us ? 'Only the ex-date and amount per share are available here. Declaration, record and payment dates are in the company\'s press releases (often furnished on Form 8-K, see CF).' : 'Only the ex-date and gross amount per share are available here. Declaration/record/payment dates and the type (dividend vs JCP) are in the company notices (tab 2), linked to the original document.'}>
        {tab === 0 || us ? <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title={`Distributions (${rows.length})`}><Grid maxH={560} cols={[{ k: 'ex', label: 'Ex-date', fmt: dBRfull }, { k: 'amt', label: `Amount ${$}`, align: 'r', fmt: v => nf(v, 6), color: () => C.amber }, { k: 'px', label: 'Prev. price', align: 'r', fmt: (v: any) => nf(v) }, { k: 'y', label: 'Yield', align: 'r', fmt: v => pf(v, 2, false) }, { k: 'type', label: 'Type' }]} rows={rows} /></Panel>
          <Panel title={`Total per year (${$}/share)`}><FnChart height={560} panes={[{ series: [{ kind: 'hist', data: Array.from(byY.entries()).sort().map(([y, v]) => ({ time: `${y}-12-31`, value: v })), color: C.amber, title: `${$}/share`, decimals: 3 }] }]} /></Panel>
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
      <FnScreen code="SPLIT" ticker={ticker} title="Splits / reverse splits" source={srcOf(d)} note="Split events from Yahoo (ratio = new shares per old share). Chart: raw price (as traded) with markers on event dates. Stock bonuses also appear as fractional splits.">
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
      <FnScreen code="CF" ticker={ticker} title="Company Filings" right={<Field label="Search"><input className={inputCls + ' w-48'} style={inputStyle} value={q} onChange={e => setQ(e.target.value)} /></Field>}
        source={isUS(d) ? 'SEC EDGAR – submissions API (10-K, 10-Q, 8-K, proxy statements…), links to the original document on sec.gov.' : 'CVM Open Data – IPE (periodic and ad-hoc filings), links to RAD/ENET.'}
        note={isUS(d) ? `10-K = annual report, 10-Q = quarterly report, 8-K = current report (subject = official Form 8-K item titles), DEF 14A = proxy statement. Latest ${d.filings.length} filings${d.cad?.PREDECESSOR ? `, including the predecessor registrant ${d.cad.PREDECESSOR}` : ''}.` : 'Brazilian equivalent of 10-K/10-Q/8-K: DFP/ITR, Material Facts, Notices, Minutes. Latest 400 documents.'}>
        <div className="flex flex-wrap gap-0 pb-2">{cats.map(c => <button key={c} onClick={() => setCat(c)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: cat === c ? C.amber : 'transparent', color: cat === c ? tc('#000') : C.amber }}>{c.length > 34 ? c.slice(0, 32) + '…' : c}</button>)}</div>
        <Grid maxH={640} cols={[{ k: 'date', label: 'Date', fmt: dBRfull, w: '90px' }, { k: 'cat', label: 'Category', color: () => C.amber, w: '230px' }, { k: 'type', label: 'Type', color: () => C.muted, w: '220px' }, { k: 'subject', label: 'Subject / document', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.text }}>{v || r.type || r.cat}</a> }, { k: 'version', label: 'V', align: 'r', w: '30px' }]} rows={rows} />
      </FnScreen>)
  })()}</Guard>
}

export function CNView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const news = useJSON<any>('news.json')
  return <Guard code="CN" ticker={ticker}>{!d ? <FnScreen code="CN" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const k = tickerKey(ticker), nm = (d.profile?.longName || '').split(/[ .-]/)[0]
    const us = isUS(d)
    // EUA: os 8-K (current reports) são o fluxo oficial de notícias da empresa; destaque para resultados (item 2.02)
    const fil = us ? (d.filings as any[]).filter(f => /^8-K/.test(f.cat)).map(f => ({ date: f.date, src: f.cat, title: f.subject || f.type, link: f.link, hot: /Results of Operations/.test(f.subject || '') }))
      : (d.filings as any[]).filter(f => /Fato Relevante|Comunicado|Aviso|Assembleia|Dados Econ/i.test(f.cat)).map(f => ({ date: f.date, src: f.cat === 'Fato Relevante' ? 'MAT FACT' : 'NOTICE', title: f.subject || f.type, link: f.link, hot: f.cat === 'Fato Relevante' }))
    const nw = (news.data?.items || []).filter((n: any) => n.tags?.includes(k) || (nm.length > 3 && n.title.toLowerCase().includes(nm.toLowerCase()))).map((n: any) => ({ date: n.date.slice(0, 10), src: n.source.split('–')[0].trim(), title: n.title, link: n.link, hot: false }))
    const rows = [...nw, ...fil].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200)
    return (
      <FnScreen code="CN" ticker={ticker} title="Company News" source={us ? 'SEC EDGAR – Form 8-K current reports + open-license RSS filtered by company name.' : 'CVM IPE (Material Facts, Market Notices, Notices) + open-license RSS (Agência Brasil, CC BY 4.0) filtered by company name.'}
        note={us ? 'No paid news-agency feed: the stream is the company\'s official regulatory news (Form 8-K, official item titles). Earnings releases (item 2.02) highlighted.' : 'No paid news-agency feed: the stream is the company\'s official regulatory news. Material Facts highlighted.'}>
        <Grid maxH={700} rowStyle={(r: any) => r.hot ? { background: tc('#1a1205') } : undefined} cols={[{ k: 'date', label: 'Date', fmt: dBR, w: '70px' }, { k: 'src', label: 'Type', w: '90px', color: (_, r: any) => r.hot ? C.down : C.amber }, { k: 'title', label: 'Headline', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: r.hot ? C.white : C.text, fontWeight: r.hot ? 700 : 400 }}>{v}</a> }]} rows={rows} />
      </FnScreen>)
  })()}</Guard>
}

// ---------------- OMON ----------------
export function OMONView({ ticker }: { ticker: string }) {
  const { data: d, err } = useJSON<any>(hasData('OMON', ticker) ? `options/${tickerKey(ticker)}.json` : null)
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
        <div className="flex flex-wrap gap-0 pb-2">{exps.map((x, i) => <button key={x.date} onClick={() => setEi(i)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: i === idx ? C.amber : 'transparent', color: i === idx ? tc('#000') : C.amber }}>{dBR(x.date)} ({x.bdays}du) [{x.calls.length + x.puts.length}]</button>)}</div>
        <div className="flex gap-6 text-[12px] pb-1"><span>Expiry <b style={{ color: C.amber }}>{dBRfull(e.date)}</b></span><span>Calls volume R$ {big(cv)}</span><span>Puts volume R$ {big(pv)}</span><span>Put/Call (vol.) {nf(pv / (cv || 1), 2)}</span></div>
        <FitBox base={560} min={140} className="overflow-auto border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead className="sticky top-0 z-10" style={{ background: C.bg }}>
              <tr style={{ background: C.panel2 }}><th colSpan={9} className="py-1 font-bold" style={{ color: C.up }}>CALLS</th><th className="py-1" style={{ color: C.amber }}>Strike</th><th colSpan={9} className="py-1 font-bold" style={{ color: C.down }}>PUTS</th></tr>
              <tr style={{ color: C.amber }}>{['Series', 'Bid', 'Ask', 'Last', 'Trades', 'Vol R$', 'IV', 'Delta', 'Gamma'].map(h => <th key={'c' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}<th></th>{['Bid', 'Ask', 'Last', 'Trades', 'Vol R$', 'IV', 'Delta', 'Gamma', 'Series'].map(h => <th key={'p' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>{sel.map(k => { const c = byK(e.calls, k), p = byK(e.puts, k), itmC = k < d.spot, itmP = k > d.spot
              return <tr key={k} className="border-t" style={{ borderColor: tc('#1a1a1a') }}>
                <td className="px-1 text-right" style={{ background: itmC ? tc('#14202a') : undefined, color: C.muted }}>{c?.code || ''}</td>
                {[c?.bid, c?.ask, c?.last].map((v, i) => <React.Fragment key={i}>{cell(v, 2, i === 2 ? C.white : undefined)}</React.Fragment>)}{cell(c?.trades, 0)}{cell(c?.vol ? c.vol / 1e3 : null, 0)}{cell(c?.iv, 1, C.cyan)}{cell(c?.delta, 3)}{cell(c?.gamma, 4)}
                <td className="px-2 text-center font-bold" style={{ background: k === atm ? C.amber : tc('#111'), color: k === atm ? tc('#000') : C.amber }}>{nf(k)}</td>
                {[p?.bid, p?.ask, p?.last].map((v, i) => <React.Fragment key={i}>{cell(v, 2, i === 2 ? C.white : undefined)}</React.Fragment>)}{cell(p?.trades, 0)}{cell(p?.vol ? p.vol / 1e3 : null, 0)}{cell(p?.iv, 1, C.cyan)}{cell(p?.delta, 3)}{cell(p?.gamma, 4)}
                <td className="px-1 text-right" style={{ background: itmP ? tc('#2a1414') : undefined, color: C.muted }}>{p?.code || ''}</td>
              </tr> })}</tbody>
          </table>
        </FitBox>
        <div className="text-[11px] pt-1" style={{ color: C.muted }}>Vol R$ in thousands. IV in % p.a.</div>
      </FnScreen>)
  })()}</Guard>
}
