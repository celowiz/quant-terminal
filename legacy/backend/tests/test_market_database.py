#!/usr/bin/env python3
"""
Teste completo do banco de dados de mercado.

Testa a funcionalidade de leitura, consulta e análise dos dados
de preços armazenados no banco SQLite, combinando listagem
de tabelas e leitura específica por ticker.
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


def test_database_connection():
    """Testa a conexão com o banco de dados."""
    print("🔗 Testando conexão com o banco de dados...")
    
    try:
        # Verificar se o arquivo existe
        if not os.path.exists(DB_PATH_DAILY_PRICES):
            print(f"❌ Arquivo do banco não encontrado: {DB_PATH_DAILY_PRICES}")
            return False
        
        # Testar conexão
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            
            if result and result[0] == 1:
                print(f"✅ Conexão estabelecida com sucesso")
                print(f"  📂 Banco: {DB_PATH_DAILY_PRICES}")
                
                # Verificar tamanho do arquivo
                file_size = os.path.getsize(DB_PATH_DAILY_PRICES)
                size_mb = file_size / (1024 * 1024)
                print(f"  📊 Tamanho: {size_mb:.2f} MB")
                
                return True
            else:
                print("❌ Falha na conexão - resposta inválida")
                return False
                
    except Exception as e:
        print(f"❌ Erro na conexão: {e}")
        return False


def test_list_tables():
    """Testa a listagem de todas as tabelas disponíveis."""
    print("\n📊 Listando todas as tabelas do banco...")
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Listar tabelas
            tables_df = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
                conn
            )
            
            if tables_df.empty:
                print("❌ Nenhuma tabela encontrada no banco")
                return [], False
            
            tables = tables_df['name'].tolist()
            print(f"✅ Encontradas {len(tables)} tabelas")
            
            # Contar registros por tabela
            print("\n📈 Análise de registros por tabela:")
            table_stats = []
            
            for table in tables:
                try:
                    count_df = pd.read_sql(f"SELECT COUNT(*) AS n FROM '{table}';", conn)
                    count = count_df['n'].iloc[0]
                    table_stats.append({'table': table, 'rows': int(count)})
                except Exception as e:
                    print(f"  ⚠️  Erro ao contar registros em {table}: {e}")
                    table_stats.append({'table': table, 'rows': 0})
            
            # Ordenar por número de registros
            table_stats = sorted(table_stats, key=lambda x: x['rows'], reverse=True)
            
            # Mostrar top 10
            print(f"\n🏆 Top 10 tabelas com mais registros:")
            for i, stat in enumerate(table_stats[:10], 1):
                print(f"  {i:2d}. {stat['table']:<15} : {stat['rows']:>10,} registros")
            
            # Mostrar bottom 5 (com dados)
            bottom_with_data = [s for s in table_stats if s['rows'] > 0][-5:]
            if bottom_with_data:
                print(f"\n📉 Tabelas com menos registros (mas com dados):")
                for stat in bottom_with_data:
                    print(f"     {stat['table']:<15} : {stat['rows']:>10,} registros")
            
            # Tabelas vazias
            empty_tables = [s for s in table_stats if s['rows'] == 0]
            if empty_tables:
                print(f"\n⚠️  {len(empty_tables)} tabelas vazias encontradas")
            
            return tables, True
            
    except Exception as e:
        print(f"❌ Erro ao listar tabelas: {e}")
        logger.exception("Erro detalhado:")
        return [], False


def test_table_structure(table_name: str):
    """Testa e analisa a estrutura de uma tabela específica."""
    print(f"\n🔍 Analisando estrutura da tabela: {table_name}")
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Obter informações da estrutura
            pragma_df = pd.read_sql(f"PRAGMA table_info('{table_name}');", conn)
            
            if pragma_df.empty:
                print(f"  ❌ Tabela '{table_name}' não encontrada")
                return False
            
            print(f"  📋 Estrutura da tabela ({len(pragma_df)} colunas):")
            
            for _, row in pragma_df.iterrows():
                col_name = row['name']
                col_type = row['type']
                is_nullable = "NOT NULL" if row['notnull'] else "NULL"
                is_pk = "🔑 PK" if row['pk'] else ""
                default_val = f"(default: {row['dflt_value']})" if pd.notna(row['dflt_value']) else ""
                
                print(f"    • {col_name:<12} {col_type:<8} {is_nullable:<8} {is_pk} {default_val}")
            
            # Verificar índices
            indices_df = pd.read_sql(f"PRAGMA index_list('{table_name}');", conn)
            if not indices_df.empty:
                print(f"  📇 Índices ({len(indices_df)}):")
                for _, idx in indices_df.iterrows():
                    unique_str = "UNIQUE" if idx['unique'] else "INDEX"
                    print(f"    • {idx['name']} ({unique_str})")
            
            return True
            
    except Exception as e:
        print(f"  ❌ Erro ao analisar tabela {table_name}: {e}")
        return False


def test_read_ticker_data(ticker: str):
    """Testa leitura detalhada de dados de um ticker específico."""
    print(f"\n📈 Testando leitura detalhada: {ticker}")
    
    # Tabela pode ser com ou sem .SA
    possible_tables = [ticker.upper(), ticker.upper().replace('.SA', '')]
    table_name = None
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Encontrar tabela correspondente
            for possible_table in possible_tables:
                exists_df = pd.read_sql(
                    "SELECT COUNT(1) AS n FROM sqlite_master WHERE type='table' AND name=?;",
                    conn,
                    params=(possible_table,),
                )
                
                if exists_df['n'].iloc[0] > 0:
                    table_name = possible_table
                    break
            
            if not table_name:
                print(f"  ⚠️  Tabela para '{ticker}' não encontrada")
                print(f"    Nomes testados: {possible_tables}")
                return False
            
            print(f"  📊 Lendo dados da tabela: {table_name}")
            
            # Ler dados completos
            df = pd.read_sql(f"SELECT * FROM '{table_name}' ORDER BY date;", conn)
            
            if df.empty:
                print(f"  ❌ Tabela {table_name} está vazia")
                return False
            
            print(f"  ✅ Dados carregados com sucesso!")
            print(f"    📈 Total de registros: {len(df):,}")
            print(f"    📋 Colunas: {list(df.columns)}")
            
            # Análise temporal
            if 'date' in df.columns:
                first_date = df['date'].iloc[0]
                last_date = df['date'].iloc[-1]
                print(f"    📅 Período: {first_date} até {last_date}")
                
                # Verificar frequência dos dados
                df_copy = df.copy()
                df_copy['date'] = pd.to_datetime(df_copy['date'])
                df_copy = df_copy.sort_values('date')
                
                time_diffs = df_copy['date'].diff().dropna()
                if not time_diffs.empty:
                    avg_interval = time_diffs.mean()
                    print(f"    ⏱️  Intervalo médio: {avg_interval}")
            
            # Análise de dados OHLCV
            price_columns = ['open', 'high', 'low', 'close', 'adj_close']
            volume_columns = ['volume']
            
            existing_price_cols = [col for col in price_columns if col in df.columns]
            existing_volume_cols = [col for col in volume_columns if col in df.columns]
            
            if existing_price_cols:
                print(f"\n  💰 Análise de preços:")
                for col in existing_price_cols:
                    min_price = df[col].min()
                    max_price = df[col].max()
                    avg_price = df[col].mean()
                    print(f"    • {col:<10}: Min={min_price:>8.2f} Max={max_price:>8.2f} Avg={avg_price:>8.2f}")
            
            if existing_volume_cols:
                print(f"\n  📊 Análise de volume:")
                for col in existing_volume_cols:
                    min_vol = df[col].min()
                    max_vol = df[col].max()
                    avg_vol = df[col].mean()
                    print(f"    • {col:<10}: Min={min_vol:>12,.0f} Max={max_vol:>12,.0f} Avg={avg_vol:>12,.0f}")
            
            # Amostra dos dados
            print(f"\n  📋 Últimos 3 registros:")
            for i, (_, row) in enumerate(df.tail(3).iterrows()):
                values = []
                for col in df.columns[:6]:  # Primeiras 6 colunas
                    value = row[col]
                    if isinstance(value, float):
                        values.append(f"{col}={value:.2f}")
                    else:
                        values.append(f"{col}={value}")
                print(f"    {i+1}. {' '.join(values)}")
            
            return True
            
    except Exception as e:
        print(f"  ❌ Erro ao ler dados de {ticker}: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_data_integrity():
    """Testa a integridade dos dados em várias tabelas."""
    print(f"\n🔍 Testando integridade dos dados...")
    
    try:
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            # Listar algumas tabelas para testar
            tables_df = pd.read_sql(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name LIMIT 5;",
                conn
            )
            
            if tables_df.empty:
                print("  ❌ Nenhuma tabela para testar")
                return False
            
            tables = tables_df['name'].tolist()
            issues_found = 0
            
            for table in tables:
                print(f"\n  🔍 Testando integridade: {table}")
                
                try:
                    df = pd.read_sql(f"SELECT * FROM '{table}' LIMIT 1000;", conn)
                    
                    if df.empty:
                        print(f"    ⚠️  Tabela vazia")
                        continue
                    
                    # Verificar valores nulos
                    null_counts = df.isnull().sum()
                    if null_counts.sum() > 0:
                        print(f"    ⚠️  Valores nulos encontrados:")
                        for col, count in null_counts[null_counts > 0].items():
                            print(f"      • {col}: {count}")
                        issues_found += 1
                    else:
                        print(f"    ✅ Sem valores nulos")
                    
                    # Verificar dados de preço
                    price_cols = ['open', 'high', 'low', 'close', 'adj_close']
                    existing_price_cols = [col for col in price_cols if col in df.columns]
                    
                    if existing_price_cols:
                        # Valores negativos
                        for col in existing_price_cols:
                            negative_count = (df[col] < 0).sum()
                            if negative_count > 0:
                                print(f"    ⚠️  {col}: {negative_count} valores negativos")
                                issues_found += 1
                        
                        # High >= Low
                        if 'high' in df.columns and 'low' in df.columns:
                            invalid_hl = (df['high'] < df['low']).sum()
                            if invalid_hl > 0:
                                print(f"    ⚠️  {invalid_hl} registros com high < low")
                                issues_found += 1
                            else:
                                print(f"    ✅ Relação high/low válida")
                        
                        # Open/Close dentro do range High/Low
                        if all(col in df.columns for col in ['open', 'close', 'high', 'low']):
                            invalid_open = ((df['open'] > df['high']) | (df['open'] < df['low'])).sum()
                            invalid_close = ((df['close'] > df['high']) | (df['close'] < df['low'])).sum()
                            
                            if invalid_open > 0:
                                print(f"    ⚠️  {invalid_open} registros com open fora do range high/low")
                                issues_found += 1
                            if invalid_close > 0:
                                print(f"    ⚠️  {invalid_close} registros com close fora do range high/low")
                                issues_found += 1
                    
                except Exception as e:
                    print(f"    ❌ Erro ao testar {table}: {e}")
                    issues_found += 1
            
            print(f"\n  📊 Resumo da integridade:")
            print(f"    • Tabelas testadas: {len(tables)}")
            print(f"    • Problemas encontrados: {issues_found}")
            
            if issues_found == 0:
                print(f"    🎉 Todos os testes de integridade passaram!")
                return True
            else:
                print(f"    ⚠️  Alguns problemas de integridade encontrados")
                return False
            
    except Exception as e:
        print(f"  ❌ Erro no teste de integridade: {e}")
        logger.exception("Erro detalhado:")
        return False


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes completos do banco de dados de mercado")
    print("=" * 70)
    
    success_count = 0
    total_tests = 6
    
    # Teste 1: Conexão
    if test_database_connection():
        success_count += 1
    
    # Teste 2: Listar tabelas
    tables, list_success = test_list_tables()
    if list_success:
        success_count += 1
    
    if not tables:
        print("\n❌ Não é possível continuar: nenhuma tabela encontrada")
        return
    
    # Teste 3: Estrutura de tabelas (primeira tabela)
    if tables and test_table_structure(tables[0]):
        success_count += 1
    
    # Teste 4: Leitura específica de tickers
    test_tickers = ['PETR4', 'VALE3', 'ITUB4', 'BVSP']
    ticker_success_count = 0
    
    for ticker in test_tickers:
        if test_read_ticker_data(ticker):
            ticker_success_count += 1
    
    if ticker_success_count > 0:
        success_count += 1
        print(f"\n📈 Resultado da leitura de tickers: {ticker_success_count}/{len(test_tickers)} bem-sucedidos")
    
    # Teste 5: Integridade dos dados
    if test_data_integrity():
        success_count += 1
    
    # Teste 6: Performance básica (simulado)
    print(f"\n⚡ Testando performance básica...")
    try:
        import time
        
        with sqlite3.connect(DB_PATH_DAILY_PRICES) as conn:
            start_time = time.time()
            
            # Consulta simples de performance
            count_df = pd.read_sql(
                "SELECT COUNT(*) as total FROM sqlite_master WHERE type='table';",
                conn
            )
            
            elapsed = time.time() - start_time
            table_count = count_df['total'].iloc[0]
            
            print(f"  📊 Consulta de contagem de tabelas: {elapsed:.3f}s ({table_count} tabelas)")
            
            if elapsed < 1.0:  # Menos de 1 segundo é bom
                print("  ✅ Performance adequada")
                success_count += 1
            else:
                print("  ⚠️  Performance pode ser melhorada")
        
    except Exception as e:
        print(f"  ❌ Erro no teste de performance: {e}")
    
    # Resumo final
    print("\n" + "=" * 70)
    print(f"📊 Resumo completo dos testes:")
    print(f"  • Testes executados: {total_tests}")
    print(f"  • Testes bem-sucedidos: {success_count}")
    print(f"  • Taxa de sucesso: {success_count/total_tests*100:.1f}%")
    print(f"  • Tabelas encontradas: {len(tables) if tables else 0}")
    
    if success_count == total_tests:
        print("🎉 Todos os testes foram bem-sucedidos!")
    elif success_count >= total_tests * 0.7:
        print("✅ Maioria dos testes bem-sucedida!")
    else:
        print("⚠️  Vários testes falharam. Verifique a integridade do banco de dados.")


if __name__ == "__main__":
    main()
