/**
 * Market Regime Detection
 *
 * Analyzes market data to classify the current market regime:
 * - Trending (Bullish/Bearish): Based on SMA crossover and price momentum
 * - Mean Reverting: Based on RSI extremes and price deviation from mean
 * - High Volatility: Based on ATR and spread spikes
 * - Consolidation: Based on narrow price range
 */

import type { TradesSummary, OrderbookSummary } from '../types/market';

export type RegimeType = 'trending_bull' | 'trending_bear' | 'mean_reverting' | 'high_volatility' | 'consolidation' | 'unknown';

export interface RegimeSignal {
  type: RegimeType;
  confidence: number;    // 0-100
  timestamp: Date;
  indicators: {
    smaFast?: number;
    smaSlow?: number;
    rsi?: number;
    atr?: number;
    volatility?: number;
    priceDeviation?: number;
  };
}

export interface RegimeAnalysis {
  current: RegimeSignal;
  history: RegimeSignal[];
  metrics: {
    trendStrength: number;    // -100 (bearish) to 100 (bullish)
    volatilityRatio: number;  // Current vol / Average vol
    momentum: number;         // Rate of price change
    spreadAnomaly: number;    // Current spread vs average spread
  };
}

// Configuration
const CONFIG = {
  SMA_FAST: 5,      // Fast SMA period
  SMA_SLOW: 15,     // Slow SMA period
  RSI_PERIOD: 14,   // RSI period
  ATR_PERIOD: 14,   // ATR period
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,
  VOLATILITY_THRESHOLD: 1.5, // ATR multiplier for high volatility
  CONSOLIDATION_THRESHOLD: 0.3, // Narrow range threshold (%)
};

// Calculate Simple Moving Average
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// Calculate RSI
function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // First RSI values (need at least `period` data points)
  for (let i = 0; i < period; i++) {
    rsi.push(NaN);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < closes.length; i++) {
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }

    // Smoothed averages
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
  }

  return rsi;
}

// Calculate Average True Range (ATR)
function calculateATR(data: TradesSummary[], period: number = 14): number[] {
  const tr: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const high = data[i].ohlc?.high ?? 0;
    const low = data[i].ohlc?.low ?? 0;
    const prevClose = i > 0 ? (data[i - 1].ohlc?.close ?? low) : low;

    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trueRange);
  }

  // Calculate ATR using SMA
  return calculateSMA(tr, period);
}

// Calculate price momentum (rate of change)
function calculateMomentum(closes: number[], period: number = 5): number {
  if (closes.length < period + 1) return 0;

  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];

  if (past === 0) return 0;
  return ((current - past) / past) * 100;
}

// Determine regime from indicators
function determineRegime(
  smaFast: number,
  smaSlow: number,
  rsi: number,
  atr: number,
  avgAtr: number,
  priceRange: number,
  avgPrice: number
): { type: RegimeType; confidence: number } {
  const volatilityRatio = avgAtr > 0 ? atr / avgAtr : 1;
  const rangePercent = avgPrice > 0 ? (priceRange / avgPrice) * 100 : 0;

  // High Volatility detection (priority)
  if (volatilityRatio > CONFIG.VOLATILITY_THRESHOLD) {
    return {
      type: 'high_volatility',
      confidence: Math.min(100, (volatilityRatio - 1) * 50 + 50),
    };
  }

  // Mean Reverting detection (RSI extremes)
  if (rsi > CONFIG.RSI_OVERBOUGHT || rsi < CONFIG.RSI_OVERSOLD) {
    return {
      type: 'mean_reverting',
      confidence: Math.min(100, Math.abs(rsi - 50) * 2),
    };
  }

  // Consolidation detection (narrow range)
  if (rangePercent < CONFIG.CONSOLIDATION_THRESHOLD) {
    return {
      type: 'consolidation',
      confidence: Math.min(100, (CONFIG.CONSOLIDATION_THRESHOLD - rangePercent) * 200 + 50),
    };
  }

  // Trending detection (SMA crossover)
  if (!isNaN(smaFast) && !isNaN(smaSlow)) {
    const smaDiff = ((smaFast - smaSlow) / smaSlow) * 100;

    if (smaDiff > 0.1) {
      return {
        type: 'trending_bull',
        confidence: Math.min(100, smaDiff * 50 + 50),
      };
    } else if (smaDiff < -0.1) {
      return {
        type: 'trending_bear',
        confidence: Math.min(100, Math.abs(smaDiff) * 50 + 50),
      };
    }
  }

  return { type: 'unknown', confidence: 0 };
}

