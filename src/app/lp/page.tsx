'use client'
import { LPView } from '@/views/fn/launchpad'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('LP')
  return <LPView />
}
