'use client'
// DES de FIIs, ETFs (B3 e EUA) e BDRs: des/<ticker>.json (pipeline/build_des.py). Campo sem dado na origem → "—".
import React, { useState } from 'react'
import { FnScreen, Panel, Grid, KV, Loading, C, nf, pf, big, dBR, clr, short, useJSON, isoMinus } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import { usePrices } from './tech'
import { href, tickerKey } from '../../lib/static'
import { L, fyEnd, isoDate } from './desLabels'
import { lang } from '../../lib/settings'

const pt = () => lang() === 'pt'
const D = (v?: string | null) => v ? isoDate(v) : '—'
const S = (v?: any) => v == null || v === '' ? '—' : String(v)
const pc = (v?: number | null, d = 2) => v == null ? '—' : pf(v * 100, d, false)
const M_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const M_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "30/06" (informe de FII) ou "2027-03-31" (fim do exercício corrente, registro CVM) → "Jun 30" / "30/jun" */
function dayMonth(v?: string | null) {
  if (!v) return '—'
  let m = v.match(/^(\d{1,2})\/(\d{1,2})$/), d = 0, mo = 0
  if (m) { d = +m[1]; mo = +m[2] } else if ((m = v.match(/^\d{4}-(\d{2})-(\d{2})/))) { mo = +m[1]; d = +m[2] } else return v
  if (mo < 1 || mo > 12) return v
  return pt() ? `${d}/${M_PT[mo - 1]}` : `${M_EN[mo - 1]} ${d}`
}
/** mês de referência "2026-09" → "Sep 2026" / "set/2026" */
const ym = (v?: string | null) => { const m = (v || '').match(/^(\d{4})-(\d{2})/); return !m ? '—' : pt() ? `${M_PT[+m[2] - 1]}/${m[1]}` : `${M_EN[+m[2] - 1]} ${m[1]}` }
// valores do cadastro da CVM/B3 → inglês (PT mostra o original)
const CVM_EN: Record<string, string> = {
  'Multicategoria': 'Multi-category', 'Shoppings': 'Shopping malls', 'Hotel': 'Hotels', 'Escritórios': 'Offices', 'Outros': 'Other', 'Logística': 'Logistics',
  'Residencial': 'Residential', 'Varejo': 'Retail', 'Hospital': 'Hospitals', 'Lajes Corporativas': 'Corporate offices', 'Títulos e Val. Mob.': 'Securities',
  'Ativa': 'Active', 'Definida': 'Defined (passive)', 'Passiva': 'Passive', 'INVESTIDORES EM GERAL': 'General public', 'INVESTIDOR QUALIFICADO': 'Qualified investors',
  'INVESTIDOR PROFISSIONAL': 'Professional investors', 'Público Geral': 'General public', 'Qualificado': 'Qualified investors', 'Profissional': 'Professional investors',
  'Indeterminado': 'Indefinite', 'Determinado': 'Fixed term', 'Em Funcionamento Normal': 'Operating normally', 'N': 'No', 'S': 'Yes', 'DIVIDENDO': 'Dividend',
  'RENDIMENTO': 'Income', 'JRS CAP PROPRIO': 'Interest on equity', 'AMORTIZACAO': 'Amortization', 'RESTITUICAO CAPITAL': 'Return of capital',
}
const ev = (v?: string | null) => !v ? '—' : pt() ? (v === 'N' ? 'Não' : v === 'S' ? 'Sim' : v) : CVM_EN[v] || v
const refEN = (v?: string | null) => !v || pt() ? S(v) : v.replace(/^(\d)º Trimestre\/(\d{4})$/, 'Q$1 $2').replace(/^(\d)º Semestre\/(\d{4})$/, 'H$1 $2')
const site = (v?: string | null) => !v ? '—' : <a className="underline" style={{ color: C.amber }} href={/^https?:/.test(v) ? v : `https://${v}`} target="_blank" rel="noreferrer">{v.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>

/** Painel de preço de 1 ano (comum a todas as classes) */
function PricePanel({ ticker, ccy, extra = [] }: { ticker: string; ccy: string; extra?: [string, React.ReactNode, string?][] }) {
  const { rows } = usePrices(ticker)
  const last = rows && rows.length ? rows[rows.length - 1] : null
  const r1 = rows && last ? rows.filter(r => r.time >= isoMinus(last.time, 0, 0, 1)) : []
  const hi = r1.length ? Math.max(...r1.map(r => r.high)) : null, lo = r1.length ? Math.min(...r1.map(r => r.low)) : null
  const ret1 = r1.length ? (r1[r1.length - 1].close / r1[0].close - 1) * 100 : null
  return (
    <Panel title={L('Price — 1 year', 'Preço — 1 ano')} asOf={last?.time}>
      {r1.length > 0 ? <FnChart height={190} panes={[{ series: [{ kind: 'area', data: r1.map(r => ({ time: r.time, value: r.close })), color: C.white, title: short(ticker) }] }]} /> : <div style={{ height: 190 }} />}
      <KV rows={[[L('Last', 'Último'), last ? `${ccy} ${nf(last.close)}` : '—', C.amber], [L('Date', 'Data'), last ? dBR(last.time) : '—'], [L('1Y return (adj.)', 'Retorno 1 ano (ajust.)'), pf(ret1), clr(ret1)], [L('52w high', 'Máxima 52 sem.'), nf(hi)], [L('52w low', 'Mínima 52 sem.'), nf(lo)], ...extra]} />
    </Panel>
  )
}

const TITLE = (d: any) => `${L('Description', 'Descrição')} — ${d.trading_name && d.kind === 'bdr' ? d.name : d.name || d.sec_name || short(d.ticker)}`

export function DESClassView({ ticker }: { ticker: string }) {
  const { data: d, err } = useJSON<any>(`des/${tickerKey(ticker)}.json`)
  if (!d) return <FnScreen code="DES" ticker={ticker}><Loading err={err} /></FnScreen>
  if (d.kind === 'fii') return <FII d={d} ticker={ticker} />
  if (d.kind === 'etf_br') return <ETFBR d={d} ticker={ticker} />
  if (d.kind === 'bdr') return <BDR d={d} ticker={ticker} />
  return <ETFUS d={d} ticker={ticker} />
}

// ---------------- FII ----------------
function FII({ d, ticker }: { d: any; ticker: string }) {
  const [tab, setTab] = useState(0)
  const { rows } = usePrices(ticker)
  const last = rows && rows.length ? rows[rows.length - 1].close : null
  const pnav = last != null && d.nav ? last / d.nav : null
  // informe mensal: data de referência = último dia do mês
  const refDate = d.ref ? new Date(Date.UTC(+d.ref.slice(0, 4), +d.ref.slice(5, 7), 0)).toISOString().slice(0, 10) : null
  const hist: any[] = d.hist || []
  const note = L(`Fund figures come from the fund's latest monthly report (reference month shown on each panel). Monthly DY and return are the values reported by the fund. DY 12m = sum of the last 12 monthly DY values (— when a month is missing). P/NAV = last close ÷ NAV per share of the latest report. Admin fee = administration fee expense in the month as a share of net assets.`,
    `Os números do fundo vêm do último informe mensal (mês de referência em cada painel). DY e rentabilidade mensais são os valores informados pelo fundo. DY 12m = soma dos 12 últimos DY mensais (— se faltar algum mês). P/VP = último fechamento ÷ valor patrimonial por cota do último informe. Taxa de administração = despesa com taxa de administração no mês sobre o patrimônio líquido.`)
  return (
    <FnScreen code="DES" ticker={ticker} title={TITLE(d)} tabs={[L('Profile', 'Perfil'), L('History', 'Histórico'), L('Registry', 'Cadastro')]} tab={tab} setTab={setTab} note={note}>
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <Panel title={L('Fund profile', 'Perfil do fundo')}>
          <KV rows={[[L('Name', 'Nome'), S(d.name)], ['CNPJ', S(d.cnpj)], ['ISIN', S(d.isin)], [L('Segment', 'Segmento'), ev(d.segment)], ...(d.mandate ? [[L('Mandate', 'Mandato'), ev(d.mandate)]] as [string, string][] : []),
            [L('Management', 'Gestão'), ev(d.mgmt)], [L('Target investors', 'Público-alvo'), ev(d.audience)], [L('Term', 'Prazo'), d.term_date ? `${ev(d.term)} (${D(d.term_date)})` : ev(d.term)],
            [L('Operating since', 'Início de funcionamento'), D(d.start)], [L('Fiscal year end', 'Fim do exercício social'), dayMonth(d.fy_end)], [L('Administrator', 'Administrador'), S(d.admin)],
            [L('Manager', 'Gestor'), S(d.manager)], [L('Website', 'Site'), site(d.site)]]} />
        </Panel>
        <PricePanel ticker={ticker} ccy="R$" extra={[[L('P/NAV', 'P/VP'), nf(pnav), C.amber]]} />
        <Panel title={L('Key data', 'Dados principais')} asOf={refDate}>
          <KV rows={[[L('Net assets', 'Patrimônio líquido'), d.pl != null ? `R$ ${big(d.pl)}` : '—', C.amber], [L('Total assets', 'Ativo total'), d.assets != null ? `R$ ${big(d.assets)}` : '—'],
            [L('NAV per share', 'Valor patrimonial da cota'), d.nav != null ? `R$ ${nf(d.nav)}` : '—'], [L('Shares outstanding', 'Cotas emitidas'), big(d.quotas)],
            [L('Unitholders', 'Cotistas'), d.holders != null ? nf(d.holders, 0) : '—'], [L('Individuals', 'Pessoas físicas'), d.holders_pf != null ? nf(d.holders_pf, 0) : '—'],
            [L('DY (month)', 'DY (mês)'), pc(d.dy_m)], [L('DY 12m', 'DY 12m'), pc(d.dy_12m), C.amber], [L('Return (month)', 'Rentabilidade (mês)'), d.ret_m != null ? pf(d.ret_m * 100) : '—', clr(d.ret_m)],
            [L('Admin fee (month)', 'Taxa de adm. (mês)'), pc(d.fee_m, 3)], [L('Reference month', 'Mês de referência'), ym(d.ref)]]} />
        </Panel>
      </div>}
      {tab === 1 && <div className="grid gap-2 fn-grid pb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title={L('NAV per share (R$)', 'Valor patrimonial da cota (R$)')}><FnChart height={200} panes={[{ series: [{ kind: 'line', data: hist.filter(h => h.nav != null).map(h => ({ time: `${h.ref}-01`, value: h.nav })), color: C.amber, title: L('NAV/share', 'VP/cota') }] }]} /></Panel>
        <Panel title={L('Monthly DY (%)', 'DY mensal (%)')}><FnChart height={200} panes={[{ series: [{ kind: 'hist', data: hist.filter(h => h.dy != null).map(h => ({ time: `${h.ref}-01`, value: h.dy * 100 })), color: C.blue, title: 'DY', decimals: 2 }] }]} /></Panel>
        <div className="col-span-2"><Panel title={L('Monthly reports', 'Informes mensais')}>
          <Grid maxH={250} cols={[{ k: 'ref', label: L('Month', 'Mês'), fmt: v => ym(v) }, { k: 'pl', label: L('Net assets', 'Patrimônio líquido'), align: 'r', fmt: v => big(v) }, { k: 'nav', label: L('NAV/share', 'VP/cota'), align: 'r', fmt: v => nf(v) },
            { k: 'holders', label: L('Unitholders', 'Cotistas'), align: 'r', fmt: v => v == null ? '—' : nf(v, 0) }, { k: 'dy', label: 'DY', align: 'r', fmt: v => pc(v) },
            { k: 'ret', label: L('Return', 'Rentabilidade'), align: 'r', fmt: v => v == null ? '—' : pf(v * 100), color: clr }, { k: 'ret_nav', label: L('NAV return', 'Rentab. patrimonial'), align: 'r', fmt: v => v == null ? '—' : pf(v * 100), color: clr }]}
            rows={[...hist].reverse()} />
        </Panel></div>
      </div>}
      {tab === 2 && <Panel title={L('Registry', 'Cadastro')}>
        <KV cols={2} rows={[[L('Name', 'Nome'), S(d.name)], ['CNPJ', S(d.cnpj)], ['ISIN', S(d.isin)], [L('Registration date', 'Data de registro'), D(d.registered)],
          [L('Operating since', 'Início de funcionamento'), D(d.start)], [L('Exclusive fund', 'Fundo exclusivo'), ev(d.exclusive)], [L('Administrator', 'Administrador'), S(d.admin)],
          [L('Administrator CNPJ', 'CNPJ do administrador'), S(d.admin_cnpj)], [L('Manager', 'Gestor'), S(d.manager)], [L('Custodian', 'Custodiante'), S(d.custodian)],
          [L('Auditor', 'Auditor'), S(d.auditor)], [L('Officer in charge', 'Diretor responsável'), S(d.director)], [L('City', 'Cidade'), S(d.city)], [L('Website', 'Site'), site(d.site)]]} />
      </Panel>}
    </FnScreen>
  )
}

