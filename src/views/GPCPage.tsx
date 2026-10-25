import ChartScreen from '../components/terminal/ChartScreen'
import { usePageTitle } from '../hooks/usePageTitle'

export default function GPCPage({ ticker }: { ticker: string }) {
  usePageTitle('Candle Graph')
  return <ChartScreen ticker={ticker} mode="candle" />
}
