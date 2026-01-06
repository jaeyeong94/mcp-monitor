import { useState } from 'react';
import { Circle, Server, Clock, TrendingUp, ChevronDown, ChevronRight, Settings, Layers, Activity } from 'lucide-react';
import type { MmAgent, PairConfig } from '../types/pnl';
import styles from './AgentDetail.module.css';

interface AgentDetailProps {
  agent: MmAgent;
  onViewPnl: (exchange: string, pair: string) => void;
}

function ConfigSection({ title, icon: Icon, children }: { title: string; icon: typeof Settings; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.configSection}>
      <button className={styles.configToggle} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} />
        <span>{title}</span>
      </button>
      {isOpen && <div className={styles.configContent}>{children}</div>}
    </div>
  );
}

function ConfigValue({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <div className={styles.configRow}>
      <span className={styles.configLabel}>{label}</span>
      <span className={styles.configValue}>
        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(value)}
      </span>
    </div>
  );
}

function PairConfigPanel({ config }: { config: PairConfig }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasConfig = config.spreadModelParameter || config.depthModelParameter || config.volatilityModelParameter;

  if (!hasConfig) return null;

  return (
    <div className={styles.pairConfigContainer}>
      <button className={styles.pairConfigHeader} onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className={styles.pairConfigExchange}>{config.exchange}</span>
        <span className={styles.pairConfigPair}>{config.pairKey}</span>
      </button>

      {isExpanded && (
        <div className={styles.pairConfigBody}>
          {config.spreadModelParameter && (
            <ConfigSection title="Spread Model" icon={Settings}>
              <ConfigValue label="TIF" value={config.spreadModelParameter.tif} />
              <ConfigValue label="Ask TOB" value={config.spreadModelParameter.askTOB} />
              <ConfigValue label="Ask FOB" value={config.spreadModelParameter.askFOB} />
              <ConfigValue label="Bid TOB" value={config.spreadModelParameter.bidTOB} />
              <ConfigValue label="Bid FOB" value={config.spreadModelParameter.bidFOB} />
              <ConfigValue label="Ramp Factor" value={config.spreadModelParameter.rampFactor} />
              <ConfigValue label="Ask Volume Rung" value={config.spreadModelParameter.askVolumeRung} />
              <ConfigValue label="Bid Volume Rung" value={config.spreadModelParameter.bidVolumeRung} />
              <ConfigValue label="Base Position" value={config.spreadModelParameter.basePosition} />
              <ConfigValue label="Max Long Position" value={config.spreadModelParameter.maxLongPosition} />
              <ConfigValue label="Max Short Position" value={config.spreadModelParameter.maxShortPosition} />
            </ConfigSection>
          )}

          {config.depthModelParameter && (
            <ConfigSection title="Depth Model" icon={Layers}>
              <ConfigValue label="Ask Min Quoting $" value={config.depthModelParameter.askMinQuotingValue} />
              <ConfigValue label="Bid Min Quoting $" value={config.depthModelParameter.bidMinQuotingValue} />
              <ConfigValue label="Ask Depth Factor" value={config.depthModelParameter.askDepthFactor} />
              <ConfigValue label="Bid Depth Factor" value={config.depthModelParameter.bidDepthFactor} />
              <ConfigValue label="Auto Mode" value={config.depthModelParameter.usingAutoMode ? 'Yes' : 'No'} />
            </ConfigSection>
          )}

          {config.multiplierParameter && (
            <ConfigSection title="Multipliers" icon={Activity}>
              <ConfigValue label="Ask Multiplier" value={`${config.multiplierParameter.askMultiplier}%`} />
              <ConfigValue label="Bid Multiplier" value={`${config.multiplierParameter.bidMultiplier}%`} />
            </ConfigSection>
          )}

          {config.volatilityModelParameter && (
            <ConfigSection title="Volatility Model" icon={Activity}>
              <ConfigValue label="Lambda" value={config.volatilityModelParameter.lambda} />
              <ConfigValue label="Multiplier" value={config.volatilityModelParameter.multiplier} />
              <ConfigValue label="Update Period (h)" value={config.volatilityModelParameter.updatePeriod} />
              {config.volatilityModelParameter.levels && config.volatilityModelParameter.levels.length > 0 && (
                <div className={styles.levelsContainer}>
                  <span className={styles.levelsTitle}>Levels</span>
                  {config.volatilityModelParameter.levels.map((level, idx) => (
                    <div key={idx} className={styles.volatilityLevel}>
                      <span className={styles.levelBadge}>{level.level || `Level ${idx + 1}`}</span>
                      <div className={styles.levelDetails}>
                        <ConfigValue label="Threshold" value={`${level.threshold}%`} />
                        {level.variables && (
                          <ConfigValue label="Variables" value={level.variables.join(' / ')} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ConfigSection>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentDetail({ agent, onViewPnl }: AgentDetailProps) {
  const updatedAt = new Date(agent.updated_at);
  const timeSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / 1000 / 60);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Circle
            size={10}
            fill={agent.is_live ? '#3fb950' : '#8b949e'}
            stroke="none"
          />
          <h3 className={styles.agentId}>{agent.agent_id}</h3>
        </div>
        <span className={`${styles.status} ${agent.is_live ? styles.live : styles.inactive}`}>
          {agent.is_live ? 'LIVE' : 'INACTIVE'}
        </span>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <Server size={14} />
          <span className={styles.label}>Strategy</span>
          <span className={styles.value}>{agent.strategy_name}</span>
        </div>
        <div className={styles.infoItem}>
          <Server size={14} />
          <span className={styles.label}>Host</span>
          <span className={styles.value}>{agent.host}</span>
        </div>
        <div className={styles.infoItem}>
          <Clock size={14} />
          <span className={styles.label}>Last Update</span>
          <span className={styles.value}>{timeSinceUpdate}m ago</span>
        </div>
      </div>

      <div className={styles.pairsSection}>
        <h4 className={styles.sectionTitle}>Trading Pairs</h4>
        <div className={styles.pairsList}>
          {agent.pairs.map((pairStr, i) => {
            const [exchange, pair] = pairStr.split(':');
            return (
              <div key={i} className={styles.pairItem}>
                <div className={styles.pairInfo}>
                  <span className={styles.exchange}>{exchange}</span>
                  <span className={styles.pair}>{pair}</span>
                </div>
                <button
                  className={styles.pnlButton}
                  onClick={() => onViewPnl(exchange, pair)}
                >
                  <TrendingUp size={12} />
                  PnL
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {agent.pair_configs && agent.pair_configs.length > 0 && (
        <div className={styles.configsSection}>
          <h4 className={styles.sectionTitle}>Configuration</h4>
          <div className={styles.configsList}>
            {agent.pair_configs.map((config, idx) => (
              <PairConfigPanel key={idx} config={config} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
