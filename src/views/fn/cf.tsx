'use client'
// CF (Company Filings): lista dos documentos oficiais entregues pela empresa. Lógica em lib/filings.mjs (testada);
// aqui só a apresentação: grupos fixos, categorias por contagem, busca sem acento, versões recolhidas e cartões no mobile.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { tc } from '../../lib/themeRuntime'
import { lang } from '../../lib/settings'
import { FnScreen, Loading, C, MONO, dBRfull, short, useJSON, corpPath, inputCls, inputStyle } from '../../components/fn/kit'
import { href } from '../../lib/static'
import { covers, FUNCTION_UNIVERSE } from '../../lib/activeTicker.mjs'
import { safeUrl } from '../../lib/safe.mjs'
import {
  matches, collapseVersions, groupOf, isKey, categoryCounts, groupCounts, dateRange, sortFilings, showType, showRef, gloss,
  GROUPS, type Filing, type FilingRow, type Group,
} from '../../lib/filings.mjs'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const TOP_CATS = 8

function useMedia(q: string) {
  const [m, setM] = useState(false)
  useEffect(() => { const mm = window.matchMedia(q); const f = () => setM(mm.matches); f(); mm.addEventListener('change', f); return () => mm.removeEventListener('change', f) }, [q])
  return m
}

const groupLabel = (g: Group | 'all', us: boolean) => ({
  all: L('All', 'Todos'),
  results: L('Results', 'Resultados'),
  material: us ? L('Current reports (8-K)', 'Relatórios correntes (8-K)') : L('Material facts', 'Fatos relevantes'),
  meetings: L('Meetings', 'Assembleias e reuniões'),
  dividends: L('Dividends', 'Proventos'),
  other: L('Other', 'Outros'),
}[g])
/** nome da categoria na tela: em inglês, o rótulo curto (o original fica na dica e na segunda linha); em português, o original */
const catName = (cat: string) => (lang() === 'pt' ? cat : gloss(cat) || cat)
const OPEN_TIP = () => L('Opens the official document (new tab)', 'Abre o documento oficial (nova aba)')
const docTitle = (f: Filing) => f.subject || showType(f) || catName(f.cat)

function Chip({ on, onClick, children, hot, data }: { on: boolean; onClick: () => void; children: React.ReactNode; hot?: boolean; data?: string }) {
  return (
    <button type="button" data-cf-chip={data} aria-pressed={on} onClick={onClick}
      className="px-2 py-[1px] text-[12px] border whitespace-nowrap"
      style={{ borderColor: hot && !on ? C.down : C.line, background: on ? C.amber : 'transparent', color: on ? tc('#000') : hot ? C.white : C.amber, fontWeight: hot ? 700 : 400 }}>{children}</button>
  )
}
const Count = ({ n }: { n: number }) => <span style={{ opacity: 0.7 }}> {n}</span>

function OpenLink({ f, children, className, style }: { f: Filing; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const u = safeUrl(f.link || '')
  if (!u) return <span className={className} style={style}>{children}</span>
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" title={OPEN_TIP()} aria-label={`${docTitle(f)} — ${OPEN_TIP()}`} className="flex items-start gap-1 min-w-0" data-cf-link>
      <span className={`min-w-0 ${className || ''}`} style={style}>{children}</span><span aria-hidden className="shrink-0" style={{ color: C.amber }}>↗</span>
    </a>
  )
}

function Older({ list }: { list: Filing[] }) {
  return (
    <ul data-cf-older className="mt-1 text-[11px]" style={{ color: C.muted }}>
      {list.map((o, i) => <li key={i}>v{o.version ?? '1'} · {dBRfull(o.date)} · <OpenLink f={o} style={{ color: C.text }} className="underline">{L('open', 'abrir')}</OpenLink></li>)}
    </ul>
  )
}
function VerBtn({ r, open, onToggle }: { r: FilingRow; open: boolean; onToggle: () => void }) {
  if (!r.older.length) return <span style={{ color: C.muted }}>v{r.version ?? '1'}</span>
  return <button type="button" data-cf-ver onClick={onToggle} aria-expanded={open} title={L(`${r.older.length} earlier version(s)`, `${r.older.length} versão(ões) anterior(es)`)}
    className="whitespace-nowrap underline" style={{ color: C.amber }}>v{r.version} {open ? '▾' : '▸'} +{r.older.length}</button>
}

