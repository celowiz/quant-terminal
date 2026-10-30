'use client'
import { OVMEView } from '@/views/fn/batch2'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`OVME ${ticker}`)
  return <OVMEView ticker={ticker} />
}
