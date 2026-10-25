import ChartScreen from '../components/terminal/ChartScreen'
import { usePageTitle } from '../hooks/usePageTitle'

export default function GPPage({ ticker }: { ticker: string }) {
  usePageTitle('Line Graph')
  return <ChartScreen ticker={ticker} mode="line" />
}
