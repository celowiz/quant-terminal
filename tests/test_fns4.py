"""Testes das funções puras de build_fns4.py (RESV, WEO, EUCV, CDR, INSD)."""
import datetime as dt
import pytest
import build_fns4 as b


def test_parse_sgs_ignora_linhas_ruins():
    js = [{'data': '02/01/2026', 'valor': '350000'}, {'data': 'x', 'valor': '1'}, {'data': '03/01/2026', 'valor': ''}, {'valor': '1'}]
    assert b.parse_sgs(js) == [('2026-01-02', 350000.0)]
    assert b.parse_sgs(None) == []


def test_change_usa_ultimo_ponto_antes_do_corte():
    s = [('2026-01-01', 100.0), ('2026-01-20', 110.0), ('2026-01-31', 125.0)]
    assert b.change(s, 7) == 15.0          # corte 24/01 → 110
    assert b.change(s, 30) == 25.0         # corte 01/01 → 100
    assert b.change(s, 400) is None
    assert b.change([], 7) is None


def test_edition():
    assert b.edition('World Economic Outlook (October 2026)') == '2026-10'
    assert b.edition('World Economic Outlook (April 2027)') == '2027-04'
    assert b.edition('Fiscal Monitor') is None and b.edition(None) is None


def test_weo_table_preenche_none_e_descarta_area_vazia():
    vals = {'NGDP_RPCH': {'BRA': {'2025': 2.31, '2026': 2.2}, 'USA': {'2026': 1.94}},
            'PCPIPCH': {'BRA': {'2026': 'nan'}}}
    t = b.weo_table(vals, [2025, 2026])
    assert t['BRA']['NGDP_RPCH'] == [2.31, 2.2]
    assert t['BRA']['PCPIPCH'] == [None, None]
    assert t['USA']['NGDP_RPCH'] == [None, 1.94]
    assert 'CHN' not in t                           # sem nenhum dado → fora
    assert set(t['BRA']) == set(b.WEO_IND)


def test_ecb_csv():
    txt = ('KEY,FREQ,TIME_PERIOD,OBS_VALUE\n'
           'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,2026-10-30,2.71\n'
           'YC.B.U2.EUR.4F.G_N_C.SV_C_YM.SR_3M,B,2026-10-30,1.95\n'
           'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,2026-10-29,\n'
           'curto,B,2026-10-30,1\n')
    d = b.ecb_csv(txt)
    assert d == {('G_N_A', '10Y'): [('2026-10-30', 2.71)], ('G_N_C', '3M'): [('2026-10-30', 1.95)]}


