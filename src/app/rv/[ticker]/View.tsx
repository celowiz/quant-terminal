'use client'
import { RVView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`RV ${ticker}`)
  return <RVView ticker={ticker} />
}
