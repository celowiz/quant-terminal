#!/usr/bin/env python3
"""
Teste de leitura do banco de dados de mercado.

Testa a funcionalidade de leitura e consulta dos dados
de preços armazenados no banco SQLite.
"""

import sqlite3
import pandas as pd
import sys
import os
from pathlib import Path
import logging

# Configurar paths
project_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_path))

from backend.config import DB_PATH_DAILY_PRICES

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


def get_available_tables():
    """Lista todas as tabelas disponíveis no banco."""
    print("📊 Listando tabelas disponíveis no banco de dados...")
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            tables_df = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
                conn
            )
            
            if tables_df.empty:
                print("⚠️  Nenhuma tabela encontrada no banco")
                return []
            
            tables = tables_df['name'].tolist()
            print(f"✅ Encontradas {len(tables)} tabelas:")
            
            for i, table in enumerate(tables, 1):
                print(f"  {i}. {table}")
            
            return tables
            
    except Exception as e:
        print(f"❌ Erro ao listar tabelas: {e}")
        return []


def test_table_structure(table_name: str):
    """Testa a estrutura de uma tabela específica."""
    print(f"\n🔍 Analisando estrutura da tabela: {table_name}")
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Obter informações da tabela
            pragma_df = pd.read_sql(f"PRAGMA table_info('{table_name}');", conn)
            
            if pragma_df.empty:
                print(f"⚠️  Tabela '{table_name}' não encontrada")
                return False
            
            print(f"  📋 Colunas ({len(pragma_df)}):")
            for _, row in pragma_df.iterrows():
                col_name = row['name']
                col_type = row['type']
                is_nullable = "NOT NULL" if row['notnull'] else "NULL"
                is_pk = "PK" if row['pk'] else ""
                
                print(f"    • {col_name} ({col_type}) {is_nullable} {is_pk}".strip())
            
            # Contar registros
            count_df = pd.read_sql(f"SELECT COUNT(*) as total FROM '{table_name}';", conn)
            total_records = count_df['total'].iloc[0]
            
            print(f"  📈 Total de registros: {total_records:,}")
            
            return True
            
    except Exception as e:
        print(f"  ❌ Erro ao analisar tabela {table_name}: {e}")
        return False


