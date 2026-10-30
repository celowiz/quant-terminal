/** Cor do tema ativo para estilos inline, gráficos e canvas (o CSS é coberto pelo plugin PostCSS).
 *  O tema é lido do localStorage na importação: trocar de tema recarrega a página. No servidor (export
 *  estático) e no tema padrão, tc() é identidade — o HTML gerado mantém o visual âmbar. */
import { DEFAULT_KEY, mapCssValue, themeKey } from './theme.mjs'

let key = DEFAULT_KEY
if (typeof window !== 'undefined') {
  try { key = themeKey(JSON.parse(window.localStorage.getItem('qt.settings.v1') || 'null')) } catch { /* modo privado */ }
}
const cache = new Map<string, string>()
export const themeActive = () => key
/** aceita '#hex', 'rgb(a)(…)' ou um valor CSS com cores (ex.: gradiente) */
export function tc(hex: string): string {
  if (key === DEFAULT_KEY) return hex
  let v = cache.get(hex)
  if (v === undefined) { v = mapCssValue(hex, key) as string; cache.set(hex, v) }
  return v
}
