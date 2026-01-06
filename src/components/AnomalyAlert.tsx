import { memo } from 'react';
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import type { Anomaly } from '../types/market';
import styles from './AnomalyAlert.module.css';

interface AnomalyAlertProps {
  anomalies: Anomaly[];
}

// Parse timestamp safely (handles "2026-01-05 12:32:00 KST" format)
function formatTimestamp(timestamp: string): string {
  try {
    // Remove timezone suffix like " KST"
    const cleanTimestamp = timestamp.replace(/ [A-Z]{3,4}$/, '');
    const date = new Date(cleanTimestamp);

    if (isNaN(date.getTime())) {
      // If still invalid, try to extract time from string
      const timeMatch = timestamp.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        return `${timeMatch[1]}:${timeMatch[2]}`;
      }
      return timestamp.slice(0, 16);
    }

    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp.slice(0, 16);
  }
}

export const AnomalyAlert = memo(function AnomalyAlert({ anomalies }: AnomalyAlertProps) {
  if (anomalies.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <AlertTriangle size={18} />
          <h3>Anomaly Detection</h3>
        </div>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>✓</span>
          <span>이상 징후가 감지되지 않았습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <AlertTriangle size={18} />
        <h3>Anomaly Detection</h3>
        <span className={styles.badge}>{anomalies.length}</span>
      </div>
      
      <div className={styles.list}>
        {anomalies.map((anomaly, index) => (
          <div 
            key={index} 
            className={`${styles.alert} ${anomaly.type === 'volume_spike' ? styles.volume : styles.spread}`}
          >
            <div className={styles.alertIcon}>
              {anomaly.type === 'volume_spike' ? (
                <TrendingUp size={16} />
              ) : (
                <Activity size={16} />
              )}
            </div>
            
            <div className={styles.alertContent}>
              <div className={styles.alertType}>
                {anomaly.type === 'volume_spike' ? '거래량 급등' : '스프레드 급등'}
              </div>
              <div className={styles.alertMeta}>
                <span className={styles.alertTime}>
                  {formatTimestamp(anomaly.timestamp)}
                </span>
                <span className={styles.alertZScore}>
                  z-score: {anomaly.z_score.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className={styles.alertValue}>
              {anomaly.value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