// ---------------- ETF B3 ----------------
function ETFBR({ d, ticker }: { d: any; ticker: string }) {
  const [tab, setTab] = useState(0)
  const note = L(`Net assets as of the date shown. Benchmark index and management fee are shown as — because they are not available for this class.`,
    `Patrimônio líquido na data indicada. Índice de referência e taxa de administração aparecem como — porque não estão disponíveis para esta classe.`)
  return (
    <FnScreen code="DES" ticker={ticker} title={TITLE(d)} tabs={[L('Profile', 'Perfil'), L('Registry', 'Cadastro')]} tab={tab} setTab={setTab} note={note}>
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <Panel title={L('Fund profile', 'Perfil do fundo')}>
          <KV rows={[[L('Name', 'Nome'), S(d.name)], [L('Trading name', 'Nome de pregão'), S(d.trading_name)], ['CNPJ', S(d.cnpj)], [L('Status', 'Situação'), ev(d.status)],
            [L('Registration date', 'Data de registro'), D(d.registered)], [L('Fiscal year end', 'Fim do exercício social'), dayMonth(d.fy_end)],
            [L('Administrator', 'Administrador'), S(d.admin)], [L('Manager', 'Gestor'), S(d.manager)], [L('Custodian', 'Custodiante'), S(d.custodian)], [L('Website', 'Site'), site(d.site)]]} />
        </Panel>
        <PricePanel ticker={ticker} ccy="R$" />
        <Panel title={L('Key data', 'Dados principais')} asOf={d.pl_date}>
          <KV rows={[[L('Net assets', 'Patrimônio líquido'), d.pl != null ? `R$ ${big(d.pl)}` : '—', C.amber], [L('Benchmark index', 'Índice de referência'), '—'], [L('Management fee', 'Taxa de administração'), '—'],
            [L('Target investors', 'Público-alvo'), ev(d.audience)], [L('Adapted to CVM Res. 175', 'Adaptado à Res. CVM 175'), D(d.adapted_175)]]} />
        </Panel>
      </div>}
      {tab === 1 && <Panel title={L('Registry', 'Cadastro')}>
        <KV cols={2} rows={[[L('Name', 'Nome'), S(d.name)], [L('Trading name', 'Nome de pregão'), S(d.trading_name)], [L('Class CNPJ', 'CNPJ da classe'), S(d.cnpj)], [L('Fund CNPJ', 'CNPJ do fundo'), S(d.fund_cnpj)],
          [L('Status', 'Situação'), ev(d.status)], [L('Registration date', 'Data de registro'), D(d.registered)], [L('Adapted to CVM Res. 175', 'Adaptado à Res. CVM 175'), D(d.adapted_175)],
          [L('Fiscal year end', 'Fim do exercício social'), dayMonth(d.fy_end)], [L('Administrator', 'Administrador'), S(d.admin)], [L('Administrator CNPJ', 'CNPJ do administrador'), S(d.admin_cnpj)],
          [L('Manager', 'Gestor'), S(d.manager)], [L('Custodian', 'Custodiante'), S(d.custodian)], [L('Auditor', 'Auditor'), S(d.auditor)], [L('Officer in charge', 'Diretor responsável'), S(d.director)]]} />
      </Panel>}
    </FnScreen>
  )
}

