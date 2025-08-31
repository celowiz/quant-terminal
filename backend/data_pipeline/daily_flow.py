"""
Pipeline diário simplificado - sem Asset Factory para maior velocidade.

Este flow atualiza:
1. Tickers B3 e S&P500 
2. Setores B3
3. Lista manual de ativos
4. Dados do Yahoo Finance diretamente (sem inferência de tipo)
5. Salva dados JSON do Yahoo Finance em banco NoSQL (TinyDB)
6. Dados históricos opcionais

Mudanças para performance:
- Removido Asset Factory (inferência complexa de tipos)
- Banco NoSQL simples (TinyDB) ao invés de SQLite
- Dados do Yahoo Finance salvos diretamente como JSON
- Menos criação de objetos, maior velocidade
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import time
import random
from functools import wraps

from prefect import flow, task

from ..config import (
    DB_PATH_YAHOO_ASSETS, DB_PATH_DAILY_PRICES, DB_PATH_CORPORATE_ACTIONS,
    DB_PATH_CADASTRO, LOG_DIR, STATUS_PATH, DAG_PATH,
    YAHOO_TIMEOUT, YAHOO_RETRIES
)
from ..utils.logging_utils import setup_daily_rotating_logger

# Importações da nova arquitetura
from ..data_providers.yahoo_provider import YahooFinanceProvider
from .extract.yahoo_finance import YahooFinanceExtractor
from .load.yahoo_assets_dao import YahooAssetsDAO

# Imports para TinyDB (usado no debug flush)
from tinydb import TinyDB
from tinydb.storages import JSONStorage
from tinydb.middlewares import CachingMiddleware


# Rate limiter global para Yahoo Finance
_yahoo_rate_limiter = threading.Lock()
_last_request_time = 0

# Cache simples para evitar requisições repetidas
_asset_cache = {}
_data_cache = {}
_cache_lock = threading.Lock()


def yahoo_rate_limit(min_delay: float = 0.5, max_delay: float = 2.0):
    """
    Decorator para limitar rate de requests ao Yahoo Finance.
    
    Args:
        min_delay: Delay mínimo entre requests (segundos)
        max_delay: Delay máximo entre requests (segundos)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _last_request_time
            
            with _yahoo_rate_limiter:
                # Calcular tempo desde última request
                current_time = time.time()
                time_since_last = current_time - _last_request_time
                
                # Delay com jitter para evitar sincronização entre threads
                jitter_delay = random.uniform(min_delay, max_delay)
                
                if time_since_last < jitter_delay:
                    sleep_time = jitter_delay - time_since_last
                    time.sleep(sleep_time)
                
                _last_request_time = time.time()
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 60.0):
    """
    Decorator para retry com backoff exponencial.
    
    Args:
        max_retries: Número máximo de tentativas
        base_delay: Delay base (segundos)
        max_delay: Delay máximo (segundos)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    error_msg = str(e).lower()
                    
                    # Se é erro de rate limit, tenta novamente
                    if "rate limit" in error_msg or "too many requests" in error_msg:
                        if attempt < max_retries:
                            # Backoff exponencial com jitter
                            delay = min(base_delay * (2 ** attempt), max_delay)
                            jitter = random.uniform(0.1, 0.5) * delay
                            total_delay = delay + jitter
                            
                            logger = _get_consolidated_logger("rate_limiter")
                            logger.warning(f"⚠️  RATE LIMIT RETRY - Tentativa {attempt + 1}/{max_retries + 1}. Aguardando {total_delay:.1f}s...")
                            time.sleep(total_delay)
                            continue
                    
                    # Para outros erros ou se esgotou tentativas, re-raise
                    raise e
            
            return None
        return wrapper
    return decorator


def get_cached_asset(ticker: str) -> Optional[Dict[str, Any]]:
    """Verifica se o ativo está em cache."""
    with _cache_lock:
        return _asset_cache.get(ticker)


def cache_asset(ticker: str, result: Dict[str, Any]) -> None:
    """Armazena resultado de ativo em cache."""
    with _cache_lock:
        _asset_cache[ticker] = result


def get_cached_data(ticker: str, start_date: datetime, end_date: datetime) -> Optional[Dict[str, Any]]:
    """Verifica se os dados históricos estão em cache."""
    cache_key = f"{ticker}_{start_date.date()}_{end_date.date()}"
    with _cache_lock:
        return _data_cache.get(cache_key)


def cache_data(ticker: str, start_date: datetime, end_date: datetime, result: Dict[str, Any]) -> None:
    """Armazena dados históricos em cache."""
    cache_key = f"{ticker}_{start_date.date()}_{end_date.date()}"
    with _cache_lock:
        _data_cache[cache_key] = result


def _setup_file_logger() -> logging.Logger:
    """Setup do logger consolidado com rotação diária."""
    return setup_daily_rotating_logger("daily_pipeline", LOG_DIR)


def _get_consolidated_logger(logger_name: str) -> logging.Logger:
    """
    Obtém um logger filho do logger principal consolidado.
    Todos os logs vão para o mesmo arquivo diário.
    """
    main_logger = setup_daily_rotating_logger("daily_pipeline", LOG_DIR)
    return logging.getLogger(f"daily_pipeline.{logger_name}")


@task(name="Atualizar tickers B3")
def update_tickers_task() -> int:
    """Atualiza lista de tickers da B3."""
    from .extract.b3_tickers import get_tickers_from_b3
    from .load.universe import save_tickers_to_sqlite

    logger = _get_consolidated_logger("update_tickers_task")
    try:
        b3 = get_tickers_from_b3()
    except Exception as e:
        logger.warning(f"Falha B3: {e}")
        b3 = []
    
    if b3:
        save_tickers_to_sqlite(b3, DB_PATH_CADASTRO)
        logger.info(f"Atualizados {len(b3)} tickers da B3 no cadastro.")
        return len(b3)
    else:
        logger.warning("Nenhum ticker coletado da B3.")
        return 0


@task(name="Atualizar tickers S&P500")
def update_sp500_tickers_task() -> int:
    """Atualiza lista de tickers do S&P500."""
    from .extract.wikipedia_tickers import get_tickers_from_wikipedia
    from .load.universe import save_tickers_to_sqlite

    logger = _get_consolidated_logger("update_sp500_tickers_task")
    try:
        wiki = get_tickers_from_wikipedia()
    except Exception as e:
        logger.warning(f"Falha Wikipedia: {e}")
        wiki = []
    
    if wiki:
        save_tickers_to_sqlite(wiki, DB_PATH_CADASTRO)
        logger.info(f"Atualizados {len(wiki)} tickers do S&P500 no cadastro.")
        return len(wiki)
    else:
        logger.warning("Nenhum ticker coletado do S&P500.")
        return 0


@task(name="Atualizar setores B3")
def update_sectors_task() -> int:
    """Atualiza classificação setorial dos ativos B3."""
    from .extract.update_ticker_sectors import update_ticker_sectors
    
    logger = _get_consolidated_logger("update_sectors_task")
    try:
        update_ticker_sectors()
        logger.info("Setores B3 atualizados com sucesso.")
        return 1
    except Exception as e:
        logger.error(f"Erro ao atualizar setores: {e}")
        return 0


@task(name="Obter tickers Yahoo Finance")
def get_yahoo_tickers_task() -> List[str]:
    """Obtém lista de tickers do banco de cadastro para Yahoo Finance."""
    import sqlite3
    import re

    logger = _get_consolidated_logger("get_yahoo_tickers_task")
    
    with sqlite3.connect(DB_PATH_CADASTRO) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ticker, fonte
            FROM tickers
            WHERE (tipo_ativo = 'SHARES' OR tipo_ativo = 'UNITS')
              AND fonte IN ('B3')
              AND ticker LIKE 'PETR%' OR ticker LIKE 'VALE%' OR ticker LIKE 'ITUB%' OR ticker LIKE 'B3SA%'
              AND setor IS NOT NULL AND TRIM(COALESCE(setor,'')) <> ''
              AND subsetor IS NOT NULL AND TRIM(COALESCE(subsetor,'')) <> ''
            """
        ) # voltar com ,'WIKI' para filtro
        rows = cur.fetchall()
        tickers = []
        b3_filtered_count = 0
        b3_total_count = 0
        
        for tck, fonte in rows:
            if (fonte or '').upper() == 'B3':
                b3_total_count += 1
                # Validação: ticker B3 deve terminar com número
                if re.search(r'\d$', tck.upper()):
                    tickers.append(tck.upper() + '.SA')
                    b3_filtered_count += 1
                else:
                    logger.debug(f"🔍 FILTRO B3 - Ticker {tck} excluído (não termina com número)")
            else:
                tickers.append(tck.upper())
    
    # Log detalhado dos filtros aplicados
    wiki_count = len([t for t in tickers if not t.endswith('.SA')])
    
    if not tickers:
        logger.warning("❌ NENHUM TICKER - Nenhum ticker encontrado para consulta no Yahoo Finance.")
        print("❌ AVISO: Nenhum ticker selecionado para Yahoo Finance")
    else:
        logger.info(f"📊 TICKERS SELECIONADOS - Total: {len(tickers)} tickers para Yahoo Finance")
        logger.info(f"📊 BREAKDOWN TICKERS:")
        logger.info(f"  - B3 (filtrados): {b3_filtered_count} de {b3_total_count} disponíveis")
        logger.info(f"  - S&P500/Wiki: {wiki_count}")
        
        print(f"📊 TICKERS YAHOO FINANCE: {len(tickers)} selecionados")
        print(f"📊 B3: {b3_filtered_count}/{b3_total_count} (somente terminados em número)")
        print(f"📊 S&P500: {wiki_count}")
    
    return tickers


