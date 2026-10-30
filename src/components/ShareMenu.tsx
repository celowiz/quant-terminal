'use client'
import { tc } from '../lib/themeRuntime'
import { useEffect, useRef } from 'react'
import { Image as ImageIcon, Link2 } from 'lucide-react'
import { t } from '../lib/i18n'
import { currentRoute, trackShare } from '../lib/track'

/** toast curto no estilo do terminal (fora da captura) */
export function toast(msg: string, ms = 2200) {
  if (typeof document === 'undefined') return
  document.getElementById('qt-toast')?.remove()
  const el = document.createElement('div')
  el.id = 'qt-toast'
  el.setAttribute('role', 'status')
  el.setAttribute('data-capture-hide', '')
  el.className = 'fixed left-1/2 -translate-x-1/2 bottom-12 z-[90] px-3 py-1 bg-black border border-[#FFA028] text-[#FFA028] text-[12px] font-mono shadow-lg shadow-black/70'
  el.textContent = msg
  document.body.appendChild(el)
  window.setTimeout(() => el.remove(), ms)
}

const deepLink = () => `${window.location.origin}${window.location.pathname}${window.location.search}`

const fileName = () => {
  const r = currentRoute()
  const d = new Date()
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return ['quant-terminal', r.functionCode, r.ticker.replace(/[^A-Z0-9.^-]/gi, ''), ymd].filter(Boolean).join('_') + '.png'
}

/** PNG da tela inteira (barras, tela da função com gráficos, rodapé), sem popovers/toast */
async function captureScreen(): Promise<Blob> {
  const { domToBlob } = await import('modern-screenshot')
  const root = document.documentElement
  // barras de rolagem viram "clássicas" dentro do SVG da captura e roubam espaço: esconde só durante a captura
  const st = document.createElement('style')
  st.textContent = '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}'
  document.head.appendChild(st)
  // telas podem ter um layout próprio de captura (ex.: CAL recolhe o painel e tira os selos de status)
  root.classList.add('qt-capturing')
  await new Promise<void>(r => window.setTimeout(r, 300))
  const blob = await domToBlob(root, {
    scale: 2,
    backgroundColor: tc('#0b0c10'),
    width: root.clientWidth,
    height: Math.max(document.body.scrollHeight, window.innerHeight),
    filter: (n: Node) => !(n instanceof Element && n.hasAttribute('data-capture-hide')),
  }).finally(() => { st.remove(); root.classList.remove('qt-capturing') })
  if (!blob) throw new Error('empty capture')
  return blob
}

function download(blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName()
  document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export default function ShareMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const down = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (ref.current && !ref.current.contains(el) && !el.closest('[data-share-toggle]')) onClose()
    }
    window.addEventListener('keydown', key); document.addEventListener('mousedown', down)
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('mousedown', down) }
  }, [onClose])

  const copyLink = async () => {
    onClose()
    try { await navigator.clipboard.writeText(deepLink()); toast(t('share.copiedLink')) }
    catch { window.prompt(t('share.link'), deepLink()) }
    trackShare('link')
  }

  const copyImage = async () => {
    onClose()
    toast(t('share.working'), 8000)
    // espera o menu sair da tela antes de capturar (a Promise é criada já, dentro do gesto do usuário)
    const blobP = new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))).then(captureScreen)
    const CI = (window as any).ClipboardItem
    if (CI && navigator.clipboard?.write) {
      try {
        // Safari exige o ClipboardItem criado ainda no gesto do usuário (com a Promise)
        await navigator.clipboard.write([new CI({ 'image/png': blobP })])
        toast(t('share.copiedImage')); trackShare('image'); return
      } catch { /* cai no download */ }
    }
    try { download(await blobP); toast(t('share.downloaded'), 3500); trackShare('image_download') }
    catch { toast(t('share.failed')) }
  }

  const item = 'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-slate-100 hover:bg-[#1a1205] hover:text-[#FFA028] focus:outline-none focus-visible:bg-[#1a1205]'
  return (
    <div ref={ref} id="qt-share" role="menu" aria-label={t('share.title')} data-capture-hide=""
      className="absolute right-2 top-full mt-1 z-[70] w-[200px] bg-black border border-[#FFA028] shadow-xl shadow-black/70 font-mono">
      <div className="bg-[#FFA028] text-black px-2 py-1 text-[12px] font-bold tracking-wider uppercase">{t('share.title')}</div>
      <button type="button" role="menuitem" className={item} onClick={copyLink}><Link2 className="w-4 h-4 text-[#FFA028]" aria-hidden />{t('share.link')}</button>
      <button type="button" role="menuitem" className={item} onClick={copyImage}><ImageIcon className="w-4 h-4 text-[#FFA028]" aria-hidden />{t('share.image')}</button>
    </div>
  )
}
