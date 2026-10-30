'use client'
import { tc } from '../../lib/themeRuntime'
/** P2-H1 – funções novas: BEIR (inflação implícita), USMM (mercado monetário EUA), CBR (juros de bancos centrais), CRYP (cripto).
 *  Textos EN/PT por tela (L(en, pt)); dados só de fontes abertas, gerados por pipeline/build_fns1.py. */
import React, { useMemo, useRef, useEffect, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, Spark, useFitH, useFit } from '@/components/fn/kit'
import { n, pc, bps, cl, dUS, bigE, auto, Kpis, Loading2 } from './fn11util'
import { lang } from '@/lib/settings'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const pts = (rows: any[], i = 1) => (rows || []).filter(r => r[i] != null).map(r => ({ time: r[0], value: r[i] }))
const cut = (rows: any[], from: string | null) => (from ? (rows || []).filter(r => r[0] >= from) : rows || [])
const isoAgo = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10)
const RANGES = ['3M', '1Y', '3Y', 'MAX'] as const
const rangeFrom = (last: string, r: string) => r === '3M' ? isoAgo(last, 92) : r === '1Y' ? isoAgo(last, 366) : r === '3Y' ? isoAgo(last, 3 * 366) : r === '5Y' ? isoAgo(last, 5 * 366) : r === '10Y' ? isoAgo(last, 10 * 366) : null

/** curva x = anos (SVG responsivo; FnChart é só para séries de tempo) */
function XYChart({ series, height = 240, xLabel, yFmt = (v: number) => n(v, 1) }: {
  series: { name: string; color: string; pts: [number, number][]; dashed?: boolean; dots?: boolean }[]; height?: number; xLabel: string; yFmt?: (v: number) => string
}) {
  const box = useRef<HTMLDivElement | null>(null), [W, setW] = useState(600)
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth))); ro.observe(el); setW(Math.max(260, el.clientWidth)); return () => ro.disconnect() }, [])
  const fitH = useFitH(height, 110), { active } = useFit(), H = active ? fitH : Math.min(height, 240)
  const all = series.flatMap(s => s.pts)
  if (!all.length) return <div ref={box} style={{ height: H }} />
  const m = { l: 40, r: 12, t: 10, b: 30 }
  const x0 = Math.floor(Math.min(...all.map(p => p[0]))), x1 = Math.ceil(Math.max(...all.map(p => p[0])))
  const y0r = Math.min(...all.map(p => p[1])), y1r = Math.max(...all.map(p => p[1])), pad = (y1r - y0r) * 0.08 || 0.5
  const y0 = y0r - pad, y1 = y1r + pad
  const X = (v: number) => m.l + (v - x0) / ((x1 - x0) || 1) * (W - m.l - m.r)
  const Y = (v: number) => m.t + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - m.t - m.b)
  const yt = Array.from({ length: 5 }, (_, i) => y0 + (y1 - y0) * i / 4)
  const xs = Math.max(1, Math.ceil((x1 - x0) / Math.max(1, Math.floor((W - m.l - m.r) / 50))))
  const xt = Array.from({ length: Math.floor((x1 - x0) / xs) + 1 }, (_, i) => x0 + i * xs)
  return (
    <div ref={box} className="w-full" style={{ fontFamily: MONO }}>
      <svg width={W} height={H} className="block">
        {yt.map((t, i) => <g key={i}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke={tc(tc('#1c1c1c'))} /><text x={m.l - 4} y={Y(t) + 4} fontSize={10} fill={C.muted} textAnchor="end">{yFmt(t)}</text></g>)}
        {xt.map(t => <text key={t} x={X(t)} y={H - 16} fontSize={10} fill={C.muted} textAnchor="middle">{t}</text>)}
        <text x={(W + m.l) / 2} y={H - 3} fontSize={10} fill={C.muted} textAnchor="middle">{xLabel}</text>
        {series.map(s => <g key={s.name}>
          <polyline points={s.pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
          {s.dots !== false && s.pts.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={2.5} fill={s.color}><title>{`${s.name} ${n(p[0], 1)}y: ${yFmt(p[1])}`}</title></circle>)}
        </g>)}
      </svg>
      <div className="flex flex-wrap gap-4 text-[11px] px-1">{series.map(s => <span key={s.name} style={{ color: s.color }}>{s.dashed ? '╌' : '━'} {s.name}</span>)}</div>
    </div>
  )
}

