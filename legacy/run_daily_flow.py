#!/usr/bin/env python3
"""
Runner mínimo para executar o flow diário (Prefect) diretamente.

Uso (PowerShell):
  uv run python .\run_daily_flow_new.py
ou
  python .\run_daily_flow_new.py
"""

from backend.data_pipeline.daily_flow import daily_flow


def main() -> None:
    print("🚀 Executando daily_flow()...")
    daily_flow()
    print("✅ daily_flow() finalizado.")


if __name__ == "__main__":
    main()