// Main analysis function
export function analyzeRegime(
  trades: TradesSummary[],
  orderbook?: OrderbookSummary[]
): RegimeAnalysis {
  // Default result for insufficient data
  const defaultResult: RegimeAnalysis = {
    current: {
      type: 'unknown',
      confidence: 0,
      timestamp: new Date(),
      indicators: {},
    },
    history: [],
    metrics: {
      trendStrength: 0,
      volatilityRatio: 1,
      momentum: 0,
      spreadAnomaly: 0,
    },
  };

  if (trades.length < CONFIG.SMA_SLOW) {
    return defaultResult;
  }

  // Extract price data
  const closes = trades.map((t) => t.ohlc?.close ?? 0).filter((p) => p > 0);
  const highs = trades.map((t) => t.ohlc?.high ?? 0).filter((p) => p > 0);
  const lows = trades.map((t) => t.ohlc?.low ?? 0).filter((p) => p > 0);

  if (closes.length < CONFIG.SMA_SLOW) {
    return defaultResult;
  }

  // Calculate indicators
  const smaFast = calculateSMA(closes, CONFIG.SMA_FAST);
  const smaSlow = calculateSMA(closes, CONFIG.SMA_SLOW);
  const rsi = calculateRSI(closes, CONFIG.RSI_PERIOD);
  const atr = calculateATR(trades, CONFIG.ATR_PERIOD);

  // Get latest values
  const latestSmaFast = smaFast[smaFast.length - 1];
  const latestSmaSlow = smaSlow[smaSlow.length - 1];
  const latestRsi = rsi[rsi.length - 1];
  const latestAtr = atr[atr.length - 1];

  // Calculate averages for comparison
  const validAtr = atr.filter((v) => !isNaN(v));
  const avgAtr = validAtr.length > 0
    ? validAtr.reduce((a, b) => a + b, 0) / validAtr.length
    : latestAtr;

  const avgPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
  const priceRange = Math.max(...highs) - Math.min(...lows);

  // Calculate spread anomaly from orderbook
  let spreadAnomaly = 0;
  if (orderbook && orderbook.length > 0) {
    const spreads = orderbook
      .map((o) => o.spread_bps?.mean ?? 0)
      .filter((s) => s > 0);
    if (spreads.length > 0) {
      const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
      const currentSpread = spreads[spreads.length - 1];
      spreadAnomaly = avgSpread > 0 ? (currentSpread - avgSpread) / avgSpread : 0;
    }
  }

  // Determine current regime
  const { type, confidence } = determineRegime(
    latestSmaFast,
    latestSmaSlow,
    latestRsi ?? 50,
    latestAtr ?? 0,
    avgAtr,
    priceRange,
    avgPrice
  );

  // Calculate metrics
  const trendStrength = !isNaN(latestSmaFast) && !isNaN(latestSmaSlow)
    ? ((latestSmaFast - latestSmaSlow) / latestSmaSlow) * 1000
    : 0;

  const volatilityRatio = avgAtr > 0 ? (latestAtr ?? avgAtr) / avgAtr : 1;
  const momentum = calculateMomentum(closes);

  // Build regime signal
  const current: RegimeSignal = {
    type,
    confidence,
    timestamp: new Date(),
    indicators: {
      smaFast: latestSmaFast,
      smaSlow: latestSmaSlow,
      rsi: latestRsi,
      atr: latestAtr,
      volatility: volatilityRatio,
      priceDeviation: avgPrice > 0
        ? ((closes[closes.length - 1] - avgPrice) / avgPrice) * 100
        : 0,
    },
  };

  return {
    current,
    history: [], // History tracking can be added later with state
    metrics: {
      trendStrength: Math.max(-100, Math.min(100, trendStrength)),
      volatilityRatio,
      momentum,
      spreadAnomaly,
    },
  };
}

// Helper function to get regime display properties
export function getRegimeDisplay(type: RegimeType): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  switch (type) {
    case 'trending_bull':
      return {
        label: 'Bullish Trend',
        color: '#3fb950',
        icon: '📈',
        description: 'Strong upward momentum with SMA crossover',
      };
    case 'trending_bear':
      return {
        label: 'Bearish Trend',
        color: '#f85149',
        icon: '📉',
        description: 'Strong downward momentum with SMA crossover',
      };
    case 'mean_reverting':
      return {
        label: 'Mean Reverting',
        color: '#a371f7',
        icon: '↔️',
        description: 'Price at extremes, likely to revert to mean',
      };
    case 'high_volatility':
      return {
        label: 'High Volatility',
        color: '#f0883e',
        icon: '⚡',
        description: 'Elevated price swings and uncertainty',
      };
    case 'consolidation':
      return {
        label: 'Consolidation',
        color: '#8b949e',
        icon: '📊',
        description: 'Tight price range, low volatility',
      };
    default:
      return {
        label: 'Unknown',
        color: '#8b949e',
        icon: '❓',
        description: 'Insufficient data for regime detection',
      };
  }
}
