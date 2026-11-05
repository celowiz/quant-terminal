'use client'
// FA (Financial Analysis): demonstrações completas linha a linha. Lógica pura em lib/fa.mjs (testada); aqui só a apresentação:
// períodos do mais recente ao mais antigo (A/A primeiro), coluna de contas fixa, níveis relativos (Resumo/Padrão/Completo),
// nomes EN curados para o plano de contas brasileiro, PT curado para o layout dos EUA, gráfico com lacunas (sem zeros inventados).
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { lang, numLocale } from '../../lib/settings'
import { FnScreen, Btns, Field, Loading, C, MONO, short, useJSON } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import { href, tickerKey } from '../../lib/static'
import { covers, FUNCTION_UNIVERSE } from '../../lib/activeTicker.mjs'
import { accountName, relLevels, yearAgoIndex, yoyChange, newestFirst, chartPoints, tabName } from '../../lib/fa.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const loc = () => (lang() === 'pt' ? 'pt-BR' : numLocale())
const fmt = (v: any, d: number) => v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d })

function useMedia(q: string) {
  const [m, setM] = useState(false)
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); f(); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f) }, [q])
  return m
}

function FANoData({ ticker }: { ticker: string }) {
  const u = (FUNCTION_UNIVERSE as Record<string, string[]>).FA || []
  const ex = u.filter(t => t.endsWith('.SA')).slice(0, 5).concat(u.filter(t => !t.endsWith('.SA')).slice(0, 2))
  const a = (p: string, l: string) => <a className="underline mr-3 inline-block" style={{ color: C.amber }} href={href(p)}>{l}</a>
  return (
    <FnScreen code="FA" ticker={ticker} title={L('Financial Analysis', 'Análise financeira')}>
      <div className="p-4 text-[13px] max-w-[760px]" style={{ fontFamily: MONO }} data-fa-nodata>
        <div style={{ color: C.white }}>{L('No full financial statements for', 'Sem demonstrações financeiras completas para')} <span style={{ color: C.amber }}>{short(ticker)}</span>.</div>
        <div className="mt-2" style={{ color: C.muted }}>{L(
          `Full statements are available for listed companies: Brazilian stocks and a set of US stocks (${u.length} assets). Funds, ETFs, indexes, currencies and crypto do not publish company financial statements, and some covered US companies are not yet included. For this asset, see:`,
          `As demonstrações completas estão disponíveis para companhias abertas: ações brasileiras e um conjunto de ações dos EUA (${u.length} ativos). Fundos, ETFs, índices, moedas e cripto não publicam demonstrações de empresa, e algumas empresas americanas cobertas ainda não estão incluídas. Para este ativo, veja:`)}</div>
        <div className="mt-3">
          {covers('FUND', ticker) && a(`/fund/${ticker}/`, L(`FUND — summary statements of ${short(ticker)}`, `FUND — demonstrações resumidas de ${short(ticker)}`))}
          {covers('DES', ticker) && a(`/des/${ticker}/`, L(`DES — description of ${short(ticker)}`, `DES — descrição de ${short(ticker)}`))}
          {a(`/gp/${ticker}/`, L(`GP — price chart for ${short(ticker)}`, `GP — gráfico de preço de ${short(ticker)}`))}
        </div>
        {ex.length > 0 && <div className="mt-4" style={{ color: C.muted }}>{L('Examples with statements:', 'Exemplos com demonstrações:')} {ex.map(t => <a key={t} className="underline mr-2" style={{ color: C.amber }} href={href(`/fa/${t}/`)}>{short(t)}</a>)}</div>}
      </div>
    </FnScreen>
  )
}

export function FAView({ ticker }: { ticker: string }) {
  if (!covers('FA', ticker)) return <FANoData ticker={ticker} />
  return <FABody ticker={ticker} />
}

