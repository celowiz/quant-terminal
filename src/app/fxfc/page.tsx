'use client'
import { FXFCView } from '@/views/fn/markets11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FXFC')
  return <FXFCView />
}
