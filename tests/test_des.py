"""build_des: parsers puros (sem rede)."""
import pandas as pd
from build_des import norm_name, sec_name_index, match_underlying, fmt_cnpj, br_date, bdr_divs, fii_records, registry_map, compact, sec_profile


def test_norm_name_casa_b3_e_sec():
    assert norm_name('AMAZON.COM. INC') == norm_name('AMAZON COM INC')
    assert norm_name('THE WALT DISNEY COMPANY') == norm_name('Walt Disney Co')
    assert norm_name('WELLS FARGO & COMPANY') == norm_name('WELLS FARGO & COMPANY/MN')
    assert norm_name('BANK OF AMERICA CORPORATION') == norm_name('BANK OF AMERICA CORP /DE/')
    assert norm_name('3M COMPANY') == norm_name('3M CO')
    assert norm_name('ALPHABET INC.') != norm_name('ALPHA INC')


def test_sec_index_descarta_nome_ambiguo_e_tickers_fora_de_bolsa():
    cte = {'data': [[1, '3M CO', 'MMM', 'NYSE'], [2, 'ACME CORP', 'ACM', 'NYSE'], [3, 'ACME INC', 'ACMX', 'Nasdaq'],
                    [4, 'Alphabet Inc.', 'GOOGL', 'Nasdaq'], [4, 'Alphabet Inc.', 'GOOG', 'Nasdaq'], [5, 'BP PLC', 'BP', 'NYSE'], [5, 'BP PLC', 'BPAQF', 'OTC'], [5, 'BP PLC', 'BP-PA', 'NYSE']]}
    idx = sec_name_index(cte)
    assert 'ACME' not in idx                       # dois CIKs com o mesmo nome normalizado → sem casamento
    assert match_underlying(['ALPHABET INC.'], idx)['tickers'] == ['GOOGL', 'GOOG']
    assert match_underlying(['BP PLC'], idx)['tickers'] == ['BP']
    assert match_underlying(['3M COMPANY'], idx)['cik'] == '0000000001'
    assert match_underlying(['UNKNOWN LTD'], idx) is None


def test_formatos():
    assert fmt_cnpj('12005956000165') == '12.005.956/0001-65'
    assert fmt_cnpj('') is None
    assert br_date('04/01/2012') == '2012-01-04' and br_date('x') is None
    assert compact({'a': None, 'b': '', 'c': [], 'd': 0, 'e': {'f': None}}) == {'d': 0, 'e': {}}


def test_bdr_divs():
    sup = {'cashDividends': [{'paymentDate': '17/09/2026', 'lastDatePrior': '20/08/2026', 'approvedOn': '14/08/2026', 'rate': '0,68180106100', 'label': 'DIVIDENDO', 'relatedTo': '3º Trimestre/2026'},
                             {'paymentDate': '18/06/2026', 'lastDatePrior': '20/05/2026', 'rate': '1.234,5', 'label': 'DIVIDENDO'},
                             {'paymentDate': '01/01/2026', 'rate': '', 'label': 'X'}]}
    r = bdr_divs(sup)
    assert [x['ex'] for x in r] == ['2026-08-20', '2026-05-20']
    assert abs(r[0]['rate'] - 0.681801061) < 1e-12 and r[1]['rate'] == 1234.5


def _geral(**kw):
    base = dict(CNPJ_Fundo_Classe='12.005.956/0001-65', Data_Referencia='2026-09-01', Versao='1', Nome_Fundo_Classe='KINEA RENDA', Codigo_ISIN='BRKNRICTF007',
                Data_Funcionamento='2010-08-11', Publico_Alvo='INVESTIDORES EM GERAL', Segmento_Atuacao='Multicategoria', Mandato=None, Tipo_Gestao='Ativa',
                Prazo_Duracao='Indeterminado', Encerramento_Exercicio_Social='30/06', Nome_Administrador='ADM', CNPJ_Administrador='62418140000131',
                Site='x.com', Cidade='SÃO PAULO', Estado='SP')
    base.update(kw); return base


