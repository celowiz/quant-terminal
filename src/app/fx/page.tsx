'use client'
import { FXView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FX')
  return <FXView />
}
