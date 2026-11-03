// GP ↔ GPL (e GPC): leva período, datas, timeframe e botões ligados para a outra tela do mesmo ativo.
// sessionStorage de uso único: lido na montagem da tela de destino e apagado em seguida (só vale para o mesmo ticker).
export type Carry = { ticker: string; period: string; start: string; end: string; tf: string; full: boolean; showVol: boolean; smaOn: number[]; events: boolean }
const KEY = 'qt.chart.carry'

export function putCarry(c: Carry) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...c, at: Date.now() })) } catch { /* modo privado */ }
}
export function takeCarry(ticker: string): Carry | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    // apaga logo depois (não na hora): a troca de idioma/tema na carga remonta a árvore e a 2ª montagem também precisa ler
    setTimeout(() => { try { sessionStorage.removeItem(KEY) } catch { /* idem */ } }, 4000)
    const c = JSON.parse(raw)
    // só a navegação recém-feita (evita reaplicar um estado antigo ao abrir a tela depois)
    if (!c || c.ticker !== ticker || !(Date.now() - (c.at || 0) < 60_000)) return null
    const iso = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '')
    return {
      ticker, period: typeof c.period === 'string' ? c.period.slice(0, 4) : '1A', start: iso(c.start), end: iso(c.end),
      tf: ['d', 'w', 'm', 'q', 'y'].includes(c.tf) ? c.tf : 'd', full: !!c.full, showVol: c.showVol !== false,
      smaOn: Array.isArray(c.smaOn) ? c.smaOn.filter((n: unknown) => n === 50 || n === 200) : [], events: !!c.events,
    }
  } catch { return null }
}
