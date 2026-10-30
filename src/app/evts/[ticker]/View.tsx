'use client'
import { EVTSView } from '@/views/fn/batch2'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`EVTS ${ticker}`)
  return <EVTSView ticker={ticker} />
}
