import { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import type { OrderbookSummary, TradesSummary, Anomaly, MarketStats } from '../types/market';
import {
  exportTradesToCSV,
  exportOrderbookToCSV,
  exportAnomaliesToCSV,
  exportAllToCSV,
} from '../utils/csvExport';
import styles from './ExportButton.module.css';

interface ExportButtonProps {
  exchange: string;
  symbol: string;
  orderbookSummary: OrderbookSummary[];
  tradesSummary: TradesSummary[];
  anomalies: Anomaly[];
  stats: MarketStats | null;
}

export function ExportButton({
  exchange,
  symbol,
  orderbookSummary,
  tradesSummary,
  anomalies,
  stats,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = `${exchange}_${symbol}_${timestamp}`;

  const handleExportTrades = () => {
    exportTradesToCSV(tradesSummary, `${prefix}_trades.csv`);
    setIsOpen(false);
  };

  const handleExportOrderbook = () => {
    exportOrderbookToCSV(orderbookSummary, `${prefix}_orderbook.csv`);
    setIsOpen(false);
  };

  const handleExportAnomalies = () => {
    exportAnomaliesToCSV(anomalies, `${prefix}_anomalies.csv`);
    setIsOpen(false);
  };

  const handleExportAll = () => {
    exportAllToCSV({ orderbookSummary, tradesSummary, anomalies, stats }, exchange, symbol);
    setIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Export data"
      >
        <Download size={16} />
        <span>Export</span>
        <ChevronDown size={14} className={isOpen ? styles.chevronOpen : ''} />
      </button>

      {isOpen && (
        <>
          <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <button onClick={handleExportAll} className={styles.dropdownItem}>
              <Download size={14} />
              <span>Export All (3 files)</span>
            </button>
            <div className={styles.divider} />
            <button
              onClick={handleExportTrades}
              className={styles.dropdownItem}
              disabled={tradesSummary.length === 0}
            >
              <span>Trades ({tradesSummary.length} rows)</span>
            </button>
            <button
              onClick={handleExportOrderbook}
              className={styles.dropdownItem}
              disabled={orderbookSummary.length === 0}
            >
              <span>Orderbook ({orderbookSummary.length} rows)</span>
            </button>
            <button
              onClick={handleExportAnomalies}
              className={styles.dropdownItem}
              disabled={anomalies.length === 0}
            >
              <span>Anomalies ({anomalies.length} rows)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
