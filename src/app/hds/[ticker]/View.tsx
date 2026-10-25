'use client'
import { HDSView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`HDS ${ticker}`)
  return <HDSView ticker={ticker} />
}