def test_fii_records_isin_versao_e_cnpj_da_b3():
    geral = pd.DataFrame([_geral(), _geral(CNPJ_Fundo_Classe='09.552.812/0001-14', Nome_Fundo_Classe='BTG CRI', Codigo_ISIN=None)])
    rows = []
    for m in range(1, 13):
        rows.append(dict(CNPJ_Fundo_Classe='12.005.956/0001-65', Data_Referencia=f'2026-{m:02d}-01', Versao='1', Patrimonio_Liquido='100', Valor_Patrimonial_Cotas='10',
                         Cotas_Emitidas='10', Total_Numero_Cotistas='5', Numero_Cotistas_Pessoa_Fisica='4', Percentual_Dividend_Yield_Mes='0.01',
                         Percentual_Rentabilidade_Efetiva_Mes='0.02', Percentual_Rentabilidade_Patrimonial_Mes='0.0', Percentual_Despesas_Taxa_Administracao='0.001', Valor_Ativo='110'))
    rows.append({**rows[-1], 'Versao': '2', 'Patrimonio_Liquido': '200'})       # reapresentação: vale a versão mais nova
    rows.append(dict(CNPJ_Fundo_Classe='09.552.812/0001-14', Data_Referencia='2026-12-01', Versao='1', Patrimonio_Liquido='50'))
    recs = fii_records(['KNRI11.SA', 'BTCI11.SA', 'XXXX11.SA'], geral, pd.DataFrame(rows), {}, cnpj_by_root={'BTCI': '09552812000114'})
    k = recs['KNRI11.SA']
    assert k['ref'] == '2026-12' and k['pl'] == 200 and k['segment'] == 'Multicategoria' and len(k['hist']) == 12
    assert abs(k['dy_12m'] - 0.12) < 1e-9
    assert recs['BTCI11.SA']['name'] == 'BTG CRI' and recs['BTCI11.SA']['pl'] == 50 and 'dy_12m' not in recs['BTCI11.SA']
    assert 'XXXX11.SA' not in recs                 # sem ISIN nem CNPJ da B3: fica sem DES (o site mostra N/A)


def test_registry_map():
    rc = pd.DataFrame([dict(CNPJ_Classe='10406511000161', ID_Registro_Fundo='7', Denominacao_Social='ISHARES', Situacao='Em Funcionamento Normal', Tipo_Classe='FIIM',
                            Forma_Condominio='Aberto', Publico_Alvo=None, Patrimonio_Liquido='17.5', Data_Patrimonio_Liquido='2026-10-26', Auditor='PWC', Custodiante='BNP', Controlador=None)])
    rf = pd.DataFrame([dict(ID_Registro_Fundo='7', CNPJ_Fundo='10406511000161', Tipo_Fundo='FI', Data_Registro='2008-11-19', Data_Constituicao='2008-10-01',
                            Data_Adaptacao_RCVM175='2025-04-23', Data_Fim_Exercicio_Social='2027-03-31', Diretor='D', Administrador='BNP', CNPJ_Administrador='01522368000182', Gestor='BLACKROCK')])
    r = registry_map(rc, rf)['10406511000161']
    assert r['registered'] == '2008-11-19' and r['manager'] == 'BLACKROCK' and r['pl'] == 17.5 and r['admin_cnpj'] == '01.522.368/0001-82'


def test_sec_profile():
    sub = {'name': 'SPDR S&P 500 ETF TRUST', 'cik': 884394, 'entityType': 'other', 'fiscalYearEnd': '0930', 'stateOfIncorporationDescription': 'NY',
           'addresses': {'business': {'street1': '1 X ST', 'city': 'BOSTON', 'stateOrCountry': 'MA'}}, 'phone': '555',
           'filings': {'recent': {'form': ['N-CSR', '497K', 'N-CSR'], 'filingDate': ['2026-01-01', '2025-12-01', '2025-01-01']}}}
    p = sec_profile(sub)
    assert p['cik'] == '0000884394' and p['address'] == '1 X ST, BOSTON, MA' and 'phone' not in p
    assert p['filings'] == [{'form': 'N-CSR', 'date': '2026-01-01'}, {'form': '497K', 'date': '2025-12-01'}]


def test_scrub_tira_nome_do_terminal():
    from build_des import scrub
    assert scrub({'name': 'TREND ETF BLOOMBERG US 3000 TECHNOLOGY', 'x': ['Bloomberg  China'], 'n': 1}) == {'name': 'TREND ETF US 3000 TECHNOLOGY', 'x': ['China'], 'n': 1}
