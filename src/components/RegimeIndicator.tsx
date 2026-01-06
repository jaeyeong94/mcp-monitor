import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Pause, HelpCircle } from 'lucide-react';
import type { TradesSummary, OrderbookSummary } from '../types/market';
import { analyzeRegime, getRegimeDisplay, type RegimeType, type RegimeAnalysis } from '../utils/regimeDetection';
import styles from './RegimeIndicator.module.css';

interface RegimeIndicatorProps {
  trades: TradesSummary[];
  orderbook?: OrderbookSummary[];
}

const REGIME_ICONS: Record<RegimeType, React.ReactNode> = {
  trending_bull: <TrendingUp size={16} />,
  trending_bear: <TrendingDown size={16} />,
  mean_reverting: <Activity size={16} />,
  high_volatility: <Zap size={16} />,
  consolidation: <Pause size={16} />,
  unknown: <HelpCircle size={16} />,
};

function RegimeIndicatorComponent({ trades, orderbook }: RegimeIndicatorProps) {
  const analysis: RegimeAnalysis = useMemo(() => {
    return analyzeRegime(trades, orderbook);
  }, [trades, orderbook]);

  const display = getRegimeDisplay(analysis.current.type);
  const { metrics, current } = analysis;

  // Confidence level indicator
  const getConfidenceLevel = (confidence: number): string => {
    if (confidence >= 80) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  };

  const confidenceLevel = getConfidenceLevel(current.confidence);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Market Regime</h3>
      </div>

      {/* Current Regime */}
      <div
        className={styles.regimeCard}
        style={{ borderColor: display.color }}
      >
        <div className={styles.regimeIcon} style={{ color: display.color }}>
          {REGIME_ICONS[current.type]}
        </div>
        <div className={styles.regimeInfo}>
          <span className={styles.regimeLabel} style={{ color: display.color }}>
            {display.label}
          </span>
          <span className={styles.regimeDescription}>
            {display.description}
          </span>
        </div>
        <div className={styles.confidence}>
          <div className={`${styles.confidenceBadge} ${styles[confidenceLevel]}`}>
            {current.confidence.toFixed(0)}%
          </div>
          <span className={styles.confidenceLabel}>confidence</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Trend</span>
          <div className={styles.metricValue}>
            <span
              className={styles.metricNumber}
              style={{
                color: metrics.trendStrength > 0 ? '#3fb950' :
                       metrics.trendStrength < 0 ? '#f85149' : '#8b949e'
              }}
            >
              {metrics.trendStrength > 0 ? '+' : ''}{metrics.trendStrength.toFixed(1)}
            </span>
          </div>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Volatility</span>
          <div className={styles.metricValue}>
            <span
              className={styles.metricNumber}
              style={{
                color: metrics.volatilityRatio > 1.5 ? '#f0883e' :
                       metrics.volatilityRatio < 0.5 ? '#3fb950' : '#8b949e'
              }}
            >
              {metrics.volatilityRatio.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Momentum</span>
          <div className={styles.metricValue}>
            <span
              className={styles.metricNumber}
              style={{
                color: metrics.momentum > 0.5 ? '#3fb950' :
                       metrics.momentum < -0.5 ? '#f85149' : '#8b949e'
              }}
            >
              {metrics.momentum > 0 ? '+' : ''}{metrics.momentum.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Spread</span>
          <div className={styles.metricValue}>
            <span
              className={styles.metricNumber}
              style={{
                color: metrics.spreadAnomaly > 0.5 ? '#f85149' :
                       metrics.spreadAnomaly < -0.3 ? '#3fb950' : '#8b949e'
              }}
            >
              {metrics.spreadAnomaly > 0 ? '+' : ''}{(metrics.spreadAnomaly * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Indicators */}
      {current.indicators.rsi !== undefined && (
        <div className={styles.indicatorsSection}>
          <div className={styles.indicatorRow}>
            <span className={styles.indicatorLabel}>RSI ({current.indicators.rsi.toFixed(1)})</span>
            <div className={styles.rsiBar}>
              <div
                className={styles.rsiMarker}
                style={{
                  left: `${Math.min(100, Math.max(0, current.indicators.rsi))}%`,
                  backgroundColor: current.indicators.rsi > 70 ? '#f85149' :
                                   current.indicators.rsi < 30 ? '#3fb950' : '#00d9ff'
                }}
              />
              <div className={styles.rsiZones}>
                <span className={styles.oversold}>30</span>
                <span className={styles.overbought}>70</span>
              </div>
            </div>
          </div>

          {current.indicators.smaFast && current.indicators.smaSlow && (
            <div className={styles.smaInfo}>
              <span className={styles.smaLabel}>SMA Cross:</span>
              <span
                className={styles.smaValue}
                style={{
                  color: current.indicators.smaFast > current.indicators.smaSlow
                    ? '#3fb950' : '#f85149'
                }}
              >
                {current.indicators.smaFast > current.indicators.smaSlow ? 'Bullish' : 'Bearish'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const RegimeIndicator = memo(RegimeIndicatorComponent);
