'use client'
import React, { useMemo, useState } from 'react'
import { FitBox, FnScreen, Panel, Grid, Btns, Field, KV, Loading, NA, C, nf, pf, big, dBR, dBRfull, clr, short, useJSON, corpPath, isEquity, inputCls, inputStyle, isoMinus } from '../../components/fn/kit'
import FnChart, { type PaneDef } from '../../components/fn/FnChart'
import { usePrices } from './tech'
import { tickerKey } from '../../lib/static'

const SRC_CVM = 'CVM Dados Abertos (DFP/ITR, FCA, IPE) + Yahoo Finance (perfil, preço bruto, proventos). Scripts: tools/pipeline/build_corp.py.'
const useCorp = (t: string) => useJSON<any>(corpPath(t))
const Guard = ({ code, ticker, children }: { code: string; ticker: string; children: React.ReactNode }) =>
  isEquity(ticker) ? <>{children}</> : <FnScreen code={code} ticker={ticker}><NA ticker={ticker} what="dados corporativos (CVM)" code={code.toLowerCase()} /></FnScreen>

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
      <FnScreen code="DES" ticker={ticker} title={`Descrição — ${p.longName || cad.DENOM_SOCIAL}`} tabs={['Perfil', 'Receita & Lucro', 'Cadastro CVM']} tab={tab} setTab={setTab}
        source={SRC_CVM} note="Valor de mercado = preço bruto de fechamento × ações em circulação (CVM, composição do capital, todas as classes). Múltiplos com lucro/EBITDA dos últimos 4 trimestres.">
        {tab === 0 && <div className="grid gap-2" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <Panel title="Descrição da empresa">
            <div className="p-2 text-[12px] leading-snug" style={{ color: C.text, maxHeight: 210, overflow: 'auto', borderBottom: `1px solid ${C.line}` }}>{p.longBusinessSummary}</div>
            <KV rows={[['Setor (Yahoo)', `${p.sector || '—'} / ${p.industry || '—'}`], ['Setor CVM', cad.SETOR_ATIV || '—'], ['Funcionários', p.fullTimeEmployees ? nf(p.fullTimeEmployees, 0) : '—'], ['Sede', `${p.city || cad.MUN || '—'}, ${p.country || ''}`], ['Site', p.website || '—'], ['CNPJ', d.cnpj], ['Controle acionário', cad.CONTROLE_ACIONARIO || '—']]} />
          </Panel>
          <Panel title="Preço — 1 ano">
            {r1.length > 0 && <FnChart height={190} panes={[{ series: [{ kind: 'area', data: r1.map(r => ({ time: r.time, value: r.close })), color: C.amber, title: short(ticker) }] }]} />}
            <KV rows={[['Último (bruto)', `R$ ${nf(v.px[1])}`, C.amber], ['Data', dBR(v.px[0])], ['Retorno 1A (ajust.)', pf(ret1), clr(ret1)], ['Máx 52s', nf(hi)], ['Mín 52s', nf(lo)]]} />
          </Panel>
          <Panel title="Dados-chave">
            <KV rows={[['Valor de mercado', `R$ ${big(v.mcap)}`, C.amber], ['Ações (ON+PN)', big(v.shares, 2)], ['EV', `R$ ${big(v.ev)}`], ['P/L (LTM)', nf(v.pe)], ['P/VPA', nf(v.pb)], ['EV/EBITDA (LTM)', nf(v.evEbitda)], ['Div. yield 12m', pf(v.dy, 2, false)], ['ROE (LTM)', pf(v.roe, 1, false)], ['Margem líquida', pf(v.margin, 1, false)], ['Dív. líq./EBITDA', nf(v.ndEbitda)], ['Receita LTM', `R$ ${big(v.revLtm)}`], ['Lucro LTM', `R$ ${big(v.netLtm)}`]]} />
          </Panel>
        </div>}
        {tab === 1 && <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title="Receita anual (R$ bi)"><FnChart height={300} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.annual.filter((r: any) => r.revenue).map((r: any) => ({ time: r.period, value: r.revenue / 1e9 })), color: C.amber, title: 'Receita', decimals: 1 }] }]} /></Panel>
          <Panel title="Lucro líquido trimestral (R$ bi)"><FnChart height={300} panes={[{ series: [{ kind: 'hist', data: d.fundamentals.quarterly.filter((r: any) => r.net != null).map((r: any) => ({ time: r.period, value: r.net / 1e9, color: r.net >= 0 ? C.up : C.down })), title: 'Lucro', decimals: 1 }] }]} /></Panel>
          <div className="col-span-2"><Panel title="Resumo anual">
            <Grid cols={[{ k: 'period', label: 'Exercício', fmt: v => v.slice(0, 4) }, { k: 'revenue', label: 'Receita', align: 'r', fmt: v => big(v) }, { k: 'ebitda', label: 'EBITDA', align: 'r', fmt: v => big(v) }, { k: 'net', label: 'Lucro líq.', align: 'r', fmt: v => big(v), color: clr }, { k: 'mg', label: 'Margem', align: 'r', fmt: v => pf(v, 1, false) }]} rows={ann.map((r: any) => ({ ...r, mg: r.net && r.revenue ? (r.net / r.revenue) * 100 : null }))} />
          </Panel></div>
        </div>}
        {tab === 2 && <Panel title="Cadastro (CVM cad_cia_aberta)"><KV cols={2} rows={Object.entries(cad).filter(([, x]) => x != null && x !== '').map(([k, x]) => [k, String(x)] as [string, string])} /></Panel>}
      </FnScreen>)
  })()}</Guard>
}

