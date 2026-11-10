'use client'
import { tc } from '../../lib/themeRuntime'
import { lang } from '@/lib/settings'
/** WIRP (probabilidades de juros), FOMC (calendário Fed/Copom), TAYL (regra de Taylor), WB (títulos soberanos). Strings em inglês por tela. */
import React, { useEffect, useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, Spark, useDesktop } from '@/components/fn/kit'
import { href } from '../../lib/static'
import { downloadCSV, CsvBtn } from './v4util'
import { n, sn, bps, cl, dUS, dUSfull, mLab, Kpis, NumIn, BarLine, Loading2, Unavailable, todaySP } from './fn11util'

// ======================= WIRP =======================
const S_WIRP = {
  title: 'World Interest Rate Probability', tabs: ['Meetings', 'Contracts / history'],
  br: 'Brazil – Copom', us: 'United States – FOMC', model: 'Model', meeting: 'Meeting', next: 'Next',
  region: 'Region', instrument: 'Instrument', target: 'Target rate', targetRange: 'Target range', effective: 'Effective rate', pricing: 'Pricing date', start: 'Current implied overnight',
  cols: { label: 'Meeting', decision: 'Date', n_moves: '#Hikes/Cuts', pct_move: '%Hike/Cut', implied: 'Implied rate', move_bp: 'Δ meeting (bp)', cum_bp: 'Δ cum. (bp)', probs: 'Probabilities', focus: 'Survey median', contract: 'Contract' },
  chart: 'Implied overnight rate and number of hikes/cuts priced', line: 'Implied policy rate (%)', bars: 'Cumulative #hikes/cuts priced',
  hist: 'Next-meeting implied move (bp) – daily history', zq: '30-day Fed Funds futures (ZQ)', zqCols: { ticker: 'Contract', month: 'Month', price: 'Price', implied: 'Implied avg. rate', date: 'Close' },
  histCols: { date: 'Date', next: 'Next meeting', next_move_bp: 'Implied move (bp)', cum_12m_bp: 'Cum. 12m (bp)' },
  noteBr: 'Brazil: DI1 settlement curve → flat-forward CDI per Copom meeting; implied Selic = implied CDI + today\'s Selic−CDI spread.',
  noteUs: 'US: monthly average implied by each ZQ contract (100 − price); the post-meeting rate is solved from the meeting-month average, FedWatch-style.',
}
const probTxt = (p: any[]) => (p || []).map(x => `${x.move_bp > 0 ? '+' : ''}${x.move_bp}: ${n(x.prob, 0)}%`).join('  ')
export function WIRPView() {
  const { data: d, err } = useJSON<any>('wirp.json')
  const [rg, setRg] = useState<'br' | 'us'>('br')
  const [tab, setTab] = useState(0)
  const S = S_WIRP
  if (!d) return <FnScreen code="WIRP" title={S.title}><Loading2 err={err} /></FnScreen>
  const r = d[rg]
  const models = (['br', 'us'] as const).filter(k => d[k]?.meetings?.length).map(k => ({ k, name: k === 'br' ? 'BR – DI1 fut' : 'US – ZQ fut', m: d[k].meetings[0] }))
  return (
    <FnScreen code="WIRP" title={S.title} tabs={S.tabs} tab={tab} setTab={setTab}
      right={<Field label={S.region}><Btns opts={[{ v: 'br', l: 'Brazil' }, { v: 'us', l: 'US' }]} value={rg} onChange={setRg} /></Field>}
      source={<>{d.br?.source}; {d.us?.source}</>} note={<>{d.method} {S.noteBr} {S.noteUs}</>}>
      {!r?.meetings?.length ? <Unavailable what={rg === 'br' ? S.br : S.us} /> : <>
        <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,0.42fr) minmax(0,1.58fr)' }}>
          <Panel title={S.model}>
            <Grid rows={models} onRow={(x: any) => setRg(x.k)} rowStyle={(x: any) => x.k === rg ? { background: tc('#1f2a44') } : undefined} cols={[
              { k: 'name', label: S.model, color: () => C.amber },
              { k: 'm', label: S.next, fmt: x => dUS(x?.decision) },
              { k: 'p', label: S.cols.pct_move, align: 'r', fmt: (_, x: any) => <span style={{ color: cl(x.m?.pct_move) }}>{sn(x.m?.pct_move, 1)}% {x.m?.pct_move > 0 ? '▲' : x.m?.pct_move < 0 ? '▼' : ''}</span> },
            ]} />
            <div className="mt-1"><KV rows={rg === 'br' ? [
              [S.instrument, r.instrument], [S.target, `${n(r.target, 2)}%`, C.amber], [S.effective, `${n(r.effective, 2)}% (CDI)`], [S.pricing, dUSfull(r.ref_date)],
            ] : [
              [S.instrument, r.instrument], [S.targetRange, `${n(r.target_lower, 2)}–${n(r.target_upper, 2)}%`, C.amber], [S.effective, `${n(r.effective, 2)}% (EFFR)`],
              [S.start, `${n(r.start_rate, 3)}%`], [S.pricing, dUSfull(r.ref_date)],
            ]} /></div>
          </Panel>
          <div className="min-w-0">
            {tab === 0 && <>
              <Panel title={rg === 'br' ? S.br : S.us}>
                <Grid maxH={230} rows={r.meetings} cols={[
                  ...(rg === 'br' ? [{ k: 'label', label: S.cols.label, color: () => C.amber }] : []),
                  { k: 'decision', label: S.cols.decision, fmt: (x: any) => dUS(x), color: () => C.amber },
                  { k: 'contract', label: S.cols.contract },
                  { k: 'n_moves', label: S.cols.n_moves, align: 'r', fmt: (x: any) => sn(x, 3), color: (x: any) => cl(x) },
                  { k: 'pct_move', label: S.cols.pct_move, align: 'r', fmt: (x: any) => `${sn(x, 1)}%`, color: (x: any) => cl(x) },
                  { k: 'implied', label: S.cols.implied, align: 'r', fmt: (x: any) => n(x, 3), color: () => C.white },
                  { k: 'move_bp', label: S.cols.move_bp, align: 'r', fmt: (x: any) => bps(x), color: (x: any) => cl(x) },
                  { k: 'cum_bp', label: S.cols.cum_bp, align: 'r', fmt: (x: any) => bps(x), color: (x: any) => cl(x) },
                  { k: 'probs', label: S.cols.probs, fmt: (x: any) => probTxt(x) },
                  ...(rg === 'br' ? [{ k: 'focus', label: S.cols.focus, align: 'r' as const, fmt: (x: any) => n(x, 2), color: () => C.purple }] : []),
                ]} />
              </Panel>
              <Panel title={S.chart} className="mt-2">
                <BarLine height={250} labels={['Now', ...r.meetings.map((m: any) => dUS(m.decision))]} barName={S.bars} lineName={S.line}
                  bars={[0, ...r.meetings.map((m: any) => m.cum_bp / 25)]} line={[rg === 'br' ? r.target : r.start_rate, ...r.meetings.map((m: any) => m.implied)]} lineFmt={v => n(v, 2)} barFmt={v => n(v, 2)} />
              </Panel>
            </>}
            {tab === 1 && (rg === 'us' ? <Panel title={S.zq}>
              <Grid maxH={520} rows={r.contracts || []} cols={Object.entries(S.zqCols).map(([k, l]) => ({ k, label: l, align: k === 'ticker' || k === 'month' ? 'l' as const : 'r' as const, fmt: (x: any) => k === 'price' ? n(x, 4) : k === 'implied' ? n(x, 4) : k === 'date' ? dUS(x) : k === 'month' ? mLab(x + '-01') : x, color: () => k === 'ticker' ? C.amber : C.text }))} />
            </Panel> : <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
              <Panel title={S.hist}>
                <FnChart height={420} panes={[{ series: [
                  { kind: 'hist', data: (r.history || []).map((h: any) => ({ time: h.date, value: h.next_move_bp, color: h.next_move_bp >= 0 ? C.up : C.down })), title: 'Next meeting (bp)', decimals: 1 },
                  { kind: 'line', data: (r.history || []).map((h: any) => ({ time: h.date, value: h.cum_12m_bp })), color: C.amber, title: 'Cum. 12m (bp)', decimals: 1 },
                ] }]} />
              </Panel>
              <Panel title={S.histCols.date}>
                <Grid maxH={440} rows={(r.history || []).slice().reverse()} cols={Object.entries(S.histCols).map(([k, l]) => ({ k, label: l, align: k.endsWith('bp') ? 'r' as const : 'l' as const, fmt: (x: any) => k === 'date' ? dUS(x) : k.endsWith('bp') ? bps(x) : x, color: (x: any) => k.endsWith('bp') ? cl(x) : k === 'next' ? C.amber : C.text }))} />
              </Panel>
            </div>)}
          </div>
        </div>
      </>}
    </FnScreen>
  )
}

