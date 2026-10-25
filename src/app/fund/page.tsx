'use client'
import { FUNDView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FUND')
  return <FUNDView ticker="PETR4.SA" />
}
