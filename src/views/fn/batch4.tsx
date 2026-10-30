'use client'
/** P3-J2 – funções novas: FIIM (monitor de FIIs), FNDS (ranking de fundos) e BKS (painel de bancos).
 *  Textos EN/PT por tela (L(en, pt)); dados só de fontes oficiais abertas (CVM, B3, BCB), gerados por pipeline/build_fns3.py. */
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, MONO, useJSON, FnScreen, Panel, Grid, Btns, Field, KV, inputCls, inputStyle } from '@/components/fn/kit'
import { n, pc, cl, dUS, bigE, Kpis, Loading2 } from './fn11util'
import { lang } from '@/lib/settings'
const holdF = (x: any) => x == null ? '—' : x >= 1000 ? bigE(x, 1) : n(x, 0)
const cnpjF = (c: any) => { const d = String(c || '').replace(/\D/g, '').padStart(14, '0'); return c ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : '—' }

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const brl = (v: any, d = 1) => v == null ? '—' : `R$ ${bigE(v, d)}`
const sbrl = (v: any, d = 1) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${bigE(Math.abs(v), d)}`
const med = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const pvpColor = (x: number | null) => x == null ? C.muted : x < 0.95 ? C.up : x > 1.05 ? C.down : C.text
const mth = (ym: string) => `${ym}-01`
const qEnd = (am: string) => `${am.slice(0, 4)}-${am.slice(4, 6)}-28`
const qLab = (am: string) => `${am.slice(4, 6) === '03' ? '1' : am.slice(4, 6) === '06' ? '2' : am.slice(4, 6) === '09' ? '3' : '4'}T${am.slice(2, 4)}`.replace('T', L('Q', 'T'))
const Muted = ({ t }: { t: string }) => <div className="p-2 text-[12px]" style={{ color: C.muted, fontFamily: MONO }}>{t}</div>

// ======================= FIIM =======================
const SEG_EN: Record<string, string> = { 'Multicategoria': 'Multi-category', 'Outros': 'Other', 'Logística': 'Logistics', 'Residencial': 'Residential', 'Shoppings': 'Shopping malls',
  'Escritórios': 'Offices', 'Hospital': 'Hospitals', 'Varejo': 'Retail', 'Hotel': 'Hotels', 'Educacional': 'Education', 'Lajes Corporativas': 'Corporate offices', 'Híbrido': 'Hybrid' }
const seg = (s: string | null) => !s ? '—' : lang() === 'pt' ? s : (SEG_EN[s] || s)
export function FIIMView() {
  const { data: d, err } = useJSON<any>('fiim.json')
  const [sg, setSg] = useState('all'), [sort, setSort] = useState('pl'), [sel, setSel] = useState('')
  const segs = useMemo(() => {
    if (!d) return [] as string[]
    const c: Record<string, number> = {}
    for (const r of d.rows) if (r.segment) c[r.segment] = (c[r.segment] || 0) + 1
    return Object.keys(c).sort((a, b) => c[b] - c[a])
  }, [d])
  const rows = useMemo(() => {
    if (!d) return []
    const r = (d.rows as any[]).filter(x => sg === 'all' || x.segment === sg)
    const k = (x: any) => sort === 'dy' ? x.dy_12m ?? -1e9 : sort === 'pvp' ? -(x.pvp ?? 1e9) : sort === 'liq' ? x.adtv : sort === 'hold' ? x.holders ?? 0 : x.pl
    return [...r].sort((a, b) => k(b) - k(a))
  }, [d, sg, sort])
  if (!d) return <FnScreen code="FIIM" title="REIT (FII) Monitor"><Loading2 err={err} /></FnScreen>
  const f = rows.find(x => x.code === sel) || rows[0] || d.rows[0]
  const h = f.hist as any[]
  const note = L(
    `Brazilian listed real-estate funds (FIIs) with net assets above R$ 50 million and average daily trading above R$ 50 thousand over the last ${d.sessions} sessions. Fund figures come from the monthly report each fund files with CVM (reference month ${d.ref}); price and trading value are the official B3 close (${dUS(d.price_date)}). Distribution per unit = the month's dividend yield reported to CVM × NAV per unit; the 12-month yield divides the last 12 of these by today's price. The figures are as reported by each administrator; a fund that reports late, restates or uses a different yield basis shows it here as filed.`,
    `FIIs listados com patrimônio acima de R$ 50 milhões e giro médio diário acima de R$ 50 mil nos últimos ${d.sessions} pregões. Os números do fundo vêm do informe mensal entregue à CVM (mês de referência ${d.ref}); preço e volume são o fechamento oficial da B3 (${dUS(d.price_date)}). Distribuição por cota = DY do mês informado à CVM × valor patrimonial da cota; o DY 12m soma as 12 últimas e divide pelo preço de hoje. Os números são os informados por cada administrador: atraso, reapresentação ou outra base de cálculo do DY aparecem aqui como entregues.`)
  const all = d.rows as any[]
  return (
    <FnScreen code="FIIM" title="REIT (FII) Monitor" source={d.source} note={note} asOf={d.price_date}
      right={<><Field label={L('Segment', 'Segmento')}><select className={inputCls} style={inputStyle} value={sg} onChange={e => setSg(e.target.value)}>
        <option value="all">{L('All segments', 'Todos os segmentos')}</option>{segs.map(s => <option key={s} value={s}>{seg(s)}</option>)}</select></Field>
        <Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'pl', l: L('Net assets', 'PL') }, { v: 'dy', l: 'DY 12m' }, { v: 'pvp', l: L('P/NAV', 'P/VP') }, { v: 'liq', l: L('Liquidity', 'Liquidez') }, { v: 'hold', l: L('Holders', 'Cotistas') }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('CVM report / B3 close', 'Informe CVM / fech. B3'), `${d.ref} · ${dUS(d.price_date)}`, C.white],
        [L('FIIs listed', 'FIIs na lista'), `${rows.length}${sg === 'all' ? '' : ` / ${all.length}`}`],
        [L('Median DY 12m', 'DY 12m mediano'), pc(med(rows.map(r => r.dy_12m)), 2, false), C.amber],
        [L('Median P/NAV', 'P/VP mediano'), n(med(rows.map(r => r.pvp)), 2)],
        [L('Net assets (sum)', 'PL somado'), brl(rows.reduce((s, r) => s + (r.pl || 0), 0), 1)],
        [L('Unitholders (sum)', 'Cotistas (soma)'), bigE(rows.reduce((s, r) => s + (r.holders || 0), 0), 2)],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Panel title={L('FIIs · click a row', 'FIIs · clique numa linha')}>
          <Grid maxH={640} rows={rows} onRow={(r: any) => setSel(r.code)} rowStyle={(r: any) => r.code === f.code ? { background: C.line } : undefined} cols={[
            { k: 'code', label: L('Ticker', 'Código'), color: () => C.amber },
            { k: 'segment', label: L('Segment', 'Segmento'), fmt: x => seg(x), color: () => C.muted, w: '110px' },
            { k: 'price', label: L('Price', 'Preço'), align: 'r', fmt: x => n(x, 2), color: () => C.white },
            { k: 'chg_1m', label: L('1M', '1M'), align: 'r', fmt: x => pc(x, 1), color: x => cl(x) },
            { k: 'pvp', label: L('P/NAV', 'P/VP'), align: 'r', fmt: x => n(x, 2), color: x => pvpColor(x) },
            { k: 'dy_12m', label: 'DY 12m', align: 'r', fmt: x => pc(x, 2, false), color: () => C.amber },
            { k: 'dy_m', label: L('DY mo.', 'DY mês'), align: 'r', fmt: x => pc(x, 2, false) },
            { k: 'adtv', label: L('Avg. daily vol.', 'Giro médio/dia'), align: 'r', fmt: x => brl(x, 1) },
            { k: 'pl', label: L('Net assets', 'PL'), align: 'r', fmt: x => brl(x, 2) },
            { k: 'holders', label: L('Holders', 'Cotistas'), align: 'r', fmt: holdF },
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={`${f.code} · ${L('NAV per unit and monthly distribution (R$)', 'VP da cota e distribuição mensal (R$)')}`}>
            <FnChart height={260} panes={[
              { stretch: 3, series: [
                { kind: 'line', data: h.filter(r => r[1] != null).map(r => ({ time: mth(r[0]), value: r[1] })), color: C.cyan, title: L('NAV / unit', 'VP / cota'), decimals: 2 },
                { kind: 'line', data: h.map(r => ({ time: mth(r[0]), value: f.price })), color: C.amber, title: L('Price today', 'Preço hoje'), decimals: 2, dashed: true },
              ] },
              { stretch: 2, series: [{ kind: 'hist', data: h.filter(r => r[2] != null).map(r => ({ time: mth(r[0]), value: r[2] })), color: C.up, title: L('Distribution / unit', 'Distribuição / cota'), decimals: 3 }] },
            ]} />
          </Panel>
          <Panel title={f.name}>
            <KV cols={2} rows={[
              [L('Segment (as filed)', 'Segmento (informado)'), seg(f.segment)], [L('Management', 'Gestão'), f.mgmt === 'Ativa' ? L('Active', 'Ativa') : f.mgmt === 'Passiva' ? L('Passive', 'Passiva') : (f.mgmt || '—')],
              [L('Price / NAV per unit', 'Preço / VP da cota'), `${n(f.price, 2)} / ${n(f.nav_q, 2)}`], [L('P/NAV', 'P/VP'), <span key="p" style={{ color: pvpColor(f.pvp) }}>{n(f.pvp, 3)}</span>],
              [L('Last distribution / unit', 'Última distribuição / cota'), `R$ ${n(f.dist_m, 3)} (${f.ref})`], [L('12m distributions / unit', 'Distribuições 12m / cota'), f.months >= 12 ? `R$ ${n(f.dist_12m, 2)}` : L(`${f.months} months only`, `só ${f.months} meses`)],
              [L('NAV per unit, 12m change', 'VP da cota, var. 12m'), <span key="v" style={{ color: cl(f.nav_chg_12m) }}>{pc(f.nav_chg_12m, 2)}</span>], [L('Unitholders', 'Cotistas'), n(f.holders, 0)],
              [L('Administrator', 'Administrador'), <span key="a" title={f.admin}>{f.admin ? (f.admin.length > 34 ? f.admin.slice(0, 33) + '…' : f.admin) : '—'}</span>], ['CNPJ', cnpjF(f.cnpj)],
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

// ======================= FNDS =======================
const FCATS: [string, string, string][] = [['fixed', 'Fixed income', 'Renda fixa'], ['multi', 'Multimarket', 'Multimercado'], ['equity', 'Equity', 'Ações'], ['fx', 'FX', 'Cambial']]
const short = (s: string) => s.replace(/FUNDO DE INVESTIMENTO( FINANCEIRO)?/g, 'FI').replace(/EM COTAS DE (FUNDOS DE INVESTIMENTO|FIF)/g, 'IC').replace(/RESPONSABILIDADE LIMITADA|RESP(\.)? LIMITADA|RESP LTDA/g, 'RL').replace(/\s+/g, ' ').trim()
export function FNDSView() {
  const { data: d, err } = useJSON<any>('fnds.json')
  const [cat, setCat] = useState('fixed'), [sort, setSort] = useState('pl'), [sel, setSel] = useState('')
  const rows = useMemo(() => {
    if (!d) return []
    const r = (d.cats[cat] || []) as any[]
    const k = (x: any) => sort === 'r12' ? x.ret_12m ?? -1e9 : sort === 'r1' ? x.ret_1m ?? -1e9 : sort === 'f1' ? x.flow_1m ?? -1e18 : sort === 'f12' ? x.flow_12m ?? -1e18 : sort === 'dd' ? x.mdd_12m ?? -1e9 : x.pl
    return [...r].sort((a, b) => k(b) - k(a))
  }, [d, cat, sort])
  if (!d) return <FnScreen code="FNDS" title="Fund Rankings"><Loading2 err={err} /></FnScreen>
  const f = rows.find(x => x.cnpj === sel) || rows[0]
  const note = L(
    `Open-ended, non-exclusive Brazilian fund classes with net assets above R$ ${n(d.filters.min_pl / 1e6, 0)} million and at least ${d.filters.min_holders} unitholders, from the CVM daily report (latest complete day ${dUS(d.date)}); the ${d.filters.top} largest per CVM class are listed. Returns are of the unit price, net of fees and before taxes. Net flows = subscriptions − redemptions. Volatility and drawdown use the last 12 months of daily prices. Classes are CVM's, not ANBIMA's (the ANBIMA subtype is shown for reference). Funds of funds also appear, so flows can be counted twice across rows.`,
    `Classes de fundos abertas e não exclusivas com PL acima de R$ ${n(d.filters.min_pl / 1e6, 0)} milhões e pelo menos ${d.filters.min_holders} cotistas, do informe diário da CVM (último dia completo ${dUS(d.date)}); aparecem as ${d.filters.top} maiores de cada classe CVM. Retornos são da cota, líquidos de taxas e antes de impostos. Captação líquida = aplicações − resgates. Volatilidade e drawdown usam os últimos 12 meses de cotas diárias. A classificação é a da CVM, não a da ANBIMA (o subtipo ANBIMA aparece como referência). Fundos de cotas também entram, então a captação pode aparecer duas vezes em linhas diferentes.`)
  const all = (d.cats[cat] || []) as any[]
  const best = [...all].filter(x => x.ret_12m != null).sort((a, b) => b.ret_12m - a.ret_12m)[0]
  const sp = (f?.spark || []) as any[]
  return (
    <FnScreen code="FNDS" title="Fund Rankings" source={d.source} note={note} asOf={d.date}
      right={<><Field label={L('Class (CVM)', 'Classe (CVM)')}><Btns opts={FCATS.map(c => ({ v: c[0], l: L(c[1], c[2]) }))} value={cat} onChange={v => { setCat(v); setSel('') }} /></Field>
        <Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'pl', l: L('AUM', 'PL') }, { v: 'r12', l: L('12M ret.', 'Ret. 12M') }, { v: 'r1', l: L('1M ret.', 'Ret. 1M') }, { v: 'f1', l: L('1M flow', 'Capt. 1M') }, { v: 'f12', l: L('12M flow', 'Capt. 12M') }, { v: 'dd', l: 'Drawdown' }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('CVM daily report', 'Informe diário CVM'), dUS(d.date), C.white],
        [L('Eligible classes', 'Classes elegíveis'), `${n(d.universe, 0)} · ${L('shown', 'listadas')} ${all.length}`],
        [L('AUM listed', 'PL listado'), brl(all.reduce((s, r) => s + (r.pl || 0), 0), 1)],
        [L('Net flow 1M (listed)', 'Captação 1M (listadas)'), sbrl(all.reduce((s, r) => s + (r.flow_1m || 0), 0), 1), cl(all.reduce((s, r) => s + (r.flow_1m || 0), 0))],
        [L('Median 12M return', 'Retorno 12M mediano'), pc(med(all.map(r => r.ret_12m)), 2), C.amber],
        [L('Best 12M', 'Melhor 12M'), best ? `${pc(best.ret_12m, 1)}` : '—', C.up],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)' }}>
        <Panel title={L('Funds · click a row', 'Fundos · clique numa linha')}>
          {rows.length ? <Grid maxH={640} rows={rows} onRow={(r: any) => setSel(r.cnpj)} rowStyle={(r: any) => f && r.cnpj === f.cnpj ? { background: C.line } : undefined} cols={[
            { k: 'name', label: L('Fund', 'Fundo'), fmt: x => <span className="block truncate max-w-[260px]" title={x}>{short(x)}</span>, color: () => C.white, w: '260px' },
            { k: 'ret_1m', label: '1M', align: 'r', fmt: x => pc(x, 2), color: x => cl(x) },
            { k: 'ret_ytd', label: L('YTD', 'Ano'), align: 'r', fmt: x => pc(x, 2), color: x => cl(x) },
            { k: 'ret_12m', label: '12M', align: 'r', fmt: x => pc(x, 2), color: x => cl(x) },
            { k: 'vol_12m', label: L('Vol', 'Vol'), align: 'r', fmt: x => pc(x, 1, false), color: () => C.muted },
            { k: 'mdd_12m', label: 'MDD', align: 'r', fmt: x => pc(x == null ? x : Math.abs(x) < 0.05 ? 0 : x, 1, false), color: x => x < -5 ? C.down : C.text },
            { k: 'flow_1m', label: L('Flow 1M', 'Capt. 1M'), align: 'r', fmt: x => sbrl(x, 1), color: x => cl(x) },
            { k: 'flow_12m', label: L('Flow 12M', 'Capt. 12M'), align: 'r', fmt: x => sbrl(x, 1), color: x => cl(x) },
            { k: 'pl', label: L('AUM', 'PL'), align: 'r', fmt: x => brl(x, 1), color: () => C.amber },
            { k: 'holders', label: L('Holders', 'Cotistas'), align: 'r', fmt: holdF },
          ]} /> : <Muted t={L('No fund in this class.', 'Nenhum fundo nesta classe.')} />}
        </Panel>
        {f ? <div className="min-w-0 flex flex-col gap-2">
          <Panel title={L('Unit price, weekly, base 100 = one year ago', 'Cota semanal, base 100 = um ano atrás')}>
            <FnChart height={240} panes={[{ stretch: 1, series: [{ kind: 'area', data: sp.map(r => ({ time: r[0], value: r[1] })), color: C.cyan, title: L('Unit (base 100)', 'Cota (base 100)'), decimals: 2 }] }]} />
          </Panel>
          <Panel title={short(f.name)}>
            <KV cols={2} rows={[
              [L('ANBIMA subtype', 'Subtipo ANBIMA'), f.anbima || '—'], ['CNPJ', cnpjF(f.cnpj)],
              [L('Return 1M / YTD', 'Retorno 1M / ano'), `${pc(f.ret_1m, 2)} / ${pc(f.ret_ytd, 2)}`], [L('Return 12M', 'Retorno 12M'), <span key="r" style={{ color: cl(f.ret_12m) }}>{pc(f.ret_12m, 2)}</span>],
              [L('Volatility 12M (ann.)', 'Volatilidade 12M (anual.)'), pc(f.vol_12m, 2, false)], [L('Max drawdown 12M', 'Drawdown máx. 12M'), pc(f.mdd_12m, 2, false)],
              [L('Net flow 1M', 'Captação 1M'), <span key="a" style={{ color: cl(f.flow_1m) }}>{sbrl(f.flow_1m, 2)}</span>], [L('Net flow 12M', 'Captação 12M'), <span key="b" style={{ color: cl(f.flow_12m) }}>{sbrl(f.flow_12m, 2)}</span>],
              [L('AUM', 'PL'), brl(f.pl, 2)], [L('Unitholders', 'Cotistas'), n(f.holders, 0)],
            ]} />
          </Panel>
        </div> : null}
      </div>
    </FnScreen>
  )
}

// ======================= BKS =======================
const SEGS: Record<string, [string, string]> = { S1: ['S1 · systemic (≥10% of GDP or intl.)', 'S1 · sistêmico (≥10% do PIB ou internacional)'], S2: ['S2 · 1–10% of GDP', 'S2 · 1–10% do PIB'], S3: ['S3 · 0.1–1% of GDP', 'S3 · 0,1–1% do PIB'], S4: ['S4 · <0.1% of GDP', 'S4 · <0,1% do PIB'], S5: ['S5 · simplified regime', 'S5 · regime simplificado'] }
const baselColor = (x: number | null) => x == null ? C.muted : x < 11.5 ? C.down : x >= 15 ? C.up : C.text
export function BKSView() {
  const { data: d, err } = useJSON<any>('bks.json')
  const [sort, setSort] = useState('assets'), [sel, setSel] = useState(''), [sg, setSg] = useState('all')
  const rows = useMemo(() => {
    if (!d) return []
    const r = (d.rows as any[]).filter(x => sg === 'all' || x.seg === sg)
    const k = (x: any) => sort === 'basel' ? x.basel ?? -1 : sort === 'roe' ? x.roe ?? -1e9 : sort === 'cy' ? x.credit_yoy ?? -1e9 : sort === 'credit' ? x.credit ?? 0 : x.assets
    return [...r].sort((a, b) => k(b) - k(a))
  }, [d, sort, sg])
  if (!d) return <FnScreen code="BKS" title="Bank Monitor"><Loading2 err={err} /></FnScreen>
  const b = rows.find(x => x.id === sel) || rows[0] || d.rows[0]
  const all = d.rows as any[]
  const h = b.hist as any[]
  const note = L(
    `The ${all.length} largest Brazilian prudential conglomerates by total assets, from the central bank's IF.data "Summary" report (quarter ${qLab(d.ref)}; the BCB publishes each quarter about 3 months after it ends). Values in BRL. Net income is the year-to-date figure of the current half (Jan–Jun or Jul–Dec), so ROE is annualised by 12 ÷ months. Basel ratio = regulatory capital ÷ risk-weighted assets; the minimum with the conservation buffer is 10.5% (plus 1% for systemically important banks). Credit portfolio = the loan book as reported in the summary.`,
    `Os ${all.length} maiores conglomerados prudenciais do Brasil por ativo total, do relatório "Resumo" do IF.data do Banco Central (trimestre ${qLab(d.ref)}; o BCB publica cada trimestre cerca de 3 meses depois do fim). Valores em reais. O lucro líquido é o acumulado do semestre (jan–jun ou jul–dez), por isso o ROE é anualizado por 12 ÷ meses. Índice de Basileia = patrimônio de referência ÷ ativos ponderados pelo risco; o mínimo com o adicional de conservação é 10,5% (mais 1% para os sistemicamente importantes). Carteira de crédito = a carteira informada no resumo.`)
  return (
    <FnScreen code="BKS" title="Bank Monitor" source={d.source} note={note} asOf={qEnd(d.ref)}
      right={<><Field label={L('Segment', 'Segmento')}><Btns opts={[{ v: 'all', l: L('All', 'Todos') }, 'S1', 'S2', 'S3', 'S4'].map(x => typeof x === 'string' ? { v: x, l: x } : x)} value={sg} onChange={setSg} /></Field>
        <Field label={L('Sort', 'Ordenar')}><Btns opts={[{ v: 'assets', l: L('Assets', 'Ativo') }, { v: 'credit', l: L('Credit', 'Crédito') }, { v: 'cy', l: L('Credit YoY', 'Créd. 12m') }, { v: 'roe', l: 'ROE' }, { v: 'basel', l: L('Basel', 'Basileia') }]} value={sort} onChange={setSort} /></Field></>}>
      <Kpis items={[
        [L('IF.data quarter', 'Trimestre IF.data'), qLab(d.ref), C.white],
        [L('Conglomerates', 'Conglomerados'), `${rows.length}${sg === 'all' ? '' : ` / ${all.length}`}`],
        [L('Total assets', 'Ativo total'), brl(rows.reduce((s, r) => s + (r.assets || 0), 0), 2)],
        [L('Credit portfolio', 'Carteira de crédito'), brl(rows.reduce((s, r) => s + (r.credit || 0), 0), 2), C.amber],
        [L('Median Basel ratio', 'Basileia mediana'), pc(med(rows.map(r => r.basel)), 1, false)],
        [L('Median ROE (ann.)', 'ROE mediano (anual.)'), pc(med(rows.map(r => r.roe)), 1, false)],
      ]} />
      <div className="grid gap-2 fn-grid lg:flex-1 lg:min-h-0" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <Panel title={L('Prudential conglomerates · click a row', 'Conglomerados prudenciais · clique numa linha')}>
          <Grid maxH={640} rows={rows} onRow={(r: any) => setSel(r.id)} rowStyle={(r: any) => r.id === b.id ? { background: C.line } : undefined} cols={[
            { k: 'name', label: L('Bank', 'Banco'), color: () => C.amber, w: '170px', fmt: x => <span className="block truncate max-w-[170px]" title={x}>{x}</span> },
            { k: 'seg', label: 'Seg.', color: () => C.muted, fmt: x => x || '—' },
            { k: 'assets', label: L('Assets', 'Ativo'), align: 'r', fmt: x => brl(x, 1), color: () => C.white },
            { k: 'credit', label: L('Credit', 'Crédito'), align: 'r', fmt: x => brl(x, 1) },
            { k: 'credit_yoy', label: L('Cred. YoY', 'Créd. 12m'), align: 'r', fmt: x => pc(x, 1), color: x => cl(x) },
            { k: 'equity', label: L('Equity', 'PL'), align: 'r', fmt: x => brl(x, 1) },
            { k: 'net_income', label: L('Net inc. (H)', 'Lucro (sem.)'), align: 'r', fmt: x => sbrl(x, 1), color: x => cl(x) },
            { k: 'roe', label: 'ROE', align: 'r', fmt: x => pc(x, 1, false), color: x => x == null ? C.muted : x < 0 ? C.down : C.text },
            { k: 'basel', label: L('Basel', 'Basileia'), align: 'r', fmt: x => pc(x, 1, false), color: x => baselColor(x) },
          ]} />
        </Panel>
        <div className="min-w-0 flex flex-col gap-2">
          <Panel title={`${b.name} · ${L('Basel ratio (%) and credit portfolio (R$ bn)', 'Basileia (%) e carteira de crédito (R$ bi)')}`}>
            <FnChart height={250} panes={[
              { stretch: 2, series: [{ kind: 'line', data: h.filter(r => r[1] != null).map(r => ({ time: qEnd(r[0]), value: r[1] })), color: C.cyan, title: L('Basel %', 'Basileia %'), decimals: 2 }] },
              { stretch: 2, series: [{ kind: 'hist', data: h.filter(r => r[2] != null).map(r => ({ time: qEnd(r[0]), value: r[2] / 1e9 })), color: C.amber, title: L('Credit (R$ bn)', 'Crédito (R$ bi)'), decimals: 1 }] },
            ]} />
          </Panel>
          <Panel title={b.name}>
            <KV cols={2} rows={[
              [L('Segment', 'Segmento'), b.seg ? L(SEGS[b.seg]?.[0] || b.seg, SEGS[b.seg]?.[1] || b.seg) : '—'], [L('Total assets', 'Ativo total'), brl(b.assets, 2)],
              [L('Credit / assets', 'Crédito / ativo'), pc(b.credit_assets, 1, false)], [L('Credit growth 12m', 'Crescimento do crédito 12m'), <span key="c" style={{ color: cl(b.credit_yoy) }}>{pc(b.credit_yoy, 2)}</span>],
              [L('Funding (deposits etc.)', 'Captações'), brl(b.funding, 2)], [L('Equity', 'Patrimônio líquido'), brl(b.equity, 2)],
              [L('Net income, half to date', 'Lucro líquido no semestre'), <span key="n" style={{ color: cl(b.net_income) }}>{sbrl(b.net_income, 2)}</span>], [L('ROE (annualised)', 'ROE (anualizado)'), pc(b.roe, 2, false)],
              [L('Basel ratio', 'Índice de Basileia'), <span key="b" style={{ color: baselColor(b.basel) }}>{pc(b.basel, 2, false)}</span>], [L('Fixed-asset ratio', 'Índice de imobilização'), pc(b.fixed_ratio, 2, false)],
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}
