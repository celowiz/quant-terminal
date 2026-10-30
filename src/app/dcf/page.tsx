'use client'
import { DCFView } from '@/views/fn/batch5'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('DCF')
  return <DCFView ticker="PETR4.SA" />
}
