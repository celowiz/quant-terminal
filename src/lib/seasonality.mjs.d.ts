export const NEAR0: number
export type SRow = { time: string; close: number }
export type SStats = { n: number; mean: number | null; median: number | null; sd: number | null; pos: number | null; min: number | null; max: number | null }
export type SCell = { r: number; part: 'mtd' | 'wtd' | null; date?: string; n?: number } | null
export type SYear = { y: number; cells: SCell[]; best: number; worst: number; ret?: number | null; tag?: 'ytd' | 'partial' | null }
export function monthEnd(y: number, m: number, allDays?: boolean): string
export function isoWeek(s: string): { y: number; w: number }
export function weekEnd(s: string, allDays?: boolean): string
export function stats(vals: (number | null)[]): SStats
export function bestWorst(vals: (number | null)[]): { best: number; worst: number }
export function monthly(rows: SRow[], o?: { allDays?: boolean; includePartial?: boolean }): { years: SYear[]; months: SStats[]; year: SStats; best: number; worst: number; complete: number; partial: string | null; asOf: string | null }
export function weekly(rows: SRow[], o?: { allDays?: boolean; includePartial?: boolean }): { years: SYear[]; weeks: SStats[]; best: number; worst: number; complete: number; partial: string | null }
export function dayOfWeek(rows: SRow[]): { years: SYear[]; days: SStats[]; used: number[]; best: number; worst: number; n: number }
