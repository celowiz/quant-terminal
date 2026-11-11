'use client'
import { tc } from '../../lib/themeRuntime'
import { lastValid } from '@/lib/dataFix.mjs'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFit, useDesktop, NewsCards, FnScreen, Panel, Grid, Btns, Field, KV, Loading, Spark, C, nf, pf, big, dBR, dBRfull, clr, useJSON, retSince, isoMinus, inputCls, inputStyle, PALETTE } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import XYChart from '../../components/fn/XYChart'
import { href } from '../../lib/static'
import { downloadCSV, CsvBtn } from './v4util'
import { en } from '../../lib/enText'
import { lang } from '../../lib/settings'
import { t } from '../../lib/i18n'
import { fmtDayMonth, fmtMonth, brToIso } from '../../lib/dates'
import { mean, std, maxDrawdown, regress } from '../../lib/quant'
import { safeUrl, readStoredJSON, validPortfolio, validLocalAlerts } from '../../lib/safe.mjs'
import { useLive, feedLive, sgsLive, focusLive, ptaxLive, type FeedItem } from '../../lib/liveFetch'
import { mergeNews, mergeSgs, brt, type LiveInfo } from '../../lib/live.mjs'

const lastIdx = (a: (number | null)[]) => { let i = a.length - 1; while (i >= 0 && a[i] == null) i--; return i }
const prevVal = (a: (number | null)[], i: number) => { let j = i - 1; while (j >= 0 && a[j] == null) j--; return j >= 0 ? a[j] : null }

