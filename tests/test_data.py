"""Sanidade dos JSON em public/data (no build do main roda depois do pipeline; no PR só há o seed tickers.json)."""
import datetime as dt, json, os, pathlib, re
import pytest
from common import TZ

DATA = pathlib.Path(os.environ.get('QT_DATA_OUT') or pathlib.Path(__file__).resolve().parents[1] / 'public' / 'data')
FILES = sorted(DATA.rglob('*.json')) if DATA.is_dir() else []
ISO_D = re.compile(r'\d{4}-\d\d-\d\d')


def load(p):
    def bad(c): raise ValueError(f'{p.name}: constante {c} não é JSON válido')
    with open(p, encoding='utf-8') as f:
        return json.load(f, parse_constant=bad)


def brt_date(ts):
    t = dt.datetime.fromisoformat(ts)
    assert t.tzinfo is not None, f'generated_at sem fuso: {ts}'
    assert t.utcoffset() == t.astimezone(TZ).utcoffset(), f'generated_at fora do fuso de São Paulo: {ts}'
    return t.astimezone(TZ).date()


def test_tem_arquivos():
    assert (DATA / 'tickers.json').is_file()


@pytest.mark.parametrize('p', FILES, ids=lambda p: str(p.relative_to(DATA)))
def test_json_valido_e_generated_at_brt(p):
    d = load(p)
    if isinstance(d, dict) and 'generated_at' in d:
        assert brt_date(d['generated_at']) <= dt.datetime.now(TZ).date()


def test_tickers():
    d = load(DATA / 'tickers.json')
    assert d['tickers'], 'tickers.json vazio'
    for t in d['tickers']:
        assert {'ticker', 'key', 'name', 'first', 'last'} <= t.keys()
        assert ISO_D.fullmatch(t['first']) and ISO_D.fullmatch(t['last']) and t['first'] <= t['last']


def test_cdie():
    p = DATA / 'cdie.json'
    if not p.is_file(): pytest.skip('cdie.json não gerado nesta execução')
    d = load(p)
    for k in ('generated_at', 'ref_date', 'cdi', 'selic', 'selic_date', 'meetings', 'path', 'contracts', 'source'):
        assert k in d, k
    gen = brt_date(d['generated_at'])
    assert ISO_D.fullmatch(d['ref_date']) and ISO_D.fullmatch(d['selic_date'])
    # selic_date é "meta vigente em": nunca depois do dia (BRT) em que o arquivo foi gerado
    assert d['ref_date'] <= gen.isoformat()
    assert d['selic_date'] <= gen.isoformat(), (d['selic_date'], d['generated_at'])
    assert 0 < d['cdi'] < 100 and 0 < d['selic'] < 100
    assert d['contracts'] and all(c['code'].startswith('DI1') for c in d['contracts'])
