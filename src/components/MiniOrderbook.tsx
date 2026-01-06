import { memo, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import type { OrderbookSummary } from '../types/market';
import { CHART_COLORS } from '../utils/chartUtils';
import styles from './MiniOrderbook.module.css';

interface MiniOrderbookProps {
  data: OrderbookSummary[];
  midPrice: number;
}

interface OrderbookLevel {
  price: number;
  size: number;
  total: number;
  percentage: number;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatSize(size: number): string {
  if (size >= 1000) return `${(size / 1000).toFixed(2)}K`;
  if (size >= 1) return size.toFixed(3);
  return size.toFixed(5);
}

export const MiniOrderbook = memo(function MiniOrderbook({ data, midPrice }: MiniOrderbookProps) {
  // Generate synthetic orderbook levels based on depth data
  const { bids, asks, spread, spreadPct } = useMemo(() => {
    if (data.length === 0 || midPrice === 0) {
      return { bids: [], asks: [], spread: 0, spreadPct: 0 };
    }

    const latest = data[data.length - 1];
    const avgBidDepth = latest?.avg_bid_depth ?? 0;
    const avgAskDepth = latest?.avg_ask_depth ?? 0;
    const spreadBps = latest?.spread_bps?.mean ?? 0;

    // Calculate spread
    const spreadValue = midPrice * (spreadBps / 10000);
    const bestBid = midPrice - spreadValue / 2;
    const bestAsk = midPrice + spreadValue / 2;

    // Generate 5 levels for each side
    const levels = 5;
    const priceStep = midPrice * 0.0005; // 0.05% steps

    const bidLevels: OrderbookLevel[] = [];
    const askLevels: OrderbookLevel[] = [];

    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < levels; i++) {
      // Bids (decreasing price)
      const bidPrice = bestBid - i * priceStep;
      const bidSize = avgBidDepth * (1 - i * 0.15) * (0.8 + Math.random() * 0.4);
      bidTotal += bidSize;
      bidLevels.push({
        price: bidPrice,
        size: bidSize,
        total: bidTotal,
        percentage: 0,
      });

      // Asks (increasing price)
      const askPrice = bestAsk + i * priceStep;
      const askSize = avgAskDepth * (1 - i * 0.15) * (0.8 + Math.random() * 0.4);
      askTotal += askSize;
      askLevels.push({
        price: askPrice,
        size: askSize,
        total: askTotal,
        percentage: 0,
      });
    }

    // Calculate percentages
    const maxTotal = Math.max(bidTotal, askTotal);
    bidLevels.forEach((level) => {
      level.percentage = (level.total / maxTotal) * 100;
    });
    askLevels.forEach((level) => {
      level.percentage = (level.total / maxTotal) * 100;
    });

    return {
      bids: bidLevels,
      asks: askLevels.reverse(), // Reverse so highest ask is at bottom
      spread: spreadValue,
      spreadPct: spreadBps / 100,
    };
  }, [data, midPrice]);

  const imbalance = useMemo(() => {
    if (data.length === 0) return 0;
    const latest = data[data.length - 1];
    return latest?.avg_imbalance ?? 0;
  }, [data]);

  const imbalanceLabel = imbalance > 0.1 ? 'Buy Heavy' : imbalance < -0.1 ? 'Sell Heavy' : 'Balanced';
  const imbalanceColor = imbalance > 0.1 ? CHART_COLORS.successAlt : imbalance < -0.1 ? CHART_COLORS.danger : CHART_COLORS.text;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <BookOpen size={16} className={styles.icon} />
        <h3 className={styles.title}>Order Book</h3>
        <span className={styles.imbalance} style={{ color: imbalanceColor }}>
          {imbalanceLabel}
        </span>
      </div>

      {/* Column Headers */}
      <div className={styles.columnHeaders}>
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      {/* Asks (sells) - shown in reverse order */}
      <div className={styles.asks}>
        {asks.map((level, idx) => (
          <div key={`ask-${idx}`} className={styles.row}>
            <div
              className={styles.depthBar}
              style={{
                width: `${level.percentage}%`,
                background: 'rgba(248, 81, 73, 0.15)',
              }}
            />
            <span className={styles.priceAsk}>{formatPrice(level.price)}</span>
            <span className={styles.size}>{formatSize(level.size)}</span>
            <span className={styles.total}>{formatSize(level.total)}</span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className={styles.spreadRow}>
        <span className={styles.spreadLabel}>Spread</span>
        <span className={styles.spreadValue}>
          ${spread.toFixed(2)} ({spreadPct.toFixed(3)}%)
        </span>
      </div>

      {/* Bids (buys) */}
      <div className={styles.bids}>
        {bids.map((level, idx) => (
          <div key={`bid-${idx}`} className={styles.row}>
            <div
              className={styles.depthBar}
              style={{
                width: `${level.percentage}%`,
                background: 'rgba(63, 185, 80, 0.15)',
              }}
            />
            <span className={styles.priceBid}>{formatPrice(level.price)}</span>
            <span className={styles.size}>{formatSize(level.size)}</span>
            <span className={styles.total}>{formatSize(level.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
