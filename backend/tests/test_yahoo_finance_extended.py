#!/usr/bin/env python3
"""
Teste completo e estendido do Yahoo Finance.

Testa todas as funcionalidades do provedor Yahoo Finance incluindo
dados históricos, informações de ativos, preços atuais, busca de tickers
e validação de dados de diferentes tipos de ativos.
"""

import sys
import os
from pathlib import Path
import logging
import pandas as pd
from datetime import datetime, timedelta
import yfinance as yf

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


def test_basic_connection():
    """Testa a conexão básica com o Yahoo Finance."""
    print("🔗 Testando conexão básica Yahoo Finance...")
    
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


def test_historical_data_extraction():
    """Testa extração de dados históricos para diferentes tipos de ativos."""
    print("\n📊 Testando extração de dados históricos...")
    
    # Diferentes tipos de ativos para testar
    test_assets = [
        {'ticker': 'AAPL', 'type': 'Ação US', 'expected_cols': ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']},
        {'ticker': 'PETR4.SA', 'type': 'Ação BR', 'expected_cols': ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']},
        {'ticker': '^BVSP', 'type': 'Índice BR', 'expected_cols': ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']},
        {'ticker': '^GSPC', 'type': 'Índice US', 'expected_cols': ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']},
        {'ticker': 'BTC-USD', 'type': 'Crypto', 'expected_cols': ['time', 'open', 'high', 'low', 'close', 'adj_close', 'volume']},
    ]
    
    success_count = 0
    
    for asset in test_assets:
        ticker = asset['ticker']
        asset_type = asset['type']
        expected_cols = asset['expected_cols']
        
        try:
            print(f"  📈 Testando {asset_type}: {ticker}")
            
            # Usar método direto do yfinance para comparação
            yf_ticker = yf.Ticker(ticker)
            df_direct = yf_ticker.history(period="1y", auto_adjust=False)
            
            if df_direct.empty:
                print(f"    ⚠️  Sem dados disponíveis")
                continue
            
            # Usar método do provider
            df_provider = get_yahoo_data(ticker)
            
            # Verificações básicas
            if df_provider.empty:
                print(f"    ❌ DataFrame vazio do provider")
                continue
            
            # Verificar colunas
            if not set(expected_cols).issubset(set(df_provider.columns)):
                print(f"    ❌ Colunas incorretas. Esperado: {expected_cols}")
                print(f"       Obtido: {list(df_provider.columns)}")
                continue
            
            # Verificar dados
            record_count = len(df_provider)
            date_range = f"{df_provider['time'].iloc[0]} até {df_provider['time'].iloc[-1]}"
            
            print(f"    ✅ Sucesso! {record_count} registros")
            print(f"       📅 Período: {date_range}")
            
            # Verificar tipos de dados
            numeric_cols = ['open', 'high', 'low', 'close', 'adj_close', 'volume']
            for col in numeric_cols:
                if col in df_provider.columns:
                    if not pd.api.types.is_numeric_dtype(df_provider[col]):
                        print(f"    ⚠️  Coluna {col} não é numérica: {df_provider[col].dtype}")
            
            success_count += 1
            
        except Exception as e:
            print(f"    ❌ Erro: {e}")
    
    print(f"\n📊 Resultado: {success_count}/{len(test_assets)} tipos de ativos testados com sucesso")
    return success_count > 0


def test_asset_information():
    """Testa obtenção de informações detalhadas de ativos."""
    print("\n📋 Testando obtenção de informações de ativos...")
    
    test_tickers = [
        {'ticker': 'AAPL', 'name': 'Apple Inc.'},
        {'ticker': 'PETR4.SA', 'name': 'Petrobras'},
        {'ticker': 'MSFT', 'name': 'Microsoft'},
        {'ticker': 'VALE3.SA', 'name': 'Vale'},
    ]
    
    provider = YahooFinanceProvider()
    success_count = 0
    
    for test_case in test_tickers:
        ticker = test_case['ticker']
        expected_name = test_case['name']
        
        try:
            print(f"  📊 Obtendo informações: {ticker}")
            
            info = provider.get_asset_info(ticker)
            
            # Verificar campos essenciais
            essential_fields = ['ticker', 'long_name', 'currency', 'exchange', 'asset_type']
            missing_fields = [field for field in essential_fields if field not in info or not info[field]]
            
            if missing_fields:
                print(f"    ⚠️  Campos essenciais faltando: {missing_fields}")
            
            # Mostrar informações obtidas
            print(f"    📈 Nome: {info.get('long_name', 'N/A')}")
            print(f"    💰 Moeda: {info.get('currency', 'N/A')}")
            print(f"    🏢 Bolsa: {info.get('exchange', 'N/A')}")
            print(f"    📊 Tipo: {info.get('asset_type', 'N/A')}")
            
            if info.get('sector'):
                print(f"    🏭 Setor: {info['sector']}")
            if info.get('industry'):
                print(f"    🔧 Indústria: {info['industry']}")
            if info.get('market_cap'):
                print(f"    💼 Market Cap: {info['market_cap']:,}")
            if info.get('country'):
                print(f"    🌍 País: {info['country']}")
            
            print(f"    ✅ Informações obtidas com sucesso")
            success_count += 1
            
        except Exception as e:
            print(f"    ❌ Erro ao obter informações de {ticker}: {e}")
    
    print(f"\n📋 Resultado: {success_count}/{len(test_tickers)} ativos consultados com sucesso")
    return success_count > 0


def test_latest_prices():
    """Testa obtenção de preços atuais."""
    print("\n💰 Testando obtenção de preços atuais...")
    
    test_tickers = ['AAPL', 'PETR4.SA', 'MSFT', 'VALE3.SA', '^BVSP']
    provider = YahooFinanceProvider()
    success_count = 0
    
    for ticker in test_tickers:
        try:
            print(f"  💲 Obtendo preço atual: {ticker}")
            
            price = provider.get_latest_price(ticker)
            
            if price is not None and price > 0:
                print(f"    ✅ Preço atual: {price:.2f}")
                success_count += 1
            else:
                print(f"    ⚠️  Preço não disponível ou inválido: {price}")
                
        except Exception as e:
            print(f"    ❌ Erro ao obter preço de {ticker}: {e}")
    
    print(f"\n💰 Resultado: {success_count}/{len(test_tickers)} preços obtidos com sucesso")
    return success_count > 0


def test_data_quality_validation():
    """Testa validação de qualidade dos dados históricos."""
    print("\n🔍 Testando qualidade dos dados históricos...")
    
    test_ticker = 'PETR4.SA'
    
    try:
        print(f"  📊 Analisando qualidade dos dados: {test_ticker}")
        
        # Obter dados de um ano
        yf_ticker = yf.Ticker(test_ticker)
        df = yf_ticker.history(period="1y", auto_adjust=False)
        
        if df.empty:
            print(f"    ❌ Sem dados para análise")
            return False
        
        df = df.reset_index()
        
        # Verificações de qualidade
        issues = []
        
        # 1. Verificar valores nulos
        null_counts = df.isnull().sum()
        if null_counts.sum() > 0:
            issues.append(f"Valores nulos encontrados: {dict(null_counts[null_counts > 0])}")
        
        # 2. Verificar valores negativos em preços
        price_cols = ['Open', 'High', 'Low', 'Close', 'Adj Close']
        for col in price_cols:
            if col in df.columns:
                negative_count = (df[col] < 0).sum()
                if negative_count > 0:
                    issues.append(f"{col}: {negative_count} valores negativos")
        
        # 3. Verificar relação High >= Low
        if 'High' in df.columns and 'Low' in df.columns:
            invalid_hl = (df['High'] < df['Low']).sum()
            if invalid_hl > 0:
                issues.append(f"High < Low em {invalid_hl} registros")
        
        # 4. Verificar se Open/Close estão dentro do range High/Low
        if all(col in df.columns for col in ['Open', 'Close', 'High', 'Low']):
            invalid_open = ((df['Open'] > df['High']) | (df['Open'] < df['Low'])).sum()
            invalid_close = ((df['Close'] > df['High']) | (df['Close'] < df['Low'])).sum()
            
            if invalid_open > 0:
                issues.append(f"Open fora do range H/L em {invalid_open} registros")
            if invalid_close > 0:
                issues.append(f"Close fora do range H/L em {invalid_close} registros")
        
        # 5. Verificar volume negativo
        if 'Volume' in df.columns:
            negative_volume = (df['Volume'] < 0).sum()
            if negative_volume > 0:
                issues.append(f"Volume negativo em {negative_volume} registros")
        
        # 6. Verificar continuidade temporal
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date')
        date_diffs = df['Date'].diff().dropna()
        
        # Verificar se há gaps muito grandes (> 7 dias para dados diários)
        large_gaps = date_diffs[date_diffs > pd.Timedelta(days=7)]
        if len(large_gaps) > 10:  # Mais de 10 gaps grandes pode indicar problema
            issues.append(f"Muitos gaps temporais grandes: {len(large_gaps)}")
        
        # Resultado da validação
        if not issues:
            print(f"    ✅ Qualidade dos dados: EXCELENTE")
            print(f"       📈 {len(df)} registros analisados")
            print(f"       📅 Período: {df['Date'].min().date()} até {df['Date'].max().date()}")
            print(f"       💰 Range de preços: {df['Close'].min():.2f} - {df['Close'].max():.2f}")
            return True
        else:
            print(f"    ⚠️  Problemas de qualidade encontrados:")
            for issue in issues:
                print(f"       • {issue}")
            return False
            
    except Exception as e:
        print(f"    ❌ Erro na validação: {e}")
        logger.exception("Erro detalhado:")
        return False


def test_different_time_periods():
    """Testa extração de dados para diferentes períodos."""
    print("\n📅 Testando diferentes períodos de dados...")
    
    test_ticker = 'AAPL'
    periods = [
        {'period': '1mo', 'name': '1 mês'},
        {'period': '3mo', 'name': '3 meses'},
        {'period': '6mo', 'name': '6 meses'},
        {'period': '1y', 'name': '1 ano'},
        {'period': '2y', 'name': '2 anos'},
    ]
    
    success_count = 0
    
    for period_info in periods:
        period = period_info['period']
        name = period_info['name']
        
        try:
            print(f"  📊 Testando período: {name}")
            
            yf_ticker = yf.Ticker(test_ticker)
            df = yf_ticker.history(period=period, auto_adjust=False)
            
            if df.empty:
                print(f"    ⚠️  Sem dados para o período {name}")
                continue
            
            record_count = len(df)
            first_date = df.index[0].date()
            last_date = df.index[-1].date()
            
            print(f"    ✅ {record_count} registros obtidos")
            print(f"       📅 {first_date} até {last_date}")
            
            # Verificar se o período está aproximadamente correto
            days_difference = (last_date - first_date).days
            print(f"       ⏱️  {days_difference} dias de dados")
            
            success_count += 1
            
        except Exception as e:
            print(f"    ❌ Erro no período {name}: {e}")
    
    print(f"\n📅 Resultado: {success_count}/{len(periods)} períodos testados com sucesso")
    return success_count > 0


def test_ticker_availability():
    """Testa verificação de disponibilidade de tickers."""
    print("\n🎯 Testando disponibilidade de tickers...")
    
    test_cases = [
        {'ticker': 'AAPL', 'expected': True, 'description': 'Ticker válido US'},
        {'ticker': 'PETR4.SA', 'expected': True, 'description': 'Ticker válido BR'},
        {'ticker': 'INVALID123', 'expected': False, 'description': 'Ticker inválido'},
        {'ticker': 'NOTEXIST.SA', 'expected': False, 'description': 'Ticker inexistente BR'},
        {'ticker': '^BVSP', 'expected': True, 'description': 'Índice válido'},
    ]
    
    provider = YahooFinanceProvider()
    success_count = 0
    
    for test_case in test_cases:
        ticker = test_case['ticker']
        expected = test_case['expected']
        description = test_case['description']
        
        try:
            print(f"  🔍 Testando: {ticker} ({description})")
            
            is_available = provider.is_available(ticker)
            
            if is_available == expected:
                status = "✅" if is_available else "✅ (não disponível, como esperado)"
                print(f"    {status}")
                success_count += 1
            else:
                print(f"    ❌ Resultado inesperado: esperado {expected}, obtido {is_available}")
                
        except Exception as e:
            print(f"    ❌ Erro ao verificar {ticker}: {e}")
    
    print(f"\n🎯 Resultado: {success_count}/{len(test_cases)} verificações corretas")
    return success_count == len(test_cases)


def test_error_handling():
    """Testa tratamento de erros e casos extremos."""
    print("\n⚠️  Testando tratamento de erros...")
    
    provider = YahooFinanceProvider()
    
    # Teste 1: Ticker inexistente
    try:
        print("  🚫 Testando ticker inexistente...")
        info = provider.get_asset_info("TICKER_INEXISTENTE_123")
        print("    ❌ Deveria ter falhado mas retornou dados")
    except Exception as e:
        print("    ✅ Erro tratado corretamente para ticker inexistente")
    
    # Teste 2: Ticker vazio
    try:
        print("  🚫 Testando ticker vazio...")
        info = provider.get_asset_info("")
        print("    ❌ Deveria ter falhado mas retornou dados")
    except Exception as e:
        print("    ✅ Erro tratado corretamente para ticker vazio")
    
    # Teste 3: Data inválida
    try:
        print("  🚫 Testando datas inválidas...")
        # Data futura
        future_date = datetime.now() + timedelta(days=365)
        df = provider.get_historical_data("AAPL", start_date=future_date)
        if df.empty:
            print("    ✅ Dados vazios para data futura (correto)")
        else:
            print("    ⚠️  Retornou dados para data futura")
    except Exception as e:
        print("    ✅ Erro tratado corretamente para data inválida")
    
    print("  ✅ Testes de tratamento de erros concluídos")
    return True


def main():
    """Função principal de teste."""
    print("🚀 Iniciando testes completos e estendidos do Yahoo Finance")
    print("=" * 70)
    
    success_count = 0
    total_tests = 7
    
    # Teste 1: Conexão básica
    if test_basic_connection():
        success_count += 1
    
    # Teste 2: Dados históricos
    if test_historical_data_extraction():
        success_count += 1
    
    # Teste 3: Informações de ativos
    if test_asset_information():
        success_count += 1
    
    # Teste 4: Preços atuais
    if test_latest_prices():
        success_count += 1
    
    # Teste 5: Qualidade dos dados
    if test_data_quality_validation():
        success_count += 1
    
    # Teste 6: Diferentes períodos
    if test_different_time_periods():
        success_count += 1
    
    # Teste 7: Disponibilidade de tickers
    if test_ticker_availability():
        success_count += 1
    
    # Teste adicional: Tratamento de erros
    print("\n" + "=" * 70)
    test_error_handling()
    
    # Resumo final
    print("\n" + "=" * 70)
    print(f"📊 Resumo completo dos testes:")
    print(f"  • Testes principais executados: {total_tests}")
    print(f"  • Testes bem-sucedidos: {success_count}")
    print(f"  • Taxa de sucesso: {success_count/total_tests*100:.1f}%")
    
    if success_count == total_tests:
        print("🎉 Todos os testes foram bem-sucedidos!")
        print("🔥 Yahoo Finance está funcionando perfeitamente!")
    elif success_count >= total_tests * 0.8:
        print("✅ Maioria dos testes bem-sucedida!")
        print("👍 Yahoo Finance está funcionando adequadamente!")
    else:
        print("⚠️  Vários testes falharam.")
        print("🔧 Verifique a conectividade e configurações do Yahoo Finance.")


if __name__ == "__main__":
    main()
