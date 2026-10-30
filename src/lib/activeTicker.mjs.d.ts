export const TICKER_FUNCTIONS: string[]
export const FUNCTION_UNIVERSE: Record<string, string[]>
export const STORAGE_KEY: string
export function acceptsTicker(code: string): boolean
export function inUniverse(code: string, ticker: string, universe: string[]): boolean
export function functionPath(code: string, ticker: string, universe: string[]): string
export function readStoredTicker(storage?: Pick<Storage, 'getItem'> | null): string
export function writeStoredTicker(storage: Pick<Storage, 'setItem'> | null | undefined, ticker: string): void
export function displayTicker(ticker: string): string
export function defaultTicker(code: string): string
export function barTicker(code: string, stored: string, universe: string[]): { ticker: string; fallbackFrom: string }
export function functionUniverse(code: string, universe: string[]): string[]
