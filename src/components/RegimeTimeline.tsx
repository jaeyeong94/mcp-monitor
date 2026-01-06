import { memo, useMemo, useRef, useEffect } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type HistogramData, type Time } from 'lightweight-charts';
import type { TradesSummary, OrderbookSummary } from '../types/market';
import { analyzeRegime, getRegimeDisplay, type RegimeType } from '../utils/regimeDetection';
import { CHART_COLORS, parseTimestamp } from '../utils/chartUtils';
import styles from './RegimeTimeline.module.css';

interface RegimeTimelineProps {
  trades: TradesSummary[];
  orderbook?: OrderbookSummary[];
  title?: string;
}

// Map regime types to numeric values for visualization
const REGIME_VALUES: Record<RegimeType, number> = {
  trending_bull: 2,
  trending_bear: -2,
  mean_reverting: 0,
  high_volatility: 1.5,
  consolidation: -0.5,
  unknown: 0,
};

const REGIME_COLORS: Record<RegimeType, string> = {
  trending_bull: '#3fb950',
  trending_bear: '#f85149',
  mean_reverting: '#a371f7',
  high_volatility: '#f0883e',
  consolidation: '#8b949e',
  unknown: '#484f58',
};

function RegimeTimelineComponent({ trades, orderbook, title = 'Regime Timeline' }: RegimeTimelineProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Analyze regime for each data point (simplified - uses rolling window)
  const regimeData = useMemo(() => {
    if (trades.length < 15) return [];

    const results: Array<{
      time: Time;
      value: number;
      color: string;
      regime: RegimeType;
    }> = [];

    // Use a sliding window to detect regime at each point
    const windowSize = 15;
    for (let i = windowSize; i < trades.length; i++) {
      const windowTrades = trades.slice(i - windowSize, i + 1);
      const windowOrderbook = orderbook?.slice(i - windowSize, i + 1);

      const analysis = analyzeRegime(windowTrades, windowOrderbook);
      const timestamp = trades[i].timestamp;

      if (!timestamp) continue;

      const time = parseTimestamp(timestamp) as Time;

      results.push({
        time,
        value: REGIME_VALUES[analysis.current.type],
        color: REGIME_COLORS[analysis.current.type],
        regime: analysis.current.type,
      });
    }

    return results;
  }, [trades, orderbook]);

  // Get current regime analysis
  const currentAnalysis = useMemo(() => {
    return analyzeRegime(trades, orderbook);
  }, [trades, orderbook]);

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
        vertLine: { color: 'rgba(0, 217, 255, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0, 217, 255, 0.3)', width: 1, style: 2 },
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    });

    chartRef.current = chart;

    // Create histogram series for regime visualization
    const series = chart.addHistogramSeries({
      priceFormat: { type: 'custom', formatter: () => '' },
      priceLineVisible: false,
      lastValueVisible: false,
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

  // Update data
  useEffect(() => {
    if (!seriesRef.current || regimeData.length === 0) return;

    const histogramData: HistogramData[] = regimeData.map((d) => ({
      time: d.time,
      value: d.value,
      color: d.color,
    }));

    seriesRef.current.setData(histogramData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [regimeData]);

  // Legend items
  const legendItems = useMemo(() => {
    return [
      { type: 'trending_bull' as RegimeType, label: 'Bull' },
      { type: 'trending_bear' as RegimeType, label: 'Bear' },
      { type: 'high_volatility' as RegimeType, label: 'Volatile' },
      { type: 'mean_reverting' as RegimeType, label: 'Reverting' },
      { type: 'consolidation' as RegimeType, label: 'Consol' },
    ];
  }, []);

  const currentDisplay = getRegimeDisplay(currentAnalysis.current.type);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.legend}>
          {legendItems.map(({ type, label }) => (
            <div
              key={type}
              className={`${styles.legendItem} ${
                currentAnalysis.current.type === type ? styles.active : ''
              }`}
            >
              <span
                className={styles.legendDot}
                style={{ backgroundColor: REGIME_COLORS[type] }}
              />
              <span className={styles.legendLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <div ref={chartContainerRef} className={styles.chart} />

        {/* Overlay showing current regime */}
        <div className={styles.currentOverlay}>
          <span className={styles.overlayLabel}>Current:</span>
          <span
            className={styles.overlayValue}
            style={{ color: currentDisplay.color }}
          >
            {currentDisplay.label}
          </span>
        </div>
      </div>
    </div>
  );
}

export const RegimeTimeline = memo(RegimeTimelineComponent);
