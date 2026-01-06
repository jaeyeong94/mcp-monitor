import { memo, useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, SeriesMarker, Time } from 'lightweight-charts';
import type { TradesSummary } from '../types/market';
import { parseTimestamp, createDefaultChartOptions, CANDLESTICK_PRESET } from '../utils/chartUtils';
import styles from './Chart.module.css';

interface PriceChartProps {
  data: TradesSummary[];
  title: string;
  showVwap?: boolean;
  showLargeTrades?: boolean;
  largeTradeThreshold?: number; // Multiplier of average volume
}

export const PriceChart = memo(function PriceChart({ data, title, showVwap = true, showLargeTrades = true, largeTradeThreshold = 2.0 }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Calculate large trade markers
  const largeTradeMarkers = useMemo(() => {
    if (!showLargeTrades || data.length === 0) return [];

    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    const threshold = avgVolume * largeTradeThreshold;

    const markers: SeriesMarker<Time>[] = [];

    data.forEach((d) => {
      if (d.volume > threshold) {
        const isBuyDominant = (d.buy_sell?.buy_ratio ?? 0.5) > 0.55;
        const isSellDominant = (d.buy_sell?.buy_ratio ?? 0.5) < 0.45;

        if (isBuyDominant || isSellDominant) {
          markers.push({
            time: parseTimestamp(d.timestamp) as unknown as Time,
            position: isBuyDominant ? 'belowBar' : 'aboveBar',
            color: isBuyDominant ? '#3fb950' : '#f85149',
            shape: isBuyDominant ? 'arrowUp' : 'arrowDown',
            text: `${(d.volume / avgVolume).toFixed(1)}x`,
          });
        }
      }
    });

    return markers;
  }, [data, showLargeTrades, largeTradeThreshold]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(
      chartContainerRef.current,
      createDefaultChartOptions({ width: chartContainerRef.current.clientWidth, height: 300 })
    );

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries(CANDLESTICK_PRESET);

    const chartData = data
      .map((d) => ({
        time: parseTimestamp(d.timestamp) as unknown as string,
        open: d.ohlc.open,
        high: d.ohlc.high,
        low: d.ohlc.low,
        close: d.ohlc.close,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

    candlestickSeries.setData(chartData);

    // Add large trade markers
    if (showLargeTrades && largeTradeMarkers.length > 0) {
      candlestickSeries.setMarkers(largeTradeMarkers);
    }

    // Add VWAP line series
    if (showVwap) {
      const vwapSeries = chart.addLineSeries({
        color: '#00d9ff',
        lineWidth: 2,
        lineStyle: 0, // Solid
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const vwapData = data
        .filter((d) => d.vwap && d.vwap > 0)
        .map((d) => ({
          time: parseTimestamp(d.timestamp) as unknown as string,
          value: d.vwap,
        }))
        .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

      if (vwapData.length > 0) {
        vwapSeries.setData(vwapData);
      }
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
  }, [data, showVwap, showLargeTrades, largeTradeMarkers]);

  return (
    <div className={styles.chartContainer}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div ref={chartContainerRef} className={styles.chart} />
    </div>
  );
});
