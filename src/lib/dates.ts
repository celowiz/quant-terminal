/** Datas exibidas conforme o idioma: PT = DD/MM (padrão brasileiro); EN = "29 Oct 26" (sem ambiguidade entre DD/MM e MM/DD).
 *  Entrada: ISO 'AAAA-MM-DD' (ou com hora; só a data é usada). */
import { lang } from './settings'

const MON3_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON3_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pt = () => lang() === 'pt'
const ok = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}/.test(s)
const mon = (s: string) => (pt() ? MON3_PT : MON3_EN)[+s.slice(5, 7) - 1]

/** 29/10/26 (PT) · 29 Oct 26 (EN) */
export const fmtDate = (s?: string | null) => !ok(s) ? (s || '—') : pt() ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : `${s.slice(8, 10)} ${mon(s)} ${s.slice(2, 4)}`
/** 29/10/2026 (PT) · 29 Oct 2026 (EN) */
export const fmtDateFull = (s?: string | null) => !ok(s) ? (s || '—') : pt() ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : `${s.slice(8, 10)} ${mon(s)} ${s.slice(0, 4)}`
/** 29/10 (PT) · 29 Oct (EN) */
export const fmtDayMonth = (s?: string | null) => !ok(s) ? (s || '—') : pt() ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : `${+s.slice(8, 10)} ${mon(s)}`
/** set 26 (PT) · Sep 26 (EN) */
export const fmtMonth = (s?: string | null) => !s || s.length < 7 ? (s || '—') : `${(pt() ? MON3_PT : MON3_EN)[+s.slice(5, 7) - 1]} ${s.slice(2, 4)}`
/** nome curto do mês (1–12) no idioma */
export const monthAbbr = (m: number) => (pt() ? MON3_PT : MON3_EN)[m - 1]
/** trimestre: 2T26 (PT) · Q2 26 (EN) */
export const fmtQuarter = (q: number, y: string | number) => { const yy = String(y).slice(-2); return lang() === 'pt' ? `${q}T${yy}` : `Q${q} ${yy}` }
/** 'DD/MM/AAAA' → 'AAAA-MM-DD' (para dados que já chegam no formato brasileiro) */
export const brToIso = (s?: string | null) => { const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s || null }
