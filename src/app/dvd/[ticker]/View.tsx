'use client'
import { DVDView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`DVD ${ticker}`)
  return <DVDView ticker={ticker} />
}
