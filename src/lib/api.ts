import { RRGResponse, RRGFormData } from '@/types/rrg'
import { computeRRG, getJSON, TickersFile } from './static'

// Versão estática (GitHub Pages): sem FastAPI. Mantém a mesma interface usada pelos componentes.
export const rrgAPI = {
  getRRGData: async (params: RRGFormData): Promise<RRGResponse> => computeRRG(params),
  getAvailableTickers: async (): Promise<{ tickers: string[] }> =>
    ({ tickers: (await getJSON<TickersFile>('tickers.json')).tickers.map(t => t.key) }),
  getDefaultConfig: async () => ({ benchmark_col: 'IDX_BVSP', lookback_ratio: 10, lookback_mom: 10, tail: 12, use_ema: true }),
}
