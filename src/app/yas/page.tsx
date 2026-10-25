'use client'
import { YASView } from '@/views/fn/credit11'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('YAS')
  return <YASView />
}