// ---------------- SEC (BDR subjacente / ETF EUA) ----------------
function secRows(u: any): [string, React.ReactNode, string?][] {
  const ann = (u.filings || []).find((f: any) => ['10-K', '20-F', '40-F', 'N-CSR'].includes(f.form))
  return [[L('Registrant', 'Registrante'), S(u.sec_name || u.name)], ['CIK', S(u.cik)], ...(u.sic ? [[L('Industry (SIC)', 'Indústria (SIC)'), `${u.sic}${u.sic_desc ? ` · ${u.sic_desc}` : ''}`]] as [string, string][] : []),
    [L('Incorporated in', 'Constituída em'), S(u.state_inc)], [L('Fiscal year end', 'Fim do exercício fiscal'), u.fy_end ? fyEnd(u.fy_end) : '—'], [L('Address', 'Endereço'), S(u.address)],
    ...(ann ? [[L('Latest annual report', 'Último relatório anual'), `${ann.form} · ${D(ann.date)}`]] as [string, string][] : []),
    ...(u.former?.length ? [[L('Former names', 'Nomes anteriores'), u.former.join('; ')]] as [string, string][] : [])]
}

// ---------------- BDR ----------------
function BDR({ d, ticker }: { d: any; ticker: string }) {
  const [tab, setTab] = useState(0)
  const u = d.underlying
  const divs: any[] = d.divs || []
  const d12 = divs.filter(x => x.ex && x.ex >= isoMinus(new Date().toISOString().slice(0, 10), 0, 0, 1)).reduce((a, x) => a + (x.rate || 0), 0)
  const note = L(`Distributions are the announced cash amounts per BDR, in R$. The underlying company is matched by its registered name; — when there is no unambiguous match. The BDR-to-share ratio is not available, so it shows —. Distributions 12m = sum of amounts with ex-date in the last 12 months.`,
    `Os proventos são os valores em dinheiro anunciados por BDR, em R$. A empresa subjacente é identificada pela razão social; — quando não há correspondência única. A proporção BDR/ação não está disponível, por isso aparece como —. Proventos 12m = soma dos valores com data ex nos últimos 12 meses.`)
  const usLink = u?.des ? <a className="underline" style={{ color: C.amber }} href={href(`/des/${u.des}/`)}>{u.des}</a> : u?.tickers?.length ? u.tickers.join(', ') : '—'
  return (
    <FnScreen code="DES" ticker={ticker} title={TITLE(d)} tabs={[L('Profile', 'Perfil'), L('Distributions', 'Proventos'), L('Registry', 'Cadastro')]} tab={tab} setTab={setTab} note={note}>
      {tab === 0 && <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <Panel title={L('BDR profile', 'Perfil do BDR')}>
          <KV rows={[[L('Company', 'Empresa'), S(d.name)], [L('Trading name', 'Nome de pregão'), S(d.trading_name)], ['ISIN', S(d.isin)], [L('Listed on the exchange', 'Listado na bolsa desde'), D(d.listed)],
            [L('Depositary institution', 'Instituição depositária'), S(d.bookkeeper)], [L('BDR/share ratio', 'Proporção BDR/ação'), '—'], [L('Website', 'Site'), site(d.website)],
            [L('Distributions 12m (R$/BDR)', 'Proventos 12m (R$/BDR)'), divs.length ? nf(d12, 4) : '—', C.amber], [L('Last distribution', 'Último provento'), divs[0] ? `R$ ${nf(divs[0].rate, 4)} · ex ${D(divs[0].ex)}` : '—']]} />
        </Panel>
        <PricePanel ticker={ticker} ccy="R$" />
        <Panel title={L('Underlying company', 'Empresa subjacente')}>
          <KV rows={u ? [[L('US ticker', 'Ticker nos EUA'), usLink, C.amber], [L('Exchange', 'Bolsa'), u.exchanges?.length ? u.exchanges.join(', ') : '—'], ...secRows(u)] : [[L('US ticker', 'Ticker nos EUA'), '—'], [L('Registrant', 'Registrante'), '—']]} />
        </Panel>
      </div>}
      {tab === 1 && <Panel title={L('Cash distributions (R$ per BDR)', 'Proventos em dinheiro (R$ por BDR)')}>
        {divs.length ? <Grid maxH={560} cols={[{ k: 'ex', label: L('Ex-date', 'Data ex'), fmt: v => D(v) }, { k: 'pay', label: L('Payment', 'Pagamento'), fmt: v => D(v) }, { k: 'approved', label: L('Approved', 'Aprovação'), fmt: v => D(v) },
          { k: 'label', label: L('Type', 'Tipo'), fmt: v => ev(v) }, { k: 'rate', label: L('R$ per BDR', 'R$ por BDR'), align: 'r', fmt: v => nf(v, 6) }, { k: 'ref', label: L('Period', 'Referência'), fmt: v => refEN(v) }]} rows={divs} />
          : <div className="p-3 text-[12px]" style={{ color: C.muted }}>—</div>}
      </Panel>}
      {tab === 2 && <Panel title={L('Registry', 'Cadastro')}>
        <KV cols={2} rows={[[L('Company', 'Empresa'), S(d.name)], [L('Trading name', 'Nome de pregão'), S(d.trading_name)], [L('Issuer code', 'Código do emissor'), S(d.issuer_code)], ['ISIN', S(d.isin)],
          [L('Market', 'Mercado'), S(d.market)], [L('Listed on the exchange', 'Listado na bolsa desde'), D(d.listed)], [L('Depositary institution', 'Instituição depositária'), S(d.bookkeeper)], [L('Website', 'Site'), site(d.website)],
          ...(u ? [[L('US ticker', 'Ticker nos EUA'), usLink], ...secRows(u)] as [string, React.ReactNode][] : [])]} />
      </Panel>}
    </FnScreen>
  )
}

