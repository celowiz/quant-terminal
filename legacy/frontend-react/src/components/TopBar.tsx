"use client"
import { useState, useEffect } from 'react'
import Header from './Header'
import TickerSelector from './TickerSelector'
import { api } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'
import { FUNCTION_LIST } from '../constants/functions'
// Using location-based navigation to avoid Next import types

type TickerRecord = { ticker: string }

type TopBarProps = {
  defaultFunction?: string
  onFunctionChange?: (code: string) => void
  onTickerChange?: (ticker: string) => void
}

export default function TopBar({ defaultFunction = '', onFunctionChange, onTickerChange }: TopBarProps) {
  const [functionInput, setFunctionInput] = useState<string>(defaultFunction)
  const [tickers, setTickers] = useState<TickerRecord[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string>('')
  const [tickerName, setTickerName] = useState<string>('')
  const [tickerLogo, setTickerLogo] = useState<string>('')
  const [tickerSearch, setTickerSearch] = useState<string>('')
  const [filteredTickers, setFilteredTickers] = useState<TickerRecord[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const go = (path: string) => { if (typeof window !== 'undefined') window.location.assign(path) }

  const [currentCodeFromPath, setCurrentCodeFromPath] = useState('')
  const [currentTickerFromPath, setCurrentTickerFromPath] = useState('')
  
  // Atualizar título da página baseado na função
  const effectiveCode = functionInput || currentCodeFromPath
  const getPageTitle = (code: string): string => {
    const func = FUNCTION_LIST.find(f => f.code === code.toUpperCase())
    return func ? func.desc : (code || 'Homepage')
  }
  const functionName = getPageTitle(effectiveCode)
  usePageTitle(functionName)

  useEffect(() => {
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    setCurrentCodeFromPath((pathParts[0] || '').toUpperCase())
    setCurrentTickerFromPath((pathParts[1] || '').toUpperCase())
  }, [])

  useEffect(() => {
    // Initialize from URL if present
    if (!functionInput && currentCodeFromPath) {
      setFunctionInput(currentCodeFromPath)
    }
    if (currentTickerFromPath) {
      setSelectedTicker(currentTickerFromPath)
      setTickerSearch(currentTickerFromPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCodeFromPath, currentTickerFromPath])

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await api.get<TickerRecord[]>('/tickers/')
        const mapped = response.data.map(t => ({ ticker: typeof t === 'string' ? t : String(t) }))
        setTickers(mapped)
        setFilteredTickers(mapped)
      } catch (error) {
        // noop
      }
    }
    fetchTickers()
  }, [])

  useEffect(() => {
    const fetchTickerName = async () => {
      if (!selectedTicker) {
        setTickerName('')
        return
      }
      try {
        const response = await api.get<{ ticker: string; name: string | null }>(`/name/${selectedTicker}`)
        setTickerName(response.data?.name || '')
      } catch (error) {
        setTickerName('')
      }
    }
    fetchTickerName()
  }, [selectedTicker])

  useEffect(() => {
    const fetchTickerLogo = async () => {
      if (!selectedTicker) {
        setTickerLogo('')
        return
      }
      try {
        const response = await api.get<{ ticker: string; logo_url: string | null; exchange: string | null }>(`/logo/${selectedTicker}`)
        setTickerLogo(response.data?.logo_url || '')
      } catch (error) {
        setTickerLogo('')
      }
    }
    fetchTickerLogo()
  }, [selectedTicker])

  const handleFunctionEnter = (code: string) => {
    if (onFunctionChange) onFunctionChange(code)
    if (code === '') {
      go('/')
    } else if (code === 'GP') {
      go('/gp')
    } else if (code === 'RRG') {
      go('/rrg')
    } else if (code === 'ANB') {
      go('/anb')
    } else if (code) {
      go(`/${code.toLowerCase()}`)
    }
  }

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker)
    setTickerSearch(ticker)
    setFilteredTickers([])
    if (onTickerChange) onTickerChange(ticker)

    const effectiveCode = (functionInput || currentCodeFromPath).toUpperCase()
    if (effectiveCode === 'GP') {
      go(`/gp/${ticker}`)
    } else if (effectiveCode) {
      go(`/${effectiveCode.toLowerCase()}/${ticker}`)
    }
  }

  // Determinar se o ticker selector deve estar desabilitado
  const isTickerDisabled = () => {
    const effectiveCode = (functionInput || currentCodeFromPath).toUpperCase()
    // Páginas que não precisam de ticker
    const pagesWithoutTicker = ['RRG', 'ANB']
    return pagesWithoutTicker.includes(effectiveCode)
  }

  return (
    <div className="w-full">
      <Header
        functionInput={functionInput}
        setFunctionInput={setFunctionInput}
        onFunctionEnter={handleFunctionEnter}
      />
      <div className="w-full flex items-stretch gap-0 px-0 py-0">
        <div className="py-0">
          <TickerSelector
            tickers={tickers}
            tickerSearch={tickerSearch}
            setTickerSearch={setTickerSearch}
            filteredTickers={filteredTickers}
            setFilteredTickers={setFilteredTickers}
            selectedTicker={selectedTicker}
            setSelectedTicker={setSelectedTicker}
            tickerName={tickerName}
            tickerLogo={tickerLogo}
            onTickerSelect={handleTickerSelect}
            disabled={isTickerDisabled()}
          />
        </div>
        <div className="flex-1 h-10 border-0 flex items-center justify-end pr-4" style={{ backgroundImage: 'linear-gradient(to right, #8E0D0D, #4D0A0A)' }}>

          <button type="button" aria-label="Settings" className="text-slate-100 hover:text-[#FFA028]" onClick={() => setShowSettings(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M11.983 2.25a1 1 0 01.94.658l.678 1.81a8.967 8.967 0 012.06.85l1.87-.726a1 1 0 011.238.45l1.5 2.598a1 1 0 01-.298 1.28l-1.6 1.2c.053.359.08.726.08 1.1 0 .374-.027.741-.08 1.1l1.6 1.2a1 1 0 01.298 1.28l-1.5 2.598a1 1 0 01-1.238.45l-1.87-.726a8.967 8.967 0 01-2.06.85l-.678 1.81a1 1 0 01-.94.658h-3a1 1 0 01-.94-.658l-.678-1.81a8.967 8.967 0 01-2.06-.85l-1.87.726a1 1 0 01-1.238-.45l-1.5-2.598a1 1 0 01-.298-1.28l1.6-1.2A8.969 8.969 0 013.5 12c0-.374.027-.741.08-1.1l-1.6-1.2a1 1 0 01-.298-1.28l1.5-2.598a1 1 0 01-.298-1.28l1.6-1.2A8.969 8.969 0 013.5 12c0-.374.027-.741.08-1.1l-1.6-1.2a1 1 0 01-.298-1.28l1.5-2.598a1 1 0 01.238-.45l1.87.726a8.967 8.967 0 012.06-.85l.678-1.81a1 1 0 01.94-.658h3zm.017 6.75a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
          <div className="relative z-[61] bg-[#0f1115] border border-[#3a3a3a] px-6 py-6 text-slate-100 flex items-center justify-center min-w-[260px]">
            <button type="button" aria-label="Fechar" className="absolute top-2 right-2 text-slate-300 hover:text-white" onClick={() => setShowSettings(false)}>×</button>
            <div className="text-center">❓ Help Help em desenvolvimento ❓</div>
          </div>
        </div>
      )}
    </div>
  )
}