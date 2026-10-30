'use client'
// 404.html do export estático. O GitHub Pages serve este arquivo para qualquer caminho sem página gerada:
// os ativos da cobertura ampliada (S&P 500, FIIs, BDRs, ETFs B3, criptos — `ext` no tickers.json) não têm
// página por ticker (controla o tamanho do deploy); aqui /<fn>/<TICKER>/ renderiza a mesma View no navegador.
import dynamic from 'next/dynamic'
import { useEffect, useState, type ComponentType } from 'react'
import { pathParts } from '../lib/static'
import { TICKERS } from '../lib/universe'
import { acceptsTicker, covers } from '../lib/activeTicker.mjs'
import { t } from '../lib/i18n'

type V = ComponentType<{ ticker: string }>
const VIEWS: Record<string, V> = {
  BETA: dynamic(() => import('./beta/[ticker]/View'), { ssr: false }) as V,
  CF: dynamic(() => import('./cf/[ticker]/View'), { ssr: false }) as V,
  CN: dynamic(() => import('./cn/[ticker]/View'), { ssr: false }) as V,
  COMP: dynamic(() => import('./comp/[ticker]/View'), { ssr: false }) as V,
  DES: dynamic(() => import('./des/[ticker]/View'), { ssr: false }) as V,
  DVD: dynamic(() => import('./dvd/[ticker]/View'), { ssr: false }) as V,
  DY: dynamic(() => import('./dy/[ticker]/View'), { ssr: false }) as V,
  EVTS: dynamic(() => import('./evts/[ticker]/View'), { ssr: false }) as V,
  FA: dynamic(() => import('./fa/[ticker]/View'), { ssr: false }) as V,
  FUND: dynamic(() => import('./fund/[ticker]/View'), { ssr: false }) as V,
  GIP: dynamic(() => import('./gip/[ticker]/View'), { ssr: false }) as V,
  GP: dynamic(() => import('./gp/[ticker]/View'), { ssr: false }) as V,
  GPC: dynamic(() => import('./gpc/[ticker]/View'), { ssr: false }) as V,
  GR: dynamic(() => import('./gr/[ticker]/View'), { ssr: false }) as V,
  HDS: dynamic(() => import('./hds/[ticker]/View'), { ssr: false }) as V,
  HP: dynamic(() => import('./hp/[ticker]/View'), { ssr: false }) as V,
  HRA: dynamic(() => import('./hra/[ticker]/View'), { ssr: false }) as V,
  HS: dynamic(() => import('./hs/[ticker]/View'), { ssr: false }) as V,
  MACD: dynamic(() => import('./macd/[ticker]/View'), { ssr: false }) as V,
  MRR: dynamic(() => import('./mrr/[ticker]/View'), { ssr: false }) as V,
  OMON: dynamic(() => import('./omon/[ticker]/View'), { ssr: false }) as V,
  OVME: dynamic(() => import('./ovme/[ticker]/View'), { ssr: false }) as V,
  DCF: dynamic(() => import('./dcf/[ticker]/View'), { ssr: false }) as V,
  OSA: dynamic(() => import('./osa/[ticker]/View'), { ssr: false }) as V,
  IVS: dynamic(() => import('./ivs/[ticker]/View'), { ssr: false }) as V,
  RSI: dynamic(() => import('./rsi/[ticker]/View'), { ssr: false }) as V,
  RV: dynamic(() => import('./rv/[ticker]/View'), { ssr: false }) as V,
  SEAG: dynamic(() => import('./seag/[ticker]/View'), { ssr: false }) as V,
  SEAH: dynamic(() => import('./seah/[ticker]/View'), { ssr: false }) as V,
  SPLIT: dynamic(() => import('./split/[ticker]/View'), { ssr: false }) as V,
  TRA: dynamic(() => import('./tra/[ticker]/View'), { ssr: false }) as V,
  VAL: dynamic(() => import('./val/[ticker]/View'), { ssr: false }) as V,
  VOL: dynamic(() => import('./vol/[ticker]/View'), { ssr: false }) as V,
}
const KNOWN = new Set(TICKERS.map(m => m.ticker.toUpperCase()))

/** /<fn>/<TICKER>/ que este fallback atende: função com ativo + ticker do seletor coberto pela função */
type Route = { code: string; ticker: string; covered: boolean }
function fallbackRoute(parts: string[]): Route | null {
  if (parts.length !== 2) return null
  const code = parts[0].toUpperCase(), ticker = parts[1].toUpperCase()
  if (!acceptsTicker(code) || !VIEWS[code] || !KNOWN.has(ticker)) return null
  return { code, ticker, covered: covers(code, ticker) }
}

export default function NotFound() {
  const [route, setRoute] = useState<Route | null | undefined>(undefined)
  useEffect(() => { setRoute(fallbackRoute(pathParts())) }, [])
  if (route === undefined) return null
  if (route?.covered) { const View = VIEWS[route.code]; return <View ticker={route.ticker} /> }
  return (
    <div className="px-6 py-10 text-[#FFA028] font-mono">
      <div className="text-2xl font-bold">{route ? `${route.code} · ${route.ticker}` : '404'}</div>
      <p className="mt-2 text-slate-300">{t(route ? 'nf.noData' : 'nf.msg')}</p>
      <a className="mt-4 inline-block underline" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>{t('nf.home')}</a>
    </div>
  )
}
