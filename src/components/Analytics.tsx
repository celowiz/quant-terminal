'use client'
import { useEffect } from 'react'
import { buildOutboundParams, initGoogleAnalytics, scheduleGtagScriptLoad, trackEvent, trackRouteLoad } from '../lib/analytics.mjs'
import { currentRoute } from '../lib/track'

/** GA4 (sem UI): page_view virtual + function_open/ticker_select da carga, outbound_click global. */
export default function Analytics() {
  useEffect(() => {
    initGoogleAnalytics()
    trackRouteLoad(currentRoute())
    scheduleGtagScriptLoad()
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const p = buildOutboundParams(a.href, window.location.host)
      if (p) trackEvent('outbound_click', { ...p, transport_type: 'beacon' })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
