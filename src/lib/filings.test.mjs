import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norm, matches, collapseVersions, groupOf, isKey, categoryCounts, groupCounts, dateRange, sortFilings, showType, showRef, gloss } from './filings.mjs'

const F = (o) => ({ date: '2026-01-01', ref: '2026-01-01', cat: 'Comunicado ao Mercado', type: null, species: null, subject: null, version: '1', link: 'x', ...o })

test('norm remove acentos e caixa', () => {
  assert.equal(norm('Reunião da Administração'), 'reuniao da administracao')
  assert.equal(norm(null), '')
})

test('busca não quebra com assunto e tipo nulos (crash antigo: null+null)', () => {
  const f = F({ cat: 'Fato Relevante', subject: null, type: null })
  assert.equal(matches(f, 'fato'), true)
  assert.equal(matches(f, 'xyz'), false)
  assert.equal(matches(F({ subject: undefined }), ''), true)
})

test('busca sem acento, todas as palavras, inclui rótulo em inglês', () => {
  const f = F({ cat: 'Relatório Proventos', subject: 'Dividendos e JCP' })
  assert.equal(matches(f, 'relatorio'), true)
  assert.equal(matches(f, 'RELATÓRIO jcp'), true)
  assert.equal(matches(f, 'dividend report'), true)
  assert.equal(matches(f, 'jcp ata'), false)
  assert.equal(matches(F({ cat: '10-K', subject: 'Annual report' }), '10-k'), true)
})

test('versões: fica a mais alta, anteriores no expansor; mesma versão continua separada', () => {
  const v1 = F({ date: '2026-03-12', subject: 'AGO', version: '1' })
  const v2 = F({ date: '2026-03-19', subject: 'AGO', version: '2' })
  const v3 = F({ date: '2026-03-27', subject: 'AGO', version: '3' })
  const a = F({ date: '2026-04-24', subject: 'AGE', version: '1', link: 'a' })
  const b = F({ date: '2026-04-24', subject: 'AGE', version: '1', link: 'b' })
  const out = collapseVersions([v3, a, v2, b, v1])
  assert.equal(out.length, 3)
  assert.equal(out[0].version, '3')
  assert.deepEqual(out[0].older.map(x => x.version), ['2', '1'])
  assert.equal(out[1].older.length, 0)
  assert.equal(out[2].link, 'b')
  // períodos diferentes não se juntam
  assert.equal(collapseVersions([F({ ref: '2026-01-01', version: '2' }), F({ ref: '2026-02-01', version: '1' })]).length, 2)
})

test('grupos e documentos-chave', () => {
  assert.equal(groupOf(F({ cat: 'Dados Econômico-Financeiros', type: 'Press-release' }), false), 'results')
  assert.equal(groupOf(F({ cat: 'Dados Econômico-Financeiros', type: 'Relatório de Agência de Rating' }), false), 'other')
  assert.equal(groupOf(F({ cat: 'Fato Relevante' }), false), 'material')
  assert.equal(groupOf(F({ cat: 'Assembleia', type: 'AGO' }), false), 'meetings')
  assert.equal(groupOf(F({ cat: 'Aviso aos Acionistas', subject: 'Pagamento de Juros sobre Capital Próprio' }), false), 'dividends')
  assert.equal(groupOf(F({ cat: 'Aviso aos Acionistas', subject: 'Data da assembleia' }), false), 'other')
  assert.equal(groupOf(F({ cat: '8-K', subject: 'Results of Operations and Financial Condition' }), true), 'results')
  assert.equal(groupOf(F({ cat: '10-Q' }), true), 'results')
  assert.equal(groupOf(F({ cat: 'DEF 14A' }), true), 'meetings')
  assert.equal(groupOf(F({ cat: '8-K', subject: 'Other Events' }), true), 'material')
  assert.equal(groupOf(F({ cat: '11-K' }), true), 'other')
  assert.equal(isKey(F({ cat: 'Fato Relevante' }), false), true)
  assert.equal(isKey(F({ cat: '8-K', subject: 'Other Events' }), true), false)
})

test('contagens, intervalo, ordenação e exibição', () => {
  const L = [F({ cat: 'B', date: '2026-02-01' }), F({ cat: 'A', date: '2026-03-01' }), F({ cat: 'B', date: '2025-12-01' })]
  assert.deepEqual(categoryCounts(L), [{ cat: 'B', n: 2 }, { cat: 'A', n: 1 }])
  assert.deepEqual(dateRange(L), { from: '2025-12-01', to: '2026-03-01' })
  assert.equal(dateRange([]), null)
  assert.deepEqual(sortFilings(L, 'date').map(x => x.date), ['2026-03-01', '2026-02-01', '2025-12-01'])
  assert.deepEqual(sortFilings(L, 'cat', ['B', 'A']).map(x => x.cat + x.date), ['B2026-02-01', 'B2025-12-01', 'A2026-03-01'])
  assert.equal(groupCounts(L, false).other, 3)
  assert.equal(showType(F({ type: '—' })), null)
  assert.equal(showType(F({ cat: '10-Q', type: '10-Q' })), null)
  assert.equal(showType(F({ type: 'AGO' })), 'AGO')
  assert.equal(showRef(F({ date: '2026-03-01', ref: '2026-03-01' })), null)
  assert.equal(showRef(F({ date: '2026-03-01', ref: '2025-12-31' })), '2025-12-31')
  assert.equal(gloss('Fato Relevante'), 'Material fact')
  assert.equal(gloss('10-K'), null)
})
