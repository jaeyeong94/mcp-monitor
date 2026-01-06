import { TrendingUp, TrendingDown, BarChart3, DollarSign, Activity } from 'lucide-react';
import type { MultiPairPnlResponse, PairPnlSummary } from '../types/pnl';
import styles from './PairComparison.module.css';

interface PairComparisonProps {
  data: MultiPairPnlResponse;
  onSelectPair?: (exchange: string, pair: string) => void;
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  const num = value ?? 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatUSD(value: number | null | undefined): string {
  const num = value ?? 0;
  const prefix = num >= 0 ? '+$' : '-$';
  return `${prefix}${formatNumber(Math.abs(num))}`;
}

function getPnlColor(value: number): string {
  if (value > 0) return '#3fb950';
  if (value < 0) return '#f85149';
  return '#8b949e';
}

function sortPairs(pairs: PairPnlSummary[], sortBy: string): PairPnlSummary[] {
  return [...pairs].sort((a, b) => {
    switch (sortBy) {
      case 'pnl':
        return (b.total_pnl ?? 0) - (a.total_pnl ?? 0);
      case 'volume':
        return (b.total_volume ?? 0) - (a.total_volume ?? 0);
      case 'trades':
        return (b.trade_count ?? 0) - (a.trade_count ?? 0);
      default:
        return (b.total_pnl ?? 0) - (a.total_pnl ?? 0);
    }
  });
}

export function PairComparison({ data, onSelectPair }: PairComparisonProps) {
  const sortedPairs = sortPairs(data.pairs || [], 'pnl');
  const maxPnl = Math.max(1, ...(data.pairs || []).map(p => Math.abs(p.total_pnl ?? 0)));
  const aggregate = data.aggregate || { total_pnl: 0, total_trade_count: 0, total_volume: 0, total_fee: 0 };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <BarChart3 size={18} className={styles.icon} />
          <h3 className={styles.title}>Pair Comparison</h3>
          <span className={styles.count}>{data.pair_count} pairs</span>
        </div>
      </div>

      {/* Aggregate Summary */}
      <div className={styles.aggregate}>
        <div className={styles.aggCard}>
          <DollarSign size={16} className={styles.aggIcon} />
          <div className={styles.aggContent}>
            <span className={styles.aggLabel}>Total PnL</span>
            <span
              className={styles.aggValue}
              style={{ color: getPnlColor(aggregate.total_pnl) }}
            >
              {formatUSD(aggregate.total_pnl)}
            </span>
          </div>
        </div>
        <div className={styles.aggCard}>
          <Activity size={16} className={styles.aggIcon} />
          <div className={styles.aggContent}>
            <span className={styles.aggLabel}>Total Trades</span>
            <span className={styles.aggValue}>{(aggregate.total_trade_count ?? 0).toLocaleString()}</span>
          </div>
        </div>
        <div className={styles.aggCard}>
          <BarChart3 size={16} className={styles.aggIcon} />
          <div className={styles.aggContent}>
            <span className={styles.aggLabel}>Total Volume</span>
            <span className={styles.aggValue}>${formatNumber(aggregate.total_volume, 0)}</span>
          </div>
        </div>
        <div className={styles.aggCard}>
          <DollarSign size={16} className={styles.aggIcon} />
          <div className={styles.aggContent}>
            <span className={styles.aggLabel}>Total Fee</span>
            <span className={styles.aggValue} style={{ color: '#f85149' }}>
              -${formatNumber(aggregate.total_fee)}
            </span>
          </div>
        </div>
      </div>

      {/* Pair List */}
      <div className={styles.pairList}>
        {sortedPairs.map((pair, index) => {
          const pnl = pair.total_pnl ?? 0;
          const barWidth = maxPnl > 0 ? (Math.abs(pnl) / maxPnl) * 100 : 0;
          const isPositive = pnl >= 0;

          return (
            <div
              key={`${pair.exchange}:${pair.pair}`}
              className={styles.pairCard}
              onClick={() => onSelectPair?.(pair.exchange, pair.pair)}
            >
              <div className={styles.pairHeader}>
                <div className={styles.pairRank}>#{index + 1}</div>
                <div className={styles.pairInfo}>
                  <span className={styles.pairName}>{pair.pair}</span>
                  <span className={styles.pairExchange}>{pair.exchange}</span>
                </div>
                <div className={styles.pairPnl} style={{ color: getPnlColor(pnl) }}>
                  {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{formatUSD(pnl)}</span>
                </div>
              </div>

              <div className={styles.pairBar}>
                <div
                  className={`${styles.pairBarFill} ${isPositive ? styles.positive : styles.negative}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className={styles.pairMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Volume</span>
                  <span className={styles.metaValue}>${formatNumber((pair.buy_volume || 0) + (pair.sell_volume || 0), 0)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Trades</span>
                  <span className={styles.metaValue}>{(pair.trade_count ?? 0).toLocaleString()}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Fee</span>
                  <span className={styles.metaValue} style={{ color: '#f85149' }}>
                    -${formatNumber(pair.total_fee)}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>PnL/Vol</span>
                  <span
                    className={styles.metaValue}
                    style={{ color: getPnlColor(pair.pnl_per_volume || 0) }}
                  >
                    {pair.pnl_per_volume ? `${(pair.pnl_per_volume * 100).toFixed(3)}%` : '-'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
