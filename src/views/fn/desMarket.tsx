'use client'
// DES de índices, moedas, commodities e cripto: cadastro do tickers.json + estatísticas da série diária (lib/marketStats).
// Campo sem dado → "—"; nenhum texto descritivo é gerado.
import React, { useMemo, useState } from 'react'
import { FnScreen, Panel, Grid, KV, Loading, C, nf, pf, big, dBR, clr, short, useJSON, isoMinus } from '../../components/fn/kit'
import FnChart from '../../components/fn/FnChart'
import { usePrices } from './tech'
import { L } from './desLabels'
import { TICKERS } from '../../lib/universe'
import { marketStats } from '../../lib/marketStats.mjs'
import type { TickerMeta } from '../../lib/static'
import { safeUrl } from '../../lib/safe.mjs'

const CLASS: Record<string, [string, string]> = {
  index: ['Index', 'Índice'], fx: ['Currency pair', 'Par de moedas'], commodity: ['Commodity', 'Commodity'], crypto: ['Crypto asset', 'Criptoativo'],
}
const pc = (v?: number | null, d = 2) => v == null ? '—' : pf(v * 100, d)
const pcU = (v?: number | null, d = 2) => v == null ? '—' : pf(v * 100, d, false)
/** casas decimais pela magnitude (USD/JPY 150, EUR/USD 1,08, ARS/BRL 0,006) */
const dec = (v?: number | null) => v == null ? 2 : Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? (Math.abs(v) >= 10 ? 2 : 4) : 6

function quote(m: TickerMeta): string {
  if (m.class === 'fx') { const p = m.name.match(/^([A-Z]{3})\/([A-Z]{3})$/); return p ? L(`${p[2]} per 1 ${p[1]}`, `${p[2]} por 1 ${p[1]}`) : '—' }
  if (m.class === 'crypto') { const sym = m.ticker.replace(/-USD$/, ''); return m.currency ? L(`${m.currency} per 1 ${sym}`, `${m.currency} por 1 ${sym}`) : '—' }
  if (m.class === 'commodity') return m.unit || '—'
  return m.currency ? L(`Points (${m.currency})`, `Pontos (${m.currency})`) : L('Points', 'Pontos')
}

export const marketMeta = (ticker: string) => TICKERS.find(t => t.ticker.toUpperCase() === ticker.toUpperCase()) || null

