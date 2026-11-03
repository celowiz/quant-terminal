// Eventos corporativos no gráfico (EVTS, GP, GPL): módulo puro, testável com `node --test`.
// Entrada: corp/<t>.json (proventos, desdobramentos, documentos) e calendar.json (próximo resultado).

/** Tipos de evento: rótulos EN/PT, cor (hex cru; quem desenha aplica o tema) e forma/posição do marcador. */
export const EVENT_KINDS = {
  R: { en: 'Results', pt: 'Resultados', color: '#2f7bff', shape: 'square', pos: 'aboveBar' },
  F: { en: 'Material facts / 8-K', pt: 'Fatos relevantes / 8-K', color: '#FFA028', shape: 'arrowDown', pos: 'aboveBar' },
  D: { en: 'Dividends', pt: 'Proventos', color: '#3ddc84', shape: 'circle', pos: 'belowBar' },
  S: { en: 'Splits', pt: 'Desdobramentos', color: '#c77dff', shape: 'arrowUp', pos: 'belowBar' },
  N: { en: 'Next results (CAL)', pt: 'Próximo resultado (CAL)', color: '#ffffff', shape: 'square', pos: 'aboveBar' },
}

const short = t => String(t || '').replace(/\.SA$/, '')

/** Lista de eventos (mais recente primeiro). */
export function buildEvents(d, cal, ticker) {
  const us = d?.country === 'US', out = []
  for (const [t, a] of d?.dividends_full || []) out.push({ date: t, kind: 'D', text: `${us ? 'US$' : 'R$'} ${a.toFixed(4)}`, value: a })
  for (const [t, a] of d?.splits_full || []) out.push({ date: t, kind: 'S', text: a >= 1 ? `${a}:1` : `1:${+(1 / a).toFixed(2)}`, value: a })
  const seen = new Set()
  for (const f of d?.filings || []) {
    const res = us ? /^10-[KQ]/.test(f.cat) || /Results of Operations/i.test(f.subject || '') : f.cat === 'Dados Econômico-Financeiros' && /press/i.test(f.type || '')
    const mat = us ? /^8-K/.test(f.cat) : f.cat === 'Fato Relevante'
    if (!res && !mat) continue
    const kind = res ? 'R' : 'F', k = kind + f.date
    if (kind === 'R' && seen.has(k)) continue
    seen.add(k)
    out.push({ date: f.date, kind, text: (f.subject || f.type || f.cat || '').trim(), link: f.link })
  }
  const row = (cal?.rows || []).find(r => r.ticker === short(ticker).toUpperCase())
  if (row?.date) out.push({ date: row.date, kind: 'N', text: `${row.q || ''} · ${row.status || ''}${row.call?.date ? ` · call ${row.call.date}` : ''}`.trim(), link: row.link || row.ri_page })
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Barra (time ISO, ordenado) onde o evento cai.
 *  'next' (diário): primeiro pregão na data ou depois. 'bar' (semanal/mensal…, barras rotuladas pelo último pregão do período):
 *  primeira barra com time ≥ data, igual a 'next', mas mantém o evento fora da faixa quando passa da última barra. */
export function snapTime(times, date) {
  let lo = 0, hi = times.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] < date) lo = m + 1; else hi = m }
  return lo < times.length ? times[lo] : null
}

/** Eventos agrupados por barra (só os que caem dentro de [primeira barra, última barra]; N = futuro, fica fora). */
export function eventsByBar(events, times) {
  const out = new Map()
  if (!times.length) return out
  // o evento antes da primeira barra cairia nela por engano: descarta (o 1º pregão exibido não é o do evento)
  for (const e of events) {
    if (e.kind === 'N' || e.date < times[0]) continue
    const t = snapTime(times, e.date)
    if (!t) continue
    if (!out.has(t)) out.set(t, [])
    out.get(t).push(e)
  }
  return out
}

/** Marcadores (lightweight-charts) a partir de eventsByBar: um por tipo por barra, em ordem de tempo. */
export function eventMarkers(byBar, kinds = EVENT_KINDS, color = c => c) {
  const out = []
  for (const t of [...byBar.keys()].sort()) {
    const ks = [...new Set(byBar.get(t).map(e => e.kind))].sort()
    for (const k of ks) out.push({ time: t, text: k, color: color(kinds[k].color), shape: kinds[k].shape, position: kinds[k].pos })
  }
  return out
}
