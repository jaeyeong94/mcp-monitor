import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './StatsCard.module.css';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number;
  changePct?: number;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  large?: boolean;
}

export function StatsCard({ 
  label, 
  value, 
  subValue,
  change,
  changePct,
  icon,
  variant = 'default',
  large = false,
}: StatsCardProps) {
  const isPositive = change !== undefined ? change > 0 : changePct !== undefined ? changePct > 0 : null;
  const isNegative = change !== undefined ? change < 0 : changePct !== undefined ? changePct < 0 : null;
  
  const trendClass = isPositive ? styles.positive : isNegative ? styles.negative : styles.neutral;
  
  return (
    <div className={`${styles.card} ${styles[variant]} ${large ? styles.large : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        
        {(change !== undefined || changePct !== undefined) && (
          <div className={`${styles.change} ${trendClass}`}>
            {isPositive && <TrendingUp size={14} />}
            {isNegative && <TrendingDown size={14} />}
            {!isPositive && !isNegative && <Minus size={14} />}
            <span>
              {change !== undefined && (change > 0 ? '+' : '') + change.toFixed(2)}
              {changePct !== undefined && ` (${(changePct > 0 ? '+' : '') + changePct.toFixed(2)}%)`}
            </span>
          </div>
        )}
      </div>
      
      {subValue && (
        <div className={styles.subValue}>{subValue}</div>
      )}
    </div>
  );
}