// ---------------- ETF EUA ----------------
const FORM_EN: Record<string, [string, string]> = {
  'N-CSR': ['Annual shareholder report', 'Relatório anual aos cotistas'], 'N-CSRS': ['Semi-annual shareholder report', 'Relatório semestral aos cotistas'],
  'NPORT-P': ['Monthly portfolio holdings', 'Carteira mensal'], '497K': ['Summary prospectus', 'Prospecto resumido'], '485BPOS': ['Prospectus update', 'Atualização do prospecto'],
  '497': ['Prospectus supplement', 'Suplemento do prospecto'], 'DEF 14A': ['Proxy statement', 'Convocação de assembleia'], 'N-CEN': ['Annual census report', 'Relatório censitário anual'],
  '24F-2NT': ['Annual fee notice', 'Aviso anual de taxas'], '10-K': ['Annual report', 'Relatório anual'], '10-Q': ['Quarterly report', 'Relatório trimestral'], '8-K': ['Current report', 'Fato relevante'],
}
function ETFUS({ d, ticker }: { d: any; ticker: string }) {
  const note = L(`The registrant is the trust that issues the ETF; one trust can issue many ETFs, so registrant fields are shared. The latest filing of each type is shown. Expense ratio and benchmark index are not available, so they show —.`,
    `O registrante é o trust que emite o ETF; um trust pode emitir vários ETFs, então os campos do registrante são compartilhados. Mostra o registro mais recente de cada tipo. Taxa de administração e índice de referência não estão disponíveis, por isso aparecem como —.`)
  const fil: any[] = d.filings || []
  return (
    <FnScreen code="DES" ticker={ticker} title={TITLE(d)} note={note}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <Panel title={L('Fund profile', 'Perfil do fundo')}>
          <KV rows={[[L('Ticker', 'Ticker'), short(ticker), C.amber], ...secRows(d), ...(d.series_id ? [[L('Series ID', 'ID da série'), d.series_id], [L('Class ID', 'ID da classe'), S(d.class_id)]] as [string, string][] : []),
            [L('Expense ratio', 'Taxa de administração'), '—'], [L('Benchmark index', 'Índice de referência'), '—']]} />
        </Panel>
        <PricePanel ticker={ticker} ccy="US$" />
        <Panel title={L('Latest filings', 'Registros mais recentes')}>
          {fil.length ? <Grid cols={[{ k: 'date', label: L('Date', 'Data'), fmt: v => D(v) }, { k: 'form', label: L('Form', 'Formulário') }, { k: 'desc', label: L('Description', 'Descrição') }]} rows={fil.map(f => ({ ...f, desc: FORM_EN[f.form] ? (pt() ? FORM_EN[f.form][1] : FORM_EN[f.form][0]) : '—' }))} />
            : <div className="p-3 text-[12px]" style={{ color: C.muted }}>—</div>}
        </Panel>
      </div>
    </FnScreen>
  )
}
