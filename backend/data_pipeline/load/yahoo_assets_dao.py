"""
DAO para gerenciar dados de ativos do Yahoo Finance usando TinyDB (NoSQL).

Substitui o asset_factory.db por um banco NoSQL mais simples
que armazena diretamente os dados JSON do Yahoo Finance.
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from tinydb import TinyDB, Query
from tinydb.storages import JSONStorage
from tinydb.middlewares import CachingMiddleware

from ...config import DB_PATH_YAHOO_ASSETS
from ...assets.base import Asset


# Importar função centralizada de limpeza
from ...utils.transform import clean_ticker_for_database_key


class YahooAssetsDAO:
    """
    DAO para gerenciar dados de ativos do Yahoo Finance.
    
    Usa TinyDB como banco NoSQL para armazenar dados JSON
    do Yahoo Finance de forma simples e eficiente.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Inicializa o DAO.
        
        Args:
            db_path: Caminho para o banco de dados (default: config.DB_PATH_YAHOO_ASSETS)
        """
        self.db_path = db_path or str(Path(DB_PATH_YAHOO_ASSETS).parent / "yahoo_assets.json")
        
        # Garantir que o diretório existe
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # Inicializar TinyDB sem cache para garantir persistência imediata
        self.db = TinyDB(self.db_path)
        
        # Debug: verificar se o arquivo existe
        print(f"🔍 DEBUG INIT - TinyDB path: {self.db_path}")
        print(f"🔍 DEBUG INIT - Arquivo existe: {Path(self.db_path).exists()}")
        
        # Usar tabela 'assets' com estrutura personalizada {ticker_key: asset_data}
        self.assets_table = self.db.table('assets')
        
        # Query helper
        self.Asset = Query()
    
    def save_asset(self, asset: Asset) -> str:
        """
        Salva um Asset no banco de dados usando ticker limpo como chave primária.
        Estrutura: {"assets": {"TICKER_KEY": asset_data}}
        
        Args:
            asset: Instância do Asset
            
        Returns:
            Ticker limpo usado como chave
        """
        try:
            asset_dict = asset.to_dict()
            ticker_original = asset.ticker.upper()
            ticker_key = clean_ticker_for_database_key(ticker_original)
            
            # Debug: verificar conteúdo do asset_dict
            print(f"🔍 DEBUG SAVE_ASSET [{ticker_original}] - Chave: {ticker_key}")
            print(f"🔍 DEBUG SAVE_ASSET [{ticker_key}] - Dict keys: {list(asset_dict.keys())}")
            
            # Usar estrutura customizada: ler JSON, modificar, salvar
            try:
                # Ler estrutura atual
                with open(self.db_path, 'r') as f:
                    data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                # Arquivo não existe ou está corrompido, criar estrutura inicial
                data = {"assets": {}}
            
            # Garantir que existe a estrutura assets
            if "assets" not in data:
                data["assets"] = {}
            
            # Verificar se já existe
            is_update = ticker_key in data["assets"]
            
            # Salvar/atualizar dados
            data["assets"][ticker_key] = asset_dict
            
            # Escrever de volta no arquivo
            with open(self.db_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            if is_update:
                print(f"🔄 DEBUG SAVE_ASSET [{ticker_key}] - Registro atualizado com sucesso")
            else:
                print(f"➕ DEBUG SAVE_ASSET [{ticker_key}] - Novo registro inserido com sucesso")
                
            print(f"💾 DEBUG SAVE_ASSET [{ticker_key}] - Salvo em estrutura customizada")
            
            # Verificar se foi realmente salvo
            try:
                with open(self.db_path, 'r') as f:
                    verification_data = json.load(f)
                if ticker_key in verification_data.get("assets", {}):
                    print(f"✅ DEBUG SAVE_ASSET [{ticker_key}] - Confirmação: registro encontrado no banco")
                else:
                    print(f"❌ DEBUG SAVE_ASSET [{ticker_key}] - ERRO: registro não encontrado após operação!")
            except Exception as verify_error:
                print(f"❌ DEBUG SAVE_ASSET [{ticker_key}] - ERRO na verificação: {verify_error}")
            
            return ticker_key
        except Exception as e:
            print(f"❌ ERRO DAO SAVE_ASSET - Falha ao salvar {asset.ticker}: {e}")
            print(f"🔍 DEBUG ERROR - Exception type: {type(e).__name__}")
            print(f"🔍 DEBUG ERROR - Asset data: {asset.model_dump()}")
            raise
    
    def save_asset_from_yahoo_data(self, ticker: str, yahoo_data: Dict[str, Any]) -> str:
        """
        Salva dados do Yahoo Finance diretamente no banco usando ticker como chave.
        
        Args:
            ticker: Símbolo do ticker
            yahoo_data: Dados completos do Yahoo Finance
            
        Returns:
            Ticker do documento inserido/atualizado
        """
        try:
            # Debug: mostrar dados do Yahoo sendo processados
            print(f"🔍 DEBUG DAO - Processando ticker {ticker} com {len(yahoo_data)} campos")
            
            # Criar Asset a partir dos dados do Yahoo
            asset = Asset.from_yahoo_info(ticker, yahoo_data)
            
            # Debug: confirmar que o Asset foi criado
            print(f"✅ DEBUG DAO - Asset criado: {asset.ticker} ({asset.name})")
            
            # Salvar no banco (retorna ticker limpo usado como chave)
            ticker_key = self.save_asset(asset)
            
            print(f"💾 DEBUG DAO - Salvo no TinyDB com chave: {ticker_key}")
            
            return ticker_key
            
        except Exception as e:
            print(f"❌ ERRO DAO FROM_YAHOO - Falha ao processar {ticker}: {e}")
            print(f"📊 DADOS YAHOO: {list(yahoo_data.keys())[:10]}...")  # Primeiras 10 chaves
            raise
    
    def get_asset_by_ticker(self, ticker: str) -> Optional[Asset]:
        """
        Obtém um Asset pelo ticker.
        
        Args:
            ticker: Símbolo do ticker
            
        Returns:
            Asset ou None se não encontrado
        """
        ticker_upper = ticker.upper()
        result = self.assets_table.search(self.Asset.ticker == ticker_upper)
        
        if result:
            asset_data = result[0]
            return Asset(**asset_data)
        
        return None
    
    def get_yahoo_data_by_ticker(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Obtém dados completos do Yahoo Finance pelo ticker.
        
        Args:
            ticker: Símbolo do ticker
            
        Returns:
            Dados do Yahoo Finance ou None se não encontrado
        """
        asset = self.get_asset_by_ticker(ticker)
        return asset.yahoo_info if asset else None
    
    def get_all_tickers(self) -> List[str]:
        """
        Obtém lista de todos os tickers no banco.
        
        Returns:
            Lista de chaves (tickers limpos)
        """
        try:
            with open(self.db_path, 'r') as f:
                data = json.load(f)
            return list(data.get("assets", {}).keys())
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def get_assets_by_exchange(self, exchange: str) -> List[Asset]:
        """
        Obtém ativos por bolsa.
        
        Args:
            exchange: Nome da bolsa
            
        Returns:
            Lista de Assets
        """
        exchange_upper = exchange.upper()
        results = self.assets_table.search(self.Asset.exchange == exchange_upper)
        return [Asset(**doc) for doc in results]
    
    def get_assets_by_sector(self, sector: str) -> List[Asset]:
        """
        Obtém ativos por setor.
        
        Args:
            sector: Nome do setor
            
        Returns:
            Lista de Assets
        """
        results = self.assets_table.search(self.Asset.sector == sector)
        return [Asset(**doc) for doc in results]
    
    def get_assets_by_asset_type(self, asset_type: str) -> List[Asset]:
        """
        Obtém ativos por tipo.
        
        Args:
            asset_type: Tipo do ativo (equity, currency, etc.)
            
        Returns:
            Lista de Assets
        """
        results = self.assets_table.search(self.Asset.asset_type == asset_type.lower())
        return [Asset(**doc) for doc in results]
    
    def search_assets(self, query_dict: Dict[str, Any]) -> List[Asset]:
        """
        Busca ativos usando filtros customizados.
        
        Args:
            query_dict: Dicionário com filtros
            
        Returns:
            Lista de Assets que atendem aos critérios
        """
        query = self.Asset.noop()  # Query vazia
        
        for field, value in query_dict.items():
            if hasattr(self.Asset, field):
                query = query & (getattr(self.Asset, field) == value)
        
        results = self.assets_table.search(query)
        return [Asset(**doc) for doc in results]
    
    def update_asset_prices(self, ticker: str, price_data: Dict[str, Any]) -> bool:
        """
        Atualiza informações de preço de um ativo.
        
        Args:
            ticker: Símbolo do ticker
            price_data: Dados de preço (current_price, previous_close, etc.)
            
        Returns:
            True se atualizado com sucesso
        """
        ticker_upper = ticker.upper()
        existing = self.assets_table.search(self.Asset.ticker == ticker_upper)
        
        if existing:
            # Preparar dados de atualização
            update_data = {
                'updated_at': datetime.now().isoformat(),
                **price_data
            }
            
            # Atualizar yahoo_info também
            current_yahoo_info = existing[0].get('yahoo_info', {})
            current_yahoo_info.update(price_data)
            update_data['yahoo_info'] = current_yahoo_info
            
            self.assets_table.update(update_data, self.Asset.ticker == ticker_upper)
            return True
        
        return False
    
    def delete_asset(self, ticker: str) -> bool:
        """
        Remove um ativo do banco.
        
        Args:
            ticker: Símbolo do ticker
            
        Returns:
            True se removido com sucesso
        """
        ticker_upper = ticker.upper()
        removed = self.assets_table.remove(self.Asset.ticker == ticker_upper)
        return len(removed) > 0
    
    def upsert_asset(self, asset: Asset) -> tuple[str, bool]:
        """
        Insere ou atualiza um Asset usando ticker como chave única.
        
        Args:
            asset: Instância do Asset
            
        Returns:
            Tuple (ticker, is_new) onde is_new indica se foi inserção (True) ou atualização (False)
        """
        ticker = asset.ticker.upper()
        asset_dict = asset.to_dict()
        
        # Verificar se já existe
        existing = self.assets_table.search(self.Asset.ticker == ticker)
        
        if existing:
            # Atualizar registro existente
            self.assets_table.update(asset_dict, self.Asset.ticker == ticker)
            print(f"🔄 UPSERT [{ticker}] - Registro atualizado")
            return ticker, False
        else:
            # Inserir novo registro
            self.assets_table.insert(asset_dict)
            print(f"➕ UPSERT [{ticker}] - Novo registro inserido")
            return ticker, True
    
    def remove_duplicates(self) -> int:
        """
        Remove registros duplicados baseados no ticker.
        
        Returns:
            Número de duplicatas removidas
        """
        all_assets = self.assets_table.all()
        seen_tickers = set()
        duplicates_removed = 0
        
        for asset in all_assets:
            ticker = asset.get('ticker', '').upper()
            if ticker in seen_tickers:
                # Remover duplicata
                self.assets_table.remove(doc_ids=[asset.doc_id])
                duplicates_removed += 1
                print(f"🗑️  DUPLICATE REMOVED - Ticker {ticker} duplicado removido")
            else:
                seen_tickers.add(ticker)
        
        return duplicates_removed
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Obtém estatísticas do banco de dados.
        
        Returns:
            Dicionário com estatísticas
        """
        try:
            with open(self.db_path, 'r') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {
                'total_assets': 0,
                'by_exchange': {},
                'by_sector': {},
                'by_asset_type': {},
                'last_updated': None,
                'unique_tickers': 0
            }
        
        assets_data = data.get("assets", {})
        
        if not assets_data:
            return {
                'total_assets': 0,
                'by_exchange': {},
                'by_sector': {},
                'by_asset_type': {},
                'last_updated': None,
                'unique_tickers': 0
            }
        
        # Contar por bolsa
        by_exchange = {}
        by_sector = {}
        by_asset_type = {}
        
        for ticker_key, asset_data in assets_data.items():
            # Por bolsa
            exchange = asset_data.get('exchange', 'UNKNOWN')
            by_exchange[exchange] = by_exchange.get(exchange, 0) + 1
            
            # Por setor
            sector = asset_data.get('sector', 'Unknown')
            if sector and sector != 'Unknown':
                by_sector[sector] = by_sector.get(sector, 0) + 1
            
            # Por tipo
            asset_type = asset_data.get('asset_type', 'unknown')
            if asset_type and asset_type != 'unknown':
                by_asset_type[asset_type] = by_asset_type.get(asset_type, 0) + 1
        
        # Última atualização
        last_updated = max(
            (asset_data.get('updated_at', '') for asset_data in assets_data.values()),
            default=None
        )
        
        return {
            'total_assets': len(assets_data),
            'unique_tickers': len(assets_data),  # Por design, cada chave é única
            'by_exchange': by_exchange,
            'by_sector': by_sector,
            'by_asset_type': by_asset_type,
            'last_updated': last_updated
        }
    
    def backup_database(self, backup_path: str) -> bool:
        """
        Cria backup do banco de dados.
        
        Args:
            backup_path: Caminho para o arquivo de backup
            
        Returns:
            True se backup criado com sucesso
        """
        try:
            import shutil
            shutil.copy2(self.db_path, backup_path)
            return True
        except Exception:
            return False
    
    def close(self):
        """Fecha conexão com o banco de dados."""
        try:
            if hasattr(self, 'db') and self.db:
                # TinyDB com CachingMiddleware persiste automaticamente
                self.db.close()
                print(f"✅ DEBUG CLOSE - Banco TinyDB fechado: {self.db_path}")
        except Exception as e:
            print(f"⚠️  WARNING CLOSE - Erro ao fechar banco TinyDB: {e}")
    
    def __del__(self):
        """Destrutor para garantir fechamento do banco."""
        try:
            self.close()
        except Exception:
            # Suprimir erros no destrutor para evitar logs desnecessários
            pass


def migrate_from_sqlite_to_tinydb(sqlite_path: str, tinydb_dao: YahooAssetsDAO) -> int:
    """
    Migra dados do antigo asset_factory.db (SQLite) para TinyDB.
    
    Args:
        sqlite_path: Caminho para o banco SQLite antigo
        tinydb_dao: Instância do DAO TinyDB
        
    Returns:
        Número de registros migrados
    """
    import sqlite3
    
    try:
        conn = sqlite3.connect(sqlite_path)
        conn.row_factory = sqlite3.Row
        
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        migrated_count = 0
        
        # Buscar na tabela de ativos (se existir)
        for table in tables:
            table_name = table[0]
            if 'asset' in table_name.lower():
                cursor.execute(f"SELECT * FROM {table_name}")
                rows = cursor.fetchall()
                
                for row in rows:
                    try:
                        # Converter Row para dict
                        row_dict = dict(row)
                        
                        # Extrair informações básicas
                        ticker = row_dict.get('ticker', row_dict.get('symbol', ''))
                        if not ticker:
                            continue
                        
                        # Tentar extrair dados do Yahoo Finance se existir campo JSON
                        yahoo_info = {}
                        for field in ['yahoo_info', 'raw_info', 'metadata']:
                            if field in row_dict and row_dict[field]:
                                try:
                                    yahoo_info = json.loads(row_dict[field])
                                    break
                                except:
                                    continue
                        
                        # Se não há dados JSON, criar estrutura básica
                        if not yahoo_info:
                            yahoo_info = {
                                'ticker': ticker,
                                'long_name': row_dict.get('name', ticker),
                                'currency': row_dict.get('currency', 'BRL'),
                                'exchange': row_dict.get('exchange', 'UNKNOWN')
                            }
                        
                        # Salvar no TinyDB
                        tinydb_dao.save_asset_from_yahoo_data(ticker, yahoo_info)
                        migrated_count += 1
                        
                    except Exception as e:
                        print(f"Erro ao migrar registro {row_dict}: {e}")
                        continue
        
        conn.close()
        return migrated_count
        
    except Exception as e:
        print(f"Erro na migração: {e}")
        return 0
