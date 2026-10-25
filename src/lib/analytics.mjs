// GA4 do Quant Terminal (mesma propriedade do portfólio, content_group 'quant-terminal').
// Export estático: tudo client-side. O stub (dataLayer + gtag) enfileira chamadas desde o boot;
// o gtag.js só é baixado depois do load/idle. Navegação entre funções é por carga de página
// (window.location.assign), então o page_view virtual é enviado uma vez por carga, com page_path
// normalizado (/quant-terminal/<FUNC>) e o page_view automático desligado (send_page_view: false).
// A intenção de navegação (function_open/ticker_select com a origem) é guardada em sessionStorage
// antes de sair da página e emitida na carga seguinte, para não se perder no unload.

export const GA_MEASUREMENT_ID = 'G-QCBFGR39WG'
export const CONTENT_GROUP = 'quant-terminal'
export const MAX_PARAM_LEN = 100
export const NAV_INTENT_KEY = 'qt.ga.nav'
const GTAG_SCRIPT_ID = 'ga-gtag'
export const FUNCTION_SOURCES = ['command', 'list', 'url']
export const SHARE_METHODS = ['link', 'image', 'image_download']
export const SETTINGS = ['language', 'number_format', 'timezone', 'reset']

function defaultWindow() {
  return typeof window !== 'undefined' ? window : undefined
}

export function isGaDebug(win) {
  const search = win?.location?.search
  if (!search) return false
  try { return new URLSearchParams(String(search).replace(/^\?/, '')).has('ga_debug') } catch { return false }
}

/** corta strings em 100 caracteres e descarta valores vazios/não primitivos */
export function sanitizeParams(params = {}) {
  const out = {}
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue
    if (typeof v === 'string') out[k] = v.slice(0, MAX_PARAM_LEN)
    else if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = v }
    else if (typeof v === 'boolean') out[k] = v
  }
  return out
}

