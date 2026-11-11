'use client'
import React, { useMemo, useState } from 'react'
import FnChart from '@/components/fn/FnChart'
import { C, useJSON, FnScreen, Panel, Grid, useDesktop, Loading } from '@/components/fn/kit'
import { lang } from '@/lib/settings'
import { tc } from '@/lib/themeRuntime'
import { downloadCSV, CsvBtn } from './v4util'

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)
const fuelNum = (v: any, d = 3) => {
  if (v == null || v === '' || !Number.isFinite(+v)) return '—'
  return (+v).toLocaleString(lang() === 'pt' ? 'pt-BR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const fuelChg = (v: any, d = 3) => {
  if (v == null || !Number.isFinite(+v)) return '—'
  const s = fuelNum(Math.abs(v), d)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`
}
const priceClr = (v: any) => (v == null || !Number.isFinite(+v) || v === 0 ? C.muted : v > 0 ? C.down : C.up)

const FUEL_LAB: Record<string, [string, string]> = {
  gasoline: ['Gasoline', 'Gasolina'],
  gas_add: ['Additized gasoline', 'Gasolina aditivada'],
  ethanol: ['Ethanol', 'Etanol'],
  diesel_s10: ['Diesel S-10', 'Diesel S-10'],
  diesel_s500: ['Diesel S-500', 'Diesel S-500'],
  diesel: ['Diesel', 'Diesel'],
  gnv: ['Natural gas (vehicle)', 'GNV'],
  glp: ['LPG (13 kg)', 'GLP (13 kg)'],
}
const REG_LAB: Record<string, [string, string]> = {
  N: ['North', 'Norte'],
  NE: ['Northeast', 'Nordeste'],
  CO: ['Central-West', 'Centro-Oeste'],
  SE: ['Southeast', 'Sudeste'],
  S: ['South', 'Sul'],
  BR: ['Brazil', 'Brasil'],
}
const ST_LAB: Record<string, [string, string]> = {
  AC: ['Acre', 'Acre'], AL: ['Alagoas', 'Alagoas'], AM: ['Amazonas', 'Amazonas'], AP: ['Amapá', 'Amapá'],
  BA: ['Bahia', 'Bahia'], CE: ['Ceará', 'Ceará'], DF: ['Federal District', 'Distrito Federal'],
  ES: ['Espírito Santo', 'Espírito Santo'], GO: ['Goiás', 'Goiás'], MA: ['Maranhão', 'Maranhão'],
  MG: ['Minas Gerais', 'Minas Gerais'], MS: ['Mato Grosso do Sul', 'Mato Grosso do Sul'],
  MT: ['Mato Grosso', 'Mato Grosso'], PA: ['Pará', 'Pará'], PB: ['Paraíba', 'Paraíba'],
  PE: ['Pernambuco', 'Pernambuco'], PI: ['Piauí', 'Piauí'], PR: ['Paraná', 'Paraná'],
  RJ: ['Rio de Janeiro', 'Rio de Janeiro'], RN: ['Rio Grande do Norte', 'Rio Grande do Norte'],
  RO: ['Rondônia', 'Rondônia'], RR: ['Roraima', 'Roraima'], RS: ['Rio Grande do Sul', 'Rio Grande do Sul'],
  SC: ['Santa Catarina', 'Santa Catarina'], SE: ['Sergipe', 'Sergipe'], SP: ['São Paulo', 'São Paulo'],
  TO: ['Tocantins', 'Tocantins'],
}
const geoName = (geo: string) => {
  const p = REG_LAB[geo] || ST_LAB[geo]
  return p ? L(p[0], p[1]) : geo
}
const fuelName = (id: string) => { const p = FUEL_LAB[id]; return p ? L(p[0], p[1]) : id }

export function FUELView() {
  const { data: d, err } = useJSON<any>('fuel.json')
  const [fuel, setFuel] = useState<string>('')
  const [geo, setGeo] = useState('BR')
  const [more, setMore] = useState(false)
  const desk = useDesktop()
  const title = L('Pump fuel prices', 'Preços de combustíveis nas bombas')
  const fuels: { id: string; unit: string }[] = d?.fuels || []
  const fid = fuels.some(x => x.id === fuel) ? fuel : (fuels[0]?.id || '')
  const rows = useMemo(() => {
    if (!d || d.unavailable) return []
    return (d.rows || []).filter((r: any) => r.fuel === fid).map((r: any) => ({
      ...r,
      label: geoName(r.geo),
      pct_w: r.chg_w != null && r.prev ? (r.chg_w / r.prev) * 100 : null,
      pct_12m: r.chg_12m != null && r.last != null ? (r.chg_12m / (r.last - r.chg_12m)) * 100 : null,
    }))
  }, [d, fid])
  if (!d || d.unavailable) return <FnScreen code="FUEL" title={title} ownTitle><Loading err={err || (d?.unavailable ? 'unavailable' : null)} /></FnScreen>
  if (!fuels.length) return <FnScreen code="FUEL" title={title} ownTitle><div className="p-2 text-[12px]" style={{ color: C.muted }}>{L('No weekly averages available.', 'Nenhuma média semanal disponível.')}</div></FnScreen>

  const sel = rows.find((r: any) => r.geo === geo) || rows.find((r: any) => r.geo === 'BR') || rows[0]
  const g = sel?.geo || 'BR'
  const unit = fuels.find(x => x.id === fid)?.unit || sel?.unit || 'R$/L'
  const weeks: string[] = d.weeks || []
  const hist: (number | null)[] = (d.hist?.[fid]?.[g] || []) as (number | null)[]
  const pumpSeries = weeks.map((t, i) => hist[i] == null ? null : ({ time: t, value: hist[i] as number })).filter(Boolean) as { time: string; value: number }[]
  const brentSeries = weeks.map((t, i) => d.brent_brl?.[i] == null ? null : ({ time: t, value: d.brent_brl[i] as number })).filter(Boolean) as { time: string; value: number }[]
  const lastBrent = sel?.brent ?? (d.brent_brl || []).filter((x: any) => x != null).slice(-1)[0]
  const loc = lang() === 'pt' ? 'pt-BR' : 'en-US'

  const cols = [
    { k: 'label', label: L('Area', 'Área'), color: () => C.amber },
    { k: 'week', label: L('Week', 'Semana'), align: 'r' as const, fmt: (v: string) => v ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(2, 4) : '—' },
    { k: 'last', label: L('Last', 'Último'), align: 'r' as const, fmt: (v: any) => fuelNum(v, 3) },
    { k: 'prev', label: L('Previous', 'Anterior'), align: 'r' as const, fmt: (v: any) => fuelNum(v, 3) },
    { k: 'chg_w', label: L('Week chg.', 'Var. semana'), align: 'r' as const, fmt: (v: any) => fuelChg(v, 3), color: priceClr },
    { k: 'pct_w', label: L('Week %', 'Var. % sem.'), align: 'r' as const, fmt: (v: any) => v == null ? '—' : fuelChg(v, 1) + '%', color: priceClr },
    { k: 'chg_12m', label: L('12m chg.', 'Var. 12m'), align: 'r' as const, fmt: (v: any) => fuelChg(v, 3), color: priceClr },
    { k: 'pct_12m', label: L('12m %', 'Var. % 12m'), align: 'r' as const, fmt: (v: any) => v == null ? '—' : fuelChg(v, 1) + '%', color: priceClr },
    { k: 'unit', label: L('Unit', 'Unidade'), color: () => C.muted },
    { k: 'brent', label: L('Oil (R$/bbl)', 'Petróleo (R$/bbl)'), align: 'r' as const, fmt: (v: any) => fuelNum(v, 2) },
  ]
  const showCols = (desk || more) ? cols : cols.filter(c => ['label', 'last', 'chg_w'].includes(c.k))

  const source = L(
    'Official weekly pump-price survey. Oil and the exchange rate are published market series used only for comparison.',
    'Pesquisa oficial semanal de preços nas bombas. Petróleo e câmbio são séries de mercado já publicadas, usadas só para comparação.',
  )
  const note = L(
    'Each figure is the simple average of survey prices collected in that week (Sunday to Saturday, dated by the Saturday). A rise in the pump price is shown in red and a fall in green. The oil series is the weekly last close converted into reais; it is not a pump price and is blank when either series is missing.',
    'Cada valor é a média simples dos preços da pesquisa coletados naquela semana (domingo a sábado, datada pelo sábado). Alta no preço da bomba aparece em vermelho e queda em verde. A série de petróleo é o último fechamento da semana convertido em reais; não é um preço de bomba e fica em branco quando falta uma das séries.',
  )

  const exp = () => {
    const head = [L('Fuel', 'Combustível'), L('Area', 'Área'), L('Week', 'Semana'), L('Last', 'Último'), L('Previous', 'Anterior'), L('Week change', 'Var. semana'), L('12m change', 'Var. 12m'), L('Unit', 'Unidade'), L('Oil (R$/bbl)', 'Petróleo (R$/bbl)')]
    const body = rows.map((r: any) => [fuelName(fid), r.label, r.week, r.last, r.prev, r.chg_w, r.chg_12m, r.unit, r.brent])
    downloadCSV('fuel-prices.csv', head, body)
  }

  return (
    <FnScreen code="FUEL" title={title} ownTitle wrap source={source} note={note} asOf={d.date}
      right={<span data-fuel-csv className="flex flex-wrap items-center gap-1"><CsvBtn onClick={exp} /></span>}>
      <div className="flex flex-wrap items-end gap-2 px-1 pb-1">
        <div className="flex flex-wrap items-center gap-1 text-[12px]">
          <span style={{ color: C.muted }}>{L('Fuel', 'Combustível')}</span>
          {fuels.map(x => (
            <button key={x.id} type="button" data-fuel-id={x.id} onClick={() => setFuel(x.id)}
              className="px-2 py-[1px] text-[12px] border" style={{ borderColor: C.line, background: fid === x.id ? C.amber : 'transparent', color: fid === x.id ? tc('#000') : C.amber }}>
              {fuelName(x.id)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 fn-grid min-w-0 w-full max-w-full" style={{ gridTemplateColumns: desk ? '1.15fr 1fr' : 'minmax(0,1fr)' }}>
        <div className="flex flex-col gap-2 min-w-0">
          {!desk && !more && <div data-fuel-hint className="px-2 pt-1 text-[11px]" style={{ color: C.muted }}>{L('Showing area, last price and weekly change.', 'Mostrando área, último preço e variação semanal.')}</div>}
          <Panel title={`${fuelName(fid)} · ${unit}`}>
            <div data-fuel-table className="min-w-0 w-full overflow-x-auto">
              <Grid stickyFirst onRow={(r: any) => setGeo(r.geo)}
                rowStyle={(r: any) => r.geo === g ? { background: tc('#1a1205') } : undefined}
                cols={showCols} rows={rows} />
            </div>
          </Panel>
          {!desk && <button data-fuel-more type="button" className="px-2 py-[1px] text-[11px] border self-start" style={{ borderColor: C.line, color: C.amber }} onClick={() => setMore(!more)}>{more ? L('Fewer columns', 'Menos colunas') : L('More columns', 'Mais colunas')}</button>}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <Panel title={L('Latest week', 'Última semana')}>
            <div data-fuel-kpis className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 py-1 text-[12px]">
              <div style={{ color: C.muted }}>{L('Area', 'Área')}</div><div style={{ color: C.amber }}>{sel ? geoName(sel.geo) : '—'}</div>
              <div style={{ color: C.muted }}>{L('Pump price', 'Preço na bomba')}</div><div>{sel ? `${fuelNum(sel.last, 3)} ${unit}` : '—'}</div>
              <div style={{ color: C.muted }}>{L('Weekly change', 'Variação semanal')}</div><div style={{ color: priceClr(sel?.chg_w) }}>{sel ? fuelChg(sel.chg_w, 3) : '—'}</div>
              <div style={{ color: C.muted }}>{L('12-month change', 'Variação em 12 meses')}</div><div style={{ color: priceClr(sel?.chg_12m) }}>{sel ? fuelChg(sel.chg_12m, 3) : '—'}</div>
              <div style={{ color: C.muted }}>{L('Oil in reais', 'Petróleo em reais')}</div><div>{fuelNum(lastBrent, 2)} {L('R$/bbl', 'R$/bbl')}</div>
            </div>
          </Panel>
          <Panel title={`${fuelName(fid)} — ${sel ? geoName(sel.geo) : geoName('BR')}`}>
            <FnChart height={desk ? 420 : 300} alwaysLegend panes={[
              { stretch: 3, series: [{ kind: 'line', data: pumpSeries, color: C.amber, title: `${fuelName(fid)} (${unit})`, decimals: 3, locale: loc }] },
              { stretch: 2, series: [{ kind: 'line', data: brentSeries, color: C.cyan, title: L('Oil (R$/bbl)', 'Petróleo (R$/bbl)'), decimals: 2, locale: loc }] },
            ]} />
          </Panel>
        </div>
      </div>
    </FnScreen>
  )
}
