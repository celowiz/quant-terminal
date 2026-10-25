'use client'
import { HPView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HP')
  return <HPView ticker="PETR4.SA" />
}
