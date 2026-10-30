"use client"
import { useState, useRef, useEffect } from 'react'
import { FUNCTION_LIST, fnName } from '../constants/functions'
import { t } from '../lib/i18n'
import { useDesktop } from './fn/kit'
import { pathParts } from '../lib/static'
import { openFunction, UNIVERSE, setActiveTicker } from '../lib/nav'
import { parseCommand, commandTarget } from '../lib/command.mjs'
import { displayTicker } from '../lib/activeTicker.mjs'
import { go } from '../lib/static'
import { navFunction } from '../lib/track'
// Using location-based navigation to stay framework-agnostic

type HeaderProps = {
  functionInput: string
  setFunctionInput: (value: string) => void
  onFunctionEnter?: (code: string) => void
}

export default function Header({ functionInput, setFunctionInput, onFunctionEnter }: HeaderProps) {
  const desk = useDesktop()
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const functionInputRef = useRef<HTMLInputElement | null>(null)

  const [cmdError, setCmdError] = useState('')
  // ao focar, o texto atual (código da tela) fica selecionado: digitar substitui, como num terminal
  const justFocused = useRef(false)
  const CODES = FUNCTION_LIST.map(f => f.code)
  // linha de comando: "PETR4 GP" / "GP PETR4" / "AAPL DES" — quando há um ativo no texto, a lista mostra
  // as funções (filtradas pelo resto do texto) que abrem com esse ativo
  const cmd = parseCommand(functionInput, UNIVERSE, CODES)
  const curCode = (pathParts()[0] || '').toUpperCase()
  const target = commandTarget(cmd, curCode)
  const fnQuery = cmd.ticker ? [cmd.code, ...cmd.unknown].filter(Boolean).join(' ') : functionInput
  const filteredFunctions = FUNCTION_LIST.filter((f) => {
    if (cmd.ticker && f.code === '') return false
    if (cmd.ticker && cmd.code) return f.code === cmd.code
    const q = fnQuery.trim()
    return f.code === '' || f.code.includes(q.toUpperCase()) || f.desc.toLowerCase().includes(q.toLowerCase()) || f.pt.toLowerCase().includes(q.toLowerCase())
  })

  const runCommand = (code: string, ticker: string) => {
    const tg = commandTarget({ code, ticker, unknown: [] }, curCode)
    if (!tg) return
    if (ticker) setActiveTicker(ticker)
    setFunctionInput(tg.code === 'HOME' ? '' : tg.code)
    setShowAutocomplete(false)
    setHighlightedIndex(-1)
    if (onFunctionEnter) onFunctionEnter(tg.code)
    navFunction('command', tg.code || 'HOME')
    go(tg.path)
  }

  // Ctrl+K / ⌘K (e "/" fora de campos de texto) focam a linha de comando em qualquer tela
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        const el = functionInputRef.current
        if (el) { el.focus(); el.select(); setShowAutocomplete(true) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleFunctionInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFunctionInput(e.target.value.toUpperCase())
    setCmdError('')
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
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false); (e.target as HTMLInputElement).blur()
    } else if (e.key === 'Enter') {
      if (showAutocomplete && highlightedIndex >= 0 && highlightedIndex < filteredFunctions.length) {
        handleFunctionSelect(filteredFunctions[highlightedIndex].code)
      } else if (target) {
        runCommand(target.code, target.ticker)
      } else if (cmd.ticker && filteredFunctions.length) {
        runCommand(filteredFunctions[0].code, cmd.ticker)
      } else if (/\s/.test(functionInput.trim()) || cmd.unknown.length) {
        setCmdError(cmd.unknown.join(' ') || functionInput.trim())
        setShowAutocomplete(true)
      } else {
        handleFunctionSelect(functionInput.toUpperCase())
      }
    }
  }

  const handleFunctionSelect = (code: string) => {
    if (cmd.ticker) { runCommand(code, cmd.ticker); return }
    setFunctionInput(code)
    setShowAutocomplete(false)
    setHighlightedIndex(-1)
    if (onFunctionEnter) onFunctionEnter(code)
    // um único destino: a função com o ativo corrente quando ela aceita ativo (antes havia dois go()
    // seguidos e o segundo, sem ticker, vencia — o ativo se perdia ao trocar GP → GPC)
    openFunction(code, 'command')
  }

  const [pageTitle, setPageTitle] = useState(() => fnName(FUNCTION_LIST[0]))

  useEffect(() => {
    const currentCodeFromPath = (() => {
      const parts = pathParts()
      if (parts.length === 0) return ''
      return parts[0].toUpperCase()
    })()
    const effectiveCode = functionInput || currentCodeFromPath
    const sel = FUNCTION_LIST.find(f => f.code === effectiveCode)
    setPageTitle(sel ? fnName(sel) : '')
  }, [functionInput])

  return (
    <div className="terminal-header bg-bb-panel border-b-bb-border border-b px-0 py-0 relative max-lg:w-[120px] md:max-lg:w-[220px] max-lg:shrink-0 max-lg:border-b-0">
      <div className="flex items-center w-full relative">
        <div className="function-autocomplete relative my-2 w-[360px] max-lg:w-full max-lg:my-0">
          <input
            ref={functionInputRef}
            className="function-input-box bg-bb-panel border border-[#3a3a3a] text-slate-100 px-3 py-2 rounded-none placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bb-blue/40 w-full caret-[#FFA028] max-lg:h-11 max-lg:py-0 max-lg:px-2 max-lg:text-[13px]"
            type="text"
            value={functionInput}
            onChange={handleFunctionInput}
            onKeyDown={handleFunctionKeyDown}
            placeholder={desk ? t('hdr.fnPlaceholder') : t('hdr.fnPlaceholderShort')}
            onFocus={(e) => { setShowAutocomplete(true); e.currentTarget.select(); justFocused.current = true }}
            onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false } }}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            autoComplete="off"
          />
          {showAutocomplete && (
            <div className="function-autocomplete-list tooltip-below absolute left-0 top-full mt-1 z-50 w-full max-lg:w-[min(360px,calc(100vw-8px))] max-h-72 overflow-auto bg-black border border-[#3a3a3a] shadow-lg">
              {cmdError ? (
                <div role="alert" className="px-2 py-1 text-[12px] text-[#ff5a5a] border-b border-[#3a3a3a]">{t('cmd.unknown').replace('{x}', cmdError)}</div>
              ) : cmd.ticker ? (
                <div data-cmd-preview className="px-2 py-1 text-[12px] border-b border-[#3a3a3a] text-[#d9d9d9]">
                  <span className="text-[#FFA028] font-bold">{displayTicker(cmd.ticker)}</span>{' '}
                  {target ? <>· <b className="text-[#FFA028]">{target.code}</b> {fnName(FUNCTION_LIST.find(f => f.code === target.code) || FUNCTION_LIST[0])} <span className="text-[#8a8a8a]">↵{target.note ? ' · ' + t(target.note === 'noTicker' ? 'cmd.noTicker' : 'cmd.notCovered') : ''}</span></> : <span className="text-[#8a8a8a]">{t('cmd.pickFn')}</span>}
                </div>
              ) : !functionInput ? (
                <div className="px-2 py-1 text-[11px] text-[#8a8a8a] border-b border-[#3a3a3a]">{t('cmd.tip')}</div>
              ) : null}
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
                    <b>{f.code || 'HOME'}</b>
                  </span>
                  <span style={idx === highlightedIndex ? { color: '#000' } : { color: '#FFA028' }}>{fnName(f)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center max-lg:hidden">
          <span className="!text-[#FFA028] font-bold text-xl md:text-2xl whitespace-nowrap">{pageTitle}</span>
        </div>
        <div className="w-[360px] mr-4 max-lg:hidden" />
      </div>
    </div>
  )
}