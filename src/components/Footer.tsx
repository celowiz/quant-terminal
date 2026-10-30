'use client'
import { useJSON } from './fn/kit'
import { t } from '../lib/i18n'
import { getSettings } from '../lib/settings'

/** horário de geração dos dados (generated_at do pipeline), em BRT ou no fuso local conforme Settings */
function fmtStamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const { lang, tz } = getSettings()
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
  if (tz === 'brt') opts.timeZone = 'America/Sao_Paulo'
  const s = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', opts).format(d)
  const zone = tz === 'brt' ? 'BRT' : (new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '')
  return `${s} ${zone}`.trim()
}

export default function Footer() {
  const { data } = useJSON<{ generated_at?: string }>('tickers.json')
  const stamp = data?.generated_at ? fmtStamp(data.generated_at) : null
  return (
    <footer className="w-full bg-bb-bg bg-[#0b0c10] text-bb-accent text-[#FFA028] text-center py-4 lg:py-1.5 shrink-0 font-sans font-medium text-base">
      <span className="block font-mono text-xs text-[#8a8a8a]">
        {t('foot.builtBy')} <a className="underline decoration-dotted hover:text-slate-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#8a8a8a]" href="https://celowiz.github.io/" target="_blank" rel="noopener noreferrer">Marcelo Wizenberg</a> · &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span>
      </span>
      <span className="block text-xs text-[#8a8a8a] mt-1 lg:mt-0">
        {t('foot.data')} <a className="underline" href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a>
        {stamp && <> · {t('foot.updated')} {stamp}</>}
      </span>
    </footer>
  )
}
