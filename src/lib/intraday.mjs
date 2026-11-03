// GIP: lógica pura das barras intradiárias (testada com node --test).
// Barra = [unix UTC, open, high, low, close, volume]; horário de Brasília = UTC−3 (sem horário de verão desde 2019).
export const BRT_OFF = 3 * 3600

/** dia do pregão (AAAA-MM-DD, Brasília) de um unix UTC */
export const sessionOf = (u) => new Date((u - BRT_OFF) * 1000).toISOString().slice(0, 10)

/** Remove a barra final "instantâneo" (sem volume e sem variação: O=H=L=C, V=0) — é a barra em formação, não um negócio. */
export function dropTrailingSnapshot(bars) {
  const B = (bars || []).filter(b => Array.isArray(b) && b.length >= 5 && [b[1], b[2], b[3], b[4]].every(Number.isFinite))
  while (B.length) {
    const b = B[B.length - 1]
    if (!(b[5] > 0) && b[1] === b[2] && b[2] === b[3] && b[3] === b[4]) B.pop()
    else break
  }
  return B
}

/** a série tem volume? (índices como o Ibovespa vêm com volume 0 em todas as barras) */
export const hasVolume = (bars) => (bars || []).some(b => b[5] > 0)

/** agrupa por pregão, em ordem: [{ day, bars }] */
export function sessions(bars) {
  const out = [], idx = new Map()
  for (const b of bars || []) {
    const d = sessionOf(b[0])
    let s = idx.get(d)
    if (!s) { s = { day: d, bars: [] }; idx.set(d, s); out.push(s) }
    s.bars.push(b)
  }
  return out
}

/**
 * VWAP acumulado desde a abertura de cada pregão, com bandas de ±1σ/±2σ.
 * Preço típico p = (H+L+C)/3; VWAP_t = Σ p·V / Σ V; σ_t² = Σ V·p² / Σ V − VWAP_t² (variância ponderada pelo volume).
 * Reinicia a cada pregão. Barras antes do primeiro volume > 0 do pregão ficam de fora (sem ponto).
 * Retorna [{ t, vwap, sd }] (t = unix UTC da barra).
 */
export function vwapBands(bars) {
  const out = []
  let day = null, sv = 0, spv = 0, sp2v = 0
  for (const b of bars || []) {
    const d = sessionOf(b[0])
    if (d !== day) { day = d; sv = 0; spv = 0; sp2v = 0 }
    const v = b[5] > 0 ? b[5] : 0, p = (b[2] + b[3] + b[4]) / 3
    sv += v; spv += p * v; sp2v += p * p * v
    if (sv <= 0) continue
    const vw = spv / sv, va = Math.max(0, sp2v / sv - vw * vw)
    out.push({ t: b[0], vwap: vw, sd: Math.sqrt(va) })
  }
  return out
}

/** estatísticas de uma janela de barras */
export function windowStats(B) {
  if (!B || !B.length) return null
  let hi = -Infinity, lo = Infinity, vol = 0, pv = 0
  for (const b of B) { if (b[2] > hi) hi = b[2]; if (b[3] < lo) lo = b[3]; const v = b[5] > 0 ? b[5] : 0; vol += v; pv += (b[2] + b[3] + b[4]) / 3 * v }
  return { open: B[0][1], high: hi, low: lo, last: B[B.length - 1][4], vol, vwap: vol > 0 ? pv / vol : null, n: B.length, t0: B[0][0], t1: B[B.length - 1][0] }
}

/** estatísticas por pregão, com o fechamento anterior (último preço do pregão anterior no arquivo) e a variação */
export function sessionStats(bars) {
  const S = sessions(bars)
  return S.map((s, i) => {
    const st = windowStats(s.bars)
    const prev = i > 0 ? S[i - 1].bars[S[i - 1].bars.length - 1][4] : null
    return { day: s.day, ...st, prevClose: prev, chg: prev ? (st.last / prev - 1) * 100 : null }
  })
}
