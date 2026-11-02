/** Benchmark padrão por classe/mercado do ativo (cadastro de data/tickers.json: `class`, `currency`, `name`).
 *  Funções puras (sem React) para testes: GR, BETA, HS, HRA, COMP, DCF e o painel de configurações usam daqui. */

/** Mercados com benchmark configurável (Configurações → Benchmark padrão). */
export const BENCH_MARKETS = ['us', 'br', 'crypto', 'fx', 'cmd']
/** Padrões: EUA → S&P 500; Brasil → Ibovespa; cripto → Bitcoin; câmbio e commodities → índice do dólar (DXY). */
export const BENCH_DEFAULTS = { us: '^GSPC', br: '^BVSP', crypto: 'BTC-USD', fx: 'DX-Y.NYB', cmd: 'DX-Y.NYB' }
/** Valores aceitos por mercado (todos têm série em data/prices). Qualquer outro valor salvo volta ao padrão. */
export const BENCH_OPTIONS = {
  us: ['^GSPC', '^NDX', '^DJI', '^RUT'],
  br: ['^BVSP', 'SMAL11.SA', '^GSPC'],
  crypto: ['BTC-USD', 'ETH-USD', '^GSPC', '^NDX'],
  fx: ['DX-Y.NYB', '^GSPC', 'BRL=X'],
  cmd: ['DX-Y.NYB', '^GSPC', '^BVSP'],
}
/** valida o objeto salvo: cada mercado só aceita um valor da sua lista */
export function validBench(b) {
  const out = {}
  for (const m of BENCH_MARKETS) out[m] = b && BENCH_OPTIONS[m].includes(b[m]) ? b[m] : BENCH_DEFAULTS[m]
  return out
}
export const sameBench = (a, b) => BENCH_MARKETS.every(m => a?.[m] === b?.[m])

/** ETF listado na B3 que replica índice dos EUA (S&P 500, Nasdaq-100, Russell, NYSE FANG+, "US …"). */
const US_TRACK = /S&P\s?500|NASDAQ|RUSSELL|NYSE|SMALLCAP\s?600|(^|[^A-Z])US([^A-Z]|$)|\bEUA\b/i
export const tracksUS = name => US_TRACK.test(String(name || '')) && !/\bEX[\s-]US\b/i.test(String(name || ''))

/** Mercado do ativo para o benchmark: 'us' | 'br' | 'crypto' | 'fx' | 'cmd' | 'index' */
export function benchMarket(ticker, meta) {
  const u = String(ticker).toUpperCase()
  const cls = meta?.class
  if (cls === 'index' || u.startsWith('^') || u === 'DX-Y.NYB') return 'index'
  if (cls === 'us_equity' || cls === 'bdr') return 'us'
  if (cls === 'br_equity' || cls === 'fii') return 'br'
  if (cls === 'etf') return u.endsWith('.SA') && !tracksUS(meta?.name) ? 'br' : 'us'
  if (cls === 'crypto') return 'crypto'
  if (cls === 'fx') return 'fx'
  if (cls === 'commodity') return 'cmd'
  // sem cadastro: heurística pelo formato do ticker
  if (u.endsWith('-USD')) return 'crypto'
  if (u.endsWith('=X')) return 'fx'
  if (u.endsWith('=F') || u.endsWith('.DCE')) return 'cmd'
  if (u.endsWith('.SA')) return 'br'
  return 'us'
}

/** Índices mantêm a regra anterior: Ibovespa → dólar (BRL=X); S&P 500 → Nasdaq-100; demais → S&P 500. */
function indexBench(u) {
  if (u === '^BVSP') return 'BRL=X'
  if (u === '^GSPC') return '^NDX'
  return '^GSPC'
}

/** Benchmark padrão do ativo. `prefs` = escolhas salvas por mercado (validadas). Nunca devolve o próprio ativo. */
export function pickBench(ticker, meta, prefs) {
  const u = String(ticker).toUpperCase()
  const m = benchMarket(u, meta)
  if (m === 'index') return indexBench(u)
  const b = validBench(prefs)[m]
  if (b.toUpperCase() !== u) return b
  return b === '^GSPC' ? '^NDX' : '^GSPC'   // ex.: BTC-USD com cripto → Bitcoin usa S&P 500
}

/** Nome legível do benchmark (EN/PT). Desconhecido → null (quem chama usa o nome do cadastro ou o ticker). */
const NAMES = {
  '^GSPC': ['S&P 500', 'S&P 500'],
  '^BVSP': ['Ibovespa', 'Ibovespa'],
  '^NDX': ['Nasdaq-100', 'Nasdaq-100'],
  '^DJI': ['Dow Jones', 'Dow Jones'],
  '^RUT': ['Russell 2000', 'Russell 2000'],
  'BTC-USD': ['Bitcoin', 'Bitcoin'],
  'ETH-USD': ['Ethereum', 'Ethereum'],
  'DX-Y.NYB': ['US Dollar Index', 'Índice do Dólar (DXY)'],
  'BRL=X': ['US dollar (USD/BRL)', 'Dólar (USD/BRL)'],
  'SMAL11.SA': ['Brazil small caps (SMAL11)', 'Small caps Brasil (SMAL11)'],
  'IVVB11.SA': ['S&P 500 in reais (IVVB11)', 'S&P 500 em reais (IVVB11)'],
}
export function benchName(ticker, lang = 'en') {
  const n = NAMES[String(ticker).toUpperCase()]
  return n ? n[lang === 'pt' ? 1 : 0] : null
}

/** Pares da mesma classe (até n), sem o próprio ativo.
 *  Ações: mesmo subsetor (senão setor) no screener, maior valor de mercado primeiro; sem match → maiores do screener.
 *  Demais classes (ETFs: mesma bolsa e mesmo mercado do índice): ordem do cadastro.
 *  `metas` = lista do tickers.json; `screen` = linhas do screener do mercado (cod, sector, subsector, mcap), opcional. */
export function peersOf(ticker, metas, n = 2, screen = null) {
  const u = String(ticker).toUpperCase()
  const byT = new Map(metas.map(x => [x.ticker.toUpperCase(), x]))
  const me = byT.get(u)
  if (!me) return []
  const cls = me.class
  const has = t => byT.has(t) && t !== u
  if ((cls === 'us_equity' || cls === 'br_equity') && screen?.length) {
    const tk = r => cls === 'br_equity' ? `${String(r.cod).toUpperCase()}.SA` : String(r.cod).toUpperCase()
    const rows = screen.filter(r => has(tk(r)) && byT.get(tk(r)).class === cls)
    const s = rows.concat().sort((a, b) => (b.mcap || 0) - (a.mcap || 0))
    const mine = screen.find(r => tk(r) === u)
    let pick = []
    if (mine) {
      pick = mine.subsector ? s.filter(r => r.subsector === mine.subsector) : []
      if (pick.length < n && mine.sector) pick = pick.concat(s.filter(r => r.sector === mine.sector && !pick.includes(r)))
    }
    if (pick.length < n) pick = pick.concat(s.filter(r => !pick.includes(r)))
    return pick.slice(0, n).map(tk)
  }
  const mk = cls === 'etf' ? benchMarket(u, me) : null
  return metas.filter(x => x.class === cls && has(x.ticker.toUpperCase()) && (mk == null || (benchMarket(x.ticker, x) === mk && x.ticker.endsWith('.SA') === u.endsWith('.SA'))))
    .slice(0, n).map(x => x.ticker)
}
