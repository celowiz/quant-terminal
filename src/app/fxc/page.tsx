'use client'
import { FXCView } from '@/views/fn/markets11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FXC')
  return <FXCView />
}
