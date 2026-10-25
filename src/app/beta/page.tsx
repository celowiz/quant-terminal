'use client'
import { BETAView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('BETA')
  return <BETAView ticker="PETR4.SA" />
}
