'use client'
// VAL (valuation): múltiplos atuais, histórico de 3 anos e pares. Lógica pura em lib/val.mjs (testada).
// Valor de mercado da companhia (todas as classes), EBITDA dos EUA calculado (resultado operacional + D&A, marcado c),
// n.s. para bases negativas, referência de mercado com alerta de divergência, layout de banco, setores curados, pares por companhia.
import React, { useEffect, useMemo, useState } from 'react'
import { lang, numLocale } from '../../lib/settings'
import { FnScreen, Panel, Btns, Loading, C, MONO, short, useJSON, isoMinus, corpPath, dBRfull } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import { tc } from '../../lib/themeRuntime'
import { getJSON, href, tickerKey } from '../../lib/static'
import { covers, FUNCTION_UNIVERSE } from '../../lib/activeTicker.mjs'
import { sectorName, ebitdaOf, companyMcap, classOf, multiple, diverges, dedupePeers } from '../../lib/val.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const loc = () => (lang() === 'pt' ? 'pt-BR' : numLocale())
const fmt = (v: any, d = 2) => v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d })
const NM = () => L('n.m.', 'n.s.')
const mult = (v: any, d = 2) => v === 'nm' ? NM() : fmt(v, d)
const pct = (v: any, d = 2) => v === 'nm' ? NM() : v == null || !Number.isFinite(+v) ? '—' : `${fmt(v, d)}%`
/** valores grandes com moeda e sufixo no idioma: R$ 613,37 bi · US$ 3.55T */
const money = (v: any, cur: string) => {
  if (v == null || !Number.isFinite(+v)) return '—'
  const a = Math.abs(+v), s = +v < 0 ? '-' : '', pt = lang() === 'pt'
  const [div, suf] = a >= 1e12 ? [1e12, pt ? ' tri' : 'T'] : a >= 1e9 ? [1e9, pt ? ' bi' : 'B'] : a >= 1e6 ? [1e6, pt ? ' mi' : 'M'] : [1, '']
  return `${s}${cur} ${fmt(a / div, 2)}${suf}`
}
const VAL_U = () => ((FUNCTION_UNIVERSE as Record<string, string[]>).VAL || []).map(t => t.toUpperCase())

function useMedia(q: string) {
  const [m, setM] = useState(false)
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); f(); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f) }, [q])
  return m
}

type Corp = { t: string; d: any; cls: Record<string, [string, number][] | undefined>; kind: string | null }
/** carrega o corp do ticker e os preços das outras classes da mesma companhia que têm dados (sem pedir arquivos inexistentes) */
async function loadCorp(t: string, d0?: any): Promise<Corp | null> {
  const d = d0 || await getJSON<any>(`corp/${tickerKey(t)}.json`).catch(() => null)
  if (!d) return null
  const { base, kind } = classOf(t)
  const cls: Corp['cls'] = {}
  if (base && kind !== 'unit' && d.country !== 'US') {
    const u = VAL_U(), sib = [3, 4, 5, 6].map(n => `${base}${n}.SA`).filter(x => x !== t.toUpperCase() && u.includes(x))
    const pns = sib.filter(x => classOf(x).kind === 'pn')
    const want = sib.filter(x => classOf(x).kind === 'on' || pns.length === 1)   // várias classes PN (PNA/PNB): ambíguo, não soma
    await Promise.all(want.map(async x => { const s = await getJSON<any>(`corp/${tickerKey(x)}.json`).catch(() => null); if (s?.raw_close) cls[classOf(x).kind as string] = s.raw_close }))
  }
  return { t, d, cls, kind }
}

