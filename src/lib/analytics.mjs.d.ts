export const GA_MEASUREMENT_ID: string
export const CONTENT_GROUP: string
export const MAX_PARAM_LEN: number
export const NAV_INTENT_KEY: string
export type FunctionSource = 'command' | 'list' | 'url'
export type ShareMethod = 'link' | 'image' | 'image_download'
export type SettingName = 'language' | 'number_format' | 'timezone' | 'reset'
export type Params = Record<string, string | number | boolean>
export type Route = { functionCode: string; ticker: string }
export const FUNCTION_SOURCES: FunctionSource[]
export const SHARE_METHODS: ShareMethod[]
export const SETTINGS: SettingName[]
export function isGaDebug(win?: any): boolean
export function sanitizeParams(params?: Record<string, unknown>): Params
export function parseRoute(pathname: string, basePath?: string): Route
export function buildPagePath(functionCode: string, basePath?: string): string
export function buildPageTitle(functionCode: string, ticker?: string): string
export function buildPageViewParams(a: { functionCode: string; ticker?: string; basePath?: string; origin?: string }): Params
export function buildFunctionOpenParams(a: { functionCode: string; ticker?: string; source?: FunctionSource }): Params
export function buildTickerSelectParams(a: { ticker: string; functionCode?: string }): Params
export function buildSettingsChangeParams(setting: SettingName, value?: string): Params | null
export function buildOutboundParams(href: string, currentHost: string): Params | null
export function buildChartInteractionParams(a: { functionCode: string; period: string | number }): Params
export function buildHelpOpenParams(a: { functionCode: string }): Params
export function buildShareParams(a: { functionCode: string; ticker?: string; method: ShareMethod }): Params | null
export function ensureGtagStub(win?: any): void
export function initGoogleAnalytics(win?: any): boolean
export function injectGtagScript(win?: any): void
export function scheduleGtagScriptLoad(win?: any): void
export function trackEvent(name: string, params?: Record<string, unknown> | null, win?: any): void
export function trackPageView(route: Route & { basePath?: string }, win?: any): boolean
export function rememberNavIntent(intent: { kind: 'function' | 'ticker'; source?: FunctionSource; functionCode?: string; ticker?: string }, win?: any): void
export function consumeNavIntent(win?: any, now?: number): any
export function trackRouteLoad(route: Route & { basePath?: string }, win?: any): void
