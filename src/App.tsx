import { useState } from 'react';
import { DollarSign, Activity, BarChart3, Zap } from 'lucide-react';
import { PnlDashboard } from './pages/PnlDashboard';
import { AgentDashboard } from './pages/AgentDashboard';
import { PairComparisonDashboard } from './pages/PairComparisonDashboard';
import { Header } from './components/Header';
import { StatsCard } from './components/StatsCard';
import { PriceChart } from './components/PriceChart';
import { VolumeChart } from './components/VolumeChart';
import { ImbalanceChart } from './components/ImbalanceChart';
import { DepthChart } from './components/DepthChart';
import { SpreadChart } from './components/SpreadChart';
import { CVDChart } from './components/CVDChart';
import { MiniOrderbook } from './components/MiniOrderbook';
import { AnomalyAlert } from './components/AnomalyAlert';
import { LargeTradeAlert } from './components/LargeTradeAlert';
import { AggressorFlow } from './components/AggressorFlow';
import { ExportButton } from './components/ExportButton';
import { RegimeIndicator } from './components/RegimeIndicator';
import { RegimeTimeline } from './components/RegimeTimeline';
import { RiskDashboard } from './components/RiskDashboard';
import { useMarketData } from './hooks/useMarketData';
import styles from './App.module.css';

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(decimals) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export default function App() {
  const [view, setView] = useState<'market' | 'pnl' | 'agents' | 'comparison'>('market');
  const [exchange, setExchange] = useState('binance');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [pnlTarget, setPnlTarget] = useState<{ exchange: string; pair: string } | null>(null);

  // Hooks must be called before any conditional returns
  const {
    orderbookSummary,
    tradesSummary,
    anomalies,
    stats,
    loading,
    error,
    lastUpdate,
    dataSource,
    isRefreshing,
    latencyStats,
    refresh,
  } = useMarketData(exchange, symbol, interval);

  // Render shared Header for all views
  const renderHeader = () => (
    <Header
      exchange={exchange}
      symbol={symbol}
      interval={interval}
      lastUpdate={lastUpdate}
      dataSource={dataSource}
      isRefreshing={isRefreshing}
      currentView={view}
      latencyStats={latencyStats}
      onRefresh={refresh}
      onExchangeChange={setExchange}
      onSymbolChange={setSymbol}
      onIntervalChange={setInterval}
      onViewChange={setView}
    />
  );

  // PnL Dashboard view
  if (view === 'pnl') {
    return (
      <div className={styles.app}>
        {renderHeader()}
        <PnlDashboard
          onBack={() => setView('market')}
          initialTarget={pnlTarget}
          hideHeader
        />
        <div className={styles.bgGlow} />
      </div>
    );
  }

  // Agent Dashboard view
  if (view === 'agents') {
    return (
      <div className={styles.app}>
        {renderHeader()}
        <AgentDashboard
          onBack={() => setView('market')}
          onViewPnl={(ex, pair) => {
            setPnlTarget({ exchange: ex, pair });
            setView('pnl');
          }}
          hideHeader
        />
        <div className={styles.bgGlow} />
      </div>
    );
  }

  // Pair Comparison view
  if (view === 'comparison') {
    return (
      <div className={styles.app}>
        {renderHeader()}
        <PairComparisonDashboard
          onBack={() => setView('market')}
          onSelectPair={(ex, pair) => {
            setPnlTarget({ exchange: ex, pair });
            setView('pnl');
          }}
          hideHeader
        />
        <div className={styles.bgGlow} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Loading market data...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.loading}>
        <span style={{ color: '#f85149', marginBottom: '16px' }}>⚠️ Error loading data</span>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>{error || 'No data available'}</span>
        <button 
          onClick={refresh}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#00d9ff',
            border: 'none',
            borderRadius: '6px',
            color: '#000',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {renderHeader()}

      <main className={styles.main}>
        {/* Section Header with Export */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Market Overview</h2>
          <ExportButton
            exchange={exchange}
            symbol={symbol}
            orderbookSummary={orderbookSummary}
            tradesSummary={tradesSummary}
            anomalies={anomalies}
            stats={stats}
          />
        </div>

        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <StatsCard
            label="Current Price"
            value={formatPrice(stats.price.current)}
            change={stats.price.change}
            changePct={stats.price.changePct}
            icon={<DollarSign size={16} />}
            large
          />
          
          <StatsCard
            label="24h Volume"
            value={`${formatNumber(stats.volume.total)} BTC`}
            subValue={`$${formatNumber(stats.volume.notional)}`}
            icon={<BarChart3 size={16} />}
          />
          
          <StatsCard
            label="Avg Spread"
            value={`${stats.spread.mean.toFixed(2)} bps`}
            subValue={`Max: ${stats.spread.max.toFixed(2)} bps`}
            icon={<Activity size={16} />}
            variant={stats.spread.max > 1 ? 'warning' : 'success'}
          />
          
          <StatsCard
            label="Trade Count"
            value={formatNumber(stats.trades.count, 0)}
            subValue={`Avg Size: ${stats.trades.avgSize.toFixed(5)} BTC`}
            icon={<Zap size={16} />}
          />
        </section>

        {/* Main Content Grid */}
        <div className={styles.contentGrid}>
          {/* Left Column - Charts */}
          <div className={styles.chartsColumn}>
            <PriceChart
              data={tradesSummary}
              title={`Price Chart (${interval}) + VWAP`}
              showVwap={true}
              showLargeTrades={true}
              largeTradeThreshold={2.0}
            />

            <VolumeChart
              data={tradesSummary}
              title="Volume (색상: 매수/매도 우세)"
            />

            <CVDChart
              data={tradesSummary}
              title="CVD (Cumulative Volume Delta)"
            />

            <SpreadChart
              data={orderbookSummary}
              title="Spread (bps)"
            />

            <RegimeTimeline
              trades={tradesSummary}
              orderbook={orderbookSummary}
              title="Market Regime Timeline"
            />

            <ImbalanceChart
              data={orderbookSummary}
              title="Orderbook Imbalance"
            />

            <DepthChart
              data={orderbookSummary}
              title="Orderbook Depth"
            />

            <RiskDashboard
              trades={tradesSummary}
              title="Risk Analysis"
            />
          </div>
          
          {/* Right Column - Alerts & Info */}
          <div className={styles.infoColumn}>
            <MiniOrderbook
              data={orderbookSummary}
              midPrice={stats.price.current}
            />

            <AggressorFlow data={tradesSummary} />

            <LargeTradeAlert data={tradesSummary} threshold={2.0} />

            <AnomalyAlert anomalies={anomalies} />

            <RegimeIndicator
              trades={tradesSummary}
              orderbook={orderbookSummary}
            />

            {/* Market Pressure Indicator */}
            <div className={styles.pressureCard}>
              <h3 className={styles.pressureTitle}>Market Pressure</h3>
              <div className={styles.pressureGrid}>
                <div className={styles.pressureItem}>
                  <span className={styles.pressureLabel}>Buy Pressure</span>
                  <div className={styles.pressureBar}>
                    <div 
                      className={styles.pressureFillBuy}
                      style={{ width: `${stats.imbalance.buyPressure}%` }}
                    />
                  </div>
                  <span className={styles.pressureValue}>{stats.imbalance.buyPressure.toFixed(1)}%</span>
                </div>
                <div className={styles.pressureItem}>
                  <span className={styles.pressureLabel}>Sell Pressure</span>
                  <div className={styles.pressureBar}>
                    <div 
                      className={styles.pressureFillSell}
                      style={{ width: `${stats.imbalance.sellPressure}%` }}
                    />
                  </div>
                  <span className={styles.pressureValue}>{stats.imbalance.sellPressure.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Background Glow Effect */}
      <div className={styles.bgGlow} />
    </div>
  );
}

