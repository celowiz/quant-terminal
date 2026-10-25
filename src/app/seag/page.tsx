'use client'
import { SEAGView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('SEAG')
  return <SEAGView ticker="PETR4.SA" />
}
