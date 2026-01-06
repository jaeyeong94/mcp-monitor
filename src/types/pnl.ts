// PnL 관련 타입 정의

export interface PnlMetric {
  timestamp: string;
  pnl: number;
  fee: number;
  buy_volume: number;
  sell_volume: number;
  trade_count: number;
  maker_ratio: number;
}

export interface RecentPnlResponse {
  pair: string;
  exchange: string;
  hours: number;
  calculation_method: string;
  summary: {
    total_pnl: number;
    total_volume: number;
    total_fee: number;
    data_points: number;
  };
  metrics: PnlMetric[];
}

export interface InventoryPnlData {
  timestamp: string;
  trade_count: number;
  buy_volume: number;
  sell_volume: number;
  position_change: number;
  cumulative_position: number;
  mid_price: number;
  avg_cost_basis: number;
  realized_pnl: number;
  unrealized_pnl: number;
  cumulative_realized_pnl: number;
  total_pnl: number;
  fee: number;
  cumulative_fee: number;
}

export interface DrawdownPeriod {
  timestamp: string;
  drawdown: number;
  position: number;
}

export interface InventoryPnlResponse {
  pair: string;
  exchange: string;
  period: {
    start: string;
    end: string;
  };
  interval: string;
  calculation_method: string;
  summary: {
    total_trades: number;
    final_position: number;
    cumulative_realized_pnl: number;
    final_unrealized_pnl: number;
    total_pnl: number;
    total_fee: number;
    max_drawdown: number;
    avg_cost_basis: number;
  };
  risk_analysis: {
    max_drawdown: number;
    top_drawdown_periods: DrawdownPeriod[];
  };
  data: InventoryPnlData[];
}

// Agent Config Types
export interface SpreadModelParameter {
  tif?: string;
  askTOB?: number;
  askFOB?: number;
  bidTOB?: number;
  bidFOB?: number;
  rampFactor?: number;
  volumeRung?: number;
  askVolumeRung?: number;
  bidVolumeRung?: number;
  askRampFactor?: number;
  bidRampFactor?: number;
  basePosition?: number;
  maxLongPosition?: number;
  maxShortPosition?: number;
}

export interface DepthModelParameter {
  askMinQuotingValue?: number | string;
  bidMinQuotingValue?: number | string;
  askDepthFactor?: number;
  bidDepthFactor?: number;
  askSharePnlPercent?: number;
  bidSharePnlPercent?: number;
  usingAutoMode?: boolean;
}

export interface VolatilityLevel {
  level?: string;
  threshold?: number;
  variables?: number[];
  formula?: string;
}

export interface VolatilityModelParameter {
  levels?: VolatilityLevel[];
  lambda?: number;
  multiplier?: number;
  updatePeriod?: number;
}

export interface MultiplierParameter {
  askMultiplier?: number;
  bidMultiplier?: number;
}

export interface PairConfig {
  pairKey: string;
  exchange: string;
  spreadModelParameter?: SpreadModelParameter;
  depthModelParameter?: DepthModelParameter;
  volatilityModelParameter?: VolatilityModelParameter;
  multiplierParameter?: MultiplierParameter;
}

export interface MmAgent {
  agent_id: string;
  strategy_name: string;
  host: string;
  is_live: boolean;
  exchanges: string;
  pairs: string[];
  pair_configs?: PairConfig[];
  updated_at: string;
}

export interface MmAgentsResponse {
  summary: {
    total_agents: number;
    live_agents: number;
    inactive_agents: number;
  };
  agents: MmAgent[];
}

export interface MarkoutInterval {
  interval_seconds: number;
  trade_count: number;
  avg_markout_bps: number;
  stddev_markout_bps: number;
  total_volume: number;
  total_markout_pnl: number;
}

export interface MarkoutResponse {
  pair: string;
  exchange: string;
  period: {
    start: string;
    end: string;
  };
  intervals_analyzed: number[];
  markout_analysis: MarkoutInterval[];
  interpretation: {
    positive_markout: string;
    negative_markout: string;
  };
}

// Multi-Pair PnL Comparison
export interface PairPnlSummary {
  pair: string;
  exchange: string;
  total_pnl: number;
  realized_pnl?: number;
  unrealized_pnl?: number;
  total_fee: number;
  total_volume?: number;
  buy_volume?: number;
  sell_volume?: number;
  trade_count: number;
  win_rate?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  pnl_per_volume?: number;
  spread_percentage?: number;
}

export interface MultiPairPnlResponse {
  period: {
    start: string;
    end: string;
  };
  pair_count: number;
  pairs: PairPnlSummary[];
  aggregate: {
    total_pnl: number;
    total_realized_pnl: number;
    total_unrealized_pnl: number;
    total_fee: number;
    total_volume: number;
    total_trade_count: number;
  };
}
