'use client'
import { MRRView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('MRR')
  return <MRRView ticker="PETR4.SA" />
}
