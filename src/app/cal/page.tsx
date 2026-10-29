'use client'
import { CALView } from '@/views/fn/cal'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CAL')
  return <CALView />
}
