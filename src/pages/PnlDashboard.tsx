import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { PnlChart } from '../components/PnlChart';
import { PositionChart } from '../components/PositionChart';
import { PnlSummary } from '../components/PnlSummary';
import { AgentSelector } from '../components/AgentSelector';
import { MarkoutAnalysis } from '../components/MarkoutAnalysis';
import { usePnlData, useAgents, useMarkoutData } from '../hooks/usePnlData';
import styles from './PnlDashboard.module.css';

interface PnlDashboardProps {
  onBack: () => void;
  initialTarget?: { exchange: string; pair: string } | null;
  hideHeader?: boolean;
}

export function PnlDashboard({ onBack: _onBack, initialTarget, hideHeader: _hideHeader }: PnlDashboardProps) {
  const { agents, loading: agentsLoading } = useAgents();
  const [selectedPair, setSelectedPair] = useState<{ exchange: string; pair: string } | null>(
    initialTarget || null
  );

  // Auto-select first pair when agents load (only if no initial target)
  useEffect(() => {
    if (agents && agents.agents.length > 0 && !selectedPair && !initialTarget) {
      const firstAgent = agents.agents[0];
      if (firstAgent.pairs.length > 0) {
        const [exchange, pair] = firstAgent.pairs[0].split(':');
        setSelectedPair({ exchange, pair });
      }
    }
  }, [agents, selectedPair, initialTarget]);

  const currentExchange = selectedPair?.exchange || 'gate.io';
  const currentPair = selectedPair?.pair || 'KYO-USDT-SPOT';

  const {
    inventoryPnl,
    loading: pnlLoading,
    error,
    lastUpdate,
    refresh,
  } = usePnlData(currentExchange, currentPair);

  const { markout, loading: markoutLoading } = useMarkoutData(currentExchange, currentPair);

  const handleSelectPair = (exchange: string, pair: string) => {
    setSelectedPair({ exchange, pair });
  };

  if (agentsLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading agents...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toolbar (shown when main header is visible) */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {agents && (
            <AgentSelector
              agents={agents.agents}
              selectedPair={selectedPair}
              onSelect={handleSelectPair}
            />
          )}
        </div>
        <div className={styles.toolbarRight}>
          <span className={styles.lastUpdate}>
            {lastUpdate.toLocaleTimeString('ko-KR')}
          </span>
          <button
            className={styles.refreshButton}
            onClick={refresh}
            disabled={pnlLoading}
          >
            <RefreshCw size={16} className={pnlLoading ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      <main className={styles.main}>
        {error && (
          <div className={styles.error}>
            <span>Error: {error}</span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}

        {pnlLoading && !inventoryPnl ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading PnL data...</span>
          </div>
        ) : inventoryPnl ? (
          <div className={styles.content}>
            {/* Summary Cards */}
            <div className={styles.summarySection}>
              <PnlSummary data={inventoryPnl} />
            </div>

            {/* Charts */}
            <div className={styles.chartsSection}>
              <PnlChart
                data={inventoryPnl.data}
                title="PnL Over Time (Cumulative)"
              />
              <PositionChart
                data={inventoryPnl.data}
                title="Position History"
              />
            </div>

            {/* Markout Analysis */}
            {markout && !markoutLoading && (
              <div className={styles.markoutSection}>
                <MarkoutAnalysis data={markout} />
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Background */}
      <div className={styles.bgGlow} />
    </div>
  );
}
