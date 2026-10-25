'use client'

import { useState, useEffect } from 'react'
import { RRGChart } from '@/components/RRGChart'
import { RRGControls } from '@/components/RRGControls'
import { RRGResponse, RRGFormData } from '@/types/rrg'
import { rrgAPI } from '@/lib/api'

export default function RRGPage() {
  const [rrgData, setRRGData] = useState<RRGResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultFormData: RRGFormData = {
    benchmark: '^BVSP',
    lookback_ratio: 10,
    lookback_mom: 10,
    tail: 12,
    use_ema: true,
  }

  const [formData, setFormData] = useState<RRGFormData>(defaultFormData)

  // Buscar dados iniciais
  useEffect(() => {
    loadRRGData(defaultFormData)
  }, [])

  const loadRRGData = async (params: RRGFormData) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await rrgAPI.getRRGData(params)
      setRRGData(data)
    } catch (err) {
      console.error('Erro ao carregar dados RRG:', err)
      setError('Erro ao carregar dados do RRG. Verifique se o backend está rodando.')
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = (newFormData: RRGFormData) => {
    setFormData(newFormData)
    loadRRGData(newFormData)
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            Relative Rotation Graph (RRG)
          </h1>
          <p className="text-gray-400 text-lg">
            Análise de momentum e tendência relativa dos ativos vs benchmark
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8">
          <RRGControls
            formData={formData}
            onSubmit={handleFormSubmit}
            loading={loading}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-xl text-gray-400">Carregando dados...</div>
          </div>
        )}

        {/* Chart */}
        {rrgData && !loading && (
          <div className="bg-black rounded-lg p-6">
            <RRGChart data={rrgData} />
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-black rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-center">Quadrantes do RRG</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-2 text-center">Leading</h4>
              <p className="text-sm text-gray-300 text-center">
                Alto momentum e tendência positiva. Ativos em posição forte.
              </p>
            </div>
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2 text-center">Improving</h4>
              <p className="text-sm text-gray-300 text-center">
                Momentum crescente mas tendência ainda fraca. Recuperação em curso.
              </p>
            </div>
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
              <h4 className="font-semibold text-red-400 mb-2 text-center">Lagging</h4>
              <p className="text-sm text-gray-300 text-center">
                Baixo momentum e tendência negativa. Ativos em posição fraca.
              </p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-400 mb-2 text-center">Weakening</h4>
              <p className="text-sm text-gray-300 text-center">
                Momentum declinante mas tendência ainda forte. Possível reversão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
