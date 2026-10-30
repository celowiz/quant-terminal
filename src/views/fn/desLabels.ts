/** DES: rótulos amigáveis (EN/PT) para os campos de cadastro (CVM e SEC) e tradução dos valores codificados da CVM. */
import { lang } from '../../lib/settings'

const pt = () => lang() === 'pt'
export const L = (en: string, ptS: string) => (pt() ? ptS : en)

const CVM_KEYS: Record<string, [string, string]> = {
  DENOM_SOCIAL: ['Legal name', 'Razão social'], DENOM_COMERC: ['Trade name', 'Nome comercial'],
  DT_REG: ['Registered with CVM', 'Registro na CVM'], DT_CONST: ['Founded', 'Data de constituição'],
  SIT: ['Registration status', 'Situação do registro'], CD_CVM: ['CVM code', 'Código CVM'],
  SETOR_ATIV: ['Sector', 'Setor de atividade'], TP_MERC: ['Market', 'Mercado'],
  CATEG_REG: ['Issuer category', 'Categoria de registro'], SIT_EMISSOR: ['Issuer status', 'Situação do emissor'],
  CONTROLE_ACIONARIO: ['Shareholder control', 'Controle acionário'], LOGRADOURO: ['Address', 'Endereço'],
  COMPL: ['Address line 2', 'Complemento'], BAIRRO: ['District', 'Bairro'], MUN: ['City', 'Município'],
  UF: ['State', 'UF'], CEP: ['Postal code', 'CEP'], DDD_TEL: ['Area code', 'DDD'], TEL: ['Phone', 'Telefone'],
  EMAIL: ['Email', 'E-mail'], TP_RESP: ['Officer role', 'Cargo do responsável'], RESP: ['IR officer', 'Diretor de RI'],
  EMAIL_RESP: ['IR officer email', 'E-mail do diretor de RI'], AUDITOR: ['Auditor', 'Auditor'],
}
const SEC_KEYS: Record<string, [string, string]> = {
  DENOM_SOCIAL: ['Legal name', 'Razão social'], CIK: ['CIK', 'CIK'], SIC: ['SIC code', 'Código SIC'],
  SETOR_ATIV: ['Industry (SIC)', 'Indústria (SIC)'], EIN: ['Employer ID (EIN)', 'EIN (identificação fiscal)'],
  STATE_INC: ['State of incorporation', 'Estado de constituição'], FISCAL_YEAR_END: ['Fiscal year end', 'Fim do exercício fiscal'],
  CATEGORY: ['Filer category', 'Categoria de registrante'], EXCHANGES: ['Exchanges', 'Bolsas'], TICKERS: ['Tickers', 'Tickers'],
  MUN: ['City', 'Cidade'], UF: ['State', 'Estado'], TEL: ['Phone', 'Telefone'], PREDECESSOR: ['Former name', 'Nome anterior'],
}
export const regLabel = (k: string, us: boolean) => { const m = (us ? SEC_KEYS : CVM_KEYS)[k]; return m ? (pt() ? m[1] : m[0]) : k }

