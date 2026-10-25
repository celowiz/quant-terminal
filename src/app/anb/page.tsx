'use client'
import { ANBView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ANB')
  return <ANBView />
}
