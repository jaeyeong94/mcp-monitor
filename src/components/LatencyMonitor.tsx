import { memo, useState } from 'react';
import { Wifi, WifiOff, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { LatencyStats } from '../hooks/useLatencyMetrics';
import styles from './LatencyMonitor.module.css';

interface LatencyMonitorProps {
  stats: LatencyStats;
}

function getLatencyStatus(latency: number): 'good' | 'warning' | 'critical' {
  if (latency <= 200) return 'good';
  if (latency <= 500) return 'warning';
  return 'critical';
}

function getStatusColor(status: 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'good':
      return '#3fb950';
    case 'warning':
      return '#f0883e';
    case 'critical':
      return '#f85149';
  }
}

export const LatencyMonitor = memo(function LatencyMonitor({ stats }: LatencyMonitorProps) {
  const [expanded, setExpanded] = useState(false);

  const status = getLatencyStatus(stats.current);
  const statusColor = getStatusColor(status);
  const hasErrors = stats.errorRate > 0;

  return (
    <div className={styles.container}>
      <button
        className={styles.indicator}
        onClick={() => setExpanded(!expanded)}
        title={`Latency: ${stats.current.toFixed(0)}ms`}
      >
        {hasErrors || stats.count === 0 ? (
          <WifiOff size={14} className={styles.iconError} />
        ) : (
          <Wifi size={14} style={{ color: statusColor }} />
        )}
        <span className={styles.value} style={{ color: statusColor }}>
          {stats.count > 0 ? `${stats.current.toFixed(0)}ms` : '--'}
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <>
          <div className={styles.backdrop} onClick={() => setExpanded(false)} />
          <div className={styles.dropdown}>
            <div className={styles.header}>
              <Activity size={14} />
              <span>Network Latency</span>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Current</span>
                <span className={styles.statValue} style={{ color: statusColor }}>
                  {stats.current.toFixed(0)}ms
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Mean</span>
                <span className={styles.statValue}>{stats.mean.toFixed(0)}ms</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Min</span>
                <span className={styles.statValue} style={{ color: '#3fb950' }}>
                  {stats.min.toFixed(0)}ms
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Max</span>
                <span className={styles.statValue} style={{ color: '#f85149' }}>
                  {stats.max.toFixed(0)}ms
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>P95</span>
                <span className={styles.statValue}>{stats.p95.toFixed(0)}ms</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>P99</span>
                <span className={styles.statValue}>{stats.p99.toFixed(0)}ms</span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.footer}>
              <div className={styles.footerItem}>
                <span>Samples</span>
                <span>{stats.count}</span>
              </div>
              <div className={styles.footerItem}>
                <span>Error Rate</span>
                <span style={{ color: stats.errorRate > 0 ? '#f85149' : '#3fb950' }}>
                  {stats.errorRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Simple latency bar visualization */}
            <div className={styles.latencyBar}>
              <div className={styles.latencyBarLabel}>
                <span>0ms</span>
                <span>500ms</span>
              </div>
              <div className={styles.latencyBarTrack}>
                <div
                  className={styles.latencyBarMean}
                  style={{
                    left: `${Math.min((stats.mean / 500) * 100, 100)}%`,
                  }}
                  title={`Mean: ${stats.mean.toFixed(0)}ms`}
                />
                <div
                  className={styles.latencyBarCurrent}
                  style={{
                    left: `${Math.min((stats.current / 500) * 100, 100)}%`,
                    background: statusColor,
                  }}
                  title={`Current: ${stats.current.toFixed(0)}ms`}
                />
                <div
                  className={styles.latencyBarRange}
                  style={{
                    left: `${Math.min((stats.min / 500) * 100, 100)}%`,
                    width: `${Math.min(((stats.max - stats.min) / 500) * 100, 100 - (stats.min / 500) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
