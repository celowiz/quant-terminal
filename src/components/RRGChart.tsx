'use client'

import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Cell, Tooltip } from 'recharts'
import { RRGResponse } from '@/types/rrg'

interface RRGChartProps {
  data: RRGResponse
}

// Configuração dos quadrantes com cores estilo terminal
const QUADRANT_COLORS = {
  Leading: '#22c55e',     // Verde
  Improving: '#3b82f6',   // Azul  
  Lagging: '#ef4444',     // Vermelho
  Weakening: '#eab308'    // Amarelo
}

// Função para interpolar cores entre quadrantes
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  const result = color1.slice()
  const f = Math.max(0, Math.min(1, factor))
  
  const c1 = {
    r: parseInt(color1.slice(1, 3), 16),
    g: parseInt(color1.slice(3, 5), 16),
    b: parseInt(color1.slice(5, 7), 16)
  }
  
  const c2 = {
    r: parseInt(color2.slice(1, 3), 16),
    g: parseInt(color2.slice(3, 5), 16),
    b: parseInt(color2.slice(5, 7), 16)
  }
  
  const r = Math.round(c1.r + f * (c2.r - c1.r))
  const g = Math.round(c1.g + f * (c2.g - c1.g))
  const b = Math.round(c1.b + f * (c2.b - c1.b))
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Função para calcular cor baseada na posição
const calculatePointColor = (rsRatio: number, rsMomentum: number): string => {
  const x = rsRatio - 100
  const y = rsMomentum - 100
  
  // Determinar quadrante primário
  let primaryColor: string
  let secondaryColor: string
  let factor: number
  
  if (x >= 0 && y >= 0) {
    // Leading (verde)
    primaryColor = QUADRANT_COLORS.Leading
    // Verificar proximidade com Weakening
    if (Math.abs(y) < Math.abs(x)) {
      secondaryColor = QUADRANT_COLORS.Weakening
      factor = Math.abs(y) / (Math.abs(x) + Math.abs(y))
    } else {
      secondaryColor = QUADRANT_COLORS.Improving
      factor = Math.abs(x) / (Math.abs(x) + Math.abs(y))
    }
  } else if (x < 0 && y >= 0) {
    // Improving (azul)
    primaryColor = QUADRANT_COLORS.Improving
    if (Math.abs(x) < Math.abs(y)) {
      secondaryColor = QUADRANT_COLORS.Leading
      factor = Math.abs(x) / (Math.abs(x) + Math.abs(y))
    } else {
      secondaryColor = QUADRANT_COLORS.Lagging
      factor = Math.abs(y) / (Math.abs(x) + Math.abs(y))
    }
  } else if (x < 0 && y < 0) {
    // Lagging (vermelho)
    primaryColor = QUADRANT_COLORS.Lagging
    if (Math.abs(x) < Math.abs(y)) {
      secondaryColor = QUADRANT_COLORS.Weakening
      factor = Math.abs(x) / (Math.abs(x) + Math.abs(y))
    } else {
      secondaryColor = QUADRANT_COLORS.Improving
      factor = Math.abs(y) / (Math.abs(x) + Math.abs(y))
    }
  } else {
    // Weakening (amarelo)
    primaryColor = QUADRANT_COLORS.Weakening
    if (Math.abs(y) < Math.abs(x)) {
      secondaryColor = QUADRANT_COLORS.Lagging
      factor = Math.abs(y) / (Math.abs(x) + Math.abs(y))
    } else {
      secondaryColor = QUADRANT_COLORS.Leading
      factor = Math.abs(x) / (Math.abs(x) + Math.abs(y))
    }
  }
  
  // Aplicar interpolação suave
  factor = Math.min(0.7, factor * 1.5) // Limitar o fator para manter cores distintivas
  
  return interpolateColor(primaryColor, secondaryColor, factor)
}

// Componente para tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="text-white font-semibold">{data.ticker}</p>
        <p className="text-gray-300">RS-Ratio: {data.rs_ratio?.toFixed(2)}</p>
        <p className="text-gray-300">RS-Momentum: {data.rs_momentum?.toFixed(2)}</p>
        <p className="text-gray-300">Quadrante: {data.quadrant}</p>
        {data.date && (
          <p className="text-gray-400 text-sm">
            {new Date(data.date).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    )
  }
  return null
}

