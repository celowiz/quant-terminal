export type FRow = Record<string, any> & { period: string; _d: string[]; _ttm?: boolean }
export const FLOW: string[]
export const BAL: string[]
export function prepare(fund: any): { annual: FRow[]; quarterly: FRow[]; bank: boolean }
export function last4(q: FRow[]): FRow[] | null
export function ttm(q: FRow[]): FRow | null
export function ratios(rows: FRow[], per: 'a' | 'q'): FRow[]
export function yoy(rows: FRow[], k: string): number | null
export function isOneOff(r: FRow): boolean
export function splitRows<T extends [string, ...any[]]>(defs: T[], cols: Record<string, any>[]): { shown: T[]; hidden: T[] }
