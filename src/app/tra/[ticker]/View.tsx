'use client'
import { TRAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`TRA ${ticker}`)
  return <TRAView ticker={ticker} />
}
