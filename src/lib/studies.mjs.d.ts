type Bar = { time: string; open: number; high: number; low: number; close: number; volume?: number }
export type HABar = { time: string; open: number; high: number; low: number; close: number }
export type BollPt = { time: string; mid: number; upper: number; lower: number }
export type VPBin = { from: number; to: number; vol: number; inVA: boolean }
export type VolumeProfile = { lo: number; hi: number; step: number; total: number; poc: number; vaLo: number; vaHi: number; bins: VPBin[] }
export function heikinAshi(rows: Bar[]): HABar[]
export function bollinger(rows: { time: string; close: number }[], n?: number, k?: number): BollPt[]
export function volumeProfile(rows: Bar[], bins?: number, va?: number): VolumeProfile | null
export function priceDecimals(rows: { close: number; high?: number }[]): number
