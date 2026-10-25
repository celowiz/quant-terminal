import requests
from bs4 import BeautifulSoup, Tag
from typing import Optional

def get_tradingview_logo_from_ticker(exchange: str, ticker: str) -> Optional[str]:
    """
    Faz scraping no TradingView para encontrar o link da logo de um ativo.
    
    Args:
        exchange: Bolsa (ex: "BMFBOVESPA", "NASDAQ")
        ticker: Código do ativo (ex: "PETR4", "TSLA")
        
    Returns:
        URL da logo ou None se não encontrar
    """
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
            print(f"❌ Erro ao acessar {url} (status {resp.status_code})")
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

        print(f"Logo não encontrada para {ticker} na exchange {exchange}")
        return None
        
    except requests.exceptions.RequestException as e:
        print(f"Erro de rede ao buscar logo para {ticker}: {e}")
        return None
    except Exception as e:
        print(f"Erro inesperado ao buscar logo para {ticker}: {e}")
        return None



if __name__ == "__main__":
    # Exemplos de uso
    print("=== Testando captura individual ===")
    
    # Exemplo: PETR4 na B3
    logo_url = get_tradingview_logo_from_ticker("BMFBOVESPA", "PETR4")
    print(f"Logo PETR4: {logo_url}")
    
    # Outro exemplo: TSLA na Nasdaq
    logo_url = get_tradingview_logo_from_ticker("NASDAQ", "TSLA")
    print(f"Logo TSLA: {logo_url}")
