export type RulerStats = { from: string; to: string; v0: number; v1: number; abs: number; pct: number | null; sessions: number; days: number; up: boolean }
export function rulerStats(rows: { time: string; [k: string]: any }[], a?: string | null, b?: string | null, key?: string): RulerStats | null
export function rulerNext(pts: string[], t: string): string[]
