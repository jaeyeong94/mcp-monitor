import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Plus, X, GitCompare } from 'lucide-react';
import { PairComparison } from '../components/PairComparison';
import { useAgents, useMultiPairPnl } from '../hooks/usePnlData';
import styles from './PairComparisonDashboard.module.css';

interface PairComparisonDashboardProps {
  onBack: () => void;
  onSelectPair?: (exchange: string, pair: string) => void;
  hideHeader?: boolean;
}

export function PairComparisonDashboard({ onBack: _onBack, onSelectPair, hideHeader: _hideHeader }: PairComparisonDashboardProps) {
  const { agents, loading: agentsLoading } = useAgents();
  const [selectedPairs, setSelectedPairs] = useState<{ exchange: string; pair: string }[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  // Extract all available pairs from agents
  const availablePairs = useMemo(() => {
    if (!agents) return [];
    const pairs: { exchange: string; pair: string }[] = [];
    for (const agent of agents.agents) {
      for (const pairStr of agent.pairs) {
        const [exchange, pair] = pairStr.split(':');
        if (!pairs.some(p => p.exchange === exchange && p.pair === pair)) {
          pairs.push({ exchange, pair });
        }
      }
    }
    return pairs;
  }, [agents]);

  // Auto-select all pairs on initial load
  useEffect(() => {
    if (availablePairs.length > 0 && selectedPairs.length === 0) {
      setSelectedPairs(availablePairs.slice(0, 10)); // Max 10 pairs initially
    }
  }, [availablePairs, selectedPairs.length]);

  const { data, loading, error, refresh } = useMultiPairPnl(selectedPairs);

  const handleAddPair = (exchange: string, pair: string) => {
    if (!selectedPairs.some(p => p.exchange === exchange && p.pair === pair)) {
      setSelectedPairs([...selectedPairs, { exchange, pair }]);
    }
    setShowSelector(false);
  };

  const handleRemovePair = (exchange: string, pair: string) => {
    setSelectedPairs(selectedPairs.filter(p => !(p.exchange === exchange && p.pair === pair)));
  };

  const unselectedPairs = availablePairs.filter(
    ap => !selectedPairs.some(sp => sp.exchange === ap.exchange && sp.pair === ap.pair)
  );

  if (agentsLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading pairs...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <GitCompare size={18} className={styles.icon} />
          <span className={styles.badge}>
            {selectedPairs.length} pairs selected
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <button
            className={styles.addButton}
            onClick={() => setShowSelector(!showSelector)}
            disabled={unselectedPairs.length === 0}
          >
            <Plus size={16} />
            Add Pair
          </button>
          <button
            className={styles.refreshButton}
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      {/* Pair Selector Dropdown */}
      {showSelector && unselectedPairs.length > 0 && (
        <div className={styles.selectorDropdown}>
          <div className={styles.selectorHeader}>Select pairs to compare</div>
          <div className={styles.selectorList}>
            {unselectedPairs.map(p => (
              <button
                key={`${p.exchange}:${p.pair}`}
                className={styles.selectorItem}
                onClick={() => handleAddPair(p.exchange, p.pair)}
              >
                <span className={styles.selectorPair}>{p.pair}</span>
                <span className={styles.selectorExchange}>{p.exchange}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Pairs Tags */}
      {selectedPairs.length > 0 && (
        <div className={styles.selectedPairs}>
          {selectedPairs.map(p => (
            <span key={`${p.exchange}:${p.pair}`} className={styles.pairTag}>
              {p.pair}
              <button
                className={styles.removeTag}
                onClick={() => handleRemovePair(p.exchange, p.pair)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <main className={styles.main}>
        {error && (
          <div className={styles.error}>
            <span>Error: {error}</span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}

        {loading && !data ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading comparison data...</span>
          </div>
        ) : data ? (
          <PairComparison data={data} onSelectPair={onSelectPair} />
        ) : selectedPairs.length === 0 ? (
          <div className={styles.empty}>
            <span>Select pairs to compare</span>
          </div>
        ) : null}
      </main>

      {/* Background */}
      <div className={styles.bgGlow} />
    </div>
  );
}
