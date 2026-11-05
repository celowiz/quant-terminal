// VAL: lógica pura (testada em val.test.mjs). Valor de mercado da companhia (todas as classes), EBITDA dos EUA derivado,
// múltiplos com n.s. quando a base é negativa/nula, divergência contra a referência de mercado, setores curados, pares sem classes duplicadas.

const sp = s => String(s || '').replace(/\s+/g, ' ').trim()

/** setores/subsetores B3 (nomes abreviados do cadastro) e EUA → [EN, PT] curados */
const BR_SECTOR = {
  'Bens Indls': ['Industrial goods', 'Bens industriais'],
  'Cons N Básico': ['Non-cyclical consumer', 'Consumo não cíclico'],
  'Cons N Cíclico': ['Non-cyclical consumer', 'Consumo não cíclico'],
  'Consumo Cíclico': ['Cyclical consumer', 'Consumo cíclico'],
  'Diversos': ['Diversified', 'Diversos'],
  'Financ e Outros': ['Financials and others', 'Financeiro e outros'],
  'Financeiro e Outros': ['Financials and others', 'Financeiro e outros'],
  'Mats Básicos': ['Basic materials', 'Materiais básicos'],
  'Petróleo, Gás e Biocombustíveis': ['Oil, gas and biofuels', 'Petróleo, gás e biocombustíveis'],
  'Saúde': ['Health care', 'Saúde'],
  'Tec.Informação': ['Information technology', 'Tecnologia da informação'],
  'Telecomunicação': ['Telecommunications', 'Telecomunicações'],
  'Utilidade Públ': ['Utilities', 'Utilidade pública'],
  'Mat Transporte': ['Transport equipment', 'Material de transporte'],
  'Máqs e Equips': ['Machinery and equipment', 'Máquinas e equipamentos'],
  'Transporte': ['Transportation', 'Transporte'],
  'Alimentos Processados': ['Processed foods', 'Alimentos processados'],
  'Bebidas': ['Beverages', 'Bebidas'],
  'Comércio Distr.': ['Retail and distribution', 'Comércio e distribuição'],
  'Pr Pessoal Limp': ['Personal care and cleaning products', 'Produtos de uso pessoal e de limpeza'],
  'Comércio': ['Retail', 'Comércio'],
  'Tecid Vest Calç': ['Textiles, apparel and footwear', 'Tecidos, vestuário e calçados'],
  'Constr Civil': ['Construction', 'Construção civil'],
  'Viagens e Lazer': ['Travel and leisure', 'Viagens e lazer'],
  'Explor Imóveis': ['Real estate', 'Exploração de imóveis'],
  'Holdings Divers': ['Diversified holdings', 'Holdings diversificadas'],
  'Interms Financs': ['Financial intermediaries', 'Intermediários financeiros'],
  'Previd Seguros': ['Pension and insurance', 'Previdência e seguros'],
  'Serviços Financeiros Diversos': ['Diversified financial services', 'Serviços financeiros diversos'],
  'Madeira e Papel': ['Wood and paper', 'Madeira e papel'],
  'Mineração': ['Mining', 'Mineração'],
  'Sid Metalurgia': ['Steel and metallurgy', 'Siderurgia e metalurgia'],
  'SM Hosp An.Diag': ['Medical, hospital and diagnostic services', 'Serviços médico-hospitalares, análises e diagnósticos'],
  'Programas Servs': ['Software and services', 'Programas e serviços'],
  'Energ Elétrica': ['Electric power', 'Energia elétrica'],
  'Água Saneamento': ['Water and sanitation', 'Água e saneamento'],
}
const US_SECTOR = {
  'Communication Services': 'Serviços de comunicação', 'Consumer Cyclical': 'Consumo cíclico', 'Consumer Defensive': 'Consumo não cíclico',
  'Energy': 'Energia', 'Financial Services': 'Serviços financeiros', 'Healthcare': 'Saúde', 'Industrials': 'Indústria', 'Technology': 'Tecnologia',
  'Aerospace & Defense': 'Aeroespacial e defesa', 'Auto Manufacturers': 'Montadoras', 'Banks - Diversified': 'Bancos diversificados',
  'Beverages - Non-Alcoholic': 'Bebidas não alcoólicas', 'Communication Equipment': 'Equipamentos de comunicação',
  'Consumer Electronics': 'Eletrônicos de consumo', 'Credit Services': 'Serviços de crédito', 'Discount Stores': 'Varejo de descontos',
  'Drug Manufacturers - General': 'Farmacêuticas', 'Entertainment': 'Entretenimento', 'Healthcare Plans': 'Planos de saúde',
  'Home Improvement Retail': 'Varejo de materiais de construção', 'Household & Personal Products': 'Produtos domésticos e de higiene pessoal',
  'Insurance - Diversified': 'Seguros diversificados', 'Internet Content & Information': 'Conteúdo e informação na internet',
  'Internet Retail': 'Varejo on-line', 'Oil & Gas Integrated': 'Petróleo e gás integrado', 'Semiconductors': 'Semicondutores',
  'Software - Application': 'Software de aplicação', 'Software - Infrastructure': 'Software de infraestrutura', 'Telecom Services': 'Serviços de telecomunicações',
}
/** "Financ e Outros / Interms Financs" → "Financials and others · Financial intermediaries"; parte sem nome curado fica como no cadastro */
export function sectorName(raw, pt) {
  const s = sp(raw)
  if (!s) return ''
  if (US_SECTOR[s]) return pt ? (US_SECTOR[s] || s) : s.replace(/ - /g, ' – ')
  return s.split('/').map(x => sp(x)).filter(Boolean).map(x => BR_SECTOR[x] ? BR_SECTOR[x][pt ? 1 : 0] : x)
    .filter((x, i, a) => a.indexOf(x) === i).join(' · ')
}

