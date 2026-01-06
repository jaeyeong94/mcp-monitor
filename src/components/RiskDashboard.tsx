import { memo, useMemo, useRef, useEffect } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type AreaData, type Time } from 'lightweight-charts';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Shield } from 'lucide-react';
import type { TradesSummary } from '../types/market';
import { analyzeRisk, getDrawdownSeries, getRiskLevel, formatRiskMetric, type RiskMetrics } from '../utils/riskMetrics';
import { CHART_COLORS, parseTimestamp } from '../utils/chartUtils';
import styles from './RiskDashboard.module.css';

interface RiskDashboardProps {
  trades: TradesSummary[];
  title?: string;
}

function RiskDashboardComponent({ trades, title = 'Risk Analysis' }: RiskDashboardProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  // Calculate risk metrics
  const metrics: RiskMetrics = useMemo(() => {
    return analyzeRisk(trades);
  }, [trades]);

  // Get drawdown series for chart
  const drawdownData = useMemo(() => {
    return getDrawdownSeries(trades);
  }, [trades]);

  // Get risk level
  const riskLevel = useMemo(() => {
    return getRiskLevel(metrics);
  }, [metrics]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: CHART_COLORS.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridLine },
        horzLines: { color: CHART_COLORS.gridLine },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(248, 81, 73, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(248, 81, 73, 0.3)', width: 1, style: 2 },
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });

    chartRef.current = chart;

    // Create area series for drawdown
    const series = chart.addAreaSeries({
      lineColor: CHART_COLORS.danger,
      topColor: 'rgba(248, 81, 73, 0.4)',
      bottomColor: 'rgba(248, 81, 73, 0.02)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `-${price.toFixed(2)}%`,
      },
    });

    seriesRef.current = series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || drawdownData.length === 0) return;

    const chartData: AreaData[] = drawdownData.map((d) => ({
      time: parseTimestamp(d.timestamp) as Time,
      value: d.drawdown,
    }));

    seriesRef.current.setData(chartData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [drawdownData]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Shield size={16} className={styles.icon} />
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div
          className={styles.riskBadge}
          style={{ backgroundColor: `${riskLevel.color}20`, color: riskLevel.color }}
        >
          <AlertTriangle size={12} />
          <span>{riskLevel.label}</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className={styles.metricsGrid}>
        {/* VaR Section */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Value at Risk (95%)</span>
          </div>
          <div className={styles.metricValue} style={{ color: CHART_COLORS.danger }}>
            {formatRiskMetric(metrics.var95, 'percentage')}
          </div>
          <div className={styles.metricSub}>
            99% VaR: {formatRiskMetric(metrics.var99, 'percentage')}
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Sharpe Ratio</span>
            {metrics.sharpeRatio > 0 ? (
              <TrendingUp size={14} style={{ color: CHART_COLORS.success }} />
            ) : (
              <TrendingDown size={14} style={{ color: CHART_COLORS.danger }} />
            )}
          </div>
          <div
            className={styles.metricValue}
            style={{ color: metrics.sharpeRatio > 1 ? CHART_COLORS.success : CHART_COLORS.text }}
          >
            {formatRiskMetric(metrics.sharpeRatio, 'ratio')}
          </div>
          <div className={styles.metricSub}>
            Sortino: {formatRiskMetric(metrics.sortinoRatio, 'ratio')}
          </div>
        </div>

        {/* Volatility */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Volatility (Ann.)</span>
            <Activity size={14} style={{ color: CHART_COLORS.warning }} />
          </div>
          <div
            className={styles.metricValue}
            style={{ color: metrics.volatility > 50 ? CHART_COLORS.warning : CHART_COLORS.text }}
          >
            {formatRiskMetric(metrics.volatility, 'percentage')}
          </div>
          <div className={styles.metricSub}>
            Daily: {formatRiskMetric(metrics.dailyVolatility, 'percentage')}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Max Drawdown</span>
          </div>
          <div className={styles.metricValue} style={{ color: CHART_COLORS.danger }}>
            -{metrics.maxDrawdown.toFixed(2)}%
          </div>
          <div className={styles.metricSub}>
            Current: -{metrics.currentDrawdown.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Drawdown Chart */}
      <div className={styles.chartSection}>
        <div className={styles.chartTitle}>Drawdown Over Time</div>
        <div ref={chartContainerRef} className={styles.chart} />
      </div>

      {/* Performance Summary */}
      <div className={styles.performanceSection}>
        <div className={styles.performanceItem}>
          <span className={styles.perfLabel}>Total Return</span>
          <span
            className={styles.perfValue}
            style={{ color: metrics.totalReturn >= 0 ? CHART_COLORS.success : CHART_COLORS.danger }}
          >
            {metrics.totalReturn >= 0 ? '+' : ''}{metrics.totalReturn.toFixed(2)}%
          </span>
        </div>
        <div className={styles.performanceItem}>
          <span className={styles.perfLabel}>Win Rate</span>
          <span
            className={styles.perfValue}
            style={{ color: metrics.winRate >= 50 ? CHART_COLORS.success : CHART_COLORS.danger }}
          >
            {metrics.winRate.toFixed(1)}%
          </span>
        </div>
        <div className={styles.performanceItem}>
          <span className={styles.perfLabel}>CVaR (95%)</span>
          <span className={styles.perfValue} style={{ color: CHART_COLORS.danger }}>
            {formatRiskMetric(metrics.cvar95, 'percentage')}
          </span>
        </div>
      </div>
    </div>
  );
}

export const RiskDashboard = memo(RiskDashboardComponent);
