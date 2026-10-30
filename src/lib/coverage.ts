// Registra a cobertura por ativo (tickers.json → `cov`) antes de qualquer uso de FUNCTION_UNIVERSE.
import tickers from '../../public/data/tickers.json'
import { registerCoverage } from './activeTicker.mjs'

registerCoverage((tickers as unknown as { tickers: { ticker: string; cov?: string[] }[] }).tickers)
export {}
