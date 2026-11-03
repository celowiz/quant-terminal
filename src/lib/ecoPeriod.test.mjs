import test from 'node:test'
import assert from 'node:assert/strict'
import { ecoPeriod, ecoUnit } from './ecoPeriod.mjs'

test('meses no estilo do ECST, traduzidos', () => {
  assert.equal(ecoPeriod('09/2026'), 'Sep 26')
  assert.equal(ecoPeriod('09/2026', 'pt'), 'set 26')
  assert.equal(ecoPeriod('September 2026'), 'Sep 26')
  assert.equal(ecoPeriod('October 2026', 'pt'), 'out 26')
  assert.equal(ecoPeriod('July to September 2026'), 'Jul–Sep 26')
  assert.equal(ecoPeriod('July to September 2026', 'pt'), 'jul–set 26')
})
test('trimestres', () => {
  for (const p of ['Q3/2026', 'third quarter 2026', 'Third Quarter 2026', '3rd Quarter 2026']) {
    assert.equal(ecoPeriod(p), 'Q3 26'); assert.equal(ecoPeriod(p, 'pt'), '3T26')
  }
})
test('semanas, intervalos e reuniões', () => {
  assert.equal(ecoPeriod('10/10/2026'), 'w/e 10 Oct')
  assert.equal(ecoPeriod('10/10/2026', 'pt'), 'sem. 10/10')
  assert.equal(ecoPeriod('01/10–11/10'), '1–11 Oct')
  assert.equal(ecoPeriod('30/11–06/12'), '30 Nov–6 Dec')
  assert.equal(ecoPeriod('01/10–11/10', 'pt'), '01/10–11/10')
  assert.equal(ecoPeriod('W2 10/2026'), 'W2 Oct 26')
  assert.equal(ecoPeriod('W2 10/2026', 'pt'), 'S2 out 26')
  assert.equal(ecoPeriod('R7/2026'), 'Mtg 7 26')
  assert.equal(ecoPeriod('R7/2026', 'pt'), '7ª reun. 26')
})
test('desconhecido volta como veio; vazio vira vazio', () => {
  assert.equal(ecoPeriod('2025'), '2025')
  assert.equal(ecoPeriod('U.S. and States, 2024'), 'U.S. and States, 2024')
  assert.equal(ecoPeriod('13/2026'), '13/2026')
  assert.equal(ecoPeriod(null), '')
})
test('unidades', () => {
  assert.equal(ecoUnit('% y/y', 'pt'), '% a/a')
  assert.equal(ecoUnit('% q/q', 'pt'), '% t/t')
  assert.equal(ecoUnit('k', 'pt'), 'mil')
  assert.equal(ecoUnit('k'), 'k')
  assert.equal(ecoUnit('%', 'pt'), '%')
  assert.equal(ecoUnit(null), '')
})
