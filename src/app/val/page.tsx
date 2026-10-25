'use client'
import { VALView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('VAL')
  return <VALView ticker="PETR4.SA" />
}
