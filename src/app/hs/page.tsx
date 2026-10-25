'use client'
import { HSView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HS')
  return <HSView ticker="PETR4.SA" />
}
