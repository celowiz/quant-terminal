'use client'
import { DCFView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`DCF ${ticker}`)
  return <DCFView ticker={ticker} />
}
