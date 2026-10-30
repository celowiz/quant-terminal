"""Testes das funções puras de build_fns3.py (FIIM: CVM informe mensal + COTAHIST; FNDS: informe diário; BKS: IF.data)."""
import datetime as dt
import numpy as np
import pandas as pd
import pytest
import build_fns3 as bf


def _fii_frames(months=13, dy=0.008, vpa=100.0):
    refs = [str(p) + '-01' for p in pd.period_range(end='2026-09', periods=months, freq='M')]
    geral = pd.DataFrame({'CNPJ_Fundo_Classe': ['11.111.111/0001-11'] * 2, 'Data_Referencia': [refs[-2], refs[-1]], 'Versao': ['1', '1'],
                          'Nome_Fundo_Classe': ['FII TESTE', 'FII TESTE'], 'Codigo_ISIN': ['BRTSTECTF000'] * 2,
                          'Segmento_Atuacao': ['Logística'] * 2, 'Mandato': ['Renda'] * 2, 'Tipo_Gestao': ['Ativa'] * 2, 'Nome_Administrador': ['ADM'] * 2})
    comp = pd.DataFrame({'CNPJ_Fundo_Classe': ['11.111.111/0001-11'] * months, 'Data_Referencia': refs, 'Versao': ['1'] * months,
                         'Total_Numero_Cotistas': [str(1000 + i) for i in range(months)], 'Patrimonio_Liquido': ['1e8'] * months,
                         'Cotas_Emitidas': ['1e6'] * months, 'Valor_Patrimonial_Cotas': [str(vpa)] * months,
                         'Percentual_Dividend_Yield_Mes': [str(dy)] * months})
    # versão 2 do último mês substitui a 1 (reapresentação)
    comp = pd.concat([comp, comp.tail(1).assign(Versao='2', Total_Numero_Cotistas='5000')])
    return geral, comp


def test_fii_table_dy_pvp_e_versao():
    g, c = _fii_frames()
    q = {'BRTSTECTF000': {'code': 'TSTE11', 'close': 80.0, 'date': '2026-10-29', 'first': 100.0, 'adtv': 1e6, 'sessions': 21}}
    rows = bf.fii_table(g, c, q)
    assert len(rows) == 1; r = rows[0]
    assert r['code'] == 'TSTE11' and r['ref'] == '2026-09'
    assert r['pvp'] == pytest.approx(0.8)
    assert r['dist_m'] == pytest.approx(0.8)                 # 0,8% × VP 100
    assert r['dy_12m'] == pytest.approx(12 * 0.8 / 80 * 100)  # só 12 meses entram, sobre o preço
    assert r['holders'] == 5000                              # versão mais nova
    assert r['chg_1m'] == pytest.approx(-20.0)
    assert r['nav_chg_12m'] == pytest.approx(0.0)


def test_fii_table_filtros_e_historico_curto():
    g, c = _fii_frames(months=6)
    q = {'BRTSTECTF000': {'code': 'TSTE11', 'close': 80.0, 'date': '2026-10-29', 'first': 80.0, 'adtv': 1e6, 'sessions': 21}}
    r = bf.fii_table(g, c, q)[0]
    assert r['dy_12m'] is None and r['months'] == 6           # sem 12 meses, sem DY 12m
    assert bf.fii_table(g, c, {}) == []                       # sem cotação na B3, fora
    q['BRTSTECTF000']['adtv'] = 10.0
    assert bf.fii_table(g, c, q) == []                        # sem liquidez, fora


def test_fii_quotes_media_e_fatcot():
    d1, d2 = dt.date(2026, 10, 28), dt.date(2026, 10, 29)
    row = lambda last, vol, fat=1, bdi='12': {'tpmerc': '010', 'codbdi': bdi, 'last': last, 'isin': 'BRX', 'fatcot': fat, 'vol': vol, 'code': 'XXXX11'}
    q = bf.fii_quotes([(d1, [row(100, 1000), row(5, 1, bdi='02')]), (d2, [row(110, 3000)])])
    assert q['BRX']['close'] == 110 and q['BRX']['first'] == 100 and q['BRX']['adtv'] == 2000 and q['BRX']['date'] == '2026-10-29'


def test_fund_metrics():
    dates = pd.bdate_range('2025-09-01', '2026-10-28')
    q = np.linspace(100, 120, len(dates)); q[len(q) // 2] = 90           # um tombo de ~-17% no meio
    m = bf.fund_metrics(dates, q, np.full(len(dates), 1e9), np.ones(len(dates)) * 10, np.full(len(dates), 500.0))
    assert m['date'] == '2026-10-28' and m['pl'] == 1e9 and m['holders'] == 500
    assert m['mdd_12m'] < -15 and m['ret_12m'] > 0 and m['ret_ytd'] is not None
    assert m['flow_1m'] == pytest.approx(10 * len([d for d in dates if d > pd.Timestamp('2026-09-28')]))
    short = bf.fund_metrics(dates[-60:], q[-60:], np.full(60, 1e9), np.zeros(60), np.full(60, 1.0))
    assert short['ret_12m'] is None and short['ret_ytd'] is None
    assert bf.fund_metrics(dates[:10], q[:10], np.ones(10), np.zeros(10), np.ones(10)) is None


def test_quarters_e_anualizacao():
    assert bf.quarters_back(3, dt.date(2026, 10, 30)) == ['202609', '202606', '202603']
    assert bf.quarters_back(2, dt.date(2026, 2, 1)) == ['202512', '202509']
    assert bf.ann_factor('202603') == 4.0 and bf.ann_factor('202606') == 2.0


def test_bank_table():
    v = lambda c, k, s: {'CodInst': c, 'NomeColuna': k, 'Saldo': s}
    q = {'202606': [v('A', 'Ativo Total', 100.0), v('A', 'Carteira de Crédito', 55.0), v('A', 'Patrimônio Líquido', 10.0), v('A', 'Lucro Líquido', 1.0),
                    v('A', 'Índice de Basileia', 0.15), v('B', 'Ativo Total', 200.0), v('B', 'Patrimônio Líquido', 0.0)],
         '202506': [v('A', 'Carteira de Crédito', 50.0), v('A', 'Índice de Basileia', 0.14)]}
    cad = [{'CodInst': 'A', 'NomeInstituicao': 'BANCO A - PRUDENCIAL', 'Sr': 'S1'}]
    rows = bf.bank_table(q, cad)
    assert [r['id'] for r in rows] == ['B', 'A']              # ordem por ativo
    a = rows[1]
    assert a['name'] == 'BANCO A' and a['seg'] == 'S1' and a['basel'] == 15.0
    assert a['roe'] == pytest.approx(20.0)                    # 1 × 2 ÷ 10 (semestre de 6 meses)
    assert a['credit_yoy'] == pytest.approx(10.0) and a['credit_assets'] == 55.0
    assert a['hist'][0] == ['202506', 14.0, 50.0, None]
    assert rows[0]['roe'] is None                             # PL zero não vira ROE
