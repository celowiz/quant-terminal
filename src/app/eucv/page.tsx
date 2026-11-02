'use client'
import { EUCVView } from '@/views/fn/batch6'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('EUCV')
  return <EUCVView />
}
