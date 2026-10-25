'use client'
import { CFView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CF')
  return <CFView ticker="PETR4.SA" />
}
