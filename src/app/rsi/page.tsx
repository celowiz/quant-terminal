'use client'
import { RSIView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('RSI')
  return <RSIView ticker="PETR4.SA" />
}
