'use client'
import { NEWSView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('NEWS')
  return <NEWSView />
}
