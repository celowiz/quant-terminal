export type Curve = { pts: [number, number][]; t: number[]; ln: number[]; tmax: number }
export function curveFrom(points: [number, number | null][], comp?: 'annual' | 'cont'): Curve
export function curveFromDI(pairs: [number, number][]): Curve
export function matYears(m: string): number
export function lnD(c: Curve, x: number): number | null
export function fwd(c: Curve, a: number, b: number): number | null
export function quant(x: number[], p: number): number
export function invNorm(p: number): number
export function histogram(x: number[], bins?: number): { lo: number; hi: number; w: number; counts: number[] } | null
export function alignedReturns(dates: string[], closes: (number | null)[][], maxN: number): { dates: string[]; rets: number[][] } | null
export function varStats(x: number[], c: number): { hVar: number; hEs: number; pVar: number; pEs: number; sd: number; mu: number; worst: number }
export function covMatrix(rets: number[][]): { m: number[]; S: number[][] }
export function componentVar(rets: number[][], w: number[]): number[]
export function rollingVar(port: number[], dates: string[], win: number, c: number): { pts: { t: string; r: number; v: number; hit: boolean }[]; breaches: number; expected: number }
export function moments(rets: number[][]): { mu: number[]; cov: number[][] }
export function annualizeDaily(r: number[]): number
export function projSimplex(v: number[]): number[]
export type PStat = { w: number[]; ret: number; vol: number }
export function stats(w: number[], mu: number[], cov: number[][]): PStat
export function solve(mu: number[], cov: number[][], lam: number, w0?: number[], iters?: number): number[]
export function frontier(mu: number[], cov: number[][], K?: number): PStat[]
export function mulberry32(a: number): () => number
export function randomPortfolios(mu: number[], cov: number[][], count: number, seed?: number): PStat[]
export function signals(c: number[], p: { kind: 'sma'; fast: number; slow: number } | { kind: 'mom'; look: number }): (number | null)[]
export type BTStats = { total: number; cagr: number; vol: number; sharpe: number | null; mdd: number; expo: number }
export type Pt = { time: string; value: number }
export function backtest(t: string[], c: number[], sig: (number | null)[], from: string, cost: number, cdi: Map<string, number> | null, cashEarns?: boolean): {
  s: BTStats; b: BTStats; eq: Pt[]; bh: Pt[]; dd: Pt[]; trades: { in: string; out: string | null; ret: number }[]; win: number | null; to: string
} | null
export function logRets(c: number[]): number[]
export function realVol(lr: number[], w: number): number | null
export function rollingVol(lr: number[], w: number): (number | null)[]
export function ivAtDays(term: { bdays: number; iv: number }[], d: number): number | null
