'use client'
import { CALView } from '@/views/fn/market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CAL')
  return <CALView />
}
