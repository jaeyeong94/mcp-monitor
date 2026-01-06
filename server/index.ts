import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// MCP Server REST API
const MCP_API_BASE = process.env.MCP_API_BASE || 'http://3.35.221.168:8080';

// Cache for MCP data (30 second TTL for fast responses)
interface CacheEntry {
  data: unknown;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds - longer cache for faster responses

function getCacheKey(exchange: string, symbol: string, interval: string = '1m'): string {
  return `${exchange}:${symbol}:${interval}`;
}

function getFromCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Call MCP REST API
async function callMCPTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/tools/${toolName}`, MCP_API_BASE);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const payload = JSON.stringify(params);
    
    console.log(`[MCP API] POST ${url.toString()}`);
    console.log(`[MCP API] Params:`, params);

    const req = httpModule.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`[MCP API] Response success:`, response.success);
          
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || 'MCP API error'));
          }
        } catch (e) {
          console.error('[MCP API] Parse error:', e);
          reject(new Error('Failed to parse MCP response'));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[MCP API] Request error:', e);
      reject(e);
    });
    
    req.setTimeout(300000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

// Format time for MCP queries (KST)
function formatTimeKST(date: Date): string {
  // Format as "YYYY-MM-DD HH:mm" in KST
  const kstOffset = 9 * 60; // KST is UTC+9
  const kstDate = new Date(date.getTime() + kstOffset * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Fetch real data from MCP REST API
async function fetchMCPData(exchange: string, symbol: string, interval: string = '1m') {
  const now = new Date();

  // Adjust time range based on interval (60 candles per view)
  const intervalMinutes: Record<string, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
  };
  const minutes = intervalMinutes[interval] || 1;
  const lookbackMs = minutes * 180 * 60 * 1000; // 180 candles worth
  const startDate = new Date(now.getTime() - lookbackMs);

  const startTime = formatTimeKST(startDate);
  const endTime = formatTimeKST(now);

  console.log(`[MCP] Fetching ${exchange}:${symbol} interval=${interval} from ${startTime} to ${endTime} (KST)`);

  // Call both APIs in parallel
  const [orderbookResult, tradesResult] = await Promise.all([
    callMCPTool('query_s3_orderbook_summary', {
      exchange,
      symbol,
      start_time: startTime,
      end_time: endTime,
      interval,
      timezone: 'KST',
    }),
    callMCPTool('query_s3_trades_summary', {
      exchange,
      symbol,
      start_time: startTime,
      end_time: endTime,
      interval,
      timezone: 'KST',
    }),
  ]);

  interface OrderbookData {
    data?: Array<{
      timestamp: string;
      mid_price: { open: number; close: number; high: number; low: number };
      spread_bps: { mean: number; min: number; max: number };
      avg_bid_depth: number;
      avg_ask_depth: number;
      avg_imbalance: number;
    }>;
    summary?: {
      spread_bps?: { mean: number; max: number };
      imbalance?: { mean: number; buy_pressure_pct: number; sell_pressure_pct: number };
    };
    anomalies?: Array<{ timestamp: string; type: string; value: number; z_score: number }>;
  }

  interface TradesData {
    data?: Array<{
      timestamp: string;
      ohlc: { open: number; high: number; low: number; close: number };
      volume: number;
      notional: number;
      vwap: number;
      trade_count: number;
      buy_sell: { buy_volume: number; sell_volume: number; buy_ratio: number; net_volume: number };
    }>;
    summary?: {
      price?: { open: number; close: number; high: number; low: number; change: number; change_pct: number };
      volume?: { total: number; total_notional: number; buy_ratio: number };
      trades?: { total_count: number; avg_size: number };
    };
    anomalies?: Array<{ timestamp: string; type: string; value: number; z_score: number }>;
  }

  const orderbookData = orderbookResult as OrderbookData;
  const tradesData = tradesResult as TradesData;

  // Combine anomalies from both sources
  const allAnomalies = [
    ...(orderbookData.anomalies || []),
    ...(tradesData.anomalies || []),
  ];

  const tradesSummary = tradesData.summary || {};
  const orderbookSummary = orderbookData.summary || {};
  
  // Get latest price from the most recent data point
  const latestTrade = tradesData.data?.[tradesData.data.length - 1];
  const currentPrice = latestTrade?.ohlc?.close || tradesSummary.price?.close || 0;
  
  return {
    exchange,
    symbol,
    lastUpdate: now.toISOString(),
    dataSource: 'mcp',
    orderbookSummary: orderbookData.data || [],
    tradesSummary: tradesData.data || [],
    anomalies: allAnomalies,
    stats: {
      price: {
        current: currentPrice,
        change: tradesSummary.price?.change || 0,
        changePct: tradesSummary.price?.change_pct || 0,
        high: tradesSummary.price?.high || 0,
        low: tradesSummary.price?.low || 0,
      },
      volume: {
        total: tradesSummary.volume?.total || 0,
        notional: tradesSummary.volume?.total_notional || 0,
        buyRatio: tradesSummary.volume?.buy_ratio || 0.5,
      },
      spread: {
        mean: orderbookSummary.spread_bps?.mean || 0,
        max: orderbookSummary.spread_bps?.max || 0,
      },
      imbalance: {
        mean: orderbookSummary.imbalance?.mean || 0,
        buyPressure: orderbookSummary.imbalance?.buy_pressure_pct || 0,
        sellPressure: orderbookSummary.imbalance?.sell_pressure_pct || 0,
      },
      trades: {
        count: tradesSummary.trades?.total_count || 0,
        avgSize: tradesSummary.trades?.avg_size || 0,
      },
    },
  };
}

// Generate fallback data when MCP is unavailable
function generateFallbackData(exchange: string, symbol: string) {
  const now = new Date();
  const basePrice = symbol === 'BTCUSDT' ? 93000 : 
                   symbol === 'ETHUSDT' ? 3450 :
                   symbol === 'SOLUSDT' ? 190 : 
                   symbol === 'BNBUSDT' ? 710 : 100;
  
  const noise = Math.sin(now.getTime() / 10000) * (basePrice * 0.001);
  const currentPrice = basePrice + noise;
  const priceChange = (Math.random() - 0.5) * (basePrice * 0.01);
  const changePct = (priceChange / basePrice) * 100;
  
  const orderbookSummary = [];
  const tradesSummary = [];
  
  for (let i = 59; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000);
    const timeStr = timestamp.toISOString();
    
    const minutePrice = basePrice + Math.sin((59 - i) / 10) * (basePrice * 0.005);
    const priceVariation = (Math.random() - 0.5) * (basePrice * 0.003);
    
    orderbookSummary.push({
      timestamp: timeStr,
      mid_price: {
        open: minutePrice,
        close: minutePrice + priceVariation,
        high: minutePrice + Math.abs(priceVariation) + Math.random() * (basePrice * 0.001),
        low: minutePrice - Math.abs(priceVariation) - Math.random() * (basePrice * 0.001),
      },
      spread_bps: { mean: Math.random() * 0.02, min: 0, max: Math.random() * 0.5 },
      avg_bid_depth: 2 + Math.random() * 4,
      avg_ask_depth: 2 + Math.random() * 4,
      avg_imbalance: (Math.random() - 0.5) * 0.8,
      snapshot_count: 600,
    });

    const volume = (5 + Math.random() * 50) * (symbol === 'BTCUSDT' ? 1 : symbol === 'ETHUSDT' ? 10 : 100);
    const buyRatio = 0.3 + Math.random() * 0.4;
    
    tradesSummary.push({
      timestamp: timeStr,
      ohlc: {
        open: minutePrice,
        high: minutePrice + Math.abs(priceVariation) + Math.random() * (basePrice * 0.001),
        low: minutePrice - Math.abs(priceVariation) - Math.random() * (basePrice * 0.001),
        close: minutePrice + priceVariation,
      },
      volume,
      notional: volume * minutePrice,
      vwap: minutePrice,
      trade_count: Math.floor(1000 + Math.random() * 5000),
      buy_sell: {
        buy_volume: volume * buyRatio,
        sell_volume: volume * (1 - buyRatio),
        buy_ratio: buyRatio,
        net_volume: volume * (buyRatio - 0.5) * 2,
      },
    });
  }

  const totalVolume = tradesSummary.reduce((sum, t) => sum + t.volume, 0);
  const buyVolume = tradesSummary.reduce((sum, t) => sum + t.buy_sell.buy_volume, 0);
  
  return {
    exchange,
    symbol,
    lastUpdate: now.toISOString(),
    dataSource: 'fallback',
    orderbookSummary,
    tradesSummary,
    anomalies: [],
    stats: {
      price: { current: currentPrice, change: priceChange, changePct, high: currentPrice * 1.02, low: currentPrice * 0.98 },
      volume: { total: totalVolume, notional: totalVolume * currentPrice, buyRatio: buyVolume / totalVolume },
      spread: { mean: 0.01, max: 1.5 },
      imbalance: { mean: 0, buyPressure: 40, sellPressure: 45 },
      trades: { count: 100000, avgSize: 0.005 },
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

  try {
    if (path === '/health') {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mcpServer: MCP_API_BASE,
      }));
      return;
    }

    if (path === '/api/market-data') {
      const exchange = url.searchParams.get('exchange') || 'binance';
      const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
      const interval = url.searchParams.get('interval') || '1m';
      const cacheKey = getCacheKey(exchange, symbol, interval);

      // Check cache first
      const cached = getFromCache(cacheKey);
      if (cached) {
        console.log(`[Cache] Hit for ${cacheKey}`);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      try {
        // Try MCP REST API
        const data = await fetchMCPData(exchange, symbol, interval);
        setCache(cacheKey, data);
        console.log(`[MCP] Success for ${cacheKey}, dataSource: ${data.dataSource}`);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(data));
      } catch (err) {
        // Fallback to generated data
        console.error(`[MCP] Error for ${cacheKey}:`, err);
        console.log(`[Fallback] Using generated data for ${cacheKey}`);
        const fallbackData = generateFallbackData(exchange, symbol);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(fallbackData));
      }
      return;
    }

    if (path === '/api/available') {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        exchanges: ['binance', 'gateio', 'htx', 'kucoin', 'okx'],
        symbols: {
          binance: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
          gateio: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
          htx: ['BTCUSDT', 'ETHUSDT'],
          kucoin: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
          okx: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
        },
      }));
      return;
    }

    // PnL API - Recent PnL
    if (path === '/api/pnl/recent') {
      const pair = url.searchParams.get('pair') || 'KYO-USDT-SPOT';
      const exchange = url.searchParams.get('exchange') || 'gate.io';
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const cacheKey = `pnl:recent:${exchange}:${pair}:${hours}`;

      const cached = getFromCache(cacheKey);
      if (cached) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      try {
        const result = await callMCPTool('query_recent_pnl', { pair, exchange, hours });
        setCache(cacheKey, result);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[PnL Recent] Error:', err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch recent PnL' }));
      }
      return;
    }

    // PnL API - Inventory PnL (Mark-to-Market)
    if (path === '/api/pnl/inventory') {
      const pair = url.searchParams.get('pair') || 'KYO-USDT-SPOT';
      const exchange = url.searchParams.get('exchange') || 'gate.io';
      const interval = url.searchParams.get('interval') || '1h';
      const hours = parseInt(url.searchParams.get('hours') || '48');

      const now = new Date();
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const cacheKey = `pnl:inventory:${exchange}:${pair}:${hours}`;

      const cached = getFromCache(cacheKey);
      if (cached) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      try {
        const result = await callMCPTool('query_inventory_pnl', {
          pair,
          exchange,
          start_time: startTime.toISOString(),
          end_time: now.toISOString(),
          interval,
        });
        setCache(cacheKey, result);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[PnL Inventory] Error:', err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch inventory PnL' }));
      }
      return;
    }

    // Markout Analysis API
    if (path === '/api/markout') {
      const pair = url.searchParams.get('pair') || 'KYO-USDT-SPOT';
      const exchange = url.searchParams.get('exchange') || 'gate.io';
      const hours = parseInt(url.searchParams.get('hours') || '48');
      const cacheKey = `markout:${exchange}:${pair}:${hours}`;

      const cached = getFromCache(cacheKey);
      if (cached) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      const now = new Date();
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

      try {
        const result = await callMCPTool('query_markout_analysis', {
          pair,
          exchange,
          start_time: startTime.toISOString(),
          end_time: now.toISOString(),
          intervals: [1, 5, 30, 60],
        });
        setCache(cacheKey, result);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Markout] Error:', err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch markout analysis' }));
      }
      return;
    }

    // MM Agents API
    if (path === '/api/agents') {
      const isLive = url.searchParams.get('is_live') !== 'false';
      const includeConfig = url.searchParams.get('include_config') === 'true';
      const cacheKey = `agents:${isLive}:${includeConfig}`;

      const cached = getFromCache(cacheKey);
      if (cached) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      try {
        const result = await callMCPTool('query_mm_agents', { is_live: isLive }) as {
          summary: { total_agents: number; live_agents: number; inactive_agents: number };
          agents: Array<{
            agent_id: string;
            strategy_name: string;
            host: string;
            is_live: boolean;
            exchanges: string;
            config: {
              instructs: Array<{
                pairKey?: string;
                exchange?: string;
                exchangeWithPairKeys?: Array<{ exchange: string; pairKey: string }>;
                parameters?: Array<{
                  spreadModelParameter?: {
                    askTOB?: number;
                    askFOB?: number;
                    bidTOB?: number;
                    bidFOB?: number;
                    spreadMultiplier?: number;
                    skewMultiplier?: number;
                  };
                  depthModelParameter?: {
                    askMinQuotingValue?: number;
                    askMaxQuotingValue?: number;
                    bidMinQuotingValue?: number;
                    bidMaxQuotingValue?: number;
                    minSpreadFromMid?: number;
                    maxSpreadFromMid?: number;
                  };
                  volatilityModelParameter?: {
                    levels?: Array<{
                      spreadBpsLowerBound?: number;
                      spreadBpsUpperBound?: number;
                      quotingValueMultiplier?: number;
                    }>;
                  };
                  midPriceModelParameter?: Record<string, unknown>;
                  vwapLimitModelParameter?: Record<string, unknown>;
                }>;
              }>;
            };
            updated_at: string;
          }>;
        };

        // Extract pairs and config from instructs
        const agents = result.agents.map(agent => {
          const pairs: string[] = [];
          const pairConfigs: Array<{
            pairKey: string;
            exchange: string;
            spreadModelParameter?: Record<string, unknown>;
            depthModelParameter?: Record<string, unknown>;
            volatilityModelParameter?: Record<string, unknown>;
            multiplierParameter?: Record<string, unknown>;
          }> = [];

          for (const instruct of (agent.config as any)?.instructs || []) {
            // Case 1: Direct pairKey and exchange (MM agents)
            if (instruct.pairKey && instruct.exchange) {
              pairs.push(`${instruct.exchange}:${instruct.pairKey}`);
              if (includeConfig && instruct.parameters?.[0]) {
                const params = instruct.parameters[0];
                pairConfigs.push({
                  pairKey: instruct.pairKey,
                  exchange: instruct.exchange,
                  spreadModelParameter: params.spreadModelParameter,
                  depthModelParameter: params.depthModelParameter,
                  volatilityModelParameter: params.volatilityModelParameter,
                  multiplierParameter: params.multiplierParameter,
                });
              }
            }
            // Case 2: exchangeWithPairKeys array (AB agents)
            if (instruct.exchangeWithPairKeys) {
              for (const ep of instruct.exchangeWithPairKeys) {
                pairs.push(`${ep.exchange}:${ep.pairKey}`);
              }
            }
          }

          const agentData: Record<string, unknown> = {
            agent_id: agent.agent_id,
            strategy_name: agent.strategy_name,
            host: agent.host,
            is_live: agent.is_live,
            exchanges: agent.exchanges,
            pairs: [...new Set(pairs)],
            updated_at: agent.updated_at,
          };

          if (includeConfig) {
            agentData.pair_configs = pairConfigs;
          }

          return agentData;
        });

        const response = { summary: result.summary, agents };
        setCache(cacheKey, response);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(response));
      } catch (err) {
        console.error('[Agents] Error:', err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch agents' }));
      }
      return;
    }

    // Multi-Pair PnL Comparison API
    if (path === '/api/pnl/multi-pair') {
      const pairsParam = url.searchParams.get('pairs');
      const hours = parseInt(url.searchParams.get('hours') || '24');

      if (!pairsParam) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'pairs parameter is required (format: exchange:pair,exchange:pair)' }));
        return;
      }

      const pairs = pairsParam.split(',').map(p => {
        const [exchange, pair] = p.split(':');
        return { exchange, pair };
      });

      const cacheKey = `pnl:multi:${pairsParam}:${hours}`;
      const cached = getFromCache(cacheKey);
      if (cached) {
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(cached));
        return;
      }

      const now = new Date();
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

      try {
        // Group pairs by exchange for MCP API (expects exchange + pairs array)
        const pairsByExchange = new Map<string, string[]>();
        for (const p of pairs) {
          const existing = pairsByExchange.get(p.exchange) || [];
          existing.push(p.pair);
          pairsByExchange.set(p.exchange, existing);
        }

        // Call MCP API for each exchange and aggregate results
        const allResults: Array<{ pair: string; exchange: string; total_pnl: number; realized_pnl: number; unrealized_pnl: number; total_fee: number; total_volume: number; trade_count: number }> = [];

        for (const [exchange, exchangePairs] of pairsByExchange) {
          const result = await callMCPTool('query_multi_pair_pnl', {
            exchange,
            pairs: exchangePairs,
            start_time: startTime.toISOString(),
            end_time: now.toISOString(),
          }) as {
            pair_comparison?: Array<{ pair: string; total_pnl: number; realized_pnl: number; unrealized_pnl: number; total_fee: number; total_volume: number; trade_count: number }>;
            summary?: { total_pnl: number; realized_pnl: number; unrealized_pnl: number; total_fee: number; total_volume: number; total_trade_count: number };
          };

          console.log(`[Multi-Pair PnL] Response for ${exchange}:`, JSON.stringify(result).slice(0, 500));

          if (result.pair_comparison) {
            for (const p of result.pair_comparison) {
              allResults.push({ ...p, exchange });
            }
          }
        }

        // Aggregate response
        const aggregate = {
          total_pnl: allResults.reduce((sum, p) => sum + (p.total_pnl || 0), 0),
          realized_pnl: allResults.reduce((sum, p) => sum + (p.realized_pnl || 0), 0),
          unrealized_pnl: allResults.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0),
          total_fee: allResults.reduce((sum, p) => sum + (p.total_fee || 0), 0),
          total_volume: allResults.reduce((sum, p) => sum + ((p as any).buy_volume || 0) + ((p as any).sell_volume || 0), 0),
          total_trade_count: allResults.reduce((sum, p) => sum + (p.trade_count || 0), 0),
        };

        const response = {
          period: { start: startTime.toISOString(), end: now.toISOString() },
          pair_count: allResults.length,
          pairs: allResults,
          aggregate,
        };

        setCache(cacheKey, response);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(response));
      } catch (err) {
        console.error('[Multi-Pair PnL] Error:', err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch multi-pair PnL' }));
      }
      return;
    }

    // Proxy to MCP tools API
    if (path === '/api/mcp-tools') {
      try {
        const tools = await new Promise((resolve, reject) => {
          http.get(`${MCP_API_BASE}/api/tools`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(data);
              }
            });
          }).on('error', reject);
        });
        
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(tools));
      } catch (err) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Failed to fetch MCP tools' }));
      }
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, corsHeaders);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 MCP Monitor Backend running at http://localhost:${PORT}`);
  console.log(`   - MCP API: ${MCP_API_BASE}`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - Market Data: http://localhost:${PORT}/api/market-data?exchange=binance&symbol=BTCUSDT`);
  console.log(`   - MCP Tools: http://localhost:${PORT}/api/mcp-tools`);
});
