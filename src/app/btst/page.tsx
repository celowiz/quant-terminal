'use client'
import { BTSTView } from '@/views/fn/batch7'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('BTST')
  return <BTSTView />
}
