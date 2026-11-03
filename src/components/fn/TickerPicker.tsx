'use client'
/** Seletor de ativos com busca, compartilhado pelas funções (HS, HRA, COMP, GR, RRG…).
 *  Mesmo universo e mesma busca por código/nome da barra superior, com sugeridos (pares/benchmarks) no topo
 *  e resultados agrupados por classe. Desktop: popover sob o botão; mobile (<1024px): folha em largura total.
 *  Acessível: botão com aria-haspopup=listbox; campo role=combobox + aria-activedescendant; lista role=listbox/option.
 *  Teclado: ↑/↓ navegam, Enter escolhe, Esc fecha (o foco volta ao botão). */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getJSON, type TickerMeta, type TickersFile } from '../../lib/static'
import { lang } from '../../lib/settings'
import { pickerGroups, flatItems, groupLabel, cleanName, shortCode, type PickerMeta } from '../../lib/tickerPicker.mjs'
import tickersJson from '../../../public/data/tickers.json'
import { C, MONO, useDesktop, inputCls, inputStyle } from './kit'
import { tc } from '../../lib/themeRuntime'

const BUNDLED = (tickersJson as unknown as TickersFile).tickers as PickerMeta[]
let live: PickerMeta[] | null = null
/** universo: o tickers.json publicado (mais completo) com o empacotado como reserva imediata */
function useUniverse() {
  const [u, setU] = useState<PickerMeta[]>(live || BUNDLED)
  useEffect(() => {
    if (live) return
    let alive = true
    getJSON<TickersFile>('tickers.json').then(f => {
      const seen = new Set(f.tickers.map(t => t.ticker.toUpperCase()))
      live = [...(f.tickers as TickerMeta[] as PickerMeta[]), ...BUNDLED.filter(t => !seen.has(t.ticker.toUpperCase()))]
      if (alive) setU(live)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return u
}

const L = (en: string, pt: string) => (lang() === 'pt' ? pt : en)

export type TickerPickerProps = {
  /** ticker escolhido; `null` = modo "adicionar" (o botão mostra `addText` e nada fica marcado) */
  value: string | null
  onChange: (ticker: string) => void
  /** rótulo acessível (ex.: "vs", "X (independente)", "Adicionar") */
  label: string
  /** pares/benchmarks sugeridos, na ordem */
  suggested?: string[]
  /** tickers fora da lista (o próprio ativo, os já incluídos) */
  exclude?: string[]
  /** texto do botão (padrão: código curto) */
  display?: (ticker: string) => string
  addText?: string
  /** restringe o universo (ex.: RRG só aceita ativos com histórico semanal) */
  filter?: (m: PickerMeta) => boolean
  disabled?: boolean
  /** id estável para testes/automação */
  testId?: string
  /** botão em largura total (ex.: painel lateral do RRG) */
  block?: boolean
}

export function TickerPicker({ value, onChange, label, suggested = [], exclude = [], display = shortCode, addText, filter, disabled, testId, block }: TickerPickerProps) {
  const desk = useDesktop()
  const all = useUniverse()
  const uni = useMemo(() => (filter ? all.filter(filter) : all), [all, filter])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const id = useId().replace(/:/g, '')
  const listId = `tp-${id}-list`
  const pt = lang() === 'pt'
  const groups = useMemo(() => (open ? pickerGroups(uni, q, { suggested, exclude }) : []), [open, uni, q, suggested.join('|'), exclude.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => flatItems(groups), [groups])
  const optId = (i: number) => `tp-${id}-o-${i}`

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect()
    if (!b) return
    const width = Math.min(380, window.innerWidth - 16)
    const left = Math.max(8, Math.min(b.left, window.innerWidth - width - 8))
    const top = b.bottom + 2
    setPos({ top, left, width, maxH: Math.max(200, Math.min(440, window.innerHeight - top - 8)) })
  }
  const show = (initial = '') => { if (disabled) return; setQ(initial); setActive(0); place(); setOpen(true) }
  const close = (focusBtn = true) => { setOpen(false); setQ(''); if (focusBtn) setTimeout(() => btnRef.current?.focus(), 0) }
  const choose = (t: string) => { onChange(t); close() }

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0) }, [open])
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    if (!open) return
    const el = document.getElementById(optId(active))
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [active, open]) // eslint-disable-line react-hooks/exhaustive-deps
  // desktop: fecha ao clicar fora, reposiciona ao rolar/redimensionar
  useEffect(() => {
    if (!open || !desk) return
    const down = (e: MouseEvent) => {
      const n = e.target as Node
      if (popRef.current?.contains(n) || btnRef.current?.contains(n)) return
      close(false)
    }
    const re = () => place()
    document.addEventListener('mousedown', down)
    window.addEventListener('resize', re); window.addEventListener('scroll', re, true)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true) }
  }, [open, desk]) // eslint-disable-line react-hooks/exhaustive-deps
  // mobile: trava a rolagem da página enquanto a folha está aberta
  useEffect(() => {
    if (!open || desk) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, desk])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Home' && !q) { e.preventDefault(); setActive(0) }
    else if (e.key === 'End' && !q) { e.preventDefault(); setActive(Math.max(0, items.length - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const m = items[active]; if (m) choose(m.ticker) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }
  const onBtnKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show() }
    else if (e.key.length === 1 && /[A-Za-z0-9^=.-]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); show(e.key) }
  }

  const btnText = value ? display(value) : (addText || L('+ Add', '+ Incluir'))
  const nameOf = (m: PickerMeta) => cleanName((pt && m.name_pt) || m.name, m.ticker)
  let k = -1
  const list = (
    <div id={listId} role="listbox" aria-label={label} className="overflow-y-auto overscroll-contain" style={{ maxHeight: desk ? (pos?.maxH || 400) - 34 : undefined, flex: desk ? undefined : '1 1 auto' }}>
      {groups.map(g => (
        <div key={g.group} role="group" aria-labelledby={`tp-${id}-g-${g.group}`}>
          <div id={`tp-${id}-g-${g.group}`} role="presentation" className="sticky top-0 px-2 py-[2px] text-[11px] font-bold uppercase tracking-wide" style={{ background: C.panel2, color: C.muted }}>
            {groupLabel(g.group, pt ? 'pt' : 'en')}{g.total && g.total > g.items.length ? <span className="font-normal normal-case"> · {g.items.length}/{g.total}</span> : null}
          </div>
          {g.items.map(m => {
            k += 1
            const i = k, on = i === active, sel = value != null && m.ticker.toUpperCase() === value.toUpperCase()
            return (
              <div key={m.ticker} id={optId(i)} role="option" aria-selected={on} data-ticker={m.ticker}
                onMouseDown={e => e.preventDefault()} onMouseMove={() => { if (!on) setActive(i) }} onClick={() => choose(m.ticker)}
                className={`flex items-baseline gap-2 px-2 cursor-pointer ${desk ? 'py-[3px]' : 'py-[9px]'}`}
                style={{ background: on ? tc('#2a1a05') : 'transparent', borderLeft: `2px solid ${on ? C.amber : 'transparent'}` }}>
                <span className="font-bold shrink-0" style={{ color: C.amber, minWidth: 64 }}>{shortCode(m.ticker)}</span>
                <span className="min-w-0 truncate" style={{ color: C.text }}>{nameOf(m)}</span>
                {sel && <span className="ml-auto shrink-0" style={{ color: C.up }} aria-hidden>✓</span>}
              </div>
            )
          })}
        </div>
      ))}
      {!items.length && <div className="px-2 py-2" style={{ color: C.muted }}>{L('No asset found', 'Nenhum ativo encontrado')}</div>}
    </div>
  )
  const searchBox = (
    <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
      role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-label={label}
      aria-activedescendant={items[active] ? optId(active) : undefined}
      placeholder={L(`Search ${uni.length} assets: code or name`, `Buscar entre ${uni.length} ativos: código ou nome`)}
      autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done"
      className="w-full bg-black border px-2 outline-none" style={{ borderColor: C.amber, color: C.amber, fontFamily: MONO, fontSize: desk ? 12 : 16, height: desk ? 26 : 40 }} />
  )
  const hint = <div className="px-2 py-[3px] text-[11px] border-t" style={{ color: C.muted, borderColor: C.line }}>{q ? L('↑↓ move · Enter choose · Esc close', '↑↓ navegar · Enter escolher · Esc fechar') : L('Type to search every asset class', 'Digite para buscar em todas as classes')}</div>

  const pop = open && typeof document !== 'undefined' ? createPortal(
    desk ? (
      <div ref={popRef} data-ticker-picker className="fixed z-[1000] border shadow-lg flex flex-col text-[12px]"
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? 360, maxHeight: pos?.maxH, background: C.bg, borderColor: C.amber, fontFamily: MONO }}>
        <div className="p-1">{searchBox}</div>
        {list}
        {hint}
      </div>
    ) : (
      <div data-ticker-picker className="fixed inset-0 z-[1000] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}
        onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
        <div ref={popRef} role="dialog" aria-modal="true" aria-label={label} className="w-full flex flex-col border-t text-[13px]"
          style={{ height: '85dvh', background: C.bg, borderColor: C.amber, fontFamily: MONO }}>
          <div className="flex items-center gap-2 px-2 py-2 border-b" style={{ borderColor: C.line }}>
            <span className="font-bold" style={{ color: C.amber }}>{label}</span>
            <button type="button" onClick={() => close()} className="ml-auto px-3 py-1 border" style={{ borderColor: C.line, color: C.text }} aria-label={L('Close', 'Fechar')}>✕</button>
          </div>
          <div className="p-2">{searchBox}</div>
          {list}
        </div>
      </div>
    ), document.body) : null

  return (
    <>
      <button ref={btnRef} type="button" disabled={disabled} data-testid={testId} data-picker-trigger
        aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${value ? display(value) : btnText}`}
        onClick={() => (open ? close(false) : show())} onKeyDown={onBtnKey}
        className={`${inputCls} flex items-center gap-1 text-left ${block ? 'w-full py-[3px]' : 'max-w-[230px]'}`} style={{ ...inputStyle, cursor: 'pointer' }}>
        <span className="truncate">{btnText}</span><span aria-hidden className={block ? 'ml-auto' : ''} style={{ color: C.muted }}>▾</span>
      </button>
      {pop}
    </>
  )
}
