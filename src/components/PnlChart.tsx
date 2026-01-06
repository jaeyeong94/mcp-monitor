import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, UTCTimestamp } from 'lightweight-charts';
import type { InventoryPnlData } from '../types/pnl';
import styles from './Chart.module.css';

interface PnlChartProps {
  data: InventoryPnlData[];
  title: string;
}

export function PnlChart({ data, title }: PnlChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 250,
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: '#1a1f25' },
        vertLine: { labelBackgroundColor: '#1a1f25' },
      },
    });

    // Total PnL 라인
    const pnlSeries = chart.addLineSeries({
      color: '#00d9ff',
      lineWidth: 2,
      title: 'Total PnL',
    });

    // Realized PnL 라인
    const realizedSeries = chart.addLineSeries({
      color: '#3fb950',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'Realized',
    });

    // Zero line
    const zeroSeries = chart.addLineSeries({
      color: 'rgba(255,255,255,0.2)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const pnlData = data.map(d => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
      value: d.total_pnl,
    }));

    const realizedData = data.map(d => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
      value: d.cumulative_realized_pnl,
    }));

    const zeroData = data.map(d => ({
      time: Math.floor(new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
      value: 0,
    }));

    pnlSeries.setData(pnlData);
    realizedSeries.setData(realizedData);
    zeroSeries.setData(zeroData);

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
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div ref={chartContainerRef} className={styles.chartContainer} />
    </div>
  );
}
