import styles from './BuySellRatio.module.css';

interface BuySellRatioProps {
  buyRatio: number;
  buyVolume: number;
  sellVolume: number;
}

export function BuySellRatio({ buyRatio, buyVolume, sellVolume }: BuySellRatioProps) {
  const sellRatio = 1 - buyRatio;
  
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Buy/Sell Ratio</h3>
      
      <div className={styles.bar}>
        <div 
          className={styles.buyBar} 
          style={{ width: `${buyRatio * 100}%` }}
        />
        <div 
          className={styles.sellBar} 
          style={{ width: `${sellRatio * 100}%` }}
        />
      </div>
      
      <div className={styles.labels}>
        <div className={styles.buyLabel}>
          <span className={styles.labelDot} style={{ background: 'var(--accent-green)' }} />
          <span className={styles.labelText}>Buy</span>
          <span className={styles.labelValue}>{(buyRatio * 100).toFixed(1)}%</span>
          <span className={styles.labelVolume}>{buyVolume.toFixed(2)} BTC</span>
        </div>
        
        <div className={styles.sellLabel}>
          <span className={styles.labelVolume}>{sellVolume.toFixed(2)} BTC</span>
          <span className={styles.labelValue}>{(sellRatio * 100).toFixed(1)}%</span>
          <span className={styles.labelText}>Sell</span>
          <span className={styles.labelDot} style={{ background: 'var(--accent-red)' }} />
        </div>
      </div>
    </div>
  );
}

