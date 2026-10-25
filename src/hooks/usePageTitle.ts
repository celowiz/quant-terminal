import { useEffect } from 'react'
import { FUNCTION_LIST, fnName } from '../constants/functions'

/** título da aba: aceita o código (ex.: 'BTMM') ou o nome; códigos viram o nome no idioma atual */
export function usePageTitle(functionName: string) {
  useEffect(() => {
    const [code, ...rest] = functionName.split(' ')
    const f = FUNCTION_LIST.find(x => x.code && x.code === code.toUpperCase())
    const name = f ? [f.code, rest.join(' '), fnName(f)].filter(Boolean).join(' ') : functionName
    document.title = `Quant Terminal · ${name} — Marcelo Wizenberg`
  }, [functionName])
}