// ---------------- FUND ----------------
const FROWS: [string, string, boolean?][] = [['revenue', 'Receita líquida'], ['gross', 'Resultado bruto'], ['ebit', 'EBIT'], ['da', 'D&A'], ['ebitda', 'EBITDA'], ['fin', 'Resultado financeiro'], ['pretax', 'Lucro antes do IR'], ['net', 'Lucro líquido', true]]
const BROWS: [string, string, boolean?][] = [['assets', 'Ativo total'], ['cash', 'Caixa e equivalentes'], ['stinv', 'Aplicações financeiras'], ['debt', 'Dívida bruta'], ['netdebt', 'Dívida líquida', true], ['minority', 'Part. não controladores'], ['equity', 'Patrimônio líquido', true]]
const CROWS: [string, string, boolean?][] = [['cfo', 'Caixa operacional'], ['capex', 'Capex (imobilizado+intangível)'], ['fcf', 'Fluxo de caixa livre', true]]
export function FUNDView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const [tab, setTab] = useState(0)
  const [per, setPer] = useState<'a' | 'q'>('a')
  return <Guard code="FUND" ticker={ticker}>{!d ? <FnScreen code="FUND" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const src = (per === 'a' ? d.fundamentals.annual : d.fundamentals.quarterly.slice(-10)).map((r: any) => ({ ...r, fcf: r.cfo != null && r.capex != null ? r.cfo + r.capex : null, mg: r.net && r.revenue ? r.net / r.revenue * 100 : null, mge: r.ebitda && r.revenue ? r.ebitda / r.revenue * 100 : null, roe: r.net && r.equity ? r.net / r.equity * 100 * (per === 'q' ? 4 : 1) : null, lev: r.netdebt != null && r.equity ? r.netdebt / r.equity : null }))
    const IROWS: [string, string, boolean?][] = [['mge', 'Margem EBITDA %'], ['mg', 'Margem líquida %'], ['roe', `ROE % ${per === 'q' ? '(anualizado)' : ''}`], ['lev', 'Dív. líq. / PL']]
    const rowsDef = [FROWS, BROWS, CROWS, IROWS][tab]
    const lbl = (p: string) => per === 'a' ? p.slice(0, 4) : `${Math.ceil(+p.slice(5, 7) / 3)}T${p.slice(2, 4)}`
    const isRatio = tab === 3
    return (
      <FnScreen code="FUND" ticker={ticker} title="Fundamentos — demonstrações financeiras" tabs={['DRE', 'Balanço', 'Fluxo de caixa', 'Indicadores']} tab={tab} setTab={setTab}
        right={<Btns opts={[{ v: 'a', l: 'Anual' }, { v: 'q', l: 'Trimestral' }] as any} value={per} onChange={setPer as any} />}
        source={SRC_CVM} note={<>{d.fundamentals.note} Valores em R$ milhões. Números em âmbar = reportados (não há estimativas de consenso nesta versão).{d.fundamentals.bank_format ? ' Banco: layout de instituição financeira (IF) — EBIT/EBITDA/dívida não se aplicam.' : ''}</>}>
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
      <FnScreen code="VAL" ticker={ticker} title="Valuation — múltiplos e histórico" source={SRC_CVM}
        note="Múltiplos calculados no pipeline com preço bruto × ações CVM e resultados dos últimos 4 trimestres (DFP/ITR). Histórico assume divulgação 45 dias após o fim do trimestre. Coluna Yahoo mostrada para conferência; diferenças vêm de critérios de ações/LTM.">
        <div className="grid gap-2" style={{ gridTemplateColumns: '300px 1fr' }}>
          <Panel title="Múltiplos atuais">
            <Grid cols={[{ k: 'l', label: 'Indicador' }, { k: 'v', label: 'Calculado', align: 'r', color: () => C.amber }, { k: 'y', label: 'Yahoo', align: 'r', color: () => C.muted }]} rows={[
              { l: 'Preço (bruto)', v: nf(v.px[1]), y: '—' }, { l: 'Valor de mercado', v: big(v.mcap), y: big(ys.marketCap) }, { l: 'EV', v: big(v.ev), y: '—' },
              { l: 'P/L LTM', v: nf(v.pe), y: nf(ys.trailingPE) }, { l: 'P/VPA', v: nf(v.pb), y: nf(ys.priceToBook) }, { l: 'EV/EBITDA', v: nf(v.evEbitda), y: nf(ys.enterpriseToEbitda) },
              { l: 'Div. yield 12m', v: pf(v.dy, 2, false), y: pf(ys.dividendYield, 2, false) }, { l: 'ROE', v: pf(v.roe, 1, false), y: '—' }, { l: 'Dív.líq./EBITDA', v: nf(v.ndEbitda), y: '—' },
            ]} />
          </Panel>
          <div>
            <div className="flex items-center gap-2 pb-1 text-[12px]"><span style={{ color: C.amber }}>Histórico 3 anos</span><Btns opts={[{ v: 'pe', l: 'P/L' }, { v: 'pb', l: 'P/VPA' }, { v: 'dy', l: 'DY %' }] as any} value={metric} onChange={setMetric as any} /><span style={{ color: C.muted }}>média {nf(avg)}</span></div>
            <FnChart height={330} panes={[{ series: [{ kind: 'line', data: ser, color: C.amber, title: metric.toUpperCase(), lines: [{ price: avg, color: '#888', title: 'Média' }] }] }]} />
          </div>
        </div>
        <div className="mt-2"><Panel title="Comparação com pares (mesma metodologia)">
          <Grid cols={[{ k: 't', label: 'Ticker', color: (_, r: any) => r.cur ? C.amber : C.text }, { k: 'mcap', label: 'Valor merc.', align: 'r', fmt: (v: any) => big(v) }, { k: 'pe', label: 'P/L', align: 'r', fmt: (v: any) => nf(v) }, { k: 'pb', label: 'P/VPA', align: 'r', fmt: (v: any) => nf(v) }, { k: 'evEbitda', label: 'EV/EBITDA', align: 'r', fmt: (v: any) => nf(v) }, { k: 'dy', label: 'DY %', align: 'r', fmt: v => nf(v) }, { k: 'roe', label: 'ROE %', align: 'r', fmt: v => nf(v, 1) }, { k: 'margin', label: 'Mg. líq. %', align: 'r', fmt: v => nf(v, 1) }]} rows={peerRows} />
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
      <FnScreen code="DY" ticker={ticker} title="Dividend Yield" source={SRC_CVM} note="DY 12m = soma dos proventos (dividendos + JCP brutos, por data-ex) nos 12 meses anteriores ÷ preço bruto do dia. Proventos e preço sem ajuste.">
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 380px' }}>
          <div><div className="flex gap-4 text-[12px] pb-1"><span>DY 12m atual <b style={{ color: C.amber }}>{pf(cur, 2, false)}</b></span><span style={{ color: C.muted }}>média 10a {pf(avg, 2, false)}</span></div>
            <FnChart height={520} panes={[{ series: [{ kind: 'area', data: ser, color: C.amber, title: 'DY 12m', pct: true, lines: [{ price: avg, color: '#888', title: 'Média' }] }] }]} /></div>
          <Panel title="Por ano"><Grid cols={[{ k: 'y', label: 'Ano' }, { k: 'n', label: 'Nº', align: 'r' }, { k: 'tot', label: 'R$/ação', align: 'r', fmt: v => nf(v, 4) }, { k: 'end', label: 'Preço fim', align: 'r', fmt: (v: any) => nf(v) }, { k: 'dyEnd', label: 'DY fim', align: 'r', fmt: v => pf(v, 2, false), color: () => C.amber }, { k: 'dyAvg', label: 'DY méd.', align: 'r', fmt: v => pf(v, 2, false) }]} rows={yr} /></Panel>
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
    const rows = divs.map(([t, a]) => { const p = prev(t); return { ex: t, amt: a, px: p, y: p ? a / p * 100 : null, freq: 'Irregular', type: 'Dividendo/JCP' } })
    const relat = (d.filings as any[]).filter(f => /provento|dividend|juros sobre/i.test(f.cat + ' ' + f.subject)).slice(0, 40)
    const byY = new Map<string, number>(); divs.forEach(([t, a]) => byY.set(t.slice(0, 4), (byY.get(t.slice(0, 4)) || 0) + a))
    void px
    return (
      <FnScreen code="DVD" ticker={ticker} title="Dividend / Split History" tabs={['Histórico de proventos', 'Avisos na CVM (IPE)']} tab={tab} setTab={setTab} source={SRC_CVM}
        note="Yahoo fornece só data-ex e valor bruto por ação. Datas de declaração/registro/pagamento e o tipo (dividendo × JCP) estão nos avisos da CVM (aba 2), com link para o documento original.">
        {tab === 0 ? <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Panel title={`Proventos (${rows.length})`}><Grid maxH={560} cols={[{ k: 'ex', label: 'Data-ex', fmt: dBRfull }, { k: 'amt', label: 'Valor R$', align: 'r', fmt: v => nf(v, 6), color: () => C.amber }, { k: 'px', label: 'Preço ant.', align: 'r', fmt: (v: any) => nf(v) }, { k: 'y', label: 'Yield', align: 'r', fmt: v => pf(v, 2, false) }, { k: 'type', label: 'Tipo' }]} rows={rows} /></Panel>
          <Panel title="Total por ano (R$/ação)"><FnChart height={560} panes={[{ series: [{ kind: 'hist', data: Array.from(byY.entries()).sort().map(([y, v]) => ({ time: `${y}-12-31`, value: v })), color: C.amber, title: 'R$/ação', decimals: 3 }] }]} /></Panel>
        </div> : <Panel title="Avisos de proventos / reuniões"><Grid maxH={600} cols={[{ k: 'date', label: 'Data', fmt: dBRfull }, { k: 'cat', label: 'Categoria' }, { k: 'subject', label: 'Assunto', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.cyan }}>{v || r.type}</a> }]} rows={relat} /></Panel>}
      </FnScreen>)
  })()}</Guard>
}

