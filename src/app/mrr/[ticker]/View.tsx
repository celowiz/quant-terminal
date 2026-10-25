'use client'
import { MRRView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`MRR ${ticker}`)
  return <MRRView ticker={ticker} />
}
