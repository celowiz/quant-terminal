'use client'
import { MOVView } from '@/views/fn/mov'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('MOV')
  return <MOVView />
}
