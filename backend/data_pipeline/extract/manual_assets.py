"""
Módulo para carregar listas manuais de ativos financeiros.

Este módulo lê arquivos YAML com listas curadas de ativos
que não são ações tradicionais (moedas, commodities, bonds, etc.).
"""

import yaml
from pathlib import Path
from typing import List
import logging

from ...config import MANUAL_ASSETS_DIR, MANUAL_ASSETS_FILE


def load_manual_assets_from_yaml(
    yaml_file: str = MANUAL_ASSETS_FILE,
) -> List[str]:
    """
    Carrega lista de tickers manuais a partir de arquivo YAML.
    
    Args:
        yaml_file: Nome do arquivo YAML (default: manual_assets.yaml)
        
    Returns:
        Lista de tickers para coleta de dados
        
    Raises:
        FileNotFoundError: Se arquivo não existir
        yaml.YAMLError: Se erro no parsing do YAML
    """
    logger = logging.getLogger("load_manual_assets")
    
    # Caminho do arquivo
    yaml_path = Path(MANUAL_ASSETS_DIR) / yaml_file
    
    if not yaml_path.exists():
        logger.error(f"Arquivo YAML não encontrado: {yaml_path}")
        raise FileNotFoundError(f"Arquivo {yaml_path} não existe")
    
    try:
        # Carregar YAML
        with open(yaml_path, 'r', encoding='utf-8') as file:
            assets_data = yaml.safe_load(file)
        
        logger.info(f"Arquivo YAML carregado: {yaml_path}")
        
        # Processar dados
        tickers = []
        
        # Categorias disponíveis
        available_categories = [
            'currencies', 'currencies_future', 'cryptocurrencies', 'cryptocurrencies_future',
            'commodities', 'bonds', 'bonds_future', 'international_indices', 
            'international_indices_future', 'brazilian_indices', 'etfs'
        ]
        
        # Processar cada categoria
        for category in available_categories:
            if category not in assets_data:
                logger.warning(f"Categoria '{category}' não encontrada no YAML")
                continue
            
            category_assets = assets_data[category]
            category_count = 0
            
            for asset in category_assets:
                ticker = asset.get('ticker')
                if ticker:
                    tickers.append(ticker)
                    category_count += 1
                else:
                    logger.warning(f"Asset sem ticker na categoria {category}: {asset}")
            
            logger.info(f"Categoria '{category}': {category_count} ativos selecionados")
        
        logger.info(f"Total de tickers carregados: {len(tickers)}")
        return tickers
        
    except yaml.YAMLError as e:
        logger.error(f"Erro ao fazer parsing do YAML: {e}")
        raise
    except Exception as e:
        logger.error(f"Erro inesperado ao carregar ativos manuais: {e}")
        raise


# Função principal para integração com pipeline
def get_manual_tickers_task() -> List[str]:
    """
    Função principal para usar no pipeline do Prefect.
    
    Returns:
        Lista de tickers manuais para coleta de dados
    """
    logger = logging.getLogger("get_manual_tickers_task")
    
    try:
        # Carregar todos os ativos com prioridade média ou alta
        tickers = load_manual_assets_from_yaml()
        
        if not tickers:
            logger.warning("Nenhum ticker manual encontrado")
            return []
        
        logger.info(f"Tickers manuais carregados:")
        logger.info(f"  - Total: {len(tickers)}")
        
        return tickers
        
    except Exception as e:
        logger.error(f"Erro ao carregar tickers manuais: {e}")
        return []
