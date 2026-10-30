'use client'
import { COTView } from '@/views/fn/batch3'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Page() {
  usePageTitle('COT')
  return <COTView />
}
