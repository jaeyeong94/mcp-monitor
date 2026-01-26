import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { MetricValue } from '../hooks/useTradeMetrics';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  name: string;
  shortName: string;
  description: string;
  metric: MetricValue;
  format?: (value: number) => string;
  thresholds?: { warning: number; danger: number };
  inverse?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  name,
  shortName,
  description,
  metric,
  format = (v) => v.toFixed(2),
  thresholds,
  inverse = false,
  onClick,
}: MetricCardProps) {
  const statusIcon = {
    normal: <CheckCircle size={16} className={styles.iconNormal} />,
    warning: <AlertTriangle size={16} className={styles.iconWarning} />,
    danger: <XCircle size={16} className={styles.iconDanger} />,
  };

  const trendIcon = {
    up: <TrendingUp size={14} className={inverse ? styles.trendBad : styles.trendGood} />,
    down: <TrendingDown size={14} className={inverse ? styles.trendGood : styles.trendBad} />,
    stable: <Minus size={14} className={styles.trendNeutral} />,
  };

  const statusClass = {
    normal: styles.statusNormal,
    warning: styles.statusWarning,
    danger: styles.statusDanger,
  };

  return (
    <div
      className={`${styles.card} ${statusClass[metric.status]} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.shortName}>{shortName}</span>
          {statusIcon[metric.status]}
        </div>
        <span className={styles.name}>{name}</span>
      </div>

      <div className={styles.valueSection}>
        <span className={styles.value}>{format(metric.value)}</span>
        {metric.trend && (
          <span className={styles.trend}>
            {trendIcon[metric.trend]}
          </span>
        )}
      </div>

      <p className={styles.description}>{description}</p>

      {thresholds && (
        <div className={styles.thresholdBar}>
          <div className={styles.thresholdTrack}>
            <div
              className={styles.thresholdFill}
              style={{
                width: `${Math.min((metric.value / (thresholds.danger * 1.5)) * 100, 100)}%`,
              }}
            />
            <div
              className={styles.warningMark}
              style={{ left: `${(thresholds.warning / (thresholds.danger * 1.5)) * 100}%` }}
            />
            <div
              className={styles.dangerMark}
              style={{ left: `${(thresholds.danger / (thresholds.danger * 1.5)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
