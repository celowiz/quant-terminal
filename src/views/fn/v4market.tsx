'use client'
import { tc } from '../../lib/themeRuntime'
/** Funções sem ticker da v4: CDIE (refeita), CORR, EQS, GC, ECFC, ECST, WCRS, GLCO, MOST, BTMM. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, PALETTE, nf, pf, big, dBR, dBRfull, clr, useJSON, FnScreen, Panel, Grid, Btns, perLabel, useDesktop, Field, inputCls, inputStyle, KV, Loading, Spark } from '@/components/fn/kit'
import { corr } from '@/lib/quant'
import { en, toEN } from '@/lib/enText'
import { lang } from '@/lib/settings'
import { fmtMonth, fmtQuarter, monthAbbr, fmtDayMonth } from '@/lib/dates'
import { calName } from '@/lib/calNames.mjs'
import { downloadCSV, CsvBtn, dayNum, fromDay, heat, HBars, VertexBars } from './v4util'
import { useLive, b3QuoteLive, b3DayLive, useWorldLive } from '@/lib/liveFetch'
import { b3FutOpen, dolCodes, delayMin, applyQuote, quoteFresh, quotesBadge, type LiveInfo, type WQuote } from '@/lib/live.mjs'

const bp = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${nf(v, d)}`
const mLabel = (iso: string) => fmtMonth(iso)  // 'Sep 26' (EN) / 'set 26' (PT), igual ao resto do site
const PT = () => lang() === 'pt'
const LL = (en: string, pt: string) => (PT() ? pt : en)
/** setor (chave EN canônica) → nome PT para o filtro em PT */
const PT_SECTOR: Record<string, string> = { 'Industrials': 'Bens industriais', 'Consumer Staples': 'Consumo não cíclico', 'Consumer Discretionary': 'Consumo cíclico', 'Miscellaneous': 'Diversos', 'Financials & Other': 'Financeiro e outros', 'Basic Materials': 'Materiais básicos', 'Oil, Gas & Biofuels': 'Petróleo, gás e biocombustíveis', 'Health Care': 'Saúde', 'Information Technology': 'Tecnologia da informação', 'Telecommunications': 'Telecomunicações', 'Utilities': 'Utilidade pública' }

