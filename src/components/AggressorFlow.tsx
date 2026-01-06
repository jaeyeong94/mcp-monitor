import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { TradesSummary } from '../types/market';
import { formatVolume } from '../utils/chartUtils';
import styles from './AggressorFlow.module.css';

interface AggressorFlowProps {
  data: TradesSummary[];
}

interface FlowAnalysis {
  currentBuyRatio: number;
  avgBuyRatio: number;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number; // 0-100
  consecutiveBuy: number;
  consecutiveSell: number;
}

function analyzeFlow(data: TradesSummary[]): FlowAnalysis {
  if (data.length === 0) {
    return {
      currentBuyRatio: 0.5,
      avgBuyRatio: 0.5,
      buyVolume: 0,
      sellVolume: 0,
      netVolume: 0,
      trend: 'neutral',
      trendStrength: 0,
      consecutiveBuy: 0,
      consecutiveSell: 0,
    };
  }

  const latest = data[data.length - 1];
  const currentBuyRatio = latest.buy_sell?.buy_ratio ?? 0.5;

  // Calculate average buy ratio
  const avgBuyRatio =
    data.reduce((sum, d) => sum + (d.buy_sell?.buy_ratio ?? 0.5), 0) / data.length;

  // Calculate total volumes
  const buyVolume = data.reduce((sum, d) => sum + (d.buy_sell?.buy_volume ?? 0), 0);
  const sellVolume = data.reduce((sum, d) => sum + (d.buy_sell?.sell_volume ?? 0), 0);
  const netVolume = buyVolume - sellVolume;

  // Calculate consecutive buy/sell dominance
  let consecutiveBuy = 0;
  let consecutiveSell = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    const ratio = data[i].buy_sell?.buy_ratio ?? 0.5;
    if (ratio > 0.5) {
      if (consecutiveSell === 0) consecutiveBuy++;
      else break;
    } else if (ratio < 0.5) {
      if (consecutiveBuy === 0) consecutiveSell++;
      else break;
    } else {
      break;
    }
  }

  // Determine trend
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let trendStrength = 0;

  if (avgBuyRatio > 0.55) {
    trend = 'bullish';
    trendStrength = Math.min(100, (avgBuyRatio - 0.5) * 200);
  } else if (avgBuyRatio < 0.45) {
    trend = 'bearish';
    trendStrength = Math.min(100, (0.5 - avgBuyRatio) * 200);
  } else {
    trend = 'neutral';
    trendStrength = 50;
  }

  return {
    currentBuyRatio,
    avgBuyRatio,
    buyVolume,
    sellVolume,
    netVolume,
    trend,
    trendStrength,
    consecutiveBuy,
    consecutiveSell,
  };
}

export const AggressorFlow = memo(function AggressorFlow({ data }: AggressorFlowProps) {
  const analysis = useMemo(() => analyzeFlow(data), [data]);
  const sellRatio = 1 - analysis.currentBuyRatio;

  const getTrendIcon = () => {
    switch (analysis.trend) {
      case 'bullish':
        return <ArrowUp size={14} />;
      case 'bearish':
        return <ArrowDown size={14} />;
      default:
        return <Minus size={14} />;
    }
  };

  const getTrendLabel = () => {
    switch (analysis.trend) {
      case 'bullish':
        return 'Buy Dominant';
      case 'bearish':
        return 'Sell Dominant';
      default:
        return 'Balanced';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Activity size={16} className={styles.icon} />
        <h3 className={styles.title}>Aggressor Flow</h3>
        <div className={`${styles.trendBadge} ${styles[analysis.trend]}`}>
          {getTrendIcon()}
          <span>{getTrendLabel()}</span>
        </div>
      </div>

      {/* Main Bar */}
      <div className={styles.barContainer}>
        <div className={styles.bar}>
          <div
            className={styles.buyBar}
            style={{ width: `${analysis.currentBuyRatio * 100}%` }}
          >
            <span className={styles.barLabel}>
              {(analysis.currentBuyRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div
            className={styles.sellBar}
            style={{ width: `${sellRatio * 100}%` }}
          >
            <span className={styles.barLabel}>
              {(sellRatio * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Volume Details */}
      <div className={styles.volumeGrid}>
        <div className={styles.volumeItem}>
          <div className={styles.volumeHeader}>
            <TrendingUp size={12} className={styles.buyColor} />
            <span>Buy Volume</span>
          </div>
          <div className={styles.volumeValue}>{formatVolume(analysis.buyVolume)}</div>
        </div>
        <div className={styles.volumeItem}>
          <div className={styles.volumeHeader}>
            <TrendingDown size={12} className={styles.sellColor} />
            <span>Sell Volume</span>
          </div>
          <div className={styles.volumeValue}>{formatVolume(analysis.sellVolume)}</div>
        </div>
        <div className={styles.volumeItem}>
          <div className={styles.volumeHeader}>
            <Activity size={12} />
            <span>Net Flow</span>
          </div>
          <div
            className={`${styles.volumeValue} ${
              analysis.netVolume >= 0 ? styles.buyColor : styles.sellColor
            }`}
          >
            {analysis.netVolume >= 0 ? '+' : ''}
            {formatVolume(analysis.netVolume)}
          </div>
        </div>
      </div>

      {/* Streak Indicators */}
      {(analysis.consecutiveBuy > 2 || analysis.consecutiveSell > 2) && (
        <div className={styles.streak}>
          {analysis.consecutiveBuy > 2 && (
            <div className={`${styles.streakItem} ${styles.buyStreak}`}>
              <ArrowUp size={12} />
              <span>{analysis.consecutiveBuy} consecutive buy periods</span>
            </div>
          )}
          {analysis.consecutiveSell > 2 && (
            <div className={`${styles.streakItem} ${styles.sellStreak}`}>
              <ArrowDown size={12} />
              <span>{analysis.consecutiveSell} consecutive sell periods</span>
            </div>
          )}
        </div>
      )}

      {/* Trend Strength */}
      <div className={styles.strengthContainer}>
        <span className={styles.strengthLabel}>Trend Strength</span>
        <div className={styles.strengthBar}>
          <div
            className={`${styles.strengthFill} ${styles[analysis.trend]}`}
            style={{ width: `${analysis.trendStrength}%` }}
          />
        </div>
        <span className={styles.strengthValue}>{analysis.trendStrength.toFixed(0)}%</span>
      </div>
    </div>
  );
});
