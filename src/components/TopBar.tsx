"use client"
import { useState, useEffect, useCallback } from 'react'
import { CircleHelp, Settings, Share2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import ShareMenu from './ShareMenu'
import SettingsPanel from './SettingsPanel'
import { isPanelOpen, setPanelOpen } from '../lib/settings'
import { t } from '../lib/i18n'
import Header from './Header'
import TickerSelector from './TickerSelector'
import { listTickers, tickerMeta, go, href, pathParts } from '../lib/static'
import { acceptsTicker, functionPath, inUniverse } from '../lib/activeTicker.mjs'
import { getActiveTicker, setActiveTicker, UNIVERSE } from '../lib/nav'
import { navTicker, trackHelp } from '../lib/track'
import { getHelp } from '../lib/help'

const HelpModal = dynamic(() => import('./help/HelpModal'), { ssr: false })
import { usePageTitle } from '../hooks/usePageTitle'
import { fnNameByCode } from '../constants/functions'
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
  const [showSettings, setShowSettings] = useState(isPanelOpen)
  const toggleSettings = (v: boolean) => { setPanelOpen(v); setShowSettings(v) }
  const closeSettings = useCallback(() => { setPanelOpen(false); setShowSettings(false) }, [])
  const [showShare, setShowShare] = useState(false)
  const closeShare = useCallback(() => setShowShare(false), [])
  const [showHelp, setShowHelp] = useState(false)
  const closeHelp = useCallback(() => setShowHelp(false), [])

  const [currentCodeFromPath, setCurrentCodeFromPath] = useState('')
  const [currentTickerFromPath, setCurrentTickerFromPath] = useState('')
  
  // Atualizar título da página baseado na função
  const effectiveCode = functionInput || currentCodeFromPath
  const getPageTitle = (code: string): string => {
    return code ? fnNameByCode(code) : fnNameByCode('')
  }
  const functionName = getPageTitle(effectiveCode)
  usePageTitle(functionName)

  useEffect(() => {
    const parts = pathParts()
    const code = (parts[0] || '').toUpperCase()
    const urlTicker = (parts[1] || '').toUpperCase()
    const stored = getActiveTicker()
    if (urlTicker) {
      // link direto/compartilhado com ticker explícito sempre vence e vira o ativo corrente
      setActiveTicker(urlTicker)
    } else if (acceptsTicker(code) && inUniverse(code, stored, UNIVERSE)) {
      // /fn/ sem ticker numa função de ativo: abre já com o ativo guardado
      window.location.replace(href(functionPath(code, stored, UNIVERSE)))
      return
    }
    setCurrentCodeFromPath(code)
    setCurrentTickerFromPath(urlTicker || stored)
  }, [])

  useEffect(() => {
    // Initialize from URL (ou do ativo guardado)
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
        const list = await listTickers()
        const mapped = list.map(t => ({ ticker: t }))
        setTickers(mapped)
        // a lista só abre quando o usuário digita (antes abria sozinha ao carregar /fn/TICKER/)
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
        const meta = await tickerMeta(selectedTicker)
        setTickerName(meta?.name || '')
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
        // Logos vinham de scraping do TradingView no backend; na versão estática ficam desativados.
        setTickerLogo('')
      } catch (error) {
        setTickerLogo('')
      }
    }
    fetchTickerLogo()
  }, [selectedTicker])

  // a navegação (com o ativo corrente) é feita pelo Header via openFunction()
  const handleFunctionEnter = (code: string) => {
    if (onFunctionChange) onFunctionChange(code)
  }

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker)
    setTickerSearch(ticker)
    setFilteredTickers([])
    setActiveTicker(ticker)
    if (onTickerChange) onTickerChange(ticker)

    const effectiveCode = currentCodeFromPath.toUpperCase()
    if (acceptsTicker(effectiveCode)) {
      navTicker(ticker)
      go(`/${effectiveCode.toLowerCase()}/${encodeURIComponent(ticker)}/`)
    }
  }

  // Determinar se o ticker selector deve estar desabilitado
  const isTickerDisabled = () => {
    const effectiveCode = currentCodeFromPath.toUpperCase()
    // Funções sem ativo (a home continua aceitando a escolha do ativo)
    return effectiveCode !== '' && !acceptsTicker(effectiveCode)
  }

  return (
    <div className="relative w-full max-lg:flex max-lg:items-stretch max-lg:h-11">
      <Header
        functionInput={functionInput}
        setFunctionInput={setFunctionInput}
        onFunctionEnter={handleFunctionEnter}
      />
      <div className="w-full flex items-stretch gap-0 px-0 py-0 max-lg:flex-1 max-lg:min-w-0">
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
            disabledHint={t('hdr.tickerUnused')}
          />
        </div>
        <div className="flex-1 h-10 max-lg:h-11 max-lg:pr-3 border-0 flex items-center justify-end pr-4" style={{ backgroundImage: 'linear-gradient(to right, #8E0D0D, #4D0A0A)' }}>

          <button type="button" data-help-toggle aria-label={t('help.open')} title={t('help.open')} aria-haspopup="dialog" aria-expanded={showHelp} aria-controls="qt-help"
            className={`p-1 mr-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA028] ${showHelp ? 'text-white' : 'text-[#FFA028] hover:text-white'}`}
            onClick={() => { const v = !showHelp; setShowHelp(v); if (v) { setShowShare(false); toggleSettings(false); trackHelp(getHelp()?.code || (pathParts()[0] || '').toUpperCase() || 'HOME') } }}>
            <CircleHelp className="w-5 h-5" aria-hidden strokeWidth={2} />
          </button>
          <button type="button" data-share-toggle aria-label={t('share.open')} title={t('share.title')} aria-haspopup="menu" aria-expanded={showShare} aria-controls="qt-share"
            className={`p-1 mr-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA028] ${showShare ? 'text-white' : 'text-[#FFA028] hover:text-white'}`}
            onClick={() => { setShowShare(!showShare); if (!showShare) toggleSettings(false) }}>
            <Share2 className="w-5 h-5" aria-hidden strokeWidth={2} />
          </button>
          <button type="button" data-settings-toggle aria-label={t('set.open')} title={t('set.title')} aria-haspopup="dialog" aria-expanded={showSettings} aria-controls="qt-settings"
            className={`p-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA028] ${showSettings ? 'text-white' : 'text-[#FFA028] hover:text-white'}`}
            onClick={() => { toggleSettings(!showSettings); setShowShare(false) }}>
            <Settings className="w-5 h-5" aria-hidden strokeWidth={2} />
          </button>
        </div>
      </div>
      {showSettings && <SettingsPanel onClose={closeSettings} />}
      {showShare && <ShareMenu onClose={closeShare} />}
      {showHelp && <HelpModal code={(pathParts()[0] || '').toUpperCase() || 'HOME'} onClose={closeHelp} />}
    </div>
  )
}