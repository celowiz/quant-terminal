'use client'
import dynamic from 'next/dynamic'
export type { IntradayProps } from './IntradayChartImpl'
const IntradayChart = dynamic(() => import('./IntradayChartImpl'), { ssr: false, loading: () => <div style={{ height: 320 }} /> })
export default IntradayChart
