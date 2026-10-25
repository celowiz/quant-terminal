from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import requests
from bs4 import BeautifulSoup, Tag
from typing import Optional
import logging

from ...config import DB_PATH_YAHOO_ASSETS
from ...utils.transform import clean_ticker_for_database_key

router = APIRouter()

# Mapeamento das exchanges do Yahoo Finance para TradingView
EXCHANGE_MAPPING = {
    "SAO": "BMFBOVESPA",    # Bolsa brasileira
    "NMS": "NASDAQ",        # NASDAQ
    "NYQ": "NYSE",          # New York Stock Exchange
    "CCY": "ICE",           # Currencies via ICE
    "NYB": "ICE",           # ICE Futures
    # Adicionar mais mapeamentos conforme necessário
}


class LogoResponse(BaseModel):
    ticker: str
    logo_url: Optional[str] = None
    exchange: Optional[str] = None


def get_tradingview_logo_from_ticker(exchange: str, ticker: str) -> Optional[str]:
    """
    Faz scraping no TradingView para encontrar o link da logo de um ativo.
    
    Args:
        exchange: Bolsa (ex: "BMFBOVESPA", "NASDAQ")
        ticker: Código do ativo (ex: "PETR4", "TSLA")
        
    Returns:
        URL da logo ou None se não encontrar
    """
    # Remove o sufixo .SA dos tickers brasileiros para o TradingView
    if exchange == "BMFBOVESPA" and ticker.endswith(".SA"):
        ticker = ticker[:-3]
    
    url = f"https://br.tradingview.com/symbols/{exchange}-{ticker}/ideas/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/127.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            logging.getLogger("api").warning(f"Erro ao acessar {url} (status {resp.status_code})")
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Múltiplas estratégias para encontrar a logo
        logo_selectors = [
            {"tag": "img", "attrs": {"class": "tv-circle-logo__img"}},
            {"tag": "img", "attrs": {"class": "tv-symbol-header__logo"}},
            {"tag": "img", "attrs": {"data-role": "symbol-logo"}},
            {"tag": "img", "attrs": {"alt": ticker}},
        ]
        
        for selector in logo_selectors:
            img = soup.find(selector["tag"], selector["attrs"])
            if isinstance(img, Tag) and img.has_attr("src"):
                src = img.get("src")
                if src and "s3-symbol-logo.tradingview.com" in str(src):
                    return str(src)
                    
        # Tentar buscar por padrão de URL diretamente
        for img in soup.find_all("img"):
            if isinstance(img, Tag) and img.has_attr("src"):
                src = img.get("src")
                if src and "s3-symbol-logo.tradingview.com" in str(src):
                    return str(src)

        logging.getLogger("api").info(f"Logo não encontrada para {ticker} na exchange {exchange}")
        return None
        
    except requests.exceptions.RequestException as e:
        logging.getLogger("api").error(f"Erro de rede ao buscar logo para {ticker}: {e}")
        return None
    except Exception as e:
        logging.getLogger("api").error(f"Erro inesperado ao buscar logo para {ticker}: {e}")
        return None


def _get_asset_exchange(ticker: str) -> Optional[str]:
    """
    Busca a exchange do ticker no arquivo yahoo_assets.json.
    
    Args:
        ticker: Ticker do ativo
        
    Returns:
        Exchange do ativo ou None se não encontrar
    """
    try:
        with open(DB_PATH_YAHOO_ASSETS, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assets = data.get("assets", {})
        
        # 1. Buscar usando a chave transformada (padrão principal)
        ticker_key = clean_ticker_for_database_key(ticker)
        if ticker_key in assets:
            asset_data = assets[ticker_key]
            return asset_data.get("exchange")
        
        # 2. Buscar por ticker original como chave
        if ticker.upper() in assets:
            asset_data = assets[ticker.upper()]
            return asset_data.get("exchange")
        
        # 3. Buscar pelo campo "ticker" dentro dos assets
        for key, asset_data in assets.items():
            if asset_data.get("ticker", "").upper() == ticker.upper():
                return asset_data.get("exchange")
        
        return None
        
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logging.getLogger("api").error(f"Erro ao ler arquivo de assets: {e}")
        return None


@router.get("/{ticker}", response_model=LogoResponse)
def get_logo(ticker: str) -> LogoResponse:
    """
    Obtém a URL da logo de um ativo do TradingView.
    
    Args:
        ticker: Ticker do ativo (ex: PETR4.SA, ITUB4, TSLA)
        
    Returns:
        LogoResponse com ticker, logo_url e exchange
    """
    ticker_upper = ticker.upper()
    
    try:
        # Buscar a exchange do ticker
        yahoo_exchange = _get_asset_exchange(ticker_upper)
        
        if not yahoo_exchange:
            return LogoResponse(
                ticker=ticker_upper, 
                logo_url=None, 
                exchange=None
            )
        
        # Mapear para a exchange do TradingView
        tradingview_exchange = EXCHANGE_MAPPING.get(yahoo_exchange, yahoo_exchange)
        
        # Buscar a logo no TradingView
        logo_url = get_tradingview_logo_from_ticker(tradingview_exchange, ticker_upper)
        
        return LogoResponse(
            ticker=ticker_upper,
            logo_url=logo_url,
            exchange=tradingview_exchange
        )
        
    except Exception as e:
        logging.getLogger("api").error(f"Erro ao buscar logo para {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar logo: {e}")
