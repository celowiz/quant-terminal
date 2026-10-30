'use client'
import { FIIMView } from '@/views/fn/batch4'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FIIM')
  return <FIIMView />
}
