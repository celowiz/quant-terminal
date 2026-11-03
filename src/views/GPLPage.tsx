import ChartScreen from '../components/terminal/ChartScreen'
import { usePageTitle } from '../hooks/usePageTitle'

/** GPL: o GP em escala de preço logarítmica (mesma tela, controles, régua e eventos). */
export default function GPLPage({ ticker }: { ticker: string }) {
  usePageTitle('Line Graph (Log)')
  return <ChartScreen ticker={ticker} mode="line" log />
}
