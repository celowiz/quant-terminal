/** Lógica pura do seletor de ativos com busca (TickerPicker): grupos por classe, busca e rótulos sem ticker duplicado.
 *  Sem React/DOM para poder ser testada com `node --test`. */

/** ordem dos grupos no seletor (sugeridos sempre no topo) */
export const PICKER_GROUPS = ['br_equity', 'fii', 'etf', 'bdr', 'us_equity', 'index', 'fx', 'commodity', 'crypto']

const GROUP_LABEL = {
  suggested: ['Suggested', 'Sugeridos'],
  br_equity: ['BR stocks', 'Ações BR'],
  fii: ['FIIs (BR REITs)', 'FIIs'],
  etf: ['ETFs', 'ETFs'],
  bdr: ['BDRs', 'BDRs'],
  us_equity: ['US stocks', 'Ações EUA'],
  index: ['Indices', 'Índices'],
  fx: ['FX', 'Câmbio'],
  commodity: ['Commodities & futures', 'Commodities e futuros'],
  crypto: ['Crypto', 'Cripto'],
  other: ['Other', 'Outros'],
}
export const groupLabel = (g, lang = 'en') => (GROUP_LABEL[g] || GROUP_LABEL.other)[lang === 'pt' ? 1 : 0]

/** código curto exibido (sem .SA) */
export const shortCode = t => String(t).replace(/\.SA$/i, '')

/** normaliza para busca: sem acentos, maiúsculas */
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** nome sem o ticker repetido: 'iShares Small Cap (SMAL11)' → 'iShares Small Cap'; nome igual ao código → '' */
export function cleanName(name, ticker) {
  const n = String(name || '').trim(), c = shortCode(ticker)
  if (!n) return ''
  if (norm(n) === norm(c) || norm(n) === norm(ticker)) return ''
  return n.replace(new RegExp(`\\s*\\((${esc(c)}|${esc(String(ticker))})\\)\\s*$`, 'i'), '').trim()
}

/** rótulo "Nome (TICKER)" sem duplicar o ticker quando o nome já o contém */
export function withTicker(label, ticker) {
  const l = String(label || '').trim(), c = shortCode(ticker)
  if (!l || norm(l) === norm(c) || norm(l) === norm(ticker)) return c
  const re = new RegExp(`(^|[^A-Z0-9])(${esc(norm(c))}|${esc(norm(ticker))})([^A-Z0-9]|$)`)
  return re.test(norm(l)) ? l : `${l} (${c})`
}

/** pontuação de busca (menor = melhor; null = não casa).
 *  0 código exato · 1 começo do código · 2 código contém · 3 começo de palavra do nome · 4 nome contém */
export function scoreMatch(meta, q) {
  const qq = norm(q)
  if (!qq) return 0
  const code = norm(shortCode(meta.ticker)), full = norm(meta.ticker), name = norm(meta.name) + ' ' + norm(meta.name_pt)
  if (code === qq || full === qq || code.split(/[-=.]/)[0] === qq) return 0
  if (code.startsWith(qq) || full.startsWith(qq)) return 1
  if (code.includes(qq) || full.includes(qq)) return 2
  if (new RegExp(`(^|[^A-Z0-9])${esc(qq)}`).test(name)) return 3
  if (name.includes(qq)) return 4
  return null
}

/** Monta os grupos do seletor.
 *  @param list metas {ticker, name, class}
 *  @param query texto digitado
 *  @param opts.suggested tickers sugeridos (pares/benchmarks), mostrados primeiro, na ordem dada
 *  @param opts.exclude tickers a omitir (o próprio ativo, os já incluídos)
 *  @param opts.perGroup máx. por grupo (padrão: 8 sem busca, 30 com busca)
 *  @returns [{ group, items: meta[] }] sem grupos vazios; um ticker aparece uma única vez */
export function pickerGroups(list, query = '', opts = {}) {
  const q = norm(query)
  const ex = new Set((opts.exclude || []).map(t => String(t).toUpperCase()))
  const byT = new Map(list.map(m => [String(m.ticker).toUpperCase(), m]))
  const per = opts.perGroup ?? (q ? 30 : 8)
  const seen = new Set()
  const out = []
  const sugg = []
  for (const t of opts.suggested || []) {
    const u = String(t).toUpperCase(), m = byT.get(u)
    if (!m || ex.has(u) || seen.has(u)) continue
    if (q && scoreMatch(m, q) == null) continue
    seen.add(u); sugg.push(m)
  }
  if (sugg.length) out.push({ group: 'suggested', items: sugg })
  const buckets = new Map()
  for (const m of list) {
    const u = String(m.ticker).toUpperCase()
    if (ex.has(u) || seen.has(u)) continue
    const s = scoreMatch(m, q)
    if (s == null) continue
    const g = PICKER_GROUPS.includes(m.class) ? m.class : 'other'
    if (!buckets.has(g)) buckets.set(g, [])
    buckets.get(g).push([s, m])
  }
  for (const g of [...PICKER_GROUPS, 'other']) {
    const b = buckets.get(g)
    if (!b?.length) continue
    b.sort((x, y) => x[0] - y[0] || (q ? shortCode(x[1].ticker).length - shortCode(y[1].ticker).length : 0) || shortCode(x[1].ticker).localeCompare(shortCode(y[1].ticker)))
    out.push({ group: g, items: b.slice(0, per).map(x => x[1]), total: b.length })
  }
  // com busca: grupo com o melhor resultado sobe (ex.: 'btc' → Cripto antes de ETFs), sugeridos continuam no topo
  if (q) {
    const best = grp => Math.min(...grp.items.map(m => scoreMatch(m, q)))
    const head = out[0]?.group === 'suggested' ? [out.shift()] : []
    out.sort((a, b) => best(a) - best(b) || PICKER_GROUPS.indexOf(a.group) - PICKER_GROUPS.indexOf(b.group))
    out.unshift(...head)
  }
  return out
}

/** lista linear (navegação por teclado) */
export const flatItems = groups => groups.flatMap(g => g.items)
