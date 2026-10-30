export type SmilePt = { k: number; K: number; iv: number; code: string; trades: number }
export type Expiry = { date: string; bdays: number; calls: any[]; puts: any[] }
export function smile(e: Expiry, spot: number, o?: { minTrades?: number; ivMin?: number; ivMax?: number }): SmilePt[]
export function ivAt(pts: SmilePt[], m: number): number | null
export function surface(es: Expiry[], spot: number, grid: number[], minPts?: number, o?: { minTrades?: number; ivMin?: number; ivMax?: number }): { date: string; bdays: number; pts: SmilePt[]; row: (number | null)[]; atm: number | null; skew: number | null }[]
