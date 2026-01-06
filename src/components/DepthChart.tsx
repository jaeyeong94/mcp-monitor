import { memo, useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import type { OrderbookSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, CHART_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface DepthChartProps {
  data: OrderbookSummary[];
  title: string;
}

export const DepthChart = memo(function DepthChart({ data, title }: DepthChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 200 })
    );

    chartRef.current = chart;

    // Bid depth (green area)
    const bidSeries = chart.addAreaSeries({
      topColor: CHART_COLORS.successFill,
      bottomColor: CHART_COLORS.successFillLight,
      lineColor: CHART_COLORS.success,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Ask depth (red area)
    const askSeries = chart.addAreaSeries({
      topColor: CHART_COLORS.dangerFill,
      bottomColor: CHART_COLORS.dangerFillLight,
      lineColor: CHART_COLORS.danger,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const bidData = data
      .filter((d) => d.avg_bid_depth != null)
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.avg_bid_depth,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    const askData = data
      .filter((d) => d.avg_ask_depth != null)
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.avg_ask_depth,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    if (bidData.length > 0) bidSeries.setData(bidData);
    if (askData.length > 0) askSeries.setData(askData);

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

  // Calculate current values for legend
  const latestData = data[data.length - 1];
  const bidDepth = latestData?.avg_bid_depth ?? 0;
  const askDepth = latestData?.avg_ask_depth ?? 0;

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.depthLegend}>
        <span className={styles.bidLegend}>Bid: {bidDepth.toFixed(2)}</span>
        <span className={styles.askLegend}>Ask: {askDepth.toFixed(2)}</span>
      </div>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
