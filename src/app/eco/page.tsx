'use client'
import { ECOView } from '@/views/fn/markets11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('ECO')
  return <ECOView />
}
