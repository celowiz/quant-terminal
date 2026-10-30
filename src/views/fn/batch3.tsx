'use client'
/** P3-J1 – funções novas: COT (posições na CFTC) e 13F (carteiras de gestores dos EUA na SEC).
 *  Textos EN/PT por tela (L(en, pt)); dados só de fontes oficiais abertas, gerados por pipeline/build_fns2.py. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, useFitH, inputCls, inputStyle } from '@/components/fn/kit'
import { n, sn, pc, cl, dUS, bigE, Kpis, Loading2 } from './fn11util'
import { lang } from '@/lib/settings'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const isoAgo = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10)
const kfmt = (v: any) => v == null ? '—' : Math.abs(v) >= 1e6 ? `${n(v / 1e6, 2)}M` : Math.abs(v) >= 1e4 ? `${n(v / 1e3, 1)}k` : n(v, 0)
const skfmt = (v: any) => v == null ? '—' : `${v > 0 ? '+' : ''}${kfmt(v)}`

// ======================= COT =======================
const GROUPS: [string, string, string][] = [['all', 'All', 'Todos'], ['energy', 'Energy', 'Energia'], ['metals', 'Metals', 'Metais'], ['ags', 'Ags', 'Agrícolas'],
  ['fx', 'FX', 'Moedas'], ['rates', 'Rates', 'Juros'], ['equity', 'Equity', 'Ações'], ['crypto', 'Crypto', 'Cripto']]
const idxColor = (v: number | null) => v == null ? C.muted : v >= 80 ? C.up : v <= 20 ? C.down : C.text
function IdxBar({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: C.muted }}>—</span>
  return <span className="inline-flex items-center gap-1"><span className="relative inline-block h-[7px] w-[52px]" style={{ background: C.line }}>
    <span className="absolute top-0 h-[7px] w-[3px]" style={{ left: `calc(${v}% - 1px)`, background: idxColor(v) === C.text ? C.amber : idxColor(v) }} /></span>
    <span style={{ color: idxColor(v) }}>{n(v, 0)}</span></span>
}
export function COTView() {
  const { data: d, err } = useJSON<any>('cot.json')
  const [grp, setGrp] = useState('all'), [sel, setSel] = useState('CL'), [rng, setRng] = useState('3Y'), [sort, setSort] = useState('grp')
  const rows = useMemo(() => {
    if (!d) return []
    const r = (d.markets as any[]).filter(m => grp === 'all' || m.group === grp)
    if (sort === 'idx') return [...r].sort((a, b) => (b.spec_idx ?? -1) - (a.spec_idx ?? -1))
    if (sort === 'chg') return [...r].sort((a, b) => Math.abs(b.spec_chg / (b.oi || 1)) - Math.abs(a.spec_chg / (a.oi || 1)))
    return r
  }, [d, grp, sort])
  if (!d) return <FnScreen code="COT" title="Commitments of Traders"><Loading2 err={err} /></FnScreen>
  const M = d.markets as any[]
  const m = M.find(x => x.sym === sel) || M[0]
  const nm = (x: any) => lang() === 'pt' ? x.name_pt : x.name
  const from = rng === 'MAX' ? null : isoAgo(m.date, rng === '1Y' ? 366 : 3 * 366)
  const h = (m.hist as any[]).filter(r => !from || r[0] >= from)
  const ext = (k: 'hi' | 'lo') => [...M].sort((a, b) => k === 'hi' ? (b.spec_idx ?? -1) - (a.spec_idx ?? -1) : (a.spec_idx ?? 101) - (b.spec_idx ?? 101))[0]
  const hi = ext('hi'), lo = ext('lo')
  const mover = [...M].sort((a, b) => Math.abs(b.spec_chg / (b.oi || 1)) - Math.abs(a.spec_chg / (a.oi || 1)))[0]
  const gl = (g: string) => { const x = GROUPS.find(G => G[0] === g); return x ? L(x[1], x[2]) : g }
  const note = L(d.note, 'Posições de terça-feira, divulgadas na sexta (15h30 de Nova York). Especuladores = não comerciais; hedgers = comerciais; pequenos = não reportáveis. Líquido = comprado − vendido, em contratos. Índice COT = onde o líquido está entre a mínima (0) e a máxima (100) de 3 anos.')
  return (
    <FnScreen code="COT" title="Commitments of Traders" source={d.source} note={note} asOf={d.date}
      right={<><Field label={L('Group', 'Grupo')}><Btns opts={GROUPS.map(g => ({ v: g[0], l: L(g[1], g[2]) }))} value={grp} onChange={setGrp} /></Field>
        <Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'grp', l: L('Group', 'Grupo') }, { v: 'idx', l: L('COT index', 'Índice COT') }, { v: 'chg', l: L('Weekly Δ', 'Δ semana') }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('Report date (Tue)', 'Data das posições (ter)'), dUS(d.date), C.white],
        [L('Markets', 'Mercados'), String(M.length)],
        [L('Most crowded long', 'Mais comprado (índice)'), `${hi.sym} · ${n(hi.spec_idx, 0)}`, C.up],
        [L('Most crowded short', 'Mais vendido (índice)'), `${lo.sym} · ${n(lo.spec_idx, 0)}`, C.down],
        [L('Biggest weekly shift', 'Maior mudança na semana'), `${mover.sym} ${skfmt(mover.spec_chg)}`, cl(mover.spec_chg)],
        [`${m.sym} · ${L('spec net', 'líquido espec.')}`, `${skfmt(m.spec_net)} (${pc(m.spec_pct_oi, 1)} OI)`, C.amber],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)' }}>
        <Panel title={L('Speculators (non-commercial) net positions · click a row', 'Posição líquida dos especuladores (não comerciais) · clique numa linha')}>
          <Grid maxH={640} rows={rows} onRow={(r: any) => setSel(r.sym)} rowStyle={(r: any) => r.sym === m.sym ? { background: C.line } : undefined} cols={[
            { k: 'sym', label: L('Sym', 'Cód.'), color: () => C.amber },
            { k: 'name', label: L('Market', 'Mercado'), w: '150px', fmt: (_, r: any) => nm(r) },
            { k: 'group', label: L('Group', 'Grupo'), fmt: x => gl(x), color: () => C.muted },
            { k: 'spec_net', label: L('Net', 'Líquido'), align: 'r', fmt: x => skfmt(x), color: x => cl(x) },
            { k: 'spec_chg', label: L('Δ wk', 'Δ sem.'), align: 'r', fmt: x => skfmt(x), color: x => cl(x) },
            { k: 'spec_pct_oi', label: '% OI', align: 'r', fmt: x => pc(x, 1), color: x => cl(x) },
            { k: 'spec_idx', label: L('COT idx 3Y', 'Índice 3a'), fmt: x => <IdxBar v={x} /> },
            { k: 'comm_net', label: L('Hedgers', 'Hedgers'), align: 'r', fmt: x => skfmt(x), color: () => C.muted },
            { k: 'oi', label: L('Open int.', 'Contr. abertos'), align: 'r', fmt: x => kfmt(x) },
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={`${m.sym} · ${nm(m)} · ${m.exchange}`} right={<Btns opts={['1Y', '3Y', 'MAX']} value={rng} onChange={setRng} />}>
            <FnChart height={300} panes={[
              { stretch: 3, series: [
                { kind: 'baseline', data: h.map(r => ({ time: r[0], value: r[1] })), title: L('Speculators net', 'Líquido especuladores'), decimals: 0 },
                { kind: 'line', data: h.map(r => ({ time: r[0], value: r[2] })), color: C.cyan, title: L('Hedgers net', 'Líquido hedgers'), decimals: 0, dashed: true },
              ] },
              { stretch: 1, series: [{ kind: 'line', data: h.map(r => ({ time: r[0], value: r[4] })), color: C.muted, title: L('Open interest', 'Contratos em aberto'), decimals: 0 }] },
            ]} />
          </Panel>
          <Panel title={L('Positioning detail (contracts)', 'Detalhe do posicionamento (contratos)')}>
            <KV cols={2} rows={[
              [L('Speculators long', 'Especuladores comprados'), n(m.spec_long, 0)], [L('Speculators short', 'Especuladores vendidos'), n(m.spec_short, 0)],
              [L('Speculators net', 'Especuladores líquido'), <span key="a" style={{ color: cl(m.spec_net) }}>{sn(m.spec_net, 0)}</span>], [L('Weekly change', 'Variação na semana'), <span key="b" style={{ color: cl(m.spec_chg) }}>{sn(m.spec_chg, 0)}</span>],
              [L('3Y high / low (net)', 'Máx. / mín. 3 anos (líquido)'), `${sn(m.spec_max, 0)} / ${sn(m.spec_min, 0)}`], [L('COT index (specs / hedgers)', 'Índice COT (espec. / hedgers)'), `${n(m.spec_idx, 0)} / ${n(m.comm_idx, 0)}`],
              [L('Hedgers net', 'Hedgers líquido'), sn(m.comm_net, 0)], [L('Small traders net', 'Pequenos líquido'), sn(m.small_net, 0)],
              [L('Open interest', 'Contratos em aberto'), `${n(m.oi, 0)} (${sn(m.oi_chg, 0)})`], [L('Contract code', 'Código do contrato'), m.code],
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= 13F =======================
const STATUS: Record<string, [string, string, string]> = { new: ['NEW', 'NOVA', C.up], add: ['ADD', 'COMPRA', C.up], cut: ['CUT', 'REDUZ', C.down], same: ['=', '=', C.muted] }
function Wbar({ w, max }: { w: number; max: number }) {
  return <span className="inline-block h-[6px] align-middle" style={{ width: Math.max(1, 60 * (w / (max || 1))), background: C.amber }} />
}
export function F13View() {
  const { data: d, err } = useJSON<any>('13f.json')
  const [mi, setMi] = useState('Berkshire Hathaway'), [mode, setMode] = useState('hold')
  const posH = useFitH(276, 140)
  if (!d) return <FnScreen code="13F" title="13F Manager Holdings"><Loading2 err={err} /></FnScreen>
  const MS = d.managers as any[]
  const m = MS.find(x => x.name === mi) || MS[0]
  const st = (x: any) => lang() === 'pt' ? x.style_pt : x.style
  const maxW = Math.max(...m.positions.map((p: any) => p.w || 0))
  const sec = (p: any) => `${p.issuer}${p.pc ? ' · ' + (p.pc === 'Put' ? 'PUT' : 'CALL') : ''}`
  const note = L(d.note, 'Posições compradas em ações, ETFs, opções e conversíveis listados nos EUA, que gestores com mais de US$ 100 milhões precisam informar 45 dias depois de cada trimestre. Não inclui vendas a descoberto, caixa, títulos nem ativos fora dos EUA, então não é a carteira inteira. Valores em US$ a preços do fim do trimestre; as mudanças comparam a quantidade de ações com o 13F-HR anterior.')
  const ct = m.counts
  return (
    <FnScreen code="13F" title="13F Manager Holdings" source={d.source} note={note} asOf={m.period}
      right={<><Field label={L('Manager', 'Gestor')}><select className={inputCls} style={inputStyle} value={m.name} onChange={e => setMi(e.target.value)}>
        {MS.map(x => <option key={x.cik} value={x.name}>{x.name}</option>)}</select></Field>
        <Field label={L('View', 'Visão')}><Btns opts={[{ v: 'hold', l: L('Holdings', 'Carteira') }, { v: 'cons', l: L('Consensus', 'Consenso') }]} value={mode} onChange={setMode} /></Field></>}>
      <Kpis items={[
        [L('Manager', 'Gestor'), m.name, C.amber],
        [L('Quarter / filed', 'Trimestre / entregue'), `${dUS(m.period)} · ${dUS(m.filed)}`],
        [L('Reported value', 'Valor informado'), `$${bigE(m.value, 1)}`, C.white],
        [L('Positions', 'Posições'), `${n(m.n, 0)} · top 10 = ${n(m.top10_w, 1)}%`],
        [L('New / added', 'Novas / aumentou'), `${ct.new} / ${ct.add}`, C.up],
        [L('Cut / sold out', 'Reduziu / zerou'), `${ct.cut} / ${ct.sold}`, C.down],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.5fr)' }}>
        <Panel title={L(`Managers (${MS.length}) · click to open`, `Gestores (${MS.length}) · clique para abrir`)}>
          <Grid maxH={640} rows={MS} onRow={(r: any) => { setMi(r.name); setMode('hold') }} rowStyle={(r: any) => r.name === m.name ? { background: C.line } : undefined} cols={[
            { k: 'name', label: L('Manager', 'Gestor'), color: () => C.amber, w: '150px' },
            { k: 'style', label: L('Style', 'Estilo'), fmt: (_, r: any) => st(r), color: () => C.muted, w: '120px' },
            { k: 'value', label: L('Value', 'Valor'), align: 'r', fmt: x => `$${bigE(x, 1)}`, color: () => C.white },
            { k: 'n', label: L('Pos.', 'Pos.'), align: 'r', fmt: x => n(x, 0) },
            { k: 'period', label: L('Quarter', 'Trim.'), align: 'r', fmt: x => dUS(x), color: () => C.muted },
          ]} />
        </Panel>
        {mode === 'hold' ? <div className="min-w-0 flex flex-col gap-2">
          <Panel title={L(`${m.name} · top ${m.positions.length} positions · ${st(m)} · vs ${m.prev_period ? dUS(m.prev_period) : '—'}`, `${m.name} · ${m.positions.length} maiores posições · ${st(m)} · vs ${m.prev_period ? dUS(m.prev_period) : '—'}`)}>
            <Grid maxH={posH} rows={m.positions} cols={[
              { k: 'issuer', label: L('Security', 'Papel'), fmt: (_, r: any) => sec(r), color: (_, r: any) => r.pc ? C.cyan : C.white, w: '190px' },
              { k: 'cls', label: L('Class', 'Classe'), color: () => C.muted, w: '80px' },
              { k: 'value', label: L('Value', 'Valor'), align: 'r', fmt: x => `$${bigE(x, 2)}` },
              { k: 'w', label: '% port.', align: 'r', fmt: x => pc(x, 2, false), color: () => C.amber },
              { k: 'bar', label: '', fmt: (_, r: any) => <Wbar w={r.w} max={maxW} /> },
              { k: 'shares', label: L('Shares', 'Ações'), align: 'r', fmt: x => kfmt(x) },
              { k: 'd_pct', label: L('Δ shares', 'Δ ações'), align: 'r', fmt: (x, r: any) => r.status === 'new' ? '—' : pc(x, 1), color: x => cl(x) },
              { k: 'status', label: L('Move', 'Mov.'), align: 'c', fmt: x => x ? <span style={{ color: STATUS[x][2] }}>{L(STATUS[x][0], STATUS[x][1])}</span> : '—' },
              { k: 'cusip', label: 'CUSIP', color: () => C.muted },
            ]} />
          </Panel>
          <Panel title={L(`Sold out since ${m.prev_period ? dUS(m.prev_period) : '—'} (largest, prior-quarter value)`, `Zeradas desde ${m.prev_period ? dUS(m.prev_period) : '—'} (maiores, valor no trimestre anterior)`)}>
            {m.sold.length ? <Grid maxH={112} rows={m.sold} cols={[
              { k: 'issuer', label: L('Security', 'Papel'), fmt: (_, r: any) => sec(r), color: () => C.down, w: '220px' },
              { k: 'cls', label: L('Class', 'Classe'), color: () => C.muted },
              { k: 'value', label: L('Prior value', 'Valor anterior'), align: 'r', fmt: x => `$${bigE(x, 2)}` },
              { k: 'shares', label: L('Prior shares', 'Ações antes'), align: 'r', fmt: x => kfmt(x) },
            ]} /> : <div className="p-2 text-[12px]" style={{ color: C.muted, fontFamily: MONO }}>{L('No position sold out.', 'Nenhuma posição zerada.')}</div>}
          </Panel>
        </div> : <Panel title={L(`Most widely held stocks among these ${MS.length} managers (latest 13F of each)`, `Ações mais presentes entre estes ${MS.length} gestores (último 13F de cada)`)}>
          <Grid maxH={640} rows={d.consensus} cols={[
            { k: 'issuer', label: L('Security', 'Papel'), color: () => C.white, w: '190px' },
            { k: 'cls', label: L('Class', 'Classe'), color: () => C.muted, w: '80px' },
            { k: 'holders', label: L('Holders', 'Gestores'), align: 'r', fmt: x => `${x}/${MS.length}`, color: () => C.amber },
            { k: 'buyers', label: L('Bought', 'Compraram'), align: 'r', color: () => C.up },
            { k: 'sellers', label: L('Cut', 'Reduziram'), align: 'r', color: () => C.down },
            { k: 'value', label: L('Combined value', 'Valor somado'), align: 'r', fmt: x => `$${bigE(x, 1)}` },
            { k: 'cusip', label: 'CUSIP', color: () => C.muted },
          ]} />
        </Panel>}
      </div>
    </FnScreen>
  )
}
