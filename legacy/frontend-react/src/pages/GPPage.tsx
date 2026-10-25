import { useState, useEffect } from 'react'
import axios from 'axios'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subYears, parseISO } from 'date-fns';
import DateRange from '../components/DateRange'
import TimeframeSelector from '../components/TimeframeSelector'
import { usePageTitle } from '../hooks/usePageTitle'

type ChartRow = { date: string; open: number; high: number; low: number; adjusted_close: number }

export default function GPPage({ ticker }: { ticker: string }) {
  // Atualizar título da página
  usePageTitle('Line Graph')
  
  const [tickerInfo, setTickerInfo] = useState<any>(null)
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(format(subYears(new Date(), 3), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [timeframe, setTimeframe] = useState('d')
  const [hovered, setHovered] = useState<ChartRow | null>(null)

  useEffect(() => {
    console.log('useEffect triggered with ticker:', ticker, 'startDate:', startDate, 'endDate:', endDate);
    if (ticker) {
      loadTickerData(ticker);
    }
    // eslint-disable-next-line
  }, [ticker, startDate, endDate]);

  useEffect(() => {
    console.log('useEffect timeframe triggered with ticker:', ticker, 'timeframe:', timeframe);
    if (ticker) {
      loadTickerData(ticker);
    }
    // eslint-disable-next-line
  }, [timeframe]);

  const loadTickerData = async (ticker: string) => {
    setLoading(true);
    try {
      console.log('Loading data for ticker:', ticker, 'with params:', { startDate, endDate, timeframe });
      
      const infoResponse = await axios.get(`http://localhost:8000/info/${ticker}`)
      console.log('Info response:', infoResponse.data);
      setTickerInfo(infoResponse.data)
      
      // Construir URL com parâmetros de data e timeframe
      const params = new URLSearchParams({
        timeframe: timeframe
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const url = `http://localhost:8000/prices/${ticker}?${params.toString()}`;
      console.log('Fetching prices from:', url);
      
      const pricesResponse = await axios.get(url)
      console.log('Received prices data:', pricesResponse.data?.length || 0, 'rows');
      console.log('First few rows:', pricesResponse.data?.slice(0, 3));
      
      const rows: ChartRow[] = (pricesResponse.data || []).map((p: any) => ({
        date: p.time,
        open: Number(p.open),
        high: Number(p.high),
        low: Number(p.low),
        adjusted_close: Number(p.close),
      }))
      console.log('Processed rows:', rows.slice(0, 3));
      setChartData(rows)
    } catch (error) {
      console.error('Error loading ticker data:', error);
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
  let high: ChartRow | null = null,
    highDate: string | null = null,
    low: ChartRow | null = null,
    lowDate: string | null = null,
    minY: number | null = null,
    maxY: number | null = null,
    yTicks: number[] = [];
  if (chartData.length > 0) {
    high = chartData.reduce((a, b) => (a.adjusted_close > b.adjusted_close ? a : b));
    low = chartData.reduce((a, b) => (a.adjusted_close < b.adjusted_close ? a : b));
    highDate = high.date;
    lowDate = low.date;
    minY = Math.max(0, 0.9 * low.adjusted_close);
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

  console.log('GPPage render - tickerInfo:', tickerInfo, 'chartData length:', chartData.length, 'loading:', loading);
  
  return (
    <div className="flex flex-col h-full bg-[#0b0c10] overflow-hidden">
      {/* Header section com informações de preço */}
      {tickerInfo && lastObs && (
        <div className="px-5 py-2 border-b border-gray-600 bg-[#0b0c10]">
          <div className="flex items-center gap-6 text-base font-bold text-white">
            <span className="text-white">{ticker}</span>
            <span className="text-white">{boxObs?.adjusted_close?.toFixed(2) || 'N/A'}</span>
            <span style={{ color: changePctColor }}>
              {changePct !== null ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%` : '+0.00%'}
            </span>
            <span style={{ color: changeNetColor }}>
              {changeNet !== null ? `${changeNet > 0 ? '+' : ''}${changeNet.toFixed(2)}` : '+0.00'}
            </span>
            <span className="text-white">{boxObs?.date}</span>
            <span className="text-white">Open: {boxObs?.open?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-green-500">▲ High: {boxObs?.high?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-red-500">▼ Low: {boxObs?.low?.toFixed(2) ?? 'N/A'}</span>
            <span className="text-white">Close: {boxObs?.adjusted_close?.toFixed(2) ?? 'N/A'}</span>
          </div>
        </div>
      )}
      
      {/* Controles de filtro */}
      <div className="px-5 py-2 border-b border-gray-600 bg-[#0b0c10] flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-5">
          <DateRange
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            onDateChange={() => {
              if (ticker) {
                loadTickerData(ticker);
              }
            }}
          />
          <TimeframeSelector 
            timeframe={timeframe}
            setTimeframe={setTimeframe}
          />
        </div>
        
        {/* Informações estatísticas */}
        {tickerInfo && lastObs && (
          <div className="flex items-center gap-6 text-sm font-medium text-white">
            <span>Última atualização: {lastObs?.date}</span>
            <span className="text-green-500">▲ High: {high?.adjusted_close?.toFixed(2)}</span>
            <span className="text-red-500">▼ Low: {low?.adjusted_close?.toFixed(2)}</span>
          </div>
        )}
      </div>
        
      {/* Container do gráfico */}
      <div className="flex-1 flex flex-col bg-[#111111] relative">
        {/* Caixa de valores funcional no canto superior esquerdo */}
        {chartData.length > 0 && (
          <div className="absolute top-3 left-5 bg-[#111111] text-white border border-[#FFA028] rounded-md px-4 py-3 z-10 text-sm font-medium shadow-lg">
            <div>Last Price: <span className="font-bold text-[#FFA028]">{boxObs?.adjusted_close?.toFixed(2)}</span></div>
            <div><span className="text-green-500">▲</span> High on {highDate}: <span className="font-bold text-green-500">{high?.adjusted_close?.toFixed(2)}</span></div>
            <div><span className="text-red-500">▼</span> Low on {lowDate}: <span className="font-bold text-red-500">{low?.adjusted_close?.toFixed(2)}</span></div>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-full text-white text-lg font-bold">
            Loading...
          </div>
        ) : chartData.length > 0 ? (
          <div className="w-full h-full bg-[#111111]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ left: 20, right: 20, top: 40, bottom: 20 }}
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
                    color: '#fff',
                    borderRadius: '4px'
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
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-base">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

export {}