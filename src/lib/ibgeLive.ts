/**
 * Agenda do IBGE buscada no navegador quando o eco.json publicado vier sem o Brasil.
 * A API de calendário do IBGE não aceita conexões dos runners do GitHub Actions, mas responde ao navegador
 * (CORS aberto). Porte de ibge_rows() em pipeline/build_macro.py: realizado/anterior vêm do ecst.json (SIDRA)
 * e do econ.json (SGS 433, IPCA); a mediana Focus (survey) só existe quando o pipeline consegue o calendário.
 */
import { getJSON } from './static'

const MAP: [RegExp, string, string, string][] = [
  [/Amplo 15/, 'ipca15', 'IPCA-15 MoM', '%'],
  [/Pre[çc]os ao Consumidor Amplo$/, 'ipca', 'IPCA MoM', '%'],
  [/Amostra de Domic[ií]lios Cont[ií]nua Mensal/, 'desemprego', 'Unemployment rate (PNAD, 3-mo)', '%'],
  [/Industrial Mensal.*F[ií]sica - Brasil/, 'pim', 'Industrial production MoM (sa)', '%'],
  [/Mensal de Com[ée]rcio$/, 'pmc', 'Retail sales MoM (sa)', '%'],
  [/Mensal de Servi[çc]os$/, 'pms', 'Services volume MoM (sa)', '%'],
  [/Contas Nacionais Trimestrais/, 'pib_qq', 'GDP QoQ (sa)', '%'],
]
const EN: Record<string, string> = {
  'Índice de Preços ao Produtor': 'Producer prices (IPP)', 'Levantamento Sistemático da Produção Agrícola': 'Crop production survey (LSPA)',
  'Pesquisa Nacional por Amostra de Domicílios Contínua Trimestral': 'PNAD quarterly labour survey', 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil': 'Construction costs (SINAPI)',
  'Índice Nacional de Preços ao Consumidor': 'INPC consumer prices', 'Pesquisa Industrial Mensal Produção Física - Regional': 'Industrial production – regional',
  'Pesquisa Mensal de Serviços - Regional': 'Services survey – regional', 'Pesquisa Industrial Mensal: Produção Física - Regional': 'Industrial production – regional',
  'Pesquisas Trimestrais do Abate de Animais, do Leite, do Couro e da Produção de Ovos de Galinha': 'Quarterly livestock surveys (slaughter, milk, hides, eggs)',
  'Índice de Preços ao Produtor - Indústrias Extrativas e de Transformação': 'Producer prices (IPP) – mining & manufacturing',
}
const p2 = (x: number) => String(x).padStart(2, '0')
const prevKey = (k: string, q: boolean) => { const y = +k.slice(0, 4), p = +k.slice(4); return p === 1 ? `${y - 1}${q ? '04' : '12'}` : `${y}${p2(p - 1)}` }
const mdY = (d: string) => `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`

/** 'dd/mm/YYYY HH:MM:SS' (UTC) → ISO em BRT (UTC−3, sem horário de verão desde 2019) */
export function ibgeTime(s: string) {
  const [d, t] = s.split(' '), [dd, mm, yy] = d.split('/').map(Number), [h, mi] = t.split(':').map(Number)
  const x = new Date(Date.UTC(yy, mm - 1, dd, h, mi) - 3 * 3600e3)
  return `${x.toISOString().slice(0, 16)}-03:00`
}

export function ibgeRows(items: any[], sidra: Record<string, Record<string, number>>, sgs433: Record<string, number>, today: string) {
  const out: any[] = []
  for (const it of items) {
    if (it.tipo_id !== 1) continue
    const t = String(it.titulo || '').trim(), time = ibgeTime(it.data_divulgacao)
    let y = it.ano_referencia_inicio, m = it.mes_referencia_inicio
    if (it.ano_referencia_fim && it.mes_referencia_fim) { y = it.ano_referencia_fim; m = it.mes_referencia_fim }
    let key = y && m ? `${y}${p2(m)}` : null
    const quarterly = /Contas Nacionais Trimestrais/.test(t)
    const r: any = { country: 'BR', time, event: t, period: key ? (quarterly ? `Q${Math.floor((m - 1) / 3) + 1}/${y}` : `${p2(m)}/${y}`) : null, agency: 'IBGE', survey: null, actual: null, prior: null, unit: null, key: false, live: true }
    const hit = MAP.find(([re]) => re.test(t))
    if (hit) {
      const [, sid, name, unit] = hit
      Object.assign(r, { event: name, unit, key: true, series: sid })
      const ser = sid === 'ipca' ? sgs433 : sidra[sid] || {}
      if (key && quarterly) key = `${y}${p2(Math.floor((m - 1) / 3) + 1)}`
      if (key) {
        if (key in ser && time.slice(0, 10) <= today) r.actual = ser[key]
        r.prior = ser[prevKey(key, quarterly)] ?? null
      }
    } else r.event = Object.entries(EN).find(([k]) => t === k || t.startsWith(k + ':'))?.[1] ?? t
    out.push(r)
  }
  return out
}

/** Linhas do IBGE para [from, to] direto da API (null se o navegador também não conseguir). */
export async function fetchIbgeLive(from: string, to: string, today: string): Promise<any[] | null> {
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000)
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v3/calendario/?qtd=500&de=${mdY(from)}&ate=${mdY(to)}`, { signal: ctl.signal })
    clearTimeout(tm)
    if (!r.ok) return null
    const items = (await r.json())?.items || []
    const [ec, en] = await Promise.all([getJSON<any>('ecst.json').catch(() => ({})), getJSON<any>('econ.json').catch(() => ({}))])
    const sidra: Record<string, Record<string, number>> = {}
    for (const s of ec?.sidra || []) sidra[s.id] = Object.fromEntries(s.points.map((p: any) => [p[0], p[2]]))
    const s433 = (en?.series || []).find((s: any) => s.id === 'SGS433')
    const sgs433: Record<string, number> = s433 ? Object.fromEntries(s433.points.map((p: any) => [p[0].slice(0, 4) + p[0].slice(5, 7), p[1]])) : {}
    return ibgeRows(items, sidra, sgs433, today).filter(e => e.time.slice(0, 10) >= from && e.time.slice(0, 10) <= to)
  } catch { return null }
}
