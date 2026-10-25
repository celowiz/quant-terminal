'use client'
import { FAView } from '@/views/fn/v4ticker'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FA')
  return <FAView ticker="PETR4.SA" />
}