export function SPLITView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  return <Guard code="SPLIT" ticker={ticker}>{!d ? <FnScreen code="SPLIT" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const sp = (d.splits_full as [string, number][]).slice().reverse()
    const raw = d.raw_close as [string, number][]
    const rows = sp.map(([t, r]) => ({ date: t, ratio: r, desc: r >= 1 ? `Desdobramento ${r >= 1 ? `1:${nf(r, r % 1 ? 2 : 0)}` : ''}` : `Grupamento ${nf(1 / r, 0)}:1`, factor: r }))
    const cum = sp.reduce((p, [, r]) => p * r, 1)
    const months = raw.filter((_, i) => i % 5 === 0)
    return (
      <FnScreen code="SPLIT" ticker={ticker} title="Desdobramentos / grupamentos" source={SRC_CVM} note="Eventos de split do Yahoo (razão = ações novas por ação antiga). Gráfico: preço bruto (como negociado) com marcadores nas datas dos eventos. Bonificações em ações também aparecem como split fracionário.">
        <div className="grid gap-2" style={{ gridTemplateColumns: '420px 1fr' }}>
          <Panel title={`Eventos (${rows.length})`}>
            {rows.length ? <Grid cols={[{ k: 'date', label: 'Data-ex', fmt: dBRfull }, { k: 'desc', label: 'Evento', color: () => C.amber }, { k: 'factor', label: 'Fator', align: 'r', fmt: v => nf(v, 4) }]} rows={rows} /> : <div className="p-2 text-[12px]" style={{ color: C.muted }}>Nenhum evento no histórico disponível.</div>}
            <KV rows={[['Fator acumulado', nf(cum, 4), C.amber], ['1 ação antes do 1º evento =', `${nf(cum, 2)} ações hoje`]]} />
          </Panel>
          <FnChart height={520} log panes={[{ series: [{ kind: 'line', data: months.map(([t, v]) => ({ time: t, value: v })), color: C.white, title: 'Preço bruto', markers: sp.filter(([t]) => months.length && t >= months[0][0]).map(([t, r]) => ({ time: months.find(m => m[0] >= t)?.[0] || t, text: r >= 1 ? `1:${nf(r, 2)}` : `G ${nf(1 / r, 0)}:1`, color: C.amber, position: 'aboveBar' as const, shape: 'arrowDown' as const })) }] }]} />
        </div>
      </FnScreen>)
  })()}</Guard>
}

