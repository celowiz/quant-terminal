export type FcfRow = { cfo?: number | null; capex?: number | null }
export type DcfYear = { t: number; g: number; fcf: number; df: number; pv: number }
export type DcfOut = { years: DcfYear[]; pvFcf: number; tv: number; pvTv: number; ev: number; tvShare: number }
export type DcfIn = { fcf0: number | null; g1: number; gT: number; w: number; n1?: number; n?: number }
export type Bal = { netdebt?: number | null; minority?: number | null; shares: number | null }
export function fcfOf(r: FcfRow | null | undefined): number | null
export function fcfLtm(q: FcfRow[]): number | null
export function wacc(p: { rf: number; beta: number; erp: number; kd: number; tax: number; E: number | null; D: number | null }): { ke: number; w: number; we: number; wd: number }
export function dcf(p: DcfIn): DcfOut | null
export function perShare(ev: number | null, b: Bal): number | null
export function impliedG1(price: number, p: Omit<DcfIn, 'g1'>, b: Bal): number | null
export function sensitivity(p: DcfIn, b: Bal, ws: number[], gs: number[]): (number | null)[][]
