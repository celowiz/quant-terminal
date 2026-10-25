'use client'
import { PORTView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('PORT')
  return <PORTView />
}
