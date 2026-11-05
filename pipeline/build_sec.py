"""Fundamentos das ações dos EUA pela SEC (EDGAR, dados públicos e gratuitos):
company_tickers.json (ticker → CIK), XBRL companyfacts (demonstrações 10-K/10-Q) e submissions (cadastro, filings).
Grava corp/{T}.json e fa/{T}.json no mesmo formato das ações BR (CVM) e screener_us.json (múltiplos para VAL/RV).
Preço sem ajuste, proventos e desdobramentos vêm do Yahoo Finance, como nas ações BR."""
import sys, time, json, os, datetime as dt
import pandas as pd, requests, yfinance as yf
from common import with_timeout, save, clean, step, now_iso, today_brt, load_prev, OUT, CACHE, file_key as key, write_atomic

# A SEC exige um User-Agent com contato (https://www.sec.gov/os/accessing-edgar-data); e-mail público dos commits do projeto.
SEC_UA = {'User-Agent': 'quant-terminal celowiz marcelo_wz@hotmail.com', 'Accept-Encoding': 'gzip, deflate'}

def sec_json(url, name, max_age_h=20):
    p = os.path.join(CACHE, 'sec_' + name)
    if os.path.exists(p) and time.time() - os.path.getmtime(p) < max_age_h * 3600:
        return json.load(open(p))
    last = None
    for i in range(4):
        try:
            r = requests.get(url, headers=SEC_UA, timeout=60)
            time.sleep(0.15)                       # limite da SEC: 10 req/s
            if r.status_code == 200:
                write_atomic(p, r.content); return r.json()
            last = f'HTTP {r.status_code}'
        except Exception as e: last = repr(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f'{url}: {last}')

def us_universe():
    with open(os.path.join(OUT, 'tickers.json'), encoding='utf-8') as f: T = json.load(f)['tickers']
    # só o núcleo fixo: o S&P 500 da cobertura ampliada (`ext`) não chama o companyfacts por ticker (tempo/limite da SEC)
    return [t['ticker'] for t in T if t.get('class') == 'us_equity' and not t.get('ext')]

# conceitos us-gaap por linha (o primeiro que existir para o período vence; empresas trocam de conceito ao longo dos anos)
FLOW = {
    'revenue': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax',
                'SalesRevenueNet', 'RevenuesNetOfInterestExpense'],
    'cost': ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'],
    'gross': ['GrossProfit'],
    'rnd': ['ResearchAndDevelopmentExpense'],
    'sga': ['SellingGeneralAndAdministrativeExpense'],
    'ebit': ['OperatingIncomeLoss'],
    'interest': ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
    'pretax': ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
               'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
    'tax': ['IncomeTaxExpenseBenefit'],
    'net': ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
    'da': ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization'],
    'cfo': ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
    'cfi': ['NetCashProvidedByUsedInInvestingActivities', 'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations'],
    'cff': ['NetCashProvidedByUsedInFinancingActivities', 'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations'],
    'capex': ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    'buyback': ['PaymentsForRepurchaseOfCommonStock'],
    'divpaid': ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'],
}
INST = {
    'cash': ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'],
    'stinv': ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
    'receivables': ['AccountsReceivableNetCurrent'],
    'inventory': ['InventoryNet'],
    'cur_assets': ['AssetsCurrent'],
    'ppe': ['PropertyPlantAndEquipmentNet', 'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization'],
    'goodwill': ['Goodwill'],
    'intang': ['IntangibleAssetsNetExcludingGoodwill'],
    'assets': ['Assets'],
    'cur_liab': ['LiabilitiesCurrent'],
    'ltd': ['LongTermDebt', 'DebtLongtermAndShorttermCombinedAmount'],
    'ltd_nc': ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermNotesPayable'],
    'ltd_c': ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'NotesPayableCurrent'],
    'cp': ['CommercialPaper'],
    'stb': ['ShortTermBorrowings'],
    'liab': ['Liabilities'],
    'equity': ['StockholdersEquity'],
    'minority': ['MinorityInterest'],
    'liab_total': ['LiabilitiesAndStockholdersEquity'],
}
EPS = ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted']
FORMS = ('10-K', '10-Q', '10-K/A', '10-Q/A', '20-F', '40-F', '10-KT')

def _days(a, b): return (pd.Timestamp(b) - pd.Timestamp(a)).days

def _facts(g, nm, unit):
    """{(start|None, end): val} de um conceito; o arquivamento mais recente vence (reapresentações)."""
    best = {}
    for x in ((g.get(nm) or {}).get('units', {}).get(unit) or []):
        if x.get('form') not in FORMS: continue
        k = (x.get('start'), x['end'])
        if k not in best or x['filed'] >= best[k]['filed']: best[k] = x
    return {k: x['val'] for k, x in best.items()}

