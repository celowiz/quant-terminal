'use client'
import { USMMView } from '@/views/fn/batch1'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('USMM')
  return <USMMView />
}