/** EBITDA do trimestre/ano: o informado; senão (EUA) resultado operacional + D&A quando os dois existem (marcado como calculado); senão null */
export function ebitdaOf(r) {
  if (!r) return { v: null, derived: false }
  if (r.ebitda != null) return { v: r.ebitda, derived: !!r.da_derived || r.ebitda_derived === true }
  if (r.ebit != null && r.da != null) return { v: r.ebit + r.da, derived: true }
  return { v: null, derived: false }
}

/** último preço até a data t numa série [[iso, px], ...] ordenada */
export function pxAt(series, t) {
  if (!series?.length) return null
  let lo = 0, hi = series.length - 1, ans = null
  while (lo <= hi) { const m = (lo + hi) >> 1; if (series[m][0] <= t) { ans = series[m][1]; lo = m + 1 } else hi = m - 1 }
  return ans
}

/** Valor de mercado da companhia.
 *  units (11): ações equivalentes do pipeline × preço da unit; sem equivalência → null (motivo 'unit').
 *  Brasil: ON × preço ON + PN × preço PN (ações em tesouraria descontadas pro rata); falta preço de classe com ações → null ('class').
 *  EUA: ações em circulação (todas as classes) × preço. */
export function companyMcap(shares, t, own, cls, us) {
  if (!shares) return { v: null, reason: 'shares' }
  const p = pxAt(own.series, t)
  if (p == null) return { v: null, reason: 'price' }
  if ('equiv' in shares) return shares.equiv ? { v: p * shares.equiv, reason: null } : { v: null, reason: 'unit' }
  if (us || shares.on == null) { const n = (shares.total || 0) - (shares.treasury || 0); return n > 0 ? { v: p * n, reason: null } : { v: null, reason: 'shares' } }
  const pick = k => own.kind === k ? p : pxAt(cls[k], t)
  const on = shares.on || 0, pn = shares.pn || 0
  const pOn = on ? pick('on') : 0, pPn = pn ? pick('pn') : 0
  if (pOn == null || pPn == null) return { v: null, reason: 'class' }
  const tot = on + pn, adj = tot ? 1 - (shares.treasury || 0) / tot : 1
  return { v: (on * pOn + pn * pPn) * adj, reason: null }
}

/** classe pelo dígito do código B3: 3 = ON; 4/5/6/7/8 = PN; 11 = unit */
export function classOf(ticker) {
  const m = String(ticker).toUpperCase().replace(/\.SA$/, '').match(/^([A-Z]{4})(\d+)$/)
  if (!m) return { base: null, kind: null }
  const n = +m[2]
  return { base: m[1], kind: n === 3 ? 'on' : n >= 4 && n <= 8 ? 'pn' : n === 11 ? 'unit' : null }
}

/** múltiplo com base: null quando falta dado; 'nm' quando a base é ≤ 0 (lucro/EBITDA/PL negativos) */
export function multiple(num, den) {
  if (num == null || den == null) return null
  if (den <= 0 || num < 0) return 'nm'
  return num / den
}

/** divergência relevante entre o valor calculado e a referência de mercado (> tol, em fração) */
export function diverges(a, b, tol = 0.2) {
  if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b) || b === 0) return false
  return Math.abs(a / b - 1) > tol
}

/** pares: uma linha por companhia (CNPJ no Brasil, CIK nos EUA), ficando a classe mais negociada (ou a primeira) */
export function dedupePeers(rows, keyOf, liq) {
  const best = new Map()
  for (const r of rows) {
    const k = keyOf(r) || JSON.stringify(r)
    const cur = best.get(k)
    if (!cur || (liq(r) || 0) > (liq(cur) || 0)) best.set(k, r)
  }
  return rows.filter(r => best.get(keyOf(r) || JSON.stringify(r)) === r)
}
