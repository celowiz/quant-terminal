"""Testes das funções puras de build_fns2.py (COT na CFTC, 13F na SEC) com entradas pequenas no formato real das fontes."""
import pytest
import build_fns2 as bf

XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip><value>2000000</value>
<shrsOrPrnAmt><sshPrnamt>10000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip><value>1000000</value>
<shrsOrPrnAmt><sshPrnamt>5000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip><value>50000</value>
<shrsOrPrnAmt><sshPrnamt>300</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><putCall>Put</putCall></infoTable>
<infoTable><nameOfIssuer>COCA COLA CO</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>191216100</cusip><value>700000</value>
<shrsOrPrnAmt><sshPrnamt>10000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
</informationTable>"""


def test_cot_index_limites():
    s = list(range(20))
    assert bf.cot_index(s) == 100.0
    assert bf.cot_index(s[::-1]) == 0.0
    assert bf.cot_index([5] * 20) is None          # sem amplitude
    assert bf.cot_index([1, 2, 3]) is None         # histórico curto
    assert bf.cot_index(list(range(300)) + [0], win=156) == 0.0   # só a janela conta


def _row(code, day, oi, ncl, ncs, cl, cs, nrl, nrs):
    return {'cftc_contract_market_code': code, 'market_and_exchange_names': 'CRUDE OIL, LIGHT SWEET - NEW YORK MERCANTILE EXCHANGE',
            'report_date_as_yyyy_mm_dd': day + 'T00:00:00.000', 'open_interest_all': str(oi),
            'noncomm_positions_long_all': str(ncl), 'noncomm_positions_short_all': str(ncs),
            'comm_positions_long_all': str(cl), 'comm_positions_short_all': str(cs),
            'nonrept_positions_long_all': str(nrl), 'nonrept_positions_short_all': str(nrs)}


def test_build_cot_obj_liquido_variacao_e_ordem():
    rows = [_row('067651', f'2026-01-{d:02d}', 1000 + d, 300 + 10 * d, 100, 400, 600 + 10 * d, 50, 50) for d in range(1, 15)]
    rows.reverse()   # ordem da API não importa
    o = bf.build_cot_obj(rows, markets=[('067651', 'CL', 'WTI', 'WTI', 'energy'), ('999999', 'XX', 'x', 'x', 'energy')])
    assert o['date'] == '2026-01-14' and len(o['markets']) == 1
    m = o['markets'][0]
    assert m['spec_net'] == 300 + 140 - 100 and m['spec_chg'] == 10
    assert m['comm_net'] == 400 - 740 and m['small_net'] == 0
    assert m['spec_idx'] == 100.0 and m['comm_idx'] == 0.0
    assert m['exchange'] == 'New York Mercantile Exchange'
    assert m['hist'][0][0] == '2026-01-01' and len(m['hist'][0]) == 5
    assert m['spec_pct_oi'] == pytest.approx(100 * 340 / 1014, abs=0.05)


def test_build_cot_obj_sem_dados_falha():
    with pytest.raises(RuntimeError):
        bf.build_cot_obj([], markets=[('067651', 'CL', 'WTI', 'WTI', 'energy')])


def test_parse_infotable_soma_linhas_e_separa_opcoes():
    a = bf.parse_infotable(XML)
    assert set(a) == {('037833100', ''), ('037833100', 'Put'), ('191216100', '')}
    aapl = a[('037833100', '')]
    assert aapl['value'] == 3000000 and aapl['shares'] == 15000 and aapl['issuer'] == 'APPLE INC'


def test_fix_units_milhares():
    agg = {('A', ''): {'value': 1500, 'shares': 10000, 'type': 'SH', 'pc': ''},     # US$ 0,15/ação → milhares
           ('B', ''): {'value': 900, 'shares': 1000, 'type': 'SH', 'pc': ''}}
    bf.fix_units(agg)
    assert agg[('A', '')]['value'] == 1500000
    ok = {('A', ''): {'value': 200000, 'shares': 1000, 'type': 'SH', 'pc': ''}}
    bf.fix_units(ok)
    assert ok[('A', '')]['value'] == 200000


def test_diff_positions_e_manager_obj():
    cur = {('A', ''): {'cusip': 'A', 'issuer': 'A', 'cls': 'COM', 'pc': '', 'value': 600, 'shares': 120, 'type': 'SH'},
           ('B', ''): {'cusip': 'B', 'issuer': 'B', 'cls': 'COM', 'pc': '', 'value': 300, 'shares': 50, 'type': 'SH'},
           ('C', ''): {'cusip': 'C', 'issuer': 'C', 'cls': 'COM', 'pc': '', 'value': 100, 'shares': 10, 'type': 'SH'}}
    prev = {('A', ''): {**cur[('A', '')], 'shares': 100}, ('B', ''): {**cur[('B', '')], 'shares': 100},
            ('D', ''): {'cusip': 'D', 'issuer': 'D', 'cls': 'COM', 'pc': '', 'value': 50, 'shares': 5, 'type': 'SH'}}
    rows, sold = bf.diff_positions(cur, prev)
    st = {r['cusip']: (r['status'], r['d_pct']) for r in rows}
    assert st == {'A': ('add', 20.0), 'B': ('cut', -50.0), 'C': ('new', None)}
    assert [s['cusip'] for s in sold] == ['D']
    m = bf.manager_obj(1, 'X', 's', 's', cur, prev, '2026-06-30', '2026-08-14', '2026-03-31')
    assert m['value'] == 1000 and m['n'] == 3 and m['positions'][0]['w'] == 60.0
    assert m['counts'] == {'new': 1, 'add': 1, 'cut': 1, 'same': 0, 'sold': 1}
    assert bf.diff_positions(cur, None)[0][0]['status'] is None


def test_consensus_ignora_opcoes():
    r1 = [{'cusip': 'A', 'issuer': 'A', 'cls': 'COM', 'pc': '', 'type': 'SH', 'value': 10, 'status': 'add'},
          {'cusip': 'A', 'issuer': 'A', 'cls': 'COM', 'pc': 'Put', 'type': 'SH', 'value': 99, 'status': 'new'}]
    r2 = [{'cusip': 'A', 'issuer': 'A', 'cls': 'COM', 'pc': '', 'type': 'SH', 'value': 5, 'status': 'cut'},
          {'cusip': 'B', 'issuer': 'B', 'cls': 'COM', 'pc': '', 'type': 'SH', 'value': 50, 'status': 'same'}]
    c = bf.consensus([('M1', r1), ('M2', r2)])
    assert c[0] == {'cusip': 'A', 'issuer': 'A', 'cls': 'COM', 'holders': 2, 'value': 15, 'buyers': 1, 'sellers': 1, 'who': ['M1', 'M2']}
    assert c[1]['cusip'] == 'B'
