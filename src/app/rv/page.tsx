'use client'
import { RVView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('RV')
  return <RVView ticker="PETR4.SA" />
}
