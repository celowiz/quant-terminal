/** Cores e fonte dos gráficos — módulo leve, separado de PriceChart para não puxar lightweight-charts para o bundle inicial. */
import { tc } from '../../lib/themeRuntime'

export const T = {
  bg: tc('#101010'),          // fundo "carvão"
  grid: tc('#262626'),
  axis: tc('#8a8a8a'),
  text: tc('#d9d9d9'),
  amber: tc('#FFA028'),
  up: tc('#FFFFFF'),          // candle de alta: contorno/pavio branco, corpo vazio
  down: tc('#2F7BFF'),        // candle de baixa: corpo e pavio azuis
  line: tc('#FFFFFF'),
  mountain: tc('rgba(47,123,255,0.28)'),
  high: tc('#3DDC84'),
  low: tc('#FF4D4D'),
  sma50: tc('#FFA028'),
  sma200: tc('#C77DFF'),
}
export const MONO = "'IBM Plex Mono','Roboto Mono','SFMono-Regular',Menlo,Consolas,ui-monospace,monospace"