export function RRGChart({ data }: RRGChartProps) {
  // Preparar dados para o gráfico
  const chartData = useMemo(() => {
    const points: any[] = []
    
    data.assets.forEach(asset => {
      asset.points.forEach((point, index) => {
        const color = calculatePointColor(point.rs_ratio, point.rs_momentum)
        
        points.push({
          ticker: asset.ticker,
          rs_ratio: point.rs_ratio,
          rs_momentum: point.rs_momentum,
          quadrant: point.quadrant,
          date: point.date,
          color: color,
          isLatest: index === asset.points.length - 1,
          pointIndex: index,
          assetIndex: data.assets.indexOf(asset)
        })
      })
    })
    
    return points
  }, [data])

  // Calcular limites do gráfico
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const allRsRatios = chartData.map(d => d.rs_ratio)
    const allRsMomentums = chartData.map(d => d.rs_momentum)
    
    const xMin = Math.min(90, Math.min(...allRsRatios) - 5)
    const xMax = Math.max(110, Math.max(...allRsRatios) + 5)
    const yMin = Math.min(90, Math.min(...allRsMomentums) - 5)
    const yMax = Math.max(110, Math.max(...allRsMomentums) + 5)
    
    return { xMin, xMax, yMin, yMax }
  }, [chartData])

  // Dados atuais (último ponto de cada ativo) para destaque
  const currentPoints = useMemo(() => {
    return chartData.filter(d => d.isLatest)
  }, [chartData])

  return (
    <div className="w-full">
      <div className="mb-4 text-center">
        <h3 className="text-xl font-semibold text-white mb-2">
          RRG vs {data.benchmark} — {data.config.tail} semanas de trilha
        </h3>
        <p className="text-gray-400">
          Período: {data.date_range.start ? new Date(data.date_range.start).toLocaleDateString('pt-BR') : ''} 
          {' até '}
          {data.date_range.end ? new Date(data.date_range.end).toLocaleDateString('pt-BR') : ''}
        </p>
      </div>

      <div style={{ width: '100%', height: '600px' }}>
        <ResponsiveContainer>
          <ScatterChart
            margin={{ top: 20, right: 80, bottom: 60, left: 80 }}
            data={chartData}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            
            <XAxis
              type="number"
              dataKey="rs_ratio"
              domain={[xMin, xMax]}
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fill: '#d1d5db', fontSize: 12 }}
              label={{ 
                value: 'JdK RS-Ratio', 
                position: 'insideBottom', 
                offset: -40,
                style: { textAnchor: 'middle', fill: '#d1d5db' }
              }}
            />
            
            <YAxis
              type="number"
              dataKey="rs_momentum"
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fill: '#d1d5db', fontSize: 12 }}
              label={{ 
                value: 'JdK RS-Momentum', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#d1d5db' }
              }}
            />

            {/* Linhas de referência nos quadrantes */}
            <ReferenceLine x={100} stroke="#6b7280" strokeDasharray="2 2" />
            <ReferenceLine y={100} stroke="#6b7280" strokeDasharray="2 2" />

            {/* Trilhas dos ativos (pontos históricos) */}
            <Scatter
              dataKey="rs_momentum"
              fill="#8884d8"
              fillOpacity={0.6}
              name="Trilha"
            >
              {chartData.filter(d => !d.isLatest).map((entry, index) => (
                <Cell 
                  key={`trail-${index}`} 
                  fill={entry.color}
                  r={3}
                  fillOpacity={0.4}
                />
              ))}
            </Scatter>

            {/* Pontos atuais (destacados) */}
            <Scatter
              dataKey="rs_momentum"
              data={currentPoints}
              fill="#ffffff"
              name="Atual"
            >
              {currentPoints.map((entry, index) => (
                <Cell 
                  key={`current-${index}`} 
                  fill={entry.color}
                  r={8}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ))}
            </Scatter>

            <Tooltip content={<CustomTooltip />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Labels dos quadrantes */}
      <div className="relative mt-4">
        <div className="absolute top-2 right-2 text-sm text-green-400 font-semibold">
          LEADING
        </div>
        <div className="absolute top-2 left-2 text-sm text-blue-400 font-semibold">
          IMPROVING
        </div>
        <div className="absolute bottom-2 left-2 text-sm text-red-400 font-semibold">
          LAGGING
        </div>
        <div className="absolute bottom-2 right-2 text-sm text-yellow-400 font-semibold">
          WEAKENING
        </div>
      </div>

      {/* Legenda dos ativos */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.assets.map((asset, index) => {
          const color = calculatePointColor(asset.current_rs_ratio, asset.current_rs_momentum)
          return (
            <div key={asset.ticker} className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full border-2 border-white"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-white font-medium">{asset.ticker}</span>
              <span className="text-xs text-gray-400">
                ({asset.current_quadrant})
              </span>
            </div>
          )
        })}
      </div>

      {/* Estatísticas atuais */}
      <div className="mt-6 bg-black rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-3 text-center">Posições Atuais</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 text-gray-300">Ativo</th>
                <th className="text-right py-2 text-gray-300">RS-Ratio</th>
                <th className="text-right py-2 text-gray-300">RS-Momentum</th>
                <th className="text-center py-2 text-gray-300">Quadrante</th>
              </tr>
            </thead>
            <tbody>
              {data.assets
                .sort((a, b) => b.current_rs_ratio - a.current_rs_ratio)
                .map(asset => {
                  const color = calculatePointColor(asset.current_rs_ratio, asset.current_rs_momentum)
                  return (
                    <tr key={asset.ticker} className="border-b border-gray-700">
                      <td className="py-2 font-medium text-white">{asset.ticker}</td>
                      <td className="py-2 text-right text-gray-300">
                        {asset.current_rs_ratio.toFixed(2)}
                      </td>
                      <td className="py-2 text-right text-gray-300">
                        {asset.current_rs_momentum.toFixed(2)}
                      </td>
                      <td className="py-2 text-center">
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ 
                            backgroundColor: color + '20',
                            color: color,
                            borderColor: color,
                            border: '1px solid'
                          }}
                        >
                          {asset.current_quadrant}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
