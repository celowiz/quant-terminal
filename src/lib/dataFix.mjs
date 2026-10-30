// Correções defensivas aplicadas ao JSON publicado ao carregar (o pipeline já corrige na origem; isto cobre dados antigos).

/** universe.json: remove do fim as datas em que menos de `minFrac` das ações tem fechamento (barra do ^BVSP
 *  publicada antes das ações). Corta junto a cauda de fin_volume_30d, que é alinhada ao fim de `dates`. */
export function cleanUniverse(u, minFrac = 0.5) {
  if (!u || !Array.isArray(u.dates) || !u.close) return u
  const keys = Object.keys(u.close).filter(k => k !== '^BVSP')
  if (!keys.length) return u
  let k = u.dates.length
  const ok = i => keys.reduce((n, t) => n + (u.close[t]?.[i] != null ? 1 : 0), 0) >= minFrac * keys.length
  while (k > 0 && !ok(k - 1)) k--
  const cut = u.dates.length - k
  if (!cut) return u
  const close = {}, vols = {}
  for (const [t, s] of Object.entries(u.close)) close[t] = s.slice(0, k)
  for (const [t, v] of Object.entries(u.fin_volume_30d || {})) vols[t] = v.slice(0, Math.max(0, v.length - cut))
  return { ...u, dates: u.dates.slice(0, k), close, fin_volume_30d: vols, trimmed: cut }
}

/** último índice i ≤ from com valor não nulo (−1 se nenhum) */
export function lastValid(s, from = s.length - 1) {
  for (let i = Math.min(from, s.length - 1); i >= 0; i--) if (s[i] != null) return i
  return -1
}
