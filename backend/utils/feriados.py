"""
Utilitário para obtenção de feriados nacionais da ANBIMA.

Este módulo baixa e processa a lista oficial de feriados
nacionais fornecida pela ANBIMA para cálculos de dias úteis.
"""

import xlrd
from urllib.request import urlretrieve
from datetime import date
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


def get_brazilian_holidays(url: Optional[str] = None, path: Optional[str] = None) -> List[date]:
    """
    Obtém lista de feriados nacionais brasileiros da ANBIMA.
    
    Args:
        url: URL do arquivo Excel da ANBIMA (usa padrão se None)
        path: Caminho local para salvar/carregar arquivo (usa padrão se None)
    
    Returns:
        Lista de objetos date com os feriados nacionais
        
    Raises:
        Exception: Se houver erro no download ou processamento do arquivo
    """
    if not url:
        url = 'http://www.anbima.com.br/feriados/arqs/feriados_nacionais.xls'
    if not path:
        path = 'feriados_nacionais.xls'
    
    logger.info(f"Obtendo feriados da ANBIMA - URL: {url}")
    
    try:
        # Tentar abrir arquivo local primeiro
        wb = xlrd.open_workbook(path)
        logger.info(f"Arquivo local encontrado: {path}")
    except FileNotFoundError:
        # Download do arquivo se não existir localmente
        logger.info(f"Baixando arquivo de feriados de {url}")
        urlretrieve(url, filename=path)
        wb = xlrd.open_workbook(path)
        logger.info(f"Arquivo baixado e salvo em: {path}")
    
    # Processar planilha
    ws = wb.sheet_by_index(0)
    dates = []
    row = 1  # Começar da linha 1 (pular cabeçalho)
    
    logger.info("Processando datas de feriados...")
    
    while row < ws.nrows and ws.cell_type(row, 0) == 3:  # Tipo 3 = data
        try:
            date_tuple = xlrd.xldate_as_tuple(ws.cell_value(row, 0), wb.datemode)
            y, m, d, _, _, _ = date_tuple
            holiday_date = date(y, m, d)
            dates.append(holiday_date)
            row += 1
        except Exception as e:
            logger.warning(f"Erro ao processar linha {row}: {e}")
            row += 1
            continue
    
    logger.info(f"Total de feriados processados: {len(dates)}")
    
    if dates:
        logger.info(f"Período: {min(dates)} até {max(dates)}")
    
    return sorted(dates)


# Função com nome original para compatibilidade
def holidays(url: Optional[str] = None, path: Optional[str] = None) -> List[date]:
    """
    Alias para get_brazilian_holidays para manter compatibilidade.
    
    Args:
        url: URL do arquivo Excel da ANBIMA
        path: Caminho local para salvar/carregar arquivo
    
    Returns:
        Lista de objetos date com os feriados nacionais
    """
    return get_brazilian_holidays(url, path)