def test_cdr_rows_tem_feriados_conhecidos():
    r = b.cdr_rows(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
    assert set(r) == {c for c, _ in b.CDR_MARKETS}
    br = {d: (en, pt) for d, en, pt in r['BVMF']}
    assert '2026-11-02' in br and br['2026-11-02'][1] == 'Finados'
    assert '2026-12-25' in {d for d, _, _ in r['XNYS']}
    assert '2026-07-04' not in {d for d, _, _ in r['XNYS']}     # sábado: observado na sexta 03/07
    assert all('2026-01-01' <= d <= '2026-12-31' for L in r.values() for d, _, _ in L)


def _vl(**kw):
    r = {'CNPJ_Companhia': '00.000.000/0001-00', 'Data_Referencia': '2026-09-01', 'Versao': '1', 'Tipo_Empresa': 'Companhia',
         'Tipo_Cargo': 'Diretor ou Vinculado', 'Tipo_Movimentacao': 'Compra à vista', 'Tipo_Ativo': 'Ações',
         'Data_Movimentacao': '2026-09-10', 'Quantidade': '100', 'Preco_Unitario': '10,5', 'Volume': '0'}
    r.update(kw); return r


def test_vlmo_rows_ultima_versao_e_filtros():
    rows = [_vl(), _vl(Versao='2', Quantidade='200'),                         # v2 substitui v1
            _vl(CNPJ_Companhia='11', Tipo_Movimentacao='Venda à vista', Preco_Unitario='0', Volume='5000'),
            _vl(CNPJ_Companhia='22', Tipo_Ativo='Debêntures'),                 # fora: não é ação
            _vl(CNPJ_Companhia='33', Tipo_Movimentacao='Saldo Inicial'),       # fora: não é negociação
            _vl(CNPJ_Companhia='44', Preco_Unitario='0', Volume='0'),          # sem valor informado
            _vl(CNPJ_Companhia='55', Quantidade='0')]
    t = {r['cnpj']: r for r in b.vlmo_rows(rows)}
    assert set(t) == {'00.000.000/0001-00', '11', '44'}
    assert t['00.000.000/0001-00']['qty'] == 200 and t['00.000.000/0001-00']['val'] == pytest.approx(2100)
    assert t['11']['side'] == 'sell' and t['11']['val'] == 5000 and t['11']['px'] is None
    assert t['44']['val'] is None and t['44']['role'] == 'exec' and t['44']['ref'] == '2026-09'


def test_insd_br_summary():
    tr = [{'cnpj': 'A', 'ref': '2026-09', 'role': 'exec', 'side': 'buy', 'qty': 100, 'val': 1000.0},
          {'cnpj': 'A', 'ref': '2026-09', 'role': 'ctrl', 'side': 'sell', 'qty': 50, 'val': None},
          {'cnpj': 'B', 'ref': '2026-09', 'role': 'exec', 'side': 'buy', 'qty': 1, 'val': 10.0},
          {'cnpj': 'A', 'ref': '2026-03', 'role': 'exec', 'side': 'buy', 'qty': 1, 'val': 1.0},   # mês fora da janela
          {'cnpj': 'Z', 'ref': '2026-09', 'role': 'exec', 'side': 'buy', 'qty': 1, 'val': 1.0}]   # sem ticker
    s = b.insd_br_summary(tr, {'A': 'AAAA3', 'B': 'BBBB4'}, {'2026-09'})
    assert [x['tk'] for x in s] == ['AAAA3', 'BBBB4']
    a = s[0]
    assert (a['n'], a['bq'], a['sq'], a['bv'], a['sv'], a['nv']) == (2, 100, 50, 1000.0, 0.0, 1)
    assert a['roles'] == {'exec': [100, 0.0], 'ctrl': [0.0, 50]}


FORM4 = b'''<?xml version="1.0"?><ownershipDocument><issuer><issuerCik>0000320193</issuerCik></issuer>
<reportingOwner><reportingOwnerId><rptOwnerName>DOE JANE</rptOwnerName></reportingOwnerId>
<reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>true</isOfficer><officerTitle>CFO</officerTitle></reportingOwnerRelationship></reportingOwner>
<nonDerivativeTable>
<nonDerivativeTransaction><transactionDate><value>2026-10-01</value></transactionDate><transactionCoding><transactionCode>S</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>1000</value></transactionShares><transactionPricePerShare><value>12.5</value></transactionPricePerShare>
<transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction>
<nonDerivativeTransaction><transactionDate><value>2026-10-02-05:00</value></transactionDate><transactionCoding><transactionCode>M</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>10</value></transactionShares></transactionAmounts></nonDerivativeTransaction>
</nonDerivativeTable></ownershipDocument>'''


def test_form4_parse():
    icik, name, role, tx = b.form4_parse(FORM4)
    assert icik == '320193'
    assert name == 'DOE JANE' and role == 'Director, CFO'
    assert tx[0] == {'date': '2026-10-01', 'code': 'S', 'qty': 1000.0, 'px': 12.5, 'ad': 'D'}
    assert tx[1]['date'] == '2026-10-02' and tx[1]['px'] is None


def test_imf_ua_nao_imita_navegador():
    # a CDN do FMI responde 403 a 'Mozilla/…' vindo de IPs de nuvem (runners do Actions)
    assert 'mozilla' not in b.IMF_UA['User-Agent'].lower()


def test_placeholder_so_sem_json_anterior(monkeypatch):
    saved = {}
    monkeypatch.setattr(b, 'save', lambda rel, doc: saved.__setitem__(rel, doc))
    monkeypatch.setattr(b, 'load_prev', lambda rel: None)
    b.placeholder('weo.json')
    assert saved['weo.json']['unavailable'] is True
    saved.clear()
    monkeypatch.setattr(b, 'load_prev', lambda rel: {'rows': {}})
    b.placeholder('weo.json')
    assert saved == {}
