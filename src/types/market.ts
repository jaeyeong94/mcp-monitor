export interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade_count?: number;
}

export interface OrderbookSummary {
  timestamp: string;
  mid_price: {
    open: number;
    close: number;
    high: number;
    low: number;
  };
  spread_bps: {
    mean: number;
    min: number;
    max: number;
  };
  avg_bid_depth: number;
  avg_ask_depth: number;
  avg_imbalance: number;
  snapshot_count: number;
}

export interface TradesSummary {
  timestamp: string;
  ohlc: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  notional: number;
  vwap: number;
  trade_count: number;
  buy_sell: {
    buy_volume: number;
    sell_volume: number;
    buy_ratio: number;
    net_volume: number;
  };
}

export interface Anomaly {
  timestamp: string;
  type: 'spread_spike' | 'volume_spike';
  value: number;
  z_score: number;
}

export interface MarketStats {
  price: {
    current: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
  };
  volume: {
    total: number;
    notional: number;
    buyRatio: number;
  };
  spread: {
    mean: number;
    max: number;
  };
  imbalance: {
    mean: number;
    buyPressure: number;
    sellPressure: number;
  };
  trades: {
    count: number;
    avgSize: number;
  };
}

export interface ExchangeSymbol {
  exchange: string;
  symbol: string;
}

