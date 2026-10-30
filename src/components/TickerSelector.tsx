"use client"
import React, { useRef, useState, useEffect } from 'react'
import { t } from '../lib/i18n'
import { useDesktop } from './fn/kit'
import { TICKERS } from '../lib/universe'
import { displayTicker } from '../lib/activeTicker.mjs'

const META = new Map(TICKERS.map(m => [m.ticker.toUpperCase(), m]))
export const CLASS_ORDER = ['br_equity', 'us_equity', 'index', 'etf', 'commodity', 'crypto', 'fx'] as const
const MAX_RESULTS = 60
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/** busca por código ou nome; prefixo do código primeiro; resultado ordenado por classe */
export function searchTickers<T extends { ticker: string }>(list: T[], query: string): T[] {
  const q = norm(query.trim())
  if (!q) return []
  const scored = list.map(r => {
    const tk = r.ticker.toUpperCase(), name = norm(META.get(tk)?.name || '')
    const score = tk.startsWith(q) ? 0 : tk.includes(q) ? 1 : name.includes(q) ? 2 : -1
    return { r, score, cls: CLASS_ORDER.indexOf((META.get(tk)?.class || 'fx') as typeof CLASS_ORDER[number]) }
  }).filter(x => x.score >= 0)
  scored.sort((a, b) => a.cls - b.cls || a.score - b.score || a.r.ticker.localeCompare(b.r.ticker))
  return scored.slice(0, MAX_RESULTS).map(x => x.r)
}

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
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setFilteredTickers([])
        setHighlightedIndex(-1)
        setSearching(false)
      }
    }
    document.addEventListener('mousedown', handleDocMouseDown)
    return () => document.removeEventListener('mousedown', handleDocMouseDown)
  }, [setFilteredTickers])

  const handleTickerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const value = e.target.value.toUpperCase()
    setTickerSearch(value)
    setSearching(true)
    const next = searchTickers(tickers, value)
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
		setTickerSearch(displayTicker(ticker))
		setFilteredTickers([])
		setHighlightedIndex(-1)
		setSearching(false)
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
				<div className="function-autocomplete-list ticker-results absolute left-0 top-full mt-1 z-50 w-[340px] max-lg:w-[calc(100vw-128px)] max-h-80 overflow-auto bg-black border border-[#3a3a3a]" role="listbox">
					{filteredTickers.map((r, idx) => {
						const m = META.get(r.ticker.toUpperCase())
						const prev = idx > 0 ? META.get(filteredTickers[idx - 1].ticker.toUpperCase())?.class : undefined
						return (
							<React.Fragment key={r.ticker}>
								{m?.class && m.class !== prev && (
									<div className="px-2 pt-2 pb-[2px] text-[10px] uppercase tracking-wider text-[#8a8a8a] border-t border-[#222] first:border-t-0">{t(`cls.${m.class}`)}</div>
								)}
								<div
									role="option"
									aria-selected={idx === highlightedIndex}
									className="px-2 py-1 cursor-pointer flex gap-2 items-baseline"
									onMouseEnter={() => setHighlightedIndex(idx)}
									onMouseDown={() => handleTickerSelect(r.ticker)}
									style={idx === highlightedIndex ? { background: '#FFA028', color: '#000' } : { color: '#FFA028' }}
								>
									<span className="font-bold shrink-0">{r.ticker}</span>
									{m?.name && <span className="truncate text-[11px] opacity-80">{m.name}</span>}
								</div>
							</React.Fragment>
						)
					})}
				</div>
			)}
			{!disabled && tickerSearch && filteredTickers.length === 0 && searching && (
				<div className="absolute left-0 top-full mt-1 z-50 w-[240px] px-2 py-1 bg-black border border-[#3a3a3a] text-[12px] text-[#8a8a8a]">{t('hdr.noMatch')}</div>
			)}
			{selectedTicker && tickerName && (
				<div className="ticker-name-label absolute left-full ml-2 whitespace-nowrap pointer-events-none font-bold text-white flex items-center gap-2 max-lg:max-w-[calc(100vw-120px-96px-120px)] md:max-lg:max-w-[calc(100vw-220px-96px-120px)] max-lg:overflow-hidden max-lg:text-[12px]">
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