'use client'
import { MEMBView } from '@/views/fn/batch2'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('MEMB')
  return <MEMBView />
}