// ======================= CDIE =======================
const cdieNum = (v: any, d = 2) => {
  if (v == null || v === '' || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return x.toLocaleString(PT() ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const cdieBp = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${cdieNum(v, d)}`
const cdieBig = (v: any, d = 1) => {
  if (v == null || Number.isNaN(+v)) return '—'
  const a = Math.abs(+v), s = +v < 0 ? '-' : '', n = (x: number) => cdieNum(x, d)
  if (a >= 1e12) return `${s}${n(a / 1e12)}T`
  if (a >= 1e9) return `${s}${n(a / 1e9)}B`
  if (a >= 1e6) return `${s}${n(a / 1e6)}M`
  if (a >= 1e3) return `${s}${n(a / 1e3)}K`
  return `${s}${n(a)}`
}
export function CDIEView() {
  const { data: d, err } = useJSON<any>('cdie.json')
  const desk = useDesktop()
  const [tab, setTab] = useState(0)
  const [more, setMore] = useState(false)
  const [dots, setDots] = useState(true)
  const title = LL('CDI / Copom expectations implied by DI futures', 'Expectativas de CDI e Copom implícitas nos futuros de DI')
  const v = useMemo(() => {
    if (!d) return null
    const path: any[] = d.path, ref = d.ref_date
    const meetings: any[] = d.meetings
    const endOf = (r: any) => { const i = meetings.findIndex(m => m.label === r.label); return meetings[i + 1]?.effective || fromDay(dayNum(r.effective) + 45) }
    const step = (get: (r: any) => number | null, v0: number | null) => {
      const pts: [number, number | null][] = [[dayNum(ref), v0]]
      let prev = v0
      path.forEach(r => { const val = get(r); pts.push([dayNum(r.effective), prev]); pts.push([dayNum(r.effective), val]); prev = val })
      if (path.length) pts.push([dayNum(endOf(path[path.length - 1])), prev])
      return pts
    }
    const last = path.length ? endOf(path[path.length - 1]) : ref
    const quoted = (d.contracts as any[]).filter(c => c.mat <= last).map(c => [dayNum(c.mat), c.rate] as [number, number])
    const nextM = meetings.find(m => m.decision >= ref)
    const surveyDate = path.map((r: any) => r.focus?.date).find(Boolean) as string | undefined
    const surveyStale = !!(surveyDate && dayNum(ref) - dayNum(surveyDate) > 7)
    return { path, step, quoted, nextM, cum: path.length ? path[path.length - 1].cum_bp : null, surveyDate, surveyStale }
  }, [d])
  if (!d || !v) return <FnScreen code="CDIE" title={title} ownTitle><Loading err={err} /></FnScreen>
  const first = v.path[0]
  const lastLab = v.path[v.path.length - 1]?.label ?? '—'
  const spread = cdieNum(d.spread_selic_cdi, 2)
  const note = LL(
    `The implied rate is what the market prices in, not a forecast; it includes a term premium that grows with maturity. Each settlement price is turned into a rate; forwards between expiries are held flat; the implied CDI of each inter-meeting period is that period's average forward. Implied Selic = implied CDI + today's Selic−CDI spread (${spread} p.p.). Δ meeting is versus the previous period; 25 bp is a standard cut or hike. The path rate of a contract exists only up to the last expiry covered by the published meeting calendar. History starts with the first sessions collected and grows by one session per day.`,
    `A taxa implícita é o que o mercado precifica, não uma projeção; inclui um prêmio de prazo que cresce com o vencimento. Cada PU de ajuste vira taxa; os forwards entre vencimentos são constantes; o CDI implícito de cada período entre reuniões é o forward médio do período. Selic implícita = CDI implícito + spread Selic−CDI de hoje (${spread} p.p.). Δ reunião é contra o período anterior; 25 pb é um corte ou alta padrão. A taxa do caminho de um contrato só existe até o último vencimento coberto pelo calendário de reuniões publicado. O histórico começa nas primeiras sessões coletadas e cresce uma sessão por dia.`)
  const source = LL('Daily settlement of DI futures, the published meeting calendar, the overnight rate and the policy target, and the median policy-rate survey by meeting (public data).',
    'Ajuste diário dos futuros de DI, o calendário de reuniões publicado, a taxa overnight e a meta, e a mediana da pesquisa de taxa básica por reunião (dados públicos).')
  const cards = [
    [LL('Current CDI (% p.a.)', 'CDI atual (% a.a.)'), cdieNum(d.cdi, 2), C.amber],
    [LL('Selic target (% p.a.)', 'Meta da Selic (% a.a.)'), cdieNum(d.selic, 2), C.amber],
    [LL('Next meeting', 'Próxima reunião'), v.nextM ? `${v.nextM.label} · ${fmtDayMonth(v.nextM.decision)}` : '—', C.text],
    [LL('Implied move (bp)', 'Movimento implícito (pb)'), first ? cdieBp(first.move_bp) : '—', clr(first?.move_bp)],
    ...(!desk ? [] : [[LL(`Cumulative to ${lastLab} (bp)`, `Acumulado até ${lastLab} (pb)`), cdieBp(v.cum), clr(v.cum)]] as any),
  ]
  const surveyLbl = v.surveyDate
    ? LL(`Survey · ${fmtDayMonth(v.surveyDate)}`, `Pesquisa · ${fmtDayMonth(v.surveyDate)}`)
    : LL('Survey (med.)', 'Pesquisa (med.)')
  const meetCols = [
    { k: 'label', label: LL('Meeting', 'Reunião'), color: () => C.amber },
    { k: 'decision', label: LL('Decision', 'Decisão'), fmt: (x: string) => dBR(x) },
    { k: 'contract', label: LL('DI1 ref.', 'Ref. DI1') },
    { k: 'cdi', label: LL('Implied CDI', 'CDI impl.'), align: 'r' as const, fmt: (x: number) => cdieNum(x, 2), color: () => C.amber },
    { k: 'move_bp', label: LL('Δ meet. (bp)', 'Δ reu. (pb)'), align: 'r' as const, tip: LL('Change implied for this meeting versus the previous period, in basis points.', 'Variação implícita desta reunião contra o período anterior, em pontos-base.'), fmt: (x: number) => cdieBp(x), color: (x: number) => clr(x) },
    { k: 'cum_bp', label: LL('Δ cum. (bp)', 'Δ acum. (pb)'), align: 'r' as const, tip: LL('Cumulative implied change from the current CDI to this meeting.', 'Variação implícita acumulada desde o CDI atual até esta reunião.'), fmt: (x: number) => cdieBp(x), color: (x: number) => clr(x) },
    { k: 'n25', label: LL('25 bp steps', 'Passos de 25 pb'), align: 'r' as const, tip: LL('Number of standard 25 bp cuts or hikes in this meeting.', 'Número de cortes ou altas padrão de 25 pb nesta reunião.'), fmt: (_: any, r: any) => cdieNum(r.move_bp / 25, 2) },
    { k: 'selic', label: LL('Impl. Selic', 'Selic impl.'), align: 'r' as const, tip: LL('Implied Selic target after this meeting.', 'Meta da Selic implícita após esta reunião.'), fmt: (x: number) => cdieNum(x, 2) },
    { k: 'focus', label: surveyLbl, align: 'r' as const, tip: v.surveyStale ? LL('Survey is more than 7 days older than the settlement date.', 'A pesquisa tem mais de 7 dias em relação à data de ajuste.') : undefined, fmt: (x: any) => x ? cdieNum(x.median, 2) : '—', color: () => v.surveyStale ? C.muted : C.purple },
    { k: 'dif', label: LL('Impl.−survey (bp)', 'Impl.−pesq. (pb)'), align: 'r' as const, fmt: (_: any, r: any) => r.focus ? cdieBp((r.selic - r.focus.median) * 100) : '—', color: (_: any, r: any) => r.focus ? clr(r.selic - r.focus.median) : C.muted },
  ]
  const diCols = [
    { k: 'code', label: LL('Contract', 'Contrato'), color: () => C.amber },
    { k: 'mat', label: LL('Expiry', 'Vencimento'), fmt: (x: string) => dBR(x) },
    { k: 'du', label: LL('Business days', 'Dias úteis'), align: 'r' as const, tip: LL('Business days to expiry (DU).', 'Dias úteis até o vencimento (DU).') },
    { k: 'pu', label: LL('Settlement PU', 'PU de ajuste'), align: 'r' as const, tip: LL('Official settlement unit price.', 'Preço unitário oficial de ajuste.'), fmt: (x: number) => cdieNum(x, 2) },
    { k: 'rate', label: LL('Rate', 'Taxa'), align: 'r' as const, fmt: (x: number) => cdieNum(x, 3), color: () => C.amber },
    { k: 'est', label: LL('Path rate', 'Taxa do caminho'), align: 'r' as const, tip: LL('Contract rate recomputed from the implied path.', 'Taxa do contrato recalculada pelo caminho implícito.'), fmt: (x: number) => cdieNum(x, 3) },
    { k: 'last_est_bp', label: LL('Rate − path (bp)', 'Taxa − caminho (pb)'), align: 'r' as const, fmt: (x: number) => cdieBp(x), color: (x: number) => x == null ? C.muted : Math.abs(x) > 2 ? C.yellow : C.text },
    { k: 'fwd', label: LL('Forward', 'Forward'), align: 'r' as const, fmt: (x: number) => cdieNum(x, 3) },
    { k: 'contracts', label: LL('Contracts', 'Contratos'), align: 'r' as const, fmt: (x: number) => cdieBig(x, 1) },
    { k: 'volume', label: LL('Volume R$', 'Volume R$'), align: 'r' as const, fmt: (x: number) => cdieBig(x, 1) },
  ]
  const histCols = [
    { k: 'date', label: LL('Date', 'Data'), fmt: (x: string) => dBRfull(x) },
    { k: 'cdi', label: 'CDI', align: 'r' as const, fmt: (x: number) => cdieNum(x, 2) },
    { k: 'next', label: LL('Next meeting', 'Próxima reunião') },
    { k: 'next_move_bp', label: LL('Δ implied (bp)', 'Δ impl. (pb)'), align: 'r' as const, fmt: (x: number) => cdieBp(x), color: (x: number) => clr(x) },
    { k: 'cum_12m_bp', label: LL('Cum. 12m (bp)', 'Acum. 12m (pb)'), align: 'r' as const, fmt: (x: number) => cdieBp(x), color: (x: number) => clr(x) },
    { k: 'year_end_cdi', label: LL('Year-end CDI', 'CDI fim de ano'), align: 'r' as const, fmt: (x: number) => cdieNum(x, 2) },
    { k: 'di1_1y', label: LL('DI1 ~1Y', 'DI1 ~1A'), align: 'r' as const, fmt: (x: number) => cdieNum(x, 3) },
  ]
  const compactKeys = tab === 0 ? ['label', 'move_bp', 'cum_bp', 'selic'] : tab === 1 ? ['code', 'mat', 'rate', 'est'] : ['date', 'next_move_bp', 'cum_12m_bp', 'year_end_cdi']
  const allCols = tab === 0 ? meetCols : tab === 1 ? diCols : histCols
  const showCols = desk || more ? allCols : allCols.filter(c => compactKeys.includes(c.k))
  const moreBtn = !desk && <button data-cdie-more className="mt-1 px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? LL('Fewer columns', 'Menos colunas') : LL('More columns', 'Mais colunas')}</button>
  const csvBtn = (tab === 1 || tab === 2) && <button data-cdie-csv className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.amber, color: C.amber }} onClick={() => {
    if (tab === 1) downloadCSV('cdie-di1.csv', diCols.map(c => String(c.label)), d.contracts.map((r: any) => [r.code, dBR(r.mat), r.du, r.pu, r.rate, r.est, r.last_est_bp, r.fwd, r.contracts, r.volume]))
    else downloadCSV('cdie-history.csv', histCols.map(c => String(c.label)), d.history.slice().reverse().map((r: any) => [dBRfull(r.date), r.cdi, r.next, r.next_move_bp, r.cum_12m_bp, r.year_end_cdi, r.di1_1y]))
  }}>{LL('Export CSV', 'Exportar CSV')}</button>
  const changeTab = (i: number) => { setTab(i); setMore(false) }
  const chartSeries = [
    { name: LL('Implied CDI (DI1)', 'CDI implícito (DI1)'), points: v.step((r: any) => r.cdi, d.cdi), color: C.amber, width: 2 },
    { name: LL('Implied Selic', 'Selic implícita'), points: v.step((r: any) => r.selic, d.selic), color: C.cyan, dash: '4 3' },
    { name: LL('Survey – Selic median', 'Pesquisa – mediana da Selic'), points: v.step((r: any) => r.focus?.median ?? null, d.selic), color: v.surveyStale ? tc('#666') : C.purple, dash: '2 3' },
    ...(dots ? [{ name: LL('DI1 rate (settlement, at expiry)', 'Taxa DI1 (ajuste, no vencimento)'), points: v.quoted, color: C.white, scatter: true as const }] : []),
  ]
  return (
    <FnScreen code="CDIE" title={title} ownTitle wrap asOf={d.ref_date}
      tabs={[LL('Copom meetings', 'Reuniões do Copom'), LL('DI1 contracts', 'Contratos DI1'), LL('History', 'Histórico')]} tab={tab} setTab={changeTab}
      right={csvBtn || undefined} source={source} note={note}>
      <div data-cdie-cards className="mb-2 grid gap-2 text-[12px] fn-kpi min-w-0" style={{ gridTemplateColumns: desk ? 'repeat(5,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))' }}>
        {cards.map(([k, val, c]) => <div key={k as string} className="border px-2 py-1 min-w-0" style={{ borderColor: C.line, background: C.panel }}><div className="truncate" style={{ color: C.muted }}>{k}</div><div className="text-[16px] truncate" style={{ color: c as string, whiteSpace: 'nowrap' }} title={String(val)}>{val}</div></div>)}
      </div>
      {!desk && v.cum != null && <div data-cdie-cum className="mb-2 text-[11px]" style={{ color: C.muted }}>{LL(`Cumulative to ${lastLab}`, `Acumulado até ${lastLab}`)}: <span style={{ color: clr(v.cum) }}>{cdieBp(v.cum)} {LL('bp', 'pb')}</span></div>}
      {tab === 0 && <div className="grid gap-2 min-w-0">
        <Panel className="min-w-0 w-full overflow-hidden" title={LL('Implied path by meeting', 'Trajetória implícita por reunião')}>
          {!desk && !more && <div data-cdie-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{LL('Showing meeting, Δ meeting, Δ cumulative and implied Selic.', 'Mostrando reunião, Δ reunião, Δ acumulado e Selic implícita.')}</div>}
          <div data-cdie-meet className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst rows={v.path} cols={showCols} /></div>
          {moreBtn}
        </Panel>
        <div className={(desk ? 'grid gap-2 items-start ' : '') + 'min-w-0'} style={desk ? { gridTemplateColumns: 'minmax(0,1.2fr) minmax(16rem,0.8fr)' } : undefined}>
          <div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <button data-cdie-dots={dots ? 'on' : 'off'} className="px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: dots ? tc('#000') : C.amber, background: dots ? C.amber : 'transparent' }} onClick={() => setDots(!dots)}>{LL('DI1 dots', 'Pontos DI1')}</button>
              <span data-cdie-dotnote className="text-[11px]" style={{ color: C.muted }}>{dots ? LL('White dots are DI1 settlement rates at each contract\'s expiry. The step line changes on the business day after each meeting, so a dot can sit below or above a step.', 'Os pontos brancos são as taxas de ajuste do DI1 em cada vencimento. A linha em degrau muda no dia útil seguinte a cada reunião, por isso um ponto pode ficar abaixo ou acima de um degrau.') : LL('DI1 settlement dots hidden.', 'Pontos de ajuste do DI1 ocultos.')}</span>
            </div>
            <XYChart height={330} legend alwaysLegend niceY zeroLine={false} xFmt={x => dBR(fromDay(Math.round(x)))} yFmt={y => cdieNum(y, 2)} yLabel="% p.a." series={chartSeries} />
          </div>
          <div data-cdie-bars>
            <div className="text-[12px]" style={{ color: C.amber }}>{LL('Implied move by meeting (bp)', 'Movimento implícito por reunião (pb)')}</div>
            <HBars raw labelW="w-36" rows={v.path.map((r: any) => ({ label: `${r.label} ${fmtDayMonth(r.decision)}`, v: r.move_bp }))} fmt={x => cdieBp(x)} />
          </div>
        </div>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: desk ? 'minmax(0,1.1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
        <Panel className="min-w-0 w-full overflow-hidden" title={LL(`DI1 – settlement of ${dBRfull(d.ref_date)}`, `DI1 – ajuste de ${dBRfull(d.ref_date)}`)}>
          {!desk && !more && <div data-cdie-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{LL('Showing contract, expiry, rate and path rate.', 'Mostrando contrato, vencimento, taxa e taxa do caminho.')}</div>}
          <div data-cdie-di1 className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst maxH={560} rows={d.contracts} cols={showCols} /></div>
          {moreBtn}
        </Panel>
        <XYChart height={360} legend alwaysLegend niceY xLabel={LL('business years (bd/252)', 'anos úteis (du/252)')} yLabel="% p.a." xFmt={x => cdieNum(x, 1)} yFmt={y => cdieNum(y, 2)} series={[
          { name: LL('Settlement rate', 'Taxa de ajuste'), points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, scatter: true },
          { name: LL('DI1 curve', 'Curva DI1'), points: d.contracts.map((c: any) => [c.du / 252, c.rate]), color: C.amber, width: 1 },
          { name: LL('Forward between expiries', 'Forward entre vencimentos'), points: d.contracts.flatMap((c: any, i: number) => [[i ? d.contracts[i - 1].du / 252 : 0, c.fwd], [c.du / 252, c.fwd]]), color: C.cyan, width: 1, dash: '3 2' },
          { name: LL('Path rate (implied path)', 'Taxa do caminho (trajetória implícita)'), points: d.contracts.filter((c: any) => c.est != null).map((c: any) => [c.du / 252, c.est]), color: C.white, width: 1 },
        ]} />
      </div>}
      {tab === 2 && <div>
        <FnChart height={420} alwaysLegend panes={[
          { stretch: 0.5, series: [{ kind: 'hist', data: d.history.map((h: any) => ({ time: h.date, value: h.next_move_bp, color: h.next_move_bp >= 0 ? C.up : C.down })), title: LL('Next meeting (bp)', 'Próxima reunião (pb)'), decimals: 1 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cum_12m_bp })), color: C.amber, title: LL('Cum. 12m (bp)', 'Acum. 12m (pb)'), decimals: 1 }] },
          { stretch: 0.5, series: [{ kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.year_end_cdi })), color: C.cyan, title: LL('Implied year-end CDI', 'CDI implícito de fim de ano'), decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.di1_1y })), color: C.white, title: LL('DI1 ~1 year', 'DI1 ~1 ano'), decimals: 2 }, { kind: 'line', data: d.history.map((h: any) => ({ time: h.date, value: h.cdi })), color: tc('#777'), dashed: true, title: 'CDI', decimals: 2 }] },
        ]} />
        <Panel title={LL('Sessions', 'Sessões')} className="mt-2 min-w-0 w-full overflow-hidden">
          {!desk && !more && <div data-cdie-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{LL('Showing date, Δ implied, 12-month cumulative and year-end CDI.', 'Mostrando data, Δ implícito, acumulado de 12 meses e CDI de fim de ano.')}</div>}
          <div data-cdie-hist className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst maxH={260} rows={d.history.slice().reverse()} cols={showCols} /></div>
          {moreBtn}
        </Panel>
      </div>}
    </FnScreen>
  )
}

// ======================= CORR =======================
const secName = (raw: string) => { const k = toEN(raw || ''); return k ? (PT() ? PT_SECTOR[k] || k : k) : '—' }
/** mínimo de retornos em datas comuns para mostrar a correlação (senão "—") */
const CORR_MIN = (n: number) => Math.max(20, Math.floor(n * 0.6))
const secKey = (raw: string) => toEN(raw || '')
export function CORRView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const [n, setN] = useState(15), [win, setWin] = useState(252), [freq, setFreq] = useState<'d' | 'w'>('d')
  const [order, setOrder] = useState<'w' | 's' | 'c'>('w')
  const [compact, setCompact] = useState(false)
  const [pair, setPair] = useState<[string, string] | null>(null)
  const desk = useDesktop()
  React.useEffect(() => { if (window.innerWidth < 1024) setCompact(true) }, [])
  const chartRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => { if (pair && chartRef.current) chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [pair])
  const M = useMemo(() => {
    if (!u) return null
    const comps = u.components.slice().sort((a: any, b: any) => b.weight - a.weight).slice(0, n)
    const meta: Record<string, any> = Object.fromEntries(comps.map((c: any) => [c.cod, c]))
    let codes: string[] = ['^BVSP', ...comps.map((c: any) => c.cod)].filter(c => u.close[c])
    const Ln = u.dates.length, step = freq === 'w' ? 5 : 1
    const idx: number[] = []; for (let i = Ln - 1; i >= Math.max(0, Ln - 1 - win); i -= step) idx.unshift(i)
    // retornos entre datas do calendário comum (mesmo índice de data para todos); falta de preço em qualquer ponta → sem retorno
    const R: Record<string, (number | null)[]> = {}
    codes.forEach(c => { const sr = u.close[c]; R[c] = idx.slice(1).map((i, k) => sr[i] != null && sr[idx[k]] != null && sr[idx[k]] > 0 ? sr[i] / sr[idx[k]] - 1 : null) })
    const need = CORR_MIN(idx.length - 1)
    const cc = (p: string, q: string) => { const a: number[] = [], b: number[] = []; R[p].forEach((x, i) => { const y = R[q][i]; if (x != null && y != null) { a.push(x); b.push(y) } }); return a.length >= need ? corr(a, b) : NaN }
    const base = Object.fromEntries(codes.map(p => [p, Object.fromEntries(codes.map(q => [q, p === q ? 1 : cc(p, q)]))]))
    if (order === 's') codes = ['^BVSP', ...codes.slice(1).sort((x, y) => secKey(meta[x]?.sector).localeCompare(secKey(meta[y]?.sector)) || meta[y].weight - meta[x].weight)]
    if (order === 'c') { // agrupamento guloso: começa pelo de maior peso e puxa sempre o mais correlacionado com o último
      const rest = codes.slice(1), out: string[] = []
      while (rest.length) { const last = out[out.length - 1]; let k = 0; if (last) { let best = -2; rest.forEach((c, i) => { const v = base[last][c]; if (isFinite(v) && v > best) { best = v; k = i } }) } out.push(rest.splice(k, 1)[0]) }
      codes = ['^BVSP', ...out]
    }
    const m = codes.map(p => codes.map(q => base[p][q]))
    const avg = codes.map((_, i) => { const xs = m[i].filter((x, j) => j !== i && isFinite(x)); return xs.length ? xs.reduce((s2, x) => s2 + x, 0) / xs.length : NaN })
    return { codes, m, avg, meta, from: u.dates[idx[0]], to: u.dates[Ln - 1], need }
  }, [u, n, win, freq, order])
  const roll = useMemo(() => {
    if (!u || !pair) return null
    const [p, q] = pair, a = u.close[p], b = u.close[q], out: { time: string; value: number }[] = []
    const ra = a.map((x: number, i: number) => i && x != null && a[i - 1] != null ? x / a[i - 1] - 1 : null), rb = b.map((x: number, i: number) => i && x != null && b[i - 1] != null ? x / b[i - 1] - 1 : null)
    for (let i = 64; i < u.dates.length; i++) { const xa: number[] = [], xb: number[] = []; for (let j = i - 62; j <= i; j++) if (ra[j] != null && rb[j] != null) { xa.push(ra[j]); xb.push(rb[j]) } if (xa.length >= 40) out.push({ time: u.dates[i], value: corr(xa, xb) }) }
    return out
  }, [u, pair])
  const title = LL('Correlation of returns — Ibovespa', 'Correlação de retornos — Ibovespa')
  if (!u || !M) return <FnScreen code="CORR" title={title} ownTitle><Loading err={err} /></FnScreen>
  const lbl = (c: string) => c === '^BVSP' ? 'IBOV' : c
  const nameOf = (c: string) => c === '^BVSP' ? LL('Ibovespa index', 'Índice Ibovespa') : calName(c, M.meta[c]?.name, PT())
  const tip = (c: string) => `${lbl(c)} · ${nameOf(c)}${c !== '^BVSP' && M.meta[c] ? ' · ' + secName(M.meta[c].sector) : ''}`
  const showCompact = compact
  const cellBg = (x: number, d: boolean) => d ? tc('#1a1a1a') : heat(x, 1)
  const stickL: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: C.bg }
  const freqTxt = freq === 'w' ? LL('weekly', 'semanais') : LL('daily', 'diários')
  return (
    <FnScreen code="CORR" title={title} ownTitle wrap
      right={<>
        <Field label={LL('Stocks', 'Ações')}><Btns opts={[10, 15, 20].map(v => ({ v, l: LL(`Top ${v} + IBOV`, `Top ${v} + IBOV`) }))} value={n} onChange={setN} /></Field>
        <Field label={LL('Window', 'Janela')}><Btns opts={[{ v: 63, l: '3M' }, { v: 126, l: '6M' }, { v: 252, l: LL('1Y', '1A') }, { v: 504, l: LL('2Y', '2A') }, { v: 749, l: LL('3Y', '3A') }]} value={win} onChange={setWin} /></Field>
        <Btns opts={[{ v: 'd', l: LL('Daily', 'Diário') }, { v: 'w', l: LL('Weekly', 'Semanal') }]} value={freq} onChange={setFreq} />
        <Field label={LL('Order', 'Ordem')}><Btns opts={[{ v: 'w', l: LL('Weight', 'Peso') }, { v: 's', l: LL('Sector', 'Setor') }, { v: 'c', l: LL('Clusters', 'Grupos') }]} value={order} onChange={setOrder} /></Field>
        <Btns opts={[{ v: false, l: LL('Full', 'Completa') }, { v: true, l: LL('Compact', 'Compacta') }]} value={compact} onChange={setCompact} />
      </>}
      note={LL(`Pearson correlation of ${freqTxt} returns from ${dBR(M.from)} to ${dBR(M.to)}, on dates common to both assets, using closes adjusted for splits and distributions. — = fewer than ${M.need} common returns. Top N = largest index weights, plus the Ibovespa itself. Clusters: each stock is followed by the one most correlated with it. Click a cell to see that pair's 63-session rolling correlation.`,
        `Correlação de Pearson dos retornos ${freqTxt} de ${dBR(M.from)} a ${dBR(M.to)}, nas datas comuns aos dois ativos, com fechamentos ajustados por desdobramentos e proventos. — = menos de ${M.need} retornos em comum. Top N = maiores pesos do índice, mais o próprio Ibovespa. Grupos: cada ação é seguida pela mais correlacionada com ela. Clique numa célula para ver a correlação móvel de 63 pregões do par.`)}>
      <div className="flex flex-wrap items-center gap-3 pb-1 text-[11px]" style={{ color: C.muted }}>
        <span data-corr-legend="" className="inline-flex items-center gap-1">−1
          <span style={{ width: 120, height: 10, background: `linear-gradient(90deg, ${heat(-1, 1)}, ${heat(0, 1)}, ${heat(1, 1)})`, border: `1px solid ${C.line}` }} />+1</span>
        <span data-corr-pickhint="">{LL('Click a pair to see its rolling correlation.', 'Clique num par para ver a correlação móvel.')}</span>
        {!desk && <span data-corr-hint="">{LL('Swipe sideways for all columns →', 'Deslize para o lado para ver todas as colunas →')}</span>}
      </div>
      <div className="overflow-auto max-h-[70vh] border" style={{ borderColor: C.line }} data-corr-wrap="">
        <table className="border-collapse text-[11px]" data-corr-table="">
          <thead className="sticky top-0 z-10" style={{ background: C.bg }}><tr>
            <th style={{ ...stickL, zIndex: 3 }}></th>
            {desk && <th className="px-2 text-left font-normal" style={{ color: C.muted }}>{LL('Company', 'Empresa')}</th>}
            {M.codes.map(c => <th key={c} title={tip(c)} className="px-1 py-1 font-normal" style={{ color: C.amber, background: C.bg }}>{lbl(c)}</th>)}
            <th className="px-2 font-normal" style={{ color: C.muted }}>{LL('Average', 'Média')}</th></tr></thead>
          <tbody>{M.codes.map((p, i) => <tr key={p}>
            <td data-corr-rowhead="" title={tip(p)} className="px-2 py-[2px] whitespace-nowrap" style={{ ...stickL, color: C.amber }}>{lbl(p)}</td>
            {desk && <td className="px-2 whitespace-nowrap max-w-[160px] truncate" style={{ color: C.muted }}>{nameOf(p)}</td>}
            {M.m[i].map((x, j) => {
              const diag = i === j, hidden = showCompact && j > i
              if (hidden) return <td key={j} />
              return <td key={j} data-corr-diag={diag ? '' : undefined} title={diag ? tip(p) : `${lbl(p)} × ${lbl(M.codes[j])}`} onClick={() => !diag && isFinite(x) && setPair([p, M.codes[j]])}
                className={`${diag ? '' : 'cursor-pointer'} px-1 py-[2px] text-right border border-[#111]`}
                style={{ background: cellBg(x, diag), color: diag ? C.muted : tc('#fff'), minWidth: showCompact ? 34 : 44, outline: pair && pair[0] === p && pair[1] === M.codes[j] ? `1px solid ${C.amber}` : undefined }}>{diag ? '' : isFinite(x) ? nf(x, 2) : '—'}</td>
            })}
            <td className="px-2 text-right" style={{ color: C.amber }}>{isFinite(M.avg[i]) ? nf(M.avg[i], 2) : '—'}</td></tr>)}</tbody>
        </table>
      </div>
      {roll && pair && <div className="mt-2" ref={chartRef} data-corr-roll="">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: C.amber }}>
          <span>{LL('63-session rolling correlation', 'Correlação móvel de 63 pregões')}: {lbl(pair[0])} × {lbl(pair[1])}</span>
          <button data-corr-close="" className="ml-auto px-2 border text-[11px]" style={{ borderColor: C.line, color: C.muted }} onClick={() => setPair(null)} aria-label={LL('Close', 'Fechar')}>✕ {LL('Close', 'Fechar')}</button>
        </div>
        <FnChart height={220} panes={[{ series: [{ kind: 'line', data: roll, color: C.amber, title: LL('corr 63d', 'corr 63p'), decimals: 2, lines: [{ price: 0, color: tc('#555') }] }] }]} /></div>}
    </FnScreen>
  )
}

