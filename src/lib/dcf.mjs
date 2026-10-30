// DCF educacional (fluxo de caixa livre da firma descontado pelo WACC). Módulo puro (.mjs) testado com `node --test`.

/** FCF = caixa operacional + capex (capex vem negativo da CVM/SEC). null se faltar um dos dois. */
export const fcfOf = (r) => (r && r.cfo != null && r.capex != null ? r.cfo + r.capex : null)

/** FCF dos últimos 4 trimestres (LTM); null sem os 4 completos */
export function fcfLtm(quarters) {
  const l4 = (quarters || []).slice(-4)
  if (l4.length < 4) return null
  const v = l4.map(fcfOf)
  return v.every(x => x != null) ? v.reduce((s, x) => s + x, 0) : null
}

/** WACC = E/(D+E)·Ke + D/(D+E)·Kd·(1−t), Ke = Rf + β·ERP (CAPM). Taxas em decimal. */
export function wacc({ rf, beta, erp, kd, tax, E, D }) {
  const ke = rf + beta * erp
  const tot = (E || 0) + (D || 0)
  if (!(tot > 0)) return { ke, w: ke, we: 1, wd: 0 }
  const we = (E || 0) / tot, wd = (D || 0) / tot
  return { ke, w: we * ke + wd * kd * (1 - tax), we, wd }
}

/**
 * Projeção em duas fases: crescimento g1 nos anos 1..n1, depois convergência linear até g∞ no ano n (n1 < n),
 * valor terminal de Gordon no ano n. Devolve fluxos, valores presentes e o EV; null se WACC ≤ g∞.
 */
export function dcf({ fcf0, g1, gT, w, n1 = 5, n = 10 }) {
  if (!(w > gT) || fcf0 == null) return null
  const years = []
  let f = fcf0, pv = 0
  for (let t = 1; t <= n; t++) {
    const g = t <= n1 ? g1 : g1 + (gT - g1) * (t - n1) / (n - n1)
    f = f * (1 + g)
    const df = Math.pow(1 + w, -t)
    years.push({ t, g, fcf: f, df, pv: f * df })
    pv += f * df
  }
  const tv = f * (1 + gT) / (w - gT), pvTv = tv * Math.pow(1 + w, -n)
  return { years, pvFcf: pv, tv, pvTv, ev: pv + pvTv, tvShare: pvTv / (pv + pvTv) }
}

/** valor por ação = (EV − dívida líquida − minoritários) / ações */
export function perShare(ev, { netdebt = 0, minority = 0, shares }) {
  if (ev == null || !(shares > 0)) return null
  return (ev - (netdebt || 0) - (minority || 0)) / shares
}

/** DCF reverso: o g1 que faz o valor por ação igualar o preço (bisseção em [−50%, +100%]); null fora do intervalo */
export function impliedG1(price, p, bal) {
  const f = (g) => { const r = dcf({ ...p, g1: g }); return r ? perShare(r.ev, bal) - price : NaN }
  let lo = -0.5, hi = 1.0, flo = f(lo), fhi = f(hi)
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2, fm = f(mid)
    if (fm * flo > 0) { lo = mid; flo = fm } else hi = mid
    if (hi - lo < 1e-7) break
  }
  return (lo + hi) / 2
}

/** tabela de sensibilidade: valor por ação para cada WACC × g∞ */
export function sensitivity(p, bal, ws, gs) {
  return ws.map(w => gs.map(g => { const r = dcf({ ...p, w, gT: g }); return r ? perShare(r.ev, bal) : null }))
}
