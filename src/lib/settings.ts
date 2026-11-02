/** Preferências do usuário (client-side, localStorage). Estático: o HTML exportado usa sempre os padrões;
 *  as preferências salvas são aplicadas depois da hidratação (SettingsRoot remonta a árvore), sem erro de hidratação. */
import { BENCH_DEFAULTS, validBench, sameBench, type BenchPrefs } from './bench.mjs'
export type Lang = 'en' | 'pt'
export type NumFmt = 'en' | 'pt'
export type TzMode = 'brt' | 'local'
export type Theme = 'amber' | 'green' | 'contrast' | 'light'
export type UpDown = 'std' | 'cb'
/** bench: benchmark padrão por mercado (EUA, Brasil, cripto, câmbio, commodities); valores validados em lib/bench.mjs */
export type Settings = { lang: Lang; num: NumFmt; tz: TzMode; theme: Theme; ud: UpDown; bench: BenchPrefs }

export const DEFAULTS: Settings = { lang: 'en', num: 'en', tz: 'brt', theme: 'amber', ud: 'std', bench: { ...BENCH_DEFAULTS } }
const KEY = 'qt.settings.v1'

let cur: Settings = { ...DEFAULTS, bench: { ...BENCH_DEFAULTS } }
const subs = new Set<() => void>()

const valid = (s: any): Settings => ({
  lang: s?.lang === 'pt' ? 'pt' : 'en',
  num: s?.num === 'pt' ? 'pt' : 'en',
  tz: s?.tz === 'local' ? 'local' : 'brt',
  theme: (['green', 'contrast', 'light'] as const).includes(s?.theme) ? s.theme : 'amber',
  ud: s?.ud === 'cb' ? 'cb' : 'std',
  bench: validBench(s?.bench),
})

export const getSettings = () => cur
export const lang = () => cur.lang
/** locale dos números (separador de milhar/decimal) */
export const numLocale = () => (cur.num === 'pt' ? 'pt-BR' : 'en-US')
export const sameSettings = (a: Settings, b: Settings) => a.lang === b.lang && a.num === b.num && a.tz === b.tz && a.theme === b.theme && a.ud === b.ud && sameBench(a.bench, b.bench)

export function readStored(): Settings {
  try { return valid(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return valid(DEFAULTS) }
}
/** aplica sem notificar (usado só no boot do cliente) */
export function applySilently(s: Settings) { cur = valid(s) }

export function setSettings(p: Partial<Settings>) {
  cur = valid({ ...cur, ...p })
  try { localStorage.setItem(KEY, JSON.stringify(cur)) } catch { /* modo privado */ }
  subs.forEach(f => f())
}
export function resetSettings() {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
  cur = valid(DEFAULTS)
  subs.forEach(f => f())
}
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } }

/** painel de configurações aberto (sobrevive à remontagem disparada pela troca de idioma/formato) */
let panelOpen = false
export const isPanelOpen = () => panelOpen
export const setPanelOpen = (v: boolean) => { panelOpen = v }
