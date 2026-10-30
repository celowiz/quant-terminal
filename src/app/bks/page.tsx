'use client'
import { BKSView } from '@/views/fn/batch4'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('BKS')
  return <BKSView />
}
