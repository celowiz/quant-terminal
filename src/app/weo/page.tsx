'use client'
import { WEOView } from '@/views/fn/batch6'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WEO')
  return <WEOView />
}
