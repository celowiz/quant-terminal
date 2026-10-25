'use client'
import { OMONView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function View({ ticker }: { ticker: string }) {
  usePageTitle(`OMON ${ticker}`)
  return <OMONView ticker={ticker} />
}
