import axios from 'axios'
import { RRGResponse, RRGFormData } from '@/types/rrg'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE })

// Função para transformar ticker para o formato do backend
// Exemplos: ^BVSP -> IDX_BVSP, SPY.EQ -> SPY_EQ, BRL=X -> BRL_X
const transformTicker = (ticker: string): string => {
  return ticker
    .replace(/^\^/, 'IDX_')  // Substitui ^ no início por IDX_
    .replace(/[.=]/g, '_')   // Substitui . e = por _
}

// RRG API functions
export const rrgAPI = {
  getRRGData: async (params: RRGFormData): Promise<RRGResponse> => {
    const transformedBenchmark = transformTicker(params.benchmark);
    
    const queryParams = new URLSearchParams({
      benchmark: transformedBenchmark,
      lookback_ratio: params.lookback_ratio.toString(),
      lookback_mom: params.lookback_mom.toString(),
      tail: params.tail.toString(),
      use_ema: params.use_ema.toString(),
      ...(params.tickers && { tickers: params.tickers })
    });
    
    const response = await api.get(`/rrg?${queryParams}`);
    return response.data;
  },

  getAvailableTickers: async (): Promise<{ tickers: string[] }> => {
    const response = await api.get('/rrg/tickers');
    return response.data;
  },

  getDefaultConfig: async () => {
    const response = await api.get('/rrg/config');
    return response.data;
  }
}


