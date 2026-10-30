"""COTAHIST (B3): fechamento oficial da última barra BR e ações equivalentes das units."""
import io, zipfile
import cotahist as ch
import build_corp as bc


def _line(code, last, bdi='02', tpmerc='010', fat=1, date='20261029', qty=1000):
    """registro tipo 01 do layout COTAHIST (245 posições)"""
    s = ['0'] * 245
    def put(a, b, v): s[a - 1:b] = list(str(v).rjust(b - a + 1, '0') if isinstance(v, int) else str(v).ljust(b - a + 1))
    put(1, 2, '01'); put(3, 10, date); put(11, 12, bdi); put(13, 24, code); put(25, 27, tpmerc)
    for a, b in ((57, 69), (70, 82), (83, 95), (96, 108), (109, 121)): put(a, b, int(round(last * 100)))
    put(148, 152, 7); put(153, 170, qty); put(171, 188, int(round(last * qty * 100))); put(211, 217, fat)
    return ''.join(s)


def test_official_closes_filtra_mercado_a_vista():
    txt = ('\n'.join([_line('PETR4', 52.2), _line('BOVA11', 140.1, bdi='14'), _line('PETRK520', 1.2, tpmerc='070'),
                                _line('XXXX3', 0.0), _line('ABCD3', 300.0, fat=1000)]) + '\n')
    b = io.BytesIO(); zipfile.ZipFile(b, 'w').writestr('COTAHIST_D29102026.TXT', txt)
    rows = ch.parse(b.getvalue())
    o = ch.official_closes(rows)
    assert set(o) == {'PETR4', 'BOVA11', 'ABCD3'}
    assert o['PETR4']['close'] == 52.2 and o['PETR4']['time'] == '2026-10-29' and o['PETR4']['volume'] == 1000
    assert o['ABCD3']['close'] == 0.3                      # cotação por lote de 1000 (fatcot)


def test_apply_official_substitui_acrescenta_ou_mantem():
    bar = {'time': '2026-10-29', 'open': 52.05, 'high': 53.03, 'low': 51.75, 'close': 52.2, 'volume': 5}
    r = [{'time': '2026-10-28', 'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 1},
         {'time': '2026-10-29', 'open': 2, 'high': 2, 'low': 2, 'close': 51.9, 'volume': 1}]
    out, how = ch.apply_official([dict(x) for x in r], bar)
    assert how == 'replaced' and out[-1]['close'] == 52.2 and len(out) == 2
    out, how = ch.apply_official([dict(r[0])], bar)
    assert how == 'appended' and out[-1]['time'] == '2026-10-29'
    later = r + [{'time': '2026-10-30', 'open': 3, 'high': 3, 'low': 3, 'close': 3, 'volume': 1}]
    out, how = ch.apply_official([dict(x) for x in later], bar)
    assert how is None and out[-1]['time'] == '2026-10-30'


def test_unit_equiv_e_unidade_das_acoes():
    off = {'TAEE11': {'time': '2026-10-29', 'close': 30.0}, 'TAEE3': {'time': '2026-10-29', 'close': 12.0}, 'TAEE4': {'time': '2026-10-29', 'close': 12.0}}
    sh = {'on': 600, 'pn': 400, 'total': 1000, 'treasury': 0}
    u = bc.unit_equiv('TAEE11.SA', sh, off)
    assert u['equiv'] == 400 and u['equiv_date'] == '2026-10-29'
    assert bc.unit_equiv('TAEE11.SA', sh, {'TAEE11': off['TAEE11']}) is None   # sem preço das classes: não inventa
    assert bc.fix_share_units({'on': 30e6, 'pn': 0, 'total': 30e6, 'treasury': 0}, ref=29e6)['total'] == 30e6   # small cap real
    assert bc.fix_share_units({'on': 4.5e6, 'pn': 0, 'total': 4.5e6, 'treasury': 0}, ref=4.4e9)['total'] == 4.5e9  # em milhares
    assert bc.fix_share_units({'on': 4.5e6, 'pn': 0, 'total': 4.5e6, 'treasury': 0})['total'] == 4.5e9            # sem referência


def test_b3_cnpj_formata_e_exige_codigo_exato(monkeypatch):
    import build_corp
    res = {'results': [{'issuingCompany': 'TGMAX', 'cnpj': '1'}, {'issuingCompany': 'TGMA', 'cnpj': '2351144000118'}]}
    monkeypatch.setattr(build_corp, 'get_json', lambda url: res)
    assert build_corp.b3_cnpj('TGMA') == '02.351.144/0001-18'
    assert build_corp.b3_cnpj('ZZZZ') is None


def _bars():
    return [{'time': '2026-10-22', 'open': 202.29, 'high': 203.07, 'low': 199.89, 'close': 200.96, 'volume': 1},
            {'time': '2026-10-23', 'open': 201.13, 'high': 202.67, 'low': 200.23, 'close': 201.69, 'volume': 1},
            {'time': '2026-10-26', 'open': 140.0, 'high': 175.82, 'low': 140.0, 'close': 172.42, 'volume': 9},   # negócio isolado a 140
            {'time': '2026-10-27', 'open': 174.5, 'high': 175.66, 'low': 171.9, 'close': 173.0, 'volume': 1}]


def test_suspect_marca_so_a_barra_ruim():
    r = _bars()
    assert [ch.suspect(r, i) for i in range(len(r))] == [False, False, True, False]


def test_repair_usa_oficial_e_nao_inventa():
    off = {'2026-10-26': {'time': '2026-10-26', 'open': 176.1, 'high': 176.4, 'low': 171.3, 'close': 172.42, 'volume': 5}}
    out, fixed = ch.repair_bad_bars(_bars(), official=lambda d: off.get(d))
    assert fixed == ['2026-10-26']
    b = out[2]
    assert (b['open'], b['high'], b['low'], b['close'], b['volume']) == (176.1, 176.4, 171.3, 172.42, 9)
    # sem referência: a barra fica como veio
    out, fixed = ch.repair_bad_bars(_bars(), official=lambda d: None)
    assert fixed == [] and out[2]['open'] == 140.0


def test_repair_mantem_correcao_da_execucao_anterior():
    prev = _bars(); prev[2] = {**prev[2], 'open': 176.1, 'high': 176.4, 'low': 171.3}
    out, fixed = ch.repair_bad_bars(_bars(), prev=prev)
    assert fixed == ['2026-10-26'] and out[2]['low'] == 171.3


def test_repair_ignora_oficial_de_outra_escala():
    off = {'2026-10-26': {'time': '2026-10-26', 'open': 17.6, 'high': 17.64, 'low': 17.1, 'close': 17.24, 'volume': 5}}
    out, fixed = ch.repair_bad_bars(_bars(), official=lambda d: off.get(d))
    assert fixed == [] and out[2]['open'] == 140.0
