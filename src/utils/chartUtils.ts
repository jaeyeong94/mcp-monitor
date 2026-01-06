import { ColorType, DeepPartial, ChartOptions } from 'lightweight-charts';

/**
 * Shared chart utilities for performance optimization
 * - Consolidated parsing functions to avoid duplication
 * - Memoizable chart options factory
 * - Reusable formatting utilities
 */

// ============ Timestamp Parsing ============

/**
 * Parse timestamp that may include timezone suffix like "KST"
 * Returns Unix timestamp in seconds (for lightweight-charts)
 */
export function parseTimestamp(timestamp: string): number {
  // Remove timezone suffix like " KST"
  const cleanTimestamp = timestamp.replace(/ [A-Z]{3,4}$/, '');
  const date = new Date(cleanTimestamp);

  if (isNaN(date.getTime())) {
    // Try parsing "YYYY-MM-DD HH:mm:ss" format
    const match = cleanTimestamp.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(+year, +month - 1, +day, +hour, +minute).getTime() / 1000;
    }
    return Date.now() / 1000;
  }

  return date.getTime() / 1000;
}

// ============ Chart Options Factory ============

export interface ChartDimensions {
  width: number;
  height: number;
}

/**
 * Create default chart options with consistent styling
 * Factory pattern allows memoization of options
 */
export function createDefaultChartOptions(
  dimensions: ChartDimensions,
  includeCrosshair: boolean = true
): DeepPartial<ChartOptions> {
  const baseOptions: DeepPartial<ChartOptions> = {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#8b949e',
      fontFamily: "'JetBrains Mono', monospace",
    },
    grid: {
      vertLines: { color: 'rgba(48, 54, 61, 0.5)' },
      horzLines: { color: 'rgba(48, 54, 61, 0.5)' },
    },
    width: dimensions.width,
    height: dimensions.height,
    timeScale: {
      borderColor: '#30363d',
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: '#30363d',
    },
  };

  if (includeCrosshair) {
    baseOptions.crosshair = {
      vertLine: {
        color: 'rgba(0, 217, 255, 0.3)',
        labelBackgroundColor: '#00d9ff',
      },
      horzLine: {
        color: 'rgba(0, 217, 255, 0.3)',
        labelBackgroundColor: '#00d9ff',
      },
    };
  }

  return baseOptions;
}

// ============ Formatting Utilities ============

/**
 * Format volume with K/M/B suffixes
 */
export function formatVolume(volume: number): string {
  const abs = Math.abs(volume);
  if (abs >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (abs >= 1000) return `${(volume / 1000).toFixed(2)}K`;
  if (abs >= 1) return volume.toFixed(2);
  return volume.toFixed(4);
}

/**
 * Format number with compact notation
 */
export function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(decimals) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

/**
 * Format price as currency
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// ============ Color Constants ============

export const CHART_COLORS = {
  // Primary colors
  accent: '#00d9ff',
  success: '#39d353',
  successAlt: '#3fb950',
  danger: '#f85149',
  dangerAlt: '#da3633',
  warning: '#f0883e',

  // Background/fill colors
  successFill: 'rgba(63, 185, 80, 0.4)',
  successFillLight: 'rgba(63, 185, 80, 0.05)',
  dangerFill: 'rgba(248, 81, 73, 0.4)',
  dangerFillLight: 'rgba(248, 81, 73, 0.05)',
  accentFill: 'rgba(0, 217, 255, 0.4)',
  accentFillLight: 'rgba(0, 217, 255, 0.02)',

  // Neutral colors
  border: '#30363d',
  text: '#8b949e',
  gridLine: 'rgba(48, 54, 61, 0.5)',
} as const;

// ============ Series Presets ============

export const CANDLESTICK_PRESET = {
  upColor: CHART_COLORS.success,
  downColor: CHART_COLORS.danger,
  borderUpColor: CHART_COLORS.success,
  borderDownColor: CHART_COLORS.danger,
  wickUpColor: CHART_COLORS.success,
  wickDownColor: CHART_COLORS.danger,
} as const;

export const VOLUME_COLORS = {
  buy: 'rgba(57, 211, 83, 0.6)',
  sell: 'rgba(248, 81, 73, 0.6)',
} as const;

// ============ Data Comparison ============

/**
 * Shallow compare arrays for memoization
 * Returns true if arrays have same length and last item timestamp matches
 */
export function hasDataChanged<T extends { timestamp: string }>(
  prev: T[],
  next: T[]
): boolean {
  if (prev.length !== next.length) return true;
  if (prev.length === 0 && next.length === 0) return false;

  // Compare last timestamp (most common change)
  const prevLast = prev[prev.length - 1];
  const nextLast = next[next.length - 1];

  return prevLast?.timestamp !== nextLast?.timestamp;
}

// ============ Performance Utilities ============

/**
 * Create a throttled function for resize handlers
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: unknown[]) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}
