import { Bot, Circle, ExternalLink } from 'lucide-react';
import type { MmAgent } from '../types/pnl';
import styles from './AgentList.module.css';

interface AgentListProps {
  agents: MmAgent[];
  onSelectAgent: (agent: MmAgent) => void;
  selectedAgentId?: string;
}

export function AgentList({ agents, onSelectAgent, selectedAgentId }: AgentListProps) {
  // Group agents by strategy
  const groupedAgents = agents.reduce((acc, agent) => {
    const strategy = agent.strategy_name || 'Unknown';
    if (!acc[strategy]) acc[strategy] = [];
    acc[strategy].push(agent);
    return acc;
  }, {} as Record<string, MmAgent[]>);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Bot size={18} />
        <h3 className={styles.title}>MM Agents</h3>
        <span className={styles.count}>{agents.length} active</span>
      </div>

      <div className={styles.list}>
        {Object.entries(groupedAgents).map(([strategy, strategyAgents]) => (
          <div key={strategy} className={styles.group}>
            <div className={styles.groupHeader}>
              {strategy}
            </div>
            {strategyAgents.map(agent => (
              <button
                key={agent.agent_id}
                className={`${styles.agentItem} ${selectedAgentId === agent.agent_id ? styles.selected : ''}`}
                onClick={() => onSelectAgent(agent)}
              >
                <div className={styles.agentInfo}>
                  <Circle
                    size={8}
                    fill={agent.is_live ? '#3fb950' : '#8b949e'}
                    className={styles.statusDot}
                  />
                  <span className={styles.agentId}>{agent.agent_id}</span>
                </div>
                <div className={styles.agentMeta}>
                  <span className={styles.pairCount}>{agent.pairs.length} pairs</span>
                  <ExternalLink size={12} />
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
