'use client'
import { ECSTView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ECST')
  return <ECSTView />
}
