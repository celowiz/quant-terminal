'use client'
import { DYView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('DY')
  return <DYView ticker="PETR4.SA" />
}
