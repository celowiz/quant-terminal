import View from './View'
import { staticParams } from '../../../lib/universe'

// Export estático (GitHub Pages): uma página pré-gerada por ticker do universo em data/tickers.json
export const dynamicParams = false
export function generateStaticParams() {
  return staticParams('gp')
}

export default function Page({ params }: { params: { ticker: string } }) {
  return <View ticker={decodeURIComponent(params.ticker)} />
}
