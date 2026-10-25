'use client'
import { VOLView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('VOL')
  return <VOLView ticker="PETR4.SA" />
}
