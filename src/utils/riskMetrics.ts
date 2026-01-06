/**
 * Risk Metrics Calculation
 *
 * Provides risk analysis metrics for trading data:
 * - Value at Risk (VaR): Potential loss at given confidence level
 * - Sharpe Ratio: Risk-adjusted return measure
 * - Maximum Drawdown: Largest peak-to-trough decline
 * - Volatility: Standard deviation of returns
 */

import type { TradesSummary } from '../types/market';

export interface RiskMetrics {
  // Value at Risk
  var95: number;           // 95% VaR (1-day)
  var99: number;           // 99% VaR (1-day)
  cvar95: number;          // Conditional VaR (Expected Shortfall)

  // Performance Metrics
  sharpeRatio: number;     // Risk-adjusted return
  sortinoRatio: number;    // Downside risk-adjusted return

  // Volatility
  volatility: number;      // Annualized volatility
  dailyVolatility: number; // Daily volatility

  // Drawdown
  maxDrawdown: number;     // Maximum drawdown (percentage)
  currentDrawdown: number; // Current drawdown from peak
  drawdownDuration: number; // Number of periods in drawdown

  // Return Statistics
  totalReturn: number;     // Total return percentage
  avgReturn: number;       // Average return per period
  winRate: number;         // Percentage of positive returns
}

export interface DrawdownPoint {
  timestamp: string;
  price: number;
  peak: number;
  drawdown: number;
}

// Configuration
const CONFIG = {
  RISK_FREE_RATE: 0.05,    // 5% annual risk-free rate
  TRADING_PERIODS: 365,     // For annualization (crypto = 365 days)
  VAR_CONFIDENCE_95: 1.645, // Z-score for 95% confidence
  VAR_CONFIDENCE_99: 2.326, // Z-score for 99% confidence
};

/**
 * Calculate returns from price series
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Calculate mean of array
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Calculate downside deviation (for Sortino ratio)
 */
function downsideDeviation(returns: number[], targetReturn: number = 0): number {
  const downsideReturns = returns
    .filter((r) => r < targetReturn)
    .map((r) => Math.pow(r - targetReturn, 2));

  if (downsideReturns.length === 0) return 0;
  return Math.sqrt(mean(downsideReturns));
}

/**
 * Calculate Value at Risk using parametric method
 */
function calculateVaR(
  returns: number[],
  confidence: number,
  portfolioValue: number = 1
): number {
  const avgReturn = mean(returns);
  const volatility = stdDev(returns);

  // VaR = -μ + σ * z
  return portfolioValue * (-avgReturn + volatility * confidence);
}

/**
 * Calculate Conditional VaR (Expected Shortfall)
 */
function calculateCVaR(
  returns: number[],
  confidence: number = 0.95
): number {
  if (returns.length === 0) return 0;

  // Sort returns ascending
  const sortedReturns = [...returns].sort((a, b) => a - b);

  // Get the worst (1-confidence)% of returns
  const cutoffIndex = Math.floor(returns.length * (1 - confidence));
  const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);

  if (tailReturns.length === 0) return 0;
  return -mean(tailReturns);
}

/**
 * Calculate Maximum Drawdown and drawdown series
 */
function calculateDrawdown(prices: number[]): {
  maxDrawdown: number;
  currentDrawdown: number;
  drawdownDuration: number;
  drawdownSeries: number[];
} {
  if (prices.length === 0) {
    return {
      maxDrawdown: 0,
      currentDrawdown: 0,
      drawdownDuration: 0,
      drawdownSeries: [],
    };
  }

  let peak = prices[0];
  let maxDrawdown = 0;
  let currentDrawdownStart = 0;
  let maxDrawdownDuration = 0;
  let currentDuration = 0;
  const drawdownSeries: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      currentDrawdownStart = i;
      currentDuration = 0;
    }

    const drawdown = peak > 0 ? (peak - prices[i]) / peak : 0;
    drawdownSeries.push(drawdown);

    if (drawdown > 0) {
      currentDuration = i - currentDrawdownStart;
    }

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownDuration = currentDuration;
    }
  }

  const currentDrawdown = drawdownSeries[drawdownSeries.length - 1] || 0;

  return {
    maxDrawdown,
    currentDrawdown,
    drawdownDuration: maxDrawdownDuration,
    drawdownSeries,
  };
}

/**
 * Calculate Sharpe Ratio
 */
function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = CONFIG.RISK_FREE_RATE,
  periodsPerYear: number = CONFIG.TRADING_PERIODS
): number {
  if (returns.length < 2) return 0;

  const avgReturn = mean(returns);
  const volatility = stdDev(returns);

  if (volatility === 0) return 0;

  // Annualize
  const annualReturn = avgReturn * periodsPerYear;
  const annualVolatility = volatility * Math.sqrt(periodsPerYear);

  return (annualReturn - riskFreeRate) / annualVolatility;
}

/**
 * Calculate Sortino Ratio (downside-adjusted)
 */