function CFNoData({ ticker }: { ticker: string }) {
  const u = (FUNCTION_UNIVERSE as Record<string, string[]>).CF || []
  const ex = u.filter(t => t.endsWith('.SA')).slice(0, 5).concat(u.filter(t => !t.endsWith('.SA')).slice(0, 2))
  const a = (p: string, l: string) => <a className="underline mr-3" style={{ color: C.amber }} href={href(p)}>{l}</a>
  return (
    <FnScreen code="CF" ticker={ticker} title={L('Company Filings', 'Documentos da empresa')}>
      <div className="p-4 text-[13px] max-w-[760px]" style={{ fontFamily: MONO }} data-cf-nodata>
        <div style={{ color: C.white }}>{L('No company filings for', 'Sem documentos da empresa para')} <span style={{ color: C.amber }}>{short(ticker)}</span>.</div>
        <div className="mt-2" style={{ color: C.muted }}>{L(
          `Filings (results, material facts, meetings, dividend notices) are collected for listed companies: Brazilian stocks and a set of US stocks (${u.length} assets). Funds, ETFs, indexes, currencies and crypto do not file these documents. For this asset, see:`,
          `Os documentos (resultados, fatos relevantes, assembleias, avisos de proventos) são coletados para companhias abertas: ações brasileiras e um conjunto de ações dos EUA (${u.length} ativos). Fundos, ETFs, índices, moedas e cripto não entregam esses documentos. Para este ativo, veja:`)}</div>
        <div className="mt-3">{covers('DES', ticker) && a(`/des/${ticker}/`, L(`DES — description of ${short(ticker)}`, `DES — descrição de ${short(ticker)}`))}{a(`/gp/${ticker}/`, L(`GP — price chart for ${short(ticker)}`, `GP — gráfico de preço de ${short(ticker)}`))}</div>
        {ex.length > 0 && <div className="mt-4" style={{ color: C.muted }}>{L('Examples with filings:', 'Exemplos com documentos:')} {ex.map(t => <a key={t} className="underline mr-2" style={{ color: C.amber }} href={href(`/cf/${t}/`)}>{short(t)}</a>)}</div>}
      </div>
    </FnScreen>
  )
}

export function CFView({ ticker }: { ticker: string }) {
  if (!covers('CF', ticker)) return <CFNoData ticker={ticker} />
  return <CFBody ticker={ticker} />
}

