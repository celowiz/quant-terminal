'use client'
import { DYView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`DY ${ticker}`)
  return <DYView ticker={ticker} />
}
