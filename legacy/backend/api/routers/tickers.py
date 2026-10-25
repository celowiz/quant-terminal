from fastapi import APIRouter, HTTPException
from typing import List
import json

from ...config import DB_PATH_YAHOO_ASSETS


router = APIRouter()


@router.get("/", response_model=List[str])
def list_tickers() -> List[str]:
    """
    Retorna a lista de tickers disponíveis no banco NoSQL yahoo_assets.json.
    
    Retorna os tickers originais (não transformados) para exibição no frontend.
    Ex: ^BVSP, BRL=X, PETR4.SA, etc.
    """
    try:
        # Ler diretamente do arquivo JSON para melhor performance
        with open(DB_PATH_YAHOO_ASSETS, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assets = data.get("assets", {})
        
        # Extrair tickers originais dos assets ativos
        tickers = []
        for key, asset_data in assets.items():
            if asset_data.get("active", True):  # Apenas assets ativos
                original_ticker = asset_data.get("ticker", "")
                if original_ticker:
                    tickers.append(original_ticker.upper())
        
        # Remover duplicatas e ordenar
        unique_tickers = sorted(list(set(tickers)))
        
        return unique_tickers
        
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler banco NoSQL: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar tickers: {e}")


