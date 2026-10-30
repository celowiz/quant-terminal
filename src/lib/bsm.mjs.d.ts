export type BSResult = { price: number; delta: number; gamma: number; vega: number; theta: number; rho: number; d1: number; d2: number }
export function Nc(x: number): number
export function npdf(x: number): number
export function bs(call: boolean, S: number, K: number, T: number, r: number, q: number, s: number): BSResult | null
export function impliedVol(call: boolean, prem: number, S: number, K: number, T: number, r: number, q: number): number | null
