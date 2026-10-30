export const THEMES: string[]
export const UPDOWN: string[]
export const DEFAULT_KEY: string
export function themeKey(s: unknown): string
export function mapRgb(rgb: number[], key: string): number[]
export function mapHex(hex: string, key: string): string
export function mapCssValue(v: string, key: string): string
export function isColorProp(p: string): boolean
export function scopeSelector(sel: string, key: string): string
