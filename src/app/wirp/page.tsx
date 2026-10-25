'use client'
import { WIRPView } from '@/views/fn/rates11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('WIRP')
  return <WIRPView />
}
