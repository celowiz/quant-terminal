from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
import json

from ...config import STATUS_PATH, DAG_PATH, LOG_DIR


router = APIRouter()

STATUS_PATH = STATUS_PATH
DAG_PATH = DAG_PATH


class RunResponse(BaseModel):
    message: str


@router.post("/daily/run", response_model=RunResponse)
def run_daily_flow():
    try:
        # Import lazy para não carregar Prefect no startup
        from ...data_pipeline.daily_flow import daily_flow
        daily_flow()  # synchronous run
        return {"message": "Daily flow executed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily/status")
def daily_status() -> Dict[str, Any]:
    try:
        with open(STATUS_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"status": "unknown"}


@router.get("/daily/dag")
def daily_dag() -> Dict[str, Any]:
    try:
        with open(DAG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        pass
    # Fallback static DAG description
    return {
        "nodes": [
            {"id": "update_tickers", "label": "Atualizar Tickers"},
            {"id": "update_sectors", "label": "Atualizar Setores"},
            {"id": "select_tickers", "label": "Selecionar Tickers"},
            {"id": "extract_save", "label": "Extrair e Salvar"},
        ],
        "edges": [
            ["update_tickers", "update_sectors"],
            ["update_sectors", "select_tickers"],
            ["select_tickers", "extract_save"],
        ],
    }


@router.get("/daily/log")
def daily_log() -> Dict[str, Any]:
    """Retorna o conteúdo do log do dia atual (arquivo rotativo)."""
    import glob
    import os
    from datetime import datetime

    # O TimedRotatingFileHandler cria arquivos como 'daily', 'daily.2025-08-12', etc.
    # Vamos tentar pegar o arquivo do dia atual primeiro; se não existir, pega o base.
    today = datetime.now().strftime("%Y-%m-%d")
    pattern = os.path.join(LOG_DIR, f"daily.{today}")
    candidates = glob.glob(pattern)
    if not candidates:
        base = os.path.join(LOG_DIR, "daily")
        if os.path.exists(base):
            candidates = [base]
    if not candidates:
        return {"log": ""}
    try:
        with open(candidates[0], 'r', encoding='utf-8') as f:
            return {"log": f.read()}
    except Exception as e:
        return {"error": str(e)}


