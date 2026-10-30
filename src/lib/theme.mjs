// Temas de cor (P3): âmbar clássico (padrão, identidade), verde fósforo, alto contraste e claro,
// mais cores de alta/baixa seguras para daltonismo (Okabe-Ito). Módulo puro (.mjs): usado pelo
// runtime (tc) e pelo plugin PostCSS que gera as regras html[data-qt=…] a partir do CSS compilado.

export const THEMES = ['amber', 'green', 'contrast', 'light']
export const UPDOWN = ['std', 'cb']
export const DEFAULT_KEY = 'amber.std'

/** chave do tema a partir das preferências salvas (valores inválidos caem no padrão) */
export function themeKey(s) {
  const th = THEMES.includes(s?.theme) ? s.theme : 'amber'
  const ud = s?.ud === 'cb' ? 'cb' : 'std'
  return `${th}.${ud}`
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = t => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255))
}

// Okabe-Ito: azul (alta) e vermelhão (baixa), distinguíveis em protanopia/deuteranopia
const CB = { dark: { up: [86, 180, 233], down: [230, 97, 0] }, light: { up: [0, 114, 178], down: [192, 64, 0] } }

/** mapeia um RGB (0–255) do tema padrão para o tema `key` ("tema.ud") */
export function mapRgb([r, g, b], key) {
  if (!key || key === DEFAULT_KEY) return [r, g, b]
  const [th, ud] = key.split('.')
  let [h, s, l] = rgbToHsl(r, g, b)
  if (ud === 'cb' && s >= 0.4) {
    const pal = CB[th === 'light' ? 'light' : 'dark']
    if (h >= 75 && h <= 165 && l >= 0.3 && l <= 0.8) return pal.up
    if ((h >= 340 || h <= 10) && s >= 0.45 && l >= 0.35 && l <= 0.8) return pal.down
  }
  const neutral = s < 0.12 || l > 0.95 || (l < 0.2 && s < 0.3)
  const darkTint = !neutral && l < 0.2
  const amberFam = h >= 15 && h <= 55 && s >= 0.3
  if (th === 'amber') return [r, g, b]
  if (th === 'green') {
    if (neutral) {
      if (l < 0.02) return [r, g, b]
      return hslToRgb(l < 0.5 ? 140 : 120, l < 0.5 ? 0.18 : 0.35, l)
    }
    if (amberFam) return hslToRgb(135, Math.max(s, 0.85), clamp(l, 0.08, 0.62))
    return [r, g, b]
  }
  if (th === 'contrast') {
    if (neutral) {
      const nl = l < 0.1 ? 0 : l < 0.45 ? Math.min(0.6, l * 1.8) : 0.8 + (l - 0.45) * 0.4
      return hslToRgb(h, 0, nl)
    }
    if (darkTint) return hslToRgb(h, 1, Math.min(0.16, l * 1.6))
    return hslToRgb(h, 1, clamp(l, 0.55, 0.7))
  }
  if (th === 'light') {
    if (neutral) return hslToRgb(h, s, 1 - l)
    if (darkTint || l < 0.3) return hslToRgb(h, s, clamp(1 - l, 0.86, 0.97))
    const cap = h >= 40 && h <= 75 ? 0.36 : 0.42
    return hslToRgb(h, Math.max(s, 0.6), Math.min(l, cap))
  }
  return [r, g, b]
}

const hex2 = n => n.toString(16).padStart(2, '0')
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

/** "#rgb" | "#rrggbb" | "#rrggbbaa" → mesma forma no tema (alfa preservado, caixa preservada só no padrão) */
export function mapHex(hex, key) {
  if (!key || key === DEFAULT_KEY) return hex
  const m = /^#([0-9a-f]{3,8})$/i.exec(String(hex).trim())
  if (!m || ![3, 4, 6, 8].includes(m[1].length)) return hex
  let x = m[1]
  if (x.length <= 4) x = x.split('').map(c => c + c).join('')
  const rgb = [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16))
  const a = x.length === 8 ? x.slice(6) : ''
  return toHex(mapRgb(rgb, key)) + a
}

// oklch (Tailwind v4 usa oklch para as cores nomeadas) → sRGB
function oklchToRgb(L, C, H) {
  const hr = (H * Math.PI) / 180, a = C * Math.cos(hr), b = C * Math.sin(hr)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3
  const lin = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
  return lin.map(v => {
    v = clamp(v, 0, 1)
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
    return Math.round(clamp(c, 0, 1) * 255)
  })
}

const RE_HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const RE_RGB = /rgba?\(\s*(\d{1,3})(\s*,\s*|\s+)(\d{1,3})(\s*,\s*|\s+)(\d{1,3})/g
const RE_OKLCH = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(deg)?\s*(\/\s*[^)]+)?\)/g
const NAMED = { black: '#000000', white: '#ffffff' }

/** troca todas as cores de um valor CSS; devolve o mesmo texto quando nada muda */
export function mapCssValue(v, key) {
  if (!key || key === DEFAULT_KEY) return v
  let out = v.replace(RE_HEX, m => mapHex(m, key))
  out = out.replace(RE_RGB, (m, r, s1, g, s2, b) => {
    const [R, G, B] = mapRgb([+r, +g, +b], key)
    return m.replace(/\d{1,3}(\s*,\s*|\s+)\d{1,3}(\s*,\s*|\s+)\d{1,3}$/, `${R}${s1}${G}${s2}${B}`)
  })
  out = out.replace(RE_OKLCH, (m, L, pct, C, H, _d, alpha) => {
    const rgb = mapRgb(oklchToRgb(pct ? +L / 100 : +L, +C, +H), key)
    return alpha ? `rgb(${rgb.join(' ')} ${alpha.trim()})` : toHex(rgb)
  })
  out = out.replace(/(^|[\s,(])(black|white)(?=$|[\s,)!;])/g, (m, p, n) => p + mapHex(NAMED[n], key))
  return out
}

/** propriedades CSS que carregam cor (e variáveis custom, que no Tailwind v4 guardam a paleta) */
export const isColorProp = p => p.startsWith('--') || /(^|-)(color|background|border|outline|shadow|fill|stroke|caret|decoration)/.test(p)

/** seletor sob o tema: html/:root viram html[data-qt=…] e o resto ganha o prefixo */
export function scopeSelector(sel, key) {
  const pre = `html[data-qt="${key}"]`
  return sel.split(',').map(x => x.trim()).filter(Boolean).map(x => {
    if (/^(:root|html|:host)\b/.test(x)) return x.replace(/^(:root|html|:host)/, pre)
    return `${pre} ${x}`
  }).join(',')
}
