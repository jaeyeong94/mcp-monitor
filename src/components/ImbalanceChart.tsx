import { memo, useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import type { OrderbookSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, CHART_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface ImbalanceChartProps {
  data: OrderbookSummary[];
  title: string;
}

export const ImbalanceChart = memo(function ImbalanceChart({ data, title }: ImbalanceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 180 }, false)
    );

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      topColor: CHART_COLORS.accentFill,
      bottomColor: 'rgba(0, 217, 255, 0.0)',
      lineColor: CHART_COLORS.accent,
      lineWidth: 2,
    });

    // Add zero line
    const zeroLineSeries = chart.addLineSeries({
      color: 'rgba(139, 148, 158, 0.5)',
      lineWidth: 1,
      lineStyle: 2, // dashed
    });

    const imbalanceData = data
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.avg_imbalance,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    const zeroLineData = data
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: 0,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    areaSeries.setData(imbalanceData);
    zeroLineSeries.setData(zeroLineData);
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

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: CHART_COLORS.success }} />
          매수 우세 (+)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: CHART_COLORS.danger }} />
          매도 우세 (-)
        </span>
      </div>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
