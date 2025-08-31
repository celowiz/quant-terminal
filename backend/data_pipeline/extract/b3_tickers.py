import requests
import json
import pandas as pd
from typing import List, Dict
import logging
import io


logger = logging.getLogger(__name__)


def get_tickers_from_b3() -> List[Dict]:
    """Obtém lista de tickers da B3 usando a API oficial"""
    page_url = (
        "https://arquivos.b3.com.br"
        "/api/channels/34dcaaeb-0306-4f45-a83e-4f66a23b42fa"
        "/subchannels/cc188e40-03be-408e-aa86-501926b97a76"
        "/publications?&lang=pt"
    )
    try:
        logger.info("Iniciando coleta de tickers da B3 via API...")
        page_request = requests.get(page_url)
        page_response = json.loads(page_request.content)
        if not len(page_response):
            raise Exception("Nenhum arquivo encontrado na API da B3")
        latest_file = page_response[0]
        file_name = latest_file["fileName"].split("File")[0]
        dt = latest_file["dateTime"].split("T")[0]
        logger.info(f"Arquivo selecionado: {file_name} (Data: {dt})")
        token_url = (
            f"https://arquivos.b3.com.br/api/download/requestname"
            f"?fileName={file_name}&date={dt}&recaptchaToken="
        )
        logger.info("Obtendo token de download...")
        token_request = requests.get(token_url)
        token_response = json.loads(token_request.content)
        token = token_response["redirectUrl"].split("?token=")[1]
        file_url = f"https://arquivos.b3.com.br/api/download/?token={token}"
        logger.info("Baixando arquivo CSV...")
        file_request = requests.get(file_url)
        file_response = file_request.content
        logger.info("Processando dados do CSV...")
        df = pd.read_csv(io.BytesIO(file_response), sep=";", encoding="latin1", skiprows=1)
        if 'TckrSymb' not in df.columns:
            logger.error("Coluna TckrSymb não encontrada no arquivo")
            logger.info(f"Colunas disponíveis: {list(df.columns)}")
            raise Exception("Coluna TckrSymb não encontrada no arquivo")
        tickers = []
        cash_df = df[df['SgmtNm'] == 'CASH']
        for ticker in cash_df['TckrSymb'].dropna().unique():
            row = cash_df[cash_df['TckrSymb'] == ticker].iloc[0]
            ticker_info = {
                'ticker': ticker.strip(),
                'segmento': row['SgmtNm'],
                'categoria': row['SctyCtgyNm'],
                'nome': row['CrpnNm'],
                'date': dt.replace('-', '_'),
                'source': 'B3'
            }
            tickers.append(ticker_info)
        logger.info(f"Encontrados {len(tickers)} tickers únicos")
        return tickers
    except Exception as e:
        logger.error(f"Erro ao coletar tickers da B3: {e}")
        raise


