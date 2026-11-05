export function sectorName(raw: string, pt: boolean): string
export function ebitdaOf(r: any): { v: number | null; derived: boolean }
export function pxAt(series: [string, number][] | undefined | null, t: string): number | null
export function companyMcap(shares: any, t: string, own: { series: [string, number][]; kind: string | null }, cls: Record<string, [string, number][] | undefined>, us: boolean): { v: number | null; reason: string | null }
export function classOf(ticker: string): { base: string | null; kind: 'on' | 'pn' | 'unit' | null }
export function multiple(num: number | null | undefined, den: number | null | undefined): number | 'nm' | null
export function diverges(a: any, b: any, tol?: number): boolean
export function dedupePeers<T>(rows: T[], keyOf: (r: T) => any, liq: (r: T) => number | null | undefined): T[]
