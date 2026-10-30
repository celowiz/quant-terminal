export const ALIASES: Record<string, string>
export type Command = { code: string; ticker: string; unknown: string[] }
export type CommandTarget = { path: string; code: string; ticker: string; note: '' | 'noTicker' | 'notCovered' }
export function resolveTicker(tok: string, universe: string[]): string
export function parseCommand(input: string, universe: string[], codes: string[]): Command
export function commandTarget(cmd: Command | null, currentCode?: string): CommandTarget | null
