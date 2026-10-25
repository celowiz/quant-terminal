'use client'
import { HEATView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HEAT')
  return <HEATView />
}
