export type PickerMeta = { ticker: string; name?: string; name_pt?: string; class?: string }
export type PickerGroup<M extends PickerMeta = PickerMeta> = { group: string; items: M[]; total?: number }
export const PICKER_GROUPS: string[]
export function groupLabel(g: string, lang?: string): string
export function shortCode(t: string): string
export function norm(s: string | null | undefined): string
export function cleanName(name: string | null | undefined, ticker: string): string
export function withTicker(label: string | null | undefined, ticker: string): string
export function scoreMatch(meta: PickerMeta, q: string): number | null
export function pickerGroups<M extends PickerMeta>(list: M[], query?: string, opts?: { suggested?: string[]; exclude?: string[]; perGroup?: number }): PickerGroup<M>[]
export function flatItems<M extends PickerMeta>(groups: PickerGroup<M>[]): M[]