function CFBody({ ticker }: { ticker: string }) {
  const { data: d, err } = useJSON<any>(corpPath(ticker))
  const wide = useMedia('(min-width: 768px)')
  const mid = !useMedia('(min-width: 1024px)')
  const [group, setGroup] = useState<Group | 'all'>('all')
  const [cat, setCat] = useState<string>('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'date' | 'cat'>('date')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const scRef = useRef<HTMLDivElement | null>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const pt = lang() === 'pt'

  const base = useMemo(() => {
    if (!d) return null
    const us = d.country === 'US'
    const all = (Array.isArray(d.filings) ? d.filings : []) as Filing[]
    const rows = collapseVersions(all)
    return { us, all, rows, cats: categoryCounts(rows), groups: groupCounts(rows, us), range: dateRange(all), collapsed: all.length - rows.length }
  }, [d])

  const view = useMemo(() => {
    if (!base) return []
    const r = base.rows.filter(f => (group === 'all' || groupOf(f, base.us) === group) && (!cat || f.cat === cat) && matches(f, q))
    return sortFilings(r, sort, base.cats.map(c => c.cat))
  }, [base, group, cat, q, sort])

  const chk = () => { const el = scRef.current; if (el) setMoreBelow(el.scrollHeight - el.clientHeight - el.scrollTop > 8) }
  useEffect(() => { chk(); const el = scRef.current; if (!el) return; const ro = new ResizeObserver(chk); ro.observe(el); return () => ro.disconnect() }, [view.length, wide])

  if (!d || !base) return <FnScreen code="CF" ticker={ticker} title={L('Company Filings', 'Documentos da empresa')}><Loading err={err} /></FnScreen>
  const { us } = base
  const keyOf = (f: Filing, i: number) => `${f.link || ''}|${i}`
  const catsForGroup = base.cats.filter(c => group === 'all' || base.rows.some(f => f.cat === c.cat && groupOf(f, us) === group))
  const topCats = catsForGroup.slice(0, TOP_CATS)
  const restCats = catsForGroup.slice(TOP_CATS)
  const pickGroup = (g: Group | 'all') => { setGroup(g); setCat('') }

  const note = us
    ? L('10-K = annual report, 10-Q = quarterly report, 8-K = current report (material events; item 2.02 = quarterly results), DEF 14A = proxy statement for the shareholders\' meeting, 11-K = employee stock plan report. Highlighted rows are results. Re-filed versions of the same document are collapsed into the latest one; earlier versions open from the version button.',
      '10-K = relatório anual, 10-Q = relatório trimestral, 8-K = relatório de evento relevante (item 2.02 = resultado trimestral), DEF 14A = documento de convocação da assembleia, 11-K = relatório do plano de ações dos funcionários. Linhas destacadas são resultados. Reapresentações do mesmo documento ficam recolhidas na versão mais recente; as anteriores abrem pelo botão de versão.')
    : L('Brazilian filings: financial statements (annual DFP and quarterly ITR, earnings releases), material facts, market notices, notices to shareholders, meeting minutes and calls, dividend reports. Highlighted rows are results and material facts. Re-filed versions of the same document are collapsed into the latest one; earlier versions open from the version button.',
      'Documentos brasileiros: demonstrações financeiras (DFP anual e ITR trimestral, releases de resultado), fatos relevantes, comunicados ao mercado, avisos aos acionistas, atas e editais de assembleias e reuniões, relatórios de proventos. Linhas destacadas são resultados e fatos relevantes. Reapresentações do mesmo documento ficam recolhidas na versão mais recente; as anteriores abrem pelo botão de versão.')

  const search = (
    <label className="flex items-center gap-1 text-[12px]"><span style={{ color: C.muted }}>{L('Search', 'Buscar')}</span>
      <input data-cf-search value={q} onChange={e => setQ(e.target.value)} placeholder={L('e.g. dividend, AGO, 10-K', 'ex.: proventos, AGO, 10-K')}
        className={inputCls} style={{ ...inputStyle, width: wide ? 200 : 150 }} aria-label={L('Search filings', 'Buscar documentos')} /></label>
  )
  const sortBtns = (
    <div className="flex items-center gap-1 text-[12px]" data-cf-sort><span style={{ color: C.muted }}>{L('Sort', 'Ordem')}</span>
      <Chip on={sort === 'date'} onClick={() => setSort('date')} data="sort-date">{L('Date', 'Data')}</Chip>
      <Chip on={sort === 'cat'} onClick={() => setSort('cat')} data="sort-cat">{L('Category', 'Categoria')}</Chip>
    </div>
  )
  const catSelect = (list: { cat: string; n: number }[], label: string) => (
    <select data-cf-cat-select value={list.some(c => c.cat === cat) || !cat ? cat : ''} onChange={e => setCat(e.target.value)}
      className={inputCls} style={{ ...inputStyle, maxWidth: wide ? 260 : '100%' }} aria-label={L('Category', 'Categoria')}>
      <option value="">{label}</option>
      {list.map(c => <option key={c.cat} value={c.cat}>{catName(c.cat)} ({c.n})</option>)}
    </select>
  )

  return (
    <FnScreen code="CF" ticker={ticker} title={L('Company Filings', 'Documentos da empresa')} note={note} right={wide ? search : undefined}>
      <div className="px-2 pt-1 pb-1 text-[12px]" style={{ color: C.muted }} data-cf-range>
        {base.range ? <>{L(`${base.rows.length} documents filed from ${dBRfull(base.range.from)} to ${dBRfull(base.range.to)}`, `${base.rows.length} documentos entregues de ${dBRfull(base.range.from)} a ${dBRfull(base.range.to)}`)}
          {base.collapsed > 0 && L(` · ${base.collapsed} earlier versions collapsed`, ` · ${base.collapsed} versões anteriores recolhidas`)}
          {' · '}{L(`showing ${view.length}`, `exibindo ${view.length}`)}</> : L('No filings in the file.', 'Nenhum documento no arquivo.')}
      </div>
      {!wide && <div className="px-2 pb-1">{search}</div>}
      <div className="flex flex-wrap gap-1 px-2 pb-1" data-cf-groups>
        {(['all', ...GROUPS] as const).filter(g => g === 'all' || base.groups[g] > 0).map(g => (
          <Chip key={g} data={`g-${g}`} on={group === g} hot={g === 'results'} onClick={() => pickGroup(g)}>
            {g === 'results' ? '★ ' : ''}{groupLabel(g, us)}<Count n={g === 'all' ? base.rows.length : base.groups[g]} />
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 pb-2" data-cf-cats>
        {wide ? <>
          <Chip data="c-all" on={!cat} onClick={() => setCat('')}>{L('All categories', 'Todas as categorias')}</Chip>
          {topCats.map(c => <span key={c.cat} title={pt ? undefined : c.cat}><Chip data="c" on={cat === c.cat} onClick={() => setCat(cat === c.cat ? '' : c.cat)}>{catName(c.cat)}<Count n={c.n} /></Chip></span>)}
          {restCats.length > 0 && catSelect(restCats, L(`More categories (${restCats.length})`, `Mais categorias (${restCats.length})`))}
          <span className="ml-auto">{sortBtns}</span>
        </> : <>
          <div className="w-full">{catSelect(catsForGroup, L(`All categories (${catsForGroup.length})`, `Todas as categorias (${catsForGroup.length})`))}</div>
          <div className="w-full">{sortBtns}</div>
        </>}
      </div>

      {view.length === 0 ? <div className="px-2 py-3 text-[12px]" style={{ color: C.muted }} data-cf-empty>{L('No documents match the filters.', 'Nenhum documento com esses filtros.')}</div>
        : <div className="relative">
          <div ref={scRef} onScroll={chk} data-cf-list className="overflow-y-auto overflow-x-hidden border-t" style={{ maxHeight: wide ? 'max(320px, calc(100vh - 290px))' : '70vh', overscrollBehavior: 'contain', borderColor: C.line }}>
            {wide ? (
              <table className="w-full border-collapse text-[12px]" style={{ tableLayout: 'fixed' }} data-cf-table>
                <colgroup><col style={{ width: mid ? 80 : 92 }} /><col style={{ width: mid ? 80 : 92 }} /><col style={{ width: mid ? 170 : 240 }} /><col /><col style={{ width: mid ? 58 : 70 }} /></colgroup>
                <thead className="sticky top-0" style={{ background: C.panel2, zIndex: 2 }}>
                  <tr>{[L('Filed', 'Entrega'), L('Period', 'Referência'), L('Category', 'Categoria'), L('Document', 'Documento'), L('Version', 'Versão')].map((h, i) => (
                    <th key={i} className="px-2 py-[3px] text-left font-normal border-b whitespace-nowrap" style={{ color: C.amber, borderColor: C.line }}>{h}</th>))}</tr>
                </thead>
                <tbody>
                  {view.map((r, i) => {
                    const k = keyOf(r, i), hot = isKey(r, us), ty = showType(r), rf = showRef(r), gl = !pt ? gloss(r.cat) : null
                    return (
                      <tr key={k} data-cf-row data-hot={hot ? '1' : undefined} style={{ background: hot ? tc('#1a1205') : i % 2 ? tc('#0a0a0a') : 'transparent', boxShadow: hot ? `inset 2px 0 0 ${C.down}` : undefined }}>
                        <td className="px-2 py-[3px] align-top border-b whitespace-nowrap" style={{ borderColor: tc('#1a1a1a'), color: C.text }}>{dBRfull(r.date)}</td>
                        <td className="px-2 py-[3px] align-top border-b whitespace-nowrap" style={{ borderColor: tc('#1a1a1a'), color: C.muted }}>{rf ? dBRfull(rf) : ''}</td>
                        <td className="px-2 py-[3px] align-top border-b" style={{ borderColor: tc('#1a1a1a') }} title={r.cat}>
                          <div className="truncate" style={{ color: C.amber }}>{catName(r.cat)}</div>
                          {gl && <div className="truncate text-[10px]" style={{ color: C.muted }}>{r.cat}</div>}
                        </td>
                        <td className="px-2 py-[3px] align-top border-b min-w-0" style={{ borderColor: tc('#1a1a1a') }}>
                          <OpenLink f={r} className="line-clamp-2 break-words whitespace-normal leading-[1.3]" style={{ color: hot ? C.white : C.text, fontWeight: hot ? 700 : 400 }}>{docTitle(r)}</OpenLink>
                          {ty && r.subject && <div className="truncate text-[11px]" style={{ color: C.muted }}>{ty}</div>}
                          {open[k] && <Older list={r.older} />}
                        </td>
                        <td className="px-2 py-[3px] align-top border-b" style={{ borderColor: tc('#1a1a1a') }}><VerBtn r={r} open={!!open[k]} onToggle={() => setOpen(o => ({ ...o, [k]: !o[k] }))} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <ul data-cf-cards>
                {view.map((r, i) => {
                  const k = keyOf(r, i), hot = isKey(r, us), ty = showType(r), rf = showRef(r)
                  return (
                    <li key={k} data-cf-card data-hot={hot ? '1' : undefined} className="min-w-0 px-2 py-[6px] border-b"
                      style={{ borderColor: tc('#1a1a1a'), background: hot ? tc('#1a1205') : i % 2 ? tc('#0a0a0a') : 'transparent', boxShadow: hot ? `inset 2px 0 0 ${C.down}` : undefined }}>
                      <OpenLink f={r} className="whitespace-normal break-words line-clamp-3 text-[13px] leading-[1.35]" style={{ color: hot ? C.white : C.text, fontWeight: hot ? 700 : 400 }}>{docTitle(r)}</OpenLink>
                      <div className="mt-[2px] text-[11px] leading-[1.3] break-words" style={{ color: C.muted }}>
                        {dBRfull(r.date)}{rf ? <> · {L('period', 'ref.')} {dBRfull(rf)}</> : null} · <span style={{ color: C.amber }}>{catName(r.cat)}</span>{ty && r.subject ? <> · {ty}</> : null}
                        {' · '}<VerBtn r={r} open={!!open[k]} onToggle={() => setOpen(o => ({ ...o, [k]: !o[k] }))} />
                      </div>
                      {open[k] && <Older list={r.older} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {moreBelow && <div data-cf-scrollhint className="pointer-events-none absolute left-0 right-0 bottom-0 h-8 flex items-end justify-center text-[11px] pb-[2px]"
            style={{ zIndex: 3, color: C.muted, background: tc('linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.92))') }}>{L('scroll for more ↓', 'role para ver mais ↓')}</div>}
        </div>}
    </FnScreen>
  )
}
