'use client'
import { WEIView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WEI')
  return <WEIView />
}
