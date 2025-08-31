from typing import List, Dict
import pandas as pd
import requests
from io import StringIO
import time
import logging


def get_tickers_from_wikipedia() -> List[Dict]:
    """Coleta tickers do S&P 500 via Wikipedia e retorna lista de dicionários.

    Campos retornados (alinhados ao formato B3):
    - ticker
    - nome (Security)
    - categoria (set como 'SHARES')
    - segmento (set como 'CASH')
    - source ('WIKI')
    """
    logger = logging.getLogger(__name__)
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    
    # Headers para evitar erro 403 - simular navegador real
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        # Primeira tentativa: usar requests com headers apropriados
        logger.info("Tentando acessar Wikipedia com headers customizados...")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Usar pandas para fazer parse das tabelas HTML
        html_tables = pd.read_html(StringIO(response.text), header=0)
        df = html_tables[0]
        
    except Exception as e:
        logger.warning(f"Primeira tentativa falhou: {e}")
        
        # Segunda tentativa: usar pandas diretamente com headers
        try:
            logger.info("Tentando pandas read_html com headers...")
            html_tables = pd.read_html(
                url, 
                header=0,
                attrs={'id': 'constituents'},  # Procurar especificamente pela tabela dos constituintes
                encoding='utf-8'
            )
            df = html_tables[0]
            
        except Exception as e2:
            logger.warning(f"Segunda tentativa falhou: {e2}")
            
            # Terceira tentativa: sem headers específicos mas com retry
            try:
                logger.info("Tentativa final com delay...")
                time.sleep(2)  # Pequeno delay para evitar rate limiting
                html_tables = pd.read_html(url, header=0)
                df = html_tables[0]
                
            except Exception as e3:
                logger.error(f"Todas as tentativas falharam. Última tentativa: {e3}")
                return []
    
    # Verificar se as colunas esperadas existem
    expected_cols = {"Symbol", "Security", "GICS Sector", "GICS Sub-Industry"}
    available_cols = set(df.columns)
    
    # Se não tiver as colunas esperadas, tentar algumas variações
    if not expected_cols.issubset(available_cols):
        logger.warning(f"Colunas esperadas não encontradas. Disponíveis: {list(available_cols)}")
        
        # Mapeamento alternativo de colunas
        col_mapping = {}
        for col in df.columns:
            col_lower = col.lower()
            if 'symbol' in col_lower:
                col_mapping['ticker'] = col
            elif 'security' in col_lower or 'company' in col_lower or 'name' in col_lower:
                col_mapping['nome'] = col
            elif 'sector' in col_lower and 'sub' not in col_lower:
                col_mapping['setor'] = col
            elif 'sub' in col_lower and 'industry' in col_lower:
                col_mapping['subsetor'] = col
        
        # Se não conseguiu mapear pelo menos ticker e nome, retorna vazio
        if 'ticker' not in col_mapping or 'nome' not in col_mapping:
            logger.error("Não foi possível identificar colunas de ticker e nome")
            return []
        
        # Usar mapeamento alternativo
        cols_to_use = [col_mapping['ticker'], col_mapping['nome']]
        rename_dict = {
            col_mapping['ticker']: 'ticker',
            col_mapping['nome']: 'nome'
        }
        
        if 'setor' in col_mapping:
            cols_to_use.append(col_mapping['setor'])
            rename_dict[col_mapping['setor']] = 'setor'
        
        if 'subsetor' in col_mapping:
            cols_to_use.append(col_mapping['subsetor'])
            rename_dict[col_mapping['subsetor']] = 'subsetor'
        
        df = df[cols_to_use].rename(columns=rename_dict)
        
    else:
        # Usar colunas padrão
        df = df[["Symbol", "Security", "GICS Sector", "GICS Sub-Industry"]].rename(
            columns={
                "Symbol": "ticker",
                "Security": "nome",
                "GICS Sector": "setor",
                "GICS Sub-Industry": "subsetor",
            }
        )
    
    # Adicionar colunas padrão
    df["categoria"] = "SHARES"
    df["segmento"] = "CASH"
    df["source"] = "WIKI"
    
    # Limpar dados e filtrar linhas válidas
    df = df.dropna(subset=['ticker', 'nome'])
    df['ticker'] = df['ticker'].astype(str).str.strip()
    df['nome'] = df['nome'].astype(str).str.strip()
    
    # Filtrar tickers válidos (remover entradas vazias ou inválidas)
    df = df[df['ticker'].str.len() > 0]
    df = df[df['nome'].str.len() > 0]
    
    records: List[Dict] = df.to_dict(orient="records")
    logger.info(f"Coletados {len(records)} tickers do S&P 500")
    
    return records

