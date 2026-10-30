'use client'
import { EVTSView } from '@/views/fn/batch2'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('EVTS')
  return <EVTSView ticker="PETR4.SA" />
}
