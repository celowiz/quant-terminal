'use client'
import { FWCVView } from '@/views/fn/batch7'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FWCV')
  return <FWCVView />
}
