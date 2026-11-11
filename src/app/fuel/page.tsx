'use client'
import { FUELView } from '@/views/fn/fuel'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('FUEL')
  return <FUELView />
}
