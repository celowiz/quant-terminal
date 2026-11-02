'use client'
/** P4 – funções novas com dados abertos: RESV (reservas internacionais), WEO (projeções econômicas mundiais),
 *  EUCV (curva soberana da área do euro), CDR (feriados das bolsas) e INSD (negociações de administradores).
 *  Textos EN/PT por tela (L(en, pt)); dados gerados por pipeline/build_fns4.py — "—" quando a fonte falha. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import XYChart from '@/components/fn/XYChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, inputCls, inputStyle } from '@/components/fn/kit'
import { n, pc, cl, dUS, bigE, Kpis, Loading2, Unavailable, weekday, todaySP, dayN } from './fn11util'
import { lang } from '@/lib/settings'
import { tc } from '@/lib/themeRuntime'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const isoAgo = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10)
const sgn = (v: any, d = 1) => v == null || !isFinite(+v) ? '—' : `${+v > 0 ? '+' : ''}${n(v, d)}`
const Muted = ({ t }: { t: string }) => <div className="p-2 text-[12px]" style={{ color: C.muted, fontFamily: MONO }}>{t}</div>
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monName = (m: number) => (lang() === 'pt' ? MON_PT : MON_EN)[m]
const WD_PT: Record<string, string> = { Sun: 'dom', Mon: 'seg', Tue: 'ter', Wed: 'qua', Thu: 'qui', Fri: 'sex', Sat: 'sáb' }
const wd = (iso: string) => { const w = weekday(iso); return lang() === 'pt' ? WD_PT[w] : w }

// ======================= RESV =======================
const RRANGE: [string, number | null][] = [['1Y', 366], ['3Y', 3 * 366], ['10Y', 3660], ['MAX', null]]
export function RESVView() {
  const { data: d, err } = useJSON<any>('resv.json')
  const [rng, setRng] = useState('3Y')
  const m = useMemo(() => {
    if (!d || d.unavailable) return null
    const mt = d.monthly.t as string[], mv = d.monthly.v as number[]
    const rows = mt.map((t, i) => ({ t, v: mv[i], mom: i ? mv[i] - mv[i - 1] : null, yoy: i >= 12 ? mv[i] - mv[i - 12] : null }))
    return rows
  }, [d])
  if (!d || !m) return <FnScreen code="RESV" title="Brazil FX Reserves"><Loading2 err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  const days = RRANGE.find(r => r[0] === rng)?.[1] ?? null
  const from = days ? isoAgo(d.date, days) : null
  const dt = d.daily.t as string[], dv = d.daily.v as number[]
  const daily = dt.map((t, i) => ({ time: t, value: dv[i] / 1000 })).filter(p => !from || p.time >= from)
  const monthly = m.map(r => ({ time: r.t, value: r.v / 1000 })).filter(p => !from || p.time >= from)
  const yoy = m.filter(r => r.yoy != null && (!from || r.t >= from)).map(r => ({ time: r.t, value: r.yoy! / 1000, color: r.yoy! >= 0 ? C.up : C.down }))
  const bn = (v: any, dd = 1) => v == null ? '—' : `US$ ${n(v / 1000, dd)} ${L('bn', 'bi')}`
  const sbn = (v: any) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v) / 1000, 1)}`
  const last12 = [...m].reverse().slice(0, 24)
  const note = L(
    `Brazil's international reserves, liquidity concept, in US dollars: foreign currency deposits, securities, gold, SDRs and the reserve position at the multilateral fund, valued at market prices. The daily series (last value ${dUS(d.date)}) is released with a lag of about two business days; the monthly series is the end-of-month stock and starts in 2000. Changes mix interventions and swaps maturing in cash, interest earned and valuation (exchange rates of non-dollar assets, gold, bond prices), so a fall does not by itself mean the central bank sold dollars.`,
    `Reservas internacionais do Brasil, conceito liquidez, em dólares: depósitos em moeda estrangeira, títulos, ouro, DES e a posição de reserva no fundo multilateral, a preços de mercado. A série diária (último dado ${dUS(d.date)}) sai com cerca de dois dias úteis de atraso; a mensal é o estoque no fim do mês e começa em 2000. As variações misturam intervenções e linhas liquidadas à vista, juros recebidos e efeito de preço (câmbio dos ativos fora do dólar, ouro, preço dos títulos), então uma queda não quer dizer, sozinha, que o banco central vendeu dólares.`)
  return (
    <FnScreen code="RESV" title="Brazil FX Reserves" source={d.source} note={note} asOf={d.date}
      right={<Field label={L('Range', 'Período')}><Btns opts={RRANGE.map(r => r[0])} value={rng} onChange={setRng} /></Field>}>
      <Kpis items={[
        [L('Reserves', 'Reservas'), bn(d.last, 1), C.white],
        [L('1W change (US$ bn)', 'Var. 1 semana (US$ bi)'), sbn(d.chg['1w']), cl(d.chg['1w'])],
        [L('1M change', 'Var. 1 mês'), sbn(d.chg['1m']), cl(d.chg['1m'])],
        [L('12M change', 'Var. 12 meses'), sbn(d.chg['12m']), cl(d.chg['12m'])],
        [L('Year to date', 'No ano'), sbn(d.chg.ytd), cl(d.chg.ytd)],
        [L('Daily record', 'Recorde diário'), d.max ? `${n(d.max[1] / 1000, 1)} · ${dUS(d.max[0])}` : '—', C.amber],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1fr)' }}>
        <Panel title={L('International reserves (US$ bn) and 12-month change', 'Reservas internacionais (US$ bi) e variação em 12 meses')}>
          <FnChart height={520} panes={[
            { stretch: 3, series: [days && days <= 3660 ? { kind: 'area', data: daily, color: C.cyan, title: L('Daily', 'Diária'), decimals: 1 } : { kind: 'area', data: monthly, color: C.cyan, title: L('Month-end', 'Fim do mês'), decimals: 1 }] },
            { stretch: 1, series: [{ kind: 'hist', data: yoy, title: L('12M change', 'Var. 12m'), decimals: 1 }] },
          ]} />
        </Panel>
        <Panel title={L('Month-end stock (US$ bn)', 'Estoque no fim do mês (US$ bi)')}>
          <Grid maxH={560} rows={last12} cols={[
            { k: 't', label: L('Month', 'Mês'), fmt: x => `${monName(+x.slice(5, 7) - 1)}/${x.slice(2, 4)}`, color: () => C.amber },
            { k: 'v', label: L('Stock', 'Estoque'), align: 'r', fmt: x => n(x / 1000, 1), color: () => C.white },
            { k: 'mom', label: L('MoM', 'No mês'), align: 'r', fmt: x => sbn(x), color: x => cl(x) },
            { k: 'yoy', label: L('12M', '12m'), align: 'r', fmt: x => sbn(x), color: x => cl(x) },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= WEO =======================
const WEO_LAB: Record<string, [string, string, string]> = {
  NGDP_RPCH: ['Real GDP growth', 'Crescimento do PIB real', '%'], PCPIPCH: ['Inflation (avg. CPI)', 'Inflação (IPC médio)', '%'],
  LUR: ['Unemployment rate', 'Taxa de desemprego', '%'], GGXWDG_NGDP: ['Gross public debt', 'Dívida pública bruta', '% GDP'],
  GGXCNL_NGDP: ['Fiscal balance', 'Resultado fiscal nominal', '% GDP'], BCA_NGDPD: ['Current account', 'Conta-corrente', '% GDP'],
}
const AREA_PT: Record<string, string> = { WEOWORLD: 'Mundo', ADVEC: 'Economias avançadas', OEMDC: 'Emergentes e em desenvolvimento', EURO: 'Área do euro', USA: 'Estados Unidos',
  CHN: 'China', BRA: 'Brasil', DEU: 'Alemanha', JPN: 'Japão', GBR: 'Reino Unido', FRA: 'França', ITA: 'Itália', ESP: 'Espanha', CAN: 'Canadá', IND: 'Índia',
  KOR: 'Coreia do Sul', AUS: 'Austrália', MEX: 'México', ARG: 'Argentina', CHL: 'Chile', COL: 'Colômbia', PER: 'Peru', URY: 'Uruguai', RUS: 'Rússia',
  TUR: 'Turquia', ZAF: 'África do Sul', IDN: 'Indonésia', SAU: 'Arábia Saudita', NGA: 'Nigéria', EGY: 'Egito' }
const AREA_EN: Record<string, string> = { CHN: 'China', KOR: 'South Korea', RUS: 'Russia', TUR: 'Türkiye', OEMDC: 'Emerging & developing' }
const GROUPS = new Set(['WEOWORLD', 'ADVEC', 'OEMDC', 'EURO'])
export function WEOView() {
  const { data: d, err } = useJSON<any>('weo.json')
  const [ind, setInd] = useState('NGDP_RPCH'), [sel, setSel] = useState('BRA'), [sort, setSort] = useState('area')
  const areaName = (a: string) => lang() === 'pt' ? (AREA_PT[a] || a) : (AREA_EN[a] || d?.labels?.[a] || a)
  const years: number[] = d?.years || []
  const show = years.filter(y => d && y >= d.first_proj - 4)
  const rows = useMemo(() => {
    if (!d || d.unavailable) return []
    const ix = years.indexOf(d.first_proj)
    const r = Object.keys(d.rows).map(a => ({ a, v: d.rows[a][ind] as (number | null)[] }))
    if (sort === 'cur') return [...r].sort((x, y) => (y.v[ix] ?? -1e9) - (x.v[ix] ?? -1e9))
    if (sort === 'next') return [...r].sort((x, y) => (y.v[ix + 1] ?? -1e9) - (x.v[ix + 1] ?? -1e9))
    return r
  }, [d, ind, sort, years])
  if (!d || d.unavailable) return <FnScreen code="WEO" title="World Economic Projections"><Loading2 err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  const ed = `${monName(+d.edition.slice(5, 7) - 1)} ${d.edition.slice(0, 4)}`
  const fp = d.first_proj, ix = years.indexOf(fp)
  const a = d.rows[sel] ? sel : Object.keys(d.rows)[0]
  const ser = (d.rows[a][ind] as (number | null)[]).map((v, i) => v == null ? null : ({ time: `${years[i]}-01-01`, value: v, color: years[i] >= fp ? C.amber : C.cyan })).filter(Boolean) as any[]
  const [lab, labPt, unit] = WEO_LAB[ind]
  const note = L(
    `Macroeconomic projections from the latest semiannual round of official multilateral world economic projections (${ed} edition), for ${Object.keys(d.rows).length} economies and groups. Values from ${fp} onward (amber) are projections; earlier years are actual data or estimates as revised in this edition. Inflation is the annual average change in consumer prices; debt and fiscal balance refer to general government; the current account is in % of GDP in US dollars. Group aggregates (world, advanced, emerging, euro area) are weighted as in the publication. Projections are revised every April and October and often by a lot: they are a reference, not a forecast we endorse.`,
    `Projeções macroeconômicas da rodada semestral mais recente das projeções econômicas mundiais oficiais de um organismo multilateral (edição de ${ed}), para ${Object.keys(d.rows).length} economias e grupos. Os valores a partir de ${fp} (âmbar) são projeções; os anos anteriores são dados realizados ou estimativas como revisadas nesta edição. Inflação é a variação média anual dos preços ao consumidor; dívida e resultado fiscal são do governo geral; a conta-corrente está em % do PIB em dólares. Os agregados (mundo, avançadas, emergentes, área do euro) seguem a ponderação da publicação. As projeções são revistas todo abril e outubro, muitas vezes bastante: são uma referência, não uma previsão que endossamos.`)
  const fmt = (v: any) => n(v, 1)
  const colr = (v: any) => v == null ? C.muted : (ind === 'GGXCNL_NGDP' || ind === 'BCA_NGDPD' || ind === 'NGDP_RPCH') ? cl(v) : C.text
  return (
    <FnScreen code="WEO" title="World Economic Projections" source={d.source} note={note} asOf={`${d.edition}-01`}
      right={<><Field label={L('Indicator', 'Indicador')}><select className={inputCls} style={inputStyle} value={ind} onChange={e => setInd(e.target.value)}>
        {d.indicators.map((i: string) => <option key={i} value={i}>{L(WEO_LAB[i][0], WEO_LAB[i][1])} ({WEO_LAB[i][2]})</option>)}</select></Field>
        <Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'area', l: L('Default', 'Padrão') }, { v: 'cur', l: String(fp) }, { v: 'next', l: String(fp + 1) }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('Edition', 'Edição'), ed, C.white],
        ...['WEOWORLD', 'USA', 'CHN', 'EURO', 'BRA'].map(k => [`${areaName(k)} ${fp} / ${fp + 1}`, `${fmt(d.rows[k]?.[ind]?.[ix])} / ${fmt(d.rows[k]?.[ind]?.[ix + 1])}`, k === 'BRA' ? C.amber : undefined] as [string, string, string?]),
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <Panel title={`${L(lab, labPt)} (${unit}) · ${L('click a row', 'clique numa linha')}`}>
          <Grid maxH={600} rows={rows} onRow={(r: any) => setSel(r.a)} rowStyle={(r: any) => r.a === a ? { background: C.line } : GROUPS.has(r.a) ? { background: C.panel2 } : undefined} cols={[
            { k: 'a', label: L('Economy', 'Economia'), fmt: x => <span className="block truncate max-w-[180px]" title={areaName(x)}>{areaName(x)}</span>, color: x => GROUPS.has(x) ? C.white : C.amber, w: '180px' },
            ...show.map(y => ({ k: String(y), label: <span style={{ color: y >= fp ? C.amber : undefined }}>{y}{y >= fp ? '*' : ''}</span>, align: 'r' as const,
              fmt: (_: any, r: any) => fmt(r.v[years.indexOf(y)]), color: (_: any, r: any) => colr(r.v[years.indexOf(y)]) })),
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={`${areaName(a)} · ${L(lab, labPt)} (${unit})`}>
            <FnChart height={260} panes={[{ series: [{ kind: 'hist', data: ser, title: L(lab, labPt), decimals: 1 }] }]} />
            <div className="px-2 pb-1 text-[11px]" style={{ color: C.muted }}><span style={{ color: C.cyan }}>■</span> {L('actual / estimate', 'realizado / estimativa')} <span className="ml-3" style={{ color: C.amber }}>■</span> {L('projection', 'projeção')}</div>
          </Panel>
          <Panel title={`${areaName(a)} · ${fp} / ${fp + 1} / ${fp + 5}`}>
            <KV rows={d.indicators.map((i: string) => [`${L(WEO_LAB[i][0], WEO_LAB[i][1])} (${WEO_LAB[i][2]})`,
              <span key={i}>{fmt(d.rows[a][i]?.[ix])} / {fmt(d.rows[a][i]?.[ix + 1])} / {fmt(d.rows[a][i]?.[ix + 5])}</span>] as [string, React.ReactNode])} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= EUCV =======================
const MAT_Y: Record<string, number> = { '3M': 0.25, '6M': 0.5, '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, '15Y': 15, '20Y': 20, '30Y': 30 }
const CMP: [string, number][] = [['1W', 7], ['1M', 30], ['3M', 91], ['1Y', 365]]
const HR: [string, number | null][] = [['1Y', 366], ['3Y', 3 * 366], ['MAX', null]]
export function EUCVView() {
  const { data: d, err } = useJSON<any>('eucv.json')
  const [cv, setCv] = useState('aaa'), [cmp, setCmp] = useState('1M'), [hr, setHr] = useState('3Y')
  if (!d || d.unavailable) return <FnScreen code="EUCV" title="Euro Area Yield Curve"><Loading2 err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  const dates = d.dates as string[], last = dates.length - 1
  const cdays = CMP.find(c => c[0] === cmp)![1]
  const lim = isoAgo(d.date, cdays)
  let ci = 0; for (let i = 0; i < dates.length; i++) if (dates[i] <= lim) ci = i
  const at = (k: string, m: string, i: number) => d.curves[k]?.[m]?.[i] ?? null
  const other = cv === 'aaa' ? 'all' : 'aaa'
  const nm = (k: string) => k === 'aaa' ? L('AAA-rated', 'Rating AAA') : L('All issuers', 'Todos os emissores')
  const mats = d.mats as string[]
  const rows = mats.map(m => ({ m, now: at(cv, m, last), prev: at(cv, m, ci), chg: at(cv, m, last) != null && at(cv, m, ci) != null ? (at(cv, m, last) - at(cv, m, ci)) * 100 : null,
    sp: at('all', m, last) != null && at('aaa', m, last) != null ? (at('all', m, last) - at('aaa', m, last)) * 100 : null }))
  const pts = (k: string, i: number) => mats.map(m => [MAT_Y[m], at(k, m, i)] as [number, number | null])
  const s210 = (i: number) => at(cv, '10Y', i) != null && at(cv, '2Y', i) != null ? (at(cv, '10Y', i) - at(cv, '2Y', i)) * 100 : null
  const hdays = HR.find(h => h[0] === hr)![1], hfrom = hdays ? isoAgo(d.date, hdays) : null
  const ht = d.hist.t as string[]
  const hs = (m: string) => ht.map((t, i) => ({ time: t, value: d.hist[m][i] })).filter(p => p.value != null && (!hfrom || p.time >= hfrom))
  const slope = ht.map((t, i) => ({ time: t, value: d.hist['10Y'][i] != null && d.hist['2Y'][i] != null ? (d.hist['10Y'][i] - d.hist['2Y'][i]) * 100 : null })).filter(p => p.value != null && (!hfrom || p.time >= hfrom)) as any[]
  const note = L(
    `Euro area government bond yield curves estimated daily by the euro-area central bank with the Svensson model: zero-coupon spot yields for maturities from 3 months to 30 years. "AAA-rated" uses only bonds of AAA-rated euro-area governments; "All issuers" uses all euro-area central government bonds, so the gap between them is a rough gauge of average sovereign credit risk. Data for business days up to ${dUS(d.date)}; the curve is a model fit, not a traded price, and can differ from any single country's bonds. The history chart shows the AAA 2-, 10- and 30-year yields and the 10y–2y slope in basis points.`,
    `Curvas de juros dos títulos de governo da área do euro estimadas diariamente pelo banco central da área do euro com o modelo de Svensson: taxas à vista de cupom zero de 3 meses a 30 anos. "Rating AAA" usa só títulos de governos da área com rating AAA; "Todos os emissores" usa todos os títulos de governos centrais da área, então a diferença entre as duas é uma medida aproximada do risco de crédito soberano médio. Dados de dias úteis até ${dUS(d.date)}; a curva é um ajuste de modelo, não um preço negociado, e pode diferir dos títulos de um país específico. O gráfico histórico mostra as taxas AAA de 2, 10 e 30 anos e a inclinação 10a–2a em pontos-base.`)
  return (
    <FnScreen code="EUCV" title="Euro Area Yield Curve" source={d.source} note={note} asOf={d.date}
      right={<><Field label={L('Curve', 'Curva')}><Btns opts={[{ v: 'aaa', l: nm('aaa') }, { v: 'all', l: nm('all') }]} value={cv} onChange={setCv} /></Field>
        <Field label={L('Compare', 'Comparar')}><Btns opts={CMP.map(c => c[0])} value={cmp} onChange={setCmp} /></Field></>}>
      <Kpis items={[
        [L('Curve date', 'Data da curva'), dUS(d.date), C.white],
        ['2Y', pc(at(cv, '2Y', last), 3, false)],
        ['10Y', pc(at(cv, '10Y', last), 3, false), C.amber],
        ['30Y', pc(at(cv, '30Y', last), 3, false)],
        [L('10Y–2Y slope (bp)', 'Inclinação 10a–2a (pb)'), sgn(s210(last), 1), cl(s210(last))],
        [L('10Y all − AAA (bp)', '10a todos − AAA (pb)'), sgn(rows.find(r => r.m === '10Y')?.sp, 1)],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)' }}>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={`${nm(cv)} · ${L('zero-coupon spot curve (%)', 'curva à vista cupom zero (%)')}`}>
            <XYChart height={280} xLabel={L('years', 'anos')} xFmt={v => n(v, 0)} yFmt={v => n(v, 2)} series={[
              { name: `${dUS(d.date)}`, points: pts(cv, last), color: C.amber, width: 2 },
              { name: `${dUS(dates[ci])} (${cmp})`, points: pts(cv, ci), color: C.cyan, dash: '5 4' },
              { name: `${nm(other)} ${dUS(d.date)}`, points: pts(other, last), color: C.muted, dash: '2 3' },
            ]} />
          </Panel>
          <Panel title={L('AAA history (%) and 10y–2y slope (bp)', 'Histórico AAA (%) e inclinação 10a–2a (pb)')} right={<Btns opts={HR.map(h => h[0])} value={hr} onChange={setHr} />}>
            <FnChart height={260} panes={[
              { stretch: 3, series: [{ kind: 'line', data: hs('2Y'), color: C.cyan, title: '2Y', decimals: 2 }, { kind: 'line', data: hs('10Y'), color: C.amber, title: '10Y', decimals: 2 }, { kind: 'line', data: hs('30Y'), color: C.white, title: '30Y', decimals: 2 }] },
              { stretch: 1, series: [{ kind: 'baseline', data: slope, title: '10Y–2Y', decimals: 0 }] },
            ]} />
          </Panel>
        </div>
        <Panel title={`${nm(cv)} · ${L('by maturity', 'por prazo')}`}>
          <Grid rows={rows} cols={[
            { k: 'm', label: L('Maturity', 'Prazo'), color: () => C.amber },
            { k: 'now', label: dUS(d.date), align: 'r', fmt: x => n(x, 3), color: () => C.white },
            { k: 'prev', label: dUS(dates[ci]), align: 'r', fmt: x => n(x, 3) },
            { k: 'chg', label: L(`Δ ${cmp} (bp)`, `Δ ${cmp} (pb)`), align: 'r', fmt: x => sgn(x, 1), color: x => cl(x) },
            { k: 'sp', label: L('All − AAA (bp)', 'Todos − AAA (pb)'), align: 'r', fmt: x => sgn(x, 1) },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= CDR =======================
const MKT: Record<string, [string, string]> = { BVMF: ['B3 · São Paulo', 'B3 · São Paulo'], XNYS: ['NYSE · New York', 'NYSE · Nova York'], XLON: ['LSE · London', 'LSE · Londres'],
  XECB: ['Euro payments (TARGET2)', 'Pagamentos em euro (TARGET2)'], XJPX: ['JPX · Tokyo', 'JPX · Tóquio'], XHKG: ['HKEX · Hong Kong', 'HKEX · Hong Kong'] }
const MKT_SHORT: Record<string, string> = { BVMF: 'B3', XNYS: 'NYSE', XLON: 'LSE', XECB: 'TARGET2', XJPX: 'JPX', XHKG: 'HKEX' }
const HOL_PT: Record<string, string> = {
  "New Year's Day": 'Ano-novo', 'Christmas Day': 'Natal', 'Christmas Holiday': 'Feriado de Natal', 'Christmas Day (observed)': 'Natal (transferido)', 'Boxing Day (observed)': 'Boxing Day (transferido)',
  'Good Friday': 'Sexta-feira Santa', 'Easter Monday': 'Segunda-feira de Páscoa', 'Labour Day': 'Dia do Trabalho', 'Labor Day': 'Dia do Trabalho (EUA)', 'May Day': 'Feriado de 1º de maio',
  'Martin Luther King Jr. Day': 'Dia de Martin Luther King Jr.', "Washington's Birthday": 'Aniversário de Washington', 'Memorial Day': 'Memorial Day (dia dos mortos em guerra)',
  'Juneteenth National Independence Day (observed)': 'Juneteenth (transferido)', 'Independence Day (observed)': 'Independência dos EUA (transferido)', 'Thanksgiving Day': 'Ação de Graças',
  'Bank Holiday': 'Feriado bancário', "Bank Holiday; New Year's Day": 'Feriado bancário; Ano-novo', 'Spring Bank Holiday': 'Feriado bancário de primavera', 'Late Summer Bank Holiday': 'Feriado bancário de fim de verão',
  'Coming of Age Day': 'Dia da Maioridade', 'Foundation Day': 'Dia da Fundação Nacional', "Emperor's Birthday": 'Aniversário do Imperador', 'Vernal Equinox Day': 'Equinócio de primavera',
  'Showa Day': 'Dia de Showa', 'Constitution Day': 'Dia da Constituição', 'Greenery Day': 'Dia do Verde', "Children's Day": 'Dia das Crianças', 'Marine Day': 'Dia do Mar',
  'Mountain Day': 'Dia da Montanha', 'Respect for the Aged Day': 'Dia do Respeito aos Idosos', 'Autumnal Equinox Day': 'Equinócio de outono', 'Sports Day': 'Dia do Esporte',
  'Culture Day': 'Dia da Cultura', 'Labor Thanksgiving Day': 'Dia de Ação de Graças ao Trabalho', 'Substitute Holiday': 'Feriado compensatório', 'National Holiday': 'Feriado nacional',
  'The third day of Chinese New Year': 'Terceiro dia do Ano-novo chinês', 'The fourth day of Chinese New Year': 'Quarto dia do Ano-novo chinês', 'Tomb-Sweeping Day': 'Festival Qingming',
  "The Buddha's Birthday": 'Aniversário de Buda', 'Dragon Boat Festival': 'Festival do Barco-Dragão', 'Hong Kong S.A.R. Establishment Day': 'Dia da Região Administrativa Especial de Hong Kong',
  'The Day following Mid-Autumn Festival': 'Dia seguinte ao Festival do Meio do Outono', 'National Day': 'Dia Nacional', 'Double Ninth Festival': 'Festival Chung Yeung',
  'The day following Double Ninth Festival': 'Dia seguinte ao Festival Chung Yeung', 'The first weekday after Christmas Day': 'Primeiro dia útil depois do Natal',
}
const holName = (r: any[]) => lang() === 'pt' ? (r[0] === 'BVMF' ? r[3] : HOL_PT[r[2]] || r[2]) : r[2]
function MiniMonth({ y, m, hol, today }: { y: number; m: number; hol: Record<string, string>; today: string }) {
  const first = new Date(Date.UTC(y, m, 1)), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), off = first.getUTCDay()
  const cells: (number | null)[] = [...Array(off).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  const wl = lang() === 'pt' ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <div className="border p-1 min-w-0" style={{ borderColor: C.line }}>
      <div className="text-[11px] font-bold text-center" style={{ color: C.amber }}>{monName(m)} {y}</div>
      <div className="grid text-[10px] text-center" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
        {wl.map((w, i) => <div key={i} style={{ color: C.muted }}>{w}</div>)}
        {cells.map((c, i) => {
          if (c == null) return <div key={i} />
          const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(c).padStart(2, '0')}`, wk = (i % 7 === 0 || i % 7 === 6), h = hol[iso]
          return <div key={i} title={h} style={{ color: h ? tc('#000') : wk ? tc('#555') : C.text, background: h ? C.down : undefined, outline: iso === today ? `1px solid ${C.amber}` : undefined }}>{c}</div>
        })}
      </div>
    </div>
  )
}
export function CDRView() {
  const { data: d, err } = useJSON<any>('cdr.json')
  const [mk, setMk] = useState('all'), [cal, setCal] = useState('BVMF')
  const today = todaySP()
  const all = useMemo(() => {
    if (!d || d.unavailable) return [] as any[][]
    return (d.markets as string[]).flatMap(k => (d.rows[k] || []).map((r: any[]) => [k, r[0], r[1], r[2]])).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1)
  }, [d])
  if (!d || d.unavailable) return <FnScreen code="CDR" title="Exchange Holiday Calendar"><Loading2 err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  const up = all.filter(r => r[1] >= today && (mk === 'all' || r[0] === mk))
  const hol: Record<string, string> = {}
  for (const r of all) if (r[0] === cal) hol[r[1]] = holName(r)
  const t0 = new Date(today + 'T12:00:00Z'), months = Array.from({ length: 12 }, (_, i) => { const x = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + i, 1)); return [x.getUTCFullYear(), x.getUTCMonth()] })
  const nextOf = (k: string) => all.find(r => r[0] === k && r[1] >= today)
  const note = L(
    `Full-day market closures from published holiday rules for six venues: the Brazilian exchange, the New York Stock Exchange, the London Stock Exchange, the euro payment system (TARGET2, which sets euro settlement days), the Japan Exchange and Hong Kong Exchanges. Holidays that fall on a weekend are listed only if the rules move them to a weekday. Early closes, half days and one-off closures announced by an exchange (for example national mourning days or the B3 no-trading days on 24 and 31 December) are not in the rules and may be missing, so check the venue's own notice before relying on a date. Range: ${dUS(d.from)} to ${dUS(d.to)}.`,
    `Fechamentos de dia inteiro, pelas regras de feriados publicadas, para seis mercados: a bolsa brasileira, a Bolsa de Nova York, a Bolsa de Londres, o sistema de pagamentos em euro (TARGET2, que define os dias de liquidação em euro), a bolsa do Japão e a de Hong Kong. Feriados em fim de semana só aparecem se a regra os transfere para um dia útil. Pregões reduzidos, meio expediente e fechamentos avulsos anunciados pela bolsa (por exemplo luto oficial ou os dias sem pregão da B3 em 24 e 31 de dezembro) não estão nas regras e podem faltar; confira o aviso do próprio mercado antes de contar com uma data. Período: ${dUS(d.from)} a ${dUS(d.to)}.`)
  return (
    <FnScreen code="CDR" title="Exchange Holiday Calendar" source={d.source} note={note} asOf={d.date}
      right={<Field label={L('List', 'Lista')}><Btns opts={[{ v: 'all', l: L('All', 'Todos') }, ...d.markets.map((k: string) => ({ v: k, l: MKT_SHORT[k] }))]} value={mk} onChange={setMk} /></Field>}>
      <Kpis items={(d.markets as string[]).map(k => { const r = nextOf(k); return [`${L('Next', 'Próximo')} · ${MKT_SHORT[k]}`, r ? `${dUS(r[1])} ${wd(r[1])}` : '—', k === 'BVMF' ? C.amber : undefined] as [string, string, string?] })} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)' }}>
        <Panel title={L('Upcoming closures', 'Próximos fechamentos')}>
          {up.length ? <Grid maxH={600} rows={up.map(r => ({ k: r[0], d: r[1], r }))} cols={[
            { k: 'd', label: L('Date', 'Data'), fmt: x => dUS(x), color: () => C.white },
            { k: 'd', label: L('Day', 'Dia'), fmt: x => wd(x), color: () => C.muted },
            { k: 'k', label: L('Market', 'Mercado'), fmt: x => MKT_SHORT[x], color: () => C.amber },
            { k: 'r', label: L('Holiday', 'Feriado'), fmt: x => <span className="block truncate max-w-[300px]" title={holName(x)}>{holName(x)}</span>, w: '300px' },
            { k: 'd', label: L('In', 'Em'), align: 'r', fmt: x => { const k = dayN(x) - dayN(today); return k === 0 ? L('today', 'hoje') : `${k}${L('d', 'd')}` }, color: () => C.muted },
          ]} /> : <Muted t={L('No closures in range.', 'Nenhum fechamento no período.')} />}
        </Panel>
        <Panel title={`${L(MKT[cal][0], MKT[cal][1])} · ${L('next 12 months', 'próximos 12 meses')}`} right={<Btns opts={d.markets.map((k: string) => ({ v: k, l: MKT_SHORT[k] }))} value={cal} onChange={setCal} />}>
          <div className="grid gap-1 p-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {months.map(([y, m]) => <MiniMonth key={`${y}-${m}`} y={y} m={m} hol={hol} today={today} />)}
          </div>
          <div className="px-2 pb-1 text-[11px]" style={{ color: C.muted }}><span style={{ background: C.down, color: tc('#000') }}>&nbsp;12&nbsp;</span> {L('closed (hover for name)', 'fechado (passe o mouse para ver o nome)')} <span className="ml-3" style={{ outline: `1px solid ${C.amber}` }}>&nbsp;12&nbsp;</span> {L('today', 'hoje')}</div>
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= INSD =======================
const ROLES: Record<string, [string, string]> = { ctrl: ['Controlling holders', 'Controladores'], board: ['Board', 'Conselho de administração'], exec: ['Executives', 'Diretoria'], fiscal: ['Audit committee (fiscal council)', 'Conselho fiscal'], other: ['Other statutory bodies', 'Outros órgãos estatutários'] }
const brl = (v: any) => v == null ? '—' : `R$ ${bigE(v, 1)}`
const usd = (v: any) => v == null ? '—' : `US$ ${bigE(v, 1)}`
export function INSDView() {
  const { data: d, err } = useJSON<any>('insd.json')
  const [tab, setTab] = useState(0), [mo, setMo] = useState(''), [sel, setSel] = useState(''), [side, setSide] = useState('all'), [tk, setTk] = useState('all')
  const br = d?.br, us = d?.us
  const month = mo || br?.months?.[br.months.length - 1] || ''
  const brRows = useMemo(() => (br?.rows || []).filter((r: any) => r.ref === month).map((r: any) => ({ ...r, net: r.bv - r.sv })), [br, month])
  const usTk = useMemo(() => Array.from(new Set((us?.rows || []).map((r: any) => r.tk))).sort() as string[], [us])
  const usRows = useMemo(() => (us?.rows || []).filter((r: any) => (side === 'all' || r.side === side) && (tk === 'all' || r.tk === tk)), [us, side, tk])
  if (!d || d.unavailable) return <FnScreen code="INSD" title="Insider Transactions"><Loading2 err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  const f = brRows.find((r: any) => r.tk === sel) || brRows[0]
  const stale = (s: any) => s?.status === 'stale' ? L(' (previous file: source unavailable today)', ' (arquivo anterior: fonte indisponível hoje)') : ''
  const note = L(
    `Brazil: monthly reports that listed companies must file on trades by controlling holders, board members, executives and fiscal council members (and people linked to them) in the company's own shares and units, last ${br?.months?.length || 0} months. Only purchases and sales are counted (no grants, subscriptions or transfers); restated reports replace the original. Many reports omit the price, so values are summed only where a price or amount was given — the "trades w/o value" column counts the rest. A company appears under its main ticker. US: open-market purchases (code P) and sales (code S) from insider ownership reports (Form 4) filed in the last ${us?.days || 90} days for ${usTk.length} large US companies; option exercises, grants and tax withholding are left out. Planned sales under 10b5-1 schedules are included and are common. Insider selling has many personal reasons; this is information, not a signal.`,
    `Brasil: informes mensais que as companhias abertas entregam sobre negociações de controladores, conselheiros, diretores e conselheiros fiscais (e pessoas ligadas) com ações e units da própria companhia, nos últimos ${br?.months?.length || 0} meses. Só entram compras e vendas (sem outorgas, subscrições ou transferências); um informe reapresentado substitui o original. Muitos informes não trazem o preço, então os valores só somam onde preço ou volume foram informados — a coluna "neg. sem valor" conta o resto. A companhia aparece pelo ticker principal. EUA: compras (código P) e vendas (código S) a mercado dos relatórios de participação de insiders (Form 4) entregues nos últimos ${us?.days || 90} dias para ${usTk.length} grandes empresas dos EUA; exercício de opções, outorgas e retenção de imposto ficam de fora. Vendas programadas (planos 10b5-1) entram e são comuns. Insiders vendem por muitos motivos pessoais; isto é informação, não sinal.`)
  const sumBv = brRows.reduce((s: number, r: any) => s + r.bv, 0), sumSv = brRows.reduce((s: number, r: any) => s + r.sv, 0)
  const uB = usRows.filter((r: any) => r.side === 'buy'), uS = usRows.filter((r: any) => r.side === 'sell')
  const sumU = (xs: any[]) => xs.reduce((s, r) => s + (r.val || 0), 0)
  const ym = (x: string) => x ? `${monName(+x.slice(5, 7) - 1)}/${x.slice(2, 4)}` : '—'
  return (
    <FnScreen code="INSD" title="Insider Transactions" source={d.source} note={note} tabs={[L('Brazil', 'Brasil'), L('United States', 'Estados Unidos')]} tab={tab} setTab={setTab}
      asOf={tab === 0 ? (month ? `${month}-01` : null) : (us?.rows?.[0]?.filed || null)}
      right={tab === 0
        ? <Field label={L('Month', 'Mês')}><Btns opts={(br?.months || []).map((m: string) => ({ v: m, l: ym(m) }))} value={month} onChange={v => { setMo(v); setSel('') }} /></Field>
        : <><Field label={L('Side', 'Lado')}><Btns opts={[{ v: 'all', l: L('All', 'Todas') }, { v: 'buy', l: L('Buys', 'Compras') }, { v: 'sell', l: L('Sells', 'Vendas') }]} value={side} onChange={setSide} /></Field>
          <Field label="Ticker"><select className={inputCls} style={inputStyle} value={tk} onChange={e => setTk(e.target.value)}><option value="all">{L('All', 'Todos')}</option>{usTk.map(t => <option key={t} value={t}>{t}</option>)}</select></Field></>}>
      {tab === 0 ? (!br?.rows ? <Unavailable what={L('Brazilian insider reports', 'Informes de negociação no Brasil')} /> : <>
        <Kpis items={[
          [L('Reference month', 'Mês de referência'), `${ym(month)}${stale(br)}`, C.white],
          [L('Companies with trades', 'Companhias com negociação'), n(brRows.length, 0)],
          [L('Purchases (valued)', 'Compras (com valor)'), brl(sumBv), C.up],
          [L('Sales (valued)', 'Vendas (com valor)'), brl(sumSv), C.down],
          [L('Net', 'Líquido'), brl(sumBv - sumSv), cl(sumBv - sumSv)],
          [L('Trades w/o value', 'Neg. sem valor'), n(brRows.reduce((s: number, r: any) => s + r.nv, 0), 0), C.muted],
        ]} />
        <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)' }}>
          <Panel title={L('Companies · click a row', 'Companhias · clique numa linha')}>
            {brRows.length ? <Grid maxH={600} rows={brRows} onRow={(r: any) => setSel(r.tk)} rowStyle={(r: any) => f && r.tk === f.tk ? { background: C.line } : undefined} cols={[
              { k: 'tk', label: 'Ticker', color: () => C.amber },
              { k: 'n', label: L('Trades', 'Neg.'), align: 'r', fmt: x => n(x, 0) },
              { k: 'bq', label: L('Shares bought', 'Ações compradas'), align: 'r', fmt: x => x ? bigE(x, 1) : '—', color: x => x ? C.up : C.muted },
              { k: 'sq', label: L('Shares sold', 'Ações vendidas'), align: 'r', fmt: x => x ? bigE(x, 1) : '—', color: x => x ? C.down : C.muted },
              { k: 'bv', label: L('Bought R$', 'Compras R$'), align: 'r', fmt: x => x ? brl(x) : '—' },
              { k: 'sv', label: L('Sold R$', 'Vendas R$'), align: 'r', fmt: x => x ? brl(x) : '—' },
              { k: 'net', label: L('Net R$', 'Líquido R$'), align: 'r', fmt: x => x ? brl(x) : '—', color: x => cl(x) },
              { k: 'nv', label: L('w/o value', 'sem valor'), align: 'r', fmt: x => x ? n(x, 0) : '', color: () => C.muted },
            ]} /> : <Muted t={L('No reported purchases or sales this month.', 'Nenhuma compra ou venda informada neste mês.')} />}
          </Panel>
          {f ? <Panel title={`${f.tk} · ${ym(f.ref)} · ${L('shares by role', 'ações por cargo')}`}>
            <Grid rows={Object.entries(f.roles).map(([k, v]: any) => ({ k, b: v[0], s: v[1] }))} cols={[
              { k: 'k', label: L('Role', 'Cargo'), fmt: x => L(ROLES[x]?.[0] || x, ROLES[x]?.[1] || x), color: () => C.white },
              { k: 'b', label: L('Bought', 'Compradas'), align: 'r', fmt: x => x ? n(x, 0) : '—', color: x => x ? C.up : C.muted },
              { k: 's', label: L('Sold', 'Vendidas'), align: 'r', fmt: x => x ? n(x, 0) : '—', color: x => x ? C.down : C.muted },
            ]} />
            <div className="p-2"><KV rows={[
              [L('Average price bought', 'Preço médio de compra'), f.bv && f.bq ? `R$ ${n(f.bv / f.bq, 2)}` : '—'],
              [L('Average price sold', 'Preço médio de venda'), f.sv && f.sq ? `R$ ${n(f.sv / f.sq, 2)}` : '—'],
            ]} /><div className="mt-1 text-[11px]" style={{ color: C.muted }}>{L('Averages use only trades with a reported value, so they can be skewed when part of the volume came without price.', 'As médias usam só negociações com valor informado e podem distorcer quando parte do volume veio sem preço.')}</div></div>
          </Panel> : <div />}
        </div>
      </>) : (!us?.rows ? <Unavailable what={L('US insider filings', 'Relatórios de insiders dos EUA')} /> : <>
        <Kpis items={[
          [L('Window', 'Janela'), `${us.days} ${L('days', 'dias')}${stale(us)}`, C.white],
          [L('Transactions', 'Transações'), n(usRows.length, 0)],
          [L('Open-market buys', 'Compras a mercado'), `${uB.length} · ${usd(sumU(uB))}`, C.up],
          [L('Open-market sales', 'Vendas a mercado'), `${uS.length} · ${usd(sumU(uS))}`, C.down],
          [L('Companies', 'Empresas'), n(new Set(usRows.map((r: any) => r.tk)).size, 0)],
          [L('Last filing', 'Último relatório'), us.rows[0] ? dUS(us.rows.map((r: any) => r.filed).sort().pop()) : '—'],
        ]} />
        <Panel title={L('Transactions (latest first)', 'Transações (mais recentes primeiro)')} className="lg:flex-1 lg:min-h-0">
          {usRows.length ? <Grid maxH={620} rows={usRows} cols={[
            { k: 'date', label: L('Trade', 'Negócio'), fmt: x => dUS(x), color: () => C.white },
            { k: 'filed', label: L('Filed', 'Entregue'), fmt: x => dUS(x), color: () => C.muted },
            { k: 'tk', label: 'Ticker', color: () => C.amber },
            { k: 'owner', label: L('Insider', 'Insider'), fmt: x => <span className="block truncate max-w-[200px]" title={x}>{x}</span>, w: '200px' },
            { k: 'role', label: L('Role', 'Cargo'), fmt: x => <span className="block truncate max-w-[180px]" title={x}>{x || '—'}</span>, color: () => C.muted, w: '180px' },
            { k: 'side', label: L('Side', 'Lado'), fmt: x => x === 'buy' ? L('Buy', 'Compra') : L('Sell', 'Venda'), color: x => x === 'buy' ? C.up : C.down },
            { k: 'qty', label: L('Shares', 'Ações'), align: 'r', fmt: x => n(x, 0) },
            { k: 'px', label: L('Price', 'Preço'), align: 'r', fmt: x => n(x, 2) },
            { k: 'val', label: L('Value', 'Valor'), align: 'r', fmt: x => usd(x), color: () => C.white },
            { k: 'link', label: '', fmt: x => x ? <a href={x} target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>{L('filing ↗', 'documento ↗')}</a> : '' },
          ]} /> : <Muted t={L('No transactions for this filter.', 'Nenhuma transação neste filtro.')} />}
        </Panel>
      </>)}
    </FnScreen>
  )
}
