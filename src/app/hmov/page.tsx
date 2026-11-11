'use client'
import { HMOVView } from '@/views/fn/mov'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('HMOV')
  return <HMOVView />
}
