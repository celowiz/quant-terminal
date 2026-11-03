export type IBar = number[]
export const BRT_OFF: number
export function sessionOf(u: number): string
export function dropTrailingSnapshot(bars: IBar[]): IBar[]
export function hasVolume(bars: IBar[]): boolean
export function sessions(bars: IBar[]): { day: string; bars: IBar[] }[]
export function vwapBands(bars: IBar[]): { t: number; vwap: number; sd: number }[]
export type WStats = { open: number; high: number; low: number; last: number; vol: number; vwap: number | null; n: number; t0: number; t1: number }
export function windowStats(B: IBar[]): WStats | null
export function sessionStats(bars: IBar[]): (WStats & { day: string; prevClose: number | null; chg: number | null })[]
