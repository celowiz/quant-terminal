# Relative Rotation Graph (RRG) - Implementação Completa

## ✅ Funcionalidades Implementadas

### Backend (`/rrg`)

1. **Endpoint Principal**: `GET /rrg`
   - Parâmetros configuráveis: benchmark, lookback_ratio, lookback_mom, tail, use_ema, tickers
   - Cálculos RRG completos baseados no notebook original
   - Suavização Savitzky-Golay opcional
   - Classificação automática de quadrantes

2. **Endpoints Auxiliares**:
   - `GET /rrg/config` - Configuração padrão
   - `GET /rrg/tickers` - Tickers disponíveis no banco

3. **Processamento de Dados**:
   - Conversão para dados semanais (sexta-feira)
   - Cálculo de RS (Relative Strength)
   - Normalização RS-Ratio em torno de 100
   - Cálculo de RS-Momentum
   - Classificação de quadrantes automática

### Frontend (`/rrg`)

1. **Página Principal**: `http://localhost:3000/rrg`
   - Controles interativos para configuração
   - Gráfico RRG com visualização completa
   - Sistema de cores por quadrantes com gradientes

2. **Sistema de Cores por Quadrantes**:
   - **Leading** (Superior Direito): Verde (`#22c55e`)
   - **Improving** (Superior Esquerdo): Azul (`#3b82f6`)
   - **Lagging** (Inferior Esquerdo): Vermelho (`#ef4444`)
   - **Weakening** (Inferior Direito): Amarelo (`#eab308`)
   - **Gradientes**: Cores interpoladas entre quadrantes adjacentes

3. **Funcionalidades Visuais**:
   - Trilhas históricas dos ativos (últimas N semanas)
   - Pontos atuais destacados
   - Tooltips informativos
   - Tabela de posições atuais
   - Labels dos quadrantes
   - Grade de referência

4. **Controles Interativos**:
   - Seleção de benchmark
   - Ajuste de janelas de cálculo
   - Configuração de trilhas
   - Tickers customizados
   - Configurações avançadas

## 🚀 Como Usar

### 1. Iniciar o Backend
```bash
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Iniciar o Frontend
```bash
cd frontend
npm run dev
```

### 3. Acessar a Página RRG
- **URL**: `http://localhost:3000/rrg`
- **Via Terminal**: Digite `RRG` no campo de função e pressione ENTER
- **Via Homepage**: Clique em "RRG - Relative Rotation Graph"

## 📊 Configurações Padrão

- **Benchmark**: ^BVSP (Ibovespa)
- **Lookback Ratio**: 10 semanas
- **Lookback Momentum**: 10 semanas
- **Trilha**: 12 semanas
- **Suavização**: EMA (Exponential Moving Average)
- **Ativos**: ZAMP3, PETR4, VALE3, B3SA3

## 🎨 Sistema de Cores

O sistema implementa gradientes inteligentes baseados na posição exata no plano cartesiano:

1. **Cores Primárias**: Cada quadrante tem sua cor específica
2. **Interpolação**: Pontos entre quadrantes recebem cores interpoladas
3. **Fator de Gradiente**: Calculado pela distância relativa aos eixos
4. **Suavização**: Limites aplicados para manter distinção visual

## 📁 Arquivos Criados/Modificados

### Backend
- `backend/api/models/rrg_schemas.py` - Schemas Pydantic
- `backend/api/routers/rrg.py` - Endpoint principal
- `backend/api/routers/__init__.py` - Export do router
- `backend/api/main.py` - Inclusão do router

### Frontend
- `frontend/src/types/rrg.ts` - Tipos TypeScript
- `frontend/src/lib/api.ts` - Funções API
- `frontend/src/app/rrg/page.tsx` - Página principal
- `frontend/src/components/RRGChart.tsx` - Componente do gráfico
- `frontend/src/components/RRGControls.tsx` - Controles interativos
- `frontend/src/components/TopBar.tsx` - Navegação RRG
- `frontend/tsconfig.json` - Path aliases

## 🔧 Tecnologias Utilizadas

### Backend
- FastAPI
- Pandas, NumPy
- SciPy (Savitzky-Golay)
- SQLite3
- Pydantic

### Frontend
- Next.js 14
- TypeScript
- Recharts
- Tailwind CSS
- Axios

## 📈 Interpretação dos Quadrantes

1. **Leading** (Verde): Alta performance relativa + momentum positivo
2. **Improving** (Azul): Performance baixa mas momentum crescente
3. **Lagging** (Vermelho): Baixa performance + momentum negativo
4. **Weakening** (Amarelo): Alta performance mas momentum declinante

## ⚡ Performance

- Backend otimizado para dados semanais
- Frontend com renderização responsiva
- Gradientes calculados em tempo real
- Dados cachados no frontend durante sessão

## 🔍 Debugging

Para verificar se está funcionando:
1. Backend: `curl http://localhost:8000/rrg/config`
2. Frontend: Verificar console do navegador em `/rrg`
3. Dados: Verificar se tabelas dos tickers existem no banco SQLite

---

**Status**: ✅ Implementação Completa - Pronto para Uso
