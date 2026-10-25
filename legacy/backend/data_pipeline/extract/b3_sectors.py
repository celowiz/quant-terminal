import pandas as pd
import requests
from io import BytesIO
import zipfile


def validar_url_b3(url: str) -> bool:
    """Valida se a URL do ZIP da B3 está acessível e é um arquivo ZIP."""
    try:
        response = requests.head(url, allow_redirects=True, timeout=10)
        content_type = response.headers.get('Content-Type', '').lower()
        status_ok = response.status_code == 200
        is_zip = 'zip' in content_type
        if status_ok and is_zip:
            print(f"✅ URL válida: {url}")
            return True
        else:
            print(f"⚠️ URL inválida ou não é um ZIP (status: {response.status_code}, tipo: {content_type})")
            return False
    except requests.RequestException as e:
        print(f"❌ Erro ao acessar a URL: {e}")
        return False
    
def get_b3_sectors() -> pd.DataFrame:
    """
    Baixa e processa a classificação setorial da B3.
    Retorna um DataFrame com colunas: Ticker, Setor, Subsetor, Segmento.
    """
    url_zip = "https://www.b3.com.br/data/files/57/E6/AA/A1/68C7781064456178AC094EA8/ClassifSetorial.zip"
    if not validar_url_b3(url_zip):
        raise Exception("URL do arquivo de setores da B3 inválida ou indisponível.")
    try:
        resp = requests.get(url_zip)
        resp.raise_for_status()
        with zipfile.ZipFile(BytesIO(resp.content)) as z:
            nome_excel = [f for f in z.namelist() if f.lower().endswith('.xlsx')][0]
            with z.open(nome_excel) as f:
                # Tenta por nome, senão índice 0
                try:
                    raw_df = pd.read_excel(f, sheet_name='Class_setorial', skiprows=1, engine='openpyxl')
                except Exception:
                    raw_df = pd.read_excel(f, sheet_name=0, skiprows=1, engine='openpyxl')
        df = raw_df.dropna(how='all', axis=1)
        df.columns = ['Setor', 'Subsetor', 'Segmento', 'Nome', 'Ticker', 'Segmento Negociação']
        df = df[1:]
        df = df.dropna(how='all')
        df['Setor'] = df['Setor'].ffill()
        df['Subsetor'] = df['Subsetor'].ffill()
        df['Ticker'] = df['Ticker'].str.strip().str.upper()

        # Remove linhas de cabeçalho/rodapé indesejadas
        df = df[~((df['Segmento'] == 'SEGMENTO') | (df['Ticker'] == 'CÓDIGO'))]
        df['Segmento'] = df['Segmento'].ffill()
        df.dropna(subset=['Ticker'], inplace=True)
        # Seleciona apenas as colunas relevantes
        df = df[['Ticker', 'Setor', 'Subsetor', 'Segmento']]
        df = df.reset_index(drop=True)
        return df
    except Exception as e:
        print(f"Erro ao processar setores da B3: {e}")
        return pd.DataFrame(columns=['Ticker', 'Setor', 'Subsetor', 'Segmento'])