import re
import requests
from datetime import datetime
from bs4 import BeautifulSoup

# Taxa Selic Atual (Bacen API)
def get_selic_atual():
    url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json"
    response = requests.get(url)
    data = response.json()
    selic_hoje = float(data[0]['valor'].replace(',', '.'))
    data_ref = data[0]['data']
    return selic_hoje, data_ref

# Datas com as próximas reuniões do COPOM
def get_datas_copom(url):
    response = requests.get(url)
    data = response.json()

    # O conteúdo formatado em HTML está no campo 'conteudoFormatado'
    html = data.get("conteudo")[0].get("Texto")
    soup = BeautifulSoup(html, "html.parser")
    texto = soup.get_text(separator="\n")

    html_ano = data.get("conteudo")[0].get("Assunto")
    soup_ano = BeautifulSoup(html_ano, "html.parser")
    ano = soup_ano.get_text(separator="\n").strip()[-5:-1]

    # Regex para capturar pares de datas como "27 e 28 de janeiro de 2025"
    padrao = r"(\d{1,2}) e (\d{1,2}) de ([a-zç]+)"
    matches = re.findall(padrao, texto, re.IGNORECASE)

    datas = []
    for _, dia2, mes in matches:
        try:
            mes_num = datetime.strptime(mes.strip(), "%B").month
        except ValueError:
            meses_pt = {
                "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
                "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
                "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
            }
            mes_num = meses_pt[mes.lower()]
        data = datetime(int(ano), mes_num, int(dia2)).date()
        datas.append(data)

    return datas