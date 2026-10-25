import { useEffect } from 'react'

export function usePageTitle(functionName: string) {
  useEffect(() => {
    const title = `celowiz • ${functionName}`
    document.title = title
  }, [functionName])
}
