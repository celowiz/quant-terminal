'use client'
import { CORRView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CORR')
  return <CORRView />
}
