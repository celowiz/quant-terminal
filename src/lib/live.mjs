// Camada "ao vivo" no navegador: lógica pura (testada com node --test). A busca fica em liveFetch.ts.
// Horário de Brasília = UTC−3 (sem horário de verão desde 2019).
export const BRT = -3 * 3600e3

/** data (AAAA-MM-DD) e minutos do dia em Brasília de um instante (ms) */
export function brt(ms) {
  const d = new Date(ms + BRT)
  return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay(), hhmm: d.toISOString().slice(11, 16), hhmmss: d.toISOString().slice(11, 19) }
}

/** pregão da B3 aberto (dias úteis, 10:00–18:30 de Brasília; feriados não são conhecidos aqui: a falta de barras novas cobre) */
export function b3Open(ms, start = 600, end = 1110) {
  const t = brt(ms)
  return t.dow >= 1 && t.dow <= 5 && t.min >= start && t.min <= end
}
/** futuros de juros e câmbio negociam a partir das 09:00 */
export const b3FutOpen = ms => b3Open(ms, 540, 1110)

/** código do dólar futuro mais negociado: vencimento do mês seguinte (o do mês vence no 1º dia útil); nos 3 primeiros dias também o do mês */
const MONTH = 'FGHJKMNQUVXZ'
export function dolCodes(ms) {
  const d = new Date(ms + BRT), y = d.getUTCFullYear(), m = d.getUTCMonth()
  const code = (yy, mm) => `DOL${MONTH[mm]}${String(yy).slice(2)}`
  const nx = m === 11 ? code(y + 1, 0) : code(y, m + 1)
  return d.getUTCDate() <= 3 ? [code(y, m), nx] : [nx]
}

/** código do ativo na B3 (PETR4.SA → PETR4, ^BVSP → IBOV); fora da B3 → null */
export function b3Sym(t) {
  const u = String(t || '').toUpperCase()
  if (u === '^BVSP') return 'IBOV'
  const m = u.match(/^([A-Z0-9]{4}\d{1,2}[A-Z]?)\.SA$/)
  return m ? m[1] : null
}

/** resposta de cotação (instrumentQuotation) → { last, open, high, low, avg, pct } ou null */
export function b3Quote(j) {
  const q = j?.BizSts?.cd === 'OK' ? j?.Trad?.[0]?.scty?.SctyQtn : null
  if (!q || !Number.isFinite(+q.curPrc)) return null
  const n = v => (v == null || !Number.isFinite(+v) ? null : +v)
  return { last: +q.curPrc, open: n(q.opngPric), high: n(q.maxPric), low: n(q.minPric), avg: n(q.avrgPric), pct: n(q.prcFlcn) }
}

/** histórico do dia (DailyFluctuationHistory) → { day, pts: [[unix UTC, fechamento do minuto]] } ou null */
export function b3Day(j) {
  const s = j?.BizSts?.cd === 'OK' ? j?.TradgFlr : null
  const day = s?.date, L = s?.scty?.lstQtn
  if (!day || !Array.isArray(L) || !L.length) return null
  const pts = []
  for (const r of L) {
    const m = String(r?.dtTm || '').match(/^(\d{2}):(\d{2})/)
    if (!m || !Number.isFinite(+r.closPric)) continue
    pts.push([Math.round(Date.parse(`${day}T${m[1]}:${m[2]}:00-03:00`) / 1000), +r.closPric])
  }
  return pts.length ? { day, pts } : null
}

/**
 * Sessão ao vivo para o GIP: só pontos de fechamento por minuto (sem abertura/máxima/mínima/volume),
 * como barras [u, c, c, c, c, 0]. A tela trata essa sessão só em linha e sem VWAP.
 * Retorna null se o arquivo publicado já tem esse pregão completo (última barra do arquivo ≥ último ponto ao vivo).
 */
export function liveSession(day, fileBars) {
  if (!day) return null
  const lastFile = (fileBars || []).reduce((m, b) => Math.max(m, b[0]), 0)
  const last = day.pts[day.pts.length - 1][0]
  if (lastFile >= last) return null
  return day.pts.map(([u, c]) => [u, c, c, c, c, 0])
}

