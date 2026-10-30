'use client'
import { F13View } from '@/views/fn/batch3'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('13F')
  return <F13View />
}
