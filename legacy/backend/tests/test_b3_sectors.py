#!/usr/bin/env python3
"""
Teste do extrator de setores da B3.

Testa a funcionalidade de extração e validação dos dados
de classificação setorial da B3.
"""

import sys
import os
from pathlib import Path
import logging
import pandas as pd

# Configurar paths
project_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_path))

from backend.data_pipeline.extract.b3_sectors import get_b3_sectors, validar_url_b3

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


def test_url_validation():
    """Testa a validação da URL do arquivo da B3."""
    print("🔗 Testando validação da URL da B3...")
    
    try:
        url = "https://www.b3.com.br/data/files/57/E6/AA/A1/68C7781064456178AC094EA8/ClassifSetorial.zip"
        is_valid = validar_url_b3(url)
        
        if is_valid:
            print("✅ URL da B3 válida e acessível")
            return True
        else:
            print("❌ URL da B3 inválida ou inacessível")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao validar URL: {e}")
        return False


def test_b3_sectors_extraction():
    """Testa a extração dos dados de setores da B3."""
    print("📊 Testando extração de setores da B3...")
    
    try:
        df = get_b3_sectors()
        
        # Verificar se o DataFrame não está vazio
        if df.empty:
            print("❌ DataFrame vazio retornado")
            return False
        
        # Verificar colunas esperadas
        expected_columns = ['Ticker', 'Setor', 'Subsetor', 'Segmento']
        if list(df.columns) != expected_columns:
            print(f"❌ Colunas incorretas. Esperado: {expected_columns}, Obtido: {list(df.columns)}")
            return False
        
        print(f"✅ Dados extraídos com sucesso!")
        print(f"  📈 Total de tickers: {len(df)}")
        print(f"  📋 Colunas: {list(df.columns)}")
        print(f"  🏢 Setores únicos: {df['Setor'].nunique()}")
        print(f"  🏭 Subsetores únicos: {df['Subsetor'].nunique()}")
        print(f"  🎯 Segmentos únicos: {df['Segmento'].nunique()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na extração: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_data_quality():
    """Testa a qualidade dos dados extraídos."""
    print("\n🔍 Testando qualidade dos dados...")
    
    try:
        df = get_b3_sectors()
        
        if df.empty:
            print("❌ Não é possível testar qualidade: DataFrame vazio")
            return False
        
        # Verificar valores nulos
        null_counts = df.isnull().sum()
        total_nulls = null_counts.sum()
        
        if total_nulls > 0:
            print(f"⚠️  Encontrados {total_nulls} valores nulos:")
            for col, count in null_counts[null_counts > 0].items():
                print(f"    • {col}: {count} nulos")
        else:
            print("✅ Sem valores nulos")
        
        # Verificar duplicatas por ticker
        duplicated_tickers = df['Ticker'].duplicated().sum()
        if duplicated_tickers > 0:
            print(f"⚠️  {duplicated_tickers} tickers duplicados encontrados")
        else:
            print("✅ Sem tickers duplicados")
        
        # Verificar formato dos tickers
        invalid_tickers = df[~df['Ticker'].str.match(r'^[A-Z0-9]{4,6}$', na=False)]
        if not invalid_tickers.empty:
            print(f"⚠️  {len(invalid_tickers)} tickers com formato inválido:")
            for ticker in invalid_tickers['Ticker'].head(5):
                print(f"    • {ticker}")
        else:
            print("✅ Formato dos tickers válido")
        
        # Mostrar amostra dos dados
        print(f"\n📋 Amostra dos dados (primeiros 5 registros):")
        for i, (_, row) in enumerate(df.head(5).iterrows()):
            print(f"  {i+1}. {row['Ticker']} - {row['Setor']} > {row['Subsetor']} > {row['Segmento']}")
        
        # Estatísticas por setor
        print(f"\n📊 Distribuição por setor (top 5):")
        sector_counts = df['Setor'].value_counts().head(5)
        for setor, count in sector_counts.items():
            print(f"  • {setor}: {count} tickers")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na validação de qualidade: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_specific_tickers():
    """Testa a presença de tickers específicos conhecidos."""
    print("\n🎯 Testando presença de tickers conhecidos...")
    
    try:
        df = get_b3_sectors()
        
        if df.empty:
            print("❌ Não é possível testar tickers: DataFrame vazio")
            return False
        
        # Tickers conhecidos que devem estar presentes
        known_tickers = ['PETR', 'VALE', 'ITUB', 'BBDC', 'ABEV']
        
        found_count = 0
        for ticker in known_tickers:
            ticker_data = df[df['Ticker'] == ticker]
            if not ticker_data.empty:
                sector_info = ticker_data.iloc[0]
                print(f"  ✅ {ticker}: {sector_info['Setor']} > {sector_info['Subsetor']}")
                found_count += 1
            else:
                print(f"  ⚠️  {ticker}: não encontrado")
        
        print(f"\n📈 Resultado: {found_count}/{len(known_tickers)} tickers conhecidos encontrados")
        
        if found_count >= len(known_tickers) * 0.8:  # 80% dos tickers conhecidos
            print("✅ Maioria dos tickers conhecidos encontrada")
            return True
        else:
            print("⚠️  Poucos tickers conhecidos encontrados")
            return False
        
    except Exception as e:
        print(f"❌ Erro ao testar tickers específicos: {e}")
        logger.exception("Erro detalhado:")
        return False


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes do extrator de setores B3")
    print("=" * 60)
    
    success_count = 0
    total_tests = 4
    
    # Teste 1: Validação da URL
    if test_url_validation():
        success_count += 1
    print()
    
    # Teste 2: Extração dos dados
    if test_b3_sectors_extraction():
        success_count += 1
    
    # Teste 3: Qualidade dos dados
    if test_data_quality():
        success_count += 1
    
    # Teste 4: Tickers específicos
    if test_specific_tickers():
        success_count += 1
    
    # Resumo
    print("\n" + "=" * 60)
    print(f"📊 Resumo dos testes:")
    print(f"  • Testes executados: {total_tests}")
    print(f"  • Testes bem-sucedidos: {success_count}")
    print(f"  • Taxa de sucesso: {success_count/total_tests*100:.1f}%")
    
    if success_count == total_tests:
        print("🎉 Todos os testes foram bem-sucedidos!")
    elif success_count >= total_tests * 0.75:
        print("✅ Maioria dos testes bem-sucedida!")
    else:
        print("⚠️  Vários testes falharam. Verifique a conectividade e os dados.")


if __name__ == "__main__":
    main()
