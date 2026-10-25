'use client'
import { COMPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`COMP ${ticker}`)
  return <COMPView ticker={ticker} />
}