/** múltiplos atuais com a mesma metodologia para o ativo e os pares */
function valuation(c: Corp) {
  const d = c.d, us = d.country === 'US'
  const q = d.fundamentals.quarterly as any[], a = d.fundamentals.annual as any[]
  const last4 = q.slice(-4), fy = a[a.length - 1], lastQ = q[q.length - 1]
  let basis = L('LTM', '12m'), derived = false
  const val = (r: any, k: string) => k === 'ebitda' ? ebitdaOf(r).v : r?.[k]
  const ltm = (k: string) => {
    if (last4.length === 4 && last4.every(r => val(r, k) != null)) { if (k === 'ebitda') derived = last4.some(r => ebitdaOf(r).derived); return last4.reduce((s, r) => s + val(r, k), 0) }
    if (val(fy, k) != null && (!lastQ || fy.period >= isoMinus(lastQ.period, 0, 3, 1))) { basis = `FY${fy.period.slice(0, 4)}`; if (k === 'ebitda') derived = ebitdaOf(fy).derived; return val(fy, k) }
    return null
  }
  const px = d.raw_close[d.raw_close.length - 1] as [string, number]
  const mc = companyMcap(d.shares, px[0], { series: d.raw_close, kind: c.kind }, c.cls, us)
  const bs = q[q.length - 1] || a[a.length - 1]
  const net = ltm('net'), rev = ltm('revenue'), ebitda = ltm('ebitda')
  const divs12 = (d.dividends_full as [string, number][]).filter(x => x[0] > isoMinus(px[0], 0, 0, 1)).reduce((s, x) => s + x[1], 0)
  const mcap = mc.v
  const ev = mcap != null && bs?.netdebt != null ? mcap + bs.netdebt + (bs.minority || 0) : null
  return { px, mcap, mcReason: mc.reason, bs, net, rev, ebitda, ebitdaDerived: derived, ev, basis,
    pe: multiple(mcap, net), pb: multiple(mcap, bs?.equity), evEbitda: ev == null || ebitda == null ? null : ebitda <= 0 || ev < 0 ? 'nm' as const : ev / ebitda,
    dy: divs12 ? (divs12 / px[1]) * 100 : null,
    roe: net != null && bs?.equity ? (bs.equity > 0 ? (net / bs.equity) * 100 : 'nm') : null,
    margin: net != null && rev ? (rev > 0 ? (net / rev) * 100 : 'nm') : null,
    ndEbitda: bs?.netdebt != null && ebitda != null ? (ebitda > 0 ? bs.netdebt / ebitda : 'nm') : null }
}
type V = ReturnType<typeof valuation>

function VALNoData({ ticker }: { ticker: string }) {
  const u = (FUNCTION_UNIVERSE as Record<string, string[]>).VAL || []
  const ex = u.filter(t => t.endsWith('.SA')).slice(0, 5).concat(u.filter(t => !t.endsWith('.SA')).slice(0, 2))
  const a = (p: string, l: string) => <a className="underline mr-3 inline-block" style={{ color: C.amber }} href={href(p)}>{l}</a>
  return (
    <FnScreen code="VAL" ticker={ticker} title={L('Valuation', 'Valuation')}>
      <div className="p-4 text-[13px] max-w-[760px]" style={{ fontFamily: MONO }} data-val-nodata>
        <div style={{ color: C.white }}>{L('No valuation multiples for', 'Sem múltiplos de valuation para')} <span style={{ color: C.amber }}>{short(ticker)}</span>.</div>
        <div className="mt-2" style={{ color: C.muted }}>{L(
          `Multiples (P/E, P/B, EV/EBITDA, dividend yield) need a company's financial statements and share count; they are available for Brazilian stocks and a set of US stocks (${u.length} assets). Funds, ETFs, indexes, currencies and crypto have no earnings or book value of their own, and some covered US companies are not yet included. For this asset, see:`,
          `Os múltiplos (P/L, P/VP, EV/EBITDA, dividend yield) dependem das demonstrações financeiras e do número de ações de uma companhia; estão disponíveis para ações brasileiras e um conjunto de ações dos EUA (${u.length} ativos). Fundos, ETFs, índices, moedas e cripto não têm lucro nem patrimônio próprios, e algumas empresas americanas cobertas ainda não estão incluídas. Para este ativo, veja:`)}</div>
        <div className="mt-3">
          {covers('DES', ticker) && a(`/des/${ticker}/`, L(`DES — description of ${short(ticker)}`, `DES — descrição de ${short(ticker)}`))}
          {covers('DVD', ticker) && a(`/dvd/${ticker}/`, L(`DVD — distributions of ${short(ticker)}`, `DVD — proventos de ${short(ticker)}`))}
          {a(`/gp/${ticker}/`, L(`GP — price chart for ${short(ticker)}`, `GP — gráfico de preço de ${short(ticker)}`))}
        </div>
        {ex.length > 0 && <div className="mt-4" style={{ color: C.muted }}>{L('Examples with multiples:', 'Exemplos com múltiplos:')} {ex.map(t => <a key={t} className="underline mr-2" style={{ color: C.amber }} href={href(`/val/${t}/`)}>{short(t)}</a>)}</div>}
      </div>
    </FnScreen>
  )
}

