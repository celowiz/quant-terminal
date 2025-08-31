from urllib.parse import urljoin
import pandas as pd
import logging


def get_anbima_file(timeout_ms: int = 60000) -> tuple[str, pd.DataFrame]:

    PAGE = "https://www.anbima.com.br/pt_br/informar/estatisticas/fundos-de-investimento/fi-consolidado-diario.htm"

    # Abre Chromium headless, navega e espera o link .xls/.xlsx aparecer
    logging.getLogger("api").info("Anbima (Playwright): launch browser")
    # Import Playwright somente aqui para evitar quebrar o startup se não estiver instalado
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page(user_agent="Mozilla/5.0")
            logging.getLogger("api").info("Anbima (Playwright): goto %s", PAGE)
            page.goto(PAGE, wait_until="domcontentloaded", timeout=timeout_ms)
            logging.getLogger("api").info("Anbima (Playwright): wait_for_selector for xls/xlsx link")
            page.wait_for_selector("#informacoes-tecnicas a[href$='.xls'], #informacoes-tecnicas a[href$='.xlsx']",
                                   timeout=timeout_ms)
            el = page.query_selector("#informacoes-tecnicas a[href$='.xls'], #informacoes-tecnicas a[href$='.xlsx']")
            if el is None:
                raise RuntimeError("Element not found after wait_for_selector")
            href = el.get_attribute("href")
            if href is None:
                raise RuntimeError("href attribute not found in element")
            file_url = urljoin(PAGE, href)
            logging.getLogger("api").info("Anbima (Playwright): file url %s", file_url)

            # Selecionar engine conforme extensão e ler o Excel
            engine = "openpyxl" if file_url.lower().endswith(".xlsx") else "xlrd"
            logging.getLogger("api").info("Anbima (Playwright): reading excel with engine=%s", engine)
            df = pd.read_excel(file_url, engine=engine)

            data_ref = df[df.columns[0]].iloc[2].split(' ')[-1]
            logging.getLogger("api").info("Anbima (Playwright): data_ref=%s shape=%s", data_ref, str(df.shape))
            return data_ref, df
        finally:
            try:
                browser.close()
            except Exception:
                logging.getLogger("api").exception("Anbima (Playwright): error closing browser")

    

