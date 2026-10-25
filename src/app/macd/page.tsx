'use client'
import { MACDView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('MACD')
  return <MACDView ticker="PETR4.SA" />
}
