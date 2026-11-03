export type EvKind = 'D' | 'S' | 'F' | 'R' | 'N'
export type Ev = { date: string; kind: EvKind; text: string; link?: string; value?: number }
export type KindMeta = { en: string; pt: string; color: string; shape: 'arrowDown' | 'arrowUp' | 'circle' | 'square'; pos: 'aboveBar' | 'belowBar' }
export const EVENT_KINDS: Record<EvKind, KindMeta>
export function buildEvents(d: any, cal: any, ticker: string): Ev[]
export function snapTime(times: string[], date: string): string | null
export function eventsByBar(events: Ev[], times: string[]): Map<string, Ev[]>
export function eventMarkers(byBar: Map<string, Ev[]>, kinds?: Record<EvKind, KindMeta>, color?: (c: string) => string): { time: string; text: string; color: string; shape: KindMeta['shape']; position: KindMeta['pos'] }[]
