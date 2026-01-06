import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { MmAgent } from '../types/pnl';
import styles from './AgentSelector.module.css';

interface AgentSelectorProps {
  agents: MmAgent[];
  selectedPair: { exchange: string; pair: string } | null;
  onSelect: (exchange: string, pair: string) => void;
}

export function AgentSelector({ agents, selectedPair, onSelect }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract unique exchange:pair combinations
  const pairs = agents.flatMap(agent =>
    agent.pairs.map(p => {
      const [exchange, pair] = p.split(':');
      return { exchange, pair, agentId: agent.agent_id };
    })
  );

  // Group by pair
  const uniquePairs = [...new Map(pairs.map(p => [`${p.exchange}:${p.pair}`, p])).values()];

  const selectedLabel = selectedPair
    ? `${selectedPair.exchange} : ${selectedPair.pair}`
    : 'Select Pair';

  return (
    <div className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bot size={16} />
        <span>{selectedLabel}</span>
        <ChevronDown size={14} className={isOpen ? styles.rotated : ''} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {uniquePairs.map((p, i) => (
            <button
              key={i}
              className={`${styles.option} ${
                selectedPair?.exchange === p.exchange && selectedPair?.pair === p.pair
                  ? styles.selected
                  : ''
              }`}
              onClick={() => {
                onSelect(p.exchange, p.pair);
                setIsOpen(false);
              }}
            >
              <span className={styles.exchange}>{p.exchange}</span>
              <span className={styles.pair}>{p.pair}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
