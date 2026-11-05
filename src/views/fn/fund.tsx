'use client'
// FUND (Company Fundamentals): demonstrações resumidas. Lógica em lib/fund.mjs (testada); aqui só a apresentação:
// períodos do mais recente ao mais antigo (TTM e YoY primeiro), coluna de rótulos fixa, linhas vazias ocultas, layout de banco.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { lang, numLocale } from '../../lib/settings'
import { FnScreen, Btns, Loading, C, MONO, short, useJSON, corpPath } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import { href } from '../../lib/static'
import { covers, FUNCTION_UNIVERSE } from '../../lib/activeTicker.mjs'
import { prepare, ttm, ratios, yoy, isOneOff, splitRows, type FRow } from '../../lib/fund.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const loc = () => (lang() === 'pt' ? 'pt-BR' : numLocale())
const fmt = (v: any, d: number) => v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (v: number | null) => v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, 1)}%`

type Def = [key: string, en: string, pt: string, bold?: boolean]
const INC: Def[] = [['revenue', 'Net revenue', 'Receita líquida'], ['gross', 'Gross profit', 'Lucro bruto'], ['ebit', 'EBIT', 'EBIT'], ['da', 'D&A', 'D&A'], ['ebitda', 'EBITDA', 'EBITDA'], ['fin', 'Financial result', 'Resultado financeiro'], ['pretax', 'Pre-tax income', 'Lucro antes do IR'], ['net', 'Net income', 'Lucro líquido', true]]
const INC_BANK: Def[] = [['revenue', 'Financial intermediation income', 'Receitas da intermediação financeira'], ['gross', 'Gross financial intermediation result', 'Resultado bruto da intermediação financeira'], ['net', 'Net income', 'Lucro líquido', true]]
const BALS: Def[] = [['assets', 'Total assets', 'Ativo total'], ['cash', 'Cash and equivalents', 'Caixa e equivalentes'], ['stinv', 'Financial investments', 'Aplicações financeiras'], ['debt', 'Gross debt', 'Dívida bruta'], ['netdebt', 'Net debt', 'Dívida líquida', true], ['minority', 'Non-controlling interests', 'Participação de não controladores'], ['equity', "Shareholders' equity", 'Patrimônio líquido', true]]
const CFS: Def[] = [['cfo', 'Operating cash flow', 'Caixa operacional'], ['capex', 'Capex (PP&E + intangibles)', 'Capex (imobilizado + intangível)'], ['fcf', 'Free cash flow', 'Fluxo de caixa livre', true]]
const RAT = (per: 'a' | 'q'): Def[] => [['mge', 'EBITDA margin %', 'Margem EBITDA %'], ['mg', 'Net margin %', 'Margem líquida %'],
  ['roe', per === 'q' ? 'ROE % (quarter, annualised ×4)' : 'ROE %', per === 'q' ? 'ROE % (trimestre anualizado ×4)' : 'ROE %'],
  ...(per === 'q' ? [['roeTtm', 'ROE % (TTM)', 'ROE % (12 meses)', true] as Def] : []), ['lev', 'Net debt / Equity', 'Dív. líquida / PL']]
const BANK_SKIP = new Set(['ebit', 'da', 'ebitda', 'fin', 'pretax', 'cash', 'stinv', 'debt', 'netdebt', 'minority', 'mge', 'lev', 'cfo', 'capex', 'fcf'])

function useMedia(q: string) {
  const [m, setM] = useState(false)
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); f(); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f) }, [q])
  return m
}

function FUNDNoData({ ticker }: { ticker: string }) {
  const u = (FUNCTION_UNIVERSE as Record<string, string[]>).FUND || []
  const ex = u.filter(t => t.endsWith('.SA')).slice(0, 5).concat(u.filter(t => !t.endsWith('.SA')).slice(0, 2))
  const a = (p: string, l: string) => <a className="underline mr-3 inline-block" style={{ color: C.amber }} href={href(p)}>{l}</a>
  return (
    <FnScreen code="FUND" ticker={ticker} title={L('Company Fundamentals', 'Fundamentos da empresa')}>
      <div className="p-4 text-[13px] max-w-[760px]" style={{ fontFamily: MONO }} data-fund-nodata>
        <div style={{ color: C.white }}>{L('No financial statements for', 'Sem demonstrações financeiras para')} <span style={{ color: C.amber }}>{short(ticker)}</span>.</div>
        <div className="mt-2" style={{ color: C.muted }}>{L(
          `Income statement, balance sheet and cash flow are available for listed companies: Brazilian stocks and a set of US stocks (${u.length} assets). Funds, ETFs, indexes, currencies and crypto do not publish company financial statements. For this asset, see:`,
          `DRE, balanço e fluxo de caixa estão disponíveis para companhias abertas: ações brasileiras e um conjunto de ações dos EUA (${u.length} ativos). Fundos, ETFs, índices, moedas e cripto não publicam demonstrações de empresa. Para este ativo, veja:`)}</div>
        <div className="mt-3">
          {covers('DES', ticker) && a(`/des/${ticker}/`, L(`DES — description of ${short(ticker)}`, `DES — descrição de ${short(ticker)}`))}
          {a(`/gp/${ticker}/`, L(`GP — price chart for ${short(ticker)}`, `GP — gráfico de preço de ${short(ticker)}`))}
          {covers('CF', ticker) && a(`/cf/${ticker}/`, L(`CF — filings of ${short(ticker)}`, `CF — documentos de ${short(ticker)}`))}
        </div>
        {ex.length > 0 && <div className="mt-4" style={{ color: C.muted }}>{L('Examples with statements:', 'Exemplos com demonstrações:')} {ex.map(t => <a key={t} className="underline mr-2" style={{ color: C.amber }} href={href(`/fund/${t}/`)}>{short(t)}</a>)}</div>}
      </div>
    </FnScreen>
  )
}

export function FUNDView({ ticker }: { ticker: string }) {
  if (!covers('FUND', ticker)) return <FUNDNoData ticker={ticker} />
  return <FUNDBody ticker={ticker} />
}

function FUNDBody({ ticker }: { ticker: string }) {
  const { data: d, err } = useJSON<any>(corpPath(ticker))
  const [tab, setTab] = useState(0)
  const [per, setPer] = useState<'a' | 'q'>('a')
  const wide = useMedia('(min-width: 768px)')
  const scRef = useRef<HTMLDivElement | null>(null)
  const [moreRight, setMoreRight] = useState(false)
  const pt = lang() === 'pt'

  const base = useMemo(() => d?.fundamentals ? prepare(d.fundamentals) : null, [d])
  const view = useMemo(() => {
    if (!base) return null
    const rows = per === 'a' ? base.annual : base.quarterly
    const t = ttm(base.quarterly)
    const chrono = ratios(t ? [...rows, t] : rows, per)
    const periods = chrono.filter(r => !r._ttm)
    const tt = chrono.find(r => r._ttm) || null
    return { periods, tt, newest: [...periods].reverse() }
  }, [base, per])

  useEffect(() => {
    const el = scRef.current; if (!el) return
    const f = () => setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
    f(); el.addEventListener('scroll', f); window.addEventListener('resize', f)
    return () => { el.removeEventListener('scroll', f); window.removeEventListener('resize', f) }
  }, [view, tab])

  if (!d || !base || !view) return <FnScreen code="FUND" ticker={ticker}><Loading err={err} /></FnScreen>
  const us = d.country === 'US', bank = base.bank
  const cur = us ? 'US$' : 'R$', mn = `${cur} ${L('mn', 'mi')}`, bn = `${cur} ${L('bn', 'bi')}`
  const isRatio = tab === 3
  let defs: Def[] = [bank && !us ? INC_BANK : INC, BALS, CFS, RAT(per)][tab]
  if (bank) defs = defs.filter(x => !BANK_SKIP.has(x[0]))
  const cols = [...(view.tt ? [view.tt] : []), ...view.newest]
  const { shown, hidden } = splitRows(defs, cols)
  const lbl = (p: string) => per === 'a' ? p.slice(0, 4) : `${L('Q', 'T')}${Math.ceil(+p.slice(5, 7) / 3)}'${p.slice(2, 4)}`
  const label = (x: Def) => pt ? x[2] : x[1]
  const showYoy = !isRatio && view.newest.length > 0
  const oneOff = view.periods.filter(r => tab === 0 || tab === 3 ? isOneOff(r) : false)
  const anyDerived = cols.some(c => shown.some(x => (c._d || []).includes(x[0])))
  const cell = (r: FRow, k: string) => {
    const v = r[k]; const der = (r._d || []).includes(k)
    const txt = v == null || !Number.isFinite(+v) ? '—' : isRatio ? fmt(v, k === 'lev' ? 2 : 1) : fmt(v / 1e6, 0)
    return <span title={der ? L('Calculated from reported lines (see note)', 'Calculado a partir de linhas informadas (ver nota)') : v == null ? L('Not reported', 'Não informado') : undefined}>{txt}{der && <sup data-fund-derived style={{ color: C.muted }}> c</sup>}</span>
  }
  const stickyBg = '#0b0b0b'
  const th = 'px-2 py-1 text-right font-normal whitespace-nowrap'

  // gráfico por aba (cronológico, R$/US$ bi ou %)
  const P = view.periods
  const ser = (k: string, kind: 'hist' | 'line', color: string, title: string, div = 1e9) =>
    ({ kind, data: P.filter(r => r[k] != null && Number.isFinite(+r[k])).map(r => ({ time: r.period, value: r[k] / div })), color, title, decimals: div === 1 ? 1 : 1 })
  const chartDefs = [
    [ser('revenue', 'hist', C.amber, bank && !us ? L('Fin. intermediation income', 'Receitas de intermediação') : L('Revenue', 'Receita')), ...(bank ? [] : [ser('ebitda', 'line', C.blue, 'EBITDA')]), ser('net', 'line', C.white, L('Net income', 'Lucro líquido'))],
    bank ? [ser('equity', 'hist', C.amber, L('Equity', 'Patrimônio líquido'))] : [ser('equity', 'line', C.white, L('Equity', 'Patrimônio líquido')), ser('netdebt', 'line', C.down, L('Net debt', 'Dívida líquida'))],
    [ser('cfo', 'hist', C.amber, L('Operating cash flow', 'Caixa operacional')), ser('capex', 'line', C.down, 'Capex'), ser('fcf', 'line', C.white, L('Free cash flow', 'FCL'))],
    [...(bank ? [] : [ser('mge', 'line', C.blue, L('EBITDA margin', 'Margem EBITDA'), 1)]), ser('mg', 'line', C.amber, L('Net margin', 'Margem líquida'), 1), ser(per === 'q' ? 'roeTtm' : 'roe', 'line', C.white, per === 'q' ? L('ROE (TTM)', 'ROE (12m)') : 'ROE', 1)],
  ][tab].filter(s => s.data.length > 0)
  const chartTitle = [bank ? L(`Income and net income (${bn})`, `Receitas e lucro líquido (${bn})`) : L(`Revenue, EBITDA and net income (${bn})`, `Receita, EBITDA e lucro (${bn})`), bank ? L(`Shareholders' equity (${bn})`, `Patrimônio líquido (${bn})`) : L(`Equity and net debt (${bn})`, `Patrimônio e dívida líquida (${bn})`),
    L(`Cash flow (${bn})`, `Fluxo de caixa (${bn})`), L(bank ? 'Net margin and ROE (%)' : 'Margins and ROE (%)', bank ? 'Margem líquida e ROE (%)' : 'Margens e ROE (%)')][tab]

  const note = <>
    {pt ? (us ? 'Demonstrações consolidadas (US GAAP) dos relatórios anuais e trimestrais (10-K/10-Q). O fluxo de caixa trimestral é a diferença entre acumulados do ano; 4º tri = exercício − 9 meses. As colunas usam o trimestre civil em que termina o período fiscal.'
      : `Demonstrações ${base.annual.length && d.fundamentals.basis === 'individual' ? 'individuais (a empresa não publica consolidado)' : 'consolidadas'} das DFP (anual) e ITR (trimestral). 4º tri = anual − 9 meses acumulados.`)
      : (us ? 'Consolidated statements (US GAAP) from the annual and quarterly reports (10-K/10-Q). Quarterly cash flow = difference between year-to-date figures; Q4 = fiscal year − 9 months. Columns use the calendar quarter in which the fiscal period ends.'
      : `${d.fundamentals.basis === 'individual' ? 'Parent-only statements (the company does not publish consolidated ones)' : 'Consolidated statements'} from the annual (DFP) and quarterly (ITR) filings. Q4 = annual − 9-month year-to-date.`)}
    {' '}{L(`Values in ${mn}. EBITDA = EBIT + D&A. TTM = sum of the last 4 quarters (balances: latest quarter). YoY = latest period vs. the same period one year earlier.`, `Valores em ${mn}. EBITDA = EBIT + D&A. 12m = soma dos últimos 4 trimestres (saldos: último trimestre). A/A = último período contra o mesmo período do ano anterior.`)}
  </>
  const remarks = <>
    {bank && <> {L('Bank: financial-institution layout — EBIT, EBITDA, debt and the cash-flow lines used here do not apply to banks, so they are not shown.', 'Banco: layout de instituição financeira — EBIT, EBITDA, dívida e as linhas de caixa usadas aqui não se aplicam a bancos e não são exibidos.')}</>}
    {hidden.length > 0 && <> {L(`Not reported by the company in this layout (hidden): ${hidden.map(label).join(', ')}.`, `Não informado pela empresa neste layout (oculto): ${hidden.map(label).join(', ')}.`)}</>}
    {anyDerived && <> {L('c = calculated from reported lines: gross profit = revenue − cost of revenue; yearly D&A = sum of the 4 reported quarters (then EBITDA = EBIT + D&A).', 'c = calculado a partir de linhas informadas: lucro bruto = receita − custo; D&A anual = soma dos 4 trimestres informados (e EBITDA = EBIT + D&A).')}</>}
    {oneOff.length > 0 && <> {L(`⚑ ${oneOff.map(r => lbl(r.period)).join(', ')}: pre-tax income ≥ 1.5× EBIT — a large non-operating gain (e.g. sale or revaluation of investments); margins and ROE for that period are not representative.`, `⚑ ${oneOff.map(r => lbl(r.period)).join(', ')}: lucro antes do IR ≥ 1,5× EBIT — ganho não operacional relevante (ex.: venda ou reavaliação de participações); margens e ROE desse período não são representativos.`)}</>}
  </>
  const hasRemarks = bank || hidden.length > 0 || anyDerived || oneOff.length > 0

  return (
    <FnScreen code="FUND" ticker={ticker} asOf={P.length ? P[P.length - 1].period : null} title={L('Fundamentals — financial statements', 'Fundamentos — demonstrações financeiras')}
      tabs={[L('Income Statement', 'DRE'), L('Balance Sheet', 'Balanço'), L('Cash Flow', 'Fluxo de caixa'), L('Ratios', 'Indicadores')]} tab={tab} setTab={setTab}
      right={<Btns opts={[{ v: 'a', l: L('Yearly', 'Anual') }, { v: 'q', l: L('Quarterly', 'Trimestral') }] as any} value={per} onChange={setPer as any} />} note={<>{note}{remarks}</>}>
      {shown.length === 0 ? <div className="p-3 text-[12px]" style={{ color: C.muted }} data-fund-empty>{L('The company does not report these lines.', 'A empresa não informa estas linhas.')}</div> : <>
        <div className="relative">
          <div ref={scRef} className="overflow-x-auto border" style={{ borderColor: C.line }} data-fund-table-wrap>
            <table className="border-collapse text-[12px]" style={{ width: wide ? '100%' : 'max-content', fontFamily: MONO }} data-fund-table>
              <thead><tr style={{ background: C.panel2 }}>
                <th className="px-2 py-1 text-left font-normal" style={{ color: C.amber, position: 'sticky', left: 0, background: C.panel2, zIndex: 1, minWidth: wide ? 180 : 112 }}>{isRatio ? '' : mn}</th>
                {view.tt && <th className={th} style={{ color: C.white }} title={L('Last 4 quarters', 'Últimos 4 trimestres')} data-fund-col="ttm">{L('TTM', '12m')}</th>}
                {showYoy && <th className={th} style={{ color: C.white }} title={L(`${lbl(view.newest[0].period)} vs. one year earlier`, `${lbl(view.newest[0].period)} contra um ano antes`)} data-fund-col="yoy">{L('YoY', 'A/A')}</th>}
                {view.newest.map(r => <th key={r.period} className={th} style={{ color: C.amber }} data-fund-col={r.period}>{lbl(r.period)}{isOneOff(r) && (tab === 0 || tab === 3) && <span data-fund-oneoff title={L('Large non-operating gain (see note)', 'Ganho não operacional relevante (ver nota)')} style={{ color: C.down }}> ⚑</span>}</th>)}
              </tr></thead>
              <tbody>{shown.map(x => {
                const [k, , , bold] = x
                const y = showYoy ? yoy(view.periods, k) : null
                return <tr key={k} className="border-t" style={{ borderColor: '#1a1a1a' }} data-fund-row={k}>
                  <td className="px-2 py-[3px] leading-tight" style={{ fontWeight: bold ? 700 : 400, position: 'sticky', left: 0, background: stickyBg, zIndex: 1, color: C.text, maxWidth: wide ? undefined : 132, minWidth: wide ? undefined : 112 }}>{label(x)}</td>
                  {view.tt && <td className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: view.tt[k] == null ? C.muted : view.tt[k] < 0 ? C.down : C.white, fontWeight: bold ? 700 : 400 }}>{cell(view.tt, k)}</td>}
                  {showYoy && <td className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: y == null ? C.muted : y < 0 ? C.down : C.up }}>{pct(y)}</td>}
                  {view.newest.map(r => <td key={r.period} className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: r[k] == null ? C.muted : r[k] < 0 ? C.down : C.amber, fontWeight: bold ? 700 : 400 }}>{cell(r, k)}</td>)}
                </tr>
              })}</tbody>
            </table>
          </div>
          {moreRight && <div className="text-right text-[11px] pt-1" style={{ color: C.muted }} data-fund-scrollhint>{L('older periods → swipe', 'períodos anteriores → deslize')}</div>}
        </div>
        {hasRemarks && <div className="text-[11px] px-1 pt-2 leading-snug" style={{ color: C.muted }} data-fund-notes>{remarks}</div>}
        {chartDefs.length > 0 && <div className="mt-2">
          <div className="text-[11px] px-1 pb-1" style={{ color: C.amber }} data-fund-chart-title>{chartTitle}</div>
          <FnChart height={wide ? 260 : 220} panes={[{ series: chartDefs as any }]} />
        </div>}
      </>}
    </FnScreen>
  )
}
