/** Atalhos de GA4 para os componentes (client-side; no-op no servidor). */
import {
  buildChartInteractionParams, buildHelpOpenParams, buildSettingsChangeParams, buildShareParams, parseRoute, rememberNavIntent, trackEvent,
  type FunctionSource, type SettingName, type ShareMethod,
} from './analytics.mjs'
import { BASE_PATH } from './static'

export const currentRoute = () => (typeof window === 'undefined' ? { functionCode: 'HOME', ticker: '' } : parseRoute(window.location.pathname, BASE_PATH))

/** chamar antes de go(): a página vai descarregar, o evento sai na carga seguinte */
export const navFunction = (source: FunctionSource, functionCode: string) => rememberNavIntent({ kind: 'function', source, functionCode })
export const navTicker = (ticker: string) => rememberNavIntent({ kind: 'ticker', ticker })

const SETTING_NAME: Record<string, SettingName> = { lang: 'language', num: 'number_format', tz: 'timezone' }
export const trackSetting = (key: 'lang' | 'num' | 'tz' | 'reset', value?: string) =>
  trackEvent('settings_change', buildSettingsChangeParams(key === 'reset' ? 'reset' : SETTING_NAME[key], value))

/** códigos internos (1A, 1S) → rótulo exibido (1Y, 1W) */
const periodLabel = (p: string) => p.toUpperCase().replace(/^(\d+)A$/, '$1Y').replace(/^(\d+)S$/, '$1W')
const PERIOD_RE = /^(\d+[DSWMAY]|YTD|MAX)$/i
/** chart_interaction só para botões de período (1M, 1A, YTD, MAX…) */
export const trackPeriod = (period: unknown) => {
  if (typeof period !== 'string' || !PERIOD_RE.test(period)) return
  trackEvent('chart_interaction', buildChartInteractionParams({ functionCode: currentRoute().functionCode, period: periodLabel(period) }))
}
export const trackShare = (method: ShareMethod) => {
  const r = currentRoute()
  trackEvent('share', buildShareParams({ functionCode: r.functionCode, ticker: r.ticker, method }))
}
export const trackHelp = (functionCode?: string) =>
  trackEvent('help_open', buildHelpOpenParams({ functionCode: functionCode || currentRoute().functionCode }))
