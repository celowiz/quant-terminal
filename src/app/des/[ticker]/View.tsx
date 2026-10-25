'use client'
import { DESView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`DES ${ticker}`)
  return <DESView ticker={ticker} />
}
