'use client'
import dynamic from 'next/dynamic'
export type { PaneDef, SeriesDef, Pt } from './FnChartImpl'
const FnChart = dynamic(() => import('./FnChartImpl'), { ssr: false, loading: () => <div style={{ height: 300 }} /> })
export default FnChart
