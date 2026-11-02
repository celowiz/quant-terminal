'use client'
import { INSDView } from '@/views/fn/batch6'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('INSD')
  return <INSDView />
}
