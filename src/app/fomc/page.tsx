'use client'
import { FOMCView } from '@/views/fn/rates11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FOMC')
  return <FOMCView />
}