// ======================= FOMC =======================
const fPT = () => lang() === 'pt'
const fL = (en: string, pt: string) => (fPT() ? pt : en)
const fomcNum = (v: any, d = 2) => {
  if (v == null || v === '' || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return x.toLocaleString(fPT() ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const fomcBp = (v: any, d = 1) => {
  if (v == null || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return `${x > 0 ? '+' : ''}${fomcNum(x, d)}`
}
const fomcNote = (m: any) => {
  if (m?.note && /notation\s*vote/i.test(String(m.note))) return fL('Notation vote', 'Voto por escrito')
  if (m?.extra) return fL('Extraordinary', 'Extraordinária')
  return m?.note || ''
}
export function FOMCView() {
  const { data: d, err } = useJSON<any>('fomc.json'), w = useJSON<any>('wirp.json')
  const [tab, setTab] = useState(0), [show, setShow] = useState<'up' | 'all' | 'past'>('up')
  const [more, setMore] = useState(false)
  const desk = useDesktop()
  const today = todaySP()
  const title = fL('Fed & Copom Meetings', 'Reuniões do Fed e do Copom')
  const tabs = [fL('Calendar', 'Calendário'), fL('Rate history', 'Histórico das taxas')]
  const v = useMemo(() => {
    if (!d) return null
    const fedImp = new Map<string, number>((w.data?.us?.meetings || []).map((m: any) => [m.decision, m.move_bp]))
    const brImp = new Map<string, number>((w.data?.br?.meetings || []).map((m: any) => [m.decision, m.move_bp]))
    const fed = (d.fed?.meetings || []).map((m: any) => ({ ...m, implied: fedImp.get(m.decision) ?? null }))
    const cop = (d.copom?.meetings || []).map((m: any) => ({ ...m, implied: brImp.get(m.decision) ?? null }))
    const flt = (L: any[]) => show === 'all' ? L.filter(m => m.decision >= `${+today.slice(0, 4) - 2}`) : L.filter(m => show === 'up' ? m.decision >= today : m.decision < today)
    const nf = fed.find((m: any) => m.decision >= today), nc = cop.find((m: any) => m.decision >= today)
    const selicPts: { time: string; value: number }[] = []
    cop.filter((m: any) => m.selic != null && m.decided).forEach((m: any) => selicPts.push({ time: m.decision, value: m.selic }))
    return { fed: flt(fed), cop: flt(cop), nf, nc, selicPts }
  }, [d, w.data, show])
  if (!d || !v) return <FnScreen code="FOMC" title={title} ownTitle><Loading2 err={err} /></FnScreen>
  const rowSt = (m: any) => {
    if (m.note && /notation\s*vote/i.test(String(m.note))) return { background: tc('#1a2230') }
    if (m.decision >= today) return (m === v.nf || m === v.nc) ? { background: tc('#2a1d05') } : undefined
    return { opacity: 0.85 }
  }
  const loc = fPT() ? 'pt-BR' : 'en-US'
  const chg = { k: 'change_bp', label: fL('Change (bp)', 'Variação (pb)'), align: 'r' as const, fmt: (x: any, m: any) => m.decided ? fomcBp(x, 0) : '—', color: (x: any) => cl(x) }
  const imp = { k: 'implied', label: fL('Implied (bp)', 'Implícito (pb)'), align: 'r' as const, fmt: (x: any) => x == null ? '' : fomcBp(x, 1), color: () => C.cyan }
  const fedHasStart = v.fed.some((m: any) => m.start)
  const copHasStart = v.cop.some((m: any) => m.start)
  const fedCols = [
    ...(fedHasStart ? [{ k: 'start', label: fL('Start', 'Início'), fmt: (x: any) => dUS(x) }] : []),
    { k: 'decision', label: fL('Decision', 'Decisão'), fmt: (x: any) => dUS(x), color: (x: any) => x >= today ? C.amber : C.text },
    { k: 'upper', label: fL('Target range', 'Faixa-alvo'), align: 'r' as const, fmt: (x: any, m: any) => m.decided && x != null ? `${fomcNum(m.lower, 2)}–${fomcNum(x, 2)}` : '—' },
    chg, imp,
    { k: 'sep', label: 'SEP', align: 'c' as const, tip: fL('Projections meeting', 'Reunião de projeções'), fmt: (x: any) => x ? '●' : '', color: () => C.amber },
    { k: 'note', label: fL('Note', 'Nota'), fmt: (_: any, m: any) => fomcNote(m) },
  ]
  const copCols = [
    { k: 'label', label: fL('Meeting', 'Reunião'), fmt: (x: any, m: any) => x || (m.n ? `#${m.n}` : '—'), color: () => C.amber },
    ...(copHasStart ? [{ k: 'start', label: fL('Start', 'Início'), fmt: (x: any) => dUS(x) }] : []),
    { k: 'decision', label: fL('Decision', 'Decisão'), fmt: (x: any) => dUS(x), color: (x: any) => x >= today ? C.amber : C.text },
    { k: 'selic', label: 'Selic', align: 'r' as const, fmt: (x: any, m: any) => m.decided ? fomcNum(x, 2) : '—' },
    chg, imp,
    { k: 'extra', label: fL('Note', 'Nota'), fmt: (_: any, m: any) => fomcNote(m) },
  ]
  const pick = (cols: any[], keys: string[]) => (desk || more) ? cols : cols.filter(c => keys.includes(c.k))
  const moreBtn = !desk && <button data-fomc-more className="mt-1 px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? fL('Fewer columns', 'Menos colunas') : fL('More columns', 'Mais colunas')}</button>
  const hint = (en: string, pt: string) => !desk && !more && <div data-fomc-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{fL(en, pt)}</div>
  const nextFed = v.nf ? `${dUS(v.nf.decision)}${v.nf.implied != null ? ` · ${fomcBp(v.nf.implied, 1)} bp` : ''}` : '—'
  const nextCop = v.nc ? `${v.nc.label ?? ''} ${dUS(v.nc.decision)}${v.nc.implied != null ? ` · ${fomcBp(v.nc.implied, 1)} bp` : ''}`.trim() : '—'
  const cards = [
    [fL('Fed target range', 'Faixa-alvo do Fed'), `${fomcNum(d.fed?.target_lower, 2)}–${fomcNum(d.fed?.target_upper, 2)}%`, C.amber],
    [fL('Effective rate', 'Taxa efetiva'), `${fomcNum(d.fed?.effr, 2)}% (${dUS(d.fed?.effr_date)})`],
    [fL('Next FOMC', 'Próximo FOMC'), nextFed, C.white],
    [fL('Selic target', 'Meta da Selic'), `${fomcNum(d.copom?.selic, 2)}%`, C.amber],
    [fL('Next Copom', 'Próximo Copom'), nextCop, C.white],
  ]
  const shownCards = desk ? cards : cards.slice(0, 4)
  const fifth = !desk ? cards[4] : null
  const source = fL('Policy-rate decisions and the published target path. Implied moves come from exchange-traded futures, not official forecasts.',
    'Decisões de taxa básica e a trajetória-alvo publicada. Os movimentos implícitos vêm de futuros negociados em bolsa, não de projeções oficiais.')
  const note = <>
    {fL('A filled dot in the projections column marks a meeting with a published set of rate projections. Implied moves come from exchange-traded futures, not official forecasts. Unscheduled Fed decisions appear as extra rows. ',
      'Um ponto na coluna de projeções marca uma reunião com um conjunto publicado de projeções de juros. Os movimentos implícitos vêm de futuros negociados em bolsa, não de projeções oficiais. Decisões extraordinárias do Fed aparecem como linhas extras. ')}
    {' '}<a href={href('/wirp/')} style={{ color: C.amber }}>{fL('Implied policy path', 'Trajetória implícita de juros')}</a>
  </>
  const exp = () => {
    if (tab === 1) {
      const rows: (string | number | null)[][] = []
      for (const p of (d.fed?.target_series || [])) rows.push([p[0], 'fed', p[1], null])
      for (const p of v.selicPts) rows.push([p.time, 'selic', null, p.value])
      downloadCSV('fomc-history.csv', [fL('Date', 'Data'), fL('Series', 'Série'), fL('Fed target (upper)', 'Teto da meta do Fed'), fL('Selic target', 'Meta da Selic')], rows)
    } else {
      const head = [fL('Bank', 'Banco'), fL('Meeting', 'Reunião'), fL('Start', 'Início'), fL('Decision', 'Decisão'), fL('Target', 'Meta'), fL('Change (bp)', 'Variação (pb)'), fL('Implied (bp)', 'Implícito (pb)'), fL('Note', 'Nota')]
      const rows = [
        ...v.fed.map((m: any) => ['Fed', '', m.start, m.decision, m.decided && m.upper != null ? `${m.lower}–${m.upper}` : '', m.change_bp, m.implied, fomcNote(m)]),
        ...v.cop.map((m: any) => ['Copom', m.label || (m.n ? `#${m.n}` : ''), m.start, m.decision, m.decided ? m.selic : '', m.change_bp, m.implied, fomcNote(m)]),
      ]
      downloadCSV('fomc-calendar.csv', head, rows)
    }
  }
  return (
    <FnScreen code="FOMC" title={title} ownTitle wrap tabs={tabs} tab={tab} setTab={setTab}
      right={<>
        {tab === 0 && <Field label={fL('Show', 'Exibir')}><Btns opts={[{ v: 'all', l: fL('All', 'Todas') }, { v: 'up', l: fL('Upcoming', 'Próximas') }, { v: 'past', l: fL('Decided', 'Decididas') }]} value={show} onChange={setShow} /></Field>}
        <span data-fomc-csv><CsvBtn onClick={exp} /></span>
      </>}
      source={source} note={note}>
      <div data-fomc-cards className="mb-2 grid gap-2 text-[12px] fn-kpi min-w-0" style={{ gridTemplateColumns: desk ? 'repeat(5,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))' }}>
        {shownCards.map(([k, val, c], i) => <div key={i} className="border px-2 py-1 min-w-0" style={{ borderColor: C.line, background: C.panel }}>
          <div className="truncate" style={{ color: C.muted }}>{k}</div>
          <div className="text-[16px] whitespace-nowrap" style={{ color: (c as string) || C.text }}>{val}</div>
        </div>)}
      </div>
      {fifth && <div data-fomc-fifth className="mb-2 text-[12px] border px-2 py-1 min-w-0" style={{ borderColor: C.line, background: C.panel }}>
        <span style={{ color: C.muted }}>{fifth[0]} · </span>
        <span className="whitespace-nowrap" style={{ color: (fifth[2] as string) || C.text }}>{fifth[1]}</span>
      </div>}
      {tab === 0 && <div className="grid gap-2 fn-grid min-w-0 w-full max-w-full" style={{ gridTemplateColumns: desk ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
        <Panel title={fL('Federal Reserve — FOMC', 'Federal Reserve — FOMC')}>
          {hint('Showing decision, target range and change.', 'Mostrando decisão, faixa-alvo e variação.')}
          <div data-fomc-fed className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst maxH={560} rows={v.fed} rowStyle={rowSt} cols={pick(fedCols, ['decision', 'upper', 'change_bp'])} /></div>
          {moreBtn}
        </Panel>
        <Panel title={fL('Central Bank of Brazil — Copom', 'Banco Central do Brasil — Copom')}>
          {hint('Showing meeting, decision, Selic and change.', 'Mostrando reunião, decisão, Selic e variação.')}
          <div data-fomc-cop className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst maxH={560} rows={v.cop} rowStyle={rowSt} cols={pick(copCols, ['label', 'decision', 'selic', 'change_bp'])} /></div>
          {moreBtn}
        </Panel>
      </div>}
      {tab === 1 && <Panel title={fL('Policy rates (%)', 'Taxas básicas (%)')}>
        <FnChart height={520} alwaysLegend panes={[{ series: [
          { kind: 'line', data: (d.fed?.target_series || []).map((p: any) => ({ time: p[0], value: p[1] })), color: C.cyan, title: fL('Fed target (upper)', 'Teto da meta do Fed'), decimals: 2, locale: loc },
          { kind: 'line', data: v.selicPts, color: C.amber, title: fL('Selic target', 'Meta da Selic'), decimals: 2, locale: loc },
        ] }]} />
      </Panel>}
      <div data-fomc-note className="mt-2 text-[11px] min-w-0" style={{ color: C.muted }}>
        {source}{' '}
        <a href={href('/wirp/')} style={{ color: C.amber }}>{fL('Implied policy path', 'Trajetória implícita de juros')}</a>
      </div>
    </FnScreen>
  )
}

// ======================= TAYL =======================
const S_TAYL = {
  title: 'Taylor Rule – implied policy rate', tabs: ['Chart', 'Table'],
  region: 'Region', rstar: 'r*', pistar: 'π*', alpha: 'α (infl.)', beta: 'β (gap)', rho: 'ρ (inertia)', okun: 'Okun', nairu: 'NAIRU',
  infl: 'Inflation', gap: 'Gap',
  k: { policy: 'Policy rate', polUs: 'Fed funds target (upper)', polBr: 'Selic target', taylor: 'Taylor rate', diff: 'Target − Taylor', infl: 'Inflation used', gap: 'Gap used', asof: 'Latest month' },
  c: { date: 'Month', rate: 'Policy', infl: 'Inflation', gap: 'Gap', taylor: 'Taylor', diff: 'Diff (bp)' },
  chart: 'Policy rate vs Taylor rule (%)', pol: 'Policy rate', tay: 'Taylor rule',
  usInfl: [{ v: 'core_pce', l: 'Core PCE' }, { v: 'cpi', l: 'CPI' }], brInfl: [{ v: 'ipca12', l: 'IPCA 12m' }, { v: 'exp12', l: 'Survey IPCA 12m ahead' }],
  usGap: [{ v: 'gap', l: 'CBO output gap' }, { v: 'okun', l: 'Okun (NAIRU − u)' }, { v: 'none', l: 'None' }], brGap: [{ v: 'none', l: 'None' }, { v: 'okun', l: 'Okun (user NAIRU)' }],
  rstarUs: 'Default r* = FOMC longer-run median fed funds − 2%.', rstarBr: 'Default r* = survey long-run Selic − long-run IPCA (real neutral rate).',
  unUs: 'US Taylor rule data (not available in the last update)', unBr: 'Brazil Taylor rule data',
  brGapNote: 'Brazil has no official output gap series in open data; the gap is off by default. Choose Okun and type a NAIRU to include one.',
}
export function TAYLView() {
  const { data: d, err } = useJSON<any>('tayl.json')
  const [rg, setRg] = useState<'us' | 'br'>('us'), [tab, setTab] = useState(0)
  const [P, setP] = useState<Record<string, any>>({})
  const S = S_TAYL
  // Sem dados dos EUA (FRED fora do ar no CI), abre no Brasil em vez de uma tela vazia.
  useEffect(() => { if (d && !d.us?.rows?.length && d.br?.rows?.length) setRg('br') }, [d])
  const r = d?.[rg]
  const def = useMemo(() => !r ? {} : rg === 'us'
    ? { rstar: r.longrun_ffr != null ? +(r.longrun_ffr - r.pi_target).toFixed(2) : 2, pistar: r.pi_target, alpha: 0.5, beta: 0.5, rho: 0, okun: 2, nairu: null, infl: 'core_pce', gap: 'gap' }
    : { rstar: r.rstar_focus ?? null, pistar: r.pi_target, alpha: 0.5, beta: 0.5, rho: 0, okun: 2, nairu: null, infl: 'ipca12', gap: 'none' }, [r, rg])
  const p: any = { ...def, ...(P[rg] || {}) }
  const set = (k: string, v: any) => setP(o => ({ ...o, [rg]: { ...(o[rg] || {}), [k]: v } }))
  const rows = useMemo(() => {
    if (!r) return []
    let prev: number | null = null
    return (r.rows as any[]).map(x => {
      const pi = x[p.infl]
      let gap: number | null = 0
      if (p.gap === 'gap') gap = x.gap ?? null
      else if (p.gap === 'okun') { const nai = rg === 'us' ? (p.nairu ?? x.nairu) : p.nairu; gap = nai != null && x.unemp != null ? p.okun * (nai - x.unemp) : null }
      let t: number | null = pi != null && gap != null && p.rstar != null && p.pistar != null ? p.rstar + pi + p.alpha * (pi - p.pistar) + p.beta * gap : null
      if (t != null && p.rho && prev != null) t = p.rho * prev + (1 - p.rho) * t
      prev = x.rate ?? prev
      return { date: x.date, rate: x.rate, infl: pi, gap: p.gap === 'none' ? null : gap, taylor: t, diff: t != null && x.rate != null ? (x.rate - t) * 100 : null }
    })
  }, [r, JSON.stringify(p), rg])
  if (!d) return <FnScreen code="TAYL" title={S.title}><Loading2 err={err} /></FnScreen>
  const regionBtns = <Field label={S.region}><Btns opts={[{ v: 'us', l: 'US' }, { v: 'br', l: 'Brazil' }]} value={rg} onChange={setRg} /></Field>
  if (!r?.rows?.length) return <FnScreen code="TAYL" title={S.title} right={regionBtns}><Unavailable what={rg === 'us' ? S.unUs : S.unBr} /></FnScreen>
  const last = [...rows].reverse().find(x => x.taylor != null)
  return (
    <FnScreen code="TAYL" title={S.title} tabs={S.tabs} tab={tab} setTab={setTab}
      right={regionBtns}
      source={r.source} note={<>{d.method} {rg === 'us' ? S.rstarUs : S.rstarBr} {rg === 'br' && S.brGapNote}</>}>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[12px] border px-2 py-1" style={{ borderColor: C.line, background: C.panel }}>
        {(['rstar', 'pistar', 'alpha', 'beta', 'rho'] as const).map(k => <Field key={k} label={(S as any)[k]}><NumIn value={p[k]} onChange={v => set(k, v)} w={52} /></Field>)}
        <Field label={S.infl}><Btns opts={rg === 'us' ? S.usInfl : S.brInfl} value={p.infl} onChange={v => set('infl', v)} /></Field>
        <Field label={S.gap}><Btns opts={rg === 'us' ? S.usGap : S.brGap} value={p.gap} onChange={v => set('gap', v)} /></Field>
        {p.gap === 'okun' && <><Field label={S.okun}><NumIn value={p.okun} onChange={v => set('okun', v)} w={44} /></Field><Field label={S.nairu}><NumIn value={p.nairu} onChange={v => set('nairu', v)} w={52} /></Field></>}
        <button className="px-2 py-[1px] border text-[12px]" style={{ borderColor: C.line, color: C.amber }} onClick={() => setP(o => ({ ...o, [rg]: {} }))}>Reset</button>
      </div>
      <Kpis items={[
        [rg === 'us' ? S.k.polUs : S.k.polBr, `${n(r.policy_now, 2)}%`, C.amber],
        [S.k.taylor, last ? `${n(last.taylor, 2)}%` : '—', C.cyan],
        [S.k.diff, last ? `${bps((r.policy_now - last.taylor!) * 100, 0)} bp` : '—', last ? cl(r.policy_now - last.taylor!) : C.text],
        [S.k.infl, last ? `${n(last.infl, 2)}%` : '—'],
        [S.k.gap, last?.gap != null ? n(last.gap, 2) : '—'],
        [S.k.asof, last ? mLab(last.date + '-01') : '—'],
      ]} />
      {tab === 0 && <Panel title={S.chart}>
        <FnChart height={460} panes={[{ series: [
          { kind: 'line', data: rows.filter(x => x.rate != null).map(x => ({ time: x.date + '-01', value: x.rate })), color: C.amber, title: S.pol, decimals: 2, width: 2 },
          { kind: 'line', data: rows.filter(x => x.taylor != null).map(x => ({ time: x.date + '-01', value: +x.taylor!.toFixed(3) })), color: C.cyan, title: S.tay, decimals: 2 },
        ] }, { stretch: 0.3, series: [
          { kind: 'hist', data: rows.filter(x => x.diff != null).map(x => ({ time: x.date + '-01', value: +x.diff!.toFixed(1), color: x.diff! >= 0 ? C.up : C.down })), title: 'Policy − Taylor (bp)', decimals: 0 },
        ] }]} />
      </Panel>}
      {tab === 1 && <Panel title={S.chart}>
        <Grid maxH={560} rows={rows.slice().reverse()} cols={Object.entries(S.c).map(([k, l]) => ({ k, label: l, align: k === 'date' ? 'l' as const : 'r' as const,
          fmt: (x: any) => k === 'date' ? mLab(x + '-01') : k === 'diff' ? bps(x, 0) : n(x, 2), color: (x: any) => k === 'diff' ? cl(x) : k === 'taylor' ? C.cyan : k === 'rate' ? C.amber : C.text }))} />
      </Panel>}
    </FnScreen>
  )
}

// ======================= WB =======================
const S_WB_EN = {
  title: 'World Bonds – sovereign yields', tenor: 'Tenor', region: 'Region', all: 'All',
  c: { name: 'Country', yld: 'Yield', d1: '1D', w1: '1W', m1: '1M', m3: '3M', ytd: 'YTD', y1: '1Y', rng: '3M range', spark: '3M', date: 'Date', freq: 'Freq' },
  chg: 'Changes in bp', chart: 'Yield history', detail: 'Details', avg3m: '3M avg', src: 'Source', br: 'Brazil local curve history (pipeline snapshots)',
  daily: 'Daily', monthly: 'Monthly average', noTenor: 'no data for this tenor',
  na: 'Not available: Argentina and China (no free official yield series that can be updated reliably).',
  note: 'D = daily series published by the central bank or treasury; M = monthly average (1D/1W blank; the latest month appears a few weeks after it ends). Countries with only a 10-year yield are listed with "—" on the other tenors. Brazil = local-currency fixed-rate government bond curve (may lag a few days), not USD bonds.',
}
const S_WB_PT: typeof S_WB_EN = {
  title: 'Títulos soberanos mundiais', tenor: 'Prazo', region: 'Região', all: 'Todas',
  c: { name: 'País', yld: 'Taxa', d1: '1D', w1: '1S', m1: '1M', m3: '3M', ytd: 'No ano', y1: '12M', rng: 'Faixa 3M', spark: '3M', date: 'Data', freq: 'Freq.' },
  chg: 'Variações em pb', chart: 'Histórico da taxa', detail: 'Detalhes', avg3m: 'Média 3M', src: 'Fonte', br: 'Histórico da curva local do Brasil (snapshots do pipeline)',
  daily: 'Diária', monthly: 'Média mensal', noTenor: 'sem dado neste prazo',
  na: 'Indisponíveis: Argentina e China (sem série oficial gratuita de taxas que possa ser atualizada com confiabilidade).',
  note: 'D = série diária publicada pelo banco central ou Tesouro; M = média mensal (1D/1S em branco; o último mês aparece algumas semanas depois de terminar). Países só com a taxa de 10 anos aparecem com "—" nos outros prazos. Brasil = curva prefixada local dos títulos públicos (pode atrasar alguns dias), não títulos em dólar.',
}
const wbS = () => (lang() === 'pt' ? S_WB_PT : S_WB_EN)
const WB_REGION_PT: Record<string, string> = { All: 'Todas', Americas: 'Américas', EMEA: 'EMEA', 'Asia/Pacific': 'Ásia/Pacífico' }
const WB_NAME_PT: Record<string, string> = {
  US: 'Estados Unidos', CA: 'Canadá', DE: 'Alemanha', GB: 'Reino Unido', JP: 'Japão', AU: 'Austrália', BR: 'Brasil (local, BRL)', PE: 'Peru',
  FR: 'França', IT: 'Itália', ES: 'Espanha', NL: 'Países Baixos', PT: 'Portugal', GR: 'Grécia', BE: 'Bélgica', AT: 'Áustria', IE: 'Irlanda',
  SE: 'Suécia', CH: 'Suíça', NO: 'Noruega', DK: 'Dinamarca', PL: 'Polônia', CZ: 'Tchéquia', HU: 'Hungria', MX: 'México', CL: 'Chile',
  CO: 'Colômbia', ZA: 'África do Sul', KR: 'Coreia do Sul', NZ: 'Nova Zelândia', IL: 'Israel', IN: 'Índia',
}
const wbName = (cc: string, name: string) => (lang() === 'pt' ? WB_NAME_PT[cc] || name : name)
const wbRegion = (r: string) => (lang() === 'pt' ? WB_REGION_PT[r] || r : r)
/** selo de frequência: D = série diária (BC/Tesouro), M = média mensal */
const FreqBadge = ({ f }: { f: string }) => (
  <span title={f === 'M' ? wbS().monthly : wbS().daily} className="inline-block px-[3px] text-[9px] leading-[12px] border rounded-sm"
    style={{ color: f === 'M' ? C.yellow : C.muted, borderColor: f === 'M' ? C.yellow : tc('#444') }}>{f === 'M' ? 'M' : 'D'}</span>)
const wbFreq = (c: any) => (Object.values(c.tenors as any).some((x: any) => x.freq === 'D') ? 'D' : 'M')
export function WBView() {
  const { data: d, err } = useJSON<any>('wb.json')
  const [ten, setTen] = useState('10Y'), [reg, setReg] = useState('All'), [sel, setSel] = useState('US')
  const S = wbS()
  // países sem o prazo escolhido (ex.: só 10 anos) ficam na lista com "—", depois dos que têm dado
  const rows = useMemo(() => !d ? [] : (d.countries as any[]).filter(c => reg === 'All' || c.region === reg)
    .map(c => ({ cc: c.cc, name: c.name, region: c.region, src: c.source, ...(c.tenors[ten] || { freq: wbFreq(c), missing: true }), all: c.tenors }))
    .sort((a, b) => (a.missing ? 1 : 0) - (b.missing ? 1 : 0) || a.region.localeCompare(b.region) || (a.missing ? a.name.localeCompare(b.name) : (b.yld ?? 0) - (a.yld ?? 0))), [d, ten, reg])
  if (!d) return <FnScreen code="WB" title={S.title}><Loading2 err={err} /></FnScreen>
  const s = (d.countries as any[]).find(c => c.cc === sel)
  const regions = ['All', ...Array.from(new Set((d.countries as any[]).map(c => c.region)))]
  const rngBar = (x: any) => { if (x.lo3m == null || x.hi3m == null || x.yld == null) return '—'; const f = Math.max(0, Math.min(1, (x.yld - x.lo3m) / ((x.hi3m - x.lo3m) || 1))); return <span className="inline-flex items-center gap-1"><span style={{ color: C.muted }}>{n(x.lo3m, 2)}</span><span className="relative inline-block w-12 h-[6px]" style={{ background: tc('#333') }}><span className="absolute top-[-2px] w-[3px] h-[10px]" style={{ left: `calc(${f * 100}% - 1px)`, background: C.amber }} /></span><span style={{ color: C.muted }}>{n(x.hi3m, 2)}</span></span> }
  return (
    <FnScreen code="WB" title={S.title}
      right={<><Field label={S.tenor}><Btns opts={d.tenors} value={ten} onChange={setTen} /></Field><Field label={S.region}><Btns opts={regions.map(r => ({ v: r, l: r === 'All' ? S.all : wbRegion(r) }))} value={reg} onChange={setReg} /></Field></>}
      note={S.note}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)' }}>
        <div className="min-w-0">
        <Panel title={`${ten} · ${S.chg}`}>
          <Grid maxH={600} rows={rows} onRow={(x: any) => setSel(x.cc)} rowStyle={(x: any) => x.cc === sel ? { background: tc('#1f2a44') } : undefined} cols={[
            { k: 'region', label: S.region, color: () => C.muted, fmt: (x: any) => wbRegion(x) },
            { k: 'name', label: S.c.name, color: (_: any, r: any) => r.missing ? C.muted : C.amber, fmt: (x: any, r: any) => <span className="inline-flex items-center gap-1" title={r.missing ? S.noTenor : undefined}>{wbName(r.cc, x)}<FreqBadge f={r.freq} /></span> },
            { k: 'yld', label: S.c.yld, align: 'r', fmt: x => n(x, 3), color: () => C.white },
            ...(['d1', 'w1', 'm1', 'm3', 'ytd', 'y1'] as const).map(k => ({ k, label: S.c[k], align: 'r' as const, fmt: (x: any) => bps(x, 0), color: (x: any) => cl(x) })),
            { k: 'rng', label: S.c.rng, align: 'c', fmt: (_, x: any) => rngBar(x) },
            { k: 'spark', label: S.c.spark, fmt: x => <Spark data={x || []} w={70} h={14} /> },
            { k: 'date', label: S.c.date, fmt: (x: any, r: any) => x == null ? '—' : r.freq === 'M' ? mLab(x) : dUS(x) },
          ]} />
        </Panel>
        {(d.unavailable || ['AR', 'CN']).length ? <div className="px-1 pt-1 text-[11px] leading-snug" style={{ color: C.muted }} data-wb-na>{S.na}</div> : null}
        </div>
        <div className="min-w-0">
          {s ? <>
            <Panel title={<span className="inline-flex items-center gap-1">{`${wbName(s.cc, s.name)} – ${S.chart} (%)`}<FreqBadge f={wbFreq(s)} /></span>}>
              <FnChart height={300} panes={[{ series: Object.entries(s.tenors).map(([t, x]: any, i) => ({ kind: 'line' as const, data: (x.series || []).map((p: any) => ({ time: p[0], value: p[1] })), color: [C.amber, C.cyan, C.white, C.purple][i % 4], title: t, decimals: 3 })) }]} />
            </Panel>
            <Panel title={S.detail} className="mt-2">
              <Grid rows={Object.entries(s.tenors).map(([t, x]: any) => ({ t, ...x }))} cols={[
                { k: 't', label: S.tenor, color: () => C.amber }, { k: 'yld', label: S.c.yld, align: 'r', fmt: x => n(x, 3), color: () => C.white },
                ...(['d1', 'w1', 'm1', 'ytd', 'y1'] as const).map(k => ({ k, label: S.c[k], align: 'r' as const, fmt: (x: any) => bps(x, 0), color: (x: any) => cl(x) })),
                { k: 'avg3m', label: S.avg3m, align: 'r', fmt: x => n(x, 3) }, { k: 'date', label: S.c.date, fmt: (x: any, r: any) => r.freq === 'M' ? mLab(x) : dUS(x) },
              ]} />
            </Panel>
          </> : null}
        </div>
      </div>
    </FnScreen>
  )
}
