'use client'
import { CNView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CN')
  return <CNView ticker="PETR4.SA" />
}