/** atraso em minutos entre o último dado e agora (arredondado para baixo; nunca negativo) */
export const delayMin = (lastMs, nowMs) => Math.max(0, Math.floor((nowMs - lastMs) / 60000))

/**
 * Rótulo curado do selo ao vivo.
 * kind: 'rt' (tempo real), 'delayed' (com atraso de N min), 'closed' (mercado fechado, último negócio às hh:mm), 'checked' (fonte oficial consultada agora)
 */
export function liveLabel({ kind, delay, at, last }, lang) {
  const pt = lang === 'pt'
  const t = at ? brt(at) : null, l = last ? brt(last) : null
  if (kind === 'rt') return pt ? `Ao vivo · atualizado às ${t.hhmmss}` : `Live · updated ${t.hhmmss}`
  if (kind === 'closed') return pt ? `Pregão encerrado · último negócio às ${l.hhmm}` : `Session closed · last trade ${l.hhmm}`
  if (kind === 'delayed') return pt ? `Atraso de ${delay} min · atualizado às ${t.hhmm}` : `Delayed ${delay} min · updated ${t.hhmm}`
  return pt ? `Consultado às ${t.hhmm}` : `Checked at ${t.hhmm}`
}

/** 'dd/mm/aaaa' → 'aaaa-mm-dd' */
export const dmy = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null }

/**
 * Junta os últimos valores de uma série oficial (lista [{data:'dd/mm/aaaa', valor:'x'}]) aos pontos publicados.
 * Substitui a mesma data e acrescenta datas novas; nunca apaga pontos. maxDay descarta datas futuras (a meta da Selic vem até a próxima reunião). Retorna { points, fresh } (fresh = nº de datas novas).
 */
