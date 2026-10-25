'use client'
import { GIPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`GIP ${ticker}`)
  return <GIPView ticker={ticker} />
}