// ======================= EQS =======================
type Flt = { sector: string; mcap: number; pe: number; pb: number; dy: number; roe: number; nd: number; liq: number; q: string }
const F0: Flt = { sector: '', mcap: 0, pe: 0, pb: 0, dy: 0, roe: 0, nd: 0, liq: 0, q: '' }
/** múltiplo fora do comum (P/L > 50 ou EV/EBITDA > 30): mostra o número com aviso; base ≤ 0 → n.m. */
const UNUSUAL: Record<string, number> = { pe: 50, ev_ebitda: 30, pb: 15 }
const BANK_NA = new Set(['ev_ebitda', 'nd_ebitda', 'net_margin'])
type EqCol = { k: string; en: string; pt: string; fmt: (v: any) => string; num?: boolean; mob?: boolean }
const EQ_COLS: EqCol[] = [
  { k: 'cod', en: 'Ticker', pt: 'Ticker', fmt: x => x, mob: true }, { k: 'name', en: 'Company', pt: 'Empresa', fmt: x => x, mob: true }, { k: 'sector', en: 'Sector', pt: 'Setor', fmt: x => secName(x) },
  { k: 'price', en: 'Price', pt: 'Preço', fmt: x => nf(x, 2), num: true }, { k: 'pct', en: 'Day chg', pt: 'Var. dia', fmt: x => pf(x), num: true }, { k: 'ytd', en: 'YTD', pt: 'No ano', fmt: x => pf(x, 1), num: true },
  { k: 'mcap', en: 'Mkt cap (company)', pt: 'Valor de mercado (companhia)', fmt: x => big(x, 1), num: true, mob: true }, { k: 'vol_fin_avg30', en: '30d avg liquidity', pt: 'Liquidez média 30d', fmt: x => big(x, 1), num: true },
  { k: 'pe', en: 'P/E', pt: 'P/L', fmt: x => nf(x, 1), num: true, mob: true }, { k: 'pb', en: 'P/B', pt: 'P/VP', fmt: x => nf(x, 2), num: true }, { k: 'ev_ebitda', en: 'EV/EBITDA', pt: 'EV/EBITDA', fmt: x => nf(x, 1), num: true },
  { k: 'dy', en: 'DY 12m', pt: 'DY 12m', fmt: x => pf(x, 1, false), num: true, mob: true }, { k: 'roe', en: 'ROE', pt: 'ROE', fmt: x => pf(x, 1, false), num: true, mob: true }, { k: 'net_margin', en: 'Net mg.', pt: 'Mg. líquida', fmt: x => pf(x, 1, false), num: true },
  { k: 'nd_ebitda', en: 'ND/EBITDA', pt: 'Dív. líq./EBITDA', fmt: x => nf(x, 2), num: true },
]
/** companhias com mais de uma classe na lista (mesmo CNPJ e mesma raiz): valor de mercado e múltiplos da companhia, pela mesma conta do VAL */
function useCompanyFix(rows: any[] | undefined) {
  const [fix, setFix] = useState<Record<string, any>>({})
  React.useEffect(() => {
    if (!rows) return
    const g: Record<string, string[]> = {}
    rows.forEach(r => { if (r.cnpj) { const k = r.cnpj + '|' + String(r.cod).slice(0, 4); (g[k] = g[k] || []).push(r.cod) } })
    const multi = Object.values(g).filter(v => v.length > 1).flat()
    let ok = true
    import('./val').then(({ loadCorp, valuation }) => Promise.all(multi.map(async c => {
      const co = await loadCorp(`${c}.SA`).catch(() => null); if (!co) return null
      const v = valuation(co); const num = (x: any) => (typeof x === 'number' ? x : x === 'nm' ? 'nm' : null)
      return [c, { mcap: v.mcap, pe: num(v.pe), pb: num(v.pb), ev_ebitda: num(v.evEbitda), co: v.mcap != null }] as const
    }))).then(list => { if (ok) setFix(Object.fromEntries(list.filter(Boolean) as any)) }).catch(() => {})
    return () => { ok = false }
  }, [rows])
  return fix
}
export function EQSView() {
  const { data: s, err } = useJSON<any>('screener.json')
  const [f, setF] = useState<Flt>(F0)
  const [sort, setSort] = useState<{ k: string; asc: boolean }>({ k: 'mcap', asc: false })
  const [drawer, setDrawer] = useState(false)
  const [more, setMore] = useState(false)
  const desk = useDesktop()
  const fix = useCompanyFix(s?.rows)
  const all = useMemo(() => (s?.rows as any[] || []).map(x => {
    const fx = fix[x.cod]; const r = { ...x, name: calName(x.cod, x.name, PT()) }
    if (fx?.co) { r.mcap = fx.mcap; r.pe = fx.pe; r.pb = fx.pb; r.ev_ebitda = fx.ev_ebitda; r._co = true }
    return r
  }), [s, fix])
  const rows = useMemo(() => {
    const n = (v: any) => (typeof v === 'number' ? v : null)
    const r = all.filter(x =>
      (!f.sector || toEN(x.sector || '') === f.sector) && (!f.q || (x.cod + ' ' + x.name).toUpperCase().includes(f.q.toUpperCase())) &&
      (!f.mcap || (n(x.mcap) ?? 0) >= f.mcap * 1e9) && (!f.pe || (n(x.pe) != null && x.pe > 0 && x.pe <= f.pe)) && (!f.pb || (n(x.pb) != null && x.pb <= f.pb)) &&
      (!f.dy || (x.dy ?? 0) >= f.dy) && (!f.roe || (x.roe ?? -1e9) >= f.roe) && (!f.nd || (n(x.nd_ebitda) != null && x.nd_ebitda <= f.nd)) && (!f.liq || (x.vol_fin_avg30 ?? 0) >= f.liq * 1e6))
    return r.sort((a, b) => { const x = n(a[sort.k]) ?? (typeof a[sort.k] === 'string' ? a[sort.k] : null), y = n(b[sort.k]) ?? (typeof b[sort.k] === 'string' ? b[sort.k] : null); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * (sort.asc ? 1 : -1) })
  }, [all, f, sort])
  const title = LL('Ibovespa stock screener', 'Screener do Ibovespa')
  if (!s) return <FnScreen code="EQS" title={title} ownTitle><Loading err={err} /></FnScreen>
  const sectors = Array.from(new Set((s.rows as any[]).map(x => toEN(x.sector || '')).filter(Boolean))).sort() as string[]
  const nAct = (Object.keys(F0) as (keyof Flt)[]).filter(k => f[k] !== F0[k]).length
  const num = (k: keyof Flt, label: string, w = 'w-16', step = 1) => <Field label={label}><input className={inputCls + ' ' + w} style={inputStyle} type="number" step={step} value={(f[k] as number) || ''} placeholder="—" onChange={e => setF({ ...f, [k]: +e.target.value || 0 })} /></Field>
  const count = `${rows.length} ${LL('of', 'de')} ${s.rows.length} ${LL('stocks', 'ações')}`
  const cols = EQ_COLS.filter(c => more || c.mob || desk)
  const lab = (c: EqCol) => (PT() ? c.pt : c.en)
  const exp = () => downloadCSV(`eqs_${s.generated_at?.slice(0, 10)}.csv`, EQ_COLS.map(lab), rows.map(r => EQ_COLS.map(c => { const v = r[c.k]; return c.k === 'sector' ? secName(v) : v === 'nm' ? 'n.m.' : v ?? null })))
  const cell = (c: EqCol, x: any, r: any) => {
    if (r.bank && BANK_NA.has(c.k)) return <span data-eqs-bank="" style={{ color: C.muted }} title={LL('Not applicable to banks', 'Não se aplica a bancos')}>{LL('n.a.', 'n.a.')}</span>
    if (x === 'nm' || (['pe', 'pb', 'ev_ebitda'].includes(c.k) && typeof x === 'number' && x <= 0)) return <span data-eqs-nm="" style={{ color: C.muted }} title={LL('Not meaningful: negative or zero base', 'Não significativo: base negativa ou zero')}>{LL('n.m.', 'n.s.')}</span>
    const t = x == null ? '—' : c.fmt(x)
    if (UNUSUAL[c.k] && typeof x === 'number' && x > UNUSUAL[c.k]) return <span data-eqs-unusual="" title={LL('Unusually high: check one-offs in the period', 'Fora do comum: verifique efeitos não recorrentes no período')}>{t} <span style={{ color: C.yellow }}>⚠</span></span>
    if (c.k === 'mcap' && r._co) return <span data-eqs-co="" title={LL('All share classes of the company', 'Todas as classes de ações da companhia')}>{t}</span>
    return t
  }
  return (
    <FnScreen code="EQS" title={title} ownTitle right={<CsvBtn onClick={exp} />}
      note={LL('Market cap = company total (all share classes; multi-class companies priced class by class). DY = distributions paid in the last 12 months ÷ price. Fundamentals: last 12 months (sum of 4 quarters) from the latest quarterly/annual filings; equity and debt from the latest balance sheet. n.a. = not applicable to banks; n.m. = negative or zero base; ⚠ = unusually high multiple. Click a header to sort.',
        'Valor de mercado = total da companhia (todas as classes; companhias com mais de uma classe somadas classe a classe). DY = proventos pagos em 12 meses ÷ preço. Fundamentos: últimos 12 meses (soma de 4 trimestres) dos últimos demonstrativos trimestrais/anuais; patrimônio e dívida do último balanço. n.a. = não se aplica a bancos; n.s. = base negativa ou zero; ⚠ = múltiplo fora do comum. Clique no cabeçalho para ordenar.')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 lg:hidden">
        <button data-eqs-filters="" className="px-3 py-1 text-[12px] border font-bold" style={{ borderColor: drawer ? C.amber : C.line, color: drawer ? tc('#000') : C.amber, background: drawer ? C.amber : C.panel }} onClick={() => setDrawer(!drawer)}>
          {LL('Filters', 'Filtros')}{nAct ? ` (${nAct})` : ''} {drawer ? '▾' : '▸'}
        </button>
        {nAct > 0 && <button className="px-2 py-1 text-[12px] border" style={{ borderColor: C.line, color: C.muted }} onClick={() => setF(F0)}>{LL('Clear all', 'Limpar tudo')}</button>}
        <button data-eqs-more="" className="px-2 py-1 text-[12px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? LL('Fewer columns', 'Menos colunas') : LL('More columns', 'Mais colunas')}</button>
        <span className="ml-auto text-[12px]" style={{ color: C.amber }}>{count}</span>
      </div>
      <div className={`mb-2 flex flex-wrap items-end gap-3 border p-2 ${drawer ? '' : 'max-lg:hidden'}`} style={{ borderColor: C.line, background: C.panel }}>
        <Field label={LL('Search', 'Buscar')}><input className={inputCls + ' w-28'} style={inputStyle} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Field>
        <Field label={LL('Sector', 'Setor')}><select data-eqs-sector="" className={inputCls + ' max-w-[180px]'} style={inputStyle} value={f.sector} onChange={e => setF({ ...f, sector: e.target.value })}><option value="">{LL('All', 'Todos')}</option>{sectors.map(x => <option key={x} value={x}>{PT() ? PT_SECTOR[x] || x : x}</option>)}</select></Field>
        {num('mcap', LL('Mkt cap ≥ (R$ bn)', 'Valor de mercado ≥ (R$ bi)'))}{num('liq', LL('Liq. 30d ≥ (R$ mn)', 'Liq. 30d ≥ (R$ mi)'))}{num('pe', LL('P/E ≤', 'P/L ≤'))}{num('pb', LL('P/B ≤', 'P/VP ≤'), 'w-16', 0.1)}{num('dy', 'DY ≥ %', 'w-16', 0.5)}{num('roe', 'ROE ≥ %')}{num('nd', LL('ND/EBITDA ≤', 'Dív. líq./EBITDA ≤'), 'w-16', 0.5)}
        <button className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.line, color: C.muted }} onClick={() => setF(F0)}>{LL('Clear', 'Limpar')}{nAct ? ` (${nAct})` : ''}</button>
        <span className="ml-auto text-[12px] max-lg:hidden" style={{ color: C.amber }} data-eqs-count="">{count}</span>
      </div>
      <div className="lg:hidden text-[11px] pb-1" style={{ color: C.muted }} data-eqs-hint="">{LL('Swipe sideways for all columns →', 'Deslize para o lado para ver todas as colunas →')}</div>
      <Grid maxH={600} rows={rows} cols={cols.map(c => ({
        k: c.k, align: c.num ? 'r' : 'l', w: c.k === 'name' ? '150px' : c.k === 'sector' ? '150px' : undefined,
        label: <span className="cursor-pointer whitespace-nowrap" onClick={() => setSort({ k: c.k, asc: sort.k === c.k ? !sort.asc : !c.num })}>{lab(c)}{sort.k === c.k ? (sort.asc ? ' ▲' : ' ▼') : ''}</span>,
        fmt: (x: any, r: any) => cell(c, x, r), color: (x: any) => c.k === 'cod' ? C.amber : ['pct', 'ytd'].includes(c.k) ? clr(x) : C.text,
      })) as any} />
    </FnScreen>
  )
}

