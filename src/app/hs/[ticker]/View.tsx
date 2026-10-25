'use client'
import { HSView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`HS ${ticker}`)
  return <HSView ticker={ticker} />
}
