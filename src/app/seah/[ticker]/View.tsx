'use client'
import { SEAHView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`SEAH ${ticker}`)
  return <SEAHView ticker={ticker} />
}
