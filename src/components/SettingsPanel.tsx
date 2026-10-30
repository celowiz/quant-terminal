'use client'
import { useEffect, useRef } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { getSettings, resetSettings, setSettings, type Settings } from '../lib/settings'
import { t } from '../lib/i18n'
import { trackSetting } from '../lib/track'

type Opt<K extends keyof Settings> = { v: Settings[K]; l: string }

function Row<K extends keyof Settings>({ k, label, opts }: { k: K; label: string; opts: Opt<K>[] }) {
  const cur = getSettings()[k]
  return (
    <div className="py-2 border-b border-[#2a2a2a]" role="radiogroup" aria-label={label}>
      <div className="text-[11px] uppercase tracking-wider text-[#8a8a8a] mb-1">{label}</div>
      <div className="flex gap-0">
        {opts.map(o => {
          const on = cur === o.v
          return (
            <button key={String(o.v)} type="button" role="radio" aria-checked={on}
              onClick={() => {
                if (on) return
                setSettings({ [k]: o.v } as Partial<Settings>); trackSetting(k, String(o.v))
                // cores vêm do tema na importação dos módulos: recarrega para aplicar em gráficos e estilos inline
                if (k === 'theme' || k === 'ud') window.location.reload()
              }}
              className={`flex-1 min-w-0 px-1 py-1 text-[12px] truncate border border-[#3a3a3a] -ml-px first:ml-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA028] ${on ? 'bg-[#FFA028] text-black font-bold' : 'text-[#FFA028] hover:bg-[#1a1205]'}`}>
              {o.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const down = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (ref.current && !ref.current.contains(el) && !el.closest('[data-settings-toggle]')) onClose()
    }
    window.addEventListener('keydown', key); document.addEventListener('mousedown', down)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('mousedown', down) }
  }, [onClose])
  return (
    <div ref={ref} id="qt-settings" data-capture-hide="" role="dialog" aria-label={t('set.title')}
      className="absolute right-2 top-full mt-1 z-[70] w-[280px] max-w-[calc(100vw-16px)] bg-black border border-[#FFA028] shadow-xl shadow-black/70 text-slate-100 font-mono">
      <div className="flex items-center justify-between bg-[#FFA028] text-black px-2 py-1">
        <span className="text-[12px] font-bold tracking-wider uppercase">{t('set.title')}</span>
        <button type="button" aria-label={t('set.close')} onClick={onClose} className="hover:opacity-70"><X className="w-4 h-4" aria-hidden /></button>
      </div>
      <div className="px-3 pb-2">
        <Row k="lang" label={t('set.language')} opts={[{ v: 'en', l: 'English' }, { v: 'pt', l: 'Português' }]} />
        <Row k="num" label={t('set.number')} opts={[{ v: 'en', l: '1,234.56' }, { v: 'pt', l: '1.234,56' }]} />
        <Row k="tz" label={t('set.tz')} opts={[{ v: 'brt', l: t('set.tzBrt') }, { v: 'local', l: t('set.tzLocal') }]} />
        <Row k="theme" label={t('set.theme')} opts={[{ v: 'amber', l: t('set.thAmber') }, { v: 'green', l: t('set.thGreen') }, { v: 'contrast', l: t('set.thContrast') }, { v: 'light', l: t('set.thLight') }]} />
        <Row k="ud" label={t('set.ud')} opts={[{ v: 'std', l: t('set.udStd') }, { v: 'cb', l: t('set.udCb') }]} />
        <button type="button" onClick={() => { const th = getSettings(); resetSettings(); trackSetting('reset'); if (th.theme !== 'amber' || th.ud !== 'std') window.location.reload() }}
          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-[12px] border border-[#3a3a3a] text-slate-200 hover:text-[#FFA028] hover:border-[#FFA028]">
          <RotateCcw className="w-3.5 h-3.5" aria-hidden /> {t('set.reset')}
        </button>
        <p className="mt-2 text-[10px] leading-snug text-[#8a8a8a]">{t('set.note')}</p>
      </div>
    </div>
  )
}
