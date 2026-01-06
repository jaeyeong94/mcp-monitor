import { useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { AgentList } from '../components/AgentList';
import { AgentDetail } from '../components/AgentDetail';
import { useAgents } from '../hooks/usePnlData';
import type { MmAgent } from '../types/pnl';
import styles from './AgentDashboard.module.css';

interface AgentDashboardProps {
  onBack: () => void;
  onViewPnl: (exchange: string, pair: string) => void;
  hideHeader?: boolean;
}

export function AgentDashboard({ onBack: _onBack, onViewPnl, hideHeader: _hideHeader }: AgentDashboardProps) {
  const { agents, loading, error, refresh } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<MmAgent | null>(null);

  if (loading && !agents) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading agents...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Users size={18} className={styles.icon} />
          {agents && (
            <span className={styles.badge}>
              {agents.summary.live_agents} / {agents.summary.total_agents} live
            </span>
          )}
        </div>
        <button
          className={styles.refreshButton}
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Content */}
      <main className={styles.main}>
        {error && (
          <div className={styles.error}>
            <span>Error: {error}</span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}

        {agents && (
          <div className={styles.content}>
            <div className={styles.sidebar}>
              <AgentList
                agents={agents.agents}
                onSelectAgent={setSelectedAgent}
                selectedAgentId={selectedAgent?.agent_id}
              />
            </div>

            <div className={styles.detail}>
              {selectedAgent ? (
                <AgentDetail
                  agent={selectedAgent}
                  onViewPnl={onViewPnl}
                />
              ) : (
                <div className={styles.placeholder}>
                  <Users size={48} />
                  <p>Select an agent to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Background */}
      <div className={styles.bgGlow} />
    </div>
  );
}
