'use client'
import { GMMView } from '@/views/fn/markets11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('GMM')
  return <GMMView />
}
