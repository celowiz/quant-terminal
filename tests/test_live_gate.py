"""Porteiro do watcher (pipeline/live_gate.sh): janela, espera até 07:00, espera noturna e uma execução por vez."""
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

GATE = Path(__file__).resolve().parents[1] / 'pipeline' / 'live_gate.sh'

# Constantes iguais às de live_gate.sh (segundos).
REACH = 5 * 3600
CHUNK = 5 * 3600 + 20 * 60
AHEAD = 15 * 60
STANDBY_SLEEP = CHUNK - AHEAD  # 18300 = 5h05


def run_gate(tmp_path, dow, hm, older=0):
    bin_ = tmp_path / 'bin'
    bin_.mkdir(exist_ok=True)
    (bin_ / 'gh').write_text(f'#!/bin/sh\necho {older}\n')
    (bin_ / 'gh').chmod(0o755)
    out = tmp_path / 'out'
    out.write_text('')
    env = dict(os.environ, PATH=f'{bin_}:{os.environ["PATH"]}', QT_NOW_DOW=str(dow), QT_NOW_HM=hm,
               QT_SLEEP='true', GITHUB_OUTPUT=str(out), REPO='o/r', RUN_ID='100', AFTER='99')
    log = subprocess.run(['bash', str(GATE)], env=env, capture_output=True, text=True, check=True).stdout
    kv = dict(line.split('=', 1) for line in out.read_text().split())
    return kv, log


def base(**kw):
    d = {'go': 'false', 'slept': '0', 'standby': 'false', 'sleep_s': '0', 'next_mode': 'watch'}
    d.update(kw)
    return d


def test_in_window_runs(tmp_path):
    kv, log = run_gate(tmp_path, 3, '1152')
    assert kv == base(go='true') and 'janela' in log


def test_in_window_other_active_exits(tmp_path):
    kv, log = run_gate(tmp_path, 3, '1152', older=1)
    assert kv == base() and 'ativa' in log


def test_early_weekday_waits_until_seven(tmp_path):
    kv, log = run_gate(tmp_path, 3, '0624')
    assert kv == base(go='true', slept=str(36 * 60)) and '07:00' in log
    kv, _ = run_gate(tmp_path, 1, '0500')
    assert kv == base(go='true', slept=str(120 * 60))
    # 05:00 deixou de ser o piso: qualquer horário de dia útil a até 5 h da abertura dorme e vira o watcher
    kv, _ = run_gate(tmp_path, 4, '0459')
    assert kv == base(go='true', slept=str(121 * 60))
    kv, _ = run_gate(tmp_path, 2, '0200')
    assert kv == base(go='true', slept=str(REACH))


def test_early_with_sleeper_already_waiting_exits(tmp_path):
    kv, _ = run_gate(tmp_path, 3, '0624', older=1)
    assert kv == base()
    kv, _ = run_gate(tmp_path, 6, '1000', older=1)
    assert kv == base()
    kv, log = run_gate(tmp_path, 5, '2200', older=1)
    assert kv == base() and 'ativa' in log


def test_evening_and_weekend_start_standby(tmp_path):
    for dow, hm, until_min in (
        (3, '2200', 9 * 60),           # qua 22:00 → qui 07:00 (9 h)
        (3, '0130', 5 * 60 + 30),      # qua 01:30 → 07:00 (5h30 > 5 h): um bloco, o próximo vira watcher
        (4, '2200', 9 * 60),           # qui 22:00 → sex 07:00
        (5, '2200', 57 * 60),          # sex 22:00 → seg 07:00 (57 h)
        (6, '1000', 45 * 60),          # sáb 10:00 → seg 07:00
        (6, '0600', 49 * 60),          # sáb 06:00 → seg 07:00
        (7, '0600', 25 * 60),          # dom 06:00 → seg 07:00
        (7, '2200', 9 * 60),           # dom 22:00 → seg 07:00
    ):
        kv, log = run_gate(tmp_path, dow, hm)
        cap = min(CHUNK, until_min * 60)
        assert kv == base(standby='true', sleep_s=str(cap - AHEAD), next_mode='standby'), (dow, hm, kv)
        assert 'espera noturna' in log and 'abertura' in log


