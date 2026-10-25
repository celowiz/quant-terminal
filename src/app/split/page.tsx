'use client'
import { SPLITView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('SPLIT')
  return <SPLITView ticker="PETR4.SA" />
}
