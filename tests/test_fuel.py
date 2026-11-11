"""Pure tests for build_fuel.py: filename drift, CSV parse, weekly means, changes, Brent in BRL. No network."""
import datetime as dt
import build_fuel as f


def test_classify_filename_drift():
    assert f.classify_filename('07-dados-abertos-precos-gasolina-etanol.csv') == 'gasolina_etanol'
    assert f.classify_filename('10-gasolina-etanol.csv') == 'gasolina_etanol'
    assert f.classify_filename('02-cados-abertos-preco-gasolina-etanol.csv') == 'gasolina_etanol'  # typo cados/preco
    assert f.classify_filename('06-Dados Abertos - Preços 2026.06 - Diesel GNV.csv') == 'diesel_gnv'
    assert f.classify_filename('10-diesel-gnv.csv') == 'diesel_gnv'
    assert f.classify_filename('precos-glp-10.csv') == 'glp'
    assert f.classify_filename('03-dados-abertos-precos-glp.csv') == 'glp'
    assert f.classify_filename('readme.txt') is None
    assert f.classify_filename('metadados-serie-historica.pdf') is None


def test_csv_hrefs_strips_view_and_ignores_noise():
    html = '''
    <a href="https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/2026/10-gasolina-etanol.csv/view">x</a>
    <a href="10-diesel-gnv.csv">rel</a>
    <a href="https://twitter.com/share">no</a>
    <a href="metadados.pdf">no</a>
    '''
    u = f.csv_hrefs(html, 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/2026/')
    assert 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/2026/10-gasolina-etanol.csv' in u
    assert 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/2026/10-diesel-gnv.csv' in u
    html2 = '<a href="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/subvencao-a-comercializacao-de-oleo-diesel-2018">x</a>'
    assert f.csv_hrefs(html2, 'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/dsan/2026/') == []
    assert all('twitter' not in x and not x.endswith('.pdf') for x in u)
    assert all(not x.endswith('/view') for x in u)


def test_week_end_sun_sat():
    assert f.week_end(dt.date(2026, 10, 28)) == dt.date(2026, 10, 31)  # Wed
    assert f.week_end(dt.date(2026, 10, 31)) == dt.date(2026, 10, 31)  # Sat
    assert f.week_end(dt.date(2026, 11, 1)) == dt.date(2026, 11, 7)    # Sun → next Sat


def test_parse_num_and_date():
    assert f.parse_num('5,49') == 5.49
    assert f.parse_num('1.234,56') == 1234.56
    assert f.parse_num('6.12') == 6.12
    assert f.parse_num('') is None and f.parse_num('—') is None and f.parse_num('-') is None
    assert f.parse_date('28/10/2026') == dt.date(2026, 10, 28)
    assert f.parse_date('2026-10-28') == dt.date(2026, 10, 28)
    assert f.parse_date('31/02/2026') is None


def test_product_id():
    assert f.product_id('GASOLINA ADITIVADA') == 'gas_add'
    assert f.product_id('GASOLINA') == 'gasoline'
    assert f.product_id('ETANOL HIDRATADO') == 'ethanol'
    assert f.product_id('OLEO DIESEL S10') == 'diesel_s10'
    assert f.product_id('ÓLEO DIESEL S-500') == 'diesel_s500'
    assert f.product_id('OLEO DIESEL') == 'diesel'
    assert f.product_id('GNV') == 'gnv'
    assert f.product_id('GLP') == 'glp'
    assert f.product_id('água') is None


def test_iter_and_means_do_not_invent():
    csv = (
        'Regiao - Sigla;Estado - Sigla;Municipio;Produto;Data da Coleta;Valor de Venda;Unidade de Medida\n'
        'SE;SP;SAO PAULO;GASOLINA;28/10/2026;6,00;R$ / litro\n'
        'SE;SP;CAMPINAS;GASOLINA;29/10/2026;8,00;R$ / litro\n'
        'SE;RJ;RIO;GASOLINA;29/10/2026;7,00;R$ / litro\n'
        'S;RS;POA;ETANOL;29/10/2026;4,00;R$ / litro\n'
        'SE;SP;X;GASOLINA;01/02/2026;;R$ / litro\n'          # missing price
        'ZZ;ZZ;Y;GASOLINA;29/10/2026;5,00;R$ / litro\n'        # still counts in BR
        'SE;SP;Z;AGUA;29/10/2026;1,00;R$ / litro\n'            # unknown product
    )
    acc = __import__('collections').defaultdict(lambda: __import__('collections').defaultdict(dict))
    units = __import__('collections').defaultdict(lambda: __import__('collections').defaultdict(int))
    assert f.ingest(csv, acc, units) == 5  # 3 SP/RJ gas + 1 etanol + 1 BR-only (ZZ)
    m = f.means(acc)
    week = '2026-10-31'
    assert m['gasoline']['SP'][week] == 7.0          # (6+8)/2
    assert m['gasoline']['SE'][week] == 7.0          # (6+8+7)/3
    assert m['gasoline']['BR'][week] == 6.5          # (6+8+7+5)/4
    assert 'RJ' in m['gasoline'] and m['gasoline']['RJ'][week] == 7.0
    assert 'ethanol' in m and 'RS' in m['ethanol']
    assert 'S' in m['ethanol']
    assert 'gas_add' not in m
    assert '2026-02-07' not in m['gasoline']['SP']   # empty price not stored
    assert units['gasoline']['R$/L'] >= 1


def test_chg_and_brent_missing_are_none():
    series = [('2025-11-01', 5.0), ('2026-10-24', 6.0), ('2026-10-31', 6.5)]
    assert f.chg_vs(series, 6.5, 7) == 0.5
    assert f.chg_vs(series, 6.5, 364) == 1.5
    assert f.chg_vs(series[:1], 5.0, 364) is None
    assert f.chg_vs([], None, 7) is None
    weeks = ['2026-10-24', '2026-10-31']
    oil = [('2026-10-23', 100.0), ('2026-10-30', 110.0)]
    fx = [('2026-10-23', 5.0)]
    # week 24: 100*5=500; week 31: oil 110, fx still 5 (last on or before) → 550
    assert f.brent_brl_for_weeks(weeks, oil, fx) == [500.0, 550.0]
    # no fx at all
    assert f.brent_brl_for_weeks(weeks, oil, []) == [None, None]
    # week before any oil
    assert f.brent_brl_for_weeks(['2026-01-03'], oil, fx) == [None]


def test_build_doc_snapshot_and_gaps():
    means_map = {
        'gasoline': {
            'BR': {'2025-11-01': 5.0, '2026-10-24': 6.0, '2026-10-31': 6.2},
            'SE': {'2026-10-31': 6.3},
            'SP': {'2026-10-31': 6.4},
        }
    }
    units = {'gasoline': {'R$/L': 10}}
    oil = [('2026-10-30', 100.0)]
    fx = [('2026-10-30', 5.5)]
    doc = f.build_doc(means_map, units, oil, fx, generated='2026-11-10T00:00:00-03:00')
    assert doc['date'] == '2026-10-31'
    assert doc['fuels'] == [{'id': 'gasoline', 'unit': 'R$/L'}]
    assert doc['weeks'] == ['2025-11-01', '2026-10-24', '2026-10-31']
    assert doc['brent_brl'][0] is None           # no oil/fx yet
    assert doc['brent_brl'][-1] == 550.0
    assert doc['hist']['gasoline']['SE'] == [None, None, 6.3]  # gap, not 0
    br = next(r for r in doc['rows'] if r['geo'] == 'BR')
    assert br['last'] == 6.2 and br['prev'] == 6.0 and br['chg_w'] == 0.2
    assert br['chg_12m'] == 1.2 and br['brent'] == 550.0 and br['week'] == '2026-10-31'
    se = next(r for r in doc['rows'] if r['geo'] == 'SE')
    assert se['prev'] is None and se['chg_w'] is None and se['chg_12m'] is None  # only one week


def test_never_invents_on_empty_means():
    import pytest
    with pytest.raises(RuntimeError):
        f.build_doc({}, {}, [], [])
