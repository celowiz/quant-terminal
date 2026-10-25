'use client'
import { SPLITView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`SPLIT ${ticker}`)
  return <SPLITView ticker={ticker} />
}
