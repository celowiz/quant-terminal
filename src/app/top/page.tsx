'use client'
import { TOPView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('TOP')
  return <TOPView />
}
