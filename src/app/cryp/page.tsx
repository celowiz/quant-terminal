'use client'
import { CRYPView } from '@/views/fn/batch1'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CRYP')
  return <CRYPView />
}
