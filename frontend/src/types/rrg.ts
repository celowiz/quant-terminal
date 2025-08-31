/**
 * Tipos TypeScript para Relative Rotation Graph (RRG)
 */

export interface RRGConfig {
  benchmark_col: string;
  lookback_ratio: number;
  lookback_mom: number;
  tail: number;
  use_ema: boolean;
}

export interface RRGPoint {
  date: string;
  rs_ratio: number;
  rs_momentum: number;
  quadrant: string;
}

export interface RRGAssetData {
  ticker: string;
  points: RRGPoint[];
  current_rs_ratio: number;
  current_rs_momentum: number;
  current_quadrant: string;
}

export interface RRGResponse {
  config: RRGConfig;
  benchmark: string;
  assets: RRGAssetData[];
  date_range: {
    start: string | null;
    end: string | null;
  };
}

export type QuadrantType = 'Leading' | 'Improving' | 'Lagging' | 'Weakening';

export interface QuadrantConfig {
  name: QuadrantType;
  color: string;
  position: {
    x: 'left' | 'right';
    y: 'top' | 'bottom';
  };
}

export interface RRGChartConfig {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  showGrid: boolean;
  showLabels: boolean;
  showTrails: boolean;
  pointSize: number;
  trailOpacity: number;
}

export interface RRGFormData {
  benchmark: string;
  lookback_ratio: number;
  lookback_mom: number;
  tail: number;
  use_ema: boolean;
  tickers?: string;
}
