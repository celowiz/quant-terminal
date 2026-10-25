'use client'
import { GRView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`GR ${ticker}`)
  return <GRView ticker={ticker} />
}
