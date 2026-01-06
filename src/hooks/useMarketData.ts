import { useState, useEffect, useCallback, useRef } from 'react';
import type { OrderbookSummary, TradesSummary, Anomaly, MarketStats } from '../types/market';
import { useLatencyMetrics, type LatencyStats } from './useLatencyMetrics';
import { API_BASE } from '../config';
const REFRESH_INTERVAL = 30000; // 30초마다 갱신 (서버 캐시와 동일)
const LOCAL_STORAGE_KEY = 'mcp-market-data-cache';

interface MarketDataResponse {
  exchange: string;
  symbol: string;
  lastUpdate: string;
  dataSource: string;
  orderbookSummary: OrderbookSummary[];
  tradesSummary: TradesSummary[];
  anomalies: Anomaly[];
  stats: MarketStats;
}

interface CachedData {
  [key: string]: MarketDataResponse;
}

// Local storage cache helpers
function getLocalCache(): CachedData {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setLocalCache(exchange: string, symbol: string, interval: string, data: MarketDataResponse) {
  try {
    const cache = getLocalCache();
    cache[`${exchange}:${symbol}:${interval}`] = data;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

function getFromLocalCache(exchange: string, symbol: string, interval: string): MarketDataResponse | null {
  const cache = getLocalCache();
  return cache[`${exchange}:${symbol}:${interval}`] || null;
}

export function useMarketData(exchange: string, symbol: string, interval: string = '1m') {
  const [orderbookSummary, setOrderbookSummary] = useState<OrderbookSummary[]>([]);
  const [tradesSummary, setTradesSummary] = useState<TradesSummary[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dataSource, setDataSource] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Latency tracking
  const { stats: latencyStats, measureFetch } = useLatencyMetrics();

  // Refs to avoid dependency issues
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false); // Track if we have data (avoid stats dependency)

  // Load from local cache on mount/change
  useEffect(() => {
    const cached = getFromLocalCache(exchange, symbol, interval);
    if (cached) {
      console.log('[useMarketData] Loading from local cache');
      setOrderbookSummary(cached.orderbookSummary);
      setTradesSummary(cached.tradesSummary);
      setAnomalies(cached.anomalies);
      setStats(cached.stats);
      setLastUpdate(new Date(cached.lastUpdate));
      setDataSource(cached.dataSource + ' (cached)');
      setLoading(false);
      hasDataRef.current = true;
    }
  }, [exchange, symbol, interval]);

  // Main fetch function - stable reference
  const fetchData = useCallback(async (force = false) => {
    // Skip if already fetching (unless forced)
    if (isFetchingRef.current && !force) {
      console.log('[useMarketData] Skipping fetch - request in progress');
      return;
    }

    // Cancel previous request if forcing new one
    if (force && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;

    // Show refreshing indicator (not full loading if we have data)
    if (hasDataRef.current) {
      setIsRefreshing(true);
    }

    console.log(`[useMarketData] Fetching ${exchange}:${symbol}`);

    try {
      setError(null);

      // Use measureFetch for latency tracking
      const { data, latency } = await measureFetch<MarketDataResponse>(
        `${API_BASE}/api/market-data?exchange=${exchange}&symbol=${symbol}&interval=${interval}`,
        { signal: abortControllerRef.current.signal },
        60000 // 60 second timeout
      );

      console.log(`[useMarketData] Fetch complete for ${exchange}:${symbol} (${latency.toFixed(0)}ms)`);

      // Save to local cache for instant loading next time
      setLocalCache(exchange, symbol, interval, data);

      // Apply data
      setOrderbookSummary(data.orderbookSummary);
      setTradesSummary(data.tradesSummary);
      setAnomalies(data.anomalies);
      setStats(data.stats);
      setLastUpdate(new Date(data.lastUpdate));
      setDataSource(data.dataSource);
      setLoading(false);
      setIsRefreshing(false);
      hasDataRef.current = true;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[useMarketData] Request aborted');
        return;
      }

      console.error('Failed to fetch market data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
      setIsRefreshing(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [exchange, symbol, interval, measureFetch]); // Only exchange, symbol, interval, measureFetch

  // Initial fetch and interval - runs once per exchange/symbol/interval change
  useEffect(() => {
    console.log(`[useMarketData] Setting up for ${exchange}:${symbol}:${interval}`);

    // Reset state for new exchange/symbol/interval
    hasDataRef.current = false;
    const cached = getFromLocalCache(exchange, symbol, interval);
    if (!cached) {
      setLoading(true);
    }
    
    // Initial fetch
    fetchData(true);
    
    // Set up refresh timer
    const refreshTimer = setInterval(() => {
      fetchData(false);
    }, REFRESH_INTERVAL);

    return () => {
      console.log(`[useMarketData] Cleanup for ${exchange}:${symbol}:${interval}`);
      clearInterval(refreshTimer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [exchange, symbol, interval, fetchData]);

  // Manual refresh (force)
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    orderbookSummary,
    tradesSummary,
    anomalies,
    stats,
    loading,
    error,
    lastUpdate,
    dataSource,
    isRefreshing,
    latencyStats,
    refresh,
  };
}

// Re-export type for convenience
export type { LatencyStats };
