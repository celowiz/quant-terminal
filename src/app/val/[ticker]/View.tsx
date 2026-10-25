'use client'
import { VALView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`VAL ${ticker}`)
  return <VALView ticker={ticker} />
}
