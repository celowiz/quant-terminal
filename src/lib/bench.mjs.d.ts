export type BenchMarket = 'us' | 'br' | 'crypto' | 'fx' | 'cmd'
export type BenchPrefs = Record<BenchMarket, string>
export const BENCH_MARKETS: BenchMarket[]
export const BENCH_DEFAULTS: BenchPrefs
export const BENCH_OPTIONS: Record<BenchMarket, string[]>
export function validBench(b: any): BenchPrefs
export function sameBench(a: any, b: any): boolean
export function tracksUS(name: string | null | undefined): boolean
export function benchMarket(ticker: string, meta?: { class?: string; name?: string } | null): BenchMarket | 'index'
export function pickBench(ticker: string, meta?: { class?: string; name?: string } | null, prefs?: Partial<BenchPrefs> | null): string
export function benchName(ticker: string, lang?: 'en' | 'pt'): string | null
export function peersOf(ticker: string, metas: { ticker: string; class: string; name?: string }[], n?: number, screen?: { cod: string; sector?: string; subsector?: string; mcap?: number }[] | null): string[]
