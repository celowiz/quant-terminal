'use client'
import { OVMEView } from '@/views/fn/batch2'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('OVME')
  return <OVMEView ticker="PETR4.SA" />
}
