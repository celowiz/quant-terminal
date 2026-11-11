export type MovFile = { generated_at: string; index: string; name: string; dates: string[]; level: (number | null)[]; periods: { start: string; snapshot: string; n: number }[]
  next_rebalance: string | null; members: MovMember[]; px: Record<string, (number | null)[]>; adj: Record<string, [number, number][]>; pts: Record<string, (number | null)[]>; w: Record<string, (number | null)[]>; last_w: Record<string, number> }
export type MovMember = { cod: string; name: string; type: string; sector: string | null; root: string; current: boolean; first: string; last: string; last_trade: string | null }
export type MovRow = Partial<MovMember> & { cod: string; name: string; raw: number | null; pts: number | null; ret: number | null; px: number | null; w0: number | null; joined: string | null; left: string | null; classes?: string[]; n?: number; items?: MovRow[]; group?: boolean }
export type MovAgg = { rows: MovRow[]; L0: number | null; L1: number | null; chg: number | null; pct: number | null; resid: number; from?: string; to?: string; base?: string }
export function adjAt(ev: [number, number][] | undefined, i: number): number | null
export function idxOnOrBefore(dates: string[], iso: string): number
export function rangeOf(dates: string[], preset: string, custom?: { from: string; to: string } | null): { a: number; b: number } | null
export function aggregate(o: MovFile, a: number, b: number): MovAgg
export function liveAggregate(parts: Record<string, number>, quotes: Record<string, [number, number | null]>, idxQuote: [number, number | null] | null | undefined, meta?: Map<string, any>): MovAgg | null
export function mergeClasses(rows: MovRow[]): MovRow[]
export function groupBy(rows: MovRow[], key: (r: MovRow) => string | null | undefined): MovRow[]
export function breadth(rows: MovRow[]): { up: number; down: number; unch: number }
export function turnover(o: MovFile, a: number, b: number): { current: number; added: string[]; removed: string[] }
export function cumulative(o: MovFile, a: number, b: number, groups: string[][]): { series: [string, number][][]; index: [string, number][] }