/** '/quant-terminal/des/PETR4/' → { functionCode: 'DES', ticker: 'PETR4' }; raiz → HOME */
export function parseRoute(pathname, basePath = '/quant-terminal') {
  let p = String(pathname || '/')
  if (basePath && p.startsWith(basePath)) p = p.slice(basePath.length)
  const seg = p.split(/[?#]/)[0].split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s) } catch { return s } })
  const functionCode = seg[0] ? seg[0].toUpperCase() : 'HOME'
  const ticker = seg[1] ? seg[1].toUpperCase() : ''
  return { functionCode, ticker }
}

export function buildPagePath(functionCode, basePath = '/quant-terminal') {
  return `${basePath}/${String(functionCode || 'HOME').toUpperCase()}`
}
export function buildPageTitle(functionCode, ticker) {
  const fc = String(functionCode || 'HOME').toUpperCase()
  return ticker ? `${fc} · ${ticker}` : fc
}

export function buildPageViewParams({ functionCode, ticker, basePath = '/quant-terminal', origin = '' }) {
  const page_path = buildPagePath(functionCode, basePath)
  return sanitizeParams({
    page_path,
    page_location: origin ? `${origin}${page_path}` : undefined,
    page_title: buildPageTitle(functionCode, ticker),
    function_code: String(functionCode || 'HOME').toUpperCase(),
    ticker: ticker || undefined,
  })
}

export function buildFunctionOpenParams({ functionCode, ticker, source }) {
  return sanitizeParams({
    function_code: String(functionCode || 'HOME').toUpperCase(),
    ticker: ticker || undefined,
    source: FUNCTION_SOURCES.includes(source) ? source : 'url',
  })
}
export function buildTickerSelectParams({ ticker, functionCode }) {
  return sanitizeParams({ ticker, function_code: functionCode ? String(functionCode).toUpperCase() : undefined })
}
export function buildSettingsChangeParams(setting, value) {
  if (!SETTINGS.includes(setting)) return null
  return sanitizeParams({ setting, value: setting === 'reset' ? 'defaults' : String(value) })
}
/** só links para outro host; devolve null para links internos/inválidos */
export function buildOutboundParams(href, currentHost) {
  let u
  try { u = new URL(href) } catch { return null }
  if (!/^https?:$/.test(u.protocol) || !u.hostname || u.host === currentHost) return null
  return sanitizeParams({ link_url: `${u.origin}${u.pathname}`, link_domain: u.hostname.replace(/^www\./, '') })
}
export function buildChartInteractionParams({ functionCode, period }) {
  return sanitizeParams({ function_code: String(functionCode || 'HOME').toUpperCase(), interaction: 'period_change', period: String(period) })
}
export function buildShareParams({ functionCode, ticker, method }) {
  if (!SHARE_METHODS.includes(method)) return null
  return sanitizeParams({ function_code: String(functionCode || 'HOME').toUpperCase(), ticker: ticker || undefined, method })
}

export function ensureGtagStub(win = defaultWindow()) {
  if (!win) return
  if (!Array.isArray(win.dataLayer)) win.dataLayer = []
  if (typeof win.gtag === 'function') return
  win.gtag = function gtag() { win.dataLayer.push(arguments) }
}

export function initGoogleAnalytics(win = defaultWindow()) {
  if (!win) return false
  ensureGtagStub(win)
  if (win.__qtGaConfigured) return false
  win.__qtGaConfigured = true
  win.gtag('js', new Date())
  const config = { send_page_view: false, content_group: CONTENT_GROUP }
  if (isGaDebug(win)) config.debug_mode = true
  win.gtag('config', GA_MEASUREMENT_ID, config)
  return true
}

export function injectGtagScript(win = defaultWindow()) {
  const doc = win?.document
  if (!doc?.createElement || !doc.head) return
  if (doc.getElementById?.(GTAG_SCRIPT_ID)) return
  const s = doc.createElement('script')
  s.id = GTAG_SCRIPT_ID
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  doc.head.appendChild(s)
}

export function scheduleGtagScriptLoad(win = defaultWindow()) {
  if (!win) return
  const start = () => injectGtagScript(win)
  const afterLoad = () => (typeof win.requestIdleCallback === 'function' ? win.requestIdleCallback(start, { timeout: 3000 }) : win.setTimeout(start, 1))
  if (win.document?.readyState === 'complete') afterLoad()
  else if (typeof win.addEventListener === 'function') win.addEventListener('load', afterLoad, { once: true })
  else afterLoad()
}

export function trackEvent(name, params = {}, win = defaultWindow()) {
  if (!win || !name || !params) return
  ensureGtagStub(win)
  const payload = { send_to: GA_MEASUREMENT_ID, ...sanitizeParams(params) }
  if (isGaDebug(win)) payload.debug_mode = true
  win.gtag('event', name, payload)
}

/** page_view virtual, no máximo uma vez por rota (SettingsRoot/StrictMode montam efeitos de novo) */
export function trackPageView(route, win = defaultWindow()) {
  if (!win) return false
  const params = buildPageViewParams({ ...route, origin: win.location?.origin || '' })
  const key = `${params.page_path}|${params.page_title}`
  if (win.__qtLastPageView === key) return false
  win.__qtLastPageView = key
  trackEvent('page_view', params, win)
  return true
}

/** guarda a intenção antes de navegar (a página vai descarregar) */
export function rememberNavIntent(intent, win = defaultWindow()) {
  try { win?.sessionStorage?.setItem(NAV_INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() })) } catch { /* modo privado */ }
}
/** lê e apaga a intenção; ignora se tiver mais de 60 s */
export function consumeNavIntent(win = defaultWindow(), now = Date.now()) {
  try {
    const raw = win?.sessionStorage?.getItem(NAV_INTENT_KEY)
    if (!raw) return null
    win.sessionStorage.removeItem(NAV_INTENT_KEY)
    const v = JSON.parse(raw)
    return v && now - (v.at || 0) < 60000 ? v : null
  } catch { return null }
}

/** emite page_view + function_open/ticker_select da carga atual (uma vez por carga) */
export function trackRouteLoad(route, win = defaultWindow()) {
  if (!win || win.__qtRouteTracked) return
  win.__qtRouteTracked = true
  trackPageView(route, win)
  const intent = consumeNavIntent(win)
  if (intent?.kind === 'ticker') {
    trackEvent('ticker_select', buildTickerSelectParams({ ticker: route.ticker || intent.ticker, functionCode: route.functionCode }), win)
  } else {
    trackEvent('function_open', buildFunctionOpenParams({ functionCode: route.functionCode, ticker: route.ticker, source: intent?.source || 'url' }), win)
  }
}
