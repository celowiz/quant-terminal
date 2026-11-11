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
