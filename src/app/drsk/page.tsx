'use client'
import { DRSKView } from '@/views/fn/credit11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('DRSK')
  return <DRSKView />
}
