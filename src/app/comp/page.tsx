'use client'
import { COMPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('COMP')
  return <COMPView ticker="PETR4.SA" />
}