// ======================= GC =======================
function nearestKey(keys: string[], target: string) { let best: string | null = null; keys.forEach(k => { if (k <= target) best = k }); return best }
export function GCView() {
  const { data: g, err } = useJSON<any>('curves.json')
  const di = useJSON<any>('cdie.json')
  const [tab, setTab] = useState(0)
  const [cmp, setCmp] = useState<string[]>(['w1', 'm1'])
  const [td, setTd] = useState<'pre' | 'ipca'>('pre')
  const LBL: Record<string, string> = { now: 'Current', w1: '1 week', m1: '1 month', m3: '3 months', y1: '1 year' }
  const COLS: Record<string, string> = { now: C.amber, w1: C.white, m1: C.cyan, m3: C.purple, y1: tc('#888') }
  const curves = useMemo(() => {
    if (!g) return null
    const sets: Record<string, { date: string; pts: { x: number; y: number; l: string }[] }> = {}
    if (tab === 0 && di.data) {
      const keys = Object.keys(di.data.curves).sort(), last = keys[keys.length - 1]
      const off: Record<string, number> = { now: 0, w1: 7, m1: 30, m3: 91, y1: 365 }
      Object.entries(off).forEach(([k, dd]) => { const key = nearestKey(keys, fromDay(dayNum(last) - dd)); if (key && (k === 'now' || key !== last)) sets[k] = { date: key, pts: di.data.curves[key].map((c: any) => ({ x: c[2] / 252, y: c[3], l: c[0] })) } })
    } else if (tab === 1) {
      const name = td === 'pre' ? 'Tesouro Prefixado' : 'Tesouro IPCA+'
      Object.entries(g.td[td] || {}).forEach(([k, v]: any) => { sets[k] = { date: v.date, pts: v.points.filter((p: any) => p[2] === name).map((p: any) => ({ x: p[0], y: p[1], l: dBR(p[3]) })) } })
    } else if (tab === 2) {
      Object.entries(g.us).forEach(([k, v]: any) => { sets[k] = { date: v.date, pts: v.points.map((p: any) => ({ x: p[0], y: p[1], l: p[2] })) } })
    }
    return sets
  }, [g, di.data, tab, td])
  if (!g || !curves) return <FnScreen code="GC"><Loading err={err} /></FnScreen>
  const now = curves.now
  const avail = ['w1', 'm1', 'm3', 'y1'].filter(k => curves[k])
  const shown = ['now', ...cmp].filter(k => curves[k])
  const tableRows = now ? now.pts.map(p => { const r: any = { l: p.l, x: p.x, now: p.y }; avail.forEach(k => { const q = curves[k].pts.find(z => z.l === p.l); r[k] = q ? (p.y - q.y) * 100 : null }); return r }) : []
  const toggle = (k: string) => setCmp(cmp.includes(k) ? cmp.filter(x => x !== k) : [...cmp, k])
  const unit = tab === 2 ? 'Treasury (% p.a.)' : tab === 1 ? (td === 'pre' ? 'Fixed-rate (% p.a.)' : 'IPCA+ (real rate, % p.a.)') : 'DI1 (% p.a.)'
  return (
    <FnScreen code="GC" title="Yield curves – Brazil and US" tabs={['Brazil – DI1', 'Brazil – Tesouro Direto', 'US – Treasuries']} tab={tab} setTab={setTab}
      right={<>{tab === 1 && <Btns opts={[{ v: 'pre', l: 'Fixed-rate' }, { v: 'ipca', l: 'IPCA+' }]} value={td} onChange={setTd} />}<span className="text-[12px]" style={{ color: C.muted }}>Compare:</span>{avail.map(k => <button key={k} onClick={() => toggle(k)} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: COLS[k], color: cmp.includes(k) ? tc('#000') : COLS[k], background: cmp.includes(k) ? COLS[k] : 'transparent' }}>{LBL[k]}</button>)}</>}
      source={tab === 0 ? 'B3 – Daily Bulletin (DI1 settlement rate), via cdie.json' : tab === 1 ? g.td_source : 'FRED – Treasury constant maturity (DGS1MO…DGS30)'}
      note={tab === 0 ? 'X axis in business years (bd/252). DI1 history only covers sessions already collected from the Daily Bulletin; longer comparisons appear as the pipeline accumulates sessions.' : tab === 1 ? 'Zero-coupon bonds (Tesouro Prefixado / Tesouro IPCA+), morning bid rate published by the Treasury; X axis in calendar years to maturity.' : 'Treasury par curve (constant maturity), X axis in years.'}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <div className="min-w-0"><XYChart height={300} legend xLabel={tab === 0 ? 'business years' : 'years'} yLabel={unit} xFmt={x => nf(x, 1)} yFmt={y => nf(y, 2)} series={shown.flatMap(k => [
          { name: `${LBL[k]} (${dBR(curves[k].date)})`, points: curves[k].pts.map(p => [p.x, p.y] as [number, number]), color: COLS[k], width: k === 'now' ? 2 : 1, dash: k === 'now' ? undefined : '4 3' },
        ])} />
        <div className="mt-2"><VertexBars height={170} labels={tableRows.map((r: any) => String(r.l))}
          groups={avail.filter(k => cmp.includes(k)).map(k => ({ name: `vs ${LBL[k]} (${dBR(curves[k].date)})`, values: tableRows.map((r: any) => r[k]) }))} /></div></div>
        <Panel title={`${unit} — Δ in bp vs. previous dates`}>
          <Grid maxH={440} rows={tableRows} cols={[
            { k: 'l', label: tab === 1 ? 'Expiry' : 'Tenor', color: () => C.amber },
            { k: 'now', label: dBR(now?.date), align: 'r', fmt: x => nf(x, 2) },
            ...avail.map(k => ({ k, label: `Δ ${LBL[k]}`, align: 'r' as const, fmt: (x: any) => bp(x, 0), color: (x: any) => clr(x) })),
          ]} />
        </Panel>
      </div>
      {tab === 2 && <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>{Object.entries(g.us_money).map(([k, v]: any) => <Panel key={k} title={`${({ DFF: 'Effective Fed Funds', SOFR: 'SOFR', DTB3: 'T-bill 3M' } as any)[k] || k} · ${nf(v.last, 2)}% (${dBR(v.date)})`}><FnChart height={140} panes={[{ series: [{ kind: 'line', data: v.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.amber, decimals: 2 }] }]} /></Panel>)}</div>}
    </FnScreen>
  )
}

