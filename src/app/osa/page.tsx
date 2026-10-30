'use client'
import { OSAView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('OSA')
  return <OSAView ticker="PETR4.SA" />
}
