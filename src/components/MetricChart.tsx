import { memo, useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import { parseTimestamp, createDefaultChartOptions, CHART_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface MetricChartProps {
  data: { timestamp: string; value: number }[];
  title: string;
  color?: string;
  warningThreshold?: number;
  dangerThreshold?: number;
  inverse?: boolean;
  formatValue?: (value: number) => string;
  height?: number;
}

export const MetricChart = memo(function MetricChart({
  data,
  title,
  color = CHART_COLORS.accent,
  warningThreshold,
  dangerThreshold,
  inverse = false,
  formatValue = (v) => v.toFixed(2),
  height = 200,
}: MetricChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height })
    );

    chartRef.current = chart;

    // Main series
    const series = chart.addAreaSeries({
      topColor: `${color}40`,
      bottomColor: `${color}05`,
      lineColor: color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const chartData = data
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        value: d.value,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    if (chartData.length > 0) {
      series.setData(chartData);
    }

    // Add threshold lines
    if (warningThreshold !== undefined) {
      series.createPriceLine({
        price: warningThreshold,
        color: CHART_COLORS.warning,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: inverse ? 'Min' : 'Warn',
      });
    }

    if (dangerThreshold !== undefined) {
      series.createPriceLine({
        price: dangerThreshold,
        color: CHART_COLORS.danger,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: inverse ? 'Critical' : 'Danger',
      });
    }

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
  }, [data, color, warningThreshold, dangerThreshold, inverse, height]);

  // Calculate stats
  const currentValue = data[data.length - 1]?.value ?? 0;
  const avgValue = data.length > 0
    ? data.reduce((sum, d) => sum + d.value, 0) / data.length
    : 0;
  const maxValue = data.length > 0
    ? Math.max(...data.map((d) => d.value))
    : 0;
  const minValue = data.length > 0
    ? Math.min(...data.map((d) => d.value))
    : 0;

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: color }} />
          <span>Current: {formatValue(currentValue)}</span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: CHART_COLORS.text }}>Avg: {formatValue(avgValue)}</span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: CHART_COLORS.text }}>
            Range: {formatValue(minValue)} - {formatValue(maxValue)}
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
