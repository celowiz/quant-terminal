'use client'
import { DESView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('DES')
  return <DESView ticker="PETR4.SA" />
}
