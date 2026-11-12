"""Encadeamento do watcher (pipeline/live_chain.sh): disparo com novas tentativas, inclusive startup_failure."""
import json
import os
import subprocess
from pathlib import Path

CHAIN = Path(__file__).resolve().parents[1] / 'pipeline' / 'live_chain.sh'

GH_MOCK = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
argv, state_p = sys.argv[1:], Path(os.environ["GH_STATE"])
st = json.loads(state_p.read_text())
log = Path(os.environ["GH_LOG"])
log.write_text(log.read_text() + " ".join(argv) + "\n")
if argv[:2] == ["workflow", "run"]:
    nxt = st.get("next") or []
    if st.get("dispatch_fail"):
        n = st.get("fail_left", 0)
        if n > 0:
            st["fail_left"] = n - 1
            state_p.write_text(json.dumps(st))
            sys.exit(1)
    if not nxt:
        state_p.write_text(json.dumps(st))
        sys.exit(0)
    st["runs"] = st.get("runs") or []
    st["runs"].append(nxt.pop(0))
    st["next"] = nxt
    state_p.write_text(json.dumps(st))
    sys.exit(0)
if argv[:2] == ["run", "list"]:
    for run in st.get("runs") or []:
        print(run["id"], run["status"], run.get("conclusion") or "-")
    sys.exit(0)
sys.exit(1)
'''


def _write_gh(tmp_path):
    bin_ = tmp_path / 'bin'
    bin_.mkdir(exist_ok=True)
    (bin_ / 'gh').write_text(GH_MOCK)
    (bin_ / 'gh').chmod(0o755)
    return bin_


def _run(tmp_path, bin_, state, mode='standby', tries=4):
    (tmp_path / 'state').write_text(json.dumps(state))
    (tmp_path / 'log').write_text('')
    env = dict(
        os.environ,
        PATH=f'{bin_}:{os.environ["PATH"]}',
        REPO='o/r',
        RUN_ID='100',
        GH_STATE=str(tmp_path / 'state'),
        GH_LOG=str(tmp_path / 'log'),
        QT_SLEEP='true',
        QT_CHAIN_TRIES=str(tries),
        QT_CHAIN_WAIT='2',
        QT_CHAIN_POLL='2',
        QT_CHAIN_RETRY_WAIT='1',
    )
    r = subprocess.run(['bash', str(CHAIN), mode], env=env, capture_output=True, text=True)
    return r, (tmp_path / 'log').read_text(), json.loads((tmp_path / 'state').read_text())


def test_dispatch_success(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {'runs': [], 'next': [{'id': 201, 'status': 'in_progress'}]})
    assert r.returncode == 0, r.stderr + r.stdout
    assert 'próxima em andamento (201)' in r.stdout
    assert log.count('workflow run') == 1
    assert '-f mode=standby' in log and '-f after=100' in log


def test_retry_on_startup_failure(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {
        'runs': [],
        'next': [
            {'id': 201, 'status': 'completed', 'conclusion': 'startup_failure'},
            {'id': 202, 'status': 'in_progress'},
        ],
    })
    assert r.returncode == 0, r.stdout + r.stderr
    assert 'startup_failure em 201' in r.stdout
    assert 'próxima em andamento (202)' in r.stdout
    assert log.count('workflow run') == 2


def test_retry_on_dispatch_command_failure(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {
        'runs': [],
        'dispatch_fail': True,
        'fail_left': 2,
        'next': [{'id': 301, 'status': 'in_progress'}],
    })
    assert r.returncode == 0, r.stdout + r.stderr
    assert 'comando de disparo falhou' in r.stdout
    assert 'próxima em andamento (301)' in r.stdout
    assert log.count('workflow run') == 3


def test_skips_if_another_run_already_in_progress(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {
        'runs': [{'id': 150, 'status': 'in_progress'}],
        'next': [{'id': 201, 'status': 'in_progress'}],
    })
    assert r.returncode == 0
    assert 'já há execução 150 em andamento' in r.stdout
    assert 'workflow run' not in log


def test_does_not_loop_on_completed_success(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {
        'runs': [],
        'next': [{'id': 201, 'status': 'completed', 'conclusion': 'success'}],
    }, tries=4)
    assert r.returncode == 0
    assert 'concluiu (success)' in r.stdout
    assert log.count('workflow run') == 1


def test_gives_up_after_tries(tmp_path):
    bin_ = _write_gh(tmp_path)
    r, log, _ = _run(tmp_path, bin_, {'runs': [], 'next': []}, tries=3)
    assert r.returncode == 0
    assert 'não foi possível encadear após 3 tentativas' in r.stdout
    assert log.count('workflow run') == 3


def test_invalid_mode_exits():
    r = subprocess.run(['bash', str(CHAIN), 'nope'], capture_output=True, text=True)
    assert r.returncode == 1 and 'inválido' in r.stderr
