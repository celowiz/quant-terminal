// CF (Company Filings): lógica pura da lista de documentos — busca sem acento, versões, grupos e ordenação.
// Módulo .mjs testado com `node --test` (filings.test.mjs); a View (views/fn/cf.tsx) só apresenta.

/** minúsculas e sem acentos/cedilha: "Reunião" → "reuniao" */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Rótulos curtos em inglês (escritos à mão) para as categorias brasileiras; o nome original segue visível. */
export const BR_GLOSS = {
  'Comunicado ao Mercado': 'Market notice',
  'Fato Relevante': 'Material fact',
  'Valores Mobiliários negociados e detidos (art. 11 da Instr. CVM nº 358)': 'Insider holdings report',
  'Reunião da Administração': 'Board / management meeting',
  'Dados Econômico-Financeiros': 'Financial statements & results',
  'Assembleia': "Shareholders' meeting",
  'Relatório Proventos': 'Dividend report',
  'Comunicação sobre Transação entre Partes Relacionadas': 'Related-party transaction',
  'Contratos de Indenidade': 'Indemnity agreements',
  'Aviso aos Acionistas': 'Notice to shareholders',
  'Informação Prestada às Bolsas Estrangeiras': 'Filing to foreign exchanges',
  'Calendário de Eventos Corporativos': 'Corporate events calendar',
  'Aviso aos Debenturistas': 'Notice to debenture holders',
  'Regimento interno de Comitês': 'Committee charter',
  'Política de Gerenciamento de Riscos': 'Risk management policy',
  'Estatuto Social': 'Bylaws',
  'Documentos de Oferta de Distribuição Pública': 'Public offering documents',
  'Ato Homologatório emitido pelo Banco Central': 'Central bank approval',
  'Política de Negociação de Valores Mobiliários': 'Securities trading policy',
  'Política de Divulgação de Ato ou Fato Relevante': 'Disclosure policy',
  'Política de Remuneração': 'Compensation policy',
  'Comunicação sobre demandas societárias': 'Corporate litigation notice',
  'Política de Transações entre Partes Relacionadas': 'Related-party policy',
  'Código de Conduta': 'Code of conduct',
  'Relatório de Sustentabilidade': 'Sustainability report',
  'Relato Integrado': 'Integrated report',
  'Regimento Interno da Diretoria': 'Executive board charter',
  'Regimento interno do Conselho de Administração': 'Board charter',
  'Escrituras e aditamentos de debêntures': 'Debenture indentures',
  'Carta Anual de Governança Corporativa': 'Annual governance letter',
  'Regimento Interno do Comitê de Auditoria Estatutário': 'Audit committee charter',
  'Política de Sustentabilidade': 'Sustainability policy',
  'Política de Negociação das Ações da Companhia': 'Share trading policy',
  'Regimento interno do Conselho Fiscal': 'Fiscal council charter',
  'Política para Contratação de Serviços Extra-Auditoria de seus Auditores Independentes': 'Non-audit services policy',
  'Política de indicação': 'Nomination policy',
  'Política de Destinação de Resultados': 'Earnings allocation policy',
  'Política de Dividendos': 'Dividend policy',
  'Plano de Remuneração Baseado em Ações': 'Stock-based compensation plan',
  'Convenção de grupos de sociedades': 'Group agreement',
  'Relatório de Informações Financeiras Relacionadas à Sustentabilidade - Padrão ISSB': 'Sustainability financial disclosures',
}
/** Rótulo curto em inglês da categoria (só BR; formulários dos EUA já são o próprio nome). null = sem rótulo. */
export const gloss = (cat) => BR_GLOSS[cat] ?? null

export const GROUPS = ['results', 'material', 'meetings', 'dividends', 'other']
const US_RESULTS = /^10-[KQ](\/A)?$/
const DIV = /provent|dividend|juros sobre (o )?capital|jcp|rendiment/i

/** Grupo fixo do documento. US: 10-K/10-Q e 8-K com item 2.02 (Results of Operations) = resultados; 8-K = fatos relevantes. */
export function groupOf(f, us) {
  const cat = String(f?.cat ?? ''), sub = String(f?.subject ?? ''), type = String(f?.type ?? '')
  if (us) {
    if (US_RESULTS.test(cat) || (/^8-K/.test(cat) && /Results of Operations/i.test(sub))) return 'results'
    if (/^DEF 14A/.test(cat) || (/^8-K/.test(cat) && /^Submission of Matters to a Vote/i.test(sub))) return 'meetings'
    if (/^8-K/.test(cat)) return 'material'
    return 'other'
  }
  if (cat === 'Dados Econômico-Financeiros' && !/Agente Fiduci|Rating/i.test(type)) return 'results'
  if (cat === 'Fato Relevante') return 'material'
  if (cat === 'Assembleia' || cat === 'Reunião da Administração') return 'meetings'
  if (cat === 'Relatório Proventos' || (cat === 'Aviso aos Acionistas' && DIV.test(sub + ' ' + type))) return 'dividends'
  return 'other'
}
/** Documento-chave (destacado): resultados e fatos relevantes (BR); nos EUA, resultados. */
export const isKey = (f, us) => { const g = groupOf(f, us); return g === 'results' || (!us && g === 'material') }

