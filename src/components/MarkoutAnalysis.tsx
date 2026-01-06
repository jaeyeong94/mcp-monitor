import { TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react';
import type { MarkoutResponse } from '../types/pnl';
import styles from './MarkoutAnalysis.module.css';

interface MarkoutAnalysisProps {
  data: MarkoutResponse;
}

function getIntervalLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
}

function getMarkoutColor(bps: number): string {
  if (bps > 5) return '#3fb950';
  if (bps > 0) return '#8bc34a';
  if (bps > -5) return '#ffb74d';
  return '#f85149';
}

function getMarkoutStatus(bps: number): { label: string; icon: typeof TrendingUp } {
  if (bps > 0) return { label: 'Favorable', icon: TrendingUp };
  return { label: 'Adverse Selection', icon: TrendingDown };
}

export function MarkoutAnalysis({ data }: MarkoutAnalysisProps) {
  const { markout_analysis } = data;

  // Calculate overall assessment
  const avgMarkout = markout_analysis.reduce((sum, m) => sum + m.avg_markout_bps, 0) / markout_analysis.length;
  const totalPnl = markout_analysis.reduce((sum, m) => sum + m.total_markout_pnl, 0) / markout_analysis.length;
  const isHealthy = avgMarkout > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <AlertCircle size={18} className={isHealthy ? styles.healthy : styles.warning} />
          <h3 className={styles.title}>Markout Analysis</h3>
        </div>
        <span className={`${styles.badge} ${isHealthy ? styles.good : styles.bad}`}>
          {isHealthy ? 'Healthy' : 'Review Needed'}
        </span>
      </div>

      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${isHealthy ? styles.positive : styles.negative}`}>
          <span className={styles.summaryLabel}>Avg Markout</span>
          <span className={styles.summaryValue}>
            {avgMarkout > 0 ? '+' : ''}{avgMarkout.toFixed(2)} bps
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Markout PnL</span>
          <span className={styles.summaryValue}>${totalPnl.toFixed(2)}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Trades</span>
          <span className={styles.summaryValue}>{markout_analysis[0]?.trade_count || 0}</span>
        </div>
      </div>

      <div className={styles.intervals}>
        <h4 className={styles.sectionTitle}>
          <Clock size={14} />
          Markout by Interval
        </h4>

        <div className={styles.intervalGrid}>
          {markout_analysis.map(interval => {
            const status = getMarkoutStatus(interval.avg_markout_bps);
            const StatusIcon = status.icon;

            return (
              <div key={interval.interval_seconds} className={styles.intervalCard}>
                <div className={styles.intervalHeader}>
                  <span className={styles.intervalLabel}>
                    {getIntervalLabel(interval.interval_seconds)}
                  </span>
                  <StatusIcon
                    size={14}
                    style={{ color: getMarkoutColor(interval.avg_markout_bps) }}
                  />
                </div>

                <div
                  className={styles.intervalValue}
                  style={{ color: getMarkoutColor(interval.avg_markout_bps) }}
                >
                  {interval.avg_markout_bps > 0 ? '+' : ''}
                  {interval.avg_markout_bps.toFixed(2)} bps
                </div>

                <div className={styles.intervalBar}>
                  <div
                    className={styles.intervalFill}
                    style={{
                      width: `${Math.min(Math.abs(interval.avg_markout_bps) * 5, 100)}%`,
                      background: getMarkoutColor(interval.avg_markout_bps),
                    }}
                  />
                </div>

                <div className={styles.intervalMeta}>
                  <span>σ: {interval.stddev_markout_bps.toFixed(1)}</span>
                  <span>${interval.total_markout_pnl.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.interpretation}>
        <p><strong>양수 Markout:</strong> {data.interpretation.positive_markout}</p>
        <p><strong>음수 Markout:</strong> {data.interpretation.negative_markout}</p>
      </div>
    </div>
  );
}
