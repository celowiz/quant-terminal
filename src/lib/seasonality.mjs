// Sazonalidade (SEAH): retornos mensais, semanais (semana ISO) e por dia da semana a partir dos fechamentos diários.
// Regras comuns: o período corrente incompleto (MTD/WTD) fica marcado e, por padrão, fora das estatísticas;
// estatística sem observação = null ('—' na tela); desvio-padrão só com n ≥ 2. Nada é preenchido com zero.

/** faixa neutra (cinza) em torno de zero, em % */
export const NEAR0 = 0.05

const iso = d => d.toISOString().slice(0, 10)
const utc = s => new Date(s + 'T00:00:00Z')

/** último dia de negociação esperado do mês (m = 1..12): último dia útil (seg–sex) ou último dia corrido (`allDays`, cripto) */
export function monthEnd(y, m, allDays = false) {
  const d = new Date(Date.UTC(y, m, 0))
  if (!allDays) while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return iso(d)
}

/** semana ISO 8601 (segunda a domingo; semana 1 contém a primeira quinta-feira do ano) */
export function isoWeek(s) {
  const d = utc(s)
  const dow = (d.getUTCDay() + 6) % 7 // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow + 3) // quinta-feira da mesma semana
  const y = d.getUTCFullYear()
  return { y, w: Math.floor((d.getTime() - Date.UTC(y, 0, 1)) / 864e5 / 7) + 1 }
}

/** último dia esperado da semana ISO de `s`: sexta (ou domingo, `allDays`) */
export function weekEnd(s, allDays = false) {
  const d = utc(s)
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow + (allDays ? 6 : 4))
  return iso(d)
}

