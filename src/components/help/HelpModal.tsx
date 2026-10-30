'use client'
/** Modal de metodologia da função atual (botão "?" da TopBar). KaTeX renderiza as fórmulas em HTML estático. */
import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { X } from 'lucide-react'
import { FUNCTION_LIST } from '@/constants/functions'
import { HELP } from '@/lib/helpContent'
import { getHelp, subscribeHelp } from '@/lib/help'
import { getRefs, subscribeRefs } from '@/lib/refDates'
import { en } from '@/lib/enText'
import { lang } from '@/lib/settings'
import { t } from '@/lib/i18n'

const tex = (s: string) => { try { return katex.renderToString(s, { displayMode: true, throwOnError: false, output: 'html' }) } catch { return s } }
/** Traduz strings também dentro de fragmentos/elementos (notas e fontes às vezes chegam como JSX). */
const tr = (n: React.ReactNode): React.ReactNode => {
  if (typeof n === 'string') return en(n)
  if (Array.isArray(n)) return n.map((x, i) => <React.Fragment key={i}>{tr(x)}</React.Fragment>)
  if (React.isValidElement(n)) { const p: any = n.props; return p && 'children' in p ? React.cloneElement(n as any, undefined, tr(p.children)) : n }
  return n
}

export default function HelpModal({ code, onClose }: { code: string; onClose: () => void }) {
  const reg = useSyncExternalStore(subscribeHelp, getHelp, () => null)
  const refs = useSyncExternalStore(subscribeRefs, getRefs, () => [])
  const c = (reg?.code || code || 'HOME').toUpperCase()
  const pt = lang() === 'pt'
  const fi = FUNCTION_LIST.find(f => f.code === c)
  const doc = HELP[c]
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); box.current?.focus()
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const note = reg?.code?.toUpperCase() === c ? reg.note : undefined
  const source = reg?.code?.toUpperCase() === c ? reg.source : undefined
  const intro = doc ? (pt ? doc.pt : doc.en) : fi ? `${pt ? fi.pt : fi.desc}.` : (pt ? HELP.HOME.pt : HELP.HOME.en)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} data-audit-help>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="qt-help-title" id="qt-help"
        className="w-full max-w-[760px] max-h-[86vh] overflow-y-auto border border-[#333] bg-[#0b0b0b] text-[#d9d9d9] font-mono text-[13px] leading-relaxed outline-none shadow-2xl">
        <div className="sticky top-0 flex items-center gap-2 border-b border-[#333] bg-[#111] px-3 py-2">
          <span className="font-bold text-[#FFA028]">{c === 'HOME' ? 'QT' : c}</span>
          <span id="qt-help-title" className="text-white">{fi ? (pt ? fi.pt : fi.desc) : 'Quant Terminal'} — {t('help.title')}</span>
          <button type="button" onClick={onClose} aria-label={t('help.close')} className="ml-auto p-1 text-[#FFA028] hover:text-white"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p>{intro}</p>
          {doc?.formulas?.length ? <div className="space-y-2">
            <div className="text-[12px] font-bold text-[#FFA028]">{t('help.formulas')}</div>
            {doc.formulas.map((f, i) => <div key={i} className="border border-[#222] bg-[#070707] px-3 py-1">
              <div className="overflow-x-auto text-white katex-qt" dangerouslySetInnerHTML={{ __html: tex(f.tex) }} />
              {(pt ? f.pt : f.en) && <div className="pb-1 text-[12px] text-[#9a9a9a]">{pt ? f.pt : f.en}</div>}
            </div>)}
          </div> : null}
          {note && <div><div className="text-[12px] font-bold text-[#FFA028]">{t('help.notes')}</div><div className="text-[12px] text-[#bdbdbd]">{tr(note)}</div></div>}
          {source && <div><div className="text-[12px] font-bold text-[#FFA028]">{t('fn.source')}</div><div className="text-[12px] text-[#bdbdbd]">{tr(source)}</div></div>}
          {refs.length > 0 && <div data-help-refs><div className="text-[12px] font-bold text-[#FFA028]">{t('ref.title')}</div>
            <ul className="text-[12px] text-[#bdbdbd]">{refs.map(r => <li key={r.path}>
              <span className="text-[#8a8a8a]">{r.path.replace(/\.json$/, '')}</span>: {r.kind === 'generated' ? `${t('ref.generated')} ` : ''}<span className="text-white">{`${r.date.slice(8, 10)}/${r.date.slice(5, 7)}/${r.date.slice(0, 4)}`}</span>{r.official ? <span className="text-[#3DDC84]"> — {t('ref.official')}</span> : null}
            </li>)}</ul></div>}
          <div className="border-t border-[#222] pt-2 text-[11px] text-[#777]">{t('fn.edu')}</div>
        </div>
      </div>
    </div>
  )
}
