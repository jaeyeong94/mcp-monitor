import { Activity, RefreshCw, Settings, BarChart3, Users, GitCompare, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { LatencyMonitor } from './LatencyMonitor';
import type { LatencyStats } from '../hooks/useLatencyMetrics';
import styles from './Header.module.css';

type ViewType = 'market' | 'pnl' | 'agents' | 'comparison';

interface HeaderProps {
  exchange: string;
  symbol: string;
  interval?: string;
  lastUpdate: Date;
  dataSource?: string;
  isRefreshing?: boolean;
  currentView?: ViewType;
  latencyStats?: LatencyStats;
  onRefresh: () => void;
  onExchangeChange: (exchange: string) => void;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
  onViewChange?: (view: ViewType) => void;
}

const EXCHANGES = ['binance', 'gateio', 'htx', 'kucoin', 'okx'];
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
const INTERVALS = [
  { value: '1m', label: '1분' },
  { value: '5m', label: '5분' },
  { value: '15m', label: '15분' },
];

export function Header({
  exchange,
  symbol,
  interval = '1m',
  lastUpdate,
  dataSource,
  isRefreshing,
  currentView = 'market',
  latencyStats,
  onRefresh,
  onExchangeChange,
  onSymbolChange,
  onIntervalChange,
  onViewChange,
}: HeaderProps) {
  const navItems = [
    { key: 'market' as ViewType, label: 'Market', icon: BarChart3 },
    { key: 'agents' as ViewType, label: 'Agents', icon: Users },
    { key: 'comparison' as ViewType, label: 'Compare', icon: GitCompare },
    { key: 'pnl' as ViewType, label: 'PnL', icon: TrendingUp },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Activity className={styles.logoIcon} />
          <span className={styles.logoText}>MCP Monitor</span>
        </div>

        {onViewChange && (
          <nav className={styles.nav}>
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`${styles.navItem} ${currentView === key ? styles.active : ''}`}
                onClick={() => onViewChange(key)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        {currentView === 'market' && (
          <div className={styles.selectors}>
            <select
              value={exchange}
              onChange={(e) => onExchangeChange(e.target.value)}
              className={styles.select}
            >
              {EXCHANGES.map(ex => (
                <option key={ex} value={ex}>{ex.toUpperCase()}</option>
              ))}
            </select>

            <select
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className={styles.select}
            >
              {SYMBOLS.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>

            {onIntervalChange && (
              <select
                value={interval}
                onChange={(e) => onIntervalChange(e.target.value)}
                className={styles.select}
              >
                {INTERVALS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
      
      <div className={styles.right}>
        {latencyStats && <LatencyMonitor stats={latencyStats} />}

        <div className={styles.status}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>
            {dataSource === 'mcp' ? 'MCP Live' : 'Fallback'}
          </span>
        </div>

        <div className={styles.lastUpdate}>
          Updated: {format(lastUpdate, 'HH:mm:ss')}
        </div>

        <button
          className={`${styles.refreshBtn} ${isRefreshing ? styles.spinning : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} />
        </button>

        <button className={styles.settingsBtn}>
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

