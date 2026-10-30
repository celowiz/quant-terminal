export type Leg = { kind: 'C' | 'P' | 'S'; side: 1 | -1; qty: number; K: number; prem: number; T: number; iv: number }
export type LegSpec = { kind: 'C' | 'P' | 'S'; side: 1 | -1; qty: number; K: number }
export function intrinsic(l: Leg, S: number): number
export function netCost(legs: Leg[]): number
export function legValue(l: Leg, S: number, tau: number, r: number): number
export function pnl(legs: Leg[], S: number, dt: number, r: number): number
export function greeks(legs: Leg[], S: number, r: number): { delta: number; gamma: number; vega: number; theta: number }
export function profile(legs: Leg[], xs: number[], dt: number, r: number): { ys: number[]; be: number[]; max: number; min: number; unlimitedUp: boolean; unlimitedDown: boolean }
export function nearest(strikes: number[], x: number): number | null
export function preset(name: string, S: number, callK: number[], putK: number[], step?: number): LegSpec[]
