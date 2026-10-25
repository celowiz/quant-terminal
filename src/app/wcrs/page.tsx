'use client'
import { WCRSView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WCRS')
  return <WCRSView />
}