def concept_facts(g, names, unit='USD'):
    """Une conceitos alternativos: um mesmo número muda de conceito ao longo dos anos (ex.: Revenues →
    RevenueFromContractWithCustomer...). Os de uso mais recente têm prioridade; os outros só preenchem períodos sem valor."""
    return merge([_facts(g, nm, unit) for nm in names])

def _rank(D):
    ends = sorted({e for (_, e) in D} if D and isinstance(next(iter(D)), tuple) else set(D))
    return (ends[-1] if ends else '', len(ends))

def merge(L):
    out = {}
    for D in sorted([D for D in L if D], key=_rank, reverse=True):
        for k, v in D.items(): out.setdefault(k, v)
    return out

def flows(F, derive=True):
    """Fluxos de UM conceito → ({fim_ano: val}, {fim_tri: val}). Trimestre = fato de ~3 meses ou diferença de acumulados com
    o mesmo início (o 10-Q traz 6/9 meses acumulados; 4º tri = ano − 9 meses)."""
    ann, q, by_start = {}, {}, {}
    for (s, e), v in F.items():
        if s is None: continue
        d = _days(s, e)
        if 350 <= d <= 380: ann[e] = v
        if 80 <= d <= 100: q[e] = v
        by_start.setdefault(s, []).append((e, v, d))
    if derive:
        for s, L in by_start.items():
            L = sorted(x for x in L if x[2] <= 380)
            for (e0, v0, d0), (e1, v1, d1) in zip(L, L[1:]):
                if 80 <= _days(e0, e1) <= 100 and e1 not in q: q[e1] = v1 - v0
    return ann, q

def flow(g, names, unit='USD', derive=True):
    """Anual e trimestral por conceito (sem misturar conceitos na diferença dos acumulados) e depois unidos."""
    per = [flows(_facts(g, nm, unit), derive) for nm in names]
    return merge([a for a, _ in per]), merge([q for _, q in per])

def inst(g, names):
    return merge([{e: v for (s, e), v in _facts(g, nm, 'USD').items() if s is None} for nm in names])

