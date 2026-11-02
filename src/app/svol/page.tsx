'use client'
import { SVOLView } from '@/views/fn/batch7'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('SVOL')
  return <SVOLView />
}
