'use client'
import { RSIView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`RSI ${ticker}`)
  return <RSIView ticker={ticker} />
}
