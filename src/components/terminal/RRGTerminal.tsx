'use client'
import { tc } from '../../lib/themeRuntime'
import { lang } from '@/lib/settings'
/**
 * RRG estilo terminal: trilhas com pontos semanais (opacidade decrescente com a idade),
 * cabeça destacada com seta de direção, quadrantes coloridos, rótulos, tooltip e controles
 * de semanas/data. Visual inspirado em celowiz/rrg (js/app.js → draw()) e no RRG do terminal
 * de referência (ver /REFERENCIAS.md). Cálculo: computeRRG (porte fiel do backend rrg.py).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeRRG, getJSON, type TickersFile } from '../../lib/static'
import type { RRGResponse } from '../../types/rrg'
import { MONO } from './PriceChart'
import { fmtDate } from '../../lib/dates'

const Q: Record<string, { c: string; n: string; d: string }> = {
  Leading:   { c: tc('#3DDC84'), n: 'LEADING',   d: 'Relative strength and momentum above 100' },
  Weakening: { c: tc('#FFD23F'), n: 'WEAKENING', d: 'Strength above 100, momentum fading' },
  Lagging:   { c: tc('#FF4D4D'), n: 'LAGGING',   d: 'Relative strength and momentum below 100' },
  Improving: { c: tc('#4FA3FF'), n: 'IMPROVING', d: 'Strength below 100, momentum improving' },
}
const PALETTE = ['#FFA028', tc('#FFFFFF'), tc('#4FC3F7'), tc('#FF5BD6'), tc('#7CFC00'), tc('#FFD400'), tc('#FF7F50'), tc('#B388FF'), tc('#00E5C0'), tc('#C0C0C0'), tc('#F06292')]
const MAX_HIST = 104 // semanas calculadas; a cauda exibida é só um recorte (não altera o cálculo)
const label = (k: string) => k.replace(/^IDX_/, '^').replace(/_X$/, '=X')
const quad = (x: number, y: number) => (x >= 100 ? (y >= 100 ? 'Leading' : 'Weakening') : y >= 100 ? 'Improving' : 'Lagging')
const fmtD = (s: string) => fmtDate(s.slice(0, 10)) // PT 29/10/26 · EN 29 Oct 26
const niceStep = (span: number) => { const r = span / 4, p = Math.pow(10, Math.floor(Math.log10(r))), f = r / p; return (f > 5 ? 10 : f > 2 ? 5 : f > 1 ? 2 : 1) * p }

type Hover = { x: number; y: number; t: string; date: string; r: number; m: number } | null

export default function RRGTerminal() {
  const [available, setAvailable] = useState<string[]>([])
  const [bench, setBench] = useState('IDX_BVSP')
  const [sel, setSel] = useState<string[]>(['PETR4', 'VALE3', 'ITUB4', 'B3SA3', 'PETR3', 'ITUB3'])
  const [lbR, setLbR] = useState(10)
  const [lbM, setLbM] = useState(10)
  const [ema, setEma] = useState(true)
  const [tail, setTail] = useState(12)
  const [endOff, setEndOff] = useState(0) // semanas antes da última
  const [playing, setPlaying] = useState(false)
  const [data, setData] = useState<RRGResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 900, h: 600 })

  useEffect(() => { getJSON<TickersFile>('tickers.json').then(f => setAvailable(f.tickers.map(t => t.key))) }, [])
  useEffect(() => {
    let alive = true
    computeRRG({ benchmark: bench, lookback_ratio: lbR, lookback_mom: lbM, tail: MAX_HIST, use_ema: ema, tickers: sel.filter(s => s !== bench).join(',') || undefined })
      .then(d => { if (alive) { setData(d); setErr(null) } })
      .catch(e => alive && setErr(String(e?.message || e)))
    return () => { alive = false }
  }, [bench, sel, lbR, lbM, ema])

  // tamanho: viewport inteira abaixo do cabeçalho
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      const desk = window.matchMedia('(min-width: 1024px)').matches
      const fh = desk ? (document.querySelector('footer') as HTMLElement | null)?.offsetHeight || 0 : 0
      // mobile/tablet: gráfico em largura total, quase quadrado; painel de ativos abaixo
      setSize({ w: el.clientWidth, h: desk ? Math.max(300, window.innerHeight - top - fh - 6) : Math.round(Math.min(560, Math.max(340, el.clientWidth * 1.05))) })
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [])

  const nPts = data?.assets.reduce((m, a) => Math.max(m, a.points.length), 0) || 0
  const maxOff = Math.max(0, nPts - 2)
  useEffect(() => {
    if (!playing) return
    if (endOff <= 0) { setPlaying(false); return }
    const id = setTimeout(() => setEndOff(o => o - 1), 450)
    return () => clearTimeout(id)
  }, [playing, endOff])

  const colorOf = useMemo(() => {
    const m: Record<string, string> = {}
    ;(data?.assets || []).forEach((a, i) => { m[a.ticker] = PALETTE[i % PALETTE.length] })
    return m
  }, [data])

  // recorte exibido
  const view = useMemo(() => (data?.assets || []).map(a => {
    const endI = a.points.length - 1 - endOff
    const pts = endI >= 0 ? a.points.slice(Math.max(0, endI - tail), endI + 1) : []
    return { t: a.ticker, pts }
  }).filter(v => v.pts.length), [data, tail, endOff])
  const endDate = view[0]?.pts[view[0].pts.length - 1]?.date

  const W = size.w, H = size.h, m = { l: 56, r: 18, t: 18, b: 40 }
  const visible = view.filter(v => !hidden.has(v.t))
  let ex = 2, ey = 2
  visible.forEach(v => v.pts.forEach(p => { ex = Math.max(ex, Math.abs(p.rs_ratio - 100)); ey = Math.max(ey, Math.abs(p.rs_momentum - 100)) }))
  ex *= 1.12; ey *= 1.12
  const sx = (v: number) => m.l + ((v - 100 + ex) / (2 * ex)) * (W - m.l - m.r)
  const sy = (v: number) => H - m.b - ((v - 100 + ey) / (2 * ey)) * (H - m.t - m.b)
  const cx = sx(100), cy = sy(100)
  const stx = niceStep(2 * ex), sty = niceStep(2 * ey)
  const ticks = (e: number, st: number) => { const o: number[] = []; for (let k = Math.ceil(-e / st); k * st <= e + 1e-9; k++) o.push(100 + k * st); return o }
  const dp = (st: number) => (st < 0.1 ? 2 : st < 1 ? 1 : 0)

  const pt = lang() === 'pt'
  const qq = q.trim().toUpperCase()
  const matches = qq ? available.filter(k => k !== bench && !sel.includes(k) && label(k).toUpperCase().includes(qq)).sort((a, b) => +!label(a).toUpperCase().startsWith(qq) - +!label(b).toUpperCase().startsWith(qq) || a.localeCompare(b)).slice(0, 16) : []
  const box = 'bg-black text-[#FFA028] border border-[#5a3d12] px-1 py-[1px] outline-none focus:border-[#FFA028]'
  const btn = (a: boolean) => `px-2 py-[2px] border text-[12px] ${a ? 'bg-[#FFA028] text-black border-[#FFA028] font-bold' : 'bg-black text-[#FFA028] border-[#5a3d12] hover:border-[#FFA028]'}`

  return (
    <div className="w-full -mt-4 sm:-mt-6 bg-black" style={{ fontFamily: MONO }}>
      {/* barra de título */}
      {/* mobile: 2 linhas — título truncado / semana + fonte numa faixa rolável; desktop: linha única como antes */}
      <div className="flex items-center gap-4 flex-wrap px-3 py-1 border-b border-[#3a3a3a] text-[13px] max-lg:gap-x-2 max-lg:gap-y-[2px]">
        <span className="font-bold text-black bg-[#FFA028] px-2 max-lg:shrink-0">RRG</span>
        <span className="text-[#d9d9d9] max-lg:flex-1 max-lg:min-w-0 max-lg:truncate">Relative Rotation Graph · vs <b className="text-[#FFA028]">{label(bench)}</b> · {lang() === 'pt' ? 'semanal (sexta)' : 'weekly (Friday)'}</span>
        <div className="lg:contents max-lg:w-full max-lg:flex max-lg:items-center max-lg:gap-4 max-lg:overflow-x-auto max-lg:whitespace-nowrap max-lg:[&>*]:shrink-0 max-lg:text-[12px] fn-strip">
          <span className="text-[#8a8a8a]">{endDate ? `Week of ${fmtD(endDate)} · tail ${tail} wk` : ''}</span>
          <span className="ml-auto text-[#8a8a8a] text-[11px] max-lg:ml-0">Educational use, not a recommendation</span>
        </div>
      </div>
      {/* controles */}
      <div className="flex items-center gap-3 flex-wrap px-3 py-1 border-b border-[#3a3a3a] bg-[#0a0a0a] text-[12px] text-[#8a8a8a] fn-strip max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:whitespace-nowrap max-lg:[&>*]:shrink-0">
        <label className="flex items-center gap-1">Benchmark
          <select className={box} value={bench} onChange={e => setBench(e.target.value)}>
            {available.map(k => <option key={k} value={k}>{label(k)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">RS {ema ? 'EMA' : 'SMA'}
          <input type="number" min={2} max={52} value={lbR} onChange={e => setLbR(Math.max(2, +e.target.value || 10))} className={`${box} w-12`} />
        </label>
        <label className="flex items-center gap-1">Mom. lb
          <input type="number" min={1} max={52} value={lbM} onChange={e => setLbM(Math.max(1, +e.target.value || 10))} className={`${box} w-12`} />
        </label>
        <div className="flex gap-[2px]"><button className={btn(ema)} onClick={() => setEma(true)}>EMA</button><button className={btn(!ema)} onClick={() => setEma(false)}>SMA</button></div>
        <label className="flex items-center gap-2">Weeks
          <input type="range" min={1} max={26} value={tail} onChange={e => setTail(+e.target.value)} className="accent-[#FFA028] w-28" />
          <b className="text-[#FFA028] w-5">{tail}</b>
        </label>
        <div className="flex gap-[2px]">{[4, 8, 12, 26].map(n => <button key={n} className={btn(tail === n)} onClick={() => setTail(n)}>{n}{lang() === 'pt' ? 'S' : 'W'}</button>)}</div>
        <label className="flex items-center gap-2">Date
          <input type="range" min={0} max={maxOff} value={maxOff - endOff} onChange={e => { setPlaying(false); setEndOff(maxOff - +e.target.value) }} className="accent-[#FFA028] w-36" />
        </label>
        <button className={btn(playing)} onClick={() => { if (!playing && endOff === 0) setEndOff(Math.min(maxOff, 26)); setPlaying(p => !p) }}>{playing ? (lang() === 'pt' ? '❚❚ Pausar' : '❚❚ Pause') : (lang() === 'pt' ? '▶ Animar' : '▶ Play')}</button>
      </div>

      <div className="flex w-full max-lg:flex-col">
        {/* gráfico */}
        {/* altura reservada por CSS já no HTML estático (mobile: ≈ largura × 1,05, igual ao fit) para não deslocar o painel ao hidratar */}
        <div ref={boxRef} className="relative flex-1 min-w-0 overflow-hidden max-lg:flex-none lg:h-[var(--rrg-h)] max-lg:h-[clamp(340px,105vw,560px)]" style={{ ['--rrg-h' as any]: `${size.h}px` }}>
          {err && <div className="absolute inset-0 flex items-center justify-center text-[#FF4D4D]">{err}</div>}
          <svg width={W} height={H} className="block select-none" onMouseLeave={() => setHover(null)}>
            <rect x={0} y={0} width={W} height={H} fill={tc(tc('#000'))} onClick={() => setHover(null)} />
            {([['Improving', m.l, m.t, cx - m.l, cy - m.t], ['Leading', cx, m.t, W - m.r - cx, cy - m.t], ['Lagging', m.l, cy, cx - m.l, H - m.b - cy], ['Weakening', cx, cy, W - m.r - cx, H - m.b - cy]] as [string, number, number, number, number][])
              .map(([k, x, y, w, h]) => <rect key={k} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={Q[k].c} opacity={0.075} />)}
            {ticks(ex, stx).map(v => <g key={`x${v}`}><line x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} stroke={tc(tc('#1f1f1f'))} strokeDasharray="1 3" /><text x={sx(v)} y={H - m.b + 15} textAnchor="middle" fontSize={10} fill={tc(tc('#8a8a8a'))}>{v.toFixed(dp(stx))}</text></g>)}
            {ticks(ey, sty).map(v => <g key={`y${v}`}><line y1={sy(v)} y2={sy(v)} x1={m.l} x2={W - m.r} stroke={tc(tc('#1f1f1f'))} strokeDasharray="1 3" /><text x={m.l - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} fill={tc(tc('#8a8a8a'))}>{v.toFixed(dp(sty))}</text></g>)}
            <line x1={cx} x2={cx} y1={m.t} y2={H - m.b} stroke={tc(tc('#FFA028'))} strokeOpacity={0.55} />
            <line y1={cy} y2={cy} x1={m.l} x2={W - m.r} stroke={tc(tc('#FFA028'))} strokeOpacity={0.55} />
            <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="none" stroke={tc(tc('#3a3a3a'))} />
            {[['Improving', m.l + 10, m.t + 20, 'start'], ['Leading', W - m.r - 10, m.t + 20, 'end'], ['Lagging', m.l + 10, H - m.b - 10, 'start'], ['Weakening', W - m.r - 10, H - m.b - 10, 'end']].map(([k, x, y, a]) =>
              <text key={k as string} x={x as number} y={y as number} textAnchor={a as any} fill={Q[k as string].c} fontSize={13} fontWeight={700} letterSpacing={2} opacity={0.9}>{Q[k as string].n}</text>)}
            <text x={(W + m.l) / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={tc(tc('#FFA028'))} letterSpacing={1}>JdK RS-RATIO →</text>
            <text transform={`translate(14 ${(H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={tc(tc('#FFA028'))} letterSpacing={1}>JdK RS-MOMENTUM →</text>

            {visible.map(v => {
              const c = colorOf[v.t], n = v.pts.length, dim = focus && focus !== v.t ? 0.18 : 1
              const P = v.pts.map(p => [sx(p.rs_ratio), sy(p.rs_momentum)] as const)
              const head = P[n - 1], prevP = P[n - 2] || head
              const an = Math.atan2(head[1] - prevP[1], head[0] - prevP[0])
              return (
                <g key={v.t} opacity={dim} onMouseEnter={() => setFocus(v.t)} onMouseLeave={() => setFocus(null)}>
                  {P.slice(1).map((q, i) => {
                    const age = (n - 2 - i) / Math.max(1, n - 1)
                    return <line key={i} x1={P[i][0]} y1={P[i][1]} x2={q[0]} y2={q[1]} stroke={c} strokeWidth={focus === v.t ? 2.8 : 1.9} strokeLinecap="round" opacity={0.18 + 0.82 * Math.pow(1 - age, 1.3)} />
                  })}
                  {P.slice(0, -1).map((q, i) => {
                    const p = v.pts[i], age = (n - 1 - i) / Math.max(1, n - 1)
                    return <circle key={i} cx={q[0]} cy={q[1]} r={2.6} fill={c} opacity={0.25 + 0.75 * Math.pow(1 - age, 1.3)}
                      onMouseEnter={() => setHover({ x: q[0], y: q[1], t: v.t, date: p.date, r: p.rs_ratio, m: p.rs_momentum })} onClick={() => setHover({ x: q[0], y: q[1], t: v.t, date: p.date, r: p.rs_ratio, m: p.rs_momentum })} onMouseLeave={() => setHover(null)} />
                  })}
                  {n > 1 && <polygon fill={c} points={[[head[0] + Math.cos(an) * 12, head[1] + Math.sin(an) * 12], [head[0] + Math.cos(an) * 5 + Math.cos(an + 1.57) * 5, head[1] + Math.sin(an) * 5 + Math.sin(an + 1.57) * 5], [head[0] + Math.cos(an) * 5 - Math.cos(an + 1.57) * 5, head[1] + Math.sin(an) * 5 - Math.sin(an + 1.57) * 5]].map(p => p.join(',')).join(' ')} />}
                  <circle cx={head[0]} cy={head[1]} r={6.5} fill={c} stroke={tc(tc('#000'))} strokeWidth={2}
                    onMouseEnter={() => { const p = v.pts[n - 1]; setHover({ x: head[0], y: head[1], t: v.t, date: p.date, r: p.rs_ratio, m: p.rs_momentum }) }} onClick={() => { const p = v.pts[n - 1]; setHover({ x: head[0], y: head[1], t: v.t, date: p.date, r: p.rs_ratio, m: p.rs_momentum }) }} onMouseLeave={() => setHover(null)} />
                  <text x={head[0] + (Math.cos(an) >= 0 ? 11 : -11)} y={head[1] - 9} textAnchor={Math.cos(an) >= 0 ? 'start' : 'end'} fontSize={12} fontWeight={700} fill={c} stroke={tc(tc('#000'))} strokeWidth={3} paintOrder="stroke">{label(v.t)}</text>
                </g>
              )
            })}
          </svg>
          {hover && (
            <div className="absolute z-20 pointer-events-none text-[12px] leading-[17px] px-2 py-1 border" style={{ left: Math.min(hover.x + 14, W - 210), top: Math.max(4, hover.y - 70), background: tc('#0a0a0a'), borderColor: colorOf[hover.t], color: tc('#d9d9d9') }}>
              <div className="font-bold" style={{ color: colorOf[hover.t] }}>{label(hover.t)} <span className="text-[#8a8a8a] font-normal">vs {label(bench)}</span></div>
              <div>Week <b className="text-white">{fmtD(hover.date)}</b></div>
              <div>RS-Ratio <b className="text-white">{hover.r.toFixed(2)}</b></div>
              <div>RS-Momentum <b className="text-white">{hover.m.toFixed(2)}</b></div>
              <div style={{ color: Q[quad(hover.r, hover.m)].c }}>{Q[quad(hover.r, hover.m)].n}</div>
            </div>
          )}
        </div>

        {/* painel lateral */}
        <div className="w-[300px] shrink-0 border-l border-[#3a3a3a] bg-[#050505] text-[12px] overflow-y-auto max-lg:w-full max-lg:!h-auto max-lg:border-l-0 max-lg:border-t" style={{ height: size.h }}>
          <div className="px-2 py-1 text-black bg-[#FFA028] font-bold">{pt ? 'ATIVOS' : 'ASSETS'}</div>
          <table className="w-full">
            <thead><tr className="text-[#8a8a8a] text-left"><th className="px-2 py-1 font-normal"> </th><th className="font-normal">Ticker</th><th className="font-normal text-right">Ratio</th><th className="font-normal text-right">Mom</th><th className="font-normal text-right pr-2">Quad.</th></tr></thead>
            <tbody>
              {/* enquanto calcula: uma linha por ativo selecionado (mesma altura) para o painel não "pular" */}
              {!data && sel.filter(k => k !== bench).map(k => <tr key={k} className="border-t border-[#1a1a1a]"><td className="px-2"><span className="inline-block w-[10px] h-[10px]" /></td><td className="font-bold text-[#8a8a8a]">{label(k)}</td><td className="text-right text-[#555]">—</td><td className="text-right text-[#555]">—</td><td className="text-right pr-2 text-[#555]">—</td></tr>)}
              {view.map(v => {
                const p = v.pts[v.pts.length - 1], q = quad(p.rs_ratio, p.rs_momentum), off = hidden.has(v.t)
                return (
                  <tr key={v.t} className={`cursor-pointer border-t border-[#1a1a1a] hover:bg-[#151515] ${off ? 'opacity-40' : ''}`}
                    onClick={() => setHidden(h => { const s = new Set(h); if (s.has(v.t)) s.delete(v.t); else s.add(v.t); return s })}
                    onMouseEnter={() => setFocus(v.t)} onMouseLeave={() => setFocus(null)}>
                    <td className="px-2"><span className="inline-block w-[10px] h-[10px]" style={{ background: off ? 'transparent' : colorOf[v.t], border: `1px solid ${colorOf[v.t]}` }} /></td>
                    <td className="font-bold" style={{ color: colorOf[v.t] }}>{label(v.t)}</td>
                    <td className="text-right text-white">{p.rs_ratio.toFixed(2)}</td>
                    <td className="text-right text-white">{p.rs_momentum.toFixed(2)}</td>
                    <td className="text-right pr-2" style={{ color: Q[q].c }}>{Q[q].n.slice(0, 4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-2 pt-3 pb-1 text-[#FFA028] font-bold border-b border-[#3a3a3a]">{pt ? 'ADICIONAR / REMOVER' : 'ADD / REMOVE'}</div>
          {/* seletor com busca (antes: 200+ botões, que empurravam o layout no mobile ao carregar a lista) */}
          <div className="p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {sel.filter(k => k !== bench).map(k => (
                <button key={k} className={btn(true)} title={pt ? 'Remover' : 'Remove'} onClick={() => setSel(s => s.filter(x => x !== k))}>{label(k)} ×</button>
              ))}
            </div>
            <input className={`${box} w-full py-[3px]`} value={q} onChange={e => setQ(e.target.value)} placeholder={pt ? `Buscar ativo para adicionar (${available.length})` : `Search an asset to add (${available.length})`}
              aria-label={pt ? 'Buscar ativo' : 'Search asset'} onKeyDown={e => { if (e.key === 'Enter' && matches[0]) { setSel(s => [...s, matches[0]]); setQ('') } }} />
            {q && <div className="flex flex-wrap gap-1">
              {matches.map(k => <button key={k} className={btn(false)} onClick={() => { setSel(s => [...s, k]); setQ('') }}>+ {label(k)}</button>)}
              {!matches.length && <span className="text-[#8a8a8a]">{pt ? 'Nenhum ativo encontrado' : 'No asset found'}</span>}
            </div>}
          </div>
          <div className="px-2 pt-3 pb-1 text-[#FFA028] font-bold border-b border-[#3a3a3a]">{pt ? 'QUADRANTES' : 'QUADRANTS'}</div>
          <div className="p-2 space-y-1 text-[#bdbdbd]">
            {['Leading', 'Weakening', 'Lagging', 'Improving'].map(k => <div key={k}><b style={{ color: Q[k].c }}>{Q[k].n}</b> — {Q[k].d}</div>)}
            <div className="pt-2 text-[#8a8a8a]">Typical clockwise rotation: Improving → Leading → Weakening → Lagging. Each point = 1 week; the larger point with an arrow is the current week. Tail length is visual only and does not change the calculation.</div>
            <div className="pt-1 text-[#8a8a8a]">Click an asset in the table to hide/show it; hover to highlight.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
