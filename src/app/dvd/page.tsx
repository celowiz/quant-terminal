'use client'
import { DVDView } from '@/views/fn/corp'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('DVD')
  return <DVDView ticker="PETR4.SA" />
}
