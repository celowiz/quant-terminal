'use client'
import { CDRView } from '@/views/fn/batch6'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CDR')
  return <CDRView />
}
