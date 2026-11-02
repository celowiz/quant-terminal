'use client'
import { RESVView } from '@/views/fn/batch6'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('RESV')
  return <RESVView />
}
