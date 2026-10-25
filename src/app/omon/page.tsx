'use client'
import { OMONView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('OMON')
  return <OMONView ticker="PETR4.SA" />
}
