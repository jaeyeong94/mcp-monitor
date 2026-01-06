import type { OrderbookSummary, TradesSummary, Anomaly, MarketStats } from '../types/market';

interface ExportData {
  orderbookSummary: OrderbookSummary[];
  tradesSummary: TradesSummary[];
  anomalies: Anomaly[];
  stats: MarketStats | null;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTradesToCSV(data: TradesSummary[], filename: string): void {
  const headers = [
    'Timestamp',
    'Open',
    'High',
    'Low',
    'Close',
    'Volume',
    'Notional',
    'VWAP',
    'Trade Count',
    'Buy Volume',
    'Sell Volume',
    'Buy Ratio',
    'Net Volume',
  ];

  const rows = data.map((d) => [
    escapeCSV(d.timestamp),
    escapeCSV(d.ohlc.open),
    escapeCSV(d.ohlc.high),
    escapeCSV(d.ohlc.low),
    escapeCSV(d.ohlc.close),
    escapeCSV(d.volume),
    escapeCSV(d.notional),
    escapeCSV(d.vwap),
    escapeCSV(d.trade_count),
    escapeCSV(d.buy_sell?.buy_volume ?? 0),
    escapeCSV(d.buy_sell?.sell_volume ?? 0),
    escapeCSV(d.buy_sell?.buy_ratio ?? 0),
    escapeCSV(d.buy_sell?.net_volume ?? 0),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadCSV(csv, filename);
}

export function exportOrderbookToCSV(data: OrderbookSummary[], filename: string): void {
  const headers = [
    'Timestamp',
    'Mid Price Open',
    'Mid Price Close',
    'Mid Price High',
    'Mid Price Low',
    'Spread Mean (bps)',
    'Spread Min (bps)',
    'Spread Max (bps)',
    'Avg Bid Depth',
    'Avg Ask Depth',
    'Avg Imbalance',
  ];

  const rows = data.map((d) => [
    escapeCSV(d.timestamp),
    escapeCSV(d.mid_price?.open ?? 0),
    escapeCSV(d.mid_price?.close ?? 0),
    escapeCSV(d.mid_price?.high ?? 0),
    escapeCSV(d.mid_price?.low ?? 0),
    escapeCSV(d.spread_bps?.mean ?? 0),
    escapeCSV(d.spread_bps?.min ?? 0),
    escapeCSV(d.spread_bps?.max ?? 0),
    escapeCSV(d.avg_bid_depth ?? 0),
    escapeCSV(d.avg_ask_depth ?? 0),
    escapeCSV(d.avg_imbalance ?? 0),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadCSV(csv, filename);
}

export function exportAnomaliesToCSV(data: Anomaly[], filename: string): void {
  const headers = ['Timestamp', 'Type', 'Value', 'Z-Score'];

  const rows = data.map((d) => [
    escapeCSV(d.timestamp),
    escapeCSV(d.type),
    escapeCSV(d.value),
    escapeCSV(d.z_score),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadCSV(csv, filename);
}

export function exportAllToCSV(
  data: ExportData,
  exchange: string,
  symbol: string
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = `${exchange}_${symbol}_${timestamp}`;

  // Export trades
  if (data.tradesSummary.length > 0) {
    exportTradesToCSV(data.tradesSummary, `${prefix}_trades.csv`);
  }

  // Export orderbook
  if (data.orderbookSummary.length > 0) {
    exportOrderbookToCSV(data.orderbookSummary, `${prefix}_orderbook.csv`);
  }

  // Export anomalies
  if (data.anomalies.length > 0) {
    exportAnomaliesToCSV(data.anomalies, `${prefix}_anomalies.csv`);
  }
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
