'use client'
import { IVSView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`IVS ${ticker}`)
  return <IVSView ticker={ticker} />
}
