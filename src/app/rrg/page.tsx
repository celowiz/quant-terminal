'use client'
import RRGTerminal from '@/components/terminal/RRGTerminal'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function RRGPage() {
  usePageTitle('Relative Rotation Graph')
  return <RRGTerminal />
}