// ---------------- WEI ----------------
export function WEIView() {
  const { data: d, err } = useJSON<any>('world.json')
  const [sel, setSel] = useState<any>(null)
  if (!d) return <FnScreen code="WEI"><Loading err={err} /></FnScreen>
  const rowsOf = (r: any) => r.rows.map((x: any) => {
    const i = lastIdx(x.close), last = x.close[i], prev = prevVal(x.close, i), dt = x.dates[i]
    return { ...x, last, chg: last != null && prev != null ? last - prev : null, pct: last != null && prev != null ? (last / prev - 1) * 100 : null, date: dt, ytd: retSince(x.dates, x.close, `${dt.slice(0, 4)}-01-00`), y1: retSince(x.dates, x.close, isoMinus(dt, 0, 0, 1)), m1: retSince(x.dates, x.close, isoMinus(dt, 0, 1)), spark: x.close.slice(-22) }
  })
  const cur = sel || d.regions[0].rows.find((x: any) => x.ticker === '^BVSP') || d.regions[0].rows[0]
  return (
    <FnScreen code="WEI" title="World Equity Indices" source="Yahoo Finance via yfinance (daily index closes), tools/pipeline/build_markets.py." note="Closing values (not real time). Click a row to see the 2-year chart. Sparkline = last month.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="flex flex-col gap-2">{d.regions.map((r: any) => (
          <Panel key={r.region} title={r.region}>
            <Grid onRow={(x: any) => setSel(x)} rowStyle={(x: any) => x.ticker === cur.ticker ? { background: tc('#1a1205') } : undefined} cols={[
              { k: 'name', label: 'Index', color: () => C.amber, w: '170px' }, { k: 'last', label: 'Value', align: 'r', fmt: v => nf(v) }, { k: 'chg', label: 'Var', align: 'r', fmt: v => nf(v), color: clr }, { k: 'pct', label: 'Var%', align: 'r', fmt: v => pf(v), color: clr },
              { k: 'spark', label: '1M', align: 'c', fmt: v => <Spark data={v} w={70} h={14} /> }, { k: 'm1', label: '1M%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'ytd', label: 'YTD%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'y1', label: '12M%', align: 'r', fmt: v => pf(v, 1), color: clr }, { k: 'date', label: 'Date', align: 'r', fmt: dBR }]} rows={rowsOf(r)} />
          </Panel>))}</div>
        <Panel title={`${cur.name} (${cur.ticker}) — 2 years`}>
          <FnChart height={420} panes={[{ series: [{ kind: 'area', data: cur.dates.map((t: string, i: number) => ({ time: t, value: cur.close[i] })).filter((p: any) => p.value != null), color: C.amber, title: cur.name }] }]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ---------------- WFI ----------------
const wPT = () => lang() === 'pt'
const wL = (en: string, pt: string) => (wPT() ? pt : en)
const wfiNum = (v: any, d = 2) => {
  if (v == null || v === '' || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return x.toLocaleString(wPT() ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const wfiPf = (v: any, d = 2) => {
  if (v == null || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return `${x > 0 ? '+' : ''}${wfiNum(x, d)}%`
}
const WFI_CTY: Record<string, [string, string]> = {
  US: ['United States', 'Estados Unidos'], DE: ['Germany', 'Alemanha'], GB: ['United Kingdom', 'Reino Unido'], JP: ['Japan', 'Japão'],
  FR: ['France', 'França'], IT: ['Italy', 'Itália'], ES: ['Spain', 'Espanha'], CA: ['Canada', 'Canadá'], AU: ['Australia', 'Austrália'],
  CH: ['Switzerland', 'Suíça'], KR: ['South Korea', 'Coreia do Sul'], MX: ['Mexico', 'México'], CL: ['Chile', 'Chile'],
  PE: ['Peru', 'Peru'], CO: ['Colombia', 'Colômbia'], ZA: ['South Africa', 'África do Sul'],
}
const wfiCty = (code: string, fallback?: string) => { const n = WFI_CTY[code]; return n ? (wPT() ? n[1] : n[0]) : (fallback || code) }
const WFI_IDX: Record<string, [string, string]> = {
  'ICE BofA US Corporate': ['US Corporate', 'Corporativo EUA'],
  'ICE BofA US High Yield': ['US High Yield', 'High yield EUA'],
  'ICE BofA Emerging Markets Corporate Plus': ['EM Corporate', 'Corporativo mercados emergentes'],
  'ICE BofA Euro High Yield': ['Euro High Yield', 'High yield euro'],
  'ICE BofA High Yield EM Corporate Plus': ['EM High Yield', 'High yield emergentes'],
  'ICE BofA AAA US Corporate': ['US AAA', 'AAA EUA'],
  'US Corporate OAS': ['US Corporate', 'Corporativo EUA'],
  'US High Yield OAS': ['US High Yield', 'High yield EUA'],
  'EM Corporate OAS': ['EM Corporate', 'Corporativo emergentes'],
}
const wfiIdx = (name: string) => { const n = WFI_IDX[name]; return n ? (wPT() ? n[1] : n[0]) : name.replace(/^ICE BofA\s+/i, '') }
export function WFIView() {
  const { data: d, err } = useJSON<any>('wfi.json')
  const desk = useDesktop()
  const [tab, setTab] = useState(0)
  const [more, setMore] = useState(false)
  const title = wL('World fixed income', 'Renda fixa mundial')
  if (!d) return <FnScreen code="WFI" title={title} ownTitle><Loading err={err} /></FnScreen>
  const uc = d.us_curve, tn = uc.tenors as number[]
  const lab = (uc.labels as string[]).map((l: string) => l.replace(/A$/, 'Y'))
  const ret = (p: [string, number][], months: number) => { const t = isoMinus(p[p.length - 1][0], 0, months); const b = p.filter(x => x[0] <= t).pop(); return b ? (p[p.length - 1][1] / b[1] - 1) * 100 : null }
  const chgBp = (p: [string, number][], months: number) => { const t = isoMinus(p[p.length - 1][0], 0, months); const b = p.filter(x => x[0] <= t).pop(); return b ? (p[p.length - 1][1] - b[1]) * 100 : null }
  const changeTab = (i: number) => { setTab(i); setMore(false) }
  const moreBtn = !desk && <button data-wfi-more className="mt-1 px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? wL('Fewer columns', 'Menos colunas') : wL('More columns', 'Mais colunas')}</button>
  const src = wL('Daily US government par yields, monthly average 10-year sovereign rates, total-return credit indices and option-adjusted spreads, and Brazil policy and overnight rates (public data).',
    'Taxas par diárias dos títulos do governo dos EUA, médias mensais das taxas soberanas de 10 anos, índices de retorno total de crédito e spreads ajustados por opção, e as taxas básica e overnight do Brasil (dados públicos).')
  const note = wL(
    'The US curve shows par yields at each tenor, evenly spaced on the X axis (categorical, not to scale). The very short end (1M) sits close to the policy-rate target, so curves from different dates can almost coincide there. 10-year sovereigns are monthly averages; the latest month is published with a lag, and a country can trail the others by a month. Credit tables and the spread chart are in basis points (option-adjusted). Brazilian government curves are on the Yield curves and World bonds pages — this tab only shows the policy and overnight rates present in this file.',
    'A curva dos EUA mostra taxas par em cada vértice, igualmente espaçados no eixo X (categórico, fora de escala). O trecho mais curto (1M) fica perto da meta da taxa básica, por isso curvas de datas diferentes podem quase coincidir ali. As taxas soberanas de 10 anos são médias mensais; o último mês sai com defasagem, e um país pode ficar um mês atrás dos demais. As tabelas de crédito e o gráfico de spreads estão em pontos-base (ajustados por opção). As curvas de títulos públicos brasileiros estão nas páginas Curvas de juros e Títulos mundiais — esta aba só mostra as taxas básica e overnight que constam neste arquivo.')
  const mobTicks = ['1M', '1Y', '5Y', '10Y', '30Y'].map(l => lab.indexOf(l)).filter(i => i >= 0).map(i => ({ v: i, l: lab[i] }))
  const xTicks = desk ? lab.map((l: string, i: number) => ({ v: i, l })) : (mobTicks.length ? mobTicks : lab.map((l: string, i: number) => ({ v: i, l })))
  const curveSeries = ([
    ['y1', C.purple, wL('1 year ago', 'Há 1 ano')],
    ['m1', C.cyan, wL('1 month ago', 'Há 1 mês')],
    ['w1', C.blue, wL('1 week ago', 'Há 1 semana')],
    ['now', C.amber, wL('Current', 'Atual')],
  ] as [string, string, string][]).map(([k, c, n]) => ({ name: `${n} (${dBR(uc[k].date)})`, points: tn.map((_: any, i: number) => [i, uc[k].y[i]] as [number, number]), color: c, width: k === 'now' ? 2.5 : 1.3 }))
  const ustRows = tn.map((_: any, i: number) => ({ l: lab[i], now: uc.now.y[i], w: (uc.now.y[i] - uc.w1.y[i]) * 100, m: (uc.now.y[i] - uc.m1.y[i]) * 100, y: (uc.now.y[i] - uc.y1.y[i]) * 100 }))
  const ustCols = [
    { k: 'l', label: wL('Tenor', 'Prazo'), color: () => C.amber },
    { k: 'now', label: wL('Rate', 'Taxa'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 2) },
    { k: 'w', label: wL('1W bp', '1S pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
    { k: 'm', label: wL('1M bp', '1M pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
    { k: 'y', label: wL('1Y bp', '1A pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
  ]
  const sovRows = d.sovereign10y.map((s: any) => ({ code: s.country, name: wfiCty(s.country, s.name), last: s.points[s.points.length - 1][1], date: s.points[s.points.length - 1][0], m1: chgBp(s.points, 1), y1: chgBp(s.points, 12), sp: s.points.slice(-24).map((p: any) => p[1]) }))
  const latestMonth = sovRows.reduce((m: string, r: any) => r.date.slice(0, 7) > m ? r.date.slice(0, 7) : m, '')
  const lagging = sovRows.filter((r: any) => r.date.slice(0, 7) < latestMonth)
  const sovCols = [
    { k: 'name', label: wL('Country', 'País'), color: () => C.amber },
    { k: 'last', label: wL('Last', 'Última'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 2) },
    { k: 'date', label: wL('Ref.', 'Ref.'), align: 'r' as const, fmt: (v: string) => v ? fmtMonth(v.slice(0, 7) + '-01') : '—' },
    { k: 'm1', label: wL('1M bp', '1M pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
    { k: 'y1', label: wL('1Y bp', '1A pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
    { k: 'sp', label: wL('2 years', '2 anos'), align: 'c' as const, tip: wL('Sparkline of the last 24 monthly average yields.', 'Mini-gráfico das últimas 24 médias mensais.'), fmt: (v: any) => <Spark data={v} w={80} h={14} /> },
  ]
  const idxRows = d.indexes.map((s: any) => { const p = s.points; const lt = p[p.length - 1]; return { name: wfiIdx(s.name), last: lt[1], m1: ret(p, 1), y1: ret(p, 12), ytd: retSince(p.map((x: any) => x[0]), p.map((x: any) => x[1]), `${lt[0].slice(0, 4)}-01-00`) } })
  const idxCols = [
    { k: 'name', label: wL('Index', 'Índice'), color: () => C.amber },
    { k: 'last', label: wL('Level', 'Nível'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 1) },
    { k: 'm1', label: wL('1M%', '1M%'), align: 'r' as const, fmt: (v: number) => wfiPf(v), color: clr },
    { k: 'ytd', label: 'YTD%', align: 'r' as const, fmt: (v: number) => wfiPf(v), color: clr },
    { k: 'y1', label: wL('12M%', '12M%'), align: 'r' as const, fmt: (v: number) => wfiPf(v), color: clr },
  ]
  const oasRows = d.spreads.map((s: any) => ({ name: wfiIdx(s.name), last: s.points[s.points.length - 1][1] * 100, m1: chgBp(s.points, 1), y1: chgBp(s.points, 12), pts: s.points }))
  const oasCols = [
    { k: 'name', label: wL('Spread (OAS)', 'Spread (OAS)'), color: () => C.amber },
    { k: 'last', label: 'bp', align: 'r' as const, fmt: (v: number) => wfiNum(v, 0) },
    { k: 'm1', label: wL('1M bp', '1M pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
    { k: 'y1', label: wL('1Y bp', '1A pb'), align: 'r' as const, fmt: (v: number) => wfiNum(v, 0), color: clr },
  ]
  const pick = (cols: any[], keys: string[]) => (desk || more) ? cols : cols.filter(c => keys.includes(c.k))
  const csvBtn = (tab === 1 || tab === 2) && <button data-wfi-csv className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.amber, color: C.amber }} onClick={() => {
    if (tab === 1) downloadCSV('wfi-sovereigns.csv', sovCols.filter(c => c.k !== 'sp').map(c => String(c.label)), sovRows.map((r: any) => [r.name, r.last, r.date.slice(0, 7), r.m1, r.y1]))
    else downloadCSV('wfi-credit.csv', [...idxCols.map(c => String(c.label)), ...oasCols.map(c => String(c.label))], [
      ...idxRows.map((r: any) => [r.name, r.last, r.m1, r.ytd, r.y1, '', '', '', '']),
      ...oasRows.map((r: any) => ['', '', '', '', '', r.name, r.last, r.m1, r.y1]),
    ])
  }}>{wL('Export CSV', 'Exportar CSV')}</button>
  return (
    <FnScreen code="WFI" title={title} ownTitle wrap
      tabs={[wL('US curve', 'Curva'), wL('10-year', '10 anos'), wL('Credit', 'Crédito'), wL('Brazil', 'Brasil')]} tab={tab} setTab={changeTab}
      right={csvBtn || undefined} source={src} note={note}>
      {tab === 0 && <div className="grid gap-2 fn-grid min-w-0" style={{ gridTemplateColumns: desk ? 'minmax(0,1fr) 360px' : 'minmax(0,1fr)' }}>
        <div data-wfi-curve className="min-w-0"><XYChart height={desk ? 480 : 320} alwaysLegend niceY yLabel="% p.a." series={curveSeries} xTicks={xTicks} xFmt={v => lab[Math.max(0, Math.min(lab.length - 1, Math.round(v)))]} yFmt={v => wfiNum(v, 2)} /></div>
        <Panel className="min-w-0 w-full overflow-hidden" title={wL('US government yields', 'Títulos do governo dos EUA')}>
          {!desk && !more && <div data-wfi-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{wL('Showing tenor, rate and 1-month change.', 'Mostrando prazo, taxa e variação de 1 mês.')}</div>}
          <div data-wfi-ust className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst cols={pick(ustCols, ['l', 'now', 'm'])} rows={ustRows} /></div>
          {moreBtn}
        </Panel>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid min-w-0" style={{ gridTemplateColumns: desk ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
        <Panel className="min-w-0 w-full overflow-hidden" title={wL('10-year yield (% p.a.)', 'Taxa de 10 anos (% a.a.)')}>
          {lagging.length > 0 && <div data-wfi-lag className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{wL(
            `${lagging.map((r: any) => r.name).join(', ')} ${lagging.length === 1 ? 'is' : 'are'} behind the latest published month (${fmtMonth(latestMonth + '-01')}).`,
            `${lagging.map((r: any) => r.name).join(', ')} ${lagging.length === 1 ? 'está' : 'estão'} atrás do último mês publicado (${fmtMonth(latestMonth + '-01')}).`)}</div>}
          {!desk && !more && <div data-wfi-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{wL('Showing country, last yield and 1-month change.', 'Mostrando país, última taxa e variação de 1 mês.')}</div>}
          <div data-wfi-sov className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst cols={pick(sovCols, ['name', 'last', 'm1'])} rows={sovRows} /></div>
          {moreBtn}
        </Panel>
        <Panel className="min-w-0 w-full overflow-hidden" title={wL('History (selected countries)', 'Histórico (países selecionados)')}>
          <FnChart height={desk ? 440 : 300} alwaysLegend panes={[{ series: d.sovereign10y.filter((s: any) => ['US', 'DE', 'JP', 'GB', 'IT', 'MX'].includes(s.country)).map((s: any, i: number) => ({ kind: 'line' as const, data: s.points.map((p: any) => ({ time: p[0], value: p[1] })), color: PALETTE[i], title: wfiCty(s.country), decimals: 2 })) }]} />
        </Panel>
      </div>}
      {tab === 2 && <div className="grid gap-2 fn-grid min-w-0" style={{ gridTemplateColumns: desk ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
        <Panel className="min-w-0 w-full overflow-hidden" title={wL('Total-return credit indices', 'Índices de retorno total de crédito')}>
          {!desk && !more && <div data-wfi-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{wL('Showing index, level and 12-month return.', 'Mostrando índice, nível e retorno de 12 meses.')}</div>}
          <div data-wfi-idx className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst cols={pick(idxCols, ['name', 'last', 'y1'])} rows={idxRows} /></div>
          <div className="mt-2 min-w-0 w-full overflow-x-auto" data-wfi-oas><Grid stickyFirst cols={pick(oasCols, ['name', 'last', 'm1'])} rows={oasRows} /></div>
          {moreBtn}
        </Panel>
        <Panel className="min-w-0 w-full overflow-hidden" title={wL('Option-adjusted spreads (bp)', 'Spreads ajustados por opção (pb)')}>
          <FnChart height={desk ? 440 : 300} alwaysLegend panes={[{ series: oasRows.map((s: any, i: number) => ({ kind: 'line' as const, data: s.pts.map((p: any) => ({ time: p[0], value: p[1] * 100 })), color: [C.amber, C.down, C.blue][i], title: s.name, decimals: 0 })) }]} />
        </Panel>
      </div>}
      {tab === 3 && <Panel className="min-w-0 w-full" title={wL('Brazil — policy rates', 'Brasil — taxas básicas')}>
        <div data-wfi-br>
          <KV rows={[
            [wL('Selic target', 'Meta da Selic'), `${wfiNum(d.br.selic.v)}% ${wL('p.a.', 'a.a.')}`, C.amber],
            [wL('Selic date', 'Data da Selic'), dBRfull(d.br.selic.date)],
            [wL('Annualized CDI (252)', 'CDI anualizado (252)'), `${wfiNum(d.br.cdi_aa.v)}% ${wL('p.a.', 'a.a.')}`, C.amber],
            [wL('CDI date', 'Data do CDI'), dBRfull(d.br.cdi_aa.date)],
          ]} />
          <div className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>{wL('This file has only the latest policy and overnight rates, not a history. Government curves:', 'Este arquivo traz só as taxas básica e overnight mais recentes, não um histórico. Curvas de títulos públicos:')}{' '}
            <a href={href('/gc/')} style={{ color: C.amber }}>{wL('Yield curves', 'Curvas de juros')}</a>
            {' · '}
            <a href={href('/wb/')} style={{ color: C.amber }}>{wL('World bonds', 'Títulos mundiais')}</a>
          </div>
        </div>
      </Panel>}
    </FnScreen>
  )
}

// ---------------- ECON ----------------
const ePT = () => lang() === 'pt'
const eL = (en: string, pt: string) => (ePT() ? pt : en)
const econNum = (v: any, d = 2) => {
  if (v == null || v === '' || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return x.toLocaleString(ePT() ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
/** Curated labels keyed by series id (ids stay internal; never shown). */
const ECON_LAB: Record<string, [string, string, string, string]> = {
  SGS432: ['Selic target', 'Meta da Selic', '% p.a.', '% a.a.'],
  SGS12: ['CDI', 'CDI', '% per day', '% a.d.'],
  SGS433: ['IPCA — monthly change', 'IPCA — variação mensal', '% m/m', '% m/m'],
  SGS13522: ['IPCA — 12-month', 'IPCA — acumulado 12 meses', '% 12m', '% 12m'],
  SGS189: ['IGP-M — monthly change', 'IGP-M — variação mensal', '% m/m', '% m/m'],
  SGS188: ['INPC — monthly change', 'INPC — variação mensal', '% m/m', '% m/m'],
  SGS24369: ['Unemployment rate (PNAD)', 'Taxa de desocupação (PNAD Contínua)', '%', '%'],
  SGS24363: ['IBC-Br (seasonally adjusted)', 'IBC-Br (índice dessazonalizado)', 'index', 'índice'],
  SGS4380: ['Monthly GDP (current prices)', 'PIB mensal (valores correntes)', 'R$ millions', 'R$ milhões'],
  SGS1: ['USD PTAX (ask)', 'Dólar PTAX (venda)', 'R$/US$', 'R$/US$'],
  SGS13762: ['General government gross debt', 'Dívida bruta do governo geral', '% of GDP', '% do PIB'],
  SGS5793: ['Public-sector primary balance (12m)', 'Resultado primário do setor público (12m)', '% of GDP', '% do PIB'],
  SGS22707: ['Trade balance — monthly', 'Balança comercial — saldo mensal', 'US$ millions', 'US$ milhões'],
  SGS3546: ['International reserves', 'Reservas internacionais', 'US$ millions', 'US$ milhões'],
  FEDFUNDS: ['Effective federal funds rate', 'Taxa efetiva dos fed funds', '%', '%'],
  CPIAUCSL: ['US CPI (index)', 'CPI dos EUA (índice)', 'index', 'índice'],
  UNRATE: ['US unemployment rate', 'Desemprego nos EUA', '%', '%'],
  PAYEMS: ['Nonfarm payrolls', 'Folha não agrícola', 'thousands', 'milhares'],
  GDPC1: ['US real GDP', 'PIB real dos EUA', 'US$ billions (2017)', 'US$ bilhões (2017)'],
  DGS10: ['10-year Treasury yield', 'Treasury de 10 anos', '%', '%'],
  T10Y2Y: ['10-year minus 2-year spread', 'Spread 10 anos − 2 anos', 'pp', 'p.p.'],
  DCOILBRENTEU: ['Brent crude', 'Petróleo Brent', 'US$/barrel', 'US$/barril'],
}
const ECON_FOCUS: Record<string, [string, string]> = {
  IPCA: ['IPCA', 'IPCA'], Selic: ['Selic', 'Selic'], 'PIB Total': ['GDP', 'PIB'], 'Câmbio': ['BRL/USD', 'Câmbio'], 'IGP-M': ['IGP-M', 'IGP-M'],
}
const ECON_BARS = new Set(['SGS433', 'SGS189', 'SGS188', 'SGS22707'])
const econName = (id: string, fallback?: string) => { const L = ECON_LAB[id]; return L ? eL(L[0], L[1]) : (fallback || id) }
const econUnit = (id: string, fallback?: string) => { const L = ECON_LAB[id]; return L ? eL(L[2], L[3]) : (fallback || '—') }
const econFocus = (ind: string) => { const L = ECON_FOCUS[ind]; return L ? eL(L[0], L[1]) : ind }
const FOCUS_IND = ['IPCA', 'Selic', 'PIB Total', 'Câmbio', 'IGP-M']
/** cadência ao vivo do ECON: dias úteis 08:00–19:00 a cada 5 min; segunda 08:00–09:30 (pesquisa de expectativas) a cada 2 min; fora disso só ao abrir */
export const econNext = (now: number) => { const t = brt(now); if (t.dow < 1 || t.dow > 5) return null; if (t.dow === 1 && t.min >= 480 && t.min <= 570) return 120000; return t.min >= 480 && t.min <= 1140 ? 300000 : null }
async function econLive(d: any) {
  const today = brt(Date.now()).day
  const br = (d.series as any[]).filter(s => s.country === 'BR' && /^SGS\d+$/.test(s.id))
  const [rows, focus] = await Promise.all([
    Promise.all(br.map(s => sgsLive(s.id.slice(3), s.freq === 'D', today))),
    Promise.all(FOCUS_IND.map(focusLive)),
  ])
  const sgs: Record<string, any[]> = {}
  br.forEach((s, i) => { if (rows[i]) sgs[s.id] = rows[i]! })
  const f = focus.filter(Boolean).flat() as any[]
  if (!Object.keys(sgs).length && !f.length) return null
  return { sgs, focus: f, today }
}
export function ECONView() {
  const { data: d0, err } = useJSON<any>('econ.json')
  const lv = useLive(d0 ? () => econLive(d0) : null, econNext, [d0])
  const d = useMemo(() => {
    if (!d0 || !lv.data) return d0
    const L = lv.data
    const series = (d0.series as any[]).map(s => L.sgs[s.id] ? { ...s, points: mergeSgs(s.points, L.sgs[s.id], L.today).points } : s)
    // medianas: troca um indicador só quando a pesquisa ao vivo é mais nova que a publicada
    const old = (d0.focus || []) as any[], byInd = new Map<string, any[]>()
    for (const r of L.focus) byInd.set(r.indicator, [...(byInd.get(r.indicator) || []), r])
    const focus = FOCUS_IND.flatMap(ind => { const o = old.filter(r => r.indicator === ind), n = byInd.get(ind); return n && (!o.length || n[0].date > o[0].date) ? n : o })
    return { ...d0, series, focus }
  }, [d0, lv.data])
  const live: LiveInfo | null = lv.at ? { kind: 'checked', at: lv.at } : null
  const [sel, setSel] = useState<string>('SGS13522')
  const [more, setMore] = useState(false)
  const desk = useDesktop()
  const title = eL('Economic indicators and expectations', 'Indicadores econômicos e expectativas')
  if (!d) return <FnScreen code="ECON" title={title} ownTitle><Loading err={err} /></FnScreen>
  const rows = (cty: string) => d.series.filter((s: any) => s.country === cty).map((s: any) => {
    const p = s.points || [], n = p.length
    return { ...s, label: econName(s.id, s.name), unitLabel: econUnit(s.id, s.unit), last: p[n - 1]?.[1] ?? null, prev: p[n - 2]?.[1] ?? null, date: p[n - 1]?.[0] || null, chg: n > 1 && p[n - 1]?.[1] != null && p[n - 2]?.[1] != null ? p[n - 1][1] - p[n - 2][1] : null, spark: p.slice(-24).map((x: any) => x[1]) }
  })
  const br = rows('BR'), us = rows('US')
  const s = d.series.find((x: any) => x.id === sel) || d.series[0]
  const numFmt = (v: any) => econNum(v, v != null && Math.abs(+v) > 1000 ? 0 : 2)
  const cols = [
    { k: 'label', label: eL('Indicator', 'Indicador'), color: () => C.amber },
    { k: 'date', label: eL('Ref.', 'Ref.'), align: 'r' as const, fmt: (v: string, r: any) => v ? (r.freq === 'D' ? dBR(v) : fmtMonth(v.slice(0, 7) + '-01')) : '—' },
    { k: 'last', label: eL('Last', 'Último'), align: 'r' as const, fmt: numFmt },
    { k: 'prev', label: eL('Previous', 'Anterior'), align: 'r' as const, fmt: numFmt },
    { k: 'chg', label: eL('Change', 'Variação'), align: 'r' as const, fmt: (v: any) => econNum(v, 2), color: clr },
    { k: 'unitLabel', label: eL('Unit', 'Unidade'), color: () => C.muted },
    { k: 'spark', label: eL('Trend', 'Tendência'), align: 'c' as const, fmt: (v: any) => <Spark data={v} w={70} h={14} /> },
  ]
  const pick = (c: any[], keys: string[]) => (desk || more) ? c : c.filter(x => keys.includes(x.k))
  const showCols = pick(cols, ['label', 'date', 'last', 'chg'])
  const focus = (d.focus || []) as any[]
  const fInd = Array.from(new Set(focus.map(f => f.indicator))), fYears = Array.from(new Set(focus.map(f => f.year))).sort()
  const source = eL('Official statistical series and a market survey of expectations (medians).',
    'Séries estatísticas oficiais e uma pesquisa de mercado de expectativas (medianas).')
  const note = eL('Click an indicator to see its history. There is no per-release consensus calendar; the survey table uses market-survey medians. Brazil indicators and the survey are checked again at the official source while this page is open (every 5 minutes on weekdays from 08:00 to 19:00, every 2 minutes on Monday morning, when the survey comes out), so a new release shows up without waiting for the daily update. United States indicators come from the daily update.',
    'Clique num indicador para ver o histórico. Não há calendário de consenso por divulgação; a tabela de pesquisa usa as medianas da pesquisa de mercado. Os indicadores do Brasil e a pesquisa são consultados de novo na fonte oficial enquanto esta página estiver aberta (a cada 5 minutos nos dias úteis, das 08:00 às 19:00, e a cada 2 minutos na segunda de manhã, quando sai a pesquisa); assim, uma divulgação nova aparece sem esperar a atualização diária. Os indicadores dos Estados Unidos vêm da atualização diária.')
  const expInd = () => {
    const head = [eL('Country', 'País'), eL('Indicator', 'Indicador'), eL('Ref.', 'Ref.'), eL('Last', 'Último'), eL('Previous', 'Anterior'), eL('Change', 'Variação'), eL('Unit', 'Unidade')]
    const pack = (cty: string, list: any[]) => list.map(r => [cty, r.label, r.date, r.last, r.prev, r.chg, r.unitLabel])
    downloadCSV('econ-indicators.csv', head, [...pack(eL('Brazil', 'Brasil'), br), ...pack(eL('United States', 'Estados Unidos'), us)])
  }
  const expSurvey = () => {
    const head = [eL('Indicator', 'Indicador'), ...fYears.map(String)]
    const rows = fInd.map(ind => [econFocus(ind), ...fYears.map(y => { const f = focus.find(x => x.indicator === ind && x.year === y); return f ? f.median : null })])
    downloadCSV('econ-survey.csv', head, rows)
  }
  const loc = ePT() ? 'pt-BR' : 'en-US'
  const chartName = s ? econName(s.id, s.name) : '—'
  const chartUnit = s ? econUnit(s.id, s.unit) : ''
  return (
    <FnScreen code="ECON" title={title} ownTitle wrap source={source} note={note} live={live}
      right={<span data-econ-csv className="flex flex-wrap items-center gap-1">
        <CsvBtn onClick={expInd} />
        <button data-econ-csv-survey type="button" onClick={expSurvey} className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.amber, color: C.amber }}>{eL('Survey CSV', 'CSV da pesquisa')}</button>
      </span>}>
      <div className="grid gap-2 fn-grid min-w-0 w-full max-w-full" style={{ gridTemplateColumns: desk ? '1.3fr 1fr' : 'minmax(0,1fr)' }}>
        <div className="flex flex-col gap-2 min-w-0">
          {!desk && !more && <div data-econ-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{eL('Showing indicator, date, last and change.', 'Mostrando indicador, data, último e variação.')}</div>}
          <Panel title={eL('Brazil', 'Brasil')}>
            <div data-econ-br className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst onRow={(r: any) => setSel(r.id)} rowStyle={(r: any) => r.id === sel ? { background: tc('#1a1205') } : undefined} cols={showCols} rows={br} /></div>
          </Panel>
          <Panel title={eL('United States', 'Estados Unidos')}>
            <div data-econ-us className="min-w-0 w-full overflow-x-auto"><Grid stickyFirst onRow={(r: any) => setSel(r.id)} rowStyle={(r: any) => r.id === sel ? { background: tc('#1a1205') } : undefined} cols={showCols} rows={us} /></div>
          </Panel>
          {!desk && <button data-econ-more type="button" className="px-2 py-[1px] text-[11px] border self-start" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? eL('Fewer columns', 'Menos colunas') : eL('More columns', 'Mais colunas')}</button>}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <Panel title={`${chartName}${chartUnit ? ` (${chartUnit})` : ''}`}>
            <FnChart height={300} alwaysLegend panes={[{ series: [{ kind: s && ECON_BARS.has(s.id) ? 'hist' : 'line', data: (s?.points || []).map((p: any) => ({ time: p[0], value: p[1], color: p[1] >= 0 ? C.amber : C.down })), color: C.amber, title: chartName, decimals: 2, locale: loc }] }]} />
          </Panel>
          <Panel title={`${eL('Market survey — medians', 'Pesquisa de mercado — medianas')}${focus[0]?.date ? ` (${dBR(focus[0].date)})` : ''}`}>
            <div data-econ-survey className="min-w-0 w-full overflow-x-auto">
              <table className="w-full text-[12px]"><thead><tr><th className="px-2 py-1 text-left font-normal" style={{ color: C.amber }}>{eL('Indicator', 'Indicador')}</th>{fYears.map(y => <th key={y} className="px-2 py-1 text-right font-normal" style={{ color: C.amber }}>{y}</th>)}</tr></thead>
                <tbody>{fInd.map(ind => <tr key={ind} className="border-t" style={{ borderColor: tc('#1a1a1a') }}><td className="px-2 py-[2px]">{econFocus(ind)}</td>{fYears.map(y => { const f = focus.find(x => x.indicator === ind && x.year === y); return <td key={y} className="px-2 py-[2px] text-right">{f ? econNum(f.median, 2) : '—'}</td> })}</tr>)}</tbody></table>
            </div>
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ---------------- FX ----------------
const CCY = ['USD', 'BRL', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'MXN']
export function FXView() {
  const { data: d, err } = useJSON<any>('fx.json')
  const [tab, setTab] = useState(0)
  const [pair, setPair] = useState('BRL')
  // aba PTAX: boletins do dia direto do BC (abertura ~10h, intermediários ~11h e ~12h, fechamento ~13h); dias úteis 10:00–13:30 a cada 2 min
  const pt = useLive(tab === 2 ? () => ptaxLive(brt(Date.now()).day) : null, now => { const x = brt(now); return x.dow >= 1 && x.dow <= 5 && x.min >= 600 && x.min <= 810 ? 120000 : null }, [tab === 2])
  if (!d) return <FnScreen code="FX"><Loading err={err} /></FnScreen>
  const up = (c: string, i: number) => c === 'USD' ? 1 : d.usd_per[c]?.[i]
  const L = d.dates.length - 1
  const at = (c: string, i: number) => { let j = i; while (j > 0 && up(c, j) == null) j--; return up(c, j) }
  // convenção: quantidade da moeda da LINHA por 1 unidade da moeda da COLUNA
  const x = (row: string, col: string, i: number) => at(row, i) / at(col, i)
  const ptax = d.ptax?.USD || []
  return (
    <FnScreen code="FX" title="Currency Monitor" tabs={['Cross matrix', '1D change %', 'PTAX', 'DXY / USDBRL']} tab={tab} setTab={setTab} live={tab === 2 && pt.at ? { kind: 'checked', at: pt.at } : null}
      source="Yahoo Finance (currency closes vs USD, DXY) and BCB PTAX (Olinda API); tools/pipeline/build_markets.py." note="Matrix: units of the row currency per 1 unit of the column currency. Crosses derived via USD. Daily closes, not real time.">
      {tab <= 1 && <div className="overflow-auto"><table className="border-collapse text-[12px] w-full">
        <thead><tr><th className="px-2 py-1" style={{ color: C.muted }}>{dBRfull(d.dates[L])}</th>{CCY.map(c => <th key={c} className="px-2 py-1 text-right" style={{ color: C.amber }}>{c}</th>)}</tr></thead>
        <tbody>{CCY.map(r => <tr key={r} className="border-t" style={{ borderColor: tc('#1a1a1a') }}><td className="px-2 py-1 font-bold" style={{ color: C.amber }}>{r}</td>{CCY.map(c => { if (r === c) return <td key={c} className="px-2 py-1 text-right" style={{ background: tc('#111'), color: C.muted }}>—</td>; const v = x(r, c, L), p = x(r, c, L - 1), ch = (v / p - 1) * 100; return <td key={c} className="px-2 py-1 text-right border border-[#151515]" style={tab === 1 ? { background: `rgba(${ch >= 0 ? '61,220,132' : '255,77,77'},${Math.min(0.8, Math.abs(ch) / 1.5)})` } : undefined}>{tab === 0 ? nf(v, v >= 100 ? 2 : 4) : pf(ch)}</td> })}</tr>)}</tbody>
      </table></div>}
      {tab === 2 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="PTAX — latest bulletin"><Grid cols={[{ k: 'c', label: 'Currency', color: () => C.amber }, { k: 'date', label: 'Date', fmt: dBRfull }, { k: 'buy', label: 'Bid', align: 'r', fmt: v => nf(v, 4) }, { k: 'sell', label: 'Ask', align: 'r', fmt: v => nf(v, 4) }, { k: 'ch', label: 'Var%', align: 'r', fmt: v => pf(v), color: clr }]} rows={Object.entries(d.ptax).map(([c, a]: any) => ({ c, ...a[a.length - 1], ch: a.length > 1 ? (a[a.length - 1].sell / a[a.length - 2].sell - 1) * 100 : null }))} /></Panel>
        <Panel title={eL('Today’s PTAX bulletins (USD)', 'Boletins PTAX de hoje (US$)')}>
          <div data-fx-ptax-live>{pt.data == null ? <div className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>—</div> : pt.data.length
            ? <Grid cols={[{ k: 'kind', label: eL('Bulletin', 'Boletim'), color: () => C.amber, fmt: (v: string) => v === 'open' ? eL('Opening', 'Abertura') : v === 'close' ? eL('Closing (PTAX)', 'Fechamento (PTAX)') : eL('Intermediate', 'Intermediário') },
                { k: 'time', label: eL('Time', 'Horário') }, { k: 'buy', label: eL('Bid', 'Compra'), align: 'r', fmt: v => nf(v, 4) }, { k: 'sell', label: eL('Ask', 'Venda'), align: 'r', fmt: v => nf(v, 4), color: () => C.white }]} rows={pt.data} />
            : <div className="px-2 py-2 text-[12px]" style={{ color: C.muted }}>{eL('No bulletin today yet (the first one comes out around 10:00 on business days).', 'Ainda não há boletim hoje (o primeiro sai por volta das 10:00 nos dias úteis).')}</div>}</div>
        </Panel>
        <Panel title="PTAX USD ask"><FnChart height={380} panes={[{ series: [{ kind: 'line', data: ptax.map((p: any) => ({ time: p.date, value: p.sell })), color: C.amber, title: 'PTAX', decimals: 4 }] }]} /></Panel>
      </div>}
      {tab === 3 && <div><div className="pb-1"><Btns opts={CCY.filter(c => c !== 'USD')} value={pair} onChange={setPair} /></div>
        <FnChart height={560} panes={[{ stretch: 0.5, series: [{ kind: 'line', data: d.dates.map((t: string, i: number) => ({ time: t, value: d.usd_per[pair][i] })).filter((p: any) => p.value != null), color: C.amber, title: `USD${pair}`, decimals: 4 }] }, { stretch: 0.5, series: [{ kind: 'line', data: d.dates.map((t: string, i: number) => ({ time: t, value: d.dxy[i] })).filter((p: any) => p.value != null), color: C.white, title: 'DXY' }] }]} /></div>}
    </FnScreen>
  )
}

// ---------------- HEAT (treemap) ----------------
type TM = { x: number; y: number; w: number; h: number }
function squarify<T extends { v: number }>(items: T[], r: TM): (T & TM)[] {
  const out: (T & TM)[] = []; const tot = items.reduce((s, i) => s + i.v, 0); if (!tot) return out
  const sc = (r.w * r.h) / tot; let rest = items.slice().sort((a, b) => b.v - a.v).map(i => ({ ...i, a: i.v * sc })); let rr = { ...r }
  const worst = (row: any[], side: number) => { const s = row.reduce((p, i) => p + i.a, 0); const mx = Math.max(...row.map(i => i.a)), mn = Math.min(...row.map(i => i.a)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)) }
  while (rest.length) {
    const side = Math.min(rr.w, rr.h); const row = [rest[0]]; let k = 1
    while (k < rest.length && worst([...row, rest[k]], side) <= worst(row, side)) { row.push(rest[k]); k++ }
    const s = row.reduce((p, i) => p + i.a, 0)
    if (rr.w >= rr.h) { const w = s / rr.h; let y = rr.y; row.forEach(i => { const h = i.a / w; out.push({ ...(i as any), x: rr.x, y, w, h }); y += h }); rr = { x: rr.x + w, y: rr.y, w: rr.w - w, h: rr.h } }
    else { const h = s / rr.w; let x = rr.x; row.forEach(i => { const w = i.a / h; out.push({ ...(i as any), x, y: rr.y, w, h }); x += w }); rr = { x: rr.x, y: rr.y + h, w: rr.w, h: rr.h - h } }
    rest = rest.slice(k)
  }
  return out
}
const PER = [{ v: '1D', l: '1D' }, { v: '1S', l: '1W' }, { v: '1M', l: '1M' }, { v: 'YTD', l: 'Year' }, { v: '1A', l: '12M' }]
// A carteira teórica da B3 grafa o mesmo setor de formas diferentes (ex.: 'Financ e Outros' / 'Financeiro e Outros')
const normSector = (x: string) => (x || '').replace(/\s+/g, ' ').replace(/^Financeiro e Outros$/, 'Financ e Outros').replace(/^Cons N Básico$/, 'Cons N Básico').trim()

function useUniverseChanges(per: string) {
  const { data: u, err } = useJSON<any>('universe.json')
  const rows = useMemo(() => {
    if (!u) return null
    const dates = u.dates as string[], L = dates.length - 1
    const tgt = per === '1D' ? dates[L - 1] : per === '1S' ? isoMinus(dates[L], 7) : per === '1M' ? isoMinus(dates[L], 0, 1) : per === 'YTD' ? `${dates[L].slice(0, 4)}-01-00` : isoMinus(dates[L], 0, 0, 1)
    return u.components.map((c: any) => { const cl = u.close[c.cod] || []; const i = lastIdx(cl); const fv = u.fin_volume_30d?.[c.cod]; return { ...c, sector: normSector(c.sector), last: cl[i], chg: per === '1D' ? (cl[i] != null && prevVal(cl, i) != null ? (cl[i] / (prevVal(cl, i) as number) - 1) * 100 : null) : retSince(dates, cl, tgt), vol: Array.isArray(fv) ? (fv.length ? fv.reduce((a: number, b: number) => a + (b || 0), 0) / fv.length : null) : fv } })
  }, [u, per])
  const ibov = u ? (() => { const cl = u.close['^BVSP']; const i = lastIdx(cl); return { last: cl[i], date: u.dates[i], chg: (cl[i] / (prevVal(cl, i) as number) - 1) * 100 } })() : null
  return { u, rows, err, ibov }
}
const heatColor = (v: number | null, s: number) => v == null ? tc('#222') : v >= 0 ? `rgb(${Math.round(20 + 10 * Math.min(1, v / s))},${Math.round(70 + 120 * Math.min(1, v / s))},${Math.round(40 + 50 * Math.min(1, v / s))})` : `rgb(${Math.round(70 + 150 * Math.min(1, -v / s))},${Math.round(30 + 10 * Math.min(1, -v / s))},${Math.round(30 + 10 * Math.min(1, -v / s))})`
function HeatMap({ rows, scale }: { rows: any[]; scale: number }) {
  // desktop: preenche a área disponível (largura medida × altura elástica); mobile: proporção fixa 1400×720
  const { s, active } = useFit()
  const ref = useRef<HTMLDivElement | null>(null)
  const [bw, setBw] = useState(1400)
  useEffect(() => { const el = ref.current; if (!el) return; const f = () => setBw(el.clientWidth || 1400); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect() }, [])
  // mobile/tablet (<1024px): largura do painel e altura fixa legível (retrato), toque mostra o detalhe
  const [tip, setTip] = useState<any>(null)
  const W = active ? Math.max(600, bw) : Math.max(300, bw), H = active ? Math.max(260, Math.round(720 * s)) : Math.round(Math.min(680, Math.max(420, bw * 1.35)))
  const sectors = Array.from(new Set(rows.map((r: any) => r.sector))).map(s => ({ s, v: rows.filter((r: any) => r.sector === s).reduce((p: number, r: any) => p + r.weight, 0) }))
  const secRects = squarify(sectors as any[], { x: 0, y: 0, w: W, h: H })
  return <div ref={ref} style={{ width: '100%' }}>
      {!active && <div className="mb-1 min-h-[34px] px-2 py-1 text-[12px] leading-[16px] border" style={{ borderColor: C.line, background: C.panel, color: C.text }}>
        {tip ? <><b style={{ color: C.amber }}>{tip.cod}</b> {tip.name}<br /><span style={{ color: clr(tip.chg) }}>{pf(tip.chg)}</span> · weight {nf(tip.weight, 2)}% · R$ {nf(tip.last)}</> : <span style={{ color: C.muted }}>Tap a stock to see change, weight and price.</span>}
      </div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={active ? H : undefined} style={{ display: 'block', background: tc('#000'), fontFamily: 'inherit' }}>
        {secRects.map((sr: any) => {
          const items = squarify(rows.filter((r: any) => r.sector === sr.s).map((r: any) => ({ ...r, v: r.weight })), { x: sr.x + 1, y: sr.y + 16, w: sr.w - 2, h: sr.h - 17 })
          return <g key={sr.s}>
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} fill={tc(tc('#000'))} stroke={tc(tc('#000'))} />
            <text x={sr.x + 4} y={sr.y + 12} fontSize={11} fill={C.amber}>{en(sr.s)} {nf(sr.v, 1)}%</text>
            {items.map((it: any) => <g key={it.cod} onClick={active ? undefined : () => setTip(it)} style={active ? undefined : { cursor: 'pointer' }}><title>{`${it.cod} ${it.name}\n${pf(it.chg)} | weight ${nf(it.weight, 2)}% | R$ ${nf(it.last)}`}</title>
              <rect x={it.x} y={it.y} width={Math.max(0, it.w - 1)} height={Math.max(0, it.h - 1)} fill={heatColor(it.chg, scale)} stroke={!active && tip?.cod === it.cod ? C.amber : undefined} strokeWidth={!active && tip?.cod === it.cod ? 2 : undefined} />
              {it.w > 38 && it.h > 22 && <><text x={it.x + it.w / 2} y={it.y + it.h / 2 - 1} textAnchor="middle" fontSize={Math.min(16, Math.max(9, it.w / 6))} fill={tc(tc('#fff'))} fontWeight={700}>{it.cod}</text><text x={it.x + it.w / 2} y={it.y + it.h / 2 + 12} textAnchor="middle" fontSize={Math.min(13, Math.max(8, it.w / 7))} fill={tc(tc('#fff'))}>{pf(it.chg, 1)}</text></>}
            </g>)}
          </g>
        })}
      </svg>
  </div>
}

export function HEATView() {
  const [per, setPer] = useState('1D')
  const { rows, err, u, ibov } = useUniverseChanges(per)
  if (!rows) return <FnScreen code="HEAT"><Loading err={err} /></FnScreen>
  const scale = per === '1D' ? 3 : per === '1S' ? 6 : per === '1M' ? 10 : 25
  return (
    <FnScreen code="HEAT" title="Heatmap — Ibovespa by sector" right={<><span>IBOV <b style={{ color: C.amber }}>{nf(ibov?.last, 0)}</b> <span style={{ color: clr(ibov?.chg) }}>{pf(ibov?.chg)}</span></span><Btns opts={PER} value={per} onChange={setPer} /></>}
      source={`B3 — Ibovespa theoretical portfolio (${u?.date_portfolio || ''}) + Yahoo Finance closes.`} note={`Area = weight in the theoretical portfolio; color = change over the period (scale ±${scale}%). Grouped by B3 sector.`}>
      <HeatMap rows={rows} scale={scale} />
    </FnScreen>
  )
}

// ---------------- TOP ----------------
export function TOPView() {
  const [per, setPer] = useState('1D')
  const { rows, err, ibov } = useUniverseChanges(per)
  if (!rows) return <FnScreen code="TOP"><Loading err={err} /></FnScreen>
  const v = rows.filter((r: any) => r.chg != null)
  const up = v.slice().sort((a: any, b: any) => b.chg - a.chg).slice(0, 15), dn = v.slice().sort((a: any, b: any) => a.chg - b.chg).slice(0, 15)
  const act = v.slice().sort((a: any, b: any) => (b.vol || 0) - (a.vol || 0)).slice(0, 15)
  const adv = v.filter((r: any) => r.chg > 0).length, dec = v.filter((r: any) => r.chg < 0).length
  const cols = [{ k: 'cod', label: 'Ticker', color: () => C.amber }, { k: 'name', label: 'Name' }, { k: 'last', label: 'Last', align: 'r' as const, fmt: (x: number) => nf(x) }, { k: 'chg', label: 'Var%', align: 'r' as const, fmt: (x: number) => pf(x), color: clr }, { k: 'weight', label: 'Weight', align: 'r' as const, fmt: (x: number) => nf(x, 2) }]
  return (
    <FnScreen code="TOP" title="Top gainers / losers — Ibovespa" right={<><span>Up <b style={{ color: C.up }}>{adv}</b> · Down <b style={{ color: C.down }}>{dec}</b></span><span>IBOV <span style={{ color: clr(ibov?.chg) }}>{pf(ibov?.chg)}</span></span><Btns opts={PER} value={per} onChange={setPer} /></>}
      source="B3 (Ibovespa theoretical portfolio) + Yahoo Finance (close); 30d average traded value." note="Universe: Ibovespa components. Closing prices, not real time.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Panel title="▲ Top gainers"><Grid cols={cols} rows={up} /></Panel>
        <Panel title="▼ Top losers"><Grid cols={cols} rows={dn} /></Panel>
        <Panel title="Most traded (30d traded value)"><Grid cols={[cols[0], { k: 'vol', label: 'R$/day', align: 'r' as const, fmt: (x: number) => big(x) }, cols[3]]} rows={act} /></Panel>
      </div>
      <div className="mt-2"><Panel title="Distribution of changes (sorted)"><XYChart height={200} legend={false} zeroLine series={[{ name: 'Var%', points: v.slice().sort((a: any, b: any) => a.chg - b.chg).map((r: any, i: number) => [i + 1, r.chg] as [number, number]), color: C.amber, width: 2 }]} xFmt={x => `#${Math.round(x)}`} yFmt={y => nf(y, 1) + '%'} /></Panel></div>
    </FnScreen>
  )
}

/** feeds que o navegador lê direto (CORS aberto); mesmos rótulos de publicador do pipeline (build_news.py) */
const NEWS_LIVE: [string, string, string][] = [
  ['Agência Brasil – Economia', 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', 'CC BY 4.0'],
  ['Agência Brasil – Internacional', 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml', 'CC BY 4.0'],
  ['Agência Brasil – Política', 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml', 'CC BY 4.0'],
  ['BCB – Notas à imprensa', 'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa', 'gov.br'],
]
const newsLive = async (): Promise<FeedItem[] | null> => {
  const r = await Promise.all(NEWS_LIVE.map(([s, u, l]) => feedLive(u, s, l)))
  const ok = r.filter(Boolean) as FeedItem[][]
  return ok.length ? ok.flat() : null
}
export function NEWSView() {
  const { data: d, err } = useJSON<any>('news.json')
  const [src, setSrc] = useState('All'); const [q, setQ] = useState('')
  const desk = useDesktop()
  // manchetes novas dos feeds abertos a cada 3 minutos com a aba visível
  const lv = useLive(newsLive, () => 180000, [])
  const merged = useMemo(() => (d ? mergeNews(d.items, lv.data || []) : null), [d, lv.data])
  const live: LiveInfo | null = lv.at ? { kind: 'checked', at: lv.at } : null
  if (!d || !merged) return <FnScreen code="NEWS"><Loading err={err} /></FnScreen>
  const items = merged.items
  // filtros por publicador (atribuição por manchete); 'All' é o valor interno, rótulo traduzido
  const srcs = ['All', ...Array.from(new Set(items.map((n: any) => n.source))) as string[]]
  const rows = items.filter((n: any) => (src === 'All' || n.source === src) && (!q || n.title.toLowerCase().includes(q.toLowerCase())))
  const when = (v: string) => `${fmtDayMonth(v)} ${v.slice(11, 16)}`
  return (
    <FnScreen code="NEWS" title={t('news.title')} live={live} right={<Field label={t('news.search')}><input className={inputCls + ' w-48'} style={inputStyle} value={q} onChange={e => setQ(e.target.value)} /></Field>}
      source={<>Open-license RSS feeds. Headline + link only (no text reproduced).</>} note={eL(`No paid news agency. Time = feed publication time, converted to Brasília time. Headlines from the feeds that allow direct reading are checked again every 3 minutes while this page is open${merged.fresh ? ` (${merged.fresh} new since the daily update)` : ''}; the others arrive with the daily update.`,
        `Sem agência de notícias paga. Horário = horário de publicação no feed, convertido para o horário de Brasília. As manchetes dos feeds que permitem leitura direta são consultadas de novo a cada 3 minutos enquanto esta página estiver aberta${merged.fresh ? ` (${merged.fresh} novas desde a atualização diária)` : ''}; as demais chegam com a atualização diária.`)}>
      <div className="flex flex-wrap gap-0 pb-2">{srcs.map(s => <button key={s} onClick={() => setSrc(s)} className="px-2 py-[2px] text-[11px] border" style={{ borderColor: C.line, background: src === s ? C.amber : 'transparent', color: src === s ? tc('#000') : C.amber }}>{s === 'All' ? t('news.all') : s}</button>)}</div>
      {desk
        ? <Grid maxH={700} cols={[{ k: 'date', label: t('news.time'), w: '110px', fmt: when }, { k: 'source', label: t('news.source'), w: '220px', color: () => C.amber, fmt: (v: string) => v.length > 30 ? v.slice(0, 29) + '…' : v }, { k: 'title', label: t('news.headline'), fmt: (v: string, r: any) => <a href={safeUrl(r.link)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{v}</a> }]} rows={rows} />
        : <NewsCards empty={t('news.empty')} items={rows.map((r: any) => ({ title: r.title, link: safeUrl(r.link), meta: <>{when(r.date)} · <span style={{ color: C.amber }}>{r.source}</span></> }))} />}
    </FnScreen>
  )
}

// ---------------- ANB (fluxo de fundos) ----------------
const aPT = () => lang() === 'pt'
const aL = (en: string, pt: string) => (aPT() ? pt : en)
const ANB_NAMES: Record<string, [string, string]> = {
  'Renda Fixa': ['Fixed income', 'Renda fixa'], 'Ações': ['Equities', 'Ações'], 'Multimercados': ['Multimarket', 'Multimercados'], 'Cambial': ['FX', 'Cambial'],
  'FMP-FGTS': ['FMP-FGTS', 'FMP-FGTS'], 'FIDC': ['Receivables (FIDC)', 'Direitos creditórios (FIDC)'], 'Imobiliários (FII)': ['Real estate (FII)', 'Imobiliários (FII)'],
  'Participações (FIP)': ['Private equity (FIP)', 'Participações (FIP)'], 'Não classificado': ['Unclassified', 'Não classificado'], 'Total': ['Total', 'Total'],
}
const anbName = (c: string) => { const n = ANB_NAMES[c]; return n ? (aPT() ? n[1] : n[0]) : c }
/** número no idioma da tela (só ANB): PT usa ponto de milhar e vírgula decimal; nunca mostra "-0" */
export const anbNum = (v: any, d = 0) => {
  if (v == null || v === '' || !isFinite(+v)) return '—'
  const x = Math.abs(+v) < 0.5 * Math.pow(10, -d) ? 0 : +v
  return x.toLocaleString(aPT() ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
/** fluxos acumulados incoerentes com o patrimônio (resgate de veículos antigos que migraram de cadastro) */
export const anbFlowsInconsistent = (r: any) => r.pl_bi != null && Math.abs(r.twelve_months ?? 0) > Math.max(2 * r.pl_bi * 1000, 1000)
export function anbTable(rows: any[]) {
  const base = rows.filter((r: any) => !/^total$/i.test(r.class_name))
  const unc = base.find((r: any) => r.class_name === 'Não classificado') || null
  const cls = base.filter((r: any) => r !== unc && ['day', 'month', 'year', 'twelve_months'].some(k => Math.abs(r[k] || 0) >= 0.5))
  const sum = (k: string) => cls.reduce((s: number, r: any) => s + (r[k] || 0), 0)
  const total = { class_name: 'Total', day: sum('day'), month: sum('month'), year: sum('year'), twelve_months: sum('twelve_months'), pl_bi: sum('pl_bi') }
  return { cls, unc, total, uncBad: unc ? anbFlowsInconsistent(unc) : false }
}
export function ANBView() {
  const { data: d, err } = useJSON<any>('funds_flow.json')
  const desk = useDesktop()
  const [view, setView] = useState<'d' | 'm'>('m')
  const [mode, setMode] = useState<'all' | 'exfi' | 'one'>('all')
  const [one, setOne] = useState('Ações')
  const [more, setMore] = useState(false)
  const title = aL('Fund flows by class', 'Captação por classe de fundo')
  if (!d) return <FnScreen code="ANB" title={title} ownTitle><Loading err={err} /></FnScreen>
  const ser = view === 'd' ? d.daily : d.monthly, xs: string[] = view === 'd' ? ser.dates : ser.months
  const all = Object.keys(ser.series).filter(c => c !== 'Não classificado' && ser.series[c].some((v: number) => Math.abs(v || 0) >= 0.5))
  const classes = mode === 'one' ? all.filter(c => c === one) : mode === 'exfi' ? all.filter(c => c !== 'Renda Fixa') : all
  const colors: Record<string, string> = { 'Renda Fixa': C.blue, 'Ações': C.amber, 'Multimercados': C.purple, 'Cambial': C.cyan, 'FIDC': C.up, 'FMP-FGTS': tc('#B0BEC5'), 'Participações (FIP)': tc('#FF7AB6'), 'Imobiliários (FII)': tc('#E0C060') }
  const { cls, unc, total, uncBad } = anbTable(d.rows)
  const refIso = brToIso(d.data_ref) || ''
  const partial = view === 'm' && xs.length > 0 && refIso.slice(0, 7) === xs[xs.length - 1]
  const K = [{ k: 'day', en: 'Day', pt: 'Dia' }, { k: 'month', en: 'Month', pt: 'Mês' }, { k: 'year', en: 'Year', pt: 'Ano' }, { k: 'twelve_months', en: '12 months', pt: '12 meses' }]
  const showK = desk || more ? K : K.filter(x => x.k === 'month' || x.k === 'twelve_months')
  const showAum = desk || more
  const sticky: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2 }
  const cell = (r: any, k: string, muted = false, dash = false) => {
    const v = r[k]; const txt = dash ? '—' : anbNum(v)
    return <td key={k} className="px-2 py-[2px] text-right whitespace-nowrap border-b" style={{ borderColor: tc('#1a1a1a'), color: dash || muted ? C.muted : clr(Math.abs(v) < 0.5 ? 0 : v) }}>{txt}</td>
  }
  const aum = (r: any, muted = false) => <td className="px-2 py-[2px] text-right whitespace-nowrap border-b" style={{ borderColor: tc('#1a1a1a'), color: muted ? C.muted : C.text }}>{r.pl_bi == null || r.pl_bi < 0.05 ? '—' : anbNum(r.pl_bi, 1)}</td>
  const row = (r: any, i: number, opt: { bold?: boolean; muted?: boolean; dashLong?: boolean; label?: string } = {}) => {
    const bg = opt.bold ? tc('#151515') : i % 2 ? tc('#0a0a0a') : C.panel
    return <tr key={r.class_name} data-anb-row={r.class_name} style={{ background: bg, fontWeight: opt.bold ? 700 : 400 }}>
      <td className="px-2 py-[2px] whitespace-nowrap border-b" style={{ ...sticky, background: bg, borderColor: tc('#1a1a1a'), color: opt.muted ? C.muted : C.amber }}>{opt.label || anbName(r.class_name)}</td>
      {showK.map(x => cell(r, x.k, opt.muted, opt.dashLong && (x.k === 'year' || x.k === 'twelve_months')))}
      {showAum && aum(r, opt.muted)}
    </tr>
  }
  const tot12 = total.twelve_months / 1e3, totY = total.year / 1e3
  const note = aL(
    'Net flows = subscriptions − redemptions reported daily by each fund, grouped by its registered class. Own methodology; figures in R$ millions (AUM in R$ billions). Funds of funds are counted alongside the funds they invest in, so AUM is double-counted. "Unclassified" gathers vehicles with no current class registration — mostly old funds that migrated to a new registration: their redemptions show up here while the matching subscriptions land in the new class, so this row is left out of the totals, and its year and 12-month sums are shown as — when they are out of line with its AUM. Year and 12-month totals add up the same classes. The latest month is month-to-date.',
    'Captação líquida = aplicações − resgates informados diariamente por cada fundo, agrupados pela classe registrada. Metodologia própria; valores em R$ milhões (PL em R$ bilhões). Fundos de fundos entram junto com os fundos investidos, então o PL é contado em dobro. "Não classificado" reúne veículos sem registro de classe atual — em geral fundos antigos que migraram para um novo registro: os resgates aparecem aqui e as aplicações correspondentes entram na nova classe, por isso essa linha fica fora dos totais, e as somas do ano e de 12 meses aparecem como — quando não batem com o PL. Os totais do ano e de 12 meses somam as mesmas classes. O último mês é parcial (mês até a data).')
  const legend = <div data-anb-legend className="flex flex-wrap gap-x-3 gap-y-[2px] px-2 pt-1 text-[11px]">{classes.map(c => <span key={c} style={{ color: colors[c] || C.white }}>■ <span style={{ color: C.text }}>{anbName(c)}</span></span>)}<span style={{ color: C.muted }}>{aL('R$ millions', 'R$ milhões')}{partial ? aL(' · last month = month-to-date', ' · último mês parcial') : ''}</span></div>
  return (
    <FnScreen code="ANB" title={title} ownTitle wrap asOf={refIso}
      right={<><Btns opts={[{ v: 'd', l: aL('Daily', 'Diário') }, { v: 'm', l: aL('Monthly', 'Mensal') }] as any} value={view} onChange={setView as any} />
        <Btns opts={[{ v: 'all', l: aL('All', 'Todas') }, { v: 'exfi', l: aL('Ex fixed income', 'Sem renda fixa') }, { v: 'one', l: aL('One class', 'Uma classe') }] as any} value={mode} onChange={setMode as any} />
        {mode === 'one' && <select data-anb-one className={inputCls} style={inputStyle} value={one} onChange={e => setOne(e.target.value)}>{all.map(c => <option key={c} value={c}>{anbName(c)}</option>)}</select>}</>}
      source={aL('Daily fund reports and the fund class registry (public open data).', 'Informes diários dos fundos e cadastro de classes (dados públicos abertos).')} note={note}>
      <div data-anb-summary className="pb-1 text-[11px]" style={{ color: C.muted }}>{aL('Total', 'Total')} · {aL('year', 'ano')}: <span style={{ color: clr(totY) }}>R$ {anbNum(totY, 1)} {aL('bn', 'bi')}</span> · {aL('12 months', '12 meses')}: <span style={{ color: clr(tot12) }}>R$ {anbNum(tot12, 1)} {aL('bn', 'bi')}</span> {unc ? <>· {aL('excl. unclassified', 'sem não classificados')}</> : null}</div>
      {!desk && !more && <div data-anb-hint className="pb-1 text-[11px]" style={{ color: C.muted }}>{aL('Showing month and 12 months.', 'Mostrando mês e 12 meses.')}</div>}
      <div data-anb-wrap className="overflow-x-auto">
        <table data-anb-table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0" style={{ background: C.panel2, zIndex: 3 }}><tr>
            <th className="px-2 py-[3px] text-left font-normal whitespace-nowrap border-b" style={{ ...sticky, background: C.panel2, color: C.amber, borderColor: C.line }}>{aL('Class', 'Classe')}</th>
            {showK.map(x => <th key={x.k} className="px-2 py-[3px] text-right font-normal whitespace-nowrap border-b" style={{ color: C.amber, borderColor: C.line }}>{aL(x.en, x.pt)}</th>)}
            {showAum && <th className="px-2 py-[3px] text-right font-normal whitespace-nowrap border-b" style={{ color: C.amber, borderColor: C.line }}>{aL('AUM (R$ bn)', 'PL (R$ bi)')}</th>}
          </tr></thead>
          <tbody>
            {cls.map((r: any, i: number) => row(r, i))}
            {row(total, 0, { bold: true })}
            {unc && row(unc, 1, { muted: true, dashLong: uncBad, label: aL('Unclassified (not in total)', 'Não classificado (fora do total)') })}
          </tbody>
        </table>
      </div>
      {!desk && <button data-anb-more className="mt-1 px-2 py-[1px] text-[11px] border" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? aL('Fewer columns', 'Menos colunas') : aL('More columns', 'Mais colunas')}</button>}
      <div className="mt-2"><Panel title={`${view === 'd' ? aL('Daily net flows by class', 'Captação líquida diária por classe') : aL('Monthly net flows by class', 'Captação líquida mensal por classe')} (${aL('R$ mn', 'R$ mi')})`}>
        {legend}
        <div data-anb-chart><FnChart height={desk ? 320 : 260} panes={[{ series: classes.map(c => ({ kind: 'line' as const, data: xs.map((t: string, i: number) => ({ time: view === 'm' ? t + '-28' : t, value: ser.series[c][i] })).filter((p: any) => p.value != null), color: colors[c] || C.white, decimals: 0, lastValue: false })) }]} /></div>
      </Panel></div>
    </FnScreen>
  )
}

// ---------------- CDIE ----------------
// ---------------- PORT ----------------
const DEF_PORT = [{ cod: 'PETR4', w: 25 }, { cod: 'VALE3', w: 25 }, { cod: 'ITUB4', w: 25 }, { cod: 'B3SA3', w: 25 }]
export function PORTView() {
  const { data: u, err } = useJSON<any>('universe.json')
  const cdi = useJSON<any>('cdi.json')
  const [pos, setPos] = useState<{ cod: string; w: number }[]>(DEF_PORT)
  const [add, setAdd] = useState('WEGE3'), [reb, setReb] = useState<'d' | 'm' | 'n'>('m')
  useEffect(() => { setPos(readStoredJSON(window.localStorage, 'qt_port', validPortfolio, DEF_PORT)) }, [])
  useEffect(() => { try { localStorage.setItem('qt_port', JSON.stringify(pos)) } catch { } }, [pos])
  const calc = useMemo(() => {
    if (!u || !pos.length) return null
    const dates = u.dates as string[], tw = pos.reduce((s, p) => s + p.w, 0) || 1
    const W = pos.map(p => p.w / tw), cl = pos.map(p => u.close[p.cod] || [])
    let start = 0; while (start < dates.length && cl.some((c: any) => c[start] == null)) start++
    let hold = W.slice(), val = 1; const nav: { time: string; value: number }[] = [{ time: dates[start], value: 100 }], ib: { time: string; value: number }[] = [], rets: number[] = [], ibr: number[] = []
    const ibc = u.close['^BVSP']; const ib0 = ibc[start]; ib.push({ time: dates[start], value: 100 })
    for (let i = start + 1; i < dates.length; i++) {
      const r = cl.map((c: any) => c[i] != null && c[i - 1] != null ? c[i] / c[i - 1] - 1 : 0)
      const pr = hold.reduce((s, h, k) => s + h * r[k], 0)
      hold = hold.map((h, k) => h * (1 + r[k]) / (1 + pr)); val *= 1 + pr
      if (reb === 'd' || (reb === 'm' && dates[i].slice(5, 7) !== dates[i - 1].slice(5, 7))) hold = W.slice()
      nav.push({ time: dates[i], value: val * 100 }); rets.push(pr)
      if (ibc[i] != null && ibc[i - 1] != null) { ib.push({ time: dates[i], value: ibc[i] / ib0 * 100 }); ibr.push(ibc[i] / ibc[i - 1] - 1) } else ibr.push(0)
    }
    const cs = (cdi.data?.series || []) as [string, number][]
    const cdiMap = new Map(cs.map(x => [x[0], x[1] / 100])); let cf = 1; const cdiNav = [{ time: dates[start], value: 100 }]
    for (let i = start + 1; i < dates.length; i++) { cf *= 1 + (cdiMap.get(dates[i]) || 0); cdiNav.push({ time: dates[i], value: cf * 100 }) }
    const yrs = rets.length / 252, ann = (Math.pow(val, 1 / yrs) - 1) * 100, cdiAnn = (Math.pow(cf, 1 / yrs) - 1) * 100
    const vol = std(rets) * Math.sqrt(252) * 100, reg = regress(ibr, rets)
    const ibAnn = (Math.pow(ib[ib.length - 1].value / 100, 1 / yrs) - 1) * 100
    const contrib = pos.map((p, k) => { const c = cl[k], j = lastValid(c); return { ...p, wn: W[k] * 100, ret: j > start && c[start] != null ? (c[j] / c[start] - 1) * 100 : null, last: j >= 0 ? c[j] : null } })
    return { nav, ib, cdiNav, ann, cdiAnn, ibAnn, vol, sharpe: (ann - cdiAnn) / vol, mdd: maxDrawdown(nav.map(x => x.value)), beta: reg.beta, corr: reg.corr, from: dates[start], contrib, total: (val - 1) * 100 }
  }, [u, cdi.data, pos, reb])
  if (!u) return <FnScreen code="PORT"><Loading err={err} /></FnScreen>
  const codes = u.components.map((c: any) => c.cod).sort()
  return (
    <FnScreen code="PORT" title="Portfolio — backtest" right={<><Field label="Rebalance"><Btns opts={[{ v: 'd', l: 'Daily' }, { v: 'm', l: 'Monthly' }, { v: 'n', l: 'Never' }] as any} value={reb} onChange={setReb as any} /></Field></>}
      source="B3 (Ibovespa components) + Yahoo Finance (adjusted close) + BCB SGS 12 (CDI)." note="Simulation without costs, taxes or slippage. Portfolio saved only in your browser (localStorage). Sharpe = (annual return − annual CDI) ÷ volatility.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '380px 1fr' }}>
        <Panel title="Positions (target weights %)">
          <div className="flex items-center gap-2 p-2 text-[12px]"><select className={inputCls} style={inputStyle} value={add} onChange={e => setAdd(e.target.value)}>{codes.map((c: string) => <option key={c}>{c}</option>)}</select>
            <button className="px-2 border text-[12px]" style={{ borderColor: C.amber, color: C.amber }} onClick={() => !pos.find(p => p.cod === add) && setPos([...pos, { cod: add, w: 10 }])}>+ add</button>
            <button className="px-2 border text-[12px]" style={{ borderColor: C.line, color: C.muted }} onClick={() => setPos(DEF_PORT)}>default</button></div>
          <table className="w-full text-[12px]"><thead><tr style={{ color: C.amber }}><th className="px-2 text-left font-normal">Asset</th><th className="text-right font-normal">Weight</th><th className="text-right font-normal">Norm.</th><th className="text-right font-normal">Ret.</th><th></th></tr></thead>
            <tbody>{calc?.contrib.map((p, k) => <tr key={p.cod} className="border-t" style={{ borderColor: tc('#1a1a1a') }}><td className="px-2" style={{ color: C.amber }}>{p.cod}</td><td className="text-right"><input className={inputCls + ' w-14 text-right'} style={inputStyle} type="number" value={p.w} onChange={e => setPos(pos.map((x, j) => j === k ? { ...x, w: Math.max(0, +e.target.value) } : x))} /></td><td className="text-right">{nf(p.wn, 1)}%</td><td className="text-right" style={{ color: clr(p.ret) }}>{pf(p.ret, 1)}</td><td className="text-center"><button style={{ color: C.down }} onClick={() => setPos(pos.filter((_, j) => j !== k))}>×</button></td></tr>)}</tbody></table>
          {calc && <KV rows={[['Series start', dBRfull(calc.from)], ['Total return', pf(calc.total, 1), clr(calc.total)], ['Annualized return', pf(calc.ann, 2), C.amber], ['Ibovespa annualized', pf(calc.ibAnn, 2)], ['CDI annualized', pf(calc.cdiAnn, 2, false)], ['Annual volatility', pf(calc.vol, 2, false)], ['Sharpe (vs CDI)', nf(calc.sharpe, 2)], ['Max drawdown', pf(calc.mdd, 1), C.down], ['Beta vs IBOV', nf(calc.beta, 2)], ['Correlation vs IBOV', nf(calc.corr, 2)]]} />}
        </Panel>
        {calc && <FnChart height={600} panes={[{ stretch: 0.72, series: [{ kind: 'line', data: calc.nav, color: C.amber, width: 2, title: 'Portfolio' }, { kind: 'line', data: calc.ib, color: C.white, title: 'IBOV' }, { kind: 'line', data: calc.cdiNav, color: tc('#888'), title: 'CDI', dashed: true }] }, { stretch: 0.28, series: [{ kind: 'area', data: (() => { let pk = 0; return calc.nav.map(x => { pk = Math.max(pk, x.value); return { time: x.time, value: (x.value / pk - 1) * 100 } }) })(), color: C.down, title: 'Drawdown', pct: true }] }]} />}
      </div>
    </FnScreen>
  )
}

// ---------------- ALERT ----------------
type LA = { id: string; ticker: string; op: 'above' | 'below'; value: number }
export function ALERTView() {
  const { data: d, err } = useJSON<any>('alerts.json')
  const [loc, setLoc] = useState<LA[]>([])
  const [f, setF] = useState<LA>({ id: '', ticker: 'PETR4.SA', op: 'above', value: 60 })
  const [px, setPx] = useState<Record<string, { last: number; date: string }>>({})
  useEffect(() => { setLoc(readStoredJSON(window.localStorage, 'qt_alerts', validLocalAlerts, [])) }, [])
  useEffect(() => { try { localStorage.setItem('qt_alerts', JSON.stringify(loc)) } catch { } }, [loc])
  useEffect(() => { if (d) setPx(Object.fromEntries(d.rules.map((r: any) => [r.ticker, { last: r.last, date: r.date }]))) }, [d])
  useEffect(() => { import('../../lib/static').then(m => loc.forEach(a => !px[a.ticker] && m.getPrices(a.ticker, undefined, undefined, 'd', true).then(p => { const l = p[p.length - 1]; setPx(o => ({ ...o, [a.ticker]: { last: l.close, date: l.time } })) }).catch(() => { }))) }, [loc]) // eslint-disable-line
  if (!d) return <FnScreen code="ALERT"><Loading err={err} /></FnScreen>
  const opL = (o: string, v: number) => o === 'above' ? `≥ ${nf(v)}` : o === 'below' ? `≤ ${nf(v)}` : o === 'change_pct_below' ? `day chg ≤ ${nf(v)}%` : `day chg ≥ ${nf(v)}%`
  const tickers = ['PETR4.SA', 'PETR3.SA', 'VALE3.SA', 'ITUB4.SA', 'ITUB3.SA', 'B3SA3.SA', '^BVSP', 'BRL=X', 'EURUSD=X', 'DX-Y.NYB']
  return (
    <FnScreen code="ALERT" title="Price alerts" source={d.source} note="Repository rules (alerts.yaml) are evaluated at the close by GitHub Actions; when they trigger, the workflow opens an issue (GitHub email notification). Local alerts live only in your browser and are checked when you open this page. There is no real-time push.">
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title={`Pipeline rules (alerts.yaml) — ${dBRfull(d.generated_at?.slice(0, 10))}`}>
          <Grid rowStyle={(r: any) => r.triggered ? { background: tc('#2a1010') } : undefined} cols={[{ k: 'triggered', label: '', fmt: (v: boolean) => v ? '🔔' : '·', w: '24px' }, { k: 'ticker', label: 'Asset', color: () => C.amber }, { k: 'op', label: 'Condition', fmt: (v: string, r: any) => opL(v, r.value) }, { k: 'last', label: 'Last', align: 'r', fmt: (v: number) => nf(v) }, { k: 'change_pct', label: 'Var%', align: 'r', fmt: (v: number) => pf(v), color: clr }, { k: 'note', label: 'Description', fmt: (v: string, r: any) => lang() === 'pt' ? v : (r.note_en || en(v)), color: () => C.muted }, { k: 'triggered', label: 'Status', fmt: (v: boolean) => lang() === 'pt' ? (v ? 'DISPAROU' : 'aguardando') : (v ? 'TRIGGERED' : 'waiting'), color: (v: boolean) => v ? C.down : C.muted }]} rows={d.rules} />
        </Panel>
        <Panel title="Local alerts (browser)">
          <div className="flex flex-wrap items-center gap-2 p-2 text-[12px]">
            <select className={inputCls} style={inputStyle} value={f.ticker} onChange={e => setF({ ...f, ticker: e.target.value })}>{tickers.map(t => <option key={t}>{t}</option>)}</select>
            <select className={inputCls} style={inputStyle} value={f.op} onChange={e => setF({ ...f, op: e.target.value as any })}><option value="above">above</option><option value="below">below</option></select>
            <input className={inputCls + ' w-20'} style={inputStyle} type="number" value={f.value} onChange={e => setF({ ...f, value: +e.target.value })} />
            <button className="px-2 border" style={{ borderColor: C.amber, color: C.amber }} onClick={() => setLoc([...loc, { ...f, id: String(Date.now()) }])}>+ create</button>
          </div>
          <Grid rowStyle={(r: any) => r.hit ? { background: tc('#2a1010') } : undefined} cols={[{ k: 'ticker', label: 'Asset', color: () => C.amber }, { k: 'op', label: 'Condition', fmt: (v: string, r: any) => opL(v, r.value) }, { k: 'last', label: 'Last', align: 'r', fmt: (v: number) => nf(v) }, { k: 'hit', label: 'Status', fmt: (v: boolean) => lang() === 'pt' ? (v ? 'DISPAROU' : 'aguardando') : (v ? 'TRIGGERED' : 'waiting'), color: (v: boolean) => v ? C.down : C.muted }, { k: 'id', label: '', fmt: (v: string) => <button style={{ color: C.down }} onClick={() => setLoc(loc.filter(a => a.id !== v))}>×</button> }]}
            rows={loc.map(a => { const l = px[a.ticker]?.last; return { ...a, last: l, hit: l != null && (a.op === 'above' ? l >= a.value : l <= a.value) } })} />
          {!loc.length && <div className="p-2 text-[12px]" style={{ color: C.muted }}>No local alerts. Create one above.</div>}
        </Panel>
      </div>
      <div className="mt-2 text-[11px]" style={{ color: C.muted }}>To add permanent rules, edit <span style={{ color: C.amber }}>alerts.yaml</span> in the repository; the next workflow run evaluates it and, if it triggers, opens an issue. <a href={href('/')} style={{ color: C.amber }}>Start</a></div>
    </FnScreen>
  )
}
