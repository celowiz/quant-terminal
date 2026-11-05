// FA (Financial Analysis): lógica pura das demonstrações completas (testada em fa.test.mjs).
import { BR_EN } from './faNames.mjs'

/** nome normalizado (sem acento, minúsculo, só letras/dígitos) — chave do glossário */
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Contas dos EUA em PT (termos contábeis usuais no Brasil). */
export const US_PT = {
  revenue: 'Receita', cost: 'Custo da receita', gross: 'Lucro bruto', opex: 'Despesas operacionais', rnd: 'Pesquisa e desenvolvimento',
  sga: 'Despesas com vendas, gerais e administrativas', opex_other: 'Outras despesas operacionais, líquidas', ebit: 'Resultado operacional',
  nonop: 'Resultado não operacional, líquido', int_income: 'Receitas de juros', interest: 'Despesas de juros', nonop_other: 'Outras receitas (despesas) não operacionais',
  pretax: 'Resultado antes dos tributos sobre o lucro', tax: 'Imposto de renda', net: 'Lucro líquido',
  assets: 'Ativo total', cur_assets: 'Ativo circulante', cash: 'Caixa e equivalentes de caixa', stinv: 'Aplicações financeiras de curto prazo',
  receivables: 'Contas a receber', inventory: 'Estoques', ca_other: 'Outros ativos circulantes', nca: 'Ativo não circulante',
  ppe: 'Imobilizado (líquido)', rou: 'Direito de uso de arrendamentos operacionais', goodwill: 'Ágio (goodwill)', intang: 'Intangível', nca_other: 'Outros ativos não circulantes',
  liab_total: 'Passivo total e patrimônio líquido', liab: 'Passivo total (exigível)', cur_liab: 'Passivo circulante', ap: 'Fornecedores',
  accrued: 'Despesas provisionadas a pagar', cl_other: 'Outros passivos circulantes', liab_nc: 'Passivo não circulante', lt_debt: 'Dívida de longo prazo',
  ncl_other: 'Outros passivos não circulantes', debt: 'Dívida total', equity: 'Patrimônio líquido', apic: 'Capital social e reservas de capital',
  retained: 'Lucros (prejuízos) acumulados', aoci: 'Outros resultados abrangentes acumulados', treasury: 'Ações em tesouraria', minority: 'Participação de não controladores',
  cfo: 'Caixa líquido das atividades operacionais', da: 'Depreciação e amortização', sbc: 'Remuneração baseada em ações', deftax: 'Tributos diferidos',
  cfi: 'Caixa líquido das atividades de investimento', capex: 'Aquisição de imobilizado (capex)', acq: 'Aquisições de empresas, líquidas do caixa adquirido',
  inv_buy: 'Aquisição de investimentos', inv_sell: 'Venda e vencimento de investimentos', cff: 'Caixa líquido das atividades de financiamento',
  debt_iss: 'Captação de dívida', debt_rep: 'Pagamento de dívida', buyback: 'Recompra de ações', divpaid: 'Dividendos pagos',
  fx: 'Variação cambial sobre o caixa', netchg: 'Aumento (redução) de caixa', fcf: 'Fluxo de caixa livre (operacional + capex)',
}

const TABS = {
  DRE: ['Income statement', 'DRE'], BPA: ['Balance sheet – assets', 'Balanço – ativo'], BPP: ['Balance sheet – liabilities & equity', 'Balanço – passivo e PL'],
  DFC_MI: ['Cash flow', 'Fluxo de caixa'], DFC_MD: ['Cash flow (direct)', 'Fluxo de caixa (direto)'],
  IS: ['Income statement', 'DRE'], BSA: ['Balance sheet – assets', 'Balanço – ativo'], BSL: ['Balance sheet – liabilities & equity', 'Balanço – passivo e PL'], CF: ['Cash flow', 'Fluxo de caixa'],
}
export const tabName = (key, fallback, pt) => (TABS[key] ? TABS[key][pt ? 1 : 0] : fallback)

/** Nome da conta no idioma: {text, asFiled}. asFiled = nome publicado sem tradução curada (só em EN, contas próprias da empresa). */
export function accountName(row, us, pt) {
  if (us) return { text: pt ? (US_PT[row.code] || row.name) : row.name, asFiled: false }
  if (pt) return { text: row.name, asFiled: false }
  const t = BR_EN[norm(row.name)]
  return t ? { text: t, asFiled: false } : { text: row.name, asFiled: true }
}

/** Níveis relativos: o nível mais alto da demonstração vira 1 (a DRE/DFC brasileira começa no 2). */
export function relLevels(rows) {
  const m = Math.min(...rows.map(r => r.level))
  return rows.map(r => ({ ...r, rel: r.level - (Number.isFinite(m) ? m : 1) + 1 }))
}

/** Índice do período um ano antes (mesmo mês, ano − 1, ±20 dias); -1 se não houver. */
export function yearAgoIndex(periods, i) {
  const t = Date.parse(periods[i]); if (!Number.isFinite(t)) return -1
  const target = t - 365.25 * 864e5
  let best = -1, bd = 20 * 864e5
  periods.forEach((p, j) => { const d = Math.abs(Date.parse(p) - target); if (j !== i && d <= bd) { best = j; bd = d } })
  return best
}

/** Variação a/a sem ambiguidade de sinal:
 *  pct = |atual| ÷ |anterior| − 1 (o tamanho da linha cresceu ou encolheu), dir = sinal de (atual − anterior) (efeito no resultado: + melhora, − piora).
 *  Troca de sinal ou base zero → nm (não significativo). */
export function yoyChange(cur, prev) {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null
  if (prev === 0 || (cur !== 0 && Math.sign(cur) !== Math.sign(prev))) return { pct: null, dir: Math.sign(cur - prev), nm: true }
  return { pct: (Math.abs(cur) / Math.abs(prev) - 1) * 100, dir: Math.sign(cur - prev), nm: false }
}

/** Ordem de exibição: do mais recente ao mais antigo (índices no vetor cronológico). */
export const newestFirst = periods => periods.map((_, i) => i).reverse()

/** Pontos do gráfico: só períodos com valor (lacunas não viram zero). */
export const chartPoints = (periods, vals, div = 1e6) => periods.map((p, i) => [p, vals[i]]).filter(([, v]) => v != null && Number.isFinite(v)).map(([p, v]) => ({ time: p, value: v / div }))
