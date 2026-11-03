export type Filing = { date: string; ref?: string | null; cat: string; type?: string | null; species?: string | null; subject?: string | null; version?: string | number | null; link?: string }
export type FilingRow = Filing & { older: Filing[] }
export type Group = 'results' | 'material' | 'meetings' | 'dividends' | 'other'
export const norm: (s: unknown) => string
export const BR_GLOSS: Record<string, string>
export const gloss: (cat: string) => string | null
export const GROUPS: Group[]
export function groupOf(f: Filing, us: boolean): Group
export const isKey: (f: Filing, us: boolean) => boolean
export const searchText: (f: Filing) => string
export function matches(f: Filing, q: string): boolean
export function collapseVersions(list: Filing[]): FilingRow[]
export function categoryCounts(list: Filing[]): { cat: string; n: number }[]
export function groupCounts(list: Filing[], us: boolean): Record<Group, number>
export function dateRange(list: Filing[]): { from: string; to: string } | null
export function sortFilings<T extends Filing>(list: T[], by: 'date' | 'cat', catOrder?: string[]): T[]
export const showType: (f: Filing) => string | null
export const showRef: (f: Filing) => string | null
