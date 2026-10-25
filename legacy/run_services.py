#!/usr/bin/env python3
"""
Script para iniciar os serviços locais:
- API FastAPI na porta 8000
- Frontend React (Next.js) na porta 3000
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def run_api() -> Optional[subprocess.Popen]:
    """Inicia a API FastAPI com recarregamento automático.

    Tenta usar `uv run uvicorn ...` quando disponível (fluxo padrão do projeto).
    Como fallback, usa `python -m uvicorn ...`.
    """
    print("🚀 Iniciando API FastAPI...")
    target = "backend.api.main:app"

    try:
        import shutil

        uv_path = shutil.which("uv")

        if uv_path:
            cmd = [
                uv_path,
                "run",
                "uvicorn",
                target,
                "--port",
                "8000",
                "--reload",
                "--log-level",
                "debug",
            ]
        else:
            cmd = [
                sys.executable,
                "-m",
                "uvicorn",
                target,
                "--port",
                "8000",
                "--reload",
                "--log-level",
                "debug",
            ]

        print("Comando API:", " ".join(cmd))
        process = subprocess.Popen(cmd, cwd=PROJECT_ROOT)

        print("✅ API FastAPI em http://127.0.0.1:8000 (docs: http://127.0.0.1:8000/docs)")
        return process

    except Exception as exc:  # noqa: BLE001
        print(f"❌ Erro ao iniciar API: {exc}")
        return None


def run_frontend() -> Optional[subprocess.Popen]:
    """Inicia o frontend React (Next.js) na porta padrão 3000."""
    print("🚀 Iniciando Frontend React (Next.js)...")
    print(f"Diretório atual: {os.getcwd()}")
    print(f"Diretório do frontend: {FRONTEND_DIR}")

    if not FRONTEND_DIR.exists():
        print(f"❌ Pasta 'frontend/' não encontrada em {PROJECT_ROOT}")
        return None

    try:
        import shutil

        npm_path = shutil.which("npm")
        if not npm_path:
            print("❌ npm não encontrado no PATH. Instale Node.js e npm.")
            return None

        process = subprocess.Popen([npm_path, "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], cwd=FRONTEND_DIR)
        print("✅ Frontend React em http://127.0.0.1:3000")
        return process

    except Exception as exc:  # noqa: BLE001
        print(f"❌ Erro ao iniciar frontend: {exc}")
        return None


def main() -> None:
    print("🎯 Iniciando serviços...")
    print("=" * 60)

    api_process = run_api()
    if not api_process:
        print("❌ Falha ao iniciar API")
        return

    # Pequeno atraso para a API começar
    time.sleep(2)

    fe_process = run_frontend()
    if not fe_process:
        print("❌ Falha ao iniciar frontend")
        try:
            api_process.terminate()
        except Exception:  # noqa: BLE001
            pass
        return

    print("=" * 60)
    print("🎉 Serviços iniciados!")
    print("📊 API:        http://127.0.0.1:8000")
    print("🖥️  Frontend:   http://127.0.0.1:3000")
    print("📖 API Docs:   http://127.0.0.1:8000/docs")
    print("=" * 60)
    print("Pressione Ctrl+C para parar...")

    try:
        # Mantém os processos vivos; o primeiro a sair encerra o script
        while True:
            ret_api = api_process.poll()
            ret_fe = fe_process.poll()
            if ret_api is not None or ret_fe is not None:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Parando serviços...")
    finally:
        for proc in (fe_process, api_process):
            try:
                if proc and proc.poll() is None:
                    proc.terminate()
            except Exception:  # noqa: BLE001
                pass
        print("✅ Serviços parados")


if __name__ == "__main__":
    main()
