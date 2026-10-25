'use client'
import { ECTRView } from '@/views/fn/credit11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ECTR')
  return <ECTRView />
}
