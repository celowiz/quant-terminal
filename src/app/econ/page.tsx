'use client'
import { ECONView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ECON')
  return <ECONView />
}
