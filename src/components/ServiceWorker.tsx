'use client'
import { useEffect } from 'react'

// Registra o service worker (out/sw.js, gerado no post-build) depois do load.
// ?nosw na URL desregistra e limpa os caches (escape para depuração).
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? '/quant-terminal'
    if (new URLSearchParams(location.search).has('nosw')) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})
      if ('caches' in window) caches.keys().then(ks => ks.filter(k => k.startsWith('qt-')).forEach(k => caches.delete(k))).catch(() => {})
      return
    }
    const reg = () => { navigator.serviceWorker.register(`${bp}/sw.js`, { scope: `${bp}/` }).catch(() => {}) }
    if (document.readyState === 'complete') reg()
    else { window.addEventListener('load', reg, { once: true }); return () => window.removeEventListener('load', reg) }
  }, [])
  return null
}
