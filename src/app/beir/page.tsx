'use client'
import { BEIRView } from '@/views/fn/batch1'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('BEIR')
  return <BEIRView />
}
