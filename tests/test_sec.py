"""Testes de build_sec.py (fundamentos dos EUA via SEC companyfacts) com fatos sintéticos no layout da API."""
import datetime as dt
import build_sec as bs


def fact(start, end, val, filed, form='10-Q', accn='a'):
    return {'start': start, 'end': end, 'val': val, 'filed': filed, 'form': form, 'accn': accn}


def concept(*facts, unit='USD'):
    return {'units': {unit: list(facts)}}


# exercício fiscal = ano civil; 10-Q com fluxo de caixa acumulado (3, 6 e 9 meses) e 10-K anual
CFO = concept(
    fact('2025-01-01', '2025-03-31', 10, '2025-05-01'),
    fact('2025-01-01', '2025-06-30', 25, '2025-08-01'),
    fact('2025-01-01', '2025-09-30', 45, '2025-11-01'),
    fact('2025-01-01', '2025-12-31', 70, '2026-02-01', form='10-K'),
)


def test_ytd_differencing_and_q4():
    ann, q = bs.flow({'NetCashProvidedByUsedInOperatingActivities': CFO}, ['NetCashProvidedByUsedInOperatingActivities'])
    assert ann == {'2025-12-31': 70}
    assert q == {'2025-03-31': 10, '2025-06-30': 15, '2025-09-30': 20, '2025-12-31': 25}


def test_standalone_quarter_wins_over_derived():
    g = {'X': concept(fact('2025-01-01', '2025-06-30', 25, '2025-08-01'), fact('2025-01-01', '2025-03-31', 10, '2025-05-01'),
                      fact('2025-04-01', '2025-06-30', 16, '2025-08-01'))}
    _, q = bs.flow(g, ['X'])
    assert q['2025-06-30'] == 16


def test_restatement_latest_filing_wins():
    g = {'X': concept(fact('2025-01-01', '2025-12-31', 70, '2026-02-01', form='10-K'), fact('2025-01-01', '2025-12-31', 72, '2027-02-01', form='10-K'))}
    ann, _ = bs.flow(g, ['X'])
    assert ann['2025-12-31'] == 72


def test_concepts_not_mixed_in_differencing():
    # 6M num conceito e 3M em outro: a diferença não pode misturar conceitos
    g = {'A': concept(fact('2025-01-01', '2025-03-31', 10, '2025-05-01')), 'B': concept(fact('2025-01-01', '2025-06-30', 100, '2025-08-01'))}
    _, q = bs.flow(g, ['A', 'B'])
    assert q == {'2025-03-31': 10}


def test_merge_prefers_most_recent_concept():
    old = {('2019-01-01', '2019-12-31'): 1, ('2020-01-01', '2020-12-31'): 2}
    new = {('2020-01-01', '2020-12-31'): 20, ('2021-01-01', '2021-12-31'): 30}
    assert bs.merge([old, new]) == {('2019-01-01', '2019-12-31'): 1, ('2020-01-01', '2020-12-31'): 20, ('2021-01-01', '2021-12-31'): 30}


def test_shares_sec_sums_classes_of_latest_cover():
    from common import today_brt
    today = today_brt()
    d1, d0 = (today - dt.timedelta(days=30)).isoformat(), (today - dt.timedelta(days=120)).isoformat()
    cf = {'facts': {'dei': {'EntityCommonStockSharesOutstanding': {'units': {'shares': [
        {'end': d1, 'val': 100, 'filed': d1, 'accn': 'new', 'form': '10-Q'}, {'end': d1, 'val': 50, 'filed': d1, 'accn': 'new', 'form': '10-Q'},
        {'end': d0, 'val': 999, 'filed': d0, 'accn': 'old', 'form': '10-Q'}]}}}, 'us-gaap': {}}}
    s = bs.shares_sec(cf)
    assert s['total'] == 150 and s['date'] == d1


def test_shares_sec_ignores_stale_cover():
    old = (bs.today_brt() - dt.timedelta(days=800)).isoformat()
    cf = {'facts': {'dei': {'EntityCommonStockSharesOutstanding': {'units': {'shares': [{'end': old, 'val': 1, 'filed': old, 'accn': 'x', 'form': '10-K'}]}}}, 'us-gaap': {}}}
    assert bs.shares_sec(cf) is None


def test_predecessor_history_fills_new_registrant():
    new = {'facts': {'us-gaap': {'Revenues': concept(fact('2026-04-01', '2026-06-30', 5, '2026-08-03'))}}}
    old = {'facts': {'us-gaap': {'Revenues': concept(fact('2025-01-01', '2025-12-31', 300, '2026-02-01', form='10-K'), fact('2026-04-01', '2026-06-30', 4, '2026-07-01')),
                                 'Assets': concept(fact(None, '2025-12-31', 900, '2026-02-01', form='10-K'))}}}
    g = bs.merge_predecessor(new, old)['facts']['us-gaap']
    ann, q = bs.flow(g, ['Revenues'])
    assert ann['2025-12-31'] == 300 and q['2026-06-30'] == 5 and 'Assets' in g


def test_8k_subject_uses_official_item_titles():
    assert bs.subject_8k('2.02,9.01') == 'Results of Operations and Financial Condition'
    assert bs.subject_8k('5.02, 7.01') == 'Departure/Election of Directors or Officers; Compensation Arrangements; Regulation FD Disclosure'
    assert bs.subject_8k('') == ''


def test_profitloss_minus_nci_and_debt_needs_long_term_part():
    K = lambda v, nci=None: concept(fact('2025-01-01', '2025-12-31', v, '2026-02-01', form='10-K'))
    B = lambda v: concept(fact(None, '2025-12-31', v, '2026-02-01', form='10-K'))
    g = {'Revenues': K(1000), 'ProfitLoss': K(120), 'NetIncomeLossAttributableToNoncontrollingInterest': K(20),
         'CashAndCashEquivalentsAtCarryingValue': B(50), 'LongTermDebtCurrent': B(30)}
    r = bs.build_us_fund(g)['annual'][-1]
    assert r['net'] == 100
    assert r['debt'] is None and r['netdebt'] is None   # só a parcela corrente: dívida não é inventada


def test_da_from_components_when_no_combined_tag():
    import build_sec as bs
    def F(v, s='2025-07-01', e='2026-06-30'): return {'units': {'USD': [{'start': s, 'end': e, 'val': v, 'form': '10-K', 'filed': '2026-07-30'}]}}
    g = {'Revenues': F(300), 'OperatingIncomeLoss': F(120), 'NetIncomeLoss': F(100), 'Depreciation': F(20), 'AmortizationOfIntangibleAssets': F(5)}
    r = bs.build_us_fund(g)['annual'][-1]
    assert r['da'] == 25 and r['ebitda'] == 145 and r.get('da_derived')
    g2 = dict(g); g2.pop('AmortizationOfIntangibleAssets')
    r2 = bs.build_us_fund(g2)['annual'][-1]
    assert r2['da'] is None and r2['ebitda'] is None          # só uma parcela: não inventa D&A
    g3 = dict(g); g3['DepreciationDepletionAndAmortization'] = F(30)
    assert bs.build_us_fund(g3)['annual'][-1]['da'] == 30   # conceito agregado vence