export function DESMarket({ ticker }: { ticker: string }) {
  const m = marketMeta(ticker)!
  const { rows, err } = usePrices(ticker)
  const [tab, setTab] = useState(0)
  const crypto = m.class === 'crypto'
  const s = useMemo(() => rows ? marketStats(rows, crypto ? 365 : 252) : null, [rows, crypto])
  const tabs = [L('1 year', '1 ano'), L('5 years', '5 anos'), L('Full history', 'Histórico completo')]
  if (!rows || !s) return <FnScreen code="DES" ticker={ticker}><Loading err={err} /></FnScreen>
  const last = s.last, d = dec(last.close)
  const start = tab === 0 ? isoMinus(last.time, 0, 0, 1) : tab === 1 ? isoMinus(last.time, 0, 0, 5) : ''
  const shown = rows.filter(r => r.time > start)
  const co = !!m.close_only
  const R = s.returns
  return (
    <FnScreen code="DES" ticker={ticker} title={`${L('Description', 'Descrição')} — ${m.name}`} tabs={tabs} tab={tab} setTab={setTab} asOf={last.time}>
      <div className="grid gap-2 fn-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <div className="grid gap-2 content-start">
          <Panel title={tabs[tab]} asOf={last.time}>
            <FnChart height={190} panes={[{ series: [{ kind: 'area', data: shown.map(r => ({ time: r.time, value: r.close })), color: C.white, title: short(ticker), decimals: d }] }]} />
          </Panel>
          <Panel title={L('Price', 'Preço')}>
            <KV rows={[[L('Last', 'Último'), `${nf(last.close, d)} · ${dBR(last.time)}`, C.amber],
              [L('1-day change', 'Variação em 1 dia'), pc(s.chg1d), clr(s.chg1d)],
              [co ? L('52w high (close)', 'Máxima 52 sem. (fech.)') : L('52w high', 'Máxima 52 sem.'), s.hi ? `${nf(s.hi.v, d)} · ${dBR(s.hi.t)}` : '—'],
              [co ? L('52w low (close)', 'Mínima 52 sem. (fech.)') : L('52w low', 'Mínima 52 sem.'), s.lo ? `${nf(s.lo.v, d)} · ${dBR(s.lo.t)}` : '—']]} />
          </Panel>
        </div>
        <div className="grid gap-2 content-start">
          <Panel title={L('Profile', 'Perfil')}>
            <KV rows={[[L('Ticker', 'Ticker'), short(ticker), C.amber], [L('Name', 'Nome'), m.name], [L('Asset class', 'Classe'), m.class ? L(...CLASS[m.class]) : '—'],
              [L('Quote', 'Cotação'), quote(m)], ...(safeUrl(m.link) ? [[L('Exchange page', 'Página na bolsa'), <a key="l" className="underline" style={{ color: C.amber }} href={safeUrl(m.link)} target="_blank" rel="noopener noreferrer">{(m.link || "").replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>]] as [string, React.ReactNode][] : []),
              [L('Daily data', 'Dados diários'), co ? L('Close only', 'Só fechamento') : L('Open, high, low, close', 'Abertura, máxima, mínima, fechamento')],
              [L('History since', 'Histórico desde'), dBR(rows[0].time)], [L('Sessions', 'Pregões'), nf(rows.length, 0)]]} />
          </Panel>
          <Panel title={L('Returns', 'Retornos')} asOf={last.time}>
            <KV cols={2} rows={(['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const).map(k => [L(({ '1M': '1 month', '3M': '3 months', '6M': '6 months', YTD: 'Year to date', '1Y': '1 year', '3Y': '3 years', '5Y': '5 years' })[k], ({ '1M': '1 mês', '3M': '3 meses', '6M': '6 meses', YTD: 'No ano', '1Y': '1 ano', '3Y': '3 anos', '5Y': '5 anos' })[k]), pc(R[k]), clr(R[k])] as [string, string, string])} />
          </Panel>
          <Panel title={L('Risk — 1 year', 'Risco — 1 ano')}>
            <KV rows={[[L('Annualized volatility', 'Volatilidade anualizada'), pcU(s.vol)], [L('Max drawdown', 'Queda máxima'), pc(s.mdd), clr(s.mdd)]]} />
          </Panel>
        </div>
        <div className="grid gap-2 content-start">
          {crypto ? <CryptoPanel m={m} px={last.close} /> : m.ticker === '^BVSP' ? <IbovPanel /> : null}
          <Panel title={L('Calendar-year returns', 'Retornos por ano civil')}>
            {s.years.length ? <Grid maxH={crypto || m.ticker === '^BVSP' ? 200 : 420} cols={[{ k: 'y', label: L('Year', 'Ano') }, { k: 'r', label: L('Return', 'Retorno'), align: 'r', fmt: (v: number) => <span style={{ color: clr(v) }}>{pc(v)}</span> }]}
              rows={[...s.years].reverse().map(y => ({ y: y.ytd ? `${y.year} (${L('YTD', 'no ano')})` : String(y.year), r: y.ret }))} />
              : <div className="p-3 text-[12px]" style={{ color: C.muted }}>—</div>}
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}

/** dados de mercado da moeda (mesma tela do CRYP); só usa a moeda se o preço bate com a série (±20%) */
function CryptoPanel({ m, px }: { m: TickerMeta; px: number }) {
  const { data } = useJSON<any>('cryp.json')
  const sym = m.ticker.replace(/-USD$/, '')
  const c = (data?.coins || []).filter((x: any) => x.sym === sym).sort((a: any, b: any) => (a.rank ?? 1e9) - (b.rank ?? 1e9))[0]
  const ok = c && c.price > 0 && Math.abs(c.price / px - 1) < 0.2
  return (
    <Panel title={L('Market data', 'Dados de mercado')} asOf={data?.generated_at?.slice(0, 10)}>
      <KV rows={ok ? [[L('Market cap rank', 'Posição por valor de mercado'), c.rank ? `#${c.rank}` : '—'], [L('Market cap (US$)', 'Valor de mercado (US$)'), big(c.mcap)], [L('24h volume (US$)', 'Volume 24h (US$)'), big(c.vol)],
        [L('7-day change', 'Variação 7 dias'), c.ch7d == null ? '—' : pf(c.ch7d), clr(c.ch7d)], [L('30-day change', 'Variação 30 dias'), c.ch30d == null ? '—' : pf(c.ch30d), clr(c.ch30d)],
        [L('From all-time high', 'Distância da máxima histórica'), c.ath_pct == null ? '—' : pf(c.ath_pct), clr(c.ath_pct)]]
        : [[L('Market cap (US$)', 'Valor de mercado (US$)'), '—'], [L('24h volume (US$)', 'Volume 24h (US$)'), '—']]} />
    </Panel>
  )
}

/** carteira teórica do Ibovespa (mesmo arquivo da tela de composição) */
function IbovPanel() {
  const { data: u } = useJSON<any>('universe.json')
  const comp: any[] = u?.components || []
  const top = [...comp].sort((a, b) => b.weight - a.weight).slice(0, 8)
  const dp = (u?.date_portfolio || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  return (
    <Panel title={L('Theoretical portfolio', 'Carteira teórica')} asOf={dp ? `20${dp[3]}-${dp[2]}-${dp[1]}` : null}>
      <KV rows={[[L('Constituents', 'Ações na carteira'), comp.length ? nf(comp.length, 0) : '—'], [L('Top 8 weight', 'Peso das 8 maiores'), top.length ? pf(top.reduce((a, b) => a + b.weight, 0), 1, false) : '—']]} />
      {top.length > 0 && <Grid cols={[{ k: 'cod', label: L('Ticker', 'Ticker') }, { k: 'name', label: L('Name', 'Nome') }, { k: 'weight', label: L('Weight', 'Peso'), align: 'r', fmt: (v: number) => pf(v, 2, false) }]} rows={top} />}
    </Panel>
  )
}
