import { memo, useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import type { TradesSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, VOLUME_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface VolumeChartProps {
  data: TradesSummary[];
  title: string;
}

export const VolumeChart = memo(function VolumeChart({ data, title }: VolumeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 200 }, false)
    );

    chartRef.current = chart;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    const volumeData = data
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.volume,
        color: d.buy_sell.buy_ratio > 0.5 ? VOLUME_COLORS.buy : VOLUME_COLORS.sell,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    volumeSeries.setData(volumeData);
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
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
