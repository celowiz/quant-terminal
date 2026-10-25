import { useEffect } from 'react'

export function usePageTitle(functionName: string) {
  useEffect(() => {
    const title = `Quant Terminal · ${functionName} — Marcelo Wizenberg`
    document.title = title
  }, [functionName])
}
