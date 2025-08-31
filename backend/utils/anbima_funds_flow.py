"""
Utilitário para processamento de dados de fluxo de fundos da ANBIMA.

Este módulo processa dados de captação líquida de fundos de investimento
obtidos da ANBIMA e os transforma em formato adequado para a API.
"""

import pandas as pd
import logging

logger = logging.getLogger(__name__)


def _get_anbima_file():
    """
    Obtém o arquivo de fluxo da ANBIMA.
    
    Import lazy para evitar carregar Selenium/BS4 no startup do servidor.
    
    Returns:
        Tuple[str, pd.DataFrame]: Data de referência e DataFrame com dados brutos
    """
    from ..data_pipeline.extract.anbima import get_anbima_file
    return get_anbima_file()


# Classes de fundos de interesse para análise
TARGET_CLASSES = [
    "Renda Fixa",
    "Ações", 
    "Multimercados",
    "Cambial",
    "Previdência",
    "ETF",
]


def build_funds_flow_dataframe() -> tuple[str, pd.DataFrame]:
    """
    Obtém o arquivo da ANBIMA e aplica transformações para tabela de fluxo por classe.

    Returns:
        tuple[str, pd.DataFrame]: Tupla contendo:
            - data_ref: Data de referência extraída do arquivo
            - df: DataFrame com índice "Classe" e colunas ["Dia", "Mês", "Ano", "12 Meses"]
    """
    logger.info("Iniciando construção do DataFrame de fluxo de fundos")
    
    data_ref, df_raw = _get_anbima_file()
    logger.info(f"Arquivo obtido - Data: {data_ref}, Shape: {df_raw.shape}")

    # Selecionar colunas relevantes por posição
    logger.info("Selecionando e renomeando colunas")
    df = df_raw.copy()

    # Filtra colunas por posição (baseado no layout padrão da ANBIMA)
    df = df[[
        df_raw.columns[0],   # Classe do fundo
        df_raw.columns[8],   # Captação do dia
        df_raw.columns[9],   # Captação do mês
        df_raw.columns[10],  # Captação do ano
        df_raw.columns[11],  # Captação 12 meses
    ]]

    # Renomear colunas para padrão interno
    df = df.rename(columns={
        df_raw.columns[0]: "Classe",
        df_raw.columns[8]: "Dia",
        df_raw.columns[9]: "Mês",
        df_raw.columns[10]: "Ano",
        df_raw.columns[11]: "12 Meses",
    })

    # Filtrar apenas classes de interesse
    df = df[df["Classe"].isin(TARGET_CLASSES)]
    logger.info(f"Classes filtradas: {len(df)} de {len(df_raw)}")

    # Converter valores para numérico
    logger.info("Convertendo valores para numérico")
    numeric_columns = ["Dia", "Mês", "Ano", "12 Meses"]
    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    df = df.round(2)

    # Remover duplicatas e configurar índice
    df = df.drop_duplicates(subset=["Classe"], keep="first").set_index(["Classe"])
    logger.info(f"DataFrame final construído - Shape: {df.shape}")

    return data_ref, df


def get_funds_flow_series() -> dict:
    """Retorna um dicionário serializável para API com as séries por classe.

    Estrutura:
    {
      "data_ref": str,
      "rows": [
        {"class_name": str, "day": float|None, "month": float|None, "year": float|None, "twelve_months": float|None},
        ...
      ]
    }
    """
    logging.getLogger("api").info("get_funds_flow_series: building dataframe")
    data_ref, df = build_funds_flow_dataframe()
    rows = []
    for classe, row in df.iterrows():
        day_val = row.get("Dia")
        month_val = row.get("Mês")
        year_val = row.get("Ano")
        twelve_months_val = row.get("12 Meses")
        
        rows.append({
            "class_name": str(classe),
            "day": None if day_val is None or pd.isna(day_val) else float(day_val),
            "month": None if month_val is None or pd.isna(month_val) else float(month_val),
            "year": None if year_val is None or pd.isna(year_val) else float(year_val),
            "twelve_months": None if twelve_months_val is None or pd.isna(twelve_months_val) else float(twelve_months_val),
        })
    logging.getLogger("api").info("get_funds_flow_series: built %d rows", len(rows))
    return {"data_ref": data_ref, "rows": rows}


