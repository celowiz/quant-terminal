// MOV / HMOV: contribuição de cada ação para a variação do índice (funções puras, testadas em mov.test.mjs).
// Dados: public/data/mov/<IDX>.json (build_mov.py) e, no pregão, o arquivo ao vivo mov.json do watcher.
// Pontos brutos do dia: L(t−1) × peso(t−1) × retorno(t). A soma dos brutos não fecha exatamente com a variação
// oficial; o resíduo de cada dia é distribuído pelo peso de cada ação naquele dia (Pontos = bruto + peso × resíduo),
// então a soma dos Pontos é igual à variação do índice no período.

const isNum = v => typeof v === 'number' && Number.isFinite(v)

/** fator de retorno total vigente na posição i (eventos [[i, fator]] em ordem) */
export function adjAt(ev, i) {
  let f = null
  for (const [k, v] of ev || []) { if (k <= i) f = v; else break }
  return f
}

/** último índice com data ≤ iso (−1 se nenhum) */
export function idxOnOrBefore(dates, iso) {
  let lo = 0, hi = dates.length - 1, r = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= iso) { r = m; lo = m + 1 } else hi = m - 1 }
  return r
}

const isoShift = (iso, { d = 0, m = 0, y = 0 }) => {
  const t = new Date(iso + 'T12:00:00Z')
  t.setUTCFullYear(t.getUTCFullYear() + y, t.getUTCMonth() + m, t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

/**
 * Período → posições [base, fim] em `dates` (base = fechamento anterior ao primeiro dia do período).
 * preset: '1D' | 'MTD' | 'YTD' | '1Y' | 'CUSTOM' (custom = {from, to}, datas ISO inclusivas).
 * null quando o histórico não cobre o período (a tela mostra '—' e explica).
 */
export function rangeOf(dates, preset, custom) {
  const n = dates.length
  if (n < 2) return null
  let b = n - 1, target
  const end = dates[b]
  if (preset === '1D') return { a: b - 1, b }
  if (preset === 'MTD') target = isoShift(end.slice(0, 8) + '01', { d: -1 })
  else if (preset === 'YTD') target = `${+end.slice(0, 4) - 1}-12-31`
  else if (preset === '1Y') target = isoShift(end, { y: -1 })
  else if (preset === 'CUSTOM' && custom && custom.from && custom.to) {
    b = idxOnOrBefore(dates, custom.to)
    target = isoShift(custom.from, { d: -1 })
  } else return null
  // base antes do início do histórico: período não coberto (a tela mostra '—' e diz desde quando há dados)
  if (target < dates[0]) return null
  const a = idxOnOrBefore(dates, target)
  return a >= 0 && b > a ? { a, b } : null
}

/**
 * Soma no período (a, b]: por membro, pontos brutos, Pontos (com o resíduo distribuído pelo peso), retorno total e
 * preço final; e o nível do índice nas pontas. Membro sem preço no fim usa o último fechamento (saiu do índice/da bolsa).
 */
export function aggregate(o, a, b) {
  const L = o.level, rows = new Map()
  let resid = 0
  for (let t = a + 1; t <= b; t++) {
    let s = 0, tw = 0
    const ws = []
    for (const c in o.pts) {
      const p = o.pts[c][t], w = o.w[c][t]
      if (!isNum(p) || !isNum(w)) continue
      s += p; tw += w; ws.push([c, p, w])
    }
    if (!ws.length || !isNum(L[t]) || !isNum(L[t - 1])) continue
    const r = (L[t] - L[t - 1]) - s
    resid += r
    for (const [c, p, w] of ws) {
      const x = rows.get(c) || { raw: 0, pts: 0, days: 0 }
      x.raw += p; x.pts += p + (w / tw) * r; x.days++
      rows.set(c, x)
    }
  }
  const meta = new Map((o.members || []).map(m => [m.cod, m]))
  const out = []
  for (const [c, x] of rows) {
    const m = meta.get(c) || { cod: c, name: c }
    const px = o.px[c] || [], ev = o.adj[c] || []
    // retorno total no período em que há preço (da base, ou do primeiro preço, até o fim)
    let i0 = a; while (i0 < b && !isNum(px[i0])) i0++
    const p0 = px[i0], p1 = px[b], f0 = adjAt(ev, i0), f1 = adjAt(ev, b)
    const ret = isNum(p0) && isNum(p1) && p0 > 0 && isNum(f0) && isNum(f1) ? (p1 * f1) / (p0 * f0) - 1 : null
    const w0 = o.w[c][a + 1]
    out.push({ ...m, raw: x.raw, pts: x.pts, ret, px: isNum(p1) ? p1 : null, w0: isNum(w0) ? w0 : null,
      joined: m.first > o.dates[a + 1] && m.first <= o.dates[b] ? m.first : null,
      left: m.last < o.dates[b] && m.last >= o.dates[a + 1] ? m.last : null })
  }
  const L0 = L[a], L1 = L[b]
  return { rows: out, L0, L1, chg: isNum(L0) && isNum(L1) ? L1 - L0 : null, pct: isNum(L0) && isNum(L1) && L0 ? (L1 / L0 - 1) * 100 : null, resid,
    from: o.dates[a + 1], to: o.dates[b], base: o.dates[a] }
}

/**
 * MOV do dia a partir do arquivo ao vivo: parts = peso (%) no fechamento anterior; quotes = {cod: [último, var %]};
 * idxQuote = [nível, var %]. Pontos brutos = L(anterior) × peso × var; resíduo distribuído pelo peso.
 */
export function liveAggregate(parts, quotes, idxQuote, meta) {
  if (!idxQuote || !isNum(idxQuote[0]) || !isNum(idxQuote[1])) return null
  const L1 = idxQuote[0], L0 = L1 / (1 + idxQuote[1] / 100)
  const tw = Object.values(parts).reduce((s, w) => s + (isNum(w) ? w : 0), 0)
  if (!(tw > 0)) return null
  const rows = []
  let s = 0
  for (const c in parts) {
    const q = quotes[c], w = parts[c] / tw
    const r = q && isNum(q[1]) ? q[1] / 100 : null
    const raw = r == null ? null : L0 * w * r
    if (raw != null) s += raw
    const m = (meta && meta.get(c)) || { cod: c, name: c }
    rows.push({ ...m, cod: c, raw, w0: w, ret: r, px: q && isNum(q[0]) ? q[0] : null, joined: null, left: null })
  }
  const resid = (L1 - L0) - s
  const wq = rows.filter(r => r.raw != null).reduce((x, r) => x + r.w0, 0)
  for (const r of rows) r.pts = r.raw == null ? null : r.raw + (wq > 0 ? (r.w0 / wq) * resid : 0)
  return { rows, L0, L1, chg: L1 - L0, pct: idxQuote[1], resid }
}

/** Junta classes da mesma empresa (raiz de 4 letras do código: PETR3+PETR4) */
export function mergeClasses(rows) {
  const by = new Map()
  for (const r of rows) {
    const k = r.root || String(r.cod).slice(0, 4)
    const x = by.get(k)
    if (!x) { by.set(k, { ...r, cod: k, classes: [r.cod], _w: isNum(r.w0) ? r.w0 : 0, _wr: isNum(r.w0) && isNum(r.ret) ? r.w0 * r.ret : 0 }); continue }
    x.classes.push(r.cod)
    x.raw = (x.raw ?? 0) + (r.raw ?? 0); x.pts = (x.pts ?? 0) + (r.pts ?? 0)
    if (isNum(r.w0)) { x._w += r.w0; if (isNum(r.ret)) x._wr += r.w0 * r.ret }
    x.current = x.current || r.current
    x.px = null; x.joined = null; x.left = null
  }
  return [...by.values()].map(x => {
    const { _w, _wr, ...y } = x
    if (x.classes.length > 1) { y.ret = _w > 0 ? _wr / _w : null; y.w0 = _w || null; y.cod = x.classes.slice().sort().join('/') }
    return y
  })
}

/** Soma por setor (rótulo já curado por `label`); membros ficam em `items` */
export function groupBy(rows, key) {
  const by = new Map()
  for (const r of rows) {
    const k = key(r) || '—'
    const x = by.get(k) || { cod: k, name: k, raw: 0, pts: 0, n: 0, items: [], _w: 0, _wr: 0 }
    x.raw += r.raw ?? 0; x.pts += r.pts ?? 0; x.n++; x.items.push(r)
    if (isNum(r.w0)) { x._w += r.w0; if (isNum(r.ret)) x._wr += r.w0 * r.ret }
    by.set(k, x)
  }
  return [...by.values()].map(({ _w, _wr, ...x }) => ({ ...x, ret: _w > 0 ? _wr / _w : null, px: null, group: true }))
}

/** Altas / baixas / estáveis pelo retorno no período */
export function breadth(rows) {
  let up = 0, down = 0, unch = 0
  for (const r of rows) { if (!isNum(r.ret)) continue; if (r.ret > 0) up++; else if (r.ret < 0) down++; else unch++ }
  return { up, down, unch }
}

/** Membros na base e no fim → entradas e saídas no período */
export function turnover(o, a, b) {
  const atStart = new Set(), atEnd = new Set(), seen = new Set()
  for (const c in o.w) {
    const w = o.w[c]
    if (isNum(w[a + 1])) atStart.add(c)
    if (isNum(w[b])) atEnd.add(c)
    for (let t = a + 1; t <= b; t++) if (isNum(w[t])) { seen.add(c); break }
  }
  return { current: atEnd.size, added: [...seen].filter(c => !atStart.has(c)), removed: [...atStart].filter(c => !atEnd.has(c)) }
}

/** Pontos acumulados dia a dia (com o resíduo distribuído) para os códigos pedidos e para o índice */
export function cumulative(o, a, b, groups) {
  const acc = groups.map(() => 0), out = groups.map(() => []), idx = []
  for (let t = a + 1; t <= b; t++) {
    let s = 0, tw = 0
    for (const c in o.pts) { const p = o.pts[c][t], w = o.w[c][t]; if (isNum(p) && isNum(w)) { s += p; tw += w } }
    const r = isNum(o.level[t]) && isNum(o.level[t - 1]) ? (o.level[t] - o.level[t - 1]) - s : 0
    groups.forEach((cods, k) => {
      for (const c of cods) { const p = o.pts[c]?.[t], w = o.w[c]?.[t]; if (isNum(p) && isNum(w) && tw > 0) acc[k] += p + (w / tw) * r }
      out[k].push([o.dates[t], acc[k]])
    })
    idx.push([o.dates[t], o.level[t] - o.level[a]])
  }
  return { series: out, index: idx }
}
