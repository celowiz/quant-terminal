export const norm: (s: string) => string
export const US_PT: Record<string, string>
export const tabName: (key: string, fallback: string, pt: boolean) => string
export function accountName(row: { code: string; name: string }, us: boolean, pt: boolean): { text: string; asFiled: boolean }
export function relLevels<T extends { level: number }>(rows: T[]): (T & { rel: number })[]
export function yearAgoIndex(periods: string[], i: number): number
export function yoyChange(cur: number | null, prev: number | null): { pct: number | null; dir: number; nm: boolean } | null
export const newestFirst: (periods: string[]) => number[]
export const chartPoints: (periods: string[], vals: (number | null)[], div?: number) => { time: string; value: number }[]