function FABody({ ticker }: { ticker: string }) {
  const { data: f, err } = useJSON<any>(`fa/${tickerKey(ticker)}.json`)
  const [tab, setTab] = useState(0), [q, setQ] = useState(false), [sel, setSel] = useState<string | null>(null), [depth, setDepth] = useState(2)
  const wide = useMedia('(min-width: 768px)')
  const scRef = useRef<HTMLDivElement | null>(null)
  const [moreRight, setMoreRight] = useState(false)
  const pt = lang() === 'pt'
  const keys = f ? Object.keys(f.stmts) : []
  const st = f ? (f.stmts[keys[tab]] || f.stmts[keys[0]]) : null
  const blk = st ? (q ? st.quarterly : st.annual) : null
  const all = useMemo(() => blk ? relLevels(blk.rows as any[]).filter(r => r.vals.some((v: any) => v != null)) : [], [blk])

  useEffect(() => {
    const el = scRef.current; if (!el) return
    const g = () => setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
    g(); el.addEventListener('scroll', g); window.addEventListener('resize', g)
    return () => { el.removeEventListener('scroll', g); window.removeEventListener('resize', g) }
  }, [blk, depth, tab])

  if (!f || !st || !blk) return <FnScreen code="FA" ticker={ticker}><Loading err={err} /></FnScreen>
  const us = f.country === 'US'
  const periods: string[] = blk.periods, n = periods.length
  const maxRel = Math.max(1, ...all.map(r => r.rel))
  const d = Math.min(depth, maxRel)
  const rows = all.filter(r => r.rel <= d)
  const order = newestFirst(periods)
  const last = n - 1, prevI = n ? yearAgoIndex(periods, last) : -1
  const cur = rows.find(r => r.code === sel) || rows[0]
  const mn = `${us ? 'US$' : 'R$'} ${L('mn', 'mi')}`
  const lbl = (p: string) => q ? `${L('Q', 'T')}${Math.ceil(+p.slice(5, 7) / 3)}'${p.slice(2, 4)}` : p.slice(0, 4)
  const nm = (r: any) => accountName(r, us, pt)
  const anyFiled = rows.some(r => nm(r).asFiled)
  const anyDerived = rows.some(r => (r.derived || []).some(Boolean))
  const levels = [{ v: 1, l: L('Summary', 'Resumo') }, { v: 2, l: L('Standard', 'Padrão') }, ...(maxRel >= 3 ? [{ v: 3, l: L('Full', 'Completo') }] : [])]
  const stickyBg = '#0b0b0b', th = 'px-2 py-1 text-right font-normal whitespace-nowrap'
  const showYoy = prevI >= 0

  const note = <>
    {us ? L('Consolidated statements (US GAAP) from the annual and quarterly reports, in a standard layout. Quarterly flows = difference between consecutive year-to-date figures; Q4 = fiscal year − 9 months. Columns use the calendar quarter in which the fiscal period ends; balance sheet = position at period end.',
      'Demonstrações consolidadas (US GAAP) dos relatórios anuais e trimestrais, num layout padrão. Fluxos trimestrais = diferença entre acumulados consecutivos; 4º tri = exercício − 9 meses. As colunas usam o trimestre civil em que termina o período fiscal; balanço = posição no fim do período.')
      : L('Consolidated statements from the annual (DFP) and quarterly (ITR) filings, standardized chart of accounts with official codes. Income-statement and cash-flow quarters derived from year-to-date figures (Q4 = annual − 9 months); balance sheet = position at period end.',
      'Demonstrações consolidadas das DFP (anual) e ITR (trimestral), plano de contas padronizado com os códigos oficiais. Trimestres de DRE e fluxo de caixa derivados dos acumulados (4º tri = anual − 9 meses); balanço = posição no fim do período.')}
    {' '}{L(`Values in ${mn}; expenses and outflows negative. YoY = change in the size of the line vs. one year earlier; green/red = higher/lower value; n.m. = not meaningful (sign change or zero base). Click an account to chart it.`,
      `Valores em ${mn}; despesas e saídas negativas. A/A = variação do tamanho da linha contra um ano antes; verde/vermelho = valor maior/menor; n.s. = não significativo (troca de sinal ou base zero). Clique numa conta para o gráfico.`)}
  </>
  const remarks = <>
    {anyDerived && <> {L('c = calculated from reported lines (subtotal or remainder); shown only when every part is reported.', 'c = calculado a partir de linhas informadas (subtotal ou resto); só aparece quando todas as partes são informadas.')}</>}
    {anyFiled && <> {L('PT = account specific to this company, name as filed in Portuguese.', 'PT = conta própria desta empresa, nome como publicado em português.')}</>}
    {all.length > rows.length && <> {L(`${all.length - rows.length} more lines in a higher detail level.`, `Mais ${all.length - rows.length} linhas num nível de detalhe maior.`)}</>}
  </>
  const cn = cur ? nm(cur).text : ''
  const pts = cur ? chartPoints(periods, cur.vals) : []

  return (
    <FnScreen code="FA" ticker={ticker} asOf={n ? periods[last] : null} title={L('Financial Analysis — full statements', 'Análise financeira — demonstrações completas')}
      tabs={keys.map(k => tabName(k, f.stmts[k].name, pt))} tab={tab} setTab={i => { setTab(i); setSel(null) }}
      right={<><Btns opts={[{ v: false, l: L('Yearly', 'Anual') }, { v: true, l: L('Quarterly', 'Trimestral') }] as any} value={q} onChange={setQ as any} /><Field label={L('Detail', 'Detalhe')}><Btns opts={levels as any} value={d} onChange={setDepth as any} /></Field></>}
      note={<>{note}{remarks}</>}>
      {rows.length === 0 ? <div className="p-3 text-[12px]" style={{ color: C.muted }} data-fa-empty>{L('The company does not report this statement.', 'A empresa não informa esta demonstração.')}</div> : <>
        <div className="relative">
          <div ref={scRef} className="overflow-auto border" style={{ borderColor: C.line, maxHeight: wide ? 520 : 460 }} data-fa-table-wrap>
            <table className="border-collapse text-[12px]" style={{ width: wide ? '100%' : 'max-content', fontFamily: MONO }} data-fa-table>
              <thead><tr style={{ background: C.panel2, position: 'sticky', top: 0, zIndex: 2 }}>
                <th className="px-2 py-1 text-left font-normal" style={{ color: C.amber, position: 'sticky', left: 0, background: C.panel2, zIndex: 3, minWidth: wide ? 260 : 112 }}>{mn}</th>
                {showYoy && <th className={th} style={{ color: C.white }} title={L(`${lbl(periods[last])} vs. ${lbl(periods[prevI])}`, `${lbl(periods[last])} contra ${lbl(periods[prevI])}`)} data-fa-col="yoy">{L('YoY', 'A/A')}</th>}
                {order.map(i => <th key={periods[i]} className={th} style={{ color: C.amber }} data-fa-col={periods[i]}>{lbl(periods[i])}</th>)}
              </tr></thead>
              <tbody>{rows.map(r => {
                const a = nm(r), bold = r.rel === 1, isSel = r.code === cur?.code
                const y = showYoy ? yoyChange(r.vals[last], r.vals[prevI]) : null
                const bg = isSel ? '#2a1d08' : bold ? '#141414' : stickyBg
                return <tr key={r.code} className="border-t cursor-pointer" style={{ borderColor: '#1a1a1a', background: isSel ? '#2a1d08' : bold ? '#141414' : undefined }} onClick={() => setSel(r.code)} data-fa-row={r.code} data-fa-level={r.rel}>
                  <td className="px-2 py-[3px] leading-tight" style={{ fontWeight: bold ? 700 : 400, position: 'sticky', left: 0, background: bg, zIndex: 1, color: bold ? C.amber : a.asFiled ? C.muted : C.text, maxWidth: wide ? undefined : 150, minWidth: wide ? undefined : 120, fontSize: wide ? undefined : 11, paddingLeft: 8 + (r.rel - 1) * (wide ? 12 : 6) }} title={a.asFiled ? L('Company-specific account, name as filed', 'Conta própria da empresa, nome como publicado') : undefined}>
                    {wide && !us && <span style={{ color: C.muted, fontWeight: 400 }} className="mr-2">{r.code}</span>}{a.text}{a.asFiled && <sup data-fa-asfiled style={{ color: C.muted }}> PT</sup>}
                  </td>
                  {showYoy && <td className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: y == null || y.nm ? C.muted : y.dir < 0 ? C.down : y.dir > 0 ? C.up : C.text }} data-fa-yoy>{y == null ? '—' : y.nm ? L('n.m.', 'n.s.') : `${y.pct! > 0 ? '+' : ''}${fmt(y.pct, 1)}%`}</td>}
                  {order.map(i => { const v = r.vals[i], der = !!(r.derived && r.derived[i]); return <td key={i} className="px-2 py-[3px] text-right whitespace-nowrap" style={{ color: v == null ? C.muted : v < 0 ? C.down : bold ? C.white : C.text, fontWeight: bold ? 700 : 400 }} title={der ? L('Calculated from reported lines (see note)', 'Calculado a partir de linhas informadas (ver nota)') : v == null ? L('Not reported', 'Não informado') : undefined}>{v == null ? '—' : fmt(v / 1e6, 0)}{der && <sup data-fa-derived style={{ color: C.muted }}> c</sup>}</td> })}
                </tr>
              })}</tbody>
            </table>
          </div>
          {moreRight && <div className="text-right text-[11px] pt-1" style={{ color: C.muted }} data-fa-scrollhint>{L('older periods → swipe', 'períodos anteriores → deslize')}</div>}
        </div>
        <div className="text-[11px] px-1 pt-2 leading-snug" style={{ color: C.muted }} data-fa-notes>{L('Tap an account to chart it.', 'Toque numa conta para o gráfico.')}{remarks}</div>
        {cur && pts.length > 0 && <div className="mt-2">
          <div className="text-[11px] px-1 pb-1" style={{ color: C.amber }} data-fa-chart-title>{`${!us ? cur.code + ' ' : ''}${cn} (${mn})`}{pts.length < n && <span style={{ color: C.muted }}> — {L('gaps = not reported', 'lacunas = não informado')}</span>}</div>
          <FnChart height={wide ? 240 : 200} panes={[{ series: [{ kind: 'hist', data: pts.map(p => ({ ...p, color: p.value >= 0 ? C.amber : C.down })), title: cn.slice(0, 30), decimals: 0 }] as any }]} />
        </div>}
      </>}
    </FnScreen>
  )
}