export function mergeSgs(points, rows, maxDay = null) {
  const out = (points || []).map(p => [p[0], p[1]])
  const idx = new Map(out.map((p, i) => [p[0], i]))
  let fresh = 0
  for (const r of rows || []) {
    const d = dmy(r?.data), v = r?.valor == null || r.valor === '' ? NaN : +r.valor
    if (!d || !Number.isFinite(v) || (maxDay && d > maxDay)) continue
    if (idx.has(d)) out[idx.get(d)][1] = v
    else { out.push([d, v]); idx.set(d, out.length - 1); fresh++ }
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return { points: out, fresh }
}

/** título do comunicado do Copom → { n, date, selic, move: 'hold'|'cut'|'hike' } (selic null se o título não trouxer a taxa) */
export function copomTitle(it) {
  const t = String(it?.titulo || '')
  const m = t.match(/(\d{1,2},\d{1,2})\s*%/)
  const move = /\bmant[ée]m\b/i.test(t) ? 'hold' : /\breduz\b/i.test(t) ? 'cut' : /\b(eleva|aumenta)\b/i.test(t) ? 'hike' : null
  return { n: it?.nro_reuniao ?? null, date: it?.dataReferencia || null, selic: m ? +m[1].replace(',', '.') : null, move }
}

/** boletins PTAX do dia → [{ kind, time:'hh:mm', buy, sell }] em ordem; kind: 'open'|'mid'|'close' */
export function ptaxBulletins(j) {
  const out = []
  for (const r of j?.value || []) {
    const k = /Abertura/i.test(r.tipoBoletim) ? 'open' : /Fechamento/i.test(r.tipoBoletim) ? 'close' : 'mid'
    const tm = String(r.dataHoraCotacao || '').slice(11, 16)
    if (!Number.isFinite(+r.cotacaoVenda)) continue
    out.push({ kind: k, time: tm, buy: +r.cotacaoCompra, sell: +r.cotacaoVenda })
  }
  return out
}

/** junta manchetes ao vivo com as publicadas: sem duplicar link, mais novas primeiro */
export function mergeNews(items, live) {
  const seen = new Set((items || []).map(n => n.link))
  const add = (live || []).filter(n => n.link && !seen.has(n.link) && (seen.add(n.link), true))
  return { items: [...add, ...(items || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), fresh: add.length }
}

/** data ISO de um feed (RSS pubDate ou Atom updated) → 'AAAA-MM-DDTHH:MM-03:00' (Brasília) ou null */
export function feedDate(s) {
  const ms = Date.parse(String(s || ''))
  if (!Number.isFinite(ms)) return null
  return `${new Date(ms + BRT).toISOString().slice(0, 16)}-03:00`
}

// ---------------- fase 2: arquivos do watcher (branch `live`) ----------------
/** endereço de um arquivo publicado pelo watcher (branch órfão `live`; cache de ~5 min na origem) */
export const LIVE_RAW = 'https://raw.githubusercontent.com/celowiz/quant-terminal/live/'
/** referência do branch live na API pública do GitHub (pulso: sha do último commit) */
export const LIVE_PULSE = 'https://api.github.com/repos/celowiz/quant-terminal/git/ref/heads/live'

/** cotação do watcher [último, anterior, unix, fuso s] → dia do pregão no fuso da bolsa (AAAA-MM-DD) ou null */
export function tradeDay(q) {
  if (!Array.isArray(q) || !(q[2] > 0)) return null
  return new Date((q[2] + (q[3] || 0)) * 1000).toISOString().slice(0, 10)
}

/** negociou nos últimos maxMin minutos (mercado aberto agora)? */
export const quoteFresh = (q, nowMs, maxMin = 30) => Array.isArray(q) && q[2] > 0 && nowMs - q[2] * 1000 <= maxMin * 60000

/**
 * Aplica uma cotação do watcher à série diária: mesmo pregão → troca o último fechamento; pregão mais novo →
 * acrescenta. Cotação de pregão mais antigo que o arquivo é ignorada (o retrato diário vence).
 * Devolve { dates, close, applied }.
 */
export function applyQuote(dates, close, q) {
  const day = tradeDay(q)
  if (!day || !(q[0] > 0)) return { dates, close, applied: false }
  let i = dates.length - 1
  while (i >= 0 && close[i] == null) i--
  const lastDay = i >= 0 ? dates[i] : ''
  if (day < lastDay) return { dates, close, applied: false }
  if (day === lastDay) { const c = close.slice(); c[i] = q[0]; return { dates: dates.slice(0, i + 1), close: c.slice(0, i + 1), applied: true } }
  return { dates: [...dates.slice(0, i + 1), day], close: [...close.slice(0, i + 1), q[0]], applied: true }
}

/** selo das telas com cotações do watcher: com atraso (mediana dos que negociam agora) ou mercado fechado */
export function quotesBadge(quotes, atMs, nowMs) {
  const qs = (quotes || []).filter(q => Array.isArray(q) && q[2] > 0)
  if (!qs.length) return null
  const live = qs.filter(q => quoteFresh(q, nowMs)).map(q => delayMin(q[2] * 1000, nowMs)).sort((a, b) => a - b)
  if (live.length) return { kind: 'delayed', delay: live[Math.floor((live.length - 1) / 2)], at: atMs || nowMs }
  // nenhum negociando agora: bolsas de fusos diferentes, então não há "pregão encerrado" único — mostra a hora da última leitura
  return atMs ? { kind: 'checked', at: atMs } : { kind: 'closed', last: Math.max(...qs.map(q => q[2])) * 1000 }
}

/** observações recentes [[data, valor]] sobre a série publicada: troca a mesma data, acrescenta as novas */
export function mergePoints(points, pts) {
  const m = new Map((points || []).map(p => [p[0], p[1]]))
  let fresh = 0
  for (const p of pts || []) {
    if (!Array.isArray(p) || !/^\d{4}-\d{2}-\d{2}$/.test(p[0]) || typeof p[1] !== 'number' || !Number.isFinite(p[1])) continue
    if (!m.has(p[0])) fresh++
    m.set(p[0], p[1])
  }
  return { points: [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)), fresh }
}

// ---------------- fase 3: pulso do branch live, divulgações dos EUA direto na fonte, modo rápido da agenda ----------------
/** sha do último commit do branch live (resposta da API de refs) ou null */
export function refSha(j) {
  const s = j && j.object && j.object.sha
  return typeof s === 'string' && /^[0-9a-f]{40}$/.test(s) ? s : null
}

/** séries do órgão de estatísticas do trabalho dos EUA equivalentes às do ECON (mesmos números, divulgação na hora) */
export const BLS_SERIES = { CPIAUCSL: 'CUSR0000SA0', PAYEMS: 'CES0000000001', UNRATE: 'LNS14000000' }

/** resposta v2 de uma série → [[AAAA-MM-01, valor]] em ordem; ignora médias anuais (M13) e meses sem valor */
export function blsPoints(j) {
  const d = j && j.status === 'REQUEST_SUCCEEDED' && j.Results && Array.isArray(j.Results.series) && j.Results.series[0] && j.Results.series[0].data
  if (!Array.isArray(d)) return null
  const out = []
  for (const x of d) {
    const m = /^M(0[1-9]|1[0-2])$/.exec(x && x.period), v = Number(x && x.value)
    if (!m || !/^\d{4}$/.test(x.year) || x.value === '' || x.value === '-' || !Number.isFinite(v)) continue
    out.push([`${x.year}-${m[1]}-01`, v])
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

/**
 * Realizado de uma divulgação da agenda a partir da série mensal (mesmas regras do pipeline diário):
 * CPI = variação em 12 meses (%, 2 casas); payroll = variação mensal (mil, 1 casa); desemprego = nível (%, 1 casa).
 * period = 'MM/AAAA'. Sem o mês de referência (ou o de comparação), null — nunca estima.
 */
export function blsActual(points, series, period) {
  const m = /^(\d{2})\/(\d{4})$/.exec(period || '')
  if (!m || !Array.isArray(points)) return null
  const idx = new Map(points.map(p => [p[0], p[1]]))
  const y = +m[2], mo = +m[1], key = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`
  const cur = idx.get(key(y, mo))
  if (cur == null) return null
  const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d
  if (series === 'UNRATE') return r(cur, 1)
  if (series === 'PAYEMS') { const p = idx.get(mo > 1 ? key(y, mo - 1) : key(y - 1, 12)); return p == null ? null : r(cur - p, 1) }
  if (series === 'CPIAUCSL') { const p = idx.get(key(y - 1, mo)); return p == null || !p ? null : r((cur / p - 1) * 100, 2) }
  return null
}

/** período anterior ('MM/AAAA') */
const prevPeriod = p => { const m = /^(\d{2})\/(\d{4})$/.exec(p || ''); if (!m) return null; const mo = +m[1], y = +m[2]; return mo > 1 ? `${String(mo - 1).padStart(2, '0')}/${y}` : `12/${y - 1}` }

/** divulgações dos EUA da agenda que já saíram (até 7 dias) e ainda estão sem realizado no retrato diário */
export function blsPending(events, nowMs) {
  return (events || []).filter(e => e && e.country === 'US' && BLS_SERIES[e.series] && e.actual == null && /^\d{2}\/\d{4}$/.test(e.period || '')
    && Date.parse(e.time) <= nowMs && nowMs - Date.parse(e.time) <= 7 * 864e5)
}

/** preenche realizado (e anterior, se vazio) das divulgações pendentes; devolve { events, filled } */
export function ecoFill(events, bySeries, nowMs) {
  const want = new Set(blsPending(events, nowMs))
  let filled = 0
  const out = (events || []).map(e => {
    if (!want.has(e) || !bySeries || !bySeries[e.series]) return e
    const a = blsActual(bySeries[e.series], e.series, e.period)
    if (a == null) return e
    filled++
    const pr = e.prior == null ? blsActual(bySeries[e.series], e.series, prevPeriod(e.period)) : e.prior
    return { ...e, actual: a, prior: pr, live: true }
  })
  return { events: out, filled }
}

/** alguma divulgação (dos países pedidos) entre `before` min antes e `after` min depois de agora? */
export function releaseNear(events, nowMs, countries, before = 2, after = 30) {
  return (events || []).some(e => e && countries.includes(e.country) && !e.allday && !e.time_approx && typeof e.time === 'string'
    && nowMs >= Date.parse(e.time) - before * 60000 && nowMs <= Date.parse(e.time) + after * 60000)
}