// ---------------- CF / CN ----------------
export function CFView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const [cat, setCat] = useState('Todos'); const [q, setQ] = useState('')
  return <Guard code="CF" ticker={ticker}>{!d ? <FnScreen code="CF" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const cats = ['Todos', ...Array.from(new Set((d.filings as any[]).map(f => f.cat))).slice(0, 10)]
    const rows = (d.filings as any[]).filter(f => (cat === 'Todos' || f.cat === cat) && (!q || (f.subject + f.type).toLowerCase().includes(q.toLowerCase())))
    return (
      <FnScreen code="CF" ticker={ticker} title="Company Filings — documentos na CVM" right={<Field label="Busca"><input className={inputCls + ' w-48'} style={inputStyle} value={q} onChange={e => setQ(e.target.value)} /></Field>}
        source="CVM Dados Abertos – IPE (documentos periódicos e eventuais), links para o RAD/ENET." note="Equivalente brasileiro dos 10-K/10-Q/8-K: DFP/ITR, Fatos Relevantes, Comunicados, Atas. Últimos 400 documentos.">
        <div className="flex flex-wrap gap-0 pb-2">{cats.map(c => <button key={c} onClick={() => setCat(c)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: cat === c ? C.amber : 'transparent', color: cat === c ? '#000' : C.amber }}>{c.length > 34 ? c.slice(0, 32) + '…' : c}</button>)}</div>
        <Grid maxH={640} cols={[{ k: 'date', label: 'Data', fmt: dBRfull, w: '90px' }, { k: 'cat', label: 'Categoria', color: () => C.amber, w: '230px' }, { k: 'type', label: 'Tipo', color: () => C.muted, w: '220px' }, { k: 'subject', label: 'Assunto / documento', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: C.text }}>{v || r.type || r.cat}</a> }, { k: 'version', label: 'V', align: 'r', w: '30px' }]} rows={rows} />
      </FnScreen>)
  })()}</Guard>
}

