// Estudos do GPC calculados no navegador a partir das barras OHLCV já carregadas (sem dado novo).

/** Heikin-Ashi: HAclose = (O+H+L+C)/4; HAopen = (HAopen₋₁ + HAclose₋₁)/2 (1ª barra: (O+C)/2);
 *  HAhigh = max(H, HAopen, HAclose); HAlow = min(L, HAopen, HAclose). */
export function heikinAshi(rows) {
  const out = []
  let po = 0, pc = 0
  rows.forEach((r, i) => {
    const c = (r.open + r.high + r.low + r.close) / 4
    const o = i === 0 ? (r.open + r.close) / 2 : (po + pc) / 2
    out.push({ time: r.time, open: o, high: Math.max(r.high, o, c), low: Math.min(r.low, o, c), close: c })
    po = o; pc = c
  })
  return out
}

/** Bandas de Bollinger: média móvel simples de n fechamentos ± k desvios-padrão populacionais da mesma janela. */
export function bollinger(rows, n = 20, k = 2) {
  const out = []
  let s = 0, s2 = 0
  rows.forEach((r, i) => {
    s += r.close; s2 += r.close * r.close
    if (i >= n) { const x = rows[i - n].close; s -= x; s2 -= x * x }
    if (i >= n - 1) {
      const m = s / n
      const sd = Math.sqrt(Math.max(0, s2 / n - m * m))
      out.push({ time: r.time, mid: m, upper: m + k * sd, lower: m - k * sd })
    }
  })
  return out
}

/** Perfil de volume aproximado a partir de barras diárias: o volume de cada barra é espalhado por igual
 *  entre as faixas de preço que ela cobre (mínima → máxima). POC = faixa de maior volume; área de valor =
 *  faixas em torno do POC até somar `va` (70%) do volume, crescendo para o lado de maior volume. */
export function volumeProfile(rows, bins = 24, va = 0.7) {
  const ok = rows.filter(r => r.volume > 0 && isFinite(r.high) && isFinite(r.low))
  if (!ok.length) return null
  let lo = Infinity, hi = -Infinity
  for (const r of ok) { if (r.low < lo) lo = r.low; if (r.high > hi) hi = r.high }
  if (!(hi > lo)) return null
  const step = (hi - lo) / bins
  const vol = new Array(bins).fill(0)
  const idx = p => Math.min(bins - 1, Math.max(0, Math.floor((p - lo) / step)))
  for (const r of ok) {
    const a = idx(Math.min(r.low, r.high)), b = idx(Math.max(r.low, r.high))
    const share = r.volume / (b - a + 1)
    for (let j = a; j <= b; j++) vol[j] += share
  }
  const total = vol.reduce((x, y) => x + y, 0)
  let poc = 0
  vol.forEach((v, j) => { if (v > vol[poc]) poc = j })
  let a = poc, b = poc, acc = vol[poc]
  while (acc < va * total && (a > 0 || b < bins - 1)) {
    const dn = a > 0 ? vol[a - 1] : -1, up = b < bins - 1 ? vol[b + 1] : -1
    if (up >= dn) { b++; acc += vol[b] } else { a--; acc += vol[a] }
  }
  return {
    lo, hi, step, total, poc, vaLo: a, vaHi: b,
    bins: vol.map((v, j) => ({ from: lo + j * step, to: lo + (j + 1) * step, vol: v, inVA: j >= a && j <= b })),
  }
}

/** casas decimais do preço para uma série: 4 só quando a série inteira é de preços baixos (câmbio, centavos). */
export function priceDecimals(rows) {
  let m = 0
  for (const r of rows) { const v = Math.abs(r.high ?? r.close); if (v > m) m = v }
  return rows.length && m < 10 ? 4 : 2
}
