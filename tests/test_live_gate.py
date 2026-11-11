"""Porteiro do watcher (pipeline/live_gate.sh): janela, espera desde 05:00 e uma execução por vez."""
import os
import subprocess
from pathlib import Path

GATE = Path(__file__).resolve().parents[1] / 'pipeline' / 'live_gate.sh'


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


def test_in_window_runs(tmp_path):
    kv, _ = run_gate(tmp_path, 3, '1152')
    assert kv == {'go': 'true', 'slept': '0'}


def test_in_window_other_active_exits(tmp_path):
    kv, log = run_gate(tmp_path, 3, '1152', older=1)
    assert kv['go'] == 'false' and 'ativa' in log


def test_early_weekday_waits_until_seven(tmp_path):
    kv, log = run_gate(tmp_path, 3, '0624')
    assert kv == {'go': 'true', 'slept': str(36 * 60)} and '07:00' in log
    kv, _ = run_gate(tmp_path, 1, '0500')
    assert kv == {'go': 'true', 'slept': str(120 * 60)}


def test_early_with_sleeper_already_waiting_exits(tmp_path):
    kv, _ = run_gate(tmp_path, 3, '0624', older=1)
    assert kv == {'go': 'false', 'slept': '0'}


def test_out_of_window(tmp_path):
    for dow, hm in ((3, '0459'), (3, '2200'), (3, '0130'), (6, '1000'), (7, '0600'), (6, '0600')):
        kv, _ = run_gate(tmp_path, dow, hm)
        assert kv == {'go': 'false', 'slept': '0'}, (dow, hm)


def test_gh_failure_is_not_a_block(tmp_path):
    bin_ = tmp_path / 'bin'
    bin_.mkdir()
    (bin_ / 'gh').write_text('#!/bin/sh\nexit 1\n')
    (bin_ / 'gh').chmod(0o755)
    out = tmp_path / 'out'
    env = dict(os.environ, PATH=f'{bin_}:{os.environ["PATH"]}', QT_NOW_DOW='2', QT_NOW_HM='0800',
               QT_SLEEP='true', GITHUB_OUTPUT=str(out), REPO='o/r', RUN_ID='100')
    subprocess.run(['bash', str(GATE)], env=env, check=True, capture_output=True)
    assert 'go=true' in out.read_text()