// ======================= ECFC =======================
const FUNIT: Record<string, string> = { 'IPCA': '% p.a.', 'PIB Total': '% p.a.', 'Selic': '% p.a. (year-end)', 'Câmbio': 'R$/US$ (year-end)', 'IGP-M': '% p.a.', 'IPCA Administrados': '% p.a.', 'Conta corrente': 'US$ bn', 'Balança comercial': 'US$ bn', 'IDP': 'US$ bn', 'Dívida líquida do setor público': '% GDP', 'Resultado primário': '% GDP', 'Resultado nominal': '% GDP' }
export function ECFCView() {
  const { data: f, err } = useJSON<any>('focus.json')
  const [sel, setSel] = useState('IPCA')
  if (!f) return <FnScreen code="ECFC"><Loading err={err} /></FnScreen>
  const refs: string[] = f.refs.map(String), inds = Object.keys(f.indicators)
  const I = f.indicators[sel] || f.indicators[inds[0]]
  const unitOf = (k: string) => FUNIT[k] ?? Object.entries(FUNIT).find(([p]) => k.startsWith(p))?.[1] ?? ''
  const rows = inds.map(k => { const r: any = { k, unit: unitOf(k), date: f.indicators[k].date }; refs.forEach(y => { const s = f.indicators[k].snap?.[y]; r[y] = s?.median; r[y + 'd'] = s && s.w4 != null ? s.median - s.w4 : null }); return r })
  const arrow = (d: number | null) => d == null || Math.abs(d) < 1e-9 ? '' : d > 0 ? ' ▲' : ' ▼'
  return (
    <FnScreen code="ECFC" title="Economic forecasts – Brazil (market survey)"
      source={f.source} note="Median of the institutions' forecasts in the central bank's weekly market survey (annual). Arrow = change in the median over the last 4 weeks. Click a row to see the dispersion (mean, std. dev., min, max, no. of respondents) and the median's evolution.">
      <Grid onRow={(r: any) => setSel(r.k)} rowStyle={(r: any) => r.k === sel ? { background: tc('#2a1d08') } : undefined} rows={rows} cols={[
        { k: 'k', label: 'Indicator', color: () => C.amber }, { k: 'unit', label: 'Unit', color: () => C.muted },
        ...refs.map(y => ({ k: y, label: y, align: 'r' as const, fmt: (x: any, r: any) => <>{nf(x, 2)}<span style={{ color: r[y + 'd'] > 0 ? C.up : C.down }}>{arrow(r[y + 'd'])}</span></> })),
        { k: 'date', label: 'Date', align: 'r', fmt: x => dBR(x) },
      ]} />
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)' }}>
        <Panel title={`${sel} — forecast dispersion (${dBR(I.date)})`}>
          <Grid rows={refs.map(y => ({ y, ...(I.snap?.[y] || {}) }))} cols={[
            { k: 'y', label: 'Year', color: () => C.amber }, { k: 'median', label: 'Median', align: 'r', fmt: x => nf(x, 2), color: () => C.amber }, { k: 'mean', label: 'Average', align: 'r', fmt: x => nf(x, 2) },
            { k: 'sd', label: 'Std. dev.', align: 'r', fmt: x => nf(x, 2) }, { k: 'min', label: 'Min', align: 'r', fmt: x => nf(x, 2) }, { k: 'max', label: 'Max', align: 'r', fmt: x => nf(x, 2) },
            { k: 'n', label: 'Resp.', align: 'r' }, { k: 'w1', label: '1 wk ago', align: 'r', fmt: x => nf(x, 2) }, { k: 'w4', label: '4 wk ago', align: 'r', fmt: x => nf(x, 2) },
          ]} />
        </Panel>
        <Panel title={`${sel} — median evolution`}>
          <FnChart height={240} panes={[{ series: refs.filter(y => I.hist?.[y]?.length).map((y, i) => ({ kind: 'line' as const, data: I.hist[y].map((p: any) => ({ time: p[0], value: p[1] })), color: PALETTE[(i + 1) % PALETTE.length], title: y, decimals: 2 })) }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= ECST =======================
type Row = { label: string; group: string; unit: string; pts: [string, number][]; period: (iso: string) => string; src: string; dec?: number }
const qLabel = (iso: string) => fmtQuarter(Math.ceil(+iso.slice(5, 7) / 3), iso.slice(0, 4))
/** Período do SIDRA no mesmo formato das demais linhas: mês 'Aug 26', trimestre 'Q2 26', trimestre móvel 'Jun–Aug 26'. */
const sidraPeriod = (l: string | undefined, iso: string) => {
  if (!l) return mLabel(iso)
  const q = l.match(/^(\d)º trimestre (\d{4})$/); if (q) return fmtQuarter(+q[1], q[2])
  if (/^[A-Za-zÀ-ÿ]{3}-[A-Za-zÀ-ÿ]{3}-[A-Za-zÀ-ÿ]{3} \d{4}$/.test(l)) { const m = +iso.slice(5, 7), a = ((m + 9) % 12) + 1; return `${monthAbbr(a)}–${mLabel(iso)}` }
  if (/^[A-Za-zÀ-ÿ]+ \d{4}$/.test(l)) return mLabel(iso)
  return en(l)
}
function sidraDate(id: string, code: string) { const y = code.slice(0, 4), n = +code.slice(4); return id.startsWith('pib') ? `${y}-${String(n * 3).padStart(2, '0')}-01` : `${y}-${String(n).padStart(2, '0')}-01` }
export function ECSTView() {
  const { data: e, err } = useJSON<any>('econ.json')
  const s = useJSON<any>('ecst.json')
  const [sel, setSel] = useState<string>('IPCA 12m')
  const rows = useMemo(() => {
    if (!e) return null
    const S = (id: string) => (e.series as any[]).find(x => x.id === id)?.points as [string, number][] | undefined
    const monthly = (p?: [string, number][]) => { if (!p) return []; const m = new Map<string, [string, number]>(); p.forEach(x => m.set(x[0].slice(0, 7), x)); return Array.from(m.values()) }
    const yoy = (p: [string, number][], k = 12) => p.slice(k).map((x, i) => [x[0], (x[1] / p[i][1] - 1) * 100] as [string, number])
    const diff = (p: [string, number][]) => p.slice(1).map((x, i) => [x[0], x[1] - p[i][1]] as [string, number])
    const X = (id: string) => { const q = s.data?.sidra?.find((x: any) => x.id === id); return q ? { pts: q.points.map((p: any) => [sidraDate(id, p[0]), p[2]] as [string, number]), lbl: Object.fromEntries(q.points.map((p: any) => [sidraDate(id, p[0]), p[1]])) as Record<string, string> } : null }
    const out: Row[] = []
    const add = (group: string, label: string, unit: string, pts: [string, number][] | undefined | null, period: (iso: string) => string, src: string, dec = 2) => { if (pts && pts.length) out.push({ group, label, unit, pts, period, src, dec }) }
    const sx = (id: string, label: string, unit: string, dec = 1) => { const q = X(id); if (q) add('Brazil', label, unit, q.pts, iso => sidraPeriod(q.lbl[iso], iso), 'IBGE SIDRA', dec) }
    add('Brazil', 'Selic target', '% p.a.', monthly(S('SGS432')), mLabel, 'BCB SGS 432')
    sx('pib_qq', 'GDP – q/q (SA)', '% t/t'); sx('pib_aa', 'GDP – y/y', '% y/y')
    add('Brazil', 'IPCA monthly', '% m/m', S('SGS433'), mLabel, 'BCB SGS 433')
    add('Brazil', 'IPCA 12m', '% 12m', S('SGS13522'), mLabel, 'BCB SGS 13522')
    sx('ipca15', 'IPCA-15 monthly', '% m/m', 2)
    add('Brazil', 'IGP-M monthly', '% m/m', S('SGS189'), mLabel, 'BCB SGS 189')
    sx('desemprego', 'Unemployment (PNAD, rolling quarter)', '%')
    add('Brazil', 'IBC-Br – 12m chg', '% y/y', S('SGS24363') ? yoy(S('SGS24363')!) : null, mLabel, 'BCB SGS 24363', 1)
    sx('pim', 'Industrial production (m/m SA)', '%'); sx('pmc', 'Retail sales (m/m SA)', '%'); sx('pms', 'Services volume (m/m SA)', '%')
    add('Brazil', 'General government gross debt', '% GDP', S('SGS13762'), mLabel, 'BCB SGS 13762', 1)
    add('Brazil', 'Primary balance 12m', '% GDP', S('SGS5793'), mLabel, 'BCB SGS 5793')
    add('Brazil', 'Trade balance', 'US$ mn', S('SGS22707'), mLabel, 'BCB SGS 22707', 0)
    add('Brazil', 'International reserves', 'US$ mn', monthly(S('SGS3546')), mLabel, 'BCB SGS 3546', 0)
    add('Brazil', 'USD PTAX (ask)', 'R$/US$', monthly(S('SGS1')), mLabel, 'BCB SGS 1', 4)
    add('US', 'Effective Fed Funds', '%', S('FEDFUNDS'), mLabel, 'FRED FEDFUNDS')
    add('US', 'CPI – 12m chg', '% y/y', S('CPIAUCSL') ? yoy(S('CPIAUCSL')!) : null, mLabel, 'FRED CPIAUCSL', 1)
    add('US', 'Unemployment', '%', S('UNRATE'), mLabel, 'FRED UNRATE', 1)
    add('US', 'Payrolls – jobs created', 'thousand', S('PAYEMS') ? diff(S('PAYEMS')!) : null, mLabel, 'FRED PAYEMS', 0)
    add('US', 'Real GDP – q/q annualized', '% p.a.', S('GDPC1') ? S('GDPC1')!.slice(1).map((x, i) => [x[0], ((x[1] / S('GDPC1')![i][1]) ** 4 - 1) * 100] as [string, number]) : null, qLabel, 'FRED GDPC1', 1)
    add('US', 'Treasury 10Y', '%', monthly(S('DGS10')), mLabel, 'FRED DGS10')
    add('US', 'Spread 10Y–2Y', 'p.p.', monthly(S('T10Y2Y')), mLabel, 'FRED T10Y2Y')
    return out
  }, [e, s.data])
  if (!e || !rows) return <FnScreen code="ECST"><Loading err={err} /></FnScreen>
  const cur = rows.find(r => r.label === sel) || rows[0]
  return (
    <FnScreen code="ECST" title="Economic statistics – Brazil and US"
      source="BCB SGS, IBGE SIDRA (GDP, PNAD Contínua, PIM, PMC, PMS, IPCA-15) and FRED (US)."
      note="Latest released value of each indicator, the previous one and the change; sparkline with the last 24 observations. Daily series are sampled at each month end. Click a row for the full history.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <Grid maxH={640} onRow={(r: any) => setSel(r.label)} rowStyle={(r: any) => r.label === cur.label ? { background: tc('#2a1d08') } : undefined}
          rows={rows.map(r => { const n = r.pts.length, l = r.pts[n - 1], p = r.pts[n - 2]; return { ...r, last: l[1], prev: p?.[1], per: r.period(l[0]), chg: p ? l[1] - p[1] : null, spark: r.pts.slice(-24).map(x => x[1]) } })}
          cols={[
            { k: 'group', label: 'Country', color: () => C.muted }, { k: 'label', label: 'Indicator', color: () => C.amber }, { k: 'per', label: 'Period' },
            { k: 'last', label: 'Last', align: 'r', fmt: (x, r: any) => nf(x, r.dec), color: () => C.white }, { k: 'prev', label: 'Previous', align: 'r', fmt: (x, r: any) => nf(x, r.dec) },
            { k: 'chg', label: 'Var.', align: 'r', fmt: (x, r: any) => x == null ? '—' : `${x > 0 ? '+' : ''}${nf(x, r.dec)}`, color: x => clr(x) },
            { k: 'unit', label: 'Unit', color: () => C.muted }, { k: 'spark', label: '24 obs.', fmt: x => <Spark data={x} color={C.amber} /> },
          ]} />
        <Panel title={`${cur.label} (${cur.unit})`}>
          <FnChart height={420} panes={[{ series: [{ kind: cur.unit.startsWith('% m') || cur.unit.includes('t/t') || cur.unit === 'thousand' || cur.unit === '%' && cur.label.includes('m/m') ? 'hist' : 'line', data: cur.pts.map(p => ({ time: p[0], value: p[1], color: p[1] >= 0 ? C.amber : C.down })), color: C.amber, title: cur.label, decimals: cur.dec }] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= WCRS =======================
const CNAME: Record<string, string> = { USD: 'US dollar', BRL: 'Brazilian real', EUR: 'Euro', GBP: 'British pound', JPY: 'Japanese yen', CHF: 'Swiss franc', CAD: 'Canadian dollar', AUD: 'Australian dollar', CNY: 'Chinese yuan', MXN: 'Mexican peso', ARS: 'Argentine peso', CLP: 'Chilean peso', INR: 'Indian rupee', NZD: 'New Zealand dollar', SEK: 'Swedish krona', NOK: 'Norwegian krone', DKK: 'Danish krone', PLN: 'Zloty', ZAR: 'Rand', TRY: 'Turkish lira', KRW: 'Won', HKD: 'Hong Kong dollar', SGD: 'Singapore dollar', COP: 'Colombian peso', PEN: 'Peruvian sol', IDR: 'Indonesian rupiah', ILS: 'Shekel' }
export function WCRSView() {
  const { data: d, err } = useJSON<any>('fx.json')
  const [base, setBase] = useState<'USD' | 'BRL'>('USD')
  const [per, setPer] = useState('1M')
  const T = useMemo(() => {
    if (!d) return null
    const dates: string[] = d.dates, L = dates.length - 1
    const ccys = ['USD', ...Object.keys(d.usd_per)].filter(c => c !== base)
    const up = (c: string, i: number) => c === 'USD' ? 1 : d.usd_per[c]?.[i]
    const px = (c: string, i: number) => { const a = up(c, i), b = up(base, i); return a && b ? b / a : null } // valor de 1 unidade da moeda na base
    const at = (t: string) => { let i = L; while (i > 0 && dates[i] > t) i--; return i }
    const off: Record<string, number> = { '1D': L - 1, '1S': at(fromDay(dayNum(dates[L]) - 7)), '1M': at(fromDay(dayNum(dates[L]) - 30)), '3M': at(fromDay(dayNum(dates[L]) - 91)), 'YTD': at(`${dates[L].slice(0, 4)}-01-01`) - 0, '1A': at(fromDay(dayNum(dates[L]) - 365)) }
    const last = (c: string) => { let i = L; while (i > 0 && px(c, i) == null) i--; return i }
    const rows = ccys.map(c => { const li = last(c), v = px(c, li); const r: any = { c, name: CNAME[c] || c, v, date: dates[li] }; Object.entries(off).forEach(([k, i]) => { let j = i; while (j > 0 && px(c, j) == null) j--; const p = px(c, j); r[k] = v != null && p ? (v / p - 1) * 100 : null }); return r })
    return { rows: rows.sort((a, b) => (b[per] ?? -1e9) - (a[per] ?? -1e9)), date: dates[L] }
  }, [d, base, per])
  if (!d || !T) return <FnScreen code="WCRS"><Loading err={err} /></FnScreen>
  const P = ['1D', '1S', '1M', '3M', 'YTD', '1A']
  return (
    <FnScreen code="WCRS" title={`Currency ranking vs ${base === 'USD' ? 'dollar' : 'real'}`}
      right={<><Field label="Base"><Btns opts={[{ v: 'USD', l: 'USD' }, { v: 'BRL', l: 'BRL' }]} value={base} onChange={setBase} /></Field><Field label="Sort by"><Btns opts={P} value={per} onChange={setPer} /></Field></>}
      source={d.source} note={`Change in the value of 1 unit of each currency measured in ${base} (positive = the currency appreciated against the ${base}). Daily closing quotes (spot), crossed via the dollar. Date: ${dBRfull(T.date)}.`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <Grid rows={T.rows.map((r, i) => ({ ...r, rk: i + 1 }))} cols={[
          { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'c', label: 'Currency', color: () => C.amber }, { k: 'name', label: 'Name' },
          { k: 'v', label: `Quote (${base})`, align: 'r', fmt: x => nf(x, x < 0.01 ? 6 : x < 1 ? 4 : 4) },
          ...P.map(k => ({ k, label: perLabel(k), align: 'r' as const, fmt: (x: any) => pf(x), color: (x: any) => k === per ? (x >= 0 ? C.up : C.down) : clr(x) })),
        ]} />
        <Panel title={`${perLabel(per)} change vs ${base}`}><HBars rows={T.rows.map(r => ({ label: r.c, v: r[per] }))} fmt={x => pf(x)} /></Panel>
      </div>
    </FnScreen>
  )
}

// ======================= GLCO =======================
export function GLCOView() {
  const { data: f, err } = useJSON<any>('futures.json')
  const wl = useWorldLive()
  const [sel, setSel] = useState('CL=F')
  if (!f) return <FnScreen code="GLCO"><Loading err={err} /></FnScreen>
  const now = Date.now(), used: WQuote[] = []
  const rows = (f.rows as any[]).map((r0, i, a) => {
    const q = wl?.quotes?.[r0.ticker]
    const ap = applyQuote(r0.series.map((p: any) => p[0]), r0.series.map((p: any) => p[1]), q)
    let r = r0
    if (ap.applied && q) {
      used.push(q)
      // último negócio sobre o ajuste anterior; as variações de período seguem nos fechamentos (retrato diário)
      r = { ...r0, last: q[0], chg: q[0] - q[1], pct: (q[0] / q[1] - 1) * 100, date: ap.dates[ap.dates.length - 1], series: ap.dates.map((t: string, k: number) => [t, ap.close[k]]), live: quoteFresh(q, now) }
    }
    return { ...r, g: i === 0 || a[i - 1].group !== r.group ? r.group : '', spark: r.series.slice(-60).map((p: any) => p[1]) }
  })
  const cur = rows.find(r => r.ticker === sel) || rows[0]
  const live: LiveInfo | null = used.length ? quotesBadge(used, wl ? Date.parse(wl.generated_at) : null, now) : null
  const nLive = rows.filter(r => r.live).length
  const pt = lang() === 'pt'
  const note = pt
    ? 'Contrato contínuo do primeiro vencimento. Último, Var. e Var.% usam o último negócio visto pelo monitor de dados do site (atualizado a cada poucos minutos nos dias úteis, com atraso) sobre o ajuste anterior; ● = negociou nos últimos 30 minutos. As variações de 1S a 1A e a faixa de 52 semanas usam os fechamentos diários. Sem o monitor, a tela mostra o fechamento diário. Clique numa linha para ver o gráfico.'
    : 'Front-month continuous contract. Last, Var. and Var.% use the latest trade seen by the site’s data watcher (refreshed every few minutes on weekdays, delayed) over the previous settlement; ● = traded in the last 30 minutes. 1W to 1Y changes and the 52-week range use daily closes. When the watcher is unavailable the screen shows the daily close. Click a row for the chart.'
  return (
    <FnScreen code="GLCO" title="Global commodities – futures (front month)" note={note} live={live}
      right={nLive ? <span className="text-[11px]" style={{ color: C.muted }} data-glco-nlive>{pt ? `● negociando agora: ${nLive} de ${rows.length}` : `● trading now: ${nLive} of ${rows.length}`}</span> : undefined}>
      <Grid onRow={(r: any) => setSel(r.ticker)} rowStyle={(r: any) => r.ticker === cur.ticker ? { background: tc('#2a1d08') } : undefined} rows={rows} cols={[
        { k: 'g', label: 'Group', color: () => C.amber }, { k: 'name', label: 'Commodity', color: () => C.white }, { k: 'ticker', label: 'Ticker', color: () => C.muted }, { k: 'exchange', label: 'Exchange', color: () => C.muted }, { k: 'unit', label: 'Unit', color: () => C.muted },
        { k: 'last', label: 'Last', align: 'r', fmt: (x, r: any) => <span data-glco-live={r.live ? '1' : undefined}>{nf(x, x >= 1000 ? 1 : 2)}{r.live ? <span style={{ color: C.up }}> ●</span> : null}</span>, color: () => C.amber }, { k: 'chg', label: 'Var.', align: 'r', fmt: x => nf(x, 2), color: x => clr(x) }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'w1', label: '1W', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm1', label: '1M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'm3', label: '3M', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'ytd', label: 'YTD', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'y1', label: '1Y', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
        { k: 'lo52', label: '52w Low', align: 'r', fmt: x => nf(x, 2) }, { k: 'hi52', label: '52w High', align: 'r', fmt: x => nf(x, 2) }, { k: 'spark', label: '3 months', fmt: x => <Spark data={x} color={C.amber} /> }, { k: 'date', label: 'Date', fmt: x => dBR(x), color: () => C.muted },
      ]} />
      <Panel title={`${cur.name} (${cur.ticker}) — ${cur.unit}`} className="mt-2">
        <FnChart height={260} panes={[{ series: [{ kind: 'area', data: cur.series.map((p: any) => ({ time: p[0], value: p[1] })), color: C.white, title: cur.ticker, lines: [{ price: cur.hi52, color: tc('#555'), title: '52w high' }, { price: cur.lo52, color: tc('#555'), title: '52w low' }] }] }]} />
      </Panel>
    </FnScreen>
  )
}

// ======================= MOST =======================
export function MOSTView() {
  const { data: s, err } = useJSON<any>('screener.json')
  const [tab, setTab] = useState(0)
  if (!s) return <FnScreen code="MOST"><Loading err={err} /></FnScreen>
  const R = (s.rows as any[]).filter(r => r.price != null).map(r => ({ ...r, rel: r.vol_fin && r.vol_fin_avg30 ? r.vol_fin / r.vol_fin_avg30 : null, dhi: r.hi52 ? (r.price / r.hi52 - 1) * 100 : null, dlo: r.lo52 ? (r.price / r.lo52 - 1) * 100 : null }))
  const sorters: ((a: any, b: any) => number)[] = [(a, b) => (b.vol_fin ?? 0) - (a.vol_fin ?? 0), (a, b) => (b.pct ?? -1e9) - (a.pct ?? -1e9), (a, b) => (a.pct ?? 1e9) - (b.pct ?? 1e9), (a, b) => (b.rel ?? 0) - (a.rel ?? 0), (a, b) => (b.dhi ?? -1e9) - (a.dhi ?? -1e9), (a, b) => (a.dlo ?? 1e9) - (b.dlo ?? 1e9)]
  const rows = R.slice().sort(sorters[tab]).slice(0, 30).map((r, i) => ({ ...r, rk: i + 1 }))
  const date = R.find(r => r.date)?.date
  return (
    <FnScreen code="MOST" title={`Most active – Ibovespa (${dBRfull(date)})`} tabs={['Traded value', 'Top gainers', 'Top losers', 'Unusual volume', 'Near 52w high', 'Near 52w low']} tab={tab} setTab={setTab}
      source={s.source} note="Universe: Ibovespa stocks. Traded value of the last session (R$); abnormal volume = day volume ÷ 30-session average. Distance to 52-week highs/lows using daily closes.">
      <Grid rows={rows} cols={[
        { k: 'rk', label: '#', align: 'r', color: () => C.muted }, { k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Company', w: '200px' }, { k: 'sector', label: 'Sector', w: '170px', color: () => C.muted },
        { k: 'price', label: 'Last', align: 'r', fmt: x => nf(x, 2), color: () => C.white }, { k: 'pct', label: 'Var.%', align: 'r', fmt: x => pf(x), color: x => clr(x) },
        { k: 'vol_fin', label: 'Volume R$', align: 'r', fmt: x => big(x, 2) }, { k: 'vol_qty', label: 'No. of stocks', align: 'r', fmt: x => big(x, 1) }, { k: 'vol_fin_avg30', label: '30d avg R$', align: 'r', fmt: x => big(x, 2) },
        { k: 'rel', label: 'Vol./avg', align: 'r', fmt: x => x == null ? '—' : `${nf(x, 2)}×`, color: x => x > 1.5 ? C.yellow : C.text },
        { k: 'dhi', label: 'Dist. 52w high', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) }, { k: 'dlo', label: 'Dist. 52w low', align: 'r', fmt: x => pf(x, 1), color: x => clr(x) },
      ]} />
    </FnScreen>
  )
}

// ======================= BTMM =======================
export function BTMMView() {
  const di = useJSON<any>('cdie.json'), cv = useJSON<any>('curves.json'), fx = useJSON<any>('fx.json'), fu = useJSON<any>('futures.json'), ec = useJSON<any>('econ.json')
  const v = useMemo(() => {
    if (!di.data || !cv.data) return null
    const d = di.data, keys = Object.keys(d.curves).sort(), prevK = keys[keys.length - 2]
    const prev = new Map<string, number>((prevK ? d.curves[prevK] : []).map((c: any) => [c[0], c[3]]))
    const pick = (d.contracts as any[]).filter((c, i) => i < 3 || c.code.startsWith('DI1F')).slice(0, 12).map(c => ({ ...c, chg: prev.has(c.code) ? (c.rate - prev.get(c.code)!) * 100 : null }))
    const tdRows = (k: 'pre' | 'ipca') => { const n = cv.data.td[k]?.now, w = cv.data.td[k]?.w1; const name = k === 'pre' ? 'Tesouro Prefixado' : 'Tesouro IPCA+'; return (n?.points || []).filter((p: any) => p[2] === name).map((p: any) => { const q = w?.points.find((z: any) => z[3] === p[3] && z[2] === p[2]); return { l: `${k === 'pre' ? 'Fixed' : 'IPCA+'} ${p[3].slice(0, 4)}`, v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } }) }
    const us = cv.data.us.now.points.map((p: any) => { const q = cv.data.us.w1?.points.find((z: any) => z[2] === p[2]); return { l: p[2], v: p[1], chg: q ? (p[1] - q[1]) * 100 : null } })
    const mm = Object.entries(cv.data.us_money).map(([k, x]: any) => ({ l: ({ DFF: 'Effective Fed Funds', SOFR: 'SOFR', DTB3: 'T-bill 3M' } as any)[k] || k, v: x.last, chg: x.prev != null ? (x.last - x.prev) * 100 : null, date: x.date }))
    return { d, pick, pre: tdRows('pre'), ipca: tdRows('ipca'), us, mm, prevK }
  }, [di.data, cv.data])
  // DI1 e dólar futuro ao vivo (cotação com atraso da bolsa), a cada minuto com o pregão de futuros aberto
  const codes = v ? (v.pick as any[]).map(c => c.code as string) : []
  const lv = useLive(codes.length ? async () => {
    const dol = dolCodes(Date.now())
    const [qs, dq, day] = await Promise.all([Promise.all(codes.map(b3QuoteLive)), Promise.all(dol.map(b3QuoteLive)), b3DayLive(codes[0])])
    const di = new Map<string, number>(); codes.forEach((c, i) => { if (qs[i]) di.set(c, qs[i]!.last) })
    const k = dq.findIndex(q => q)
    const dolQ = k >= 0 ? { code: dol[k], ...dq[k]! } : null
    if (!di.size && !dolQ) return null
    return { di, dol: dolQ, last: day ? day.pts[day.pts.length - 1][0] * 1000 : null, day: day?.day || null }
  } : null, now => (b3FutOpen(now) ? 60000 : null), [codes.join(',')])
  if (!v) return <FnScreen code="BTMM"><Loading err={di.err || cv.err} /></FnScreen>
  const d = v.d, h = d.history?.[d.history.length - 1]
  const L2 = lv.data
  const live: LiveInfo | null = L2 && lv.at && L2.last ? (b3FutOpen(lv.at) ? { kind: 'delayed', delay: delayMin(L2.last, lv.at), at: lv.at } : { kind: 'closed', last: L2.last }) : null
  // com a cotação ao vivo, a variação é contra o último ajuste publicado (em pb)
  const diRows = (v.pick as any[]).map((c: any) => { const x = L2?.di.get(c.code); return x != null ? { l: `${c.code} ${dBR(c.mat)}`, v: x, chg: (x - c.rate) * 100, live: true } : { l: `${c.code} ${dBR(c.mat)}`, v: c.rate, chg: c.chg } })
  const nDiLive = diRows.filter((r: any) => r.live).length
  const fxr = (() => { if (!fx.data) return []; const L = fx.data.dates.length - 1, b = fx.data.usd_per.BRL, e = fx.data.usd_per.EUR; return [{ l: 'USD/BRL', v: b[L], chg: (b[L] / b[L - 1] - 1) * 100 }, { l: 'EUR/BRL', v: b[L] / e[L], chg: ((b[L] / e[L]) / (b[L - 1] / e[L - 1]) - 1) * 100 }, { l: 'DXY', v: fx.data.dxy[L], chg: (fx.data.dxy[L] / fx.data.dxy[L - 1] - 1) * 100 }] })()
  const com = (fu.data?.rows || []).filter((r: any) => ['BZ=F', 'CL=F', 'GC=F'].includes(r.ticker)).map((r: any) => ({ l: r.name, v: r.last, chg: r.pct }))
  const tbl = (rows: any[], unit: 'bp' | '%', dec = 2) => <Grid rows={rows} cols={[{ k: 'l', label: 'Instrument', color: () => C.amber }, { k: 'v', label: 'Last', align: 'r', fmt: x => nf(x, dec), color: () => C.white }, { k: 'chg', label: unit === 'bp' ? 'Δ pb' : 'Var.%', align: 'r', fmt: x => unit === 'bp' ? bp(x, 1) : pf(x), color: x => clr(x) }]} />
  const sgs = (id: string) => ((ec.data?.series as any[]) || []).find(x => x.id === id)?.points as [string, number][] | undefined
  const selic = sgs('SGS432'), dff = sgs('FEDFUNDS')
  return (
    <FnScreen code="BTMM" title="Rates and money-market monitor – Brazil and US" live={live}
      source="B3 (DI1, Daily Bulletin), BCB (Selic, CDI, Copom), Tesouro Transparente (Tesouro Direto), FRED (Fed Funds, SOFR, T-bills, Treasuries), Yahoo (FX and commodities)."
      note={`DI1 Δ vs previous session (${dBR(v.prevK)}); Tesouro and Treasuries vs 1 week; US money market vs previous print. No market-consensus column (no open source).`}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <Panel title="Brazil – monetary policy">
          <KV rows={[['Selic target', `${nf(d.selic, 2)}%`, C.amber], ['CDI', `${nf(d.cdi, 2)}%`, C.amber], ['Spread Selic−CDI', `${nf(d.spread_selic_cdi, 2)} p.p.`], ['Next meeting', d.path?.[0] ? `${d.path[0].label} ${dBR(d.path[0].decision)}` : '—'], ['Implied move', d.path?.[0] ? `${bp(d.path[0].move_bp)} pb` : '—', clr(d.path?.[0]?.move_bp)], ['12m cumulative', h ? `${bp(h.cum_12m_bp)} pb` : '—', clr(h?.cum_12m_bp)], ['Implied year-end CDI', h ? `${nf(h.year_end_cdi, 2)}%` : '—'], ['Survey Selic next meeting', d.path?.[0]?.focus ? `${nf(d.path[0].focus.median, 2)}%` : '—', C.purple]]} />
        </Panel>
        <Panel title={nDiLive ? LL('DI futures – last trade, delayed (Δ vs last settlement)', 'Futuros de DI – último negócio, com atraso (Δ vs último ajuste)') : `DI futures – settlement rate (${dBR(d.ref_date)})`}><div data-btmm-di={nDiLive ? 'live' : 'daily'}>{tbl(diRows, 'bp', 3)}</div></Panel>
        <Panel title={`Tesouro Direto (${dBR(cv.data.td.pre?.now?.date)})`}>{tbl([...v.pre, ...v.ipca], 'bp')}</Panel>
        <Panel title="US – money market">{tbl(v.mm, 'bp')}<div className="mt-1" />{tbl([...fxr, ...com], '%', 2)}
          {L2?.dol && <div className="mt-1" data-btmm-dol>{tbl([{ l: LL(`US dollar future ${L2.dol.code} (BRL per USD 1,000)`, `Dólar futuro ${L2.dol.code} (R$ por US$ 1.000)`), v: L2.dol.last, chg: L2.dol.pct }], '%', 1)}</div>}</Panel>
      </div>
      <div className="mt-2 grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
        <Panel title={`Treasuries (${dBR(cv.data.us.now.date)})`}>{tbl(v.us, 'bp')}</Panel>
        <Panel title="Selic target vs effective Fed Funds (% p.a.)">
          <FnChart height={280} panes={[{ series: [
            ...(selic ? [{ kind: 'line' as const, data: selic.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.amber, title: 'Selic', decimals: 2 }] : []),
            ...(dff ? [{ kind: 'line' as const, data: dff.filter(p => p[0] >= '2019-01-01').map(p => ({ time: p[0], value: p[1] })), color: C.cyan, title: 'Fed Funds', decimals: 2 }] : []),
          ] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}
