"""Pipeline em paralelo: gravação atômica, QT_SKIP_STEPS, ECTR só com divulgação nova, ordem das trilhas do run_all.sh."""
import json, os, re, warnings
import common, build_credit as bc

HERE = os.path.dirname(__file__)
RUN_ALL = open(os.path.join(HERE, '..', 'pipeline', 'run_all.sh'), encoding='utf-8').read()


def test_write_atomic_bytes_e_texto(tmp_path):
    p = tmp_path / 'sub' / 'a.zip'
    common.write_atomic(str(p), b'PK\x03\x04')
    assert p.read_bytes() == b'PK\x03\x04'
    common.write_atomic(str(p), 'ção')
    assert p.read_text(encoding='utf-8') == 'ção'
    assert [x.name for x in p.parent.iterdir()] == ['a.zip']   # nenhum .tmp sobrando


def test_save_e_atomico(tmp_path, monkeypatch):
    monkeypatch.setattr(common, 'OUT', str(tmp_path))
    common.save('x/y.json', {'a': 1})
    assert json.loads((tmp_path / 'x' / 'y.json').read_text()) == {'a': 1}
    assert not list((tmp_path / 'x').glob('*.tmp'))


def test_skip_steps(monkeypatch):
    called = []
    monkeypatch.setenv('QT_SKIP_STEPS', ' tayl , ectr')
    assert common.skipped('tayl') and common.skipped('ectr') and not common.skipped('wb')
    assert common.step('ectr', lambda: called.append(1)) is True and called == []
    assert common.step('wb', lambda: called.append(2)) is True and called == [2]
    monkeypatch.delenv('QT_SKIP_STEPS')
    assert not common.skipped('tayl')


def test_ectr_unchanged():
    u = {'year': '2026', 'monthNumber': '9', 'updated': '2026-10-06'}
    prev = {'status': 'ok', 'rows': [{'c': 'x'}], 'updated': '2026-10-06', 'last_year': 2026, 'last_month': 9}
    assert bc.ectr_unchanged(prev, u)
    assert not bc.ectr_unchanged({**prev, 'updated': '2026-09-04'}, u)          # divulgação nova
    assert not bc.ectr_unchanged({**prev, 'last_month': 8}, u)                  # mês novo
    assert not bc.ectr_unchanged({**prev, 'status': 'stale'}, u)                # última tentativa falhou
    assert not bc.ectr_unchanged({**prev, 'rows': []}, u)
    assert not bc.ectr_unchanged(None, u) and not bc.ectr_unchanged(prev, {'year': '2026', 'monthNumber': '9'})


def test_ectr_pula_sem_divulgacao_nova(monkeypatch):
    prev = {'status': 'ok', 'rows': [{'c': 'x'}], 'updated': '2026-10-06', 'last_year': 2026, 'last_month': 9}

    class R:
        status_code = 200
        def json(self): return {'data': {'year': '2026', 'monthNumber': '9', 'updated': '2026-10-06'}}
    monkeypatch.delenv('ECTR_FORCE', raising=False)
    monkeypatch.setattr(bc.requests, 'get', lambda *a, **k: R())
    monkeypatch.setattr(bc, 'load_out', lambda rel: prev)
    monkeypatch.setattr(bc, 'cx_post', lambda *a, **k: (_ for _ in ()).throw(AssertionError('não devia consultar')))
    monkeypatch.setattr(bc, 'save', lambda *a, **k: (_ for _ in ()).throw(AssertionError('não devia gravar')))
    bc.ectr()


def test_aviso_inplace_do_yfinance_silenciado():
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('default')
        common.quiet_yfinance()
        warnings.warn_explicit('The inplace keyword is deprecated', DeprecationWarning, 'utils.py', 1, module='yfinance.utils')
        warnings.warn_explicit('outro aviso', DeprecationWarning, 'utils.py', 2, module='yfinance.utils')
    assert [str(x.message) for x in w] == ['outro aviso']


def _order():
    return [m.group(1) for m in re.finditer(r'^\s*(?:STEP_TIMEOUT=\d+ )?run (\w+)\s', RUN_ALL, re.M)]


def test_run_all_tem_todas_as_etapas_uma_vez():
    names = _order()
    assert sorted(names) == sorted(set(names))
    assert set(names) == {'prices', 'markets', 'calendar', 'options', 'corp', 'rates', 'news', 'anb', 'fns1', 'fns3',
                          'fns2', 'extra', 'macro', 'credit', 'sec', 'des', 'fns4', 'slim', 'coverage', 'alerts'}


def test_run_all_respeita_dependencias():
    names = _order()
    before = lambda a, b: names.index(a) < names.index(b)
    for a, b in [('prices', 'markets'), ('markets', 'corp'), ('markets', 'calendar'), ('calendar', 'options'),
                 ('sec', 'des'), ('des', 'fns4'), ('extra', 'macro'), ('macro', 'credit'), ('coverage', 'alerts'), ('slim', 'coverage')]:
        assert before(a, b), (a, b)
    # fase 2 só começa depois do primeiro wait (fase 1 inteira), fase 3 depois do segundo
    waits = [m.start() for m in re.finditer(r'^wait$', RUN_ALL, re.M)]
    pos = lambda n: re.search(rf'^\s*(?:STEP_TIMEOUT=\d+ )?run {n}\s', RUN_ALL, re.M).start()
    assert len(waits) == 2
    for n in ('prices', 'markets', 'corp', 'rates', 'fns2', 'calendar', 'options'): assert pos(n) < waits[0], n
    for n in ('extra', 'macro', 'credit', 'sec', 'des'): assert waits[0] < pos(n) < waits[1], n
    for n in ('slim', 'coverage', 'alerts'): assert pos(n) > waits[1], n
    assert 'prices' in RUN_ALL[RUN_ALL.rindex('for f in'):]   # só a falha de prices derruba o job


def test_cx_updated_repete_em_429(monkeypatch):
    class R:
        def __init__(self, code): self.status_code = code
        def json(self): return {'data': {'updated': '2026-10-06', 'year': '2026', 'monthNumber': '09'}} if self.status_code == 200 else {'error': {'code': 429}}
    seq = iter([R(429), R(200)])
    monkeypatch.setattr(bc.requests, 'get', lambda *a, **k: next(seq))
    monkeypatch.setattr(bc.time, 'sleep', lambda s: None)
    assert bc.cx_updated()['updated'] == '2026-10-06'
