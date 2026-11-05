// FUND: lógica pura (testada em fund.test.mjs). Só deriva o que é aritmética de valores informados;
// nunca estima: falta um insumo → null ('—' na tela).
export const FLOW = ['revenue', 'cost', 'gross', 'ebit', 'da', 'ebitda', 'fin', 'pretax', 'net', 'cfo', 'capex', 'fcf']
export const BAL = ['assets', 'cash', 'stinv', 'debt', 'netdebt', 'minority', 'equity']

const ym = (p) => +p.slice(0, 4) * 12 + (+p.slice(5, 7) - 1)
const ok = (v) => v != null && Number.isFinite(+v)

/** copia as linhas, marca derivadas em r._d e acrescenta fcf. Lucro bruto = receita − custo (só sem banco e com os dois informados);
 *  no anual, D&A = soma dos 4 trimestres do exercício quando todos informados, e EBITDA = EBIT + D&A. */
export function prepare(fund) {
  const bank = !!fund?.bank_format
  const prep = (rows) => (rows || []).map((r0) => {
    const r = { ...r0, _d: [] }
    if (!bank && !ok(r.gross) && ok(r.revenue) && ok(r.cost)) { r.gross = r.revenue - r.cost; r._d.push('gross') }
    r.fcf = ok(r.cfo) && ok(r.capex) ? r.cfo + r.capex : null
    return r
  })
  const annual = prep(fund?.annual), quarterly = prep(fund?.quarterly)
  const byYm = new Map(quarterly.map((q) => [ym(q.period), q]))
  for (const a of annual) {
    if (bank || ok(a.da)) continue
    const qs = [0, 3, 6, 9].map((k) => byYm.get(ym(a.period) - k))
    if (qs.every((q) => q && ok(q.da))) {
      a.da = qs.reduce((s, q) => s + q.da, 0); a._d.push('da')
      if (!ok(a.ebitda) && ok(a.ebit)) { a.ebitda = a.ebit + a.da; a._d.push('ebitda') }
    }
  }
  return { annual, quarterly, bank }
}

/** os 4 últimos trimestres consecutivos (ou null) */
export function last4(q) {
  if (!q || q.length < 4) return null
  const l = q.slice(-4)
  return ym(l[3].period) - ym(l[0].period) === 9 ? l : null
}
/** TTM: fluxos somados nos 4 últimos trimestres (todos informados), saldos do último */
export function ttm(q) {
  const l = last4(q); if (!l) return null
  const r = { period: l[3].period, _d: [], _ttm: true }
  for (const k of FLOW) r[k] = l.every((x) => ok(x[k])) ? l.reduce((s, x) => s + x[k], 0) : null
  for (const k of BAL) r[k] = l[3][k] ?? null
  r._d = FLOW.filter((k) => l.some((x) => (x._d || []).includes(k)) && ok(r[k]))
  return r
}
/** razões da linha; ROE trimestral anualizado ×4; roeTtm por trimestre quando há os 4 anteriores */
export function ratios(rows, per) {
  return rows.map((r, i) => {
    const o = { ...r }
    o.mge = ok(r.ebitda) && r.revenue ? (r.ebitda / r.revenue) * 100 : null
    o.mg = ok(r.net) && r.revenue ? (r.net / r.revenue) * 100 : null
    o.roe = ok(r.net) && r.equity ? (r.net / r.equity) * 100 * (per === 'q' && !r._ttm ? 4 : 1) : null
    o.lev = ok(r.netdebt) && r.equity ? r.netdebt / r.equity : null
    if (per === 'q' && !r._ttm) { const l = last4(rows.slice(0, i + 1).filter((x) => !x._ttm)); o.roeTtm = l && l.every((x) => ok(x.net)) && r.equity ? (l.reduce((s, x) => s + x.net, 0) / r.equity) * 100 : null }
    if (r._ttm) o.roeTtm = o.roe
    return o
  })
}
/** variação % do último período contra o mesmo período um ano antes (anual: ano anterior) */
export function yoy(rows, k) {
  if (!rows?.length) return null
  const cur = rows[rows.length - 1], prev = rows.find((r) => ym(r.period) === ym(cur.period) - 12)
  if (!prev || !ok(cur[k]) || !ok(prev[k]) || prev[k] === 0) return null
  return ((cur[k] - prev[k]) / Math.abs(prev[k])) * 100
}
/** trimestre/ano com resultado antes do IR muito acima do EBIT (ganho não operacional: venda de ativos, reavaliação de participações) */
export const isOneOff = (r) => ok(r.pretax) && ok(r.ebit) && r.ebit > 0 && r.pretax >= 1.5 * r.ebit
/** separa as linhas da tabela em visíveis e sem nenhum valor */
export function splitRows(defs, cols) {
  const shown = [], hidden = []
  for (const d of defs) (cols.some((c) => ok(c[d[0]])) ? shown : hidden).push(d)
  return { shown, hidden }
}