@task(name="Obter tickers manuais")
def get_manual_tickers_task() -> List[str]:
    """Obtém lista de tickers manuais (moedas, commodities, etc.)."""
    from .extract.manual_assets import get_manual_tickers_task
    
    logger = _get_consolidated_logger("get_manual_tickers_task")
    
    try:
        manual_tickers = get_manual_tickers_task()
        
        # Log detalhado e print para mostrar número de ativos
        total_assets = len(manual_tickers)
        logger.info(f"📋 LISTA MANUAL - {total_assets} ativos carregados do arquivo manual_assets.yaml")
        print(f"📋 ATIVOS MANUAIS: {total_assets} tickers carregados com sucesso")
        
        # Log dos primeiros 5 tickers como exemplo
        if manual_tickers:
            example_tickers = manual_tickers[:5]
            logger.info(f"📋 EXEMPLOS MANUAIS - Primeiros tickers: {', '.join(example_tickers)}")
            print(f"📋 EXEMPLOS: {', '.join(example_tickers)}{'...' if len(manual_tickers) > 5 else ''}")
        
        return manual_tickers
    except Exception as e:
        logger.error(f"❌ ERRO LISTA MANUAL - Falha ao carregar tickers manuais: {e}")
        print(f"❌ ERRO: Falha ao carregar lista manual de ativos - {e}")
        return []


