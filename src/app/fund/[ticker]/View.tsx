'use client'
import { FUNDView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`FUND ${ticker}`)
  return <FUNDView ticker={ticker} />
}
