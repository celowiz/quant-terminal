'use client'
import { FAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`FA ${ticker}`)
  return <FAView ticker={ticker} />
}