/** n, média, mediana, desvio-padrão amostral (n ≥ 2) e % positivos; tudo null sem observações */
export function stats(vals) {
  const x = vals.filter(v => v != null && Number.isFinite(v))
  const n = x.length
  if (!n) return { n: 0, mean: null, median: null, sd: null, pos: null, min: null, max: null }
  const mean = x.reduce((s, v) => s + v, 0) / n
  const s = x.slice().sort((a, b) => a - b)
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
  const sd = n >= 2 ? Math.sqrt(x.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : null
  return { n, mean, median, sd, pos: (x.filter(v => v > 0).length / n) * 100, min: s[0], max: s[n - 1] }
}

const clean = rows => (rows || []).filter(r => r && r.time && Number.isFinite(r.close) && r.close > 0)

/** retornos período-a-período a partir do último fechamento de cada chave (o primeiro período serve de base) */
function periodReturns(rows, keyOf) {
  const ends = []
  for (const r of clean(rows)) {
    const k = keyOf(r.time)
    const last = ends[ends.length - 1]
    if (last && last.k === k) { last.close = r.close; last.date = r.time } else ends.push({ k, close: r.close, date: r.time })
  }
  const out = []
  for (let i = 1; i < ends.length; i++) out.push({ k: ends[i].k, date: ends[i].date, r: (ends[i].close / ends[i - 1].close - 1) * 100 })
  return { ends, out }
}

/** índices do melhor e do pior valor (≥ 2 valores não nulos) */
export function bestWorst(vals) {
  let b = -1, w = -1, n = 0
  vals.forEach((v, i) => { if (v == null) return; n++; if (b < 0 || v > vals[b]) b = i; if (w < 0 || v < vals[w]) w = i })
  return n >= 2 && b !== w ? { best: b, worst: w } : { best: -1, worst: -1 }
}

/**
 * Mapa mensal. rows = [{time:'YYYY-MM-DD', close}] (ajustados, ordem crescente).
 * Retorna anos (decrescentes) com 12 células {r, part} (part 'mtd' = mês corrente incompleto), retorno do ano composto
 * (tag 'ytd' no ano corrente incompleto, 'partial' no primeiro ano sem janeiro), estatísticas por mês e da coluna Ano.
 */
export function monthly(rows, { allDays = false, includePartial = false } = {}) {
  const { ends, out } = periodReturns(rows, t => t.slice(0, 7))
  if (!out.length) return { years: [], months: Array.from({ length: 12 }, () => stats([])), year: stats([]), complete: 0, partial: null, asOf: ends.length ? ends[ends.length - 1].date : null }
  const lastDate = ends[ends.length - 1].date
  const lastK = out[out.length - 1].k
  const ly = +lastK.slice(0, 4), lm = +lastK.slice(5, 7)
  const mtd = lastDate < monthEnd(ly, lm, allDays)
  const byY = new Map()
  for (const o of out) {
    const y = +o.k.slice(0, 4), m = +o.k.slice(5, 7)
    if (!byY.has(y)) byY.set(y, Array(12).fill(null))
    byY.get(y)[m - 1] = { r: o.r, part: mtd && o.k === lastK ? 'mtd' : null, date: o.date }
  }
  const firstY = +out[0].k.slice(0, 4), firstM = +out[0].k.slice(5, 7)
  const years = Array.from(byY.keys()).sort((a, b) => b - a).map(y => {
    const cells = byY.get(y)
    const have = cells.filter(Boolean)
    const ret = have.length ? (have.reduce((p, c) => p * (1 + c.r / 100), 1) - 1) * 100 : null
    const tag = y === firstY && firstM > 1 ? 'partial' : y === ly && (lm < 12 || mtd) ? 'ytd' : null
    const bw = bestWorst(cells.map(c => (c && !c.part ? c.r : null)))
    return { y, cells, ret, tag, best: bw.best, worst: bw.worst }
  })
  const use = c => c && (includePartial || !c.part)
  const months = Array.from({ length: 12 }, (_, m) => stats(years.map(Y => (use(Y.cells[m]) ? Y.cells[m].r : null))))
  const year = stats(years.filter(Y => !Y.tag).map(Y => Y.ret))
  const avgBW = bestWorst(months.map(s => s.mean))
  return { years, months, year, best: avgBW.best, worst: avgBW.worst, complete: out.length - (mtd ? 1 : 0), partial: mtd ? lastK : null, asOf: lastDate }
}

/** Semanal (semana ISO 1..53): mesma estrutura de `monthly`, sem coluna Ano. part 'wtd' = semana corrente incompleta. */
export function weekly(rows, { allDays = false, includePartial = false } = {}) {
  const key = t => { const { y, w } = isoWeek(t); return `${y}-${String(w).padStart(2, '0')}` }
  const { ends, out } = periodReturns(rows, key)
  if (!out.length) return { years: [], weeks: Array.from({ length: 53 }, () => stats([])), complete: 0, partial: null, best: -1, worst: -1 }
  const lastDate = ends[ends.length - 1].date
  const lastK = out[out.length - 1].k
  const wtd = lastDate < weekEnd(lastDate, allDays)
  const byY = new Map()
  for (const o of out) {
    const y = +o.k.slice(0, 4), w = +o.k.slice(5)
    if (!byY.has(y)) byY.set(y, Array(53).fill(null))
    byY.get(y)[w - 1] = { r: o.r, part: wtd && o.k === lastK ? 'wtd' : null, date: o.date }
  }
  const years = Array.from(byY.keys()).sort((a, b) => b - a).map(y => {
    const cells = byY.get(y)
    const bw = bestWorst(cells.map(c => (c && !c.part ? c.r : null)))
    return { y, cells, best: bw.best, worst: bw.worst }
  })
  const use = c => c && (includePartial || !c.part)
  const weeks = Array.from({ length: 53 }, (_, i) => stats(years.map(Y => (use(Y.cells[i]) ? Y.cells[i].r : null))))
  const avgBW = bestWorst(weeks.map(s => (s.n ? s.mean : null)))
  return { years, weeks, best: avgBW.best, worst: avgBW.worst, complete: out.length - (wtd ? 1 : 0), partial: wtd ? lastK : null }
}

/**
 * Dia da semana: retorno diário fechamento/fechamento anterior agrupado pelo dia da semana da data (0 = segunda … 6 = domingo).
 * Por ano: média e n de cada dia; estatísticas agregadas sobre todos os retornos diários.
 */
export function dayOfWeek(rows) {
  const R = clean(rows)
  const byY = new Map()
  const all = Array.from({ length: 7 }, () => [])
  for (let i = 1; i < R.length; i++) {
    const r = (R[i].close / R[i - 1].close - 1) * 100
    const d = (utc(R[i].time).getUTCDay() + 6) % 7
    const y = +R[i].time.slice(0, 4)
    if (!byY.has(y)) byY.set(y, Array.from({ length: 7 }, () => []))
    byY.get(y)[d].push(r)
    all[d].push(r)
  }
  const days = all.map(stats)
  const used = days.map((s, i) => (s.n ? i : -1)).filter(i => i >= 0)
  const years = Array.from(byY.keys()).sort((a, b) => b - a).map(y => {
    const cells = byY.get(y).map(v => { const s = stats(v); return s.n ? { r: s.mean, n: s.n, part: null } : null })
    const bw = bestWorst(cells.map(c => (c ? c.r : null)))
    return { y, cells, best: bw.best, worst: bw.worst }
  })
  const avgBW = bestWorst(days.map(s => s.mean))
  return { years, days, used, best: avgBW.best, worst: avgBW.worst, n: R.length > 1 ? R.length - 1 : 0 }
}