def test_read_market_data(ticker: str):
    """Testa leitura de dados de mercado de um ticker específico."""
    print(f"\n📈 Testando leitura de dados: {ticker}")
    
    table_name = ticker.upper()
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Verificar se tabela existe
            exists_df = pd.read_sql(
                "SELECT COUNT(1) AS n FROM sqlite_master WHERE type='table' AND name=?;",
                conn,
                params=(table_name,),
            )
            
            if exists_df['n'].iloc[0] == 0:
                print(f"  ⚠️  Tabela '{table_name}' não encontrada")
                return False
            
            # Ler dados
            print(f"  📊 Lendo dados da tabela {table_name}...")
            df = pd.read_sql(f"SELECT * FROM '{table_name}' ORDER BY time;", conn)
            
            if df.empty:
                print(f"  ⚠️  Tabela {table_name} está vazia")
                return False
            
            print(f"  ✅ Dados carregados com sucesso!")
            print(f"    • Registros: {len(df):,}")
            print(f"    • Colunas: {list(df.columns)}")
            
            # Mostrar estatísticas básicas
            if 'time' in df.columns:
                first_date = df['time'].iloc[0]
                last_date = df['time'].iloc[-1]
                print(f"    • Período: {first_date} até {last_date}")
            
            # Mostrar primeiros registros
            print(f"\n  📋 Primeiros 3 registros:")
            for i, (_, row) in enumerate(df.head(3).iterrows()):
                print(f"    {i+1}. ", end="")
                for col in df.columns[:5]:  # Mostrar só primeiras 5 colunas
                    value = row[col]
                    if isinstance(value, float):
                        print(f"{col}={value:.2f} ", end="")
                    else:
                        print(f"{col}={value} ", end="")
                print()
            
            # Verificar integridade dos dados
            print(f"\n  🔍 Verificação de integridade:")
            
            # Verificar valores nulos
            null_counts = df.isnull().sum()
            if null_counts.sum() > 0:
                print(f"    ⚠️  Valores nulos encontrados:")
                for col, count in null_counts[null_counts > 0].items():
                    print(f"      • {col}: {count} nulos")
            else:
                print(f"    ✅ Sem valores nulos")
            
            # Verificar dados de preço (se existirem)
            price_columns = ['open', 'high', 'low', 'close', 'adj_close']
            existing_price_cols = [col for col in price_columns if col in df.columns]
            
            if existing_price_cols:
                for col in existing_price_cols:
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        print(f"    ⚠️  {col}: {negative_count} valores negativos")
                
                # Verificar se high >= low
                if 'high' in df.columns and 'low' in df.columns:
                    invalid_hl = (df['high'] < df['low']).sum()
                    if invalid_hl > 0:
                        print(f"    ⚠️  {invalid_hl} registros com high < low")
                    else:
                        print(f"    ✅ Relação high/low válida")
            
            return True
            
    except Exception as e:
        print(f"  ❌ Erro ao ler dados de {ticker}: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_database_performance():
    """Testa performance básica do banco."""
    print(f"\n⚡ Testando performance do banco...")
    
    try:
        import time
        
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Teste 1: Listar tabelas
            start_time = time.time()
            tables_df = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table';",
                conn
            )
            elapsed = time.time() - start_time
            print(f"  📊 Listar tabelas: {elapsed:.3f}s ({len(tables_df)} tabelas)")
            
            # Teste 2: Contar registros em todas as tabelas
            if not tables_df.empty:
                start_time = time.time()
                total_records = 0
                
                for table in tables_df['name'].head(5):  # Testar só primeiras 5
                    try:
                        count_df = pd.read_sql(f"SELECT COUNT(*) as total FROM '{table}';", conn)
                        total_records += count_df['total'].iloc[0]
                    except:
                        pass
                
                elapsed = time.time() - start_time
                print(f"  🔢 Contar registros: {elapsed:.3f}s ({total_records:,} registros)")
            
            return True
            
    except Exception as e:
        print(f"  ❌ Erro no teste de performance: {e}")
        return False


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes do banco de dados de mercado")
    print("=" * 70)
    
    print(f"📂 Banco de dados: {DB_PATH_DAILY_PRICES}")
    
    # Verificar se banco existe
    if not os.path.exists(DB_PATH_DAILY_PRICES):
        print(f"❌ Banco de dados não encontrado: {DB_PATH_DAILY_PRICES}")
        return
    
    # Teste 1: Listar tabelas
    tables = get_available_tables()
    
    if not tables:
        print("❌ Nenhuma tabela encontrada. Não é possível continuar os testes.")
        return
    
    # Teste 2: Estrutura das tabelas (primeiras 3)
    print(f"\n🔍 Analisando estrutura das tabelas...")
    for table in tables[:3]:
        test_table_structure(table)
    
    # Teste 3: Leitura de dados (ticker padrão)
    test_tickers = ['BVSP', 'PETR4', 'VALE3']
    success_count = 0
    
    for ticker in test_tickers:
        if ticker.upper() in [t.upper() for t in tables]:
            if test_read_market_data(ticker):
                success_count += 1
        else:
            print(f"\n📈 Ticker {ticker} não encontrado nas tabelas")
    
    # Teste 4: Performance
    test_database_performance()
    
    # Resumo
    print(f"\n" + "=" * 70)
    print(f"📊 Resumo dos testes:")
    print(f"  • Tabelas encontradas: {len(tables)}")
    print(f"  • Tickers testados com sucesso: {success_count}/{len(test_tickers)}")
    
    if success_count > 0:
        print(f"🎉 Testes concluídos com sucesso!")
    else:
        print(f"⚠️  Alguns testes falharam. Verifique os dados do banco.")


if __name__ == "__main__":
    main()