@task(name="Consolidar lista de tickers")
def consolidate_tickers_task(
    yahoo_tickers: List[str], 
    manual_tickers: List[str]
) -> List[str]:
    """Consolida todas as listas de tickers."""
    logger = _get_consolidated_logger("consolidate_tickers_task")
    
    # Combinar e remover duplicatas
    all_tickers = sorted(list(set(yahoo_tickers + manual_tickers)))
    
    # Calcular duplicatas removidas
    original_total = len(yahoo_tickers) + len(manual_tickers)
    duplicates_removed = original_total - len(all_tickers)
    
    # Log de estatísticas detalhado
    logger.info(f"🔄 CONSOLIDAÇÃO FINAL - Combinando listas de tickers:")
    logger.info(f"  - Yahoo Finance (B3 + S&P500): {len(yahoo_tickers)}")
    logger.info(f"  - Lista Manual (YAML): {len(manual_tickers)}")
    logger.info(f"  - Total antes consolidação: {original_total}")
    logger.info(f"  - Duplicatas removidas: {duplicates_removed}")
    logger.info(f"  - 🎯 TOTAL FINAL (único): {len(all_tickers)}")
    
    # Print para console também
    print(f"🔄 CONSOLIDAÇÃO FINAL:")
    print(f"  📊 Yahoo Finance: {len(yahoo_tickers)} tickers")
    print(f"  📋 Lista Manual: {len(manual_tickers)} tickers")
    print(f"  🧹 Duplicatas removidas: {duplicates_removed}")
    print(f"  🎯 TOTAL ÚNICO: {len(all_tickers)} tickers para processamento")
    
    return sorted(all_tickers)


@task(name="Obter dados Yahoo Finance individual")
@retry_with_backoff(max_retries=3, base_delay=2.0, max_delay=30.0)
@yahoo_rate_limit(min_delay=1.0, max_delay=3.0)
def get_single_yahoo_data_task(ticker: str) -> Dict[str, Any]:
    """Obtém dados de um único ativo do Yahoo Finance."""
    logger = _get_consolidated_logger("yahoo_data")
    
    # Verificar cache primeiro
    cached_result = get_cached_asset(ticker)
    if cached_result:
        logger.info(f"🚀 CACHE HIT [{ticker}] - Dados obtidos do cache")
        return cached_result
    
    logger.info(f"📊 INICIANDO [{ticker}] - Obtendo dados via Yahoo Finance")
    
    try:
        # Inicializar extrator para este ticker
        extractor = YahooFinanceExtractor()
        
        # Obter apenas informações do ativo (sem dados históricos)
        yahoo_info = extractor.get_asset_info(ticker)
        
        if not yahoo_info:
            error_msg = f"❌ VAZIO [{ticker}] - Nenhuma informação retornada do Yahoo Finance"
            logger.warning(error_msg)
            return {"success": False, "ticker": ticker, "error": "Dados vazios do Yahoo Finance"}
        
        # Criar Asset a partir dos dados do Yahoo
        from ..assets.base import Asset
        asset = Asset.from_yahoo_info(ticker, yahoo_info)
        
        extractor.disconnect()
        
        logger.info(f"✅ SUCESSO [{ticker}] - Dados obtidos: {asset.name} ({asset.asset_type})")
        
        result = {
            "success": True,
            "ticker": ticker,
            "asset": asset,
            "yahoo_info": yahoo_info,
            "asset_type": asset.asset_type,
            "name": asset.name,
            "exchange": asset.exchange
        }
        
        # Armazenar no cache apenas se sucesso
        cache_asset(ticker, result)
        
        return result
                
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # Identificar tipos específicos de erro
        if "404" in error_msg or "Not Found" in error_msg:
            logger.warning(f"❌ ERRO 404 [{ticker}] - Ticker não encontrado no Yahoo Finance: {error_msg}")
        elif "rate limit" in error_msg.lower() or "too many requests" in error_msg.lower():
            logger.warning(f"⚠️  RATE LIMIT [{ticker}] - Limite de requisições atingido: {error_msg}")
        elif "timeout" in error_msg.lower():
            logger.warning(f"⏰ TIMEOUT [{ticker}] - Timeout na requisição: {error_msg}")
        else:
            logger.error(f"❌ ERRO {error_type} [{ticker}] - {error_msg}")
        
        return {"success": False, "ticker": ticker, "error": f"{error_type}: {error_msg}"}


@task(name="Obter dados Yahoo Finance (Paralelo)")
def get_yahoo_data_parallel_task(tickers: List[str], max_workers: int = 3) -> Dict[str, Any]:
    """Obtém dados do Yahoo Finance em paralelo (mais rápido sem Asset Factory)."""
    logger = _get_consolidated_logger("yahoo_data")
    
    logger.info(f"Iniciando obtenção paralela de dados para {len(tickers)} ativos com {max_workers} workers...")
    
    assets_created = []
    errors = []
    
    # Executar tasks individuais em paralelo
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submeter todas as tasks
        future_to_ticker = {
            executor.submit(get_single_yahoo_data_task.fn, ticker): ticker 
            for ticker in tickers
        }
        
        # Processar resultados conforme ficam prontos
        for i, future in enumerate(as_completed(future_to_ticker), 1):
            ticker = future_to_ticker[future]
            try:
                result = future.result()
                
                if result["success"]:
                    assets_created.append(result)
                    asset_info = f"{result['name']} ({result['asset_type']})"
                    logger.info(f"✅ DADOS OBTIDOS [{ticker}] - {asset_info} | Progresso: {i}/{len(tickers)}")
                else:
                    errors.append({"ticker": ticker, "error": result["error"]})
                    logger.warning(f"❌ DADOS FALHARAM [{ticker}] - {result['error']} | Progresso: {i}/{len(tickers)}")
                    
            except Exception as e:
                error_msg = f"Erro inesperado ao processar {ticker}: {e}"
                logger.error(error_msg)
                errors.append({"ticker": ticker, "error": str(e)})
    
    logger.info(f"Obtenção de dados concluída:")
    logger.info(f"  - Sucessos: {len(assets_created)}")
    logger.info(f"  - Erros: {len(errors)}")
    
    return {
        "success": len(assets_created),
        "errors": len(errors),
        "assets": assets_created,
        "error_details": errors
    }


