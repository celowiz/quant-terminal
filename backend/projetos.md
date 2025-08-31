# Projetos Quantitativos em Finanças

## Projetos no Backend que serão passados para o Frontend por meio do FastAPI:

1. Ranking de Momentum via Inclinação de Médias Móveis
    - Objetivo:
      - Criar um ranking das ações do IBOV (ou IBRX) baseado na força e direção recente do momentum, mensurada através da inclinação (derivada) de médias móveis.
    - Inputs:
      - Preços diários via `yfinance` ou B3 (últimos 100 dias, por exemplo).
      - Lista de ações com tickers e setores (StatusInvest, Fundamentos, etc.).
    - Lógica:
      - Cálculo das Médias Móveis. Para cada ativo:
        - Calcular médias móveis: SMA(10), SMA(21), SMA(50), etc.
        - Usar `pandas.Series.rolling().mean()` ou `ta.trend.SMAIndicator`.
      - Cálculo da Inclinação (Momentum):
        - Calcular a derivada (ou inclinação) da média móvel em `t = -1` (último dia).
        - Pode fazer isso com uma regressão linear local sobre os últimos _N_ pontos da média:
        - Alternativamente, pode usar `.diff()` ou `.pct_change()` como proxy mais simples.
      - Ranking Final:
        - Usar uma fórmula composta como:
          - `score = 2 * slope_sma10 + 1.5 * slope_sma21 + 1 * slope_sma50`
        - Ordenar todos os ativos por esse score.
    - Visualizações:
      - Tabela com ranking dos top 10 ativos de maior momentum.
      - Gráfico de barras com os scores
      - Gráficos de linha para um ativo específico, mostrando as médias móveis + setas de inclinação.
    - Extras:
      - Mostrar também os piores ativos por momentum (momentum negativo).
      - Incluir coluna com retorno nos últimos 7, 21 e 63 dias para reforçar o ranking.
      - Combinar com volatilidade para criar um ranking de momentum ajustado pelo risco.
    - Exemplo de saída:

| Ticker | Momentum Score | Slope SMA10 | Slope SMA21 | Slope SMA50 | Return 21d | Setor     |
| ------ | -------------- | ----------- | ----------- | ----------- | ---------- | --------- |
| PETR4  | 3.25           | 0.85        | 0.70        | 0.40        | 9.8%       | Energia   |
| LREN3  | 2.78           | 0.62        | 0.90        | 0.45        | 7.1%       | Varejo    |
| VALE3  | 2.55           | 0.80        | 0.55        | 0.30        | 6.2%       | Mineração |

<br/>

---

<br>

2. Scanner Técnico de Ações da B3
    - Objetivo:
      - Criar uma tabela estilo “scanner” onde cada linha é uma ação e cada coluna representa um indicador técnico, com o valor atual e/ou o sinal (compra, venda, neutro).
    - Inputs:
    - Lógica:
      - **Definir o universo de ativos** (ex: IBOV ou IBRX100).
      - **Baixar os preços históricos** (últimos 200 dias pelo menos).
      - **Aplicar os indicadores** em cada série.
      - **Criar regras simples de sinal para cada indicador**.
      - **Montar a tabela final** (`pandas.DataFrame`).
    - Visualizações:
      - **Exibir sinais com emojis, setas ou cores** para facilitar leitura.
    - Extras:
      - Adicionar sinal composto (ex: 3 de 5 indicadores = compra forte).
      - Adicionar um score técnico por ativo.
      - Backtest simplificado dos sinais.
    - Exemplo:
    - 
| Ticker | RSI (14)       | MACD      | Golden Cross  | Estocástico     | OBV Trend |
| ------ | -------------- | --------- | ------------- | --------------- | --------- |
| PETR4  | Sobrecompra 🔴 | Compra 🟢 | Cruzado 🟢    | Neutro ⚪        | Alta 🟢   |
| VALE3  | Neutro ⚪       | Venda 🔴  | Não cruzado ⚪ | Sobrevendido 🟢 | Baixa 🔴  |

<br/>

---

<br>