def test_standby_sleep_capped_just_over_reach(tmp_path):
    # qua 01:59: 5h01 até 07:00, acima de REACH — bloco limitado à abertura menos AHEAD
    kv, _ = run_gate(tmp_path, 3, '0159')
    assert kv == base(standby='true', sleep_s=str((5 * 60 + 1) * 60 - AHEAD), next_mode='standby')


def test_gh_failure_is_not_a_block(tmp_path):
    bin_ = tmp_path / 'bin'
    bin_.mkdir()
    (bin_ / 'gh').write_text('#!/bin/sh\nexit 1\n')
    (bin_ / 'gh').chmod(0o755)
    out = tmp_path / 'out'
    env = dict(os.environ, PATH=f'{bin_}:{os.environ["PATH"]}', QT_NOW_DOW='2', QT_NOW_HM='0800',
               QT_SLEEP='true', GITHUB_OUTPUT=str(out), REPO='o/r', RUN_ID='100')
    subprocess.run(['bash', str(GATE)], env=env, check=True, capture_output=True)
    assert 'go=true' in out.read_text() and 'standby=false' in out.read_text()


def _advance(dow, hm, seconds):
    """Avança um (dow 1–7, HHMM) por `seconds`. Semana âncora: 2026-11-09 é segunda."""
    base = datetime(2026, 11, 8)  # domingo
    dt = base + timedelta(days=dow, hours=int(hm[:2]), minutes=int(hm[2:]), seconds=0)
    dt = dt + timedelta(seconds=seconds)
    return dt.isoweekday(), dt.strftime('%H%M')


def _simulate(tmp_path, dow, hm, older=0, limit=20):
    """Simula a cadeia de esperas até virar o watcher. Retorna a lista de (dow, hm, kv)."""
    hops = []
    for _ in range(limit):
        kv, _ = run_gate(tmp_path, dow, hm, older=older)
        hops.append((dow, hm, kv))
        if kv['go'] == 'true':
            return hops
        if kv['standby'] != 'true':
            raise AssertionError(f'parou sem go nem standby: {dow} {hm} {kv}')
        dow, hm = _advance(dow, hm, int(kv['sleep_s']))
    raise AssertionError(f'não chegou às 07:00 em {limit} elos: {hops}')


def test_thursday_evening_reaches_friday_open(tmp_path):
    hops = _simulate(tmp_path, 4, '2200')
    assert len(hops) == 2
    assert hops[0][2]['standby'] == 'true' and hops[0][2]['sleep_s'] == str(STANDBY_SLEEP)
    # 22:00 + 5h05 = sex 03:05; daí dorme até 07:00 e vira o watcher
    assert hops[1][:2] == (5, '0305')
    assert hops[1][2] == base(go='true', slept=str((4 * 60 - 5) * 60))


def test_friday_evening_reaches_monday_open(tmp_path):
    hops = _simulate(tmp_path, 5, '2200')
    assert hops[-1][2]['go'] == 'true'
    assert hops[-1][2]['standby'] == 'false'
    # última espera começa numa madrugada de segunda e dorme até 07:00
    assert hops[-1][0] == 1
    assert hops[-1][2]['slept'] == str((7 * 60 - int(hops[-1][1][:2]) * 60 - int(hops[-1][1][2:])) * 60)
    # cadeia robusta, número razoável de execuções (blocos de ~5 h em 57 h)
    assert 8 <= len(hops) <= 15
    assert all(h[2]['standby'] == 'true' for h in hops[:-1])
    # nenhum bloco passa de 5h20, e o sono é 15 min antes do teto (salvo cap na abertura)
    for dow, hm, kv in hops[:-1]:
        assert 60 <= int(kv['sleep_s']) <= STANDBY_SLEEP


def test_sunday_evening_reaches_monday_open(tmp_path):
    hops = _simulate(tmp_path, 7, '2200')
    assert len(hops) == 2
    assert hops[0][2]['standby'] == 'true'
    assert hops[1][0] == 1 and hops[1][2]['go'] == 'true'


def test_standby_arriving_in_window_becomes_watcher(tmp_path):
    # mode é só documental no disparo: o porteiro decide pela hora. Chegada às 07:05 = watcher.
    kv, log = run_gate(tmp_path, 1, '0705')
    assert kv == base(go='true') and 'janela' in log
    kv, _ = run_gate(tmp_path, 5, '2149')
    assert kv == base(go='true')
