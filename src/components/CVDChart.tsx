import { memo, useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import type { TradesSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, formatVolume, CHART_COLORS } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface CVDChartProps {
  data: TradesSummary[];
  title: string;
}

export const CVDChart = memo(function CVDChart({ data, title }: CVDChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Calculate CVD data
  const cvdData = useMemo(() => {
    if (data.length === 0) return [];

    let cumulative = 0;
    return data
      .map((d) => {
        const delta = (d.buy_sell?.buy_volume ?? 0) - (d.buy_sell?.sell_volume ?? 0);
        cumulative += delta;
        return {
          time: parseTimestamp(d.timestamp),
          value: cumulative,
          delta,
        };
      })
      .sort((a, b) => a.time - b.time);
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current || cvdData.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 180 })
    );

    chartRef.current = chart;

    // Zero line
    const zeroLineSeries = chart.addLineSeries({
      color: '#30363d',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // CVD area chart with color based on value
    const cvdSeries = chart.addAreaSeries({
      topColor: 'rgba(63, 185, 80, 0.4)',
      bottomColor: 'rgba(248, 81, 73, 0.4)',
      lineColor: '#00d9ff',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Update colors based on positive/negative
    const lastValue = cvdData[cvdData.length - 1]?.value ?? 0;
    if (lastValue >= 0) {
      cvdSeries.applyOptions({
        topColor: CHART_COLORS.successFill,
        bottomColor: CHART_COLORS.successFillLight,
        lineColor: CHART_COLORS.successAlt,
      });
    } else {
      cvdSeries.applyOptions({
        topColor: CHART_COLORS.dangerFillLight,
        bottomColor: CHART_COLORS.dangerFill,
        lineColor: CHART_COLORS.danger,
      });
    }

    const chartData = cvdData.map((d) => ({
      time: d.time as unknown as string,
      value: d.value,
    }));

    // Zero line data
    const zeroData = cvdData.map((d) => ({
      time: d.time as unknown as string,
      value: 0,
    }));

    if (chartData.length > 0) {
      cvdSeries.setData(chartData);
      zeroLineSeries.setData(zeroData);
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
  }, [cvdData]);

  // Calculate stats
  const currentCVD = cvdData[cvdData.length - 1]?.value ?? 0;
  const maxCVD = Math.max(...cvdData.map((d) => d.value));
  const minCVD = Math.min(...cvdData.map((d) => d.value));

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: currentCVD >= 0 ? CHART_COLORS.successAlt : CHART_COLORS.danger }}
          />
          <span style={{ color: currentCVD >= 0 ? CHART_COLORS.successAlt : CHART_COLORS.danger }}>
            CVD: {currentCVD >= 0 ? '+' : ''}{formatVolume(currentCVD)}
          </span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: CHART_COLORS.successAlt }}>Max: +{formatVolume(maxCVD)}</span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: CHART_COLORS.danger }}>Min: {formatVolume(minCVD)}</span>
        </div>
      </div>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
