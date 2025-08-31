import { useEffect } from 'react'

export function usePageTitle(functionName: string) {
  useEffect(() => {
    const title = `celowizBBG • ${functionName}`
    document.title = title
  }, [functionName])
}
