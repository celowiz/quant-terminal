'use client'
import { HRAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HRA')
  return <HRAView ticker="PETR4.SA" />
}
