/** ECO: rótulos de período e unidade no estilo do ECST ('Sep 26' / 'set 26', 'Q3 26' / '3T26'), a partir dos formatos
 *  variados que os calendários oficiais publicam. Formato desconhecido volta como veio (nunca inventa período). */
const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const ORD = { first: 1, second: 2, third: 3, fourth: 4, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 }

const mon = (m, pt) => (pt ? PT : EN)[m - 1]
const yy = y => String(y).slice(-2)
export const monthLabel = (m, y, pt) => `${mon(m, pt)} ${yy(y)}`
export const quarterLabel = (q, y, pt) => pt ? `${q}T${yy(y)}` : `Q${q} ${yy(y)}`
const dayLabel = (d, m, pt) => pt ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` : `${+d} ${mon(m, false)}`
const monIdx = s => { const i = FULL.indexOf(String(s).toLowerCase()); return i < 0 ? 0 : i + 1 }

/** período do eco.json → rótulo curto no idioma ('pt' | 'en') */
export function ecoPeriod(p, lang = 'en') {
  if (p == null || p === '') return ''
  const s = String(p).trim(), pt = lang === 'pt'
  let m
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return monthLabel(+m[1], m[2], pt)
  if ((m = s.match(/^([A-Za-z]+) (\d{4})$/)) && monIdx(m[1])) return monthLabel(monIdx(m[1]), m[2], pt)
  if ((m = s.match(/^Q([1-4])\/(\d{4})$/))) return quarterLabel(+m[1], m[2], pt)
  if ((m = s.match(/^([A-Za-z0-9]+) quarter (\d{4})$/i)) && ORD[m[1].toLowerCase()]) return quarterLabel(ORD[m[1].toLowerCase()], m[2], pt)
  if ((m = s.match(/^([A-Za-z]+) to ([A-Za-z]+) (\d{4})$/)) && monIdx(m[1]) && monIdx(m[2])) return `${mon(monIdx(m[1]), pt)}–${monthLabel(monIdx(m[2]), m[3], pt)}`
  // semana terminada em (séries semanais)
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return pt ? `sem. ${dayLabel(+m[1], +m[2], true)}` : `w/e ${dayLabel(+m[1], +m[2], false)}`
  // intervalo de dias (prévias semanais)
  if ((m = s.match(/^(\d{2})\/(\d{2})–(\d{2})\/(\d{2})$/))) {
    if (pt) return `${m[1]}/${m[2]}–${m[3]}/${m[4]}`
    return m[2] === m[4] ? `${+m[1]}–${+m[3]} ${mon(+m[2], false)}` : `${dayLabel(+m[1], +m[2], false)}–${dayLabel(+m[3], +m[4], false)}`
  }
  // n-ésima semana/quadrissemana do mês
  if ((m = s.match(/^W([1-5]) (\d{1,2})\/(\d{4})$/))) return pt ? `S${m[1]} ${monthLabel(+m[2], m[3], true)}` : `W${m[1]} ${monthLabel(+m[2], m[3], false)}`
  // reunião n do ano (Copom)
  if ((m = s.match(/^R(\d{1,2})\/(\d{4})$/))) return pt ? `${m[1]}ª reun. ${yy(m[2])}` : `Mtg ${m[1]} ${yy(m[2])}`
  return s
}

const UNIT_PT = { '% y/y': '% a/a', '% q/q': '% t/t', '% m/m': '% m/m', k: 'mil', 'US$ bn': 'US$ bi', 'US$ mn': 'US$ mi', 'R$ bn': 'R$ bi' }
/** unidade do eco.json → rótulo no idioma */
export const ecoUnit = (u, lang = 'en') => u == null ? '' : lang === 'pt' ? (UNIT_PT[u] ?? u) : u
