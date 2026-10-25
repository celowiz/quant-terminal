'use client'
import { GCView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('GC')
  return <GCView />
}
