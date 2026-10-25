'use client'
import { ALERTView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ALERT')
  return <ALERTView />
}
