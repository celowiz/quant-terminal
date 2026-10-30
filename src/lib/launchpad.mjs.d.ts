export type LpState = { n: number; panels: string[] }
export const LAYOUTS: number[]
export const STORAGE_KEY: string
export const DEFAULT_PANELS: string[]
export const DEFAULT_STATE: LpState
export function sanitizePanel(path: string, codes: string[], basePath?: string): string | null
export function normalizeState(s: unknown, codes: string[]): LpState
export function encodeState(s: LpState): string
export function decodeState(search: string, codes: string[]): LpState | null
export function initialState(search: string, stored: string | null, codes: string[]): LpState