3. Detecção Automática de Padrões Gráficos (Price Action)
    - Objetivo:
      - Automatizar a identificação de padrões gráficos clássicos em candles diários (ou intradiários), como:
        - Suportes e resistências,
        - Canais de alta/baixa,
        - Triângulos,
        - Retângulos de consolidação,
        - Ombro-cabeça-ombro (OCO),
        - Bandeiras e flâmulas,
        - Topos e fundos relevantes.
      - Bibliotecas úteis:
        - `pattern-recognition` para detecção de padrões como triângulos, bandeiras, etc. (Link: [https://github.com/andredumas/Pattern-Recognition](https://github.com/andredumas/Pattern-Recognition))
        - `ta` e `finta` para calcular indicadores técnicos
        - `zigzag` para deterctar topos e fundos com suavização de ruído (Exemplo: `scipy.signal.argrelextrema` ou `talib.ZIG`)
        - `mlfinlab`
    - Visualizações:
      - Para cada ativo, mostrar:
        - Gráfico de candles com padrões desenhados,
        - Nome do padrão detectado,
        - Confiança (quantos toques teve? há confirmação?),
        - Data da formação.

<br/>

---

<br>

4. Modelo de Clustering de Ações Brasileiras
   - Objetivo:
     - Agrupar ações com base em séries temporais de preços, volatilidade, e fundamentos.
   - Técnicas:
     -  Dynamic Time Warping, KMeans, t-SNE, UMAP.

<br/>

---

<br>
    
5. Visualização de performance por setor (Market Cap-Weighted Index)
    - Objetivo: 
      - Criar índices setoriais sintéticos (não oficiais), ponderados por valor de mercado, para visualizar a performance relativa de setores da bolsa brasileira ao longo do tempo (ex: bancos, energia, commodities, varejo)
    - Inputs:
      - Lista de ações do IBOV com seus setores (StatusInvest, Fundamentus ou site da B3).
      - Market Cap diário de cada ação (se não disponível, calcular com preço × número de ações – usar ações em circulação se possível).
      - Cotações diárias (Yahoo Finance, ou histórico da B3).
    - Lógica:
      - Agrupar ações por setor.
      - Calcular o valor de mercado diário por empresa.
      - Dentro de cada setor, somar o market cap total e calcular o peso de cada empresa no setor.
      - Calcular retorno diário ponderado por market cap.
      - Acumular retornos para formar o índice do setor.
    - Visualizações:
      - Linha de performance acumulada por setor (normalizada no tempo 0).
      - Heatmap** com performance setorial diária, semanal ou mensal (usando `plotly`, `seaborn`, ou `dash`).
      - Tabela interativa com filtros por período, setor, ação.
    - Extras:
      - Adicionar benchmark (IBOV, CDI).
      - Calcular volatilidade por setor.   
      - Criar dashboard com seleção interativa de períodos e setores.

<br/>

---

<br>

6. Análise de Sazonalidade de Ativos Brasileiros
    - Objetivos:
      - Detectar padrões sazonais mensais de retorno em ativos brasileiros (ações, índices, dólar, etc.). Ex: PETR4 tende a performar melhor em janeiro?
    - Inputs:
      - Cotações históricas diárias (ex: PETR4.SA, VALE3.SA, IBOVESPA).
      - Preferência por dados de longo prazo (5+ anos se possível).
    - Lógica:
      - Calcular o retorno mensal de cada ativo.
      - Agrupar por mês (janeiro a dezembro).
      - Calcular média e desvio padrão de retorno por mês.
      - Testar significância estatística (t-test ou bootstrapping).
      - Exibir sazonais por ativo ou por setor.
    - Visualizações:
      - Barplot de média de retorno por mês para cada ativo.
      - Boxplot de distribuição dos retornos mensais.
      - Calendar heatmap (semanal ou mensal).
    - Extras:
      - Incluir volume médio por mês.
      - Testar se há autocorrelação entre meses (momentum ou reversão).
      - Filtrar ativos com alta ou baixa sazonalidade.

<br/>

---

<br>

7. Análise de Volatilidade e Risco
   - Volatilidade Implícita vs Realizada - Comparar volatilidade das opções com a realizada
   - VaR (Value at Risk) - Calculadora de risco parar portfolios
   - Stress Testing - Simulação de cenários extremos
   - Correlação Dinâmica - Análise de correlações entre ativos ao longo do tempo

<br/>

---

<br>

8. Precificação e Valuation
   - Modelo de Precificação de Opções - Black-Scholes adaptado para mercado brasileiro
   - DCF (Discounted Cash Flow) - Valuation de empresas brasileiras
   - Modelo de Dividendos - Precificação baseada em dividendos
   - Análise Fundamentalista Quantitativa - Score de qualidade de empresas

<br/>

---

<br>

9.  Trading Algorítmico
   - Mean Reversion - Estratégias baseadas em reversão à média
   - Momentum Trading - Estratégias de momentum
   - Pairs Trading - Arbitragem estatística entre pares de ativos
   - Machine Learning para Trading - Modelos preditivos
   - Factor Investing - Trading Automático baseado em fatores (momentum, value, low volatility)
     - Criar um ranking mensal com ações do IBOV com base em indicadores fundamentalistas
     - Testar rebalanceamentos mensais

<br/>

---

<br>

10. Arbitragem
   - Arbitragem Estatística - Identificação de oportunidades
      - Identificação de pares cointegrados (teste de Engle-Granger, Johansen)
      - Sinais de entrada/saída com threshold variável baseado no z-score
      - Backtesting de estratégias
      - Análise de Performance 
   - Arbitragem de Volatilidade - Estratégias de vol
   - Arbitragem de ETF - Premium/discount de ETFs 

<br/>

---

<br>

11. Análise Macroeconômica
   - Curva de Juros 3D - Visualização dinâmica
   - Análise de Fluxo de Investidor Estrangeiro - Tracking de FII
   - Indicadores Leading/Lagging - Análise de ciclos econômicos
   - Regime Switching Models - Identificação de regimes de mercado

<br/>

---

<br>

12. Calculadora e Ferramentas
   - Calculadora de Opções - Interface web completa com análise de gregas
   - Calculadora de Duration - Para títulos de renda fixa
   - Calculadora de Sharpe Ratio - Análise de performance
   - Calculadora de Correlação - Matriz de correlações dinâmica

<br/>

---

<br>

13. Relatórios de Fluxo
   - Análise de Fluxo de Investidor Estrangeiro
     - Criar dashboards com dados de entrada e saída diária/mensal de estrangeiros na B3
     - Estudar a correlação com o dólar, bolsa, juros

<br/>

---

<br>

14. Precificação de Títulos Públicos (Tesouro Direto)
   - Implementar a curva de juros via bootstrapping com dados da ANBIMA.
   - Criar um visualizador de preços teóricos x preços de mercado.
   - Mostrar DV01, duration, convexidade.
