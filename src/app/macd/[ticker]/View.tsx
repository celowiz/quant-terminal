'use client'
import { MACDView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`MACD ${ticker}`)
  return <MACDView ticker={ticker} />
}
