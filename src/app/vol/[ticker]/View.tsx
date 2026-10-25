'use client'
import { VOLView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`VOL ${ticker}`)
  return <VOLView ticker={ticker} />
}
