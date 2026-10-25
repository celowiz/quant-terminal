"""Datas do pipeline em America/Sao_Paulo (o runner do Actions roda em UTC)."""
import datetime as dt, pathlib, re
from common import TZ, today_brt, now_iso
from build_rates import upto

UTC = dt.timezone.utc


def test_today_brt_vira_o_dia_as_0h_de_sao_paulo():
    # 22h18 BRT de 24/10 = 01h18 UTC de 25/10: em UTC já seria o dia seguinte
    assert today_brt(dt.datetime(2026, 10, 25, 1, 18, tzinfo=UTC)) == dt.date(2026, 10, 24)
    assert today_brt(dt.datetime(2026, 10, 25, 2, 59, tzinfo=UTC)) == dt.date(2026, 10, 24)
    assert today_brt(dt.datetime(2026, 10, 25, 3, 0, tzinfo=UTC)) == dt.date(2026, 10, 25)


def test_now_iso_tem_fuso_de_sao_paulo():
    s = now_iso()
    t = dt.datetime.fromisoformat(s)
    assert t.utcoffset() == t.astimezone(TZ).utcoffset()
    assert re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d', s)


def test_selic_date_nao_passa_de_hoje_brt():
    # SGS 432 publica a meta vigente também para dias futuros; antes o corte usava a data UTC
    rows = [(dt.date(2026, 10, d), 13.75) for d in range(22, 29)]
    run_at = dt.datetime(2026, 10, 25, 1, 18, tzinfo=UTC)  # execução real que gerou selic_date '2026-10-25'
    sel = upto(rows, today_brt(run_at))
    assert sel[-1][0] == dt.date(2026, 10, 24)


def test_pipeline_nao_usa_date_today():
    """Regressão: dt.date.today() no runner é a data UTC."""
    for p in pathlib.Path(__file__).resolve().parents[1].joinpath('pipeline').glob('*.py'):
        code = '\n'.join(l.split('#')[0] for l in p.read_text(encoding='utf-8').splitlines())
        assert 'date.today()' not in code, p.name
        assert 'datetime.now()' not in code and 'utcnow(' not in code, p.name
