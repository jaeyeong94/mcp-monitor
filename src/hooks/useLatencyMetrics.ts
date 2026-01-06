import { useState, useCallback, useRef } from 'react';

/**
 * Latency metrics tracking hook
 * Tracks fetch request timing and calculates statistics
 */

export interface LatencyMeasurement {
  timestamp: number;
  duration: number;    // Total request duration (ms)
  serverTime?: number; // Server processing time if available (ms)
  status: 'success' | 'error' | 'timeout';
}

export interface LatencyStats {
  current: number;
  min: number;
  max: number;
  mean: number;
  p95: number;
  p99: number;
  count: number;
  errorRate: number;
  lastUpdate: Date;
}

interface UseLatencyMetricsOptions {
  maxSamples?: number;     // Maximum measurements to keep
  windowMs?: number;       // Time window for stats (ms)
}

const DEFAULT_OPTIONS: UseLatencyMetricsOptions = {
  maxSamples: 100,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

export function useLatencyMetrics(options: UseLatencyMetricsOptions = {}) {
  const { maxSamples, windowMs } = { ...DEFAULT_OPTIONS, ...options };

  const [stats, setStats] = useState<LatencyStats>({
    current: 0,
    min: 0,
    max: 0,
    mean: 0,
    p95: 0,
    p99: 0,
    count: 0,
    errorRate: 0,
    lastUpdate: new Date(),
  });

  const measurementsRef = useRef<LatencyMeasurement[]>([]);

  // Calculate percentile from sorted array
  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  // Update stats from measurements
  const updateStats = useCallback(() => {
    const now = Date.now();
    const cutoff = now - (windowMs ?? DEFAULT_OPTIONS.windowMs!);

    // Filter to window
    const recent = measurementsRef.current.filter((m) => m.timestamp > cutoff);
    measurementsRef.current = recent.slice(-(maxSamples ?? DEFAULT_OPTIONS.maxSamples!));

    if (recent.length === 0) {
      setStats((prev) => ({
        ...prev,
        count: 0,
        lastUpdate: new Date(),
      }));
      return;
    }

    const durations = recent.map((m) => m.duration).sort((a, b) => a - b);
    const errors = recent.filter((m) => m.status !== 'success').length;

    setStats({
      current: recent[recent.length - 1].duration,
      min: durations[0],
      max: durations[durations.length - 1],
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      count: recent.length,
      errorRate: (errors / recent.length) * 100,
      lastUpdate: new Date(),
    });
  }, [maxSamples, windowMs]);

  // Record a new measurement
  const recordMeasurement = useCallback(
    (measurement: Omit<LatencyMeasurement, 'timestamp'>) => {
      measurementsRef.current.push({
        ...measurement,
        timestamp: Date.now(),
      });
      updateStats();
    },
    [updateStats]
  );

  // Wrapper for fetch that measures latency
  const measureFetch = useCallback(
    async <T>(
      url: string,
      options?: RequestInit,
      timeout: number = 60000
    ): Promise<{ data: T; latency: number }> => {
      const start = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = performance.now() - start;

        // Try to get server timing from headers
        let serverTime: number | undefined;
        const serverTiming = response.headers.get('Server-Timing');
        if (serverTiming) {
          const match = serverTiming.match(/dur=(\d+\.?\d*)/);
          if (match) {
            serverTime = parseFloat(match[1]);
          }
        }

        if (!response.ok) {
          recordMeasurement({
            duration,
            serverTime,
            status: 'error',
          });
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        recordMeasurement({
          duration,
          serverTime,
          status: 'success',
        });

        const data = await response.json();
        return { data, latency: duration };
      } catch (err) {
        clearTimeout(timeoutId);
        const duration = performance.now() - start;

        if (err instanceof Error && err.name === 'AbortError') {
          recordMeasurement({
            duration,
            status: 'timeout',
          });
          throw new Error('Request timeout');
        }

        recordMeasurement({
          duration,
          status: 'error',
        });
        throw err;
      }
    },
    [recordMeasurement]
  );

  // Get raw measurements for charting
  const getMeasurements = useCallback(() => {
    return [...measurementsRef.current];
  }, []);

  // Clear all measurements
  const clearMeasurements = useCallback(() => {
    measurementsRef.current = [];
    updateStats();
  }, [updateStats]);

  return {
    stats,
    measureFetch,
    recordMeasurement,
    getMeasurements,
    clearMeasurements,
  };
}

// Singleton for global latency tracking
let globalLatencyInstance: ReturnType<typeof useLatencyMetrics> | null = null;

export function getGlobalLatencyTracker() {
  return globalLatencyInstance;
}

export function setGlobalLatencyTracker(instance: ReturnType<typeof useLatencyMetrics>) {
  globalLatencyInstance = instance;
}
