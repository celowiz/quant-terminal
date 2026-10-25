'use client'
import { SEAGView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`SEAG ${ticker}`)
  return <SEAGView ticker={ticker} />
}
