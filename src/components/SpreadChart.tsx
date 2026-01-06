import { memo, useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import type { OrderbookSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, CHART_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface SpreadChartProps {
  data: OrderbookSummary[];
  title: string;
}

export const SpreadChart = memo(function SpreadChart({ data, title }: SpreadChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 180 })
    );

    chartRef.current = chart;

    // Mean spread (area)
    const meanSeries = chart.addAreaSeries({
      topColor: CHART_COLORS.accentFill,
      bottomColor: CHART_COLORS.accentFillLight,
      lineColor: CHART_COLORS.accent,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Max spread (line)
    const maxSeries = chart.addLineSeries({
      color: CHART_COLORS.warning,
      lineWidth: 1,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const meanData = data
      .filter((d) => d.spread_bps?.mean != null)
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.spread_bps.mean,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    const maxData = data
      .filter((d) => d.spread_bps?.max != null)
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.spread_bps.max,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    if (meanData.length > 0) meanSeries.setData(meanData);
    if (maxData.length > 0) maxSeries.setData(maxData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  // Calculate stats
  const latestData = data[data.length - 1];
  const currentMean = latestData?.spread_bps?.mean ?? 0;
  const currentMax = latestData?.spread_bps?.max ?? 0;
  const avgMean = data.length > 0
    ? data.reduce((sum, d) => sum + (d.spread_bps?.mean ?? 0), 0) / data.length
    : 0;

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: CHART_COLORS.accent }} />
          <span>Mean: {currentMean.toFixed(2)} bps</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: CHART_COLORS.warning }} />
          <span>Max: {currentMax.toFixed(2)} bps</span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: CHART_COLORS.text }}>Avg: {avgMean.toFixed(2)} bps</span>
        </div>
      </div>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
