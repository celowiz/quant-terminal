import View from './View'
import { staticParams } from '../../../lib/universe'

// Export estático: uma página pré-gerada por ticker do universo da função
export const dynamicParams = false
export function generateStaticParams() {
  return staticParams('rv')
}

export default function Page({ params }: { params: { ticker: string } }) {
  return <View ticker={decodeURIComponent(params.ticker)} />
}