def build_us_fund(g):
    F = {k: flow(g, v) for k, v in FLOW.items()}
    I = {k: inst(g, v) for k, v in INST.items()}
    # lucro do controlador quando a empresa só reporta ProfitLoss (ex.: Mastercard, Broadcom): ProfitLoss − participação de não controladores
    pl, nci = flow(g, ['ProfitLoss']), flow(g, ['NetIncomeLossAttributableToNoncontrollingInterest'])
    for i in (0, 1):
        for e, v in pl[i].items(): F['net'][i].setdefault(e, v - nci[i].get(e, 0))
    eqt, mi = inst(g, ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']), I['minority']
    for e, v in eqt.items(): I['equity'].setdefault(e, v - mi.get(e, 0))   # PL do controlador = PL total − não controladores
    # D&A quando a empresa não usa um conceito agregado (ex.: Microsoft, Oracle, AbbVie, Broadcom): depreciação + amortização
    # de intangíveis, só nos períodos em que as DUAS parcelas foram publicadas
    dep, amo = flow(g, ['Depreciation']), flow(g, ['AmortizationOfIntangibleAssets'])
    da_der = (set(), set())
    for i in (0, 1):
        for e, v in dep[i].items():
            if e not in F['da'][i] and e in amo[i]: F['da'][i][e] = v + amo[i][e]; da_der[i].add(e)
    epsA, epsQ = flow(g, EPS, 'USD/shares', derive=False)   # LPA não se subtrai (a média de ações muda)
    ends_a = sorted(set(F['revenue'][0]) | set(F['net'][0]))[-6:]
    ends_q = sorted(set(F['revenue'][1]) | set(F['net'][1]))[-12:]
    def row(e, i, eps):
        r = {'period': e}
        for k in FLOW: r[k] = clean(F[k][i].get(e), 0)
        for k in INST: r[k] = clean(I[k].get(e), 0)
        r['eps'] = clean(eps.get(e), 4)
        if e in da_der[i]: r['da_derived'] = True
        for k in ('capex', 'buyback', 'divpaid'):                    # saídas de caixa em negativo, como na CVM
            if r[k] is not None: r[k] = -r[k]
        if r['ebit'] is None and r['pretax'] is not None and r['interest'] is not None:
            # empresas que não publicam "resultado operacional" (ex.: J&J, Eli Lilly): EBIT = lucro antes do IR + despesa de juros
            r['ebit'] = clean(r['pretax'] + r['interest'], 0); r['ebit_derived'] = True
        r['ebitda'] = clean(r['ebit'] + r['da'], 0) if r['ebit'] is not None and r['da'] is not None else None
        # dívida só quando a parcela de longo prazo está no XBRL (só a parcela corrente subestimaria a dívida)
        ltd = r['ltd'] if r['ltd'] is not None else (r['ltd_nc'] + (r['ltd_c'] or 0) if r['ltd_nc'] is not None else None)
        r['debt'] = clean(ltd + (r['cp'] or 0) + (r['stb'] or 0), 0) if ltd is not None else None
        r['netdebt'] = clean(r['debt'] - (r['cash'] or 0) - (r['stinv'] or 0), 0) if r['debt'] is not None and r['cash'] is not None else None
        r['fin'] = clean(-r['interest'], 0) if r['interest'] is not None else None
        return r
    return {'annual': [row(e, 0, epsA) for e in ends_a], 'quarterly': [row(e, 1, epsQ) for e in ends_q]}

# FA: conceitos extras só para as demonstrações completas (não entram no corp/FUND)
FA_FLOW = {
    'nonop_other': ['OtherNonoperatingIncomeExpense'],
    'int_income': ['InvestmentIncomeInterest', 'InterestIncomeOther', 'InvestmentIncomeInterestAndDividend'],
    'sbc': ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
    'deftax': ['DeferredIncomeTaxExpenseBenefit', 'DeferredIncomeTaxesAndTaxCredits'],
    'acq': ['PaymentsToAcquireBusinessesNetOfCashAcquired'],
    'inv_buy': ['PaymentsToAcquireInvestments', 'PaymentsToAcquireMarketableSecurities', 'PaymentsToAcquireAvailableForSaleSecuritiesDebt'],
    'inv_sell': ['ProceedsFromSaleMaturityAndCollectionsOfInvestments', 'ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities'],
    'debt_iss': ['ProceedsFromIssuanceOfLongTermDebt', 'ProceedsFromIssuanceOfDebt', 'ProceedsFromDebtNetOfIssuanceCosts'],
    'debt_rep': ['RepaymentsOfLongTermDebt', 'RepaymentsOfDebt'],
    'fx': ['EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'EffectOfExchangeRateOnCashAndCashEquivalents'],
    'netchg': ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect',
               'CashAndCashEquivalentsPeriodIncreaseDecrease'],
}
FA_INST = {
    'rou': ['OperatingLeaseRightOfUseAsset'],
    'ap': ['AccountsPayableCurrent'],
    'accrued': ['AccruedLiabilitiesCurrent'],
    'liab_nc': ['LiabilitiesNoncurrent'],
    'apic': ['CommonStocksIncludingAdditionalPaidInCapital', 'AdditionalPaidInCapitalCommonStock', 'AdditionalPaidInCapital'],
    'retained': ['RetainedEarningsAccumulatedDeficit'],
    'aoci': ['AccumulatedOtherComprehensiveIncomeLossNetOfTax'],
    'treasury': ['TreasuryStockValue', 'TreasuryStockCommonValue'],
}
FA_NEG = {'cost', 'rnd', 'sga', 'interest', 'tax', 'acq', 'inv_buy', 'debt_rep', 'treasury'}   # despesas e saídas em negativo (como na DRE/DFC brasileira)

def _sub(r, a, *bs):
    """a − Σ bs só quando TODAS as parcelas existem no período (nunca estima)."""
    v = [r.get(a)] + [r.get(b) for b in bs]
    return None if any(x is None for x in v) else v[0] - sum(v[1:])

def fa_rows(fund, g):
    """Linhas do FA dos EUA: FUND + conceitos extras; despesas/saídas com sinal negativo; subtotais calculados (lista _d)."""
    X = {k: flow(g, v) for k, v in FA_FLOW.items()}
    XI = {k: inst(g, v) for k, v in FA_INST.items()}
    out = {}
    ever = {k for per in ('annual', 'quarterly') for r0 in fund[per] for k, v in r0.items() if v is not None}
    ever |= {k for k in FA_INST if XI[k]}
    opt = lambda r, k: r.get(k) if r.get(k) is not None or k in ever else 0   # linha que a empresa nunca publica conta 0; publicada mas ausente no período → sem subtotal
    for i, per in enumerate(('annual', 'quarterly')):
        L = []
        for r0 in fund[per]:
            e = r0['period']; r = dict(r0); d = []
            for k in FA_FLOW: r[k] = clean(X[k][i].get(e), 0)
            for k in FA_INST: r[k] = clean(XI[k].get(e), 0)
            if r.get('ebit_derived'):
                if fund.get('bank_format'): r['ebit'] = None   # banco: "resultado operacional" não se aplica (o FUND usa IR + juros só p/ não-financeiras)
                else: d.append('ebit')
            if r.get('da_derived'): d.append('da')
            for k in FA_NEG:
                if r.get(k) is not None: r[k] = -r[k]   # despesa positiva no relatório → negativa (um benefício fica positivo)
            if r.get('gross') is None and r.get('revenue') is not None and r.get('cost') is not None:
                r['gross'] = r['revenue'] + r['cost']; d.append('gross')
            # despesas operacionais = lucro bruto − resultado operacional (quando há lucro bruto); "outras" = total − P&D − VG&A
            if r.get('gross') is not None and r.get('ebit') is not None:
                r['opex'] = r['ebit'] - r['gross']; d.append('opex')
                if r.get('rnd') is not None and r.get('sga') is not None:
                    r['opex_other'] = r['opex'] - r['rnd'] - r['sga']; d.append('opex_other')
            else: r['opex'] = None
            r['nonop'] = _sub(r, 'pretax', 'ebit');  d += ['nonop'] if r['nonop'] is not None else []
            o = {k: opt(r, k) for k in ('stinv', 'receivables', 'inventory', 'intang', 'goodwill', 'accrued', 'ap')}
            r['ca_other'] = _sub({**r, **o}, 'cur_assets', 'cash', 'stinv', 'receivables', 'inventory')
            r['nca'] = _sub(r, 'assets', 'cur_assets')
            r['nca_other'] = _sub({**r, **o, 'rou': opt(r, 'rou')}, 'nca', 'ppe', 'rou', 'goodwill', 'intang')
            if r.get('liab_nc') is None: r['liab_nc'] = _sub(r, 'liab', 'cur_liab'); d += ['liab_nc'] if r['liab_nc'] is not None else []
            r['cl_other'] = _sub({**r, **o}, 'cur_liab', 'ap', 'accrued')
            r['lt_debt'] = r.get('ltd_nc')
            r['ncl_other'] = _sub(r, 'liab_nc', 'lt_debt')
            r['fcf'] = clean(r['cfo'] + r['capex'], 0) if r.get('cfo') is not None and r.get('capex') is not None else None
            if r['fcf'] is not None: d.append('fcf')
            for k in ('ca_other', 'nca', 'nca_other', 'cl_other', 'ncl_other'):
                if r.get(k) is not None: d.append(k)
            r['_d'] = d; L.append(r)
        out[per] = L
    return out

# (código, nome EN, nível); os nomes em PT ficam no frontend (glossário curado)
FA_LAYOUT = [
    ('IS', 'Income statement', [('revenue', 'Revenue', 1), ('cost', 'Cost of revenue', 2), ('gross', 'Gross profit', 1), ('opex', 'Operating expenses', 2),
                                ('rnd', 'Research & development', 3), ('sga', 'Selling, general & administrative', 3), ('opex_other', 'Other operating expenses, net', 3),
                                ('ebit', 'Operating income', 1), ('nonop', 'Non-operating result, net', 2), ('int_income', 'Interest income', 3), ('interest', 'Interest expense', 3),
                                ('nonop_other', 'Other non-operating income (expense)', 3), ('pretax', 'Income before taxes', 1), ('tax', 'Income tax', 2), ('net', 'Net income', 1)]),
    ('BSA', 'Balance sheet – assets', [('assets', 'Total assets', 1), ('cur_assets', 'Current assets', 2), ('cash', 'Cash & equivalents', 3), ('stinv', 'Short-term investments', 3),
                                       ('receivables', 'Accounts receivable', 3), ('inventory', 'Inventory', 3), ('ca_other', 'Other current assets', 3),
                                       ('nca', 'Non-current assets', 2), ('ppe', 'Property, plant & equipment (net)', 3), ('rou', 'Operating lease right-of-use assets', 3),
                                       ('goodwill', 'Goodwill', 3), ('intang', 'Intangible assets', 3), ('nca_other', 'Other non-current assets', 3)]),
    ('BSL', 'Balance sheet – liabilities & equity', [('liab_total', 'Total liabilities & equity', 1), ('liab', 'Total liabilities', 2), ('cur_liab', 'Current liabilities', 3),
                                                     ('ap', 'Accounts payable', 3), ('accrued', 'Accrued liabilities', 3), ('cl_other', 'Other current liabilities', 3),
                                                     ('liab_nc', 'Non-current liabilities', 3), ('lt_debt', 'Long-term debt', 3), ('ncl_other', 'Other non-current liabilities', 3),
                                                     ('debt', 'Total debt', 2), ('equity', "Shareholders' equity", 2), ('apic', 'Common stock & paid-in capital', 3),
                                                     ('retained', 'Retained earnings (accumulated deficit)', 3), ('aoci', 'Accumulated other comprehensive income', 3),
                                                     ('treasury', 'Treasury stock', 3), ('minority', 'Non-controlling interests', 2)]),
    ('CF', 'Cash flow', [('cfo', 'Operating cash flow', 1), ('net', 'Net income', 2), ('da', 'Depreciation & amortization', 2), ('sbc', 'Share-based compensation', 2),
                         ('deftax', 'Deferred income taxes', 2), ('cfi', 'Investing cash flow', 1), ('capex', 'Capital expenditures', 2), ('acq', 'Acquisitions, net of cash acquired', 2),
                         ('inv_buy', 'Purchases of investments', 2), ('inv_sell', 'Sales and maturities of investments', 2), ('cff', 'Financing cash flow', 1),
                         ('debt_iss', 'Debt issued', 2), ('debt_rep', 'Debt repaid', 2), ('buyback', 'Share repurchases', 2), ('divpaid', 'Dividends paid', 2),
                         ('fx', 'Effect of exchange rates on cash', 1), ('netchg', 'Net change in cash', 1), ('fcf', 'Free cash flow (operating cash flow + capex)', 1)]),
]

def fa_doc(t, cik, fund, g=None):
    R = fa_rows(fund, g or {})
    st = {}
    for k, name, rows in FA_LAYOUT:
        blk = {}
        for per in ('annual', 'quarterly'):
            L = R[per]
            rr = []
            for c, n, lv in rows:
                vals = [x.get(c) for x in L]
                if not any(v is not None for v in vals): continue
                o = {'code': c, 'name': n, 'level': lv, 'vals': vals}
                der = [c in x['_d'] and x.get(c) is not None for x in L]
                if any(der): o['derived'] = der
                rr.append(o)
            blk[per] = {'periods': [x['period'] for x in L], 'rows': rr}
        st[k] = {'name': name, **blk}
    return {'ticker': t, 'cik': cik, 'country': 'US', 'currency': 'USD', 'generated_at': now_iso(), 'stmts': st,
            'note': 'Consolidated statements (US GAAP) from the annual and quarterly reports.'}

FIN_SIC = range(6000, 6800)   # bancos, seguradoras, holdings financeiras: layout de instituição financeira

def shares_sec(cf):
    """Ações em circulação da capa do último 10-K/10-Q (dei:EntityCommonStockSharesOutstanding, soma das classes do mesmo
    arquivamento) ou us-gaap:CommonStockSharesOutstanding; só vale se for dos últimos 15 meses."""
    lim = (today_brt() - dt.timedelta(days=460)).isoformat()
    dei = [x for x in ((cf['facts'].get('dei', {}).get('EntityCommonStockSharesOutstanding') or {}).get('units', {}).get('shares') or []) if x['end'] >= lim]
    if dei:
        last = max(dei, key=lambda x: (x['filed'], x['accn']))['accn']
        cover = {}
        for x in dei:
            if x['accn'] == last: cover[x['end']] = cover.get(x['end'], 0) + x['val']
        e = max(cover)
        return {'date': e, 'total': cover[e], 'treasury': 0, 'source': 'SEC – cover of the latest 10-K/10-Q (dei:EntityCommonStockSharesOutstanding, all classes)'}
    g = cf['facts'].get('us-gaap') or {}
    bs = {e: v for (s, e), v in concept_facts(g, ['CommonStockSharesOutstanding'], 'shares').items() if s is None and e >= lim}
    if bs:
        e = max(bs); return {'date': e, 'total': bs[e], 'treasury': 0, 'source': 'SEC XBRL – us-gaap:CommonStockSharesOutstanding (balance sheet)'}
    return None

KEEP_FORMS = {'10-K', '10-Q', '8-K', '10-K/A', '10-Q/A', '8-K/A', 'DEF 14A', '20-F', '6-K', 'S-1', 'S-3', 'SC 13G', 'SC 13D', '11-K', '4'}
# títulos oficiais dos itens do Form 8-K (SEC, General Instructions B) — viram o assunto legível no CF/CN
ITEMS_8K = {'1.01': 'Entry into a Material Definitive Agreement', '1.02': 'Termination of a Material Definitive Agreement',
    '1.03': 'Bankruptcy or Receivership', '1.05': 'Material Cybersecurity Incidents', '2.01': 'Completion of Acquisition or Disposition of Assets',
    '2.02': 'Results of Operations and Financial Condition', '2.03': 'Creation of a Direct Financial Obligation',
    '2.04': 'Triggering Events That Accelerate a Financial Obligation', '2.05': 'Costs Associated with Exit or Disposal Activities',
    '2.06': 'Material Impairments', '3.01': 'Notice of Delisting or Failure to Satisfy a Listing Rule',
    '3.02': 'Unregistered Sales of Equity Securities', '3.03': 'Material Modification to Rights of Security Holders',
    '4.01': 'Changes in Registrant\'s Certifying Accountant', '4.02': 'Non-Reliance on Previously Issued Financial Statements',
    '5.01': 'Changes in Control of Registrant', '5.02': 'Departure/Election of Directors or Officers; Compensation Arrangements',
    '5.03': 'Amendments to Articles of Incorporation or Bylaws', '5.07': 'Submission of Matters to a Vote of Security Holders',
    '5.08': 'Shareholder Director Nominations', '7.01': 'Regulation FD Disclosure', '8.01': 'Other Events', '9.01': 'Financial Statements and Exhibits'}
FORM_DESC = {'10-K': 'Annual report', '10-Q': 'Quarterly report', '8-K': 'Current report', '20-F': 'Annual report (foreign issuer)',
    '6-K': 'Report of foreign issuer', '40-F': 'Annual report (Canadian issuer)', 'DEF 14A': 'Proxy statement', 'S-3': 'Registration statement',
    'S-8': 'Registration statement (employee plans)', '424B2': 'Prospectus', 'SC 13G': 'Beneficial ownership (passive)', 'SC 13D': 'Beneficial ownership'}

def subject_8k(items):
    its = [i.strip() for i in (items or '').split(',') if i.strip() and i.strip() != '9.01']
    return '; '.join(ITEMS_8K.get(i, f'Item {i}') for i in its)

def filings(sub, cik):
    r = sub['filings']['recent']; out = []
    for i in range(len(r['form'])):
        f = r['form'][i]
        if f not in KEEP_FORMS or f == '4': continue
        acc = r['accessionNumber'][i]
        out.append({'date': r['filingDate'][i], 'ref': r['reportDate'][i] or r['filingDate'][i], 'cat': f, 'type': r['primaryDocDescription'][i] or f,
                    'species': None, 'subject': (subject_8k(r['items'][i]) if r['items'][i] else '') or FORM_DESC.get(f.replace('/A', ''), r['primaryDocDescription'][i] or f) + (' (amendment)' if f.endswith('/A') else ''), 'version': '1',
                    'link': f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace("-", "")}/{r["primaryDocument"][i]}'})
        if len(out) >= 400: break
    return out

# Reorganizações em nova holding (novo CIK, sem histórico no XBRL): o histórico vem do registrante anterior, mesma empresa.
# ExxonMobil Holdings Corp (2026) sucedeu a Exxon Mobil Corporation como emissora listada (10-Q de 03/08/2026).
PREDECESSOR = {'0002115436': '0000034088'}

def merge_predecessor(cf, old):
    g, go = cf['facts'].setdefault('us-gaap', {}), (old['facts'].get('us-gaap') or {})
    for k, v in go.items():
        if k not in g: g[k] = v; continue
        for u, L in v.get('units', {}).items():
            g[k].setdefault('units', {}).setdefault(u, [])[:0] = L   # fatos do novo CIK, mais recentes, vencem na deduplicação
    return cf

def ttm(q, k):
    L = q[-4:]
    return sum(x[k] for x in L) if len(L) == 4 and all(x.get(k) is not None for x in L) else None

def ltm_or_fy(f, k):
    """Resultado dos últimos 12 meses (4 trimestres); se faltar trimestre no XBRL, o do último exercício (marcado 'FY')."""
    v = ttm(f['quarterly'], k)
    if v is not None: return v, 'LTM'
    a = f['annual'][-1] if f['annual'] else None
    return (a.get(k), 'FY' + a['period'][:4]) if a and a.get(k) is not None else (None, None)

def us_row(t, o):
    """linha do screener_us.json (mesmas fórmulas do screener BR)"""
    p = o.get('profile') or {}; f = o['fundamentals']; q = f['quarterly']; rc = o.get('raw_close') or []
    r = {'cod': t, 'name': p.get('longName') or o['cad'].get('DENOM_SOCIAL'), 'sector': p.get('sector') or o['cad'].get('SETOR_ATIV'),
         'subsector': p.get('industry') or o['cad'].get('SETOR_ATIV'), 'cik': o['cik'], 'bank': f['bank_format']}
    if not rc or not q: return r
    px = rc[-1]; r.update({'price': px[1], 'date': px[0]})
    cl = pd.Series([x[1] for x in rc], index=pd.to_datetime([x[0] for x in rc]))
    y0 = cl[cl.index <= cl.index[-1] - pd.Timedelta(days=365)]; b = cl[cl.index < pd.Timestamp(cl.index[-1].year, 1, 1)]
    r['y1'] = clean((px[1] / y0.iloc[-1] - 1) * 100, 2) if len(y0) else None
    r['ytd'] = clean((px[1] / b.iloc[-1] - 1) * 100, 2) if len(b) else None
    lim = (pd.Timestamp(px[0]) - pd.Timedelta(days=365)).strftime('%Y-%m-%d')
    dv = sum(v for d, v in (o.get('dividends_full') or []) if d > lim); r['div12m'] = clean(dv, 4); r['dy'] = clean(dv / px[1] * 100, 2)
    n = (o.get('shares') or {}).get('total')
    bal = q[-1]; r['fund_period'] = bal['period']
    (rev, b1), (ebitda, b2), (net, b3) = ltm_or_fy(f, 'revenue'), ltm_or_fy(f, 'ebitda'), ltm_or_fy(f, 'net'); eq = bal.get('equity'); bank = f['bank_format']
    r.update({'rev_ttm': rev, 'ebitda_ttm': ebitda, 'net_ttm': net, 'equity': eq, 'netdebt': bal.get('netdebt'), 'basis': b3})
    if n:
        mc = px[1] * n; r['shares'] = n; r['mcap'] = clean(mc, 0)
        r['pe'] = clean(mc / net, 2) if net and net > 0 else None
        r['pb'] = clean(mc / eq, 2) if eq and eq > 0 else None
        if ebitda and ebitda > 0 and bal.get('netdebt') is not None and not bank:
            r['ev'] = clean(mc + bal['netdebt'] + (bal.get('minority') or 0), 0); r['ev_ebitda'] = clean(r['ev'] / ebitda, 2)
    r['roe'] = clean(net / eq * 100, 2) if net is not None and eq and eq > 0 else None
    r['net_margin'] = clean(net / rev * 100, 2) if net is not None and rev and rev > 0 and not bank else None
    r['ebitda_margin'] = clean(ebitda / rev * 100, 2) if ebitda and rev and rev > 0 and not bank else None
    r['nd_ebitda'] = clean(bal['netdebt'] / ebitda, 2) if bal.get('netdebt') is not None and ebitda and ebitda > 0 and not bank else None
    return r

def pairs(s, nd): return [[i.strftime('%Y-%m-%d'), clean(v, nd)] for i, v in s.items()]

def sec():
    tk = sec_json('https://www.sec.gov/files/company_tickers.json', 'company_tickers.json')
    cikmap = {v['ticker'].upper(): str(v['cik_str']).zfill(10) for v in tk.values()}
    U = us_universe()
    try:
        raw = with_timeout(yf.download, 600, U, period='12y', auto_adjust=False, actions=True, progress=False, group_by='ticker', threads=True, timeout=30)
    except Exception as e:
        print('  yf.download falhou/travou:', e); raw = pd.DataFrame()
    done, rows, yfail = {}, [], 0
    for t in U:
        cik = cikmap.get(t.upper()) or cikmap.get(t.upper().replace('-', '.'))
        if not cik: print('  sem CIK na SEC:', t); continue
        try:
            cf = sec_json(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json', f'cf{cik}.json')
            sub = sec_json(f'https://data.sec.gov/submissions/CIK{cik}.json', f'sub{cik}.json')
        except Exception as e: print('  SEC', t, e); continue
        old = PREDECESSOR.get(cik); osub = None
        if old:
            try:
                merge_predecessor(cf, sec_json(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{old}.json', f'cf{old}.json'))
                osub = sec_json(f'https://data.sec.gov/submissions/CIK{old}.json', f'sub{old}.json')
            except Exception as e: print('  SEC predecessor', t, e)
        fund = build_us_fund(cf['facts'].get('us-gaap') or {})
        if not fund['quarterly']: print('  sem XBRL us-gaap:', t); continue
        sic = int(sub.get('sic') or 0)
        fund.update({'currency': 'USD', 'unit': 'USD', 'bank_format': sic in FIN_SIC, 'basis': 'consolidated',
                     'note': 'XBRL (10-K/10-Q), consolidated, US GAAP.'})
        prev = load_prev(f'corp/{key(t)}.json') or {}
        ba = (sub.get('addresses') or {}).get('business') or {}
        o = {'ticker': t, 'cik': cik, 'country': 'US', 'generated_at': now_iso(),
             'cad': {'DENOM_SOCIAL': sub.get('name'), 'CIK': cik, 'SIC': sub.get('sic'), 'SETOR_ATIV': sub.get('sicDescription'), 'EIN': sub.get('ein'),
                     'STATE_INC': sub.get('stateOfIncorporation'), 'FISCAL_YEAR_END': sub.get('fiscalYearEnd'), 'CATEGORY': sub.get('category'),
                     'EXCHANGES': ', '.join(x for x in (sub.get('exchanges') or []) if x), 'TICKERS': ', '.join(sub.get('tickers') or []),
                     'MUN': (ba.get('city') or '').title() or None, 'UF': ba.get('stateOrCountryDescription'), 'TEL': sub.get('phone')},
             'fundamentals': fund}
        tkr = yf.Ticker(t); info = None
        if yfail < 5:
            try: info = tkr.info; yfail = 0
            except Exception as e: yfail += 1; print('  yahoo info', t, e)
        if info and info.get('longName'):
            o['profile'] = {k: info.get(k) for k in ['longName', 'sector', 'industry', 'fullTimeEmployees', 'website', 'longBusinessSummary', 'city', 'state', 'country', 'exchange', 'currency']}
            o['yahoo_stats'] = {k: info.get(k) for k in ['marketCap', 'sharesOutstanding', 'impliedSharesOutstanding', 'trailingPE', 'priceToBook', 'enterpriseToEbitda', 'dividendYield', 'beta']}
        else:
            o['profile'] = prev.get('profile') or {}; o['yahoo_stats'] = prev.get('yahoo_stats') or {}
        sh = shares_sec(cf)
        ys = o['yahoo_stats'] or {}
        if not sh and (ys.get('impliedSharesOutstanding') or ys.get('sharesOutstanding')):
            # ex.: Berkshire: as classes A/B só aparecem com dimensão no XBRL → sem contagem utilizável na SEC; Yahoo, com a fonte explícita
            sh = {'date': None, 'total': ys.get('impliedSharesOutstanding') or ys['sharesOutstanding'], 'treasury': 0,
                  'source': 'Yahoo Finance (implied shares outstanding) – SEC XBRL has no class-independent share count for this company'}
        o['shares'] = sh
        try:
            d = raw[t].dropna(subset=['Close'])
            o['raw_close'] = pairs(d.Close, 4)
            o['dividends'] = pairs(d['Dividends'][d['Dividends'] > 0], 6); o['splits'] = pairs(d['Stock Splits'][d['Stock Splits'] > 0], 4)
        except Exception as e:
            print('  yahoo preço', t, e)
            for k in ('raw_close', 'dividends', 'splits'): o[k] = prev.get(k) or []
        try:
            a = tkr.actions
            o['dividends_full'] = pairs(a['Dividends'][a['Dividends'] > 0], 6); o['splits_full'] = pairs(a['Stock Splits'][a['Stock Splits'] > 0], 4)
        except Exception:
            o['dividends_full'] = prev.get('dividends_full') or o['dividends']; o['splits_full'] = prev.get('splits_full') or o['splits']
        o['filings'] = filings(sub, cik)
        if osub:
            o['filings'] = sorted(o['filings'] + filings(osub, old), key=lambda x: x['date'], reverse=True)[:400]
            o['cad']['PREDECESSOR'] = f"{osub.get('name')} (CIK {old})"
            fund['note'] += f" History before the reorganization from the predecessor registrant {osub.get('name')} (CIK {old})."
        o['source'] = 'SEC EDGAR – XBRL companyfacts (10-K/10-Q) and submissions (registry, filings); Yahoo Finance via yfinance (raw price, distributions, splits, profile)'
        save(f'corp/{key(t)}.json', o)
        save(f'fa/{key(t)}.json', fa_doc(t, cik, fund, cf['facts'].get('us-gaap') or {}))
        rows.append(us_row(t, o)); done[t] = cik
    if len(done) < len(U) // 2: raise RuntimeError(f'só {len(done)} de {len(U)} empresas dos EUA com dados da SEC')
    save('screener_us.json', {'generated_at': now_iso(), 'date': max((r.get('date') or '') for r in rows), 'rows': rows,
                              'source': 'SEC EDGAR XBRL (12m result = sum of the last 4 quarters; balance sheet of the latest 10-Q/10-K; shares from the filing cover); Yahoo Finance – raw price, 12m distributions, sector/industry',
                              'note': 'Market cap = raw price × shares outstanding on the latest 10-K/10-Q cover (all classes). 12m result = latest fiscal year when 4 quarters are not available (basis column). DY = distributions paid over the last 12 months ÷ price.'})
    print(f'  SEC: {len(done)} de {len(U)} empresas dos EUA')

if __name__ == '__main__':
    sys.exit(0 if step('sec', sec) else 1)
