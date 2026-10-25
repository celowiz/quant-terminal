'use client'

import { useState, useEffect } from 'react'
import { RRGFormData } from '@/types/rrg'
import { rrgAPI } from '@/lib/api'

interface RRGControlsProps {
  formData: RRGFormData
  onSubmit: (data: RRGFormData) => void
  loading: boolean
}

export function RRGControls({ formData, onSubmit, loading }: RRGControlsProps) {
  const [localFormData, setLocalFormData] = useState<RRGFormData>(formData)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [availableTickers, setAvailableTickers] = useState<string[]>([])

  useEffect(() => {
    setLocalFormData(formData)
  }, [formData])

  useEffect(() => {
    loadAvailableTickers()
  }, [])

  const loadAvailableTickers = async () => {
    try {
      const response = await rrgAPI.getAvailableTickers()
      setAvailableTickers(response.tickers)
    } catch (error) {
      console.error('Erro ao carregar tickers disponíveis:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(localFormData)
  }

  const handleInputChange = (field: keyof RRGFormData, value: string | number | boolean) => {
    setLocalFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleReset = () => {
    const defaultData: RRGFormData = {
      benchmark: '^BVSP',
      lookback_ratio: 10,
      lookback_mom: 10,
      tail: 12,
      use_ema: true,
    }
    setLocalFormData(defaultData)
    onSubmit(defaultData)
  }

  return (
    <div className="bg-black rounded-lg p-6 border border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white text-center flex-1">Configurações RRG</h2>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {showAdvanced ? 'Ocultar' : 'Mostrar'} configurações avançadas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Benchmark */}
          <div>
            <label htmlFor="benchmark" className="block text-sm font-medium text-gray-300 mb-2">
              Benchmark
            </label>
            <select
              id="benchmark"
              value={localFormData.benchmark}
              onChange={(e) => handleInputChange('benchmark', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="^BVSP">^BVSP (Ibovespa)</option>
              <option value="B3SA3">B3SA3</option>
              <option value="PETR4">PETR4</option>
              <option value="VALE3">VALE3</option>
            </select>
          </div>

          {/* Tail */}
          <div>
            <label htmlFor="tail" className="block text-sm font-medium text-gray-300 mb-2">
              Semanas de Trilha
            </label>
            <input
              type="number"
              id="tail"
              min="1"
              max="52"
              value={localFormData.tail}
              onChange={(e) => handleInputChange('tail', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* EMA Toggle */}
          <div>
            <label htmlFor="use_ema" className="block text-sm font-medium text-gray-300 mb-2">
              Suavização
            </label>
            <select
              id="use_ema"
              value={localFormData.use_ema ? 'ema' : 'sma'}
              onChange={(e) => handleInputChange('use_ema', e.target.value === 'ema')}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ema">EMA (Exponencial)</option>
              <option value="sma">SMA (Simples)</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="border-t border-gray-700 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lookback Ratio */}
              <div>
                <label htmlFor="lookback_ratio" className="block text-sm font-medium text-gray-300 mb-2">
                  Janela RS-Ratio
                </label>
                <input
                  type="number"
                  id="lookback_ratio"
                  min="1"
                  max="50"
                  value={localFormData.lookback_ratio}
                  onChange={(e) => handleInputChange('lookback_ratio', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Semanas para normalização do RS</p>
              </div>

              {/* Lookback Momentum */}
              <div>
                <label htmlFor="lookback_mom" className="block text-sm font-medium text-gray-300 mb-2">
                  Janela Momentum
                </label>
                <input
                  type="number"
                  id="lookback_mom"
                  min="1"
                  max="50"
                  value={localFormData.lookback_mom}
                  onChange={(e) => handleInputChange('lookback_mom', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Semanas para cálculo do momentum</p>
              </div>

              {/* Custom Tickers */}
              <div>
                <label htmlFor="tickers" className="block text-sm font-medium text-gray-300 mb-2">
                  Tickers Customizados
                </label>
                <input
                  type="text"
                  id="tickers"
                  placeholder="Ex: PETR4,VALE3,ITUB4"
                  value={localFormData.tickers || ''}
                  onChange={(e) => handleInputChange('tickers', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separados por vírgula (opcional)</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors"
              >
                Resetar para Padrão
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
