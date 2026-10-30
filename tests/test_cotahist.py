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
