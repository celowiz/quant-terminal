'use client'
import { GRView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('GR')
  return <GRView ticker="PETR4.SA" />
}
