'use client'
import { CDIEView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CDIE')
  return <CDIEView />
}
