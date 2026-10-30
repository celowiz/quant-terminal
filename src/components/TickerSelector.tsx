"use client"
import React, { useRef, useState, useEffect } from 'react'
import { t } from '../lib/i18n'
import { useDesktop } from './fn/kit'

type TickerRecord = { ticker: string }

type TickerSelectorProps = {
  tickers: TickerRecord[]
  tickerSearch: string
  setTickerSearch: (value: string) => void
  filteredTickers: TickerRecord[]
  setFilteredTickers: (value: TickerRecord[]) => void
  selectedTicker: string
  setSelectedTicker: (value: string) => void
  tickerName?: string
  tickerLogo?: string
  onTickerSelect?: (ticker: string) => void
  disabled?: boolean
  /** função atual não usa ativo: o ativo guardado aparece esmaecido com esta dica */
  disabledHint?: string
}

export default function TickerSelector({
  tickers,
  tickerSearch,
  setTickerSearch,
  filteredTickers,
  setFilteredTickers,
  selectedTicker,
  setSelectedTicker,
  tickerName,
  tickerLogo,
  onTickerSelect,
  disabled = false,
  disabledHint,
}: TickerSelectorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const desk = useDesktop()
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setFilteredTickers([])
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleDocMouseDown)
    return () => document.removeEventListener('mousedown', handleDocMouseDown)
  }, [setFilteredTickers])

  const handleTickerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const value = e.target.value.toUpperCase()
    setTickerSearch(value)
    const next = tickers.filter(t => t.ticker.toUpperCase().includes(value))
    setFilteredTickers(next)
    setHighlightedIndex(next.length > 0 ? 0 : -1)
  }

	const handleTickerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return
		if (e.key === 'ArrowDown' && filteredTickers.length > 0) {
			e.preventDefault()
			setHighlightedIndex(idx => (idx + 1) % filteredTickers.length)
			return
		}
		if (e.key === 'ArrowUp' && filteredTickers.length > 0) {
			e.preventDefault()
			setHighlightedIndex(idx => (idx - 1 + filteredTickers.length) % filteredTickers.length)
			return
		}
		if (e.key === 'Enter' && filteredTickers.length > 0) {
			const target = highlightedIndex >= 0 ? filteredTickers[highlightedIndex] : filteredTickers[0]
			if (target) {
				handleTickerSelect(target.ticker)
			}
		}
	}

	const handleTickerSelect = (ticker: string) => {
		if (disabled) return
		setSelectedTicker(ticker)
		setTickerSearch(ticker)
		setFilteredTickers([])
		setHighlightedIndex(-1)
		if (inputRef.current) inputRef.current.blur()
		if (onTickerSelect) onTickerSelect(ticker)
	}

	return (
		<div ref={containerRef} className="ticker-selector-combo relative inline-flex items-center">
			<input
				ref={inputRef}
				className={`ticker-combo-box font-bold h-10 px-3 rounded-none border-0 focus:outline-none focus:ring-2 min-w-[160px] max-lg:min-w-0 max-lg:w-[96px] max-lg:h-11 max-lg:px-2 ${
					disabled 
						? 'bg-gray-600 text-gray-300 placeholder:text-gray-500 cursor-not-allowed opacity-70' 
						: 'bg-[#FFA028] text-black placeholder:text-black focus:ring-bb-blue/40'
				}`}
				type="text"
				value={tickerSearch}
				onChange={handleTickerSearch}
				onKeyDown={handleTickerKeyDown}
				placeholder={desk ? t('hdr.tickerPlaceholder') : 'Ticker'}
				autoComplete="off"
				disabled={disabled}
				title={disabled && tickerSearch && disabledHint ? `${tickerSearch} — ${disabledHint}` : undefined}
				data-ticker-unused={disabled && tickerSearch ? '' : undefined}
			/>
			{disabled && tickerSearch && disabledHint && (
				<span className="max-lg:hidden px-2 text-[11px] italic text-gray-400 whitespace-nowrap" title={disabledHint}>{disabledHint}</span>
			)}
			{!disabled && tickerSearch && filteredTickers.length > 0 && (
				<div className="function-autocomplete-list absolute left-0 top-full mt-1 z-50 w-full max-h-72 overflow-auto bg-black border border-[#3a3a3a]">
					{filteredTickers.slice(0, 10).map((t, idx) => (
						<div
							key={t.ticker}
							className="px-2 py-1 cursor-pointer font-bold"
							onMouseEnter={() => setHighlightedIndex(idx)}
							onMouseDown={() => handleTickerSelect(t.ticker)}
							style={idx === highlightedIndex ? { background: '#FFA028', color: '#000' } : { color: '#FFA028' }}
						>
							{t.ticker}
						</div>
					))}
				</div>
			)}
			{selectedTicker && tickerName && (
				<div className="ticker-name-label absolute left-full ml-2 whitespace-nowrap pointer-events-none font-bold flex items-center gap-2 max-lg:max-w-[calc(100vw-120px-96px-84px)] md:max-lg:max-w-[calc(100vw-220px-96px-84px)] max-lg:overflow-hidden max-lg:text-[12px]">
					<span className="max-lg:truncate max-lg:min-w-0">{tickerName}</span>
					{tickerLogo && (
						<img 
							src={tickerLogo} 
							alt={`${selectedTicker} logo`}
							className="w-6 h-6 object-contain rounded-sm max-lg:shrink-0 max-lg:w-5 max-lg:h-5"
							onError={(e) => {
								// Hide image if it fails to load
								const target = e.target as HTMLImageElement;
								target.style.display = 'none';
							}}
						/>
					)}
				</div>
			)}
		</div>
	)
}