/** Texto pesquisável: assunto, tipo, categoria e o rótulo em inglês (campos nulos são ignorados). */
export const searchText = (f) => norm([f?.subject, f?.type, f?.species, f?.cat, gloss(f?.cat)].filter(x => typeof x === 'string' && x).join(' '))
/** Busca sem acento e sem caixa; todas as palavras precisam aparecer. Consulta vazia casa tudo. */
export function matches(f, q) {
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const s = searchText(f)
  return words.every(w => s.includes(w))
}

const vnum = (f) => { const n = parseInt(f?.version, 10); return Number.isFinite(n) ? n : 1 }
const vkey = (f) => [f?.cat, f?.type, f?.species, f?.subject, f?.ref].map(x => x ?? '').join('\u0001')
/**
 * Junta reapresentações do mesmo documento (mesma categoria, tipo, assunto e período de referência; versões diferentes):
 * fica a versão mais alta (empate → data mais recente) e as anteriores vão em `older` (mais nova primeiro).
 * Documentos com a mesma versão continuam separados (são anexos distintos). Ordem de entrada preservada pela cabeça.
 */
export function collapseVersions(list) {
  const by = new Map()
  for (const f of list || []) { const k = vkey(f); if (!by.has(k)) by.set(k, []); by.get(k).push(f) }
  const headOf = new Map()
  for (const g of by.values()) {
    if (g.length < 2) continue
    const top = Math.max(...g.map(vnum))
    if (g.every(f => vnum(f) === top)) continue
    const heads = g.filter(f => vnum(f) === top).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    const older = g.filter(f => vnum(f) < top).sort((a, b) => vnum(b) - vnum(a) || String(b.date).localeCompare(String(a.date)))
    headOf.set(heads[0], older)
    for (const f of older) headOf.set(f, null)
  }
  const out = []
  for (const f of list || []) {
    const o = headOf.get(f)
    if (o === null) continue
    out.push({ ...f, older: o || [] })
  }
  return out
}

/** Contagem por categoria, da maior para a menor (empate: nome). */
export function categoryCounts(list) {
  const m = new Map()
  for (const f of list || []) m.set(f.cat, (m.get(f.cat) || 0) + 1)
  return [...m.entries()].map(([cat, n]) => ({ cat, n })).sort((a, b) => b.n - a.n || String(a.cat).localeCompare(String(b.cat)))
}
export function groupCounts(list, us) {
  const c = Object.fromEntries(GROUPS.map(g => [g, 0]))
  for (const f of list || []) c[groupOf(f, us)]++
  return c
}
/** Primeira e última data de entrega na lista. */
export function dateRange(list) {
  const d = (list || []).map(f => f?.date).filter(x => typeof x === 'string' && x).sort()
  return d.length ? { from: d[0], to: d[d.length - 1] } : null
}
/** Ordenação: 'date' (mais recente primeiro) ou 'cat' (categoria pela ordem dada — ex.: contagem —, depois data). */
export function sortFilings(list, by, catOrder) {
  const a = [...(list || [])]
  const byDate = (x, y) => String(y.date).localeCompare(String(x.date))
  if (by !== 'cat') return a.sort(byDate)
  const idx = new Map((catOrder || []).map((c, i) => [c, i]))
  const pos = (c) => idx.has(c) ? idx.get(c) : Number.MAX_SAFE_INTEGER
  return a.sort((x, y) => pos(x.cat) - pos(y.cat) || String(x.cat).localeCompare(String(y.cat)) || byDate(x, y))
}
/** Tipo exibível: nulo, vazio, '—' ou igual à categoria não aparece. */
export const showType = (f) => { const t = f?.type; return typeof t === 'string' && t.trim() && t.trim() !== '—' && t !== f?.cat ? t : null }
/** Período de referência exibível: só quando difere da data de entrega. */
export const showRef = (f) => (typeof f?.ref === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f.ref) && f.ref.slice(0, 10) !== String(f.date).slice(0, 10) ? f.ref.slice(0, 10) : null)