export function VALView({ ticker }: { ticker: string }) {
  if (!covers('VAL', ticker)) return <VALNoData ticker={ticker} />
  return <VALBody ticker={ticker} />
}

const Sup = ({ c, title }: { c: string; title: string }) => <sup title={title} style={{ color: C.muted, marginLeft: 2, fontSize: 9 }}>{c}</sup>

function VALBody({ ticker }: { ticker: string }) {
  const T = ticker.toUpperCase()
  const us = !T.endsWith('.SA')
  const { data: d, err } = useJSON<any>(corpPath(ticker))
  const { data: sc } = useJSON<any>(us ? 'screener_us.json' : 'screener.json')
  const [me, setMe] = useState<Corp | null>(null)
  const [peers, setPeers] = useState<Corp[]>([])
  const [metric, setMetric] = useState<'pe' | 'pb' | 'dy'>('pe')
  const wide = useMedia('(min-width: 768px)')
  useEffect(() => { let ok = true; if (d) loadCorp(T, d).then(c => { if (ok) setMe(c) }); return () => { ok = false } }, [d, T])
  const tk = (r: any) => us ? String(r.cod) : `${r.cod}.SA`
  const row = sc ? (sc.rows as any[]).find(r => tk(r) === T) : null
  const coKey = (r: any) => us ? r.cik : r.cnpj
  const [peerSector, setPeerSector] = useState('')
  useEffect(() => {
    if (!sc) return
    const all = sc.rows as any[], u = VAL_U(), mine = row ? coKey(row) : null
    const pick = (k: 'subsector' | 'sector') => row ? all.filter(r => row[k] && r[k] === row[k] && tk(r) !== T && (!mine || coKey(r) !== mine) && u.includes(tk(r))) : []
    let list = pick('subsector'), label = row?.subsector || ''
    if (dedupePeers(list, coKey, (r: any) => r.vol_fin_avg30 ?? r.mcap).length < 2) { list = pick('sector'); label = row?.sector || '' }
    if (!row) { list = all.filter(r => (us ? ['AAPL', 'MSFT', 'GOOGL', 'AMZN'] : ['PETR4', 'VALE3', 'ITUB4', 'B3SA3']).includes(r.cod) && tk(r) !== T); label = '' }
    const top = dedupePeers(list, coKey, (r: any) => r.vol_fin_avg30 ?? r.mcap).sort((a, b) => (b.mcap || 0) - (a.mcap || 0)).slice(0, 5).map(tk)
    let ok = true
    Promise.all(top.map(t => loadCorp(t))).then(r => { if (ok) { setPeers(r.filter(Boolean) as Corp[]); setPeerSector(label) } })
    return () => { ok = false }
  }, [sc, T]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = useMemo(() => me ? valuation(me) : null, [me])
  const bank = !!row?.bank || (!!v && v.bs?.ebit == null && v.bs?.netdebt == null && v.ebitda == null)
  const hist = useMemo(() => {
    if (!me || !v) return { ser: [] as { time: string; value: number }[], marks: [] as any[], start: '' }
    const dd = me.d, q = dd.fundamentals.quarterly as any[], from = isoMinus(v.px[0], 0, 0, 3)
    const pts = (dd.raw_close as [string, number][]).filter(x => x[0] >= from).map(([t, px]) => {
      const avail = q.filter(r => isoMinus(r.period, -45) <= t)
      const l4 = avail.slice(-4), bs = avail[avail.length - 1]
      const net = l4.length === 4 && l4.every(r => r.net != null) ? l4.reduce((s, r) => s + r.net, 0) : null
      const dv = (dd.dividends_full as [string, number][]).filter(x => x[0] <= t && x[0] > isoMinus(t, 0, 0, 1)).reduce((s, x) => s + x[1], 0)
      const mc = companyMcap(dd.shares, t, { series: dd.raw_close, kind: me.kind }, me.cls, dd.country === 'US').v
      return { time: t, pe: mc != null && net != null && net > 0 ? mc / net : null, pb: mc != null && bs?.equity > 0 ? mc / bs.equity : null, dy: dv ? dv / px * 100 : null }
    })
    const ser = pts.filter(h => h[metric] != null).map(h => ({ time: h.time, value: h[metric] as number }))
    const qlab = (p: string) => { const m = +p.slice(5, 7), y = p.slice(2, 4), n = Math.ceil(m / 3); return lang() === 'pt' ? `${n}T${y}` : `Q${n} ${y}` }
    const marks = metric === 'dy' || !ser.length ? [] : q.map(r => ({ r, t: isoMinus(r.period, -45) })).filter(x => x.t > ser[0].time && x.t <= ser[ser.length - 1].time)
      .map(x => ({ time: ser.find(s => s.time >= x.t)?.time || x.t, text: qlab(x.r.period), color: tc('#7189aa'), position: 'belowBar' as const, shape: 'circle' as const }))
    return { ser, marks, start: ser[0]?.time || '', from }
  }, [me, v, metric])

  if (!d || !me || !v) return <FnScreen code="VAL" ticker={ticker}><Loading err={err} /></FnScreen>
  const ys = d.yahoo_stats || {}, cur = us ? 'US$' : 'R$', pt = lang() === 'pt'
  const avg = hist.ser.reduce((s, x) => s + x.value, 0) / (hist.ser.length || 1)
  const cTip = L('calculated: operating income + depreciation & amortization', 'calculado: resultado operacional + depreciação e amortização')
  const mcNote = v.mcReason === 'unit' ? L('not calculated: the unit\'s underlying share classes have no official price', 'não calculado: as classes de ações que compõem a unit não têm preço oficial')
    : v.mcReason === 'class' ? L('not calculated: price of another share class unavailable', 'não calculado: preço de outra classe de ações indisponível') : ''
  type R = { l: React.ReactNode; v: string; y: string; a?: any; b?: any; key: string }
  const rows: R[] = [
    { key: 'px', l: L('Last price (unadjusted)', 'Último preço (sem ajuste)'), v: `${cur} ${fmt(v.px[1])}`, y: '—' },
    { key: 'mc', l: L('Market cap (company)', 'Valor de mercado (companhia)'), v: money(v.mcap, cur), y: money(ys.marketCap, cur), a: v.mcap, b: ys.marketCap },
    ...(bank ? [] : [{ key: 'ev', l: L('Enterprise value (EV)', 'Valor da firma (EV)'), v: money(v.ev, cur), y: '—' }]),
    { key: 'pe', l: `${L('P/E', 'P/L')} ${v.basis}`, v: mult(v.pe), y: mult(ys.trailingPE), a: v.pe, b: ys.trailingPE },
    { key: 'pb', l: L('P/B', 'P/VP'), v: mult(v.pb), y: mult(ys.priceToBook), a: v.pb, b: ys.priceToBook },
    ...(bank ? [] : [{ key: 'eve', l: <>EV/EBITDA {v.basis}{v.ebitdaDerived && <Sup c="c" title={cTip} />}</>, v: mult(v.evEbitda), y: mult(ys.enterpriseToEbitda), a: v.evEbitda, b: ys.enterpriseToEbitda }]),
    { key: 'dy', l: L('Dividend yield 12m', 'Dividend yield 12m'), v: pct(v.dy), y: pct(ys.dividendYield), a: v.dy, b: ys.dividendYield },
    { key: 'roe', l: `ROE ${v.basis}`, v: pct(v.roe, 1), y: '—' },
    { key: 'mg', l: L('Net margin', 'Margem líquida'), v: pct(v.margin, 1), y: '—' },
    ...(bank ? [] : [{ key: 'nd', l: <>{L('Net debt/EBITDA', 'Dív. líquida/EBITDA')}{v.ebitdaDerived && <Sup c="c" title={cTip} />}</>, v: mult(v.ndEbitda), y: '—' }]),
  ]
  const divTip = L('differs by more than 20% from the market reference (different share count, period or criteria)', 'difere em mais de 20% da referência de mercado (número de ações, período ou critério diferentes)')
  const th = 'px-2 py-[3px] font-normal'
  const peerRows = [me, ...peers].map(c => ({ c, v: c === me ? v : valuation(c) }))
  const pcols: { k: keyof V | 't'; l: string; f: (x: V) => string }[] = [
    { k: 'mcap', l: L('Mkt cap', 'Valor merc.'), f: x => money(x.mcap, cur) },
    { k: 'pe', l: L('P/E', 'P/L'), f: x => mult(x.pe) },
    { k: 'pb', l: L('P/B', 'P/VP'), f: x => mult(x.pb) },
    ...(bank ? [] : [{ k: 'evEbitda' as const, l: 'EV/EBITDA', f: (x: V) => mult(x.evEbitda) }]),
    { k: 'dy', l: 'DY', f: x => pct(x.dy) },
    { k: 'roe', l: 'ROE', f: x => pct(x.roe, 1) },
    { k: 'margin', l: L('Net mg.', 'Mg. líq.'), f: x => pct(x.margin, 1) },
  ]
  const sector = sectorName(peerSector, pt)
  const lateStart = hist.start && hist.start > isoMinus((hist as any).from, -45)
  const note = <>
    {L('Market cap = price of each share class × its shares, summed for the company (treasury shares deducted pro rata); units use the equivalent number of shares; US: shares outstanding of all classes × price. ',
      'Valor de mercado = preço de cada classe × suas ações, somado para a companhia (ações em tesouraria descontadas pro rata); units usam o número equivalente de ações; EUA: ações em circulação de todas as classes × preço. ')}
    {L(`Multiples use the last 4 quarters (or the latest fiscal year, shown as FYyyyy). Market ref. = an independent market-data reference shown for cross-checking; it uses its own share count and periods (often one share class only), so ⚠ marks differences above 20%. `,
      `Os múltiplos usam os últimos 4 trimestres (ou o último exercício, indicado como FYaaaa). Ref. de mercado = uma referência independente de dados de mercado, para conferência; ela usa seu próprio número de ações e períodos (muitas vezes só uma classe), por isso ⚠ marca diferenças acima de 20%. `)}
    {L('c = calculated (EBITDA = operating income + depreciation & amortization) when not reported; — when a part is missing. n.m. = not meaningful (negative or zero base). ',
      'c = calculado (EBITDA = resultado operacional + depreciação e amortização) quando não informado; — quando falta uma parte. n.s. = não significativo (base negativa ou zero). ')}
    {bank && L('Financial institution: EV and EBITDA-based multiples do not apply and are omitted. ', 'Instituição financeira: EV e múltiplos baseados em EBITDA não se aplicam e foram omitidos. ')}
    {L('History: at each date the multiple uses the results already published, assumed 45 days after quarter end; the markers show when each quarter enters, which explains the steps in the line.',
      'Histórico: em cada data o múltiplo usa os resultados já publicados, supostos 45 dias após o fim do trimestre; os marcadores mostram quando cada trimestre entra, o que explica os degraus da linha.')}
  </>
  return (
    <FnScreen code="VAL" ticker={ticker} title={L('Valuation — multiples and history', 'Valuation — múltiplos e histórico')} note={note}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '340px 1fr' }}>
        <Panel title={L('Current multiples', 'Múltiplos atuais')} asOf={v.px[0]}>
          <table className="w-full border-collapse text-[12px]" style={{ fontFamily: MONO }} data-val-table="cur">
            <thead><tr style={{ color: C.amber }}><th className={`${th} text-left`}>{L('Indicator', 'Indicador')}</th><th className={`${th} text-right`}>{L('Value', 'Valor')}</th><th className={`${th} text-right`} title={L('Independent market-data reference, for cross-checking', 'Referência independente de dados de mercado, para conferência')}>{L('Market ref.', 'Ref. mercado')}</th></tr></thead>
            <tbody>{rows.map(r => { const flag = diverges(r.a, r.b)
              return <tr key={r.key} className="border-t" style={{ borderColor: C.line }} data-val-row={r.key}>
                <td className="px-2 py-[3px]" style={{ color: C.text }}>{r.l}</td>
                <td className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: C.amber }} title={r.key === 'mc' && mcNote ? mcNote : undefined}>{r.v}</td>
                <td className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: C.muted }}>{flag && <span data-val-diverge title={divTip} style={{ color: C.amber, marginRight: 4 }}>⚠</span>}{r.y}</td>
              </tr> })}</tbody>
          </table>
          {mcNote && <div className="px-2 py-1 text-[11px]" style={{ color: C.muted }} data-val-mcnote>{L('Market cap', 'Valor de mercado')}: {mcNote}.</div>}
        </Panel>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 pb-1 text-[12px]">
            <span style={{ color: C.amber }}>{L('3-year history', 'Histórico de 3 anos')}</span>
            <Btns opts={[{ v: 'pe', l: L('P/E', 'P/L') }, { v: 'pb', l: L('P/B', 'P/VP') }, { v: 'dy', l: 'DY %' }]} value={metric} onChange={setMetric as any} />
            {hist.ser.length > 0 && <span style={{ color: C.muted }}>{L('period average', 'média do período')} {fmt(avg)}</span>}
          </div>
          {hist.ser.length ? <FnChart height={330} panes={[{ series: [{ kind: 'line', data: hist.ser, color: C.amber, title: metric === 'pe' ? L('P/E', 'P/L') : metric === 'pb' ? L('P/B', 'P/VP') : 'DY %', markers: hist.marks, lines: [{ price: avg, color: tc('#888'), title: L('Average', 'Média') }] }] }]} />
            : <div className="p-3 text-[12px]" style={{ color: C.muted }}>{L('No history for this multiple (results or prices missing).', 'Sem histórico para este múltiplo (faltam resultados ou preços).')}</div>}
          {lateStart && <div className="text-[11px] pt-1" style={{ color: C.muted }} data-val-histstart>{L(`Starts on ${dBRfull(hist.start)}: first date with 4 published quarters (or results/distributions) available.`, `Começa em ${dBRfull(hist.start)}: primeira data com 4 trimestres publicados (ou resultados/proventos) disponíveis.`)}</div>}
        </div>
      </div>
      <div className="mt-2"><Panel title={`${L('Peer comparison (same methodology)', 'Comparação com pares (mesma metodologia)')}${sector ? ` — ${sector}` : ''}`}>
        {!wide && <div className="px-2 py-1 text-[11px]" style={{ color: C.muted }} data-val-scrollhint>{L('Swipe sideways to see all columns →', 'Deslize para o lado para ver todas as colunas →')}</div>}
        <div className="overflow-x-auto" style={{ overscrollBehaviorX: 'contain' }}>
          <table className="border-collapse text-[12px] w-full" style={{ fontFamily: MONO, minWidth: bank ? 520 : 600 }} data-val-table="peers">
            <thead><tr style={{ color: C.amber }}><th className={`${th} text-left sticky left-0 z-10`} style={{ background: C.panel }}>{L('Ticker', 'Ativo')}</th>{pcols.map(c => <th key={String(c.k)} className={`${th} text-right whitespace-nowrap`}>{c.l}</th>)}</tr></thead>
            <tbody>{peerRows.map(({ c, v: x }) => <tr key={c.t} className="border-t" style={{ borderColor: C.line }} data-val-peer={short(c.t)}>
              <td className="px-2 py-[3px] sticky left-0 z-10" style={{ color: c === me ? C.amber : C.text, background: C.panel }}>{short(c.t)}</td>
              {pcols.map(col => <td key={String(col.k)} className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: C.text }}>{col.f(x)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </Panel></div>
    </FnScreen>
  )
}
