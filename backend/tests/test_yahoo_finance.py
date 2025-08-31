#!/usr/bin/env python3
"""
Teste do provedor Yahoo Finance.

Testa a funcionalidade de coleta de dados do Yahoo Finance
usando a nova arquitetura de data providers.
"""

import sys
import os
from pathlib import Path
import logging

# Configurar paths
project_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_path))

from backend.data_providers.yahoo_provider import YahooFinanceProvider
from backend.data_pipeline.extract.yahoo_finance import get_yahoo_data

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


def test_yahoo_provider_connection():
    """Testa conexão com Yahoo Finance."""
    print("🔗 Testando conexão Yahoo Finance Provider...")
    
    try:
        provider = YahooFinanceProvider()
        connected = provider.connect()
        
        if connected:
            print("✅ Conexão estabelecida com sucesso")
            return True
        else:
            print("❌ Falha na conexão")
            return False
    except Exception as e:
        print(f"❌ Erro na conexão: {e}")
        return False


def test_yahoo_data_extraction():
    """Testa extração de dados históricos."""
    print("📊 Testando extração de dados históricos...")
    
    test_tickers = ['AAPL', 'PETR4.SA', '^BVSP']
    
    for ticker in test_tickers:
        try:
            print(f"  📈 Testando ticker: {ticker}")
            
            df = get_yahoo_data(ticker)
            
            # Verificar colunas esperadas
            expected_columns = {'time', 'open', 'high', 'low', 'close', 'adj_close', 'volume'}
            if not expected_columns.issubset(df.columns):
                print(f"    ❌ Colunas incorretas. Esperado: {expected_columns}, Obtido: {set(df.columns)}")
                continue
            
            # Verificar se não está vazio
            if df.empty:
                print(f"    ⚠️  DataFrame vazio para {ticker}")
                continue
            
            # Verificar tipos de dados
            if df.dtypes['time'] != 'object':
                print(f"    ⚠️  Tipo da coluna 'time' incorreto: {df.dtypes['time']}")
            
            print(f"    ✅ Sucesso! {len(df)} registros coletados")
            print(f"    📅 Período: {df['time'].iloc[0]} até {df['time'].iloc[-1]}")
            
        except Exception as e:
            print(f"    ❌ Erro ao coletar {ticker}: {e}")


def test_yahoo_asset_info():
    """Testa obtenção de informações do ativo."""
    print("📋 Testando obtenção de informações do ativo...")
    
    try:
        provider = YahooFinanceProvider()
        test_ticker = 'TSLA'
        
        info = provider.get_asset_info(test_ticker)
        
        print(f"  📊 Informações de {test_ticker}:")
        print(f"    Nome: {info.get('long_name', 'N/A')}")
        print(f"    Moeda: {info.get('currency', 'N/A')}")
        print(f"    Bolsa: {info.get('exchange', 'N/A')}")
        print(f"    Tipo: {info.get('asset_type', 'N/A')}")
        print(f"    Todas Infos: {info}")
        
        if info.get('sector'):
            print(f"    Setor: {info['sector']}")
        if info.get('market_cap'):
            print(f"    Market Cap: {info['market_cap']:,}")
        
        print("  ✅ Informações obtidas com sucesso")
        
    except Exception as e:
        print(f"  ❌ Erro ao obter informações: {e}")


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes do Yahoo Finance")
    print("=" * 60)
    
    # Teste 1: Conexão
    test_yahoo_provider_connection()
    print()
    
    # Teste 2: Extração de dados
    test_yahoo_data_extraction()
    print()
    
    # Teste 3: Informações do ativo
    test_yahoo_asset_info()
    print()
    
    print("✅ Testes concluídos")


if __name__ == "__main__":
    main()
