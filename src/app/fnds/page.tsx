'use client'
import { FNDSView } from '@/views/fn/batch4'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FNDS')
  return <FNDSView />
}