/** valores codificados da CVM → EN (PT mostra o original) */
const CVM_VAL: Record<string, string> = {
  ATIVO: 'Active', CANCELADA: 'Cancelled', SUSPENSO: 'Suspended',
  PRIVADO: 'Private', 'PRIVADO HOLDING': 'Private (holding)', ESTATAL: 'State-owned', 'ESTATAL HOLDING': 'State-owned (holding)',
  ESTRANGEIRO: 'Foreign', 'ESTRANGEIRO HOLDING': 'Foreign (holding)',
  BOLSA: 'Exchange', 'BALCÃO ORGANIZADO': 'Organized OTC', 'BALCÃO NÃO ORGANIZADO': 'Unorganized OTC',
  'Categoria A': 'Category A', 'Categoria B': 'Category B',
  'FASE OPERACIONAL': 'Operational', 'FASE PRÉ-OPERACIONAL': 'Pre-operational', 'PARALISADA': 'Halted',
  'EM RECUPERAÇÃO JUDICIAL OU EQUIVALENTE': 'In judicial recovery or equivalent', 'EM LIQUIDAÇÃO EXTRAJUDICIAL': 'In extrajudicial liquidation',
  'DIRETOR DE RELAÇÕES COM INVESTIDORES': 'Investor relations officer',
}
const SECTOR: Record<string, string> = {
  'Agricultura (Açúcar, Álcool e Cana)': 'Agriculture (sugar, ethanol and cane)', 'Alimentos': 'Food', 'Bancos': 'Banks',
  'Bebidas e Fumo': 'Beverages and tobacco', 'Bolsas de Valores/Mercadorias e Futuros': 'Securities, commodities and futures exchanges',
  'Brinquedos e Lazer': 'Toys and leisure', 'Comunicação e Informática': 'Communications and IT', 'Comércio (Atacado e Varejo)': 'Trade (wholesale and retail)',
  'Construção Civil, Mat. Constr. e Decoração': 'Construction, building materials and decoration', 'Educação': 'Education', 'Embalagens': 'Packaging',
  'Energia Elétrica': 'Electric power', 'Extração Mineral': 'Mining', 'Farmacêutico e Higiene': 'Pharmaceuticals and hygiene',
  'Hospedagem e Turismo': 'Hospitality and tourism', 'Metalurgia e Siderurgia': 'Metallurgy and steel', 'Máquinas, Equipamentos, Veículos e Peças': 'Machinery, equipment, vehicles and parts',
  'Papel e Celulose': 'Pulp and paper', 'Petroquímicos e Borracha': 'Petrochemicals and rubber', 'Petróleo e Gás': 'Oil and gas',
  'Saneamento, Serv. Água e Gás': 'Sanitation, water and gas services', 'Seguradoras e Corretoras': 'Insurers and brokers', 'Serviços Médicos': 'Medical services',
  'Serviços Transporte e Logística': 'Transport and logistics services', 'Telecomunicações': 'Telecommunications', 'Têxtil e Vestuário': 'Textiles and apparel',
  'Intermediação Financeira': 'Financial intermediation', 'Sem Setor Principal': 'No main sector',
  'Const. Civil, Mat. Const. e Decoração': 'Construction, building materials and decoration', 'Máqs., Equip., Veíc. e Peças': 'Machinery, equipment, vehicles and parts',
}
export function sectorEN(s: string): string {
  if (!s || pt()) return s
  const h = s.match(/^Emp\. Adm\. Part\. - (.*)$/)
  if (h) return `Holding companies – ${SECTOR[h[1]] || h[1]}`
  return SECTOR[s] || s
}
const M_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const M_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** data ISO → dd/mm/aaaa (PT) ou aaaa-mm-dd mantida legível em EN (Mon D, YYYY) */
export function isoDate(v: string): string {
  const m = (v || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return v
  return pt() ? `${m[3]}/${m[2]}/${m[1]}` : `${M_EN[+m[2] - 1]} ${+m[3]}, ${m[1]}`
}
/** fim do exercício fiscal da SEC (MMDD) → "Sep 26" / "26/set" */
export function fyEnd(v: string): string {
  if (!/^\d{4}$/.test(v || '')) return v || '—'
  const m = +v.slice(0, 2) - 1, d = +v.slice(2)
  if (m < 0 || m > 11) return v
  return pt() ? `${d}/${M_PT[m]}` : `${M_EN[m]} ${d}`
}
/** valor de campo de cadastro já pronto para exibição no idioma atual */
export function regValue(k: string, v: string, us: boolean): string {
  if (us) {
    if (k === 'FISCAL_YEAR_END') return fyEnd(v)
    return v
  }
  if (k === 'DT_REG' || k === 'DT_CONST') return isoDate(v)
  if (pt()) return v
  if (k === 'SETOR_ATIV') return sectorEN(v)
  return CVM_VAL[v] || v
}
