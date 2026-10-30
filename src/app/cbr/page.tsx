'use client'
import { CBRView } from '@/views/fn/batch1'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('CBR')
  return <CBRView />
}
