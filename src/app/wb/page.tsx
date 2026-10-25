'use client'
import { WBView } from '@/views/fn/rates11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WB')
  return <WBView />
}
