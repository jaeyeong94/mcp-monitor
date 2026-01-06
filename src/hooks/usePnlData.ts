import { useState, useEffect, useCallback } from 'react';
import type { InventoryPnlResponse, RecentPnlResponse, MmAgentsResponse, MarkoutResponse, MultiPairPnlResponse } from '../types/pnl';

const API_BASE = 'http://localhost:3001';
const REFRESH_INTERVAL = 60000; // 1분마다 갱신

export function usePnlData(exchange: string, pair: string) {
  const [inventoryPnl, setInventoryPnl] = useState<InventoryPnlResponse | null>(null);
  const [recentPnl, setRecentPnl] = useState<RecentPnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [inventoryRes, recentRes] = await Promise.all([
        fetch(`${API_BASE}/api/pnl/inventory?exchange=${exchange}&pair=${pair}&hours=48`),
        fetch(`${API_BASE}/api/pnl/recent?exchange=${exchange}&pair=${pair}&hours=24`),
      ]);

      if (!inventoryRes.ok || !recentRes.ok) {
        throw new Error('Failed to fetch PnL data');
      }

      const [inventoryData, recentData] = await Promise.all([
        inventoryRes.json(),
        recentRes.json(),
      ]);

      setInventoryPnl(inventoryData);
      setRecentPnl(recentData);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('PnL fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch PnL data');
      setLoading(false);
    }
  }, [exchange, pair]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    inventoryPnl,
    recentPnl,
    loading,
    error,
    lastUpdate,
    refresh: fetchData,
  };
}

export function useAgents() {
  const [agents, setAgents] = useState<MmAgentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/agents?is_live=true&include_config=true`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return { agents, loading, error, refresh: fetchAgents };
}

export function useMarkoutData(exchange: string, pair: string) {
  const [markout, setMarkout] = useState<MarkoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkout = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/markout?exchange=${exchange}&pair=${pair}&hours=48`);
      if (!res.ok) throw new Error('Failed to fetch markout');
      const data = await res.json();
      setMarkout(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markout');
      setLoading(false);
    }
  }, [exchange, pair]);

  useEffect(() => {
    setLoading(true);
    fetchMarkout();
    const interval = setInterval(fetchMarkout, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMarkout]);

  return { markout, loading, error, refresh: fetchMarkout };
}

export function useMultiPairPnl(pairs: { exchange: string; pair: string }[]) {
  const [data, setData] = useState<MultiPairPnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMultiPairPnl = useCallback(async () => {
    if (pairs.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const pairsParam = pairs.map(p => `${p.exchange}:${p.pair}`).join(',');
      const res = await fetch(`${API_BASE}/api/pnl/multi-pair?pairs=${encodeURIComponent(pairsParam)}&hours=24`);
      if (!res.ok) throw new Error('Failed to fetch multi-pair PnL');
      const result = await res.json();
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch multi-pair PnL');
      setLoading(false);
    }
  }, [pairs]);

  useEffect(() => {
    setLoading(true);
    fetchMultiPairPnl();
    const interval = setInterval(fetchMultiPairPnl, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMultiPairPnl]);

  return { data, loading, error, refresh: fetchMultiPairPnl };
}
