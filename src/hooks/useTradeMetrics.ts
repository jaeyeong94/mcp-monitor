import { useMemo } from 'react';
import type { TradesSummary, OrderbookSummary } from '../types/market';

// Metric types
export interface MetricValue {
  value: number;
  status: 'normal' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'stable';
}

export interface TradeMetrics {
  // DVR: Depth-to-Volume Ratio
  dvr: MetricValue;
  dvrHistory: { timestamp: string; value: number }[];

  // TII: Trade Intensity Index
  tii: MetricValue;
  tiiHistory: { timestamp: string; value: number }[];

  // Kyle's Lambda (Price Impact)
  lambda: MetricValue;
  lambdaHistory: { timestamp: string; value: number }[];

  // Amihud Illiquidity
  amihud: MetricValue;
  amihudHistory: { timestamp: string; value: number }[];

  // FPI: Flow Persistence Indicator
  fpi: MetricValue;
  fpiHistory: { timestamp: string; value: number }[];

  // VPIN: Volume-Synchronized Probability of Informed Trading
  vpin: MetricValue;
  vpinHistory: { timestamp: string; value: number }[];

  // WAS: Whale Activity Score
  was: MetricValue;
  wasHistory: { timestamp: string; value: number }[];

  // LSI: Liquidity Stress Index
  lsi: MetricValue;
  lsiHistory: { timestamp: string; value: number }[];
}

// Thresholds for each metric
const THRESHOLDS = {
  dvr: { warning: 0.5, danger: 0.2 },
  tii: { warning: 50, danger: 20 }, // low is bad
  lambda: { warning: 1.0, danger: 2.0 },
  amihud: { warning: 0.5, danger: 1.0 },
  fpi: { warning: 0.3, danger: 0.5 },
  vpin: { warning: 0.4, danger: 0.6 },
  was: { warning: 0.7, danger: 0.85 },
  lsi: { warning: 1.5, danger: 2.0 },
};

function getStatus(value: number, thresholds: { warning: number; danger: number }, inverse = false): 'normal' | 'warning' | 'danger' {
  if (inverse) {
    // Lower is worse (e.g., TII, DVR)
    if (value < thresholds.danger) return 'danger';
    if (value < thresholds.warning) return 'warning';
    return 'normal';
  } else {
    // Higher is worse (e.g., VPIN, Lambda)
    if (value > thresholds.danger) return 'danger';
    if (value > thresholds.warning) return 'warning';
    return 'normal';
  }
}