function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = CONFIG.RISK_FREE_RATE,
  periodsPerYear: number = CONFIG.TRADING_PERIODS
): number {
  if (returns.length < 2) return 0;

  const avgReturn = mean(returns);
  const downDev = downsideDeviation(returns);

  if (downDev === 0) return avgReturn > 0 ? Infinity : 0;

  // Annualize
  const annualReturn = avgReturn * periodsPerYear;
  const annualDownDev = downDev * Math.sqrt(periodsPerYear);

  return (annualReturn - riskFreeRate) / annualDownDev;
}

/**
 * Main function: Analyze risk metrics from trades data
 */
export function analyzeRisk(trades: TradesSummary[]): RiskMetrics {
  // Default result for insufficient data
  const defaultResult: RiskMetrics = {
    var95: 0,
    var99: 0,
    cvar95: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    volatility: 0,
    dailyVolatility: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
    drawdownDuration: 0,
    totalReturn: 0,
    avgReturn: 0,
    winRate: 0,
  };

  if (trades.length < 2) {
    return defaultResult;
  }

  // Extract close prices
  const prices = trades
    .map((t) => t.ohlc?.close ?? 0)
    .filter((p) => p > 0);

  if (prices.length < 2) {
    return defaultResult;
  }

  // Calculate returns
  const returns = calculateReturns(prices);

  if (returns.length === 0) {
    return defaultResult;
  }

  // Calculate drawdown metrics
  const drawdownMetrics = calculateDrawdown(prices);

  // Calculate volatility
  const dailyVolatility = stdDev(returns);
  const annualizedVolatility = dailyVolatility * Math.sqrt(CONFIG.TRADING_PERIODS);

  // Calculate VaR
  const var95 = calculateVaR(returns, CONFIG.VAR_CONFIDENCE_95);
  const var99 = calculateVaR(returns, CONFIG.VAR_CONFIDENCE_99);
  const cvar95 = calculateCVaR(returns, 0.95);

  // Calculate ratios
  const sharpeRatio = calculateSharpeRatio(returns);
  const sortinoRatio = calculateSortinoRatio(returns);

  // Calculate return statistics
  const totalReturn = prices.length > 1
    ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
    : 0;

  const avgReturn = mean(returns) * 100;
  const winRate = returns.length > 0
    ? (returns.filter((r) => r > 0).length / returns.length) * 100
    : 0;

  return {
    var95: var95 * 100,           // As percentage
    var99: var99 * 100,           // As percentage
    cvar95: cvar95 * 100,         // As percentage
    sharpeRatio,
    sortinoRatio: isFinite(sortinoRatio) ? sortinoRatio : 0,
    volatility: annualizedVolatility * 100,
    dailyVolatility: dailyVolatility * 100,
    maxDrawdown: drawdownMetrics.maxDrawdown * 100,
    currentDrawdown: drawdownMetrics.currentDrawdown * 100,
    drawdownDuration: drawdownMetrics.drawdownDuration,
    totalReturn,
    avgReturn,
    winRate,
  };
}

/**
 * Get drawdown series for visualization
 */
export function getDrawdownSeries(trades: TradesSummary[]): DrawdownPoint[] {
  if (trades.length < 2) return [];

  const prices = trades
    .map((t) => t.ohlc?.close ?? 0)
    .filter((p) => p > 0);

  if (prices.length < 2) return [];

  let peak = prices[0];
  const result: DrawdownPoint[] = [];

  for (let i = 0; i < Math.min(prices.length, trades.length); i++) {
    if (prices[i] > peak) {
      peak = prices[i];
    }

    const drawdown = peak > 0 ? ((peak - prices[i]) / peak) * 100 : 0;

    result.push({
      timestamp: trades[i].timestamp,
      price: prices[i],
      peak,
      drawdown,
    });
  }

  return result;
}

/**
 * Helper function to get risk level based on metrics
 */
export function getRiskLevel(metrics: RiskMetrics): {
  level: 'low' | 'medium' | 'high' | 'extreme';
  color: string;
  label: string;
} {
  const { volatility, var95, maxDrawdown } = metrics;

  // Weighted risk score
  const riskScore =
    (volatility / 50) * 0.3 +     // Normalize to ~50% annual vol
    (var95 / 5) * 0.3 +           // Normalize to ~5% daily VaR
    (maxDrawdown / 20) * 0.4;     // Normalize to ~20% drawdown

  if (riskScore < 0.5) {
    return { level: 'low', color: '#3fb950', label: 'Low Risk' };
  } else if (riskScore < 1.0) {
    return { level: 'medium', color: '#f0883e', label: 'Medium Risk' };
  } else if (riskScore < 1.5) {
    return { level: 'high', color: '#f85149', label: 'High Risk' };
  } else {
    return { level: 'extreme', color: '#da3633', label: 'Extreme Risk' };
  }
}

/**
 * Format risk metric for display
 */
export function formatRiskMetric(
  value: number,
  type: 'percentage' | 'ratio' | 'number'
): string {
  switch (type) {
    case 'percentage':
      return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    case 'ratio':
      return value.toFixed(2);
    case 'number':
      return value.toFixed(0);
    default:
      return value.toString();
  }
}
