'use client'
import { CFView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`CF ${ticker}`)
  return <CFView ticker={ticker} />
}