function calculateDVR(
  trades: TradesSummary[],
  orderbook: OrderbookSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  for (let i = 0; i < Math.min(trades.length, orderbook.length); i++) {
    const trade = trades[i];
    const ob = orderbook[i];
    if (!trade || !ob || trade.volume === 0) continue;

    const totalDepth = ob.avg_bid_depth + ob.avg_ask_depth;
    const dvr = totalDepth / trade.volume;
    history.push({ timestamp: trade.timestamp, value: dvr });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.dvr, true),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateTII(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  for (const trade of trades) {
    const priceChange = Math.abs(trade.ohlc.close - trade.ohlc.open);
    const priceChangeBps = (priceChange / trade.ohlc.open) * 10000;
    const tii = priceChangeBps > 0.1 ? trade.trade_count / priceChangeBps : trade.trade_count * 10;
    history.push({ timestamp: trade.timestamp, value: tii });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.tii, true),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateLambda(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  // Calculate rolling lambda using window of 5 intervals
  const windowSize = 5;
  for (let i = windowSize; i < trades.length; i++) {
    const window = trades.slice(i - windowSize, i);

    // Calculate regression: price_change ~ signed_volume
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
    for (const t of window) {
      const signedVolume = t.buy_sell.net_volume;
      const priceChange = (t.ohlc.close - t.ohlc.open) / t.ohlc.open * 10000; // bps
      sumX += signedVolume;
      sumY += priceChange;
      sumXY += signedVolume * priceChange;
      sumX2 += signedVolume * signedVolume;
    }

    const n = window.length;
    const denominator = n * sumX2 - sumX * sumX;
    const lambda = denominator !== 0 ? Math.abs((n * sumXY - sumX * sumY) / denominator) : 0;

    history.push({ timestamp: trades[i].timestamp, value: lambda });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.lambda),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateAmihud(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  for (const trade of trades) {
    const priceChange = Math.abs(trade.ohlc.close - trade.ohlc.open) / trade.ohlc.open;
    const amihud = trade.notional > 0 ? (priceChange / trade.notional) * 1_000_000 : 0;
    history.push({ timestamp: trade.timestamp, value: amihud });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.amihud),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateFPI(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  // Calculate flow persistence
  let consecutiveDir = 0;
  let lastDir = 0;
  let cumulativeCVD = 0;

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const currentDir = trade.buy_sell.buy_ratio > 0.5 ? 1 : -1;
    cumulativeCVD += trade.buy_sell.net_volume;

    if (currentDir === lastDir) {
      consecutiveDir++;
    } else {
      consecutiveDir = 1;
      lastDir = currentDir;
    }

    const totalVolume = trades.slice(0, i + 1).reduce((sum, t) => sum + t.volume, 0);
    const fpi = totalVolume > 0 ? (consecutiveDir * Math.abs(cumulativeCVD)) / totalVolume : 0;
    history.push({ timestamp: trade.timestamp, value: Math.min(fpi, 1) });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.fpi),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateVPIN(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  // VPIN using volume buckets (simplified: each interval = bucket)
  const windowSize = 10;
  for (let i = windowSize; i < trades.length; i++) {
    const window = trades.slice(i - windowSize, i);

    let totalBuyVolume = 0;
    let totalSellVolume = 0;

    for (const t of window) {
      totalBuyVolume += t.buy_sell.buy_volume;
      totalSellVolume += t.buy_sell.sell_volume;
    }

    const totalVolume = totalBuyVolume + totalSellVolume;
    const vpin = totalVolume > 0 ? Math.abs(totalBuyVolume - totalSellVolume) / totalVolume : 0;
    history.push({ timestamp: trades[i].timestamp, value: vpin });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.vpin),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateWAS(
  trades: TradesSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  // Calculate average volume for whale threshold
  const avgVolume = trades.reduce((sum, t) => sum + t.volume, 0) / trades.length;
  const whaleThreshold = avgVolume * 3; // 3x average = whale

  for (const trade of trades) {
    // Large trade ratio
    const largeTradeRatio = trade.volume > whaleThreshold ? 1 : trade.volume / whaleThreshold;

    // Concentration (extreme buy/sell ratio)
    const concentration = Math.abs(trade.buy_sell.buy_ratio - 0.5) * 2;

    // Volume spike (z-score proxy)
    const volumeSpike = Math.min((trade.volume / avgVolume) / 5, 1);

    const was = largeTradeRatio * 0.5 + concentration * 0.3 + volumeSpike * 0.2;
    history.push({ timestamp: trade.timestamp, value: was });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.was),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

function calculateLSI(
  trades: TradesSummary[],
  orderbook: OrderbookSummary[]
): { current: MetricValue; history: { timestamp: string; value: number }[] } {
  const history: { timestamp: string; value: number }[] = [];

  // Calculate baseline stats
  const avgSpread = orderbook.reduce((sum, o) => sum + o.spread_bps.mean, 0) / orderbook.length;
  const avgDepth = orderbook.reduce((sum, o) => sum + o.avg_bid_depth + o.avg_ask_depth, 0) / orderbook.length;
  const avgVolatility = trades.reduce((sum, t) => {
    return sum + Math.abs(t.ohlc.high - t.ohlc.low) / t.ohlc.open;
  }, 0) / trades.length;

  for (let i = 0; i < Math.min(trades.length, orderbook.length); i++) {
    const trade = trades[i];
    const ob = orderbook[i];

    // Spread deviation
    const spreadDeviation = avgSpread > 0 ? ob.spread_bps.mean / avgSpread : 1;

    // Depth reduction
    const currentDepth = ob.avg_bid_depth + ob.avg_ask_depth;
    const depthReduction = avgDepth > 0 ? 1 - (currentDepth / avgDepth) : 0;

    // Trading urgency (taker proxy via extreme buy/sell ratio)
    const urgency = Math.abs(trade.buy_sell.buy_ratio - 0.5) * 2;

    // Volatility spike
    const currentVol = Math.abs(trade.ohlc.high - trade.ohlc.low) / trade.ohlc.open;
    const volSpike = avgVolatility > 0 ? currentVol / avgVolatility : 1;

    const lsi = spreadDeviation * 0.3 + Math.max(depthReduction, 0) * 0.3 + urgency * 0.2 + volSpike * 0.2;
    history.push({ timestamp: trade.timestamp, value: lsi });
  }

  const lastValue = history[history.length - 1]?.value || 0;
  const prevValue = history[history.length - 2]?.value || lastValue;

  return {
    current: {
      value: lastValue,
      status: getStatus(lastValue, THRESHOLDS.lsi),
      trend: lastValue > prevValue ? 'up' : lastValue < prevValue ? 'down' : 'stable',
    },
    history,
  };
}

export function useTradeMetrics(
  trades: TradesSummary[] | null,
  orderbook: OrderbookSummary[] | null
): TradeMetrics | null {
  return useMemo(() => {
    if (!trades || !orderbook || trades.length === 0 || orderbook.length === 0) {
      return null;
    }

    const dvr = calculateDVR(trades, orderbook);
    const tii = calculateTII(trades);
    const lambda = calculateLambda(trades);
    const amihud = calculateAmihud(trades);
    const fpi = calculateFPI(trades);
    const vpin = calculateVPIN(trades);
    const was = calculateWAS(trades);
    const lsi = calculateLSI(trades, orderbook);

    return {
      dvr: dvr.current,
      dvrHistory: dvr.history,
      tii: tii.current,
      tiiHistory: tii.history,
      lambda: lambda.current,
      lambdaHistory: lambda.history,
      amihud: amihud.current,
      amihudHistory: amihud.history,
      fpi: fpi.current,
      fpiHistory: fpi.history,
      vpin: vpin.current,
      vpinHistory: vpin.history,
      was: was.current,
      wasHistory: was.history,
      lsi: lsi.current,
      lsiHistory: lsi.history,
    };
  }, [trades, orderbook]);
}
