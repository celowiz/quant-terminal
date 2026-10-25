'use client'
import { GLCOView } from '@/views/fn/v4market'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('GLCO')
  return <GLCOView />
}
