"use client"
import { useState, useRef, useEffect } from 'react'
import { FUNCTION_LIST } from '../constants/functions'
import { go, pathParts } from '../lib/static'
// Using location-based navigation to stay framework-agnostic

type HeaderProps = {
  functionInput: string
  setFunctionInput: (value: string) => void
  onFunctionEnter?: (code: string) => void
}

export default function Header({ functionInput, setFunctionInput, onFunctionEnter }: HeaderProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const functionInputRef = useRef<HTMLInputElement | null>(null)

  const filteredFunctions = FUNCTION_LIST.filter((f) =>
    f.code === '' || f.code.includes(functionInput.toUpperCase()) || f.desc.toLowerCase().includes(functionInput.toLowerCase())
  )

  const handleFunctionInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFunctionInput(e.target.value.toUpperCase())
    setShowAutocomplete(true)
    setHighlightedIndex(-1)
  }

  const handleFunctionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      if (filteredFunctions.length === 0) return
      if (e.key === 'ArrowDown') {
        setHighlightedIndex(idx => (idx + 1) % filteredFunctions.length)
      } else if (e.key === 'ArrowUp') {
        setHighlightedIndex(idx => (idx - 1 + filteredFunctions.length) % filteredFunctions.length)
      }
    } else if (e.key === 'Enter') {
      if (showAutocomplete && highlightedIndex >= 0 && highlightedIndex < filteredFunctions.length) {
        handleFunctionSelect(filteredFunctions[highlightedIndex].code)
      } else {
        handleFunctionSelect(functionInput.toUpperCase())
      }
    }
  }

  const handleFunctionSelect = (code: string) => {
    setFunctionInput(code)
    setShowAutocomplete(false)
    setHighlightedIndex(-1)
    if (onFunctionEnter) onFunctionEnter(code)
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

  const [pageTitle, setPageTitle] = useState('Homepage')

  useEffect(() => {
    const currentCodeFromPath = (() => {
      const parts = pathParts()
      if (parts.length === 0) return ''
      return parts[0].toUpperCase()
    })()
    const effectiveCode = functionInput || currentCodeFromPath
    const selectedDesc = FUNCTION_LIST.find(f => f.code === effectiveCode)?.desc || ''
    setPageTitle(effectiveCode === '' ? 'Homepage' : selectedDesc)
  }, [functionInput])

  return (
    <div className="terminal-header bg-bb-panel border-b-bb-border border-b px-0 py-0 relative">
      <div className="flex items-center w-full relative">
        <div className="function-autocomplete relative my-2 w-[360px]">
          <input
            ref={functionInputRef}
            className="function-input-box bg-bb-panel border border-[#3a3a3a] text-slate-100 px-3 py-2 rounded-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bb-blue/40 w-full caret-transparent"
            type="text"
            value={functionInput}
            onChange={handleFunctionInput}
            onKeyDown={handleFunctionKeyDown}
            placeholder="Selecione a função desejada"
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            autoComplete="off"
          />
          {showAutocomplete && (
            <div className="function-autocomplete-list tooltip-below absolute left-0 top-full mt-1 z-50 w-full max-h-72 overflow-auto bg-black border border-[#3a3a3a] shadow-lg">
              {filteredFunctions.map((f, idx) => (
                <div
                  key={f.code + f.desc}
                  className={`function-autocomplete-item px-2 py-1 flex items-center${idx === highlightedIndex ? ' highlighted' : ''}`}
                  onMouseDown={() => handleFunctionSelect(f.code)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={idx === highlightedIndex ? { background: '#FFA028', color: '#000' } : {}}
                >
                  <span
                    className="inline-block min-w-[72px] mr-3"
                    style={idx === highlightedIndex ? { color: '#000' } : { color: '#FFA028' }}
                  >
                    <b>{f.code || 'Homepage'}</b>
                  </span>
                  <span style={idx === highlightedIndex ? { color: '#000' } : { color: '#FFA028' }}>{f.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="!text-[#FFA028] font-bold text-xl md:text-2xl whitespace-nowrap">{pageTitle}</span>
        </div>
        <div className="w-[360px] mr-4" />
      </div>
    </div>
  )
}