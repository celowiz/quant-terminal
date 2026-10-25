'use client'
import { HDSView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HDS')
  return <HDSView ticker="PETR4.SA" />
}
