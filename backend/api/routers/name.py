from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from typing import Optional

from ...config import DB_PATH_YAHOO_ASSETS
from ...data_pipeline.load.yahoo_assets_dao import YahooAssetsDAO
from ...utils.transform import clean_ticker_for_database_key


router = APIRouter()


class NameResponse(BaseModel):
    ticker: str
    name: str | None = None


@router.get("/{ticker}", response_model=NameResponse)
def get_name(ticker: str) -> NameResponse:
    """
    Obtém o nome do ativo a partir do banco NoSQL yahoo_assets.json.
    
    Args:
        ticker: Ticker do ativo (ex: PETR4.SA, ITUB4, ^BVSP)
        
    Returns:
        NameResponse com ticker e nome do ativo
    """
    ticker_upper = ticker.upper()
    
    try:
        # Usar YahooAssetsDAO para buscar o ativo (apenas para tickers simples)
        if not any(char in ticker_upper for char in ['^', '=', '-', '.']):
            dao = YahooAssetsDAO()
            asset = dao.get_asset_by_ticker(ticker_upper)
            dao.close()
            
            if asset and asset.name:
                return NameResponse(ticker=ticker_upper, name=asset.name)
        
        # Para tickers com caracteres especiais ou se não encontrou no DAO,
        # buscar diretamente no JSON
        return _search_name_in_json(ticker_upper)
        
    except Exception as e:
        # Em caso de erro, tentar busca alternativa no JSON
        try:
            return _search_name_in_json(ticker_upper)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Erro ao consultar nome: {e}")


def _search_name_in_json(ticker: str) -> NameResponse:
    """
    Busca alternativa diretamente no arquivo JSON seguindo o padrão de transformação.
    
    O arquivo yahoo_assets.json usa chaves transformadas:
    - ^ vira IDX_ (ex: ^BVSP → IDX_BVSP)
    - . e = viram _ (ex: BRL=X → BRL_X, PETR4.SA → PETR4)
    
    Args:
        ticker: Ticker original para buscar
        
    Returns:
        NameResponse com resultado da busca
    """
    try:
        with open(DB_PATH_YAHOO_ASSETS, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assets = data.get("assets", {})
        
        # 1. Buscar usando a chave transformada (padrão principal)
        ticker_key = clean_ticker_for_database_key(ticker)
        if ticker_key in assets:
            asset_data = assets[ticker_key]
            return NameResponse(ticker=ticker, name=asset_data.get("name"))
        
        # 2. Buscar por ticker original como chave (caso não tenha sido transformado)
        if ticker.upper() in assets:
            asset_data = assets[ticker.upper()]
            return NameResponse(ticker=ticker, name=asset_data.get("name"))
        
        # 3. Buscar pelo campo "ticker" dentro dos assets (mantém ticker original)
        for key, asset_data in assets.items():
            if asset_data.get("ticker", "").upper() == ticker.upper():
                return NameResponse(ticker=ticker, name=asset_data.get("name"))
        
        # 4. Se não encontrar nada, retornar None para o nome
        return NameResponse(ticker=ticker, name=None)
        
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return NameResponse(ticker=ticker, name=None)


 