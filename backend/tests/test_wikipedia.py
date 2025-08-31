#!/usr/bin/env python3
"""
Teste do extrator de tickers da Wikipedia.

Testa a funcionalidade de coleta de tickers S&P 500
da página da Wikipedia.
"""

import sys
import os
from pathlib import Path
import logging

# Configurar paths
project_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_path))

from backend.data_pipeline.extract.wikipedia_tickers import get_tickers_from_wikipedia

# Configurar logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)


def test_wikipedia_extraction():
    """Testa extração de tickers da Wikipedia."""
    print("🔍 Testando extração de tickers S&P 500 da Wikipedia...")
    print("=" * 60)
    
    try:
        print("📡 Fazendo requisição para Wikipedia...")
        result = get_tickers_from_wikipedia()
        
        if not result:
            print("⚠️  Lista vazia retornada")
            return False
        
        print(f"✅ Sucesso! Coletados {len(result)} tickers")
        
        # Verificar estrutura dos dados
        if isinstance(result, list) and len(result) > 0:
            first_item = result[0]
            
            if isinstance(first_item, dict):
                print(f"\n📈 Campos disponíveis: {list(first_item.keys())}")
                
                # Mostrar exemplos
                print("\n📊 Primeiros 5 tickers:")
                for i, ticker_data in enumerate(result[:5], 1):
                    if isinstance(ticker_data, dict):
                        ticker = ticker_data.get('Symbol', ticker_data.get('ticker', 'N/A'))
                        company = ticker_data.get('Security', ticker_data.get('name', 'N/A'))
                        sector = ticker_data.get('GICS Sector', ticker_data.get('sector', 'N/A'))
                        
                        print(f"  {i}. {ticker} - {company}")
                        print(f"     Setor: {sector}")
                    else:
                        print(f"  {i}. {ticker_data}")
            else:
                # Lista simples de strings
                print("\n📊 Primeiros 5 tickers:")
                for i, ticker in enumerate(result[:5], 1):
                    print(f"  {i}. {ticker}")
        
        # Verificações de qualidade
        print(f"\n📈 Análise de qualidade:")
        print(f"  • Total de registros: {len(result)}")
        
        if isinstance(result[0], dict):
            # Verificar campos obrigatórios
            required_fields = ['Symbol']
            missing_fields = []
            
            for field in required_fields:
                if field not in result[0]:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"  ⚠️  Campos faltando: {missing_fields}")
            else:
                print(f"  ✅ Todos os campos obrigatórios presentes")
        
        # Verificar se temos um número razoável de tickers S&P 500
        if len(result) >= 400:  # S&P 500 tem ~500 empresas
            print(f"  ✅ Quantidade esperada de tickers (≥400)")
        else:
            print(f"  ⚠️  Quantidade baixa de tickers ({len(result)} < 400)")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na extração: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_data_consistency():
    """Testa consistência dos dados extraídos."""
    print("\n🔍 Testando consistência dos dados...")
    
    try:
        result = get_tickers_from_wikipedia()
        
        if not result:
            print("⚠️  Sem dados para testar consistência")
            return False
        
        # Verificar duplicatas
        if isinstance(result[0], dict):
            symbols = [item.get('Symbol', '') for item in result]
        else:
            symbols = result
        
        unique_symbols = set(symbols)
        
        if len(symbols) == len(unique_symbols):
            print("  ✅ Sem duplicatas encontradas")
        else:
            duplicates = len(symbols) - len(unique_symbols)
            print(f"  ⚠️  {duplicates} duplicatas encontradas")
        
        # Verificar formato dos tickers
        invalid_tickers = []
        for symbol in symbols[:10]:  # Testar primeiros 10
            if not isinstance(symbol, str) or len(symbol) == 0:
                invalid_tickers.append(symbol)
            elif not symbol.replace('.', '').replace('-', '').isalnum():
                invalid_tickers.append(symbol)
        
        if not invalid_tickers:
            print("  ✅ Formato dos tickers válido")
        else:
            print(f"  ⚠️  Tickers com formato inválido: {invalid_tickers}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Erro no teste de consistência: {e}")
        return False


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes do extrator Wikipedia")
    print("=" * 60)
    
    # Teste 1: Extração básica
    success1 = test_wikipedia_extraction()
    
    # Teste 2: Consistência dos dados
    success2 = test_data_consistency()
    
    print("\n" + "=" * 60)
    
    if success1 and success2:
        print("🎉 Todos os testes passaram!")
    else:
        print("⚠️  Alguns testes falharam. Verifique os detalhes acima.")


if __name__ == "__main__":
    main()
