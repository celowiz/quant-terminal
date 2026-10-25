'use client'
import { SEAHView } from '@/views/fn/tech'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('SEAH')
  return <SEAHView ticker="PETR4.SA" />
}
