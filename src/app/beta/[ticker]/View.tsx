'use client'
import { BETAView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`BETA ${ticker}`)
  return <BETAView ticker={ticker} />
}
