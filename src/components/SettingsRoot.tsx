'use client'
import { Fragment, useEffect, useState } from 'react'
import { applySilently, getSettings, readStored, sameSettings, subscribe } from '../lib/settings'

/** Aplica as preferências salvas depois da hidratação e remonta a interface quando mudam
 *  (formatadores de número e gráficos leem as preferências na renderização/criação). */
export default function SettingsRoot({ children }: { children: React.ReactNode }) {
  const [ver, setVer] = useState(0)
  useEffect(() => {
    const sync = () => { document.documentElement.lang = getSettings().lang === 'pt' ? 'pt-BR' : 'en' }
    const stored = readStored()
    if (!sameSettings(stored, getSettings())) { applySilently(stored); setVer(v => v + 1) }
    sync()
    return subscribe(() => { sync(); setVer(v => v + 1) })
  }, [])
  return <Fragment key={ver}>{children}</Fragment>
}