@task(name="Obter dados históricos individual")
@retry_with_backoff(max_retries=3, base_delay=2.0, max_delay=30.0)
@yahoo_rate_limit(min_delay=1.0, max_delay=3.0)
def get_single_historical_data_task(ticker: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
    """Obtém dados históricos para um único ativo."""
    logger = _get_consolidated_logger("historical_data")
    
    # Verificar cache primeiro
    cached_result = get_cached_data(ticker, start_date, end_date)
    if cached_result:
        logger.info(f"🚀 CACHE HIT [{ticker}] - Dados históricos obtidos do cache")
        return cached_result
    
    period_str = f"{start_date.date()} a {end_date.date()}"
    logger.info(f"📈 INICIANDO [{ticker}] - Obtendo dados históricos ({period_str})")
    
    try:
        # Inicializar extrator para este ticker
        extractor = YahooFinanceExtractor()
        
        # Obter dados históricos
        result = extractor.extract_asset_with_data(ticker, start_date, end_date)
        
        extractor.disconnect()
        
        if result["success"]:
            data_count = len(result['historical_data'])
            latest_price = result.get('latest_price', 'N/A')
            logger.info(f"✅ SUCESSO [{ticker}] - {data_count} registros obtidos (último preço: {latest_price})")
            
            final_result = {
                "success": True,
                "ticker": ticker,
                "asset": result["asset"],
                "data": result["historical_data"],
                "latest_price": result["latest_price"],
                "rows_count": len(result["historical_data"])
            }
            
            # Armazenar no cache apenas se sucesso
            cache_data(ticker, start_date, end_date, final_result)
            
            return final_result
        else:
            error_msg = result.get("error", "Erro desconhecido")
            
            # Identificar tipos específicos de erro
            if "404" in error_msg or "Not Found" in error_msg:
                logger.warning(f"❌ ERRO 404 [{ticker}] - Dados históricos não encontrados: {error_msg}")
            elif "rate limit" in error_msg.lower() or "too many requests" in error_msg.lower():
                logger.warning(f"⚠️  RATE LIMIT [{ticker}] - Limite de requisições atingido: {error_msg}")
            elif "timeout" in error_msg.lower():
                logger.warning(f"⏰ TIMEOUT [{ticker}] - Timeout na requisição: {error_msg}")
            else:
                logger.warning(f"❌ FALHA [{ticker}] - {error_msg}")
            
            return {"success": False, "ticker": ticker, "error": error_msg}
                
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # Identificar tipos específicos de erro
        if "404" in error_msg or "Not Found" in error_msg:
            logger.warning(f"❌ ERRO 404 [{ticker}] - Dados históricos não encontrados: {error_msg}")
        elif "rate limit" in error_msg.lower() or "too many requests" in error_msg.lower():
            logger.warning(f"⚠️  RATE LIMIT [{ticker}] - Limite de requisições atingido: {error_msg}")
        elif "timeout" in error_msg.lower():
            logger.warning(f"⏰ TIMEOUT [{ticker}] - Timeout na requisição: {error_msg}")
        else:
            logger.error(f"❌ ERRO {error_type} [{ticker}] - {error_msg}")
        
        return {"success": False, "ticker": ticker, "error": f"{error_type}: {error_msg}"}


@task(name="Obter dados históricos (Paralelo)")
def get_historical_data_parallel_task(assets_data: Dict[str, Any], max_workers: int = 3) -> Dict[str, Any]:
    """Obtém dados históricos para os ativos criados em paralelo."""
    logger = _get_consolidated_logger("historical_data")
    
    assets = assets_data.get("assets", [])
    if not assets:
        logger.warning("Nenhum ativo para obter dados históricos")
        return {"success": 0, "errors": 0, "data": []}
    
    # Período: últimos 20 anos por padrão
    end_date = datetime.now()
    start_date = end_date - timedelta(days=20*365)
    
    logger.info(f"Iniciando obtenção paralela de dados históricos para {len(assets)} ativos com {max_workers} workers...")
    
    historical_data = []
    errors = []
    
    # Executar tasks individuais em paralelo
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submeter todas as tasks
        future_to_ticker = {
            executor.submit(get_single_historical_data_task.fn, asset_info["ticker"], start_date, end_date): asset_info["ticker"]
            for asset_info in assets
        }
        
        # Processar resultados conforme ficam prontos
        for i, future in enumerate(as_completed(future_to_ticker), 1):
            ticker = future_to_ticker[future]
            try:
                result = future.result()
                
                if result["success"]:
                    historical_data.append(result)
                    rows_count = result.get('rows_count', 0)
                    latest_price = result.get('latest_price', 'N/A')
                    logger.info(f"✅ DADOS OBTIDOS [{ticker}] - {rows_count} registros (último: {latest_price}) | Progresso: {i}/{len(assets)}")
                else:
                    errors.append({"ticker": ticker, "error": result["error"]})
                    logger.warning(f"❌ DADOS FALHOU [{ticker}] - {result['error']} | Progresso: {i}/{len(assets)}")
                    
            except Exception as e:
                error_msg = f"Erro inesperado ao obter dados para {ticker}: {e}"
                logger.error(error_msg)
                errors.append({"ticker": ticker, "error": str(e)})
    
    logger.info(f"Obtenção de dados concluída:")
    logger.info(f"  - Sucessos: {len(historical_data)}")
    logger.info(f"  - Erros: {len(errors)}")
    
    return {
        "success": len(historical_data),
        "errors": len(errors),
        "data": historical_data,
        "error_details": errors
    }


@task(name="Salvar dados Yahoo Finance no banco NoSQL")
def save_yahoo_data_to_db_task(assets_data: Dict[str, Any]) -> Dict[str, Any]:
    """Salva dados do Yahoo Finance no banco NoSQL (TinyDB)."""
    logger = _get_consolidated_logger("save_yahoo_data")
    
    assets = assets_data.get("assets", [])
    
    # Debug inicial
    print(f"🔍 DEBUG SAVE - Recebidos {len(assets)} ativos para salvar")
    logger.info(f"🔍 DEBUG SAVE - Iniciando salvamento de {len(assets)} ativos no TinyDB")
    
    if not assets:
        error_msg = "❌ CRÍTICO - Nenhum ativo recebido para salvar no banco NoSQL"
        logger.error(error_msg)
        print(error_msg)
        return {"assets_saved": 0, "errors": 0}
    
    try:
        dao = YahooAssetsDAO()
        
        # Debug do banco
        print(f"🔍 DEBUG SAVE - Banco TinyDB inicializado: {dao.db_path}")
        logger.info(f"🔍 DEBUG SAVE - Banco TinyDB: {dao.db_path}")
        
        saved_count = 0
        error_count = 0
        error_details = []
        
        for i, asset_info in enumerate(assets, 1):
            try:
                ticker = asset_info.get("ticker", "UNKNOWN")
                yahoo_info = asset_info.get("yahoo_info", {})
                
                print(f"🔍 DEBUG SAVE [{i}/{len(assets)}] - Processando {ticker}")
                
                if not yahoo_info:
                    error_msg = f"⚠️  SEM DADOS [{ticker}] - yahoo_info está vazio"
                    logger.warning(error_msg)
                    print(error_msg)
                    error_count += 1
                    error_details.append(f"{ticker}: dados Yahoo vazios")
                    continue
                
                # Debug dos dados do Yahoo
                yahoo_keys = list(yahoo_info.keys())
                print(f"🔍 DEBUG SAVE [{ticker}] - Yahoo tem {len(yahoo_keys)} campos: {yahoo_keys[:5]}...")
                
                # Salvar dados diretamente no banco NoSQL
                saved_ticker = dao.save_asset_from_yahoo_data(ticker, yahoo_info)
                
                saved_count += 1
                asset_type = asset_info.get('asset_type', 'unknown')
                success_msg = f"✅ SALVO NO NOSQL [{saved_ticker}] - Tipo: {asset_type}"
                logger.info(success_msg)
                print(success_msg)
                
            except Exception as e:
                error_count += 1
                ticker_name = asset_info.get('ticker', 'UNKNOWN')
                error_type = type(e).__name__
                error_msg = f"❌ ERRO AO SALVAR [{ticker_name}] - {error_type}: {e}"
                logger.error(error_msg)
                print(error_msg)
                error_details.append(f"{ticker_name}: {error_type} - {str(e)}")
                
                # Se tivemos erro de serialização, é um problema crítico
                if "json" in str(e).lower() or "serializable" in str(e).lower():
                    critical_msg = f"🚨 ERRO SERIALIZAÇÃO CRÍTICO [{ticker_name}] - {e}"
                    logger.error(critical_msg)
                    print(critical_msg)
        
        # TinyDB sem cache persiste automaticamente
        print(f"🔄 DEBUG PERSISTENCE - TinyDB persiste dados automaticamente")
        
        # Limpar duplicatas se houver
        try:
            duplicates_removed = dao.remove_duplicates()
            if duplicates_removed > 0:
                print(f"🗑️  DUPLICATAS REMOVIDAS: {duplicates_removed}")
                logger.info(f"🗑️  Duplicatas removidas: {duplicates_removed}")
        except Exception as cleanup_error:
            print(f"❌ Erro na limpeza de duplicatas: {cleanup_error}")
        
        # Verificar se realmente salvou
        try:
            stats = dao.get_statistics()
            total_in_db = stats['total_assets']
            unique_tickers = stats['unique_tickers']
            
            logger.info(f"💾 BANCO NOSQL - Salvamento concluído:")
            logger.info(f"  - ✅ Sucessos: {saved_count}")
            logger.info(f"  - ❌ Erros: {error_count}")
            logger.info(f"  - 📊 Total registros no banco: {total_in_db}")
            logger.info(f"  - 🎯 Tickers únicos: {unique_tickers}")
            
            print(f"💾 RESULTADO SALVAMENTO NOSQL:")
            print(f"  ✅ Sucessos: {saved_count}")
            print(f"  ❌ Erros: {error_count}")
            print(f"  📊 Total registros: {total_in_db}")
            print(f"  🎯 Tickers únicos: {unique_tickers}")
            
            # Debug: listar alguns tickers salvos para confirmar
            if total_in_db > 0:
                sample_tickers = dao.get_all_tickers()[:5]
                print(f"🔍 DEBUG SAMPLE - Primeiros tickers no banco: {sample_tickers}")
                logger.info(f"🔍 DEBUG SAMPLE - Tickers exemplo: {sample_tickers}")
                
            # Verificar se há discrepância entre registros e tickers únicos
            if total_in_db != unique_tickers:
                warning_msg = f"⚠️  AVISO: {total_in_db} registros mas apenas {unique_tickers} tickers únicos (possíveis duplicatas)"
                print(warning_msg)
                logger.warning(warning_msg)
            
            if error_count > 0:
                logger.error(f"🚨 DETALHES DOS ERROS:")
                for error_detail in error_details[:5]:  # Mostrar apenas os primeiros 5
                    logger.error(f"  - {error_detail}")
                    print(f"  - {error_detail}")
            
            # Se nenhum registro foi salvo mas esperávamos salvar, é um erro crítico
            if saved_count == 0 and len(assets) > 0:
                critical_msg = f"🚨 ERRO CRÍTICO - Nenhum registro salvo apesar de {len(assets)} ativos processados!"
                logger.error(critical_msg)
                print(critical_msg)
            
            # Se o banco ainda está vazio, é um problema
            if total_in_db == 0:
                critical_msg = f"🚨 BANCO VAZIO - TinyDB não contém nenhum registro após tentativa de salvamento!"
                logger.error(critical_msg)
                print(critical_msg)
                
        except Exception as stats_error:
            logger.error(f"❌ Erro ao obter estatísticas do banco: {stats_error}")
            print(f"❌ Erro ao verificar banco: {stats_error}")
        
        dao.close()
        
        return {
            "assets_saved": saved_count,
            "errors": error_count,
            "error_details": error_details
        }
        
    except Exception as e:
        critical_msg = f"🚨 ERRO CRÍTICO NOSQL - Falha total ao salvar: {e}"
        logger.error(critical_msg)
        print(critical_msg)
        return {"assets_saved": 0, "errors": len(assets), "critical_error": str(e)}


@task(name="Salvar dados históricos no banco")
def save_historical_data_task(historical_data: Dict[str, Any]) -> Dict[str, Any]:
    """Salva dados históricos no banco de dados SQLite daily_prices.db."""
    logger = _get_consolidated_logger("save_historical_data")
    
    data = historical_data.get("data", [])
    
    # Debug inicial
    print(f"🔍 DEBUG HISTORICAL - Recebidos {len(data)} ativos com dados históricos")
    logger.info(f"🔍 DEBUG HISTORICAL - Iniciando salvamento de dados históricos para {len(data)} ativos")
    
    if not data:
        error_msg = "❌ CRÍTICO - Nenhum dado histórico recebido para salvar"
        logger.error(error_msg)
        print(error_msg)
        return {"prices_saved": 0, "errors": 0}
    
    try:
        import sqlite3
        import pandas as pd
        from ..config import DB_PATH_DAILY_PRICES
        
        prices_saved = 0
        error_count = 0
        error_details = []
        
        # Conectar ao banco de dados
        print(f"🔍 DEBUG HISTORICAL - Conectando ao banco: {DB_PATH_DAILY_PRICES}")
        
        def clean_table_name(ticker: str) -> str:
            """Limpa o ticker para usar como nome de tabela SQLite."""
            import re
            ticker_upper = ticker.upper()
            
            # Remover .SA dos tickers brasileiros
            if ticker_upper.endswith('.SA'):
                ticker_upper = ticker_upper.replace('.SA', '')
            
            # Permitir ^ para índices (ex: ^BVSP), mas substituir outros caracteres especiais
            # Manter apenas letras, números e ^
            clean_name = re.sub(r'[^a-zA-Z0-9^]', '_', ticker_upper)
            
            # Garantir que não comece com número (exceto se tiver ^)
            if clean_name[0].isdigit():
                clean_name = f"ticker_{clean_name}"
            
            return clean_name
        
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            
            for i, item in enumerate(data, 1):
                try:
                    ticker = item.get("ticker", "UNKNOWN")
                    df = item.get("data")
                    
                    print(f"🔍 DEBUG HISTORICAL [{i}/{len(data)}] - Processando {ticker}")
                    
                    if df is None or df.empty:
                        error_msg = f"⚠️  SEM DADOS [{ticker}] - DataFrame vazio"
                        logger.warning(error_msg)
                        print(error_msg)
                        error_count += 1
                        error_details.append(f"{ticker}: DataFrame vazio")
                        continue
                    
                    # Criar nome da tabela específica para este ticker
                    table_name = clean_table_name(ticker)
                    print(f"🔍 DEBUG TABLE [{ticker}] - Nome da tabela: {table_name}")
                    
                    # Criar tabela específica para este ticker (sem coluna ID)
                    conn.execute(f"""
                        CREATE TABLE IF NOT EXISTS {table_name} (
                            date DATE NOT NULL PRIMARY KEY,
                            open REAL,
                            high REAL,
                            low REAL,
                            close REAL,
                            adj_close REAL,
                            volume INTEGER
                        )
                    """)
                    
                    # Date já é PRIMARY KEY, não precisa de índice adicional
                    
                    print(f"✅ DEBUG TABLE [{ticker}] - Tabela {table_name} criada/verificada")
                    
                    # Preparar dados para inserção
                    df_copy = df.copy()
                    
                    # Debug: verificar estrutura do DataFrame
                    print(f"🔍 DEBUG DF [{ticker}] - Colunas: {list(df_copy.columns)}")
                    print(f"🔍 DEBUG DF [{ticker}] - Shape: {df_copy.shape}")
                    
                    # Renomear colunas primeiro (não mexer no index ainda)
                    column_mapping = {
                        'Date': 'date',
                        'time': 'date',  # YahooProvider retorna 'time' como data
                        'Open': 'open',
                        'High': 'high',
                        'Low': 'low',
                        'Close': 'close',
                        'Adj Close': 'adj_close',
                        'Volume': 'volume'
                    }
                    
                    df_copy = df_copy.rename(columns=column_mapping)
                    
                    # Agora verificar se temos coluna date
                    # Se não temos, verificar se o index pode ser a data
                    if 'date' not in df_copy.columns:
                        if df_copy.index.name in ['Date', 'date'] or pd.api.types.is_datetime64_any_dtype(df_copy.index):
                            # Index é data, fazer reset_index para transformar em coluna
                            df_copy.reset_index(inplace=True)
                            if 'Date' in df_copy.columns:
                                df_copy.rename(columns={'Date': 'date'}, inplace=True)
                            elif 'index' in df_copy.columns:
                                df_copy.rename(columns={'index': 'date'}, inplace=True)
                    
                    # Verificar se temos a coluna date após processamento
                    if 'date' not in df_copy.columns:
                        error_msg = f"⚠️  SEM COLUNA DATE [{ticker}] - Colunas disponíveis: {list(df_copy.columns)}"
                        logger.warning(error_msg)
                        print(error_msg)
                        error_count += 1
                        error_details.append(f"{ticker}: sem coluna date")
                        continue
                    
                    # Selecionar apenas colunas necessárias (sem ticker, pois cada tabela é específica)
                    required_columns = ['date']
                    optional_columns = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
                    
                    available_columns = [col for col in required_columns + optional_columns if col in df_copy.columns]
                    df_insert = df_copy[available_columns]
                    
                    # Converter data para formato padrão YYYY-MM-DD
                    if 'date' in df_insert.columns:
                        # Debug: mostrar formato atual da data
                        print(f"🔍 DEBUG DATE [{ticker}] - Primeiro valor de data: {df_insert['date'].iloc[0]} (tipo: {type(df_insert['date'].iloc[0])})")
                        
                        # Se é string, pode estar em formato dd-mm-yyyy
                        if isinstance(df_insert['date'].iloc[0], str):
                            try:
                                # Tentar converter de dd-mm-yyyy para yyyy-mm-dd
                                df_insert['date'] = pd.to_datetime(df_insert['date'], format='%d-%m-%Y').dt.strftime('%Y-%m-%d')
                                print(f"✅ DEBUG DATE [{ticker}] - Convertido de dd-mm-yyyy para yyyy-mm-dd")
                            except:
                                try:
                                    # Fallback: tentar parseamento automático
                                    df_insert['date'] = pd.to_datetime(df_insert['date']).dt.strftime('%Y-%m-%d')
                                    print(f"✅ DEBUG DATE [{ticker}] - Convertido via parseamento automático")
                                except Exception as date_error:
                                    error_msg = f"❌ ERRO DATE [{ticker}] - Falha na conversão de data: {date_error}"
                                    logger.error(error_msg)
                                    print(error_msg)
                                    error_count += 1
                                    error_details.append(f"{ticker}: erro conversão data - {date_error}")
                                    continue
                        # Se é datetime, converter diretamente
                        elif hasattr(df_insert['date'].iloc[0], 'strftime'):
                            df_insert['date'] = df_insert['date'].dt.strftime('%Y-%m-%d')
                            print(f"✅ DEBUG DATE [{ticker}] - Convertido de datetime para yyyy-mm-dd")
                    
                    # Inserir dados na tabela específica usando REPLACE para evitar duplicatas
                    rows_before = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    
                    # Usar REPLACE INTO para evitar conflitos de chave primária (date)
                    for idx, row in df_insert.iterrows():
                        placeholders = ', '.join(['?' for _ in range(len(row))])
                        columns = ', '.join(df_insert.columns)
                        
                        conn.execute(f"""
                            REPLACE INTO {table_name} ({columns}) 
                            VALUES ({placeholders})
                        """, tuple(row))
                    
                    rows_after = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    rows_inserted = rows_after - rows_before
                    
                    prices_saved += rows_inserted
                    
                    success_msg = f"✅ SALVO HISTÓRICO [{ticker}] - {rows_inserted} registros na tabela {table_name} (total: {len(df_insert)})"
                    logger.info(success_msg)
                    print(success_msg)
                    
                except Exception as e:
                    error_count += 1
                    error_msg = f"❌ ERRO HISTÓRICO [{item.get('ticker', 'UNKNOWN')}] - {e}"
                    logger.error(error_msg)
                    print(error_msg)
                    error_details.append(f"{item.get('ticker', 'UNKNOWN')}: {str(e)}")
        
        # Verificar resultados
        try:
            with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
                # Contar tabelas criadas
                tables_cursor = conn.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """)
                tables = [row[0] for row in tables_cursor.fetchall()]
                unique_tables = len(tables)
                
                # Contar total de registros em todas as tabelas
                total_rows = 0
                for table_name in tables:
                    try:
                        count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                        total_rows += count
                    except Exception as table_error:
                        print(f"❌ Erro ao contar registros da tabela {table_name}: {table_error}")
                
                logger.info(f"📊 BANCO HISTÓRICO - Salvamento concluído:")
                logger.info(f"  - ✅ Registros salvos: {prices_saved}")
                logger.info(f"  - ❌ Erros: {error_count}")
                logger.info(f"  - 📊 Total no banco: {total_rows} registros")
                logger.info(f"  - 🎯 Tabelas criadas: {unique_tables}")
                
                print(f"📊 RESULTADO SALVAMENTO HISTÓRICO:")
                print(f"  ✅ Registros salvos: {prices_saved}")
                print(f"  ❌ Erros: {error_count}")
                print(f"  📊 Total no banco: {total_rows}")
                print(f"  🎯 Tabelas criadas: {unique_tables}")
                
                # Debug: mostrar algumas tabelas criadas
                if tables:
                    sample_tables = tables[:5]
                    print(f"🔍 DEBUG TABLES - Primeiras tabelas: {sample_tables}")
                    logger.info(f"🔍 DEBUG TABLES - Tabelas exemplo: {sample_tables}")
                
                if error_count > 0:
                    logger.error(f"🚨 DETALHES DOS ERROS:")
                    for error_detail in error_details[:5]:
                        logger.error(f"  - {error_detail}")
                        print(f"  - {error_detail}")
                
                # Se nenhum registro foi salvo mas esperávamos salvar
                if prices_saved == 0 and len(data) > 0:
                    critical_msg = f"🚨 ERRO CRÍTICO - Nenhum registro histórico salvo apesar de {len(data)} ativos processados!"
                    logger.error(critical_msg)
                    print(critical_msg)
                    
        except Exception as stats_error:
            logger.error(f"❌ Erro ao verificar banco histórico: {stats_error}")
            print(f"❌ Erro ao verificar banco histórico: {stats_error}")
        
        return {
            "prices_saved": prices_saved,
            "errors": error_count,
            "error_details": error_details
        }
        
    except Exception as e:
        critical_msg = f"🚨 ERRO CRÍTICO HISTÓRICO - Falha total ao salvar: {e}"
        logger.error(critical_msg)
        print(critical_msg)
        return {"prices_saved": 0, "errors": len(data), "critical_error": str(e)}


@task(name="Salvar status da execução")
def save_execution_status_task(
    tickers_count: int,
    yahoo_data_result: Dict[str, Any],
    historical_data_result: Dict[str, Any],
    nosql_save_result: Dict[str, Any],
    historical_save_result: Dict[str, Any]
) -> None:
    """Salva status da execução do pipeline."""
    logger = _get_consolidated_logger("execution_status")
    
    status = {
        "execution_time": datetime.now().isoformat(),
        "tickers_processed": tickers_count,
        "yahoo_data_obtained": yahoo_data_result.get("success", 0),
        "yahoo_data_errors": yahoo_data_result.get("errors", 0),
        "historical_data_obtained": historical_data_result.get("success", 0),
        "historical_data_errors": historical_data_result.get("errors", 0),
        "assets_saved_nosql": nosql_save_result.get("assets_saved", 0),
        "nosql_save_errors": nosql_save_result.get("errors", 0),
        "prices_saved": historical_save_result.get("prices_saved", 0),
        "success": True
    }
    
    try:
        with open(STATUS_PATH, 'w') as f:
            json.dump(status, f, indent=2)
        logger.info(f"Status salvo em {STATUS_PATH}")
    except Exception as e:
        logger.error(f"Erro ao salvar status: {e}")


@flow(name="Pipeline Diário Modernizado")
def daily_flow():
    """
    Flow principal do pipeline diário modernizado.
    
    Utiliza a nova arquitetura de ativos com AssetFactory,
    YahooProvider e estrutura de banco de dados atualizada.
    """
    logger = _setup_file_logger()
    logger.info("=== INICIANDO PIPELINE DIÁRIO MODERNIZADO ===")
    
    # Print para console com timestamp
    start_time = datetime.now()
    print(f"\n{'='*70}")
    print(f"🚀 PIPELINE DIÁRIO MODERNIZADO - {start_time.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*70}")
    
    try:
        # 1. Atualizar cadastros de tickers
        logger.info("Fase 1: Atualizando cadastros de tickers...")
        print("🔄 FASE 1: Atualizando cadastros de tickers...")
        
        b3_count = update_tickers_task()
        sp500_count = update_sp500_tickers_task()
        update_sectors_task()
        
        # 2. Obter listas de tickers
        logger.info("Fase 2: Obtendo listas de tickers...")
        print("📊 FASE 2: Obtendo listas de tickers...")
        
        yahoo_tickers = get_yahoo_tickers_task()
        manual_tickers = get_manual_tickers_task()
        all_tickers = consolidate_tickers_task(yahoo_tickers, manual_tickers)
        
        # 3. Obter dados do Yahoo Finance (mais rápido sem Asset Factory)
        logger.info("Fase 3: Obtendo dados do Yahoo Finance...")
        print("📡 FASE 3: Obtendo dados do Yahoo Finance...")
        
        yahoo_data_result = get_yahoo_data_parallel_task(all_tickers, max_workers=3)
        
        # 4. Obter dados históricos
        logger.info("Fase 4: Obtendo dados históricos...")
        print("📈 FASE 4: Obtendo dados históricos...")
        
        historical_data_result = get_historical_data_parallel_task(yahoo_data_result, max_workers=3)
        
        # 5. Salvar dados no banco NoSQL
        logger.info("Fase 5: Salvando dados no banco NoSQL...")
        print("💾 FASE 5: Salvando dados no banco NoSQL...")
        
        nosql_save_result = save_yahoo_data_to_db_task(yahoo_data_result)
        
        # 6. Salvar dados históricos
        logger.info("Fase 6: Salvando dados históricos...")
        print("💽 FASE 6: Salvando dados históricos...")
        
        historical_save_result = save_historical_data_task(historical_data_result)
        
        # 7. Salvar status
        save_execution_status_task(
            len(all_tickers), yahoo_data_result, historical_data_result, nosql_save_result, historical_save_result
        )
        
        logger.info("=== PIPELINE CONCLUÍDO COM SUCESSO ===")
        
        # Calcular tempo de execução
        end_time = datetime.now()
        execution_time = end_time - start_time
        
        # Log final detalhado
        logger.info("📊 RESUMO FINAL DA EXECUÇÃO:")
        logger.info(f"  - ⏱️  Tempo de execução: {execution_time}")
        logger.info(f"  - 📈 Tickers B3: {b3_count}")
        logger.info(f"  - 📈 Tickers S&P500: {sp500_count}")
        logger.info(f"  - 📋 Lista Manual: {len(manual_tickers)}")
        logger.info(f"  - 🎯 Total tickers processados: {len(all_tickers)}")
        logger.info(f"  - ✅ Dados Yahoo obtidos: {yahoo_data_result.get('success', 0)}")
        logger.info(f"  - 📊 Dados históricos obtidos: {historical_data_result.get('success', 0)}")
        logger.info(f"  - 💾 Ativos salvos NoSQL: {nosql_save_result.get('assets_saved', 0)}")
        logger.info(f"  - 💽 Preços salvos: {historical_save_result.get('prices_saved', 0)}")
        
        # Print para console também
        print(f"\n{'='*70}")
        print(f"✅ PIPELINE CONCLUÍDO COM SUCESSO - {end_time.strftime('%H:%M:%S')}")
        print(f"{'='*70}")
        print(f"⏱️  Tempo de execução: {execution_time}")
        print(f"📊 RESUMO:")
        print(f"  📈 B3: {b3_count} tickers")
        print(f"  📈 S&P500: {sp500_count} tickers") 
        print(f"  📋 Manual: {len(manual_tickers)} tickers")
        print(f"  🎯 Total: {len(all_tickers)} tickers processados")
        print(f"  ✅ Yahoo obtidos: {yahoo_data_result.get('success', 0)}")
        print(f"  💾 NoSQL salvos: {nosql_save_result.get('assets_saved', 0)}")
        print(f"{'='*70}\n")
        
    except Exception as e:
        logger.error(f"ERRO NO PIPELINE: {e}")
        
        # Salvar status de erro
        error_status = {
            "execution_time": datetime.now().isoformat(),
            "success": False,
            "error": str(e)
        }
        
        try:
            with open(STATUS_PATH, 'w') as f:
                json.dump(error_status, f, indent=2)
        except:
            pass
        
        raise


if __name__ == "__main__":
    # Execução local para testes
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("Executando pipeline diário modernizado...")
    daily_flow()
