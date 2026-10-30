'use client'
import { OSAView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`OSA ${ticker}`)
  return <OSAView ticker={ticker} />
}
