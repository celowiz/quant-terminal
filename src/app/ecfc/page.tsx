'use client'
import { ECFCView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ECFC')
  return <ECFCView />
}
