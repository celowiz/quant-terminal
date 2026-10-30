/** Preferências do usuário (client-side, localStorage). Estático: o HTML exportado usa sempre os padrões;
 *  as preferências salvas são aplicadas depois da hidratação (SettingsRoot remonta a árvore), sem erro de hidratação. */
export type Lang = 'en' | 'pt'
export type NumFmt = 'en' | 'pt'
export type TzMode = 'brt' | 'local'
export type Theme = 'amber' | 'green' | 'contrast' | 'light'
export type UpDown = 'std' | 'cb'
export type Settings = { lang: Lang; num: NumFmt; tz: TzMode; theme: Theme; ud: UpDown }

export const DEFAULTS: Settings = { lang: 'en', num: 'en', tz: 'brt', theme: 'amber', ud: 'std' }
const KEY = 'qt.settings.v1'

let cur: Settings = { ...DEFAULTS }
const subs = new Set<() => void>()

const valid = (s: any): Settings => ({
  lang: s?.lang === 'pt' ? 'pt' : 'en',
  num: s?.num === 'pt' ? 'pt' : 'en',
  tz: s?.tz === 'local' ? 'local' : 'brt',
  theme: (['green', 'contrast', 'light'] as const).includes(s?.theme) ? s.theme : 'amber',
  ud: s?.ud === 'cb' ? 'cb' : 'std',
})

export const getSettings = () => cur
export const lang = () => cur.lang
/** locale dos números (separador de milhar/decimal) */
export const numLocale = () => (cur.num === 'pt' ? 'pt-BR' : 'en-US')
export const sameSettings = (a: Settings, b: Settings) => a.lang === b.lang && a.num === b.num && a.tz === b.tz && a.theme === b.theme && a.ud === b.ud

export function readStored(): Settings {
  try { return valid(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return { ...DEFAULTS } }
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
  cur = { ...DEFAULTS }
  subs.forEach(f => f())
}
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } }

/** painel de configurações aberto (sobrevive à remontagem disparada pela troca de idioma/formato) */
let panelOpen = false
export const isPanelOpen = () => panelOpen
export const setPanelOpen = (v: boolean) => { panelOpen = v }
