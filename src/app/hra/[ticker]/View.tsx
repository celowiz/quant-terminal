'use client'
import { HRAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`HRA ${ticker}`)
  return <HRAView ticker={ticker} />
}
