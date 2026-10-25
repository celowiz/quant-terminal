'use client'
import { GIPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('GIP')
  return <GIPView ticker="PETR4.SA" />
}
