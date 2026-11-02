'use client'
import { VARView } from '@/views/fn/batch7'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('VAR')
  return <VARView />
}
