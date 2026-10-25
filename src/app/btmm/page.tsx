'use client'
import { BTMMView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('BTMM')
  return <BTMMView />
}
