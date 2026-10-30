'use client'
/** LP — Launchpad: 2 ou 4 painéis lado a lado no desktop (cada um é um terminal completo num iframe da
 *  mesma origem, renderizado a 1024px virtuais e reduzido para caber). Layout salvo no localStorage e na URL.
 *  No celular/tablet estreito vira abas com um painel por vez. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { C, FnScreen, Btns, Field, useDesktop } from '../../components/fn/kit'
import { FUNCTION_LIST } from '../../constants/functions'
import { BASE_PATH, href } from '../../lib/static'
import { lang } from '../../lib/settings'
import { t } from '../../lib/i18n'
import { DEFAULT_STATE, STORAGE_KEY, encodeState, initialState, normalizeState, sanitizePanel, type LpState } from '../../lib/launchpad.mjs'

const CODES = FUNCTION_LIST.map(f => f.code)
const VW = 1024 // largura virtual de cada painel no desktop (layout "lg" da página embutida)
const label = (p: string) => { const [fn, tk] = p.split('/'); return { fn: fn.toUpperCase(), tk: tk ? tk.replace(/\.SA$/, '') : '' } }
const fnDesc = (code: string) => { const f = FUNCTION_LIST.find(x => x.code === code); return f ? (lang() === 'pt' ? f.pt : f.desc) : '' }

function Frame({ path, gen, idx, desktop, onNav, show = true }: {
  path: string; gen: number; idx: number; desktop: boolean; onNav: (i: number, p: string) => void; show?: boolean
}) {
  const box = useRef<HTMLDivElement | null>(null), fr = useRef<HTMLIFrameElement | null>(null)
  const [sz, setSz] = useState({ w: 0, h: 0 })
  // src só muda quando o usuário restaura o layout (gen); navegação dentro do painel não recarrega o iframe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => href(`/${path}/`), [gen])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSz({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    // navegação interna do Next é pushState (sem evento load): lê o caminho do painel periodicamente
    const id = window.setInterval(() => {
      try {
        const p = fr.current?.contentWindow?.location.pathname
        const s = p && sanitizePanel(p, CODES, BASE_PATH)
        if (s) onNav(idx, s)
      } catch { /* outra origem: ignora */ }
    }, 700)
    return () => window.clearInterval(id)
  }, [idx, onNav])
  const k = desktop && sz.w > 0 ? Math.min(1, sz.w / VW) : 1
  const { fn, tk } = label(path)
  return (
    <div className={`flex-1 flex flex-col min-h-0 min-w-0 border ${show ? '' : 'hidden'}`} style={{ borderColor: C.line, background: C.bg }} data-lp-panel={idx + 1}>
      <div className="flex items-center gap-2 px-2 h-[22px] shrink-0 text-[12px] border-b" style={{ borderColor: C.line, background: C.panel }}>
        <span className="font-bold" style={{ color: C.muted }}>{idx + 1}</span>
        <span className="font-bold" style={{ color: C.amber }}>{fn}</span>
        {tk && <span style={{ color: C.text }}>{tk}</span>}
        <span className="truncate min-w-0" style={{ color: C.muted }}>{fnDesc(fn)}</span>
        <a href={href(`/${path}/`)} target="_top" className="ml-auto shrink-0 hover:opacity-70" title={t('lp.open')} aria-label={`${t('lp.open')}: ${fn} ${tk}`} style={{ color: C.amber }}>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
      <div ref={box} className="relative flex-1 min-h-0 overflow-hidden">
        {sz.w > 0 && (
          <iframe ref={fr} src={src} title={`${t('lp.panel')} ${idx + 1}: ${fn} ${tk}`}
            className="absolute left-0 top-0 border-0"
            style={{ width: sz.w / k, height: sz.h / k, transform: k < 1 ? `scale(${k})` : undefined, transformOrigin: '0 0', background: C.bg }} />
        )}
      </div>
    </div>
  )
}

export function LPView() {
  const desktop = useDesktop()
  const [st, setSt] = useState<LpState | null>(null)
  const [gen, setGen] = useState(0), [tab, setTab] = useState(0)
  const [nested, setNested] = useState(false)
  useEffect(() => {
    if (window.self !== window.top) { setNested(true); return }
    let stored: string | null = null
    try { stored = localStorage.getItem(STORAGE_KEY) } catch { /* modo privado */ }
    setSt(initialState(window.location.search, stored, CODES))
  }, [])
  useEffect(() => {
    if (!st) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)) } catch { /* modo privado */ }
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${encodeState(st)}`)
  }, [st])
  const onNav = useMemo(() => (i: number, p: string) => setSt(s => (!s || s.panels[i] === p ? s : { ...s, panels: s.panels.map((x, j) => (j === i ? p : x)) })), [])
  const right = st && (
    <>
      <Field label={t('lp.title')}>
        <Btns opts={[{ v: 2, l: `2 ${t('lp.panels')}` }, { v: 4, l: `4 ${t('lp.panels')}` }]} value={st.n} onChange={n => { setSt({ ...st, n }); setTab(x => Math.min(x, n - 1)) }} />
      </Field>
      <button type="button" onClick={() => { setSt(normalizeState(DEFAULT_STATE, CODES)); setGen(g => g + 1); setTab(0) }}
        className="flex items-center gap-1 px-2 py-0.5 border hover:opacity-80" style={{ borderColor: C.line, color: C.amber }}>
        <RotateCcw className="w-3.5 h-3.5" aria-hidden /> {t('lp.reset')}
      </button>
    </>
  )
  if (nested) return <div className="p-4 text-[13px]" style={{ color: C.muted }}>LP · <a href={href('/lp/')} target="_top" style={{ color: C.amber }}>{t('lp.title')}</a></div>
  const panels = st ? st.panels.slice(0, st.n) : []
  return (
    <FnScreen code="LP" title="Launchpad" right={right} fill>
      {!desktop && st && (
        <div className="flex gap-0 mb-1 shrink-0 overflow-x-auto" role="tablist" aria-label={t('lp.title')}>
          {panels.map((p, i) => {
            const { fn, tk } = label(p), on = i === tab
            return (
              <button key={i} type="button" role="tab" aria-selected={on} onClick={() => setTab(i)}
                className="px-2 py-1 text-[12px] border -ml-px first:ml-0 whitespace-nowrap"
                style={{ borderColor: C.line, background: on ? C.amber : 'transparent', color: on ? C.bg : C.amber }}>
                {i + 1} {fn}{tk ? ` ${tk}` : ''}
              </button>
            )
          })}
        </div>
      )}
      {st && (
        <div className={desktop ? 'grid gap-1 flex-1 min-h-0' : 'flex flex-col h-[calc(100dvh-190px)] min-h-[440px]'}
          style={desktop ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: st.n === 4 ? '1fr 1fr' : '1fr' } : undefined}>
          {panels.map((p, i) => (
            <Frame key={`${i}-${gen}`} path={p} gen={gen} idx={i} desktop={desktop} onNav={onNav} show={desktop || i === tab} />
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px] shrink-0 max-lg:hidden" style={{ color: C.muted }}>{t('lp.hint')}</p>
    </FnScreen>
  )
}
