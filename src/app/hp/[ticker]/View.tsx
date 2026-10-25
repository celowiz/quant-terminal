'use client'
import { HPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`HP ${ticker}`)
  return <HPView ticker={ticker} />
}
