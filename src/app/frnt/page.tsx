'use client'
import { FRNTView } from '@/views/fn/batch7'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FRNT')
  return <FRNTView />
}