export function CNView({ ticker }: { ticker: string }) {
  const { data: d, err } = useCorp(ticker)
  const news = useJSON<any>('news.json')
  return <Guard code="CN" ticker={ticker}>{!d ? <FnScreen code="CN" ticker={ticker}><Loading err={err} /></FnScreen> : (() => {
    const k = tickerKey(ticker), nm = (d.profile?.longName || '').split(/[ .-]/)[0]
    const fil = (d.filings as any[]).filter(f => /Fato Relevante|Comunicado|Aviso|Assembleia|Dados Econ/i.test(f.cat)).map(f => ({ date: f.date, src: f.cat === 'Fato Relevante' ? 'FATO REL' : 'CVM', title: f.subject || f.type, link: f.link, hot: f.cat === 'Fato Relevante' }))
    const nw = (news.data?.items || []).filter((n: any) => n.tags?.includes(k) || (nm.length > 3 && n.title.toLowerCase().includes(nm.toLowerCase()))).map((n: any) => ({ date: n.date.slice(0, 10), src: n.source.split('–')[0].trim(), title: n.title, link: n.link, hot: false }))
    const rows = [...nw, ...fil].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200)
    return (
      <FnScreen code="CN" ticker={ticker} title="Company News" source="CVM IPE (Fatos Relevantes, Comunicados ao Mercado, Avisos) + RSS de licença aberta (Agência Brasil, CC BY 4.0) filtrado pelo nome da empresa."
        note="Sem feed de agência de notícias pago: o fluxo é o noticiário regulatório oficial da empresa. Fatos Relevantes em destaque.">
        <Grid maxH={700} rowStyle={(r: any) => r.hot ? { background: '#1a1205' } : undefined} cols={[{ k: 'date', label: 'Data', fmt: dBR, w: '70px' }, { k: 'src', label: 'Fonte', w: '90px', color: (_, r: any) => r.hot ? C.down : C.amber }, { k: 'title', label: 'Manchete', fmt: (v, r: any) => <a href={r.link} target="_blank" rel="noreferrer" style={{ color: r.hot ? C.white : C.text, fontWeight: r.hot ? 700 : 400 }}>{v}</a> }]} rows={rows} />
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
        source={<>B3 COTAHIST diário (arquivo público de fechamento). Gregas/IV: {d.model}.</>}
        note="Snapshot de fechamento (não é tempo real). Bid/Ask = melhores ofertas no fechamento (0 = sem oferta). Linhas sombreadas = dentro do dinheiro. Strike central em âmbar = mais próximo do spot. Prazos com poucas séries são semanais.">
        <div className="flex flex-wrap gap-0 pb-2">{exps.map((x, i) => <button key={x.date} onClick={() => setEi(i)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: i === idx ? C.amber : 'transparent', color: i === idx ? '#000' : C.amber }}>{dBR(x.date)} ({x.bdays}du) [{x.calls.length + x.puts.length}]</button>)}</div>
        <div className="flex gap-6 text-[12px] pb-1"><span>Vencimento <b style={{ color: C.amber }}>{dBRfull(e.date)}</b></span><span>Volume calls R$ {big(cv)}</span><span>Volume puts R$ {big(pv)}</span><span>Put/Call (vol.) {nf(pv / (cv || 1), 2)}</span></div>
        <FitBox base={560} min={140} className="overflow-auto border" style={{ borderColor: C.line }}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead className="sticky top-0 z-10" style={{ background: C.bg }}>
              <tr style={{ background: C.panel2 }}><th colSpan={9} className="py-1 font-bold" style={{ color: C.up }}>CALLS</th><th className="py-1" style={{ color: C.amber }}>Strike</th><th colSpan={9} className="py-1 font-bold" style={{ color: C.down }}>PUTS</th></tr>
              <tr style={{ color: C.amber }}>{['Série', 'Bid', 'Ask', 'Últ', 'Neg', 'Vol R$', 'IV', 'Delta', 'Gama'].map(h => <th key={'c' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}<th></th>{['Bid', 'Ask', 'Últ', 'Neg', 'Vol R$', 'IV', 'Delta', 'Gama', 'Série'].map(h => <th key={'p' + h} className="px-1 py-[2px] text-right font-normal">{h}</th>)}</tr>
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
        <div className="text-[11px] pt-1" style={{ color: C.muted }}>Vol R$ em milhares. IV em % a.a.</div>
      </FnScreen>)
  })()}</Guard>
}