// ======================= BEIR =======================
export function BEIRView() {
  const { data: d, err } = useJSON<any>('beir.json')
  const [cmp, setCmp] = useState('1M'), [rng, setRng] = useState('1Y'), [ten, setTen] = useState('5Y'), [mode, setMode] = useState('bei')
  if (!d) return <FnScreen code="BEIR" title="Breakeven Inflation (Brazil)"><Loading2 err={err} /></FnScreen>
  const TEN = Object.keys(d.tenors)
  const c = d.compare?.[cmp]
  const verts = (d.vertices as any[])
  const from = rangeFrom(d.date, rng)
  const note = L(d.note, 'Inflação implícita = (1 + taxa prefixada) / (1 + taxa real IPCA+) − 1. Curva prefixada (LTN/NTN-F) interpolada linearmente em cada vencimento IPCA+, sem extrapolar. Usa as taxas de venda (recompra) do Tesouro Direto; mistura títulos com e sem cupom, então é uma aproximação (sem bootstrapping). Inclui prêmios de risco de inflação e de liquidez: não é uma projeção pura de inflação.')
  return (
    <FnScreen code="BEIR" title="Breakeven Inflation (Brazil)" source={d.source} note={note}
      right={<><Field label={L('Compare', 'Comparar')}><Btns opts={Object.keys(d.compare || {})} value={cmp} onChange={setCmp} /></Field></>}>
      <Kpis items={TEN.map(k => {
        const v = d.tenors[k].bei, o = c?.tenors?.[k]?.bei
        return [`${k} ${L('breakeven', 'implícita')} · Δ${cmp}`, <span key={k}>{pc(v, 2, false)} <span className="text-[12px]" style={{ color: cl(v != null && o != null ? v - o : null) }}>{v != null && o != null ? `${bps((v - o) * 100, 0)} bp` : ''}</span></span>, C.amber] as [string, React.ReactNode, string]
      })} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="min-w-0">
          <Panel title={L(`Term structure · ${dUS(d.date)}`, `Estrutura a termo · ${dUS(d.date)}`)}>
            <XYChart height={250} xLabel={L('years to maturity', 'anos até o vencimento')} yFmt={v => n(v, 1) + '%'} series={[
              { name: L('Prefixed (LTN/NTN-F, interp.)', 'Prefixado (LTN/NTN-F, interp.)'), color: C.white, pts: verts.filter(v => v.nominal != null).map(v => [v.years, v.nominal]) },
              { name: L('Real (IPCA+)', 'Real (IPCA+)'), color: C.cyan, pts: verts.map(v => [v.years, v.real]) },
              { name: L('Breakeven', 'Inflação implícita'), color: C.amber, pts: verts.filter(v => v.bei != null).map(v => [v.years, v.bei]) },
            ]} />
          </Panel>
          <Panel title={L('By IPCA+ maturity', 'Por vencimento IPCA+')} className="mt-2">
            <Grid maxH={260} rows={verts} cols={[
              { k: 'bond', label: L('Bond', 'Título'), color: () => C.amber },
              { k: 'maturity', label: L('Maturity', 'Vencimento'), fmt: x => dUS(x) },
              { k: 'years', label: L('Years', 'Anos'), align: 'r', fmt: x => n(x, 1) },
              { k: 'real', label: L('Real %', 'Real %'), align: 'r', fmt: x => n(x, 2), color: () => C.cyan },
              { k: 'nominal', label: L('Prefixed %', 'Prefixado %'), align: 'r', fmt: x => n(x, 2), color: () => C.white },
              { k: 'bei', label: L('Breakeven %', 'Implícita %'), align: 'r', fmt: x => n(x, 2), color: () => C.amber },
            ]} />
          </Panel>
        </div>
        <div className="min-w-0">
          <Panel title={mode === 'bei' ? L('Breakeven history (% p.a.)', 'Histórico da inflação implícita (% a.a.)') : L(`${ten} decomposition (% p.a.)`, `Decomposição ${ten} (% a.a.)`)}
            right={<><Btns opts={[{ v: 'bei', l: L('All tenors', 'Todos os prazos') }, { v: 'dec', l: L('Decompose', 'Decompor') }]} value={mode} onChange={setMode} />{mode === 'dec' && <Btns opts={TEN} value={ten} onChange={setTen} />}<Btns opts={[...RANGES]} value={rng} onChange={setRng} /></>}>
            <FnChart height={330} panes={[{
              series: mode === 'bei'
                ? TEN.map((k, i) => ({ kind: 'line' as const, data: pts(cut(d.history[k], from)), color: [C.cyan, C.amber, C.purple, C.white][i % 4], title: k, decimals: 2 }))
                : [{ kind: 'line' as const, data: pts(cut(d.history[ten], from), 2), color: C.white, title: L('Prefixed', 'Prefixado'), decimals: 2 },
                   { kind: 'line' as const, data: pts(cut(d.history[ten], from), 3), color: C.cyan, title: 'IPCA+', decimals: 2 },
                   { kind: 'line' as const, data: pts(cut(d.history[ten], from), 1), color: C.amber, title: L('Breakeven', 'Implícita'), decimals: 2 }],
            }]} />
          </Panel>
          <Panel title={L(`Tenors vs ${cmp} ago (${c ? dUS(c.date) : '—'})`, `Prazos vs ${cmp} atrás (${c ? dUS(c.date) : '—'})`)} className="mt-2">
            <Grid rows={TEN.map(k => ({ k, ...d.tenors[k], o: c?.tenors?.[k] }))} cols={[
              { k: 'k', label: L('Tenor', 'Prazo'), color: () => C.amber },
              { k: 'nominal', label: L('Prefixed %', 'Prefixado %'), align: 'r', fmt: x => n(x, 2) },
              { k: 'real', label: L('Real %', 'Real %'), align: 'r', fmt: x => n(x, 2) },
              { k: 'bei', label: L('Breakeven %', 'Implícita %'), align: 'r', fmt: x => n(x, 2), color: () => C.amber },
              { k: 'dn', label: 'Δ ' + L('prefixed', 'pré') + ' bp', align: 'r', fmt: (_, r: any) => r.nominal != null && r.o?.nominal != null ? bps((r.nominal - r.o.nominal) * 100, 0) : '—' },
              { k: 'dr', label: 'Δ real bp', align: 'r', fmt: (_, r: any) => r.real != null && r.o?.real != null ? bps((r.real - r.o.real) * 100, 0) : '—' },
              { k: 'db', label: 'Δ ' + L('BEI', 'impl.') + ' bp', align: 'r', fmt: (_, r: any) => r.bei != null && r.o?.bei != null ? bps((r.bei - r.o.bei) * 100, 0) : '—', color: (_, r: any) => cl(r.bei != null && r.o?.bei != null ? r.bei - r.o.bei : null) },
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= USMM =======================
const USMM_DESC: Record<string, [string, string]> = {
  SOFR: ['Secured Overnight Financing Rate (Treasury repo)', 'Taxa de recompra overnight com Treasuries (SOFR)'],
  EFFR: ['Effective Federal Funds Rate', 'Fed funds efetiva'],
  OBFR: ['Overnight Bank Funding Rate (fed funds + eurodollar)', 'Captação bancária overnight (fed funds + eurodólar)'],
  TGCR: ['Tri-party General Collateral Rate', 'Compromissada tri-party (colateral geral)'],
  BGCR: ['Broad General Collateral Rate', 'Compromissada ampla (colateral geral)'],
}
export function USMMView() {
  const { data: d, err } = useJSON<any>('usmm.json')
  const [rng, setRng] = useState('1Y'), [sel, setSel] = useState('SOFR')
  const last = d?.latest?.[0]?.date
  const from = last ? rangeFrom(last, rng) : null
  const disp = useMemo(() => !d ? [] : cut(d.history[sel], from).filter((r: any) => r[2] != null && r[5] != null).map((r: any) => ({ time: r[0], value: Math.round((r[5] - r[2]) * 100) })), [d, sel, from])
  if (!d) return <FnScreen code="USMM" title="US Money Market"><Loading2 err={err} /></FnScreen>
  const get = (k: string) => (d.latest as any[]).find(x => x.rate === k)
  const sofr = get('SOFR'), effr = get('EFFR'), band = d.band[d.band.length - 1], ai = d.sofrai[d.sofrai.length - 1]
  const note = L(d.note, 'Taxas em % a.a. do dia útil indicado (publicadas na manhã seguinte, ~8h ET). Os percentis são ponderados por volume entre as operações. Banda-alvo = intervalo do fed funds definido pelo FOMC.')
  const s = get(sel)
  return (
    <FnScreen code="USMM" title="US Money Market" source={d.source} note={note}
      right={<Field label={L('Range', 'Período')}><Btns opts={[...RANGES]} value={rng} onChange={setRng} /></Field>}>
      <Kpis items={[
        ['SOFR', `${n(sofr?.value, 2)}%`, C.amber], ['EFFR', `${n(effr?.value, 2)}%`, C.white],
        [L('FOMC target range', 'Banda-alvo do FOMC'), band ? `${n(band[1], 2)}–${n(band[2], 2)}%` : '—', C.cyan],
        ['SOFR − EFFR', sofr && effr ? `${bps((sofr.value - effr.value) * 100, 0)} bp` : '—', cl(sofr && effr ? sofr.value - effr.value : null)],
        [L('SOFR 30d / 90d / 180d avg', 'Média SOFR 30d / 90d / 180d'), ai ? `${n(ai[1], 2)} / ${n(ai[2], 2)} / ${n(ai[3], 2)}` : '—'],
        [L('SOFR index', 'Índice SOFR'), ai ? n(ai[4], 6) : '—'],
      ]} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)' }}>
        <div className="min-w-0">
          <Panel title={L(`Reference rates · ${dUS(sofr?.date || '')}`, `Taxas de referência · ${dUS(sofr?.date || '')}`)}>
            <Grid rows={d.latest} onRow={(x: any) => setSel(x.rate)} rowStyle={(x: any) => x.rate === sel ? { background: tc('#1f2a44') } : undefined} cols={[
              { k: 'rate', label: L('Rate', 'Taxa'), color: () => C.amber },
              { k: 'value', label: '%', align: 'r', fmt: x => n(x, 2), color: () => C.white },
              { k: 'd1_bp', label: '1D bp', align: 'r', fmt: x => bps(x, 0), color: x => cl(x) },
              { k: 'y1_bp', label: '1Y bp', align: 'r', fmt: x => bps(x, 0), color: x => cl(x) },
              { k: 'p1', label: 'P1', align: 'r', fmt: x => n(x, 2) }, { k: 'p25', label: 'P25', align: 'r', fmt: x => n(x, 2) },
              { k: 'p75', label: 'P75', align: 'r', fmt: x => n(x, 2) }, { k: 'p99', label: 'P99', align: 'r', fmt: x => n(x, 2) },
              { k: 'volume_bn', label: L('Vol $bn', 'Vol US$ bi'), align: 'r', fmt: x => n(x, 0) },
            ]} />
            <div className="p-2 text-[11px]" style={{ color: C.muted }}>{s ? L(USMM_DESC[sel][0], USMM_DESC[sel][1]) : ''}</div>
          </Panel>
          <Panel title={L(`${sel} percentile spread P99 − P1 (bp)`, `${sel} – dispersão P99 − P1 (bp)`)} className="mt-2">
            <FnChart height={200} panes={[{ series: [{ kind: 'hist', data: disp, color: C.purple, title: 'P99−P1', decimals: 0 }] }]} />
          </Panel>
        </div>
        <Panel title={L('Overnight rates vs FOMC target range (%)', 'Taxas overnight vs banda-alvo do FOMC (%)')}>
          <FnChart height={470} panes={[
            { stretch: 3, series: [
              { kind: 'line', data: pts(cut(d.band, from), 2), color: tc('#555'), title: L('Top', 'Teto'), decimals: 2, dashed: true },
              { kind: 'line', data: pts(cut(d.band, from), 1), color: tc('#555'), title: L('Bottom', 'Piso'), decimals: 2, dashed: true },
              { kind: 'line', data: pts(cut(d.history.TGCR, from)), color: C.cyan, title: 'TGCR', decimals: 2 },
              { kind: 'line', data: pts(cut(d.history.EFFR, from)), color: C.white, title: 'EFFR', decimals: 2 },
              { kind: 'line', data: pts(cut(d.history.SOFR, from)), color: C.amber, title: 'SOFR', decimals: 2 },
            ] },
            { stretch: 1, series: [{ kind: 'hist', data: pts(cut(d.history[sel], from), 6), color: C.blue, title: L(`${sel} volume ($bn)`, `${sel} volume (US$ bi)`), decimals: 0 }] },
          ]} />
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= CBR =======================
/** cartograma: cada banco central numa célula (coluna, linha) aproximando a geografia */
const TILE: Record<string, [number, number]> = {
  IS: [6, 0], NO: [8, 0], SE: [9, 0],
  CA: [1, 1], GB: [6, 1], DK: [8, 1], PL: [10, 1], RU: [12, 1],
  US: [1, 2], XM: [7, 2], CZ: [9, 2], HU: [10, 2], RO: [11, 2], KR: [15, 2], JP: [16, 2],
  MX: [1, 3], CH: [7, 3], HR: [8, 3], RS: [9, 3], MK: [10, 3], TR: [11, 3], CN: [14, 3], HK: [15, 3],
  CO: [2, 4], MA: [6, 4], IL: [10, 4], KW: [12, 4], IN: [13, 4], TH: [14, 4], PH: [16, 4],
  PE: [2, 5], BR: [3, 5], SA: [11, 5], MY: [14, 5], ID: [15, 5],
  CL: [2, 6], AR: [3, 6], ZA: [8, 6], AU: [15, 6], NZ: [17, 7],
}
const lvlColor = (v: number | null, max: number) => {
  if (v == null) return tc('#1a1a1a')
  const f = Math.max(0, Math.min(1, Math.sqrt(Math.max(0, v) / (max || 1))))
  return `rgba(255,160,40,${0.15 + 0.85 * f})`
}
const chgColor = (bp: number | null) => bp == null || bp === 0 ? tc('#2a2a2a') : bp > 0 ? `rgba(255,77,77,${Math.min(1, 0.35 + Math.abs(bp) / 300)})` : `rgba(79,195,247,${Math.min(1, 0.35 + Math.abs(bp) / 300)})`
export function CBRView() {
  const { data: d, err } = useJSON<any>('cbr.json')
  const [mode, setMode] = useState('lvl'), [sel, setSel] = useState('BR'), [cmp, setCmp] = useState('US'), [rng, setRng] = useState('10Y'), [reg, setReg] = useState('All')
  if (!d) return <FnScreen code="CBR" title="Central Bank Rates"><Loading2 err={err} /></FnScreen>
  const banks = d.banks as any[]
  const nm = (b: any) => lang() === 'pt' ? b.name_pt : b.name
  const max = Math.max(...banks.map(b => Math.min(b.rate, 20)))
  const byC = Object.fromEntries(banks.map(b => [b.code, b]))
  const s = byC[sel] || banks[0], o = byC[cmp]
  const val = (b: any) => mode === 'lvl' ? b.rate : mode === '3m' ? b.chg_3m_bp : b.chg_1y_bp
  const col = (b: any) => mode === 'lvl' ? lvlColor(Math.min(b.rate, 20), max) : chgColor(val(b))
  const regions = ['All', ...Array.from(new Set(banks.map(b => b.region)))]
  const REG_PT: Record<string, string> = { All: 'Todas', Americas: 'Américas', Europe: 'Europa', 'Middle East & Africa': 'Oriente Médio e África', 'Asia-Pacific': 'Ásia-Pacífico' }
  const rl = (r: string) => lang() === 'pt' ? REG_PT[r] || r : r
  const rows = banks.filter(b => reg === 'All' || b.region === reg)
  const hikes = banks.filter(b => (b.chg_3m_bp ?? 0) > 0).length, cuts = banks.filter(b => (b.chg_3m_bp ?? 0) < 0).length
  const last = s.hist[s.hist.length - 1]?.[0] + '-01'
  const from = rangeFrom(last, rng)?.slice(0, 7) ?? null
  const hp = (b: any) => cut(b.hist, from).map((r: any) => ({ time: r[0] + '-01', value: r[1] }))
  const note = L(d.note, 'Taxa básica compilada pelo BIS (para alguns países uma aproximação, como a taxa de refinanciamento ou a meta). Último movimento = última mudança na série diária (mensal, se não houver diária). Zona do euro = BCE.')
  const cols = 18, rowsN = 8
  return (
    <FnScreen code="CBR" title="Central Bank Rates" source={d.source} note={note}
      right={<><Field label={L('Map', 'Mapa')}><Btns opts={[{ v: 'lvl', l: L('Level', 'Nível') }, { v: '3m', l: 'Δ3M' }, { v: '1y', l: 'Δ1Y' }]} value={mode} onChange={setMode} /></Field>
        <Field label={L('Region', 'Região')}><Btns opts={regions.map(r => ({ v: r, l: rl(r) }))} value={reg} onChange={setReg} /></Field></>}>
      <Kpis items={[
        [L('Central banks', 'Bancos centrais'), String(banks.length)],
        [L('Hiked in 3M', 'Subiram em 3M'), String(hikes), C.down], [L('Cut in 3M', 'Cortaram em 3M'), String(cuts), C.cyan],
        [L('Median rate', 'Taxa mediana'), `${n([...banks].map(b => b.rate).sort((a, b) => a - b)[Math.floor(banks.length / 2)], 2)}%`],
        [`${nm(s)} (${s.bank})`, `${n(s.rate, 2)}%`, C.amber],
      ]} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' }}>
        <div className="min-w-0">
          <Panel title={mode === 'lvl' ? L('Policy rate map (%)', 'Mapa das taxas básicas (%)') : L(`Change over ${mode === '3m' ? '3 months' : '1 year'} (bp) · red = hike, blue = cut`, `Variação em ${mode === '3m' ? '3 meses' : '1 ano'} (pb) · vermelho = alta, azul = corte`)}>
            <div className="overflow-x-auto"><div className="p-2 grid gap-[3px]" style={{ minWidth: 560, gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${rowsN},auto)` }}>
              {banks.filter(b => TILE[b.code]).map(b => {
                const [x, y] = TILE[b.code], on = b.code === sel, dim = reg !== 'All' && b.region !== reg
                return <button key={b.code} onClick={() => setSel(b.code)} title={`${nm(b)} · ${b.bank}: ${n(b.rate, 2)}%`}
                  className="flex flex-col items-center justify-center leading-none" style={{ gridColumn: x + 1, gridRow: y + 1, aspectRatio: '1 / 0.9', background: col(b), opacity: dim ? 0.25 : 1, outline: on ? `2px solid ${C.white}` : 'none', color: tc('#000'), fontFamily: MONO }}>
                  <span className="text-[10px] font-bold">{b.code === 'XM' ? 'EA' : b.code}</span>
                  <span className="text-[9px]">{mode === 'lvl' ? n(b.rate, b.rate >= 10 ? 1 : 2) : bps(val(b), 0)}</span>
                </button>
              })}
            </div></div>
          </Panel>
          <Panel title={L('Policy rates', 'Taxas básicas')} className="mt-2">
            <Grid maxH={250} rows={rows} onRow={(x: any) => setSel(x.code)} rowStyle={(x: any) => x.code === sel ? { background: tc('#1f2a44') } : undefined} cols={[
              { k: 'name', label: L('Country', 'País'), fmt: (_, b: any) => nm(b), color: () => C.amber, w: '130px' },
              { k: 'bank', label: L('Bank', 'Banco'), color: () => C.muted },
              { k: 'rate', label: '%', align: 'r', fmt: x => n(x, 2), color: () => C.white },
              { k: 'chg_3m_bp', label: '3M bp', align: 'r', fmt: x => bps(x, 0), color: x => cl(x) },
              { k: 'chg_1y_bp', label: '1Y bp', align: 'r', fmt: x => bps(x, 0), color: x => cl(x) },
              { k: 'last_move', label: L('Last move', 'Último mov.'), fmt: (x, b: any) => x ? `${dUS(x)} ${bps(b.last_move_bp, 0)}` : '—', color: (_, b: any) => cl(b.last_move_bp) },
              { k: 'date', label: L('As of', 'Data'), fmt: x => dUS(x), color: () => C.muted },
            ]} />
          </Panel>
        </div>
        <Panel title={L(`${nm(s)} vs ${o ? nm(o) : '—'} – policy rate (%, month-end)`, `${nm(s)} vs ${o ? nm(o) : '—'} – taxa básica (%, fim do mês)`)}
          right={<><Field label={L('vs', 'vs')}><select className="bg-black border px-1 text-[12px]" style={{ borderColor: C.line, color: C.amber, fontFamily: MONO }} value={cmp} onChange={e => setCmp(e.target.value)}>
            {banks.map(b => <option key={b.code} value={b.code}>{nm(b)}</option>)}</select></Field><Btns opts={['3Y', '5Y', '10Y', 'MAX']} value={rng} onChange={setRng} /></>}>
          <FnChart height={520} panes={[{ series: [
            ...(o && o.code !== s.code ? [{ kind: 'line' as const, data: hp(o), color: C.cyan, title: o.code === 'XM' ? 'ECB' : o.code, decimals: 2 }] : []),
            { kind: 'line' as const, data: hp(s), color: C.amber, title: s.code === 'XM' ? 'ECB' : s.code, decimals: 2 },
          ] }]} />
          <div className="px-2 pb-2 text-[11px]" style={{ color: C.muted }}>{L('Last move', 'Último movimento')}: <span style={{ color: cl(s.last_move_bp) }}>{s.last_move ? `${dUS(s.last_move)} (${bps(s.last_move_bp, 0)} bp)` : '—'}</span> · {L('history since', 'histórico desde')} {s.hist[0]?.[0]?.slice(0, 4) ?? '—'}</div>
        </Panel>
      </div>
    </FnScreen>
  )
}

// ======================= CRYP =======================
const fngColor = (v: number) => v <= 25 ? C.down : v <= 45 ? tc('#FF8A65') : v <= 55 ? C.yellow : v <= 75 ? tc('#9CCC65') : C.up
const FNG_PT: Record<string, string> = { 'Extreme Fear': 'Medo extremo', Fear: 'Medo', Neutral: 'Neutro', Greed: 'Ganância', 'Extreme Greed': 'Ganância extrema' }
export function CRYPView() {
  const { data: d, err } = useJSON<any>('cryp.json')
  const [rng, setRng] = useState('1Y'), [sort, setSort] = useState('mcap')
  const coins = useMemo(() => !d ? [] : [...d.coins].sort((a: any, b: any) => sort === 'mcap' ? (b.mcap ?? 0) - (a.mcap ?? 0) : (b[sort] ?? -1e9) - (a[sort] ?? -1e9)), [d, sort])
  if (!d) return <FnScreen code="CRYP" title="Crypto Monitor"><Loading2 err={err} /></FnScreen>
  const g = d.global, f = d.fng[d.fng.length - 1], tv = d.tvl[d.tvl.length - 1]
  const last = (f?.[0] || d.generated_at).slice(0, 10), from = rangeFrom(last, rng)
  const note = L(d.note, 'Preços em US$, foto no momento da atualização (cripto negocia 24/7). TVL = valor total travado em protocolos DeFi (metodologia DefiLlama; por padrão exclui dupla contagem).')
  const fl = (s: string) => lang() === 'pt' ? FNG_PT[s] || s : s
  return (
    <FnScreen code="CRYP" title="Crypto Monitor" source={d.source} note={note} asOf={d.generated_at?.slice(0, 10)}
      right={<><Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'mcap', l: L('Mkt cap', 'Valor merc.') }, { v: 'ch24', l: '24h' }, { v: 'ch7d', l: '7d' }, { v: 'ch30d', l: '30d' }]} value={sort} onChange={setSort} /></Field>
        <Field label={L('Range', 'Período')}><Btns opts={['3M', '1Y', '3Y', 'MAX']} value={rng} onChange={setRng} /></Field></>}>
      <Kpis items={[
        [L('Total market cap', 'Valor de mercado total'), `$${bigE(g.mcap_usd, 2)}`, C.white], [L('24h change', 'Variação 24h'), pc(g.mcap_ch24), cl(g.mcap_ch24)],
        [L('24h volume', 'Volume 24h'), `$${bigE(g.vol_usd, 1)}`],
        [L('BTC / ETH dominance', 'Dominância BTC / ETH'), `${n(g.dominance?.BTC, 1)}% / ${n(g.dominance?.ETH, 1)}%`, C.amber],
        ['Fear & Greed', f ? <span key="f" style={{ color: fngColor(f[1]) }}>{f[1]} · {fl(f[2])}</span> : '—'],
        [L('DeFi TVL', 'TVL DeFi'), tv ? `$${n(tv[1], 1)}B` : '—', C.cyan],
      ]} />
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)' }}>
        <Panel title={L(`Top ${coins.length} by market cap (USD)`, `Top ${coins.length} por valor de mercado (US$)`)}>
          <Grid maxH={600} rows={coins} cols={[
            { k: 'rank', label: '#', align: 'r', color: () => C.muted },
            { k: 'sym', label: L('Coin', 'Moeda'), color: () => C.amber },
            { k: 'name', label: L('Name', 'Nome'), w: '110px' },
            { k: 'price', label: L('Price', 'Preço'), align: 'r', fmt: x => auto(x), color: () => C.white },
            { k: 'ch24', label: '24h %', align: 'r', fmt: x => pc(x), color: x => cl(x) },
            { k: 'ch7d', label: '7d %', align: 'r', fmt: x => pc(x), color: x => cl(x) },
            { k: 'ch30d', label: '30d %', align: 'r', fmt: x => pc(x), color: x => cl(x) },
            { k: 'mcap', label: L('Mkt cap', 'Valor merc.'), align: 'r', fmt: x => bigE(x, 1) },
            { k: 'vol', label: L('Vol 24h', 'Vol 24h'), align: 'r', fmt: x => bigE(x, 1) },
            { k: 'ath_pct', label: L('vs ATH', 'vs máx.'), align: 'r', fmt: x => pc(x, 0), color: () => C.muted },
            { k: 'spark', label: '7d', fmt: x => <Spark data={x || []} w={70} h={14} /> },
          ]} />
        </Panel>
        <div className="min-w-0">
          <Panel title={L('Crypto Fear & Greed Index (0–100)', 'Índice Fear & Greed de cripto (0–100)')}>
            <FnChart height={200} panes={[{ series: [{ kind: 'line', data: cut(d.fng, from).map((r: any) => ({ time: r[0], value: r[1], color: fngColor(r[1]) })), color: C.yellow, title: 'F&G', decimals: 0,
              lines: [{ price: 25, color: C.down, title: L('fear', 'medo') }, { price: 75, color: C.up, title: L('greed', 'ganância') }] }] }]} />
          </Panel>
          <Panel title={L('DeFi total value locked (USD bn)', 'Valor total travado em DeFi (US$ bi)')} className="mt-2">
            <FnChart height={170} panes={[{ series: [{ kind: 'area', data: pts(cut(d.tvl, from)), color: C.cyan, title: 'TVL', decimals: 1 }] }]} />
          </Panel>
          <Panel title={L('TVL by chain', 'TVL por blockchain')} className="mt-2">
            <Grid maxH={170} rows={d.chains.slice(0, 10)} cols={[
              { k: 'name', label: L('Chain', 'Rede'), color: () => C.amber }, { k: 'sym', label: L('Token', 'Token'), color: () => C.muted },
              { k: 'tvl_bn', label: L('TVL $bn', 'TVL US$ bi'), align: 'r', fmt: x => n(x, 2), color: () => C.white },
              { k: 'share', label: L('Share', 'Part.'), align: 'r', fmt: x => pc(x, 1, false) },
              { k: 'bar', label: '', fmt: (_, r: any) => <span className="inline-block h-[6px]" style={{ width: Math.max(2, r.share * 1.2), background: C.cyan }} /> },
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}
