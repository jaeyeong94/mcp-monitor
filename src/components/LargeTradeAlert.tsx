import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { TradesSummary } from '../types/market';
import { formatVolume } from '../utils/chartUtils';
import styles from './LargeTradeAlert.module.css';

interface LargeTradeAlertProps {
  data: TradesSummary[];
  threshold?: number; // multiplier for average volume
}

interface LargeTrade {
  timestamp: string;
  volume: number;
  avgVolume: number;
  ratio: number;
  isBuyDominant: boolean;
  price: number;
}

function formatTime(timestamp: string): string {
  const cleanTimestamp = timestamp.replace(/ [A-Z]{3,4}$/, '');
  const date = new Date(cleanTimestamp);
  if (isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const LargeTradeAlert = memo(function LargeTradeAlert({ data, threshold = 2.0 }: LargeTradeAlertProps) {
  // Memoize large trades calculation
  const { largeTrades, avgVolume } = useMemo(() => {
    const avg = data.reduce((sum, d) => sum + (d.volume || 0), 0) / Math.max(data.length, 1);

    const trades: LargeTrade[] = data
      .filter((d) => d.volume > avg * threshold)
      .map((d) => ({
        timestamp: d.timestamp,
        volume: d.volume,
        avgVolume: avg,
        ratio: d.volume / avg,
        isBuyDominant: d.buy_sell?.buy_ratio > 0.5,
        price: d.ohlc?.close || 0,
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10);

    return { largeTrades: trades, avgVolume: avg };
  }, [data, threshold]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Zap size={16} className={styles.icon} />
        <h3 className={styles.title}>Large Trades</h3>
        <span className={styles.badge}>{largeTrades.length}</span>
      </div>

      {largeTrades.length === 0 ? (
        <div className={styles.empty}>No large trades detected</div>
      ) : (
        <div className={styles.list}>
          {largeTrades.map((trade, i) => (
            <div
              key={i}
              className={`${styles.item} ${trade.isBuyDominant ? styles.buy : styles.sell}`}
            >
              <div className={styles.itemIcon}>
                {trade.isBuyDominant ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
              </div>
              <div className={styles.itemContent}>
                <div className={styles.itemMain}>
                  <span className={styles.volume}>{formatVolume(trade.volume)}</span>
                  <span className={styles.multiplier}>
                    {trade.ratio.toFixed(1)}x avg
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.time}>{formatTime(trade.timestamp)}</span>
                  <span className={styles.price}>
                    ${trade.price.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <span>Threshold: {threshold}x avg ({formatVolume(avgVolume * threshold)})</span>
      </div>
    </div>
  );
});
