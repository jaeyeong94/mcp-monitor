import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import type { InventoryPnlResponse } from '../types/pnl';
import styles from './PnlSummary.module.css';

interface PnlSummaryProps {
  data: InventoryPnlResponse;
}

function formatNumber(num: number | null | undefined, decimals = 2): string {
  const value = num ?? 0;
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(decimals) + 'M';
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(decimals) + 'K';
  }
  return value.toFixed(decimals);
}

export function PnlSummary({ data }: PnlSummaryProps) {
  const { summary, risk_analysis } = data;
  const isProfit = summary.total_pnl >= 0;
  const positionType = summary.final_position >= 0 ? 'Long' : 'Short';

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>PnL Summary</h3>

      <div className={styles.grid}>
        {/* Total PnL */}
        <div className={`${styles.card} ${isProfit ? styles.profit : styles.loss}`}>
          <div className={styles.cardHeader}>
            {isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <span>Total PnL</span>
          </div>
          <div className={styles.cardValue}>
            ${formatNumber(summary.total_pnl)}
          </div>
          <div className={styles.cardSub}>
            Realized: ${formatNumber(summary.cumulative_realized_pnl)}
          </div>
        </div>

        {/* Position */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Activity size={18} />
            <span>Position</span>
          </div>
          <div className={styles.cardValue}>
            {formatNumber(Math.abs(summary.final_position), 0)}
          </div>
          <div className={`${styles.cardSub} ${summary.final_position >= 0 ? styles.long : styles.short}`}>
            {positionType} @ ${(summary.avg_cost_basis ?? 0).toFixed(5)}
          </div>
        </div>

        {/* Unrealized PnL */}
        <div className={`${styles.card} ${summary.final_unrealized_pnl >= 0 ? styles.profit : styles.loss}`}>
          <div className={styles.cardHeader}>
            <Activity size={18} />
            <span>Unrealized</span>
          </div>
          <div className={styles.cardValue}>
            ${formatNumber(summary.final_unrealized_pnl)}
          </div>
          <div className={styles.cardSub}>
            {summary.total_trades} trades
          </div>
        </div>

        {/* Max Drawdown */}
        <div className={`${styles.card} ${styles.warning}`}>
          <div className={styles.cardHeader}>
            <AlertTriangle size={18} />
            <span>Max Drawdown</span>
          </div>
          <div className={styles.cardValue}>
            ${formatNumber(risk_analysis.max_drawdown)}
          </div>
          <div className={styles.cardSub}>
            Fee: ${formatNumber(summary.total_fee)}
          </div>
        </div>
      </div>

      {/* Top Drawdown Periods */}
      {risk_analysis.top_drawdown_periods.length > 0 && (
        <div className={styles.drawdownSection}>
          <h4 className={styles.sectionTitle}>Top Drawdown Periods</h4>
          <div className={styles.drawdownList}>
            {risk_analysis.top_drawdown_periods.slice(0, 3).map((period, i) => (
              <div key={i} className={styles.drawdownItem}>
                <span className={styles.drawdownTime}>
                  {new Date(period.timestamp).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className={styles.drawdownValue}>
                  -${(period.drawdown ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
