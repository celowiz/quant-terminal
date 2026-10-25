import { useState, useEffect } from 'react'
import axios from 'axios'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subYears, parseISO } from 'date-fns';
import DateRange from '../components/DateRange'

type ChartRow = { date: string; open: number; high: number; low: number; adjusted_close: number }

export default function GPCPage({ ticker }: { ticker: string }) {
  const [tickerInfo, setTickerInfo] = useState<any>(null)
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(format(subYears(new Date(), 3), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hovered, setHovered] = useState<ChartRow | null>(null)

  useEffect(() => {
    if (ticker) {
      loadTickerData(ticker);
    }
    // eslint-disable-next-line
  }, [ticker, startDate, endDate]);

  const loadTickerData = async (ticker: string) => {
    setLoading(true);
    try {
      const infoResponse = await axios.get(`http://localhost:8000/info/${ticker}`)
      setTickerInfo(infoResponse.data)
      const pricesResponse = await axios.get(`http://localhost:8000/prices/${ticker}`)
      const rows: ChartRow[] = (pricesResponse.data || []).map((p: any) => ({
        date: p.time,
        open: Number(p.open),
        high: Number(p.high),
        low: Number(p.low),
        adjusted_close: Number(p.close),
      }))
      setChartData(rows)
    } catch (error) {
      setTickerInfo(null)
      setChartData([])
    } finally {
      setLoading(false)
    }
  };

  // Calcular change percentual entre os dois últimos adjusted_close
  let changePct: number | null = null, changeNet: number | null = null;
  if (chartData.length >= 2) {
    const last = chartData[chartData.length - 1].adjusted_close;
    const prev = chartData[chartData.length - 2].adjusted_close;
    if (last && prev) {
      changePct = ((last - prev) / prev) * 100;
      changeNet = last - prev;
    }
  }

  // Última observação
  const lastObs = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Função para calcular ticks do eixo Y
  function getNiceTicks(min: number | null, max: number | null, maxTicks = 8) {
    if (min == null || max == null) return [];
    const range = max - min;
    if (range === 0) return [min];
    // Nice step: 1, 2, 5, 10, 20, 50, 100, etc.
    const roughStep = range / maxTicks;
    const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
    let step = pow10;
    if (roughStep / pow10 > 5) step = 10 * pow10;
    else if (roughStep / pow10 > 2) step = 5 * pow10;
    else if (roughStep / pow10 > 1) step = 2 * pow10;
    // Para ativos baratos, permitir casas decimais
    if (step < 1) step = Math.max(0.01, Math.round(step * 100) / 100);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = niceMin; v <= niceMax + step / 2; v += step) {
      ticks.push(Number(v.toFixed(2)));
    }
    return ticks;
  }

  // High/Low e datas
  let high: ChartRow | null = null, highDate: string | null = null, low: ChartRow | null = null, lowDate: string | null = null, minY: number | null = null, maxY: number | null = null, yTicks: number[] = [];
  if (chartData.length > 0) {
    high = chartData.reduce((a, b) => (a.adjusted_close > b.adjusted_close ? a : b));
    low = chartData.reduce((a, b) => (a.adjusted_close < b.adjusted_close ? a : b));
    highDate = high.date;
    lowDate = low.date;
    minY = Math.max(0, 0.8 * low.adjusted_close);
    maxY = 1.1 * high.adjusted_close;
    yTicks = getNiceTicks(minY, maxY, 8);
  }

  // Eixo X: formato dinâmico (formatação inicial)
  const xTickFormatter = chartData.length > 200
    ? (value: string) => format(parseISO(value), 'MMM')
    : (value: string) => format(parseISO(value), 'MMM dd')

  // Eixo X: render customizado padrão
  const renderCustomXAxisTick = (props: any) => {
    const { x, y, payload } = props
    return (
      <text x={x} y={y + 10} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={500}>
        {xTickFormatter(payload.value)}
      </text>
    );
  };

  // Marcador customizado para o preço atual sobre o eixo Y
  const renderYAxisTick = (props: any) => {
    const { x, y, payload } = props
    const isCurrent = currentPrice && Math.abs(payload.value - currentPrice) < 1e-6;
    return (
      <g>
        <text x={x + 6} y={y + 4} fill="#fff" fontWeight={isCurrent ? 700 : 400} fontSize={13}>
          {payload.value.toFixed(2)}
        </text>
      </g>
    );
  };
  // Preço atual para marcador
  const currentPrice = lastObs?.adjusted_close;

  // Cores derivadas com segurança para nulos
  const changePctColor = changePct !== null ? (changePct > 0 ? '#00FF00' : changePct < 0 ? '#FF2D55' : '#fff') : '#fff'
  const changeNetColor = changeNet !== null ? (changeNet > 0 ? '#00FF00' : changeNet < 0 ? '#FF2D55' : '#fff') : '#fff'

  // Caixa de valores funcional
  const boxObs = hovered || lastObs;

  {/*
  // Grid vertical no início de cada mês (todos cinza)
  const renderMonthGrids = () => {
    if (chartData.length === 0) return null;
    const lines = [];
    let lastMonth = null;
    chartData.forEach((d, i) => {
      const date = parseISO(d.date);
      const month = format(date, 'MMM');
      if (month !== lastMonth) {
        const x = (i / (chartData.length - 1)) * 100;
        lines.push(
          <line
            key={`grid-month-${i}`}
            x1={`${x}%`} x2={`${x}%`} y1={30} y2={330}
            stroke="#888"
            strokeWidth={1}
            opacity={0.5}
            strokeDasharray="2 4"
          />
        );
        lastMonth = month;
      }
    });
    return <g>{lines}</g>;
  };
  */}

  return (
    <div className="bloomberg-terminal homepage-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="ticker-info-section">
          {tickerInfo && lastObs && (
            <div className="price-info">
              <div className="main-price">
                <span className="ticker-symbol">{ticker}</span>
                <span className="price">{boxObs?.adjusted_close?.toFixed(2) || 'N/A'}</span>
                <span className="change" style={{ color: changePctColor }}>
                  {changePct !== null ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%` : '+0.00%'}
                </span>
                <span className="net" style={{ color: changeNetColor }}>
                  {changeNet !== null ? `${changeNet > 0 ? '+' : ''}${changeNet.toFixed(2)}` : '+0.00'}
                </span>
              </div>
              <div className="price-details">
                <span>{boxObs?.date}</span>
                <span>Open: {boxObs?.open?.toFixed(2) ?? 'N/A'}</span>
                <span style={{ color: '#00FF00' }}>▲ High: {boxObs?.high?.toFixed(2) ?? 'N/A'}</span>
                <span style={{ color: '#FF2D55' }}>▼ Low: {boxObs?.low?.toFixed(2) ?? 'N/A'}</span>
                <span>Close: {boxObs?.adjusted_close?.toFixed(2) ?? 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        <DateRange
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onDateChange={() => ticker && loadTickerData(ticker)}
        />
        <div className="chart-container" style={{ maxHeight: 350, minHeight: 250, position: 'relative' }}>
          {/* Caixa de valores funcional no canto superior direito */}
          {chartData.length > 0 && (
            <div style={{ position: 'absolute', top: 10, right: 20, background: '#111', color: '#fff', border: '1px solid #FFA028', borderRadius: 6, padding: '10px 18px', zIndex: 10, fontSize: 14, fontWeight: 500, boxShadow: '0 2px 8px #000a' }}>
              <div>Last Price: <b style={{ color: '#FFA028' }}>{boxObs?.adjusted_close?.toFixed(2)}</b></div>
              <div><span style={{ color: '#00FF00' }}>▲</span> High on {highDate}: <b style={{ color: '#00FF00' }}>{high?.adjusted_close?.toFixed(2)}</b></div>
              <div><span style={{ color: '#FF2D55' }}>▼</span> Low on {lowDate}: <b style={{ color: '#FF2D55' }}>{low?.adjusted_close?.toFixed(2)}</b></div>
            </div>
          )}
          {loading ? (
            <div className="loading">Loading...</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={chartData}
                margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                 onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    setHovered(state.activePayload[0].payload as ChartRow);
                  } else {
                    setHovered(null);
                  }
                }}
                onMouseLeave={() => setHovered(null)}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="#888" vertical={true} horizontal={true} />
                {/*{renderMonthGrids()}*/}
                <XAxis
                  dataKey="date"
                  stroke="#fff"
                  tick={renderCustomXAxisTick}
                  tickFormatter={xTickFormatter}
                />
                <YAxis
                  stroke="#fff"
                  tick={renderYAxisTick}
                  domain={minY && maxY ? [minY, maxY] : ['dataMin', 'dataMax']}
                  dataKey="adjusted_close"
                  ticks={yTicks}
                  orientation="right"
                  yAxisId="right"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#000',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                  formatter={(value, name) =>
                    name === 'adjusted_close'
                      ? [`${Number(value).toFixed(2)}`, 'Adj Close']
                      : [value, name]
                  }
                />
                <Area
                  type="monotone"
                  dataKey="adjusted_close"
                  stroke="#fff"
                  fill="#00a8ff"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  yAxisId="right"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="adjusted_close"
                  stroke="#fff"
                  strokeWidth={2}
                  yAxisId="right"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

export {}