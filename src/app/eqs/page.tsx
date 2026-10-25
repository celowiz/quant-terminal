'use client'
import { EQSView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('EQS')
  return <EQSView />
}
