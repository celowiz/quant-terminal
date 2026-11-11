export const BRT: number
export function brt(ms: number): { day: string; min: number; dow: number; hhmm: string; hhmmss: string }
export function b3Open(ms: number, start?: number, end?: number): boolean
export function b3FutOpen(ms: number): boolean
export function dolCodes(ms: number): string[]
export function b3Sym(t: string): string | null
export type B3Quote = { last: number; open: number | null; high: number | null; low: number | null; avg: number | null; pct: number | null }
export function b3Quote(j: any): B3Quote | null
export function b3Day(j: any): { day: string; pts: [number, number][] } | null
export function liveSession(day: { day: string; pts: [number, number][] } | null, fileBars: number[][]): number[][] | null
export function delayMin(lastMs: number, nowMs: number): number
export type LiveKind = 'rt' | 'delayed' | 'closed' | 'checked'
export type LiveInfo = { kind: LiveKind; delay?: number; at?: number; last?: number }
export function liveLabel(i: LiveInfo, lang: string): string
export function dmy(s: string): string | null
export function mergeSgs(points: [string, number][], rows: { data: string; valor: string }[], maxDay?: string | null): { points: [string, number][]; fresh: number }
export function copomTitle(it: any): { n: number | null; date: string | null; selic: number | null; move: 'hold' | 'cut' | 'hike' | null }
export function ptaxBulletins(j: any): { kind: 'open' | 'mid' | 'close'; time: string; buy: number; sell: number }[]
export function mergeNews<T extends { link?: string; date: string }>(items: T[], live: T[]): { items: T[]; fresh: number }
export function feedDate(s: string): string | null
export const LIVE_RAW: string
export type WQuote = [number, number, number, number]
export function tradeDay(q: WQuote | null | undefined): string | null
export function quoteFresh(q: WQuote | null | undefined, nowMs: number, maxMin?: number): boolean
export function applyQuote(dates: string[], close: (number | null)[], q: WQuote | null | undefined): { dates: string[]; close: (number | null)[]; applied: boolean }
export function quotesBadge(quotes: WQuote[], atMs: number | null | undefined, nowMs: number): LiveInfo | null
export function mergePoints(points: [string, number][], pts: [string, number][]): { points: [string, number][]; fresh: number }
