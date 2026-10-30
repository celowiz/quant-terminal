'use client'
import { IVSView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('IVS')
  return <IVSView ticker="PETR4.SA" />
}
