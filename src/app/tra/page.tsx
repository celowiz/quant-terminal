'use client'
import { TRAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('TRA')
  return <TRAView ticker="PETR4.SA" />
}
