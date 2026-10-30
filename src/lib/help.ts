/** Store mínimo do conteúdo de ajuda da tela atual: FnScreen registra código, nota e fonte;
 *  o botão "?" da TopBar abre o modal com a metodologia. */
import type React from 'react'

export type HelpEntry = { code: string; note?: React.ReactNode; source?: React.ReactNode }
let cur: HelpEntry | null = null
const subs = new Set<() => void>()

export const setHelp = (e: HelpEntry | null) => { cur = e; subs.forEach(f => f()) }
export const getHelp = () => cur
export const subscribeHelp = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
