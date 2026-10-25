'use client'
import { WFIView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WFI')
  return <WFIView />
}
