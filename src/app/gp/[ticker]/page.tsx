import View from './View'
import tickers from '../../../../public/data/tickers.json'

// Export estático (GitHub Pages): uma página pré-gerada por ticker do universo em data/tickers.json
export const dynamicParams = false
export function generateStaticParams() {
  return (tickers as { tickers: { ticker: string }[] }).tickers.map(t => ({ ticker: t.ticker }))
}

export default function Page({ params }: { params: { ticker: string } }) {
  return <View ticker={decodeURIComponent(params.ticker)} />
}
