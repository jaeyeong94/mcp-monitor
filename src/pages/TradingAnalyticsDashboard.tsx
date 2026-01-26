import { useState } from 'react';
import { Activity, TrendingUp, Shield, Zap, BarChart2, Waves, Target, AlertTriangle, Info, Lightbulb, AlertCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { MetricChart } from '../components/MetricChart';
import { useTradeMetrics, TradeMetrics } from '../hooks/useTradeMetrics';
import type { TradesSummary, OrderbookSummary } from '../types/market';
import { CHART_COLORS } from '../utils/chartUtils';
import styles from './TradingAnalyticsDashboard.module.css';

interface TradingAnalyticsDashboardProps {
  trades: TradesSummary[] | null;
  orderbook: OrderbookSummary[] | null;
  hideHeader?: boolean;
}

type MetricKey = keyof Omit<TradeMetrics, `${string}History`>;

interface MetricInsight {
  definition: string;
  interpretation: string[];
  tradingUse: string[];
  warnings: string[];
}

interface MetricConfig {
  key: MetricKey;
  historyKey: keyof TradeMetrics;
  name: string;
  shortName: string;
  description: string;
  icon: React.ElementType;
  color: string;
  format: (v: number) => string;
  thresholds: { warning: number; danger: number };
  inverse: boolean;
  insights: MetricInsight;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    key: 'dvr',
    historyKey: 'dvrHistory',
    name: 'Depth-to-Volume Ratio',
    shortName: 'DVR',
    description: '호가 물량이 현재 거래량을 감당할 수 있는지 측정',
    icon: Shield,
    color: CHART_COLORS.accent,
    format: (v) => v.toFixed(2),
    thresholds: { warning: 0.5, danger: 0.2 },
    inverse: true,
    insights: {
      definition: 'DVR은 현재 호가창의 유동성(Depth)이 최근 거래량(Volume)을 얼마나 감당할 수 있는지를 나타냅니다. 높을수록 시장이 안정적입니다.',
      interpretation: [
        'DVR > 1.0: 호가 물량이 충분 - 대량 주문에도 가격 충격 적음',
        'DVR 0.5~1.0: 적정 수준 - 일반적인 거래에 문제 없음',
        'DVR < 0.5: 유동성 부족 - 슬리피지 위험 증가',
        'DVR < 0.2: 위험 수준 - 시장 조작 또는 급변동 가능성',
      ],
      tradingUse: [
        '진입/청산 시점 판단: DVR 높을 때 대량 주문 실행',
        '슬리피지 예측: DVR 낮으면 분할 주문 권장',
        '시장 안정성 평가: 급격한 DVR 하락은 변동성 확대 신호',
      ],
      warnings: [
        'DVR이 급락하면 즉시 포지션 크기 축소 고려',
        '뉴스/이벤트 전후로 DVR 급변동 주의',
      ],
    },
  },
  {
    key: 'tii',
    historyKey: 'tiiHistory',
    name: 'Trade Intensity Index',
    shortName: 'TII',
    description: '가격 변동 대비 거래 빈도 - 유동성 품질 지표',
    icon: Zap,
    color: '#39d353',
    format: (v) => v.toFixed(0),
    thresholds: { warning: 50, danger: 20 },
    inverse: true,
    insights: {
      definition: 'TII는 가격 변동(Volatility) 대비 거래 빈도를 측정합니다. 높을수록 적은 가격 변동으로 많은 거래가 이뤄지며, 유동성 품질이 좋다는 의미입니다.',
      interpretation: [
        'TII > 100: 매우 높은 유동성 품질 - 효율적인 가격 발견',
        'TII 50~100: 양호한 수준 - 일반적인 시장 상태',
        'TII < 50: 유동성 품질 저하 - 가격 효율성 의문',
        'TII < 20: 극도로 낮음 - 시장 스트레스 상태',
      ],
      tradingUse: [
        '시장 타이밍: TII 높을 때 진입이 유리 (낮은 실행 비용)',
        '전략 선택: TII 낮으면 추세 추종보다 평균 회귀 전략 유리',
        '리스크 조정: TII 급락 시 포지션 크기 축소',
      ],
      warnings: [
        'TII 급락은 시장 스트레스의 선행 지표',
        '거래량 없이 TII만 높은 경우 유동성 착시 주의',
      ],
    },
  },
  {
    key: 'lambda',
    historyKey: 'lambdaHistory',
    name: "Kyle's Lambda",
    shortName: 'Lambda',
    description: '시장 영향력 계수 - 거래가 가격에 미치는 영향',
    icon: TrendingUp,
    color: '#f0883e',
    format: (v) => v.toFixed(3),
    thresholds: { warning: 1.0, danger: 2.0 },
    inverse: false,
    insights: {
      definition: 'Kyle\'s Lambda는 거래량이 가격에 미치는 영향력을 측정하는 학술적 지표입니다. 낮을수록 시장이 효율적이고, 정보 비대칭이 적습니다.',
      interpretation: [
        'Lambda < 0.5: 매우 효율적 - 거래가 가격에 미치는 영향 최소',
        'Lambda 0.5~1.0: 정상 범위 - 일반적인 시장 마찰',
        'Lambda > 1.0: 높은 시장 충격 - 정보거래자 활동 증가 가능성',
        'Lambda > 2.0: 극단적 - 유동성 위기 또는 정보 비대칭 심각',
      ],
      tradingUse: [
        '실행 전략: Lambda 높으면 TWAP/VWAP 알고리즘 사용 권장',
        '정보거래자 감지: Lambda 급등은 내부자 거래 신호일 수 있음',
        '시장 선택: Lambda 낮은 시장/시간대에 대량 거래 집중',
      ],
      warnings: [
        'Lambda 급등 시 시장 방향성 급변 가능성',
        '개장/마감 시간대에 Lambda 자연 상승 - 맥락 고려 필요',
      ],
    },
  },
  {
    key: 'amihud',
    historyKey: 'amihudHistory',
    name: 'Amihud Illiquidity',
    shortName: 'Amihud',
    description: '비유동성 지표 - 거래대금 대비 가격 변동',
    icon: Activity,
    color: '#a371f7',
    format: (v) => v.toFixed(4),
    thresholds: { warning: 0.5, danger: 1.0 },
    inverse: false,
    insights: {
      definition: 'Amihud 비유동성 지표는 거래대금 1단위당 가격 변동폭을 측정합니다. 높을수록 비유동적이며, 거래 비용이 높다는 의미입니다.',
      interpretation: [
        'Amihud < 0.1: 매우 유동적 - 대형주/주요 페어 수준',
        'Amihud 0.1~0.5: 보통 수준 - 일반적인 암호화폐',
        'Amihud > 0.5: 비유동적 - 높은 거래 비용 예상',
        'Amihud > 1.0: 극단적 비유동성 - 거래 자제 권장',
      ],
      tradingUse: [
        '거래 비용 추정: Amihud × 예상 거래량 = 예상 슬리피지',
        '시장 비교: 여러 거래소의 Amihud 비교로 최적 실행처 선택',
        '리스크 프리미엄: Amihud 높은 자산은 더 높은 기대수익 요구',
      ],
      warnings: [
        'Amihud 급등은 유동성 위기의 핵심 신호',
        '장기 상승 추세는 시장 구조적 문제 시사',
      ],
    },
  },
  {
    key: 'fpi',
    historyKey: 'fpiHistory',
    name: 'Flow Persistence Indicator',
    shortName: 'FPI',
    description: '매수/매도 흐름의 지속성 - 추세 강도 측정',
    icon: Waves,
    color: '#79c0ff',
    format: (v) => (v * 100).toFixed(1) + '%',
    thresholds: { warning: 0.3, danger: 0.5 },
    inverse: false,
    insights: {
      definition: 'FPI는 연속적인 거래가 같은 방향(매수 또는 매도)으로 지속되는 정도를 측정합니다. 높을수록 강한 방향성 압력이 존재합니다.',
      interpretation: [
        'FPI < 10%: 균형 상태 - 매수/매도 교차, 횡보장',
        'FPI 10~30%: 약한 방향성 - 소폭 추세 형성 중',
        'FPI 30~50%: 강한 방향성 - 명확한 추세 진행',
        'FPI > 50%: 극단적 - 일방적 쏠림, 반전 가능성',
      ],
      tradingUse: [
        '추세 확인: FPI 상승 + 가격 방향 일치 = 추세 신뢰도 증가',
        '반전 신호: FPI 극단값 도달 후 하락 = 추세 소진 신호',
        '진입 타이밍: FPI 급등 초기에 추세 방향 진입',
      ],
      warnings: [
        'FPI > 50%는 과열 신호 - 신규 진입보다 이익 실현 고려',
        'FPI와 가격 방향 불일치 시 다이버전스 주의',
      ],
    },
  },
  {
    key: 'vpin',
    historyKey: 'vpinHistory',
    name: 'VPIN',
    shortName: 'VPIN',
    description: '정보거래자 감지 - 매수/매도 불균형 측정',
    icon: Target,
    color: '#f85149',
    format: (v) => (v * 100).toFixed(1) + '%',
    thresholds: { warning: 0.4, danger: 0.6 },
    inverse: false,
    insights: {
      definition: 'VPIN(Volume-Synchronized Probability of Informed Trading)은 거래량 기반으로 정보거래자의 활동 확률을 추정합니다. 높을수록 정보 비대칭이 크고 급변동 위험이 높습니다.',
      interpretation: [
        'VPIN < 20%: 정상 - 균형 잡힌 시장',
        'VPIN 20~40%: 주의 - 정보거래자 활동 증가 감지',
        'VPIN 40~60%: 경고 - 급격한 가격 변동 가능성 높음',
        'VPIN > 60%: 위험 - 대형 뉴스/이벤트 임박 신호',
      ],
      tradingUse: [
        '리스크 관리: VPIN 상승 시 스탑로스 타이트하게 설정',
        '이벤트 감지: 뉴스 발표 전 VPIN 급등 현상 활용',
        '마켓메이킹: VPIN 높으면 스프레드 확대 또는 거래 중단',
      ],
      warnings: [
        'VPIN > 40%는 Flash Crash 선행 지표로 알려져 있음',
        '2010년 Flash Crash 직전 VPIN 급등 사례 참고',
      ],
    },
  },
  {
    key: 'was',
    historyKey: 'wasHistory',
    name: 'Whale Activity Score',
    shortName: 'WAS',
    description: '고래(대형 거래자) 활동 감지 점수',
    icon: BarChart2,
    color: '#d29922',
    format: (v) => (v * 100).toFixed(0) + '%',
    thresholds: { warning: 0.7, danger: 0.85 },
    inverse: false,
    insights: {
      definition: 'WAS는 평균 대비 대형 거래(고래 거래)의 비중과 빈도를 측정합니다. 높을수록 대형 플레이어의 활동이 활발하며, 시장 방향에 큰 영향을 줄 수 있습니다.',
      interpretation: [
        'WAS < 30%: 소매 거래 중심 - 개인 투자자 위주',
        'WAS 30~50%: 혼합 - 기관과 개인 균형',
        'WAS 50~70%: 기관 활발 - 대형 플레이어 주도',
        'WAS > 70%: 고래 집중 - 급격한 가격 변동 가능',
      ],
      tradingUse: [
        '추세 확인: WAS 높고 가격 상승 = 기관 매집 가능성',
        '반전 감지: WAS 급등 + 가격 정체 = 분배(매도) 신호',
        '유동성 예측: WAS 높으면 일시적 유동성 부족 가능',
      ],
      warnings: [
        'WAS 급등은 단기 변동성 확대 신호',
        '고래 활동 직후 유동성 진공 상태 주의',
      ],
    },
  },
  {
    key: 'lsi',
    historyKey: 'lsiHistory',
    name: 'Liquidity Stress Index',
    shortName: 'LSI',
    description: '유동성 스트레스 종합 지수 - 시장 위험도',
    icon: AlertTriangle,
    color: '#ff7b72',
    format: (v) => v.toFixed(2),
    thresholds: { warning: 1.5, danger: 2.0 },
    inverse: false,
    insights: {
      definition: 'LSI는 여러 유동성 지표를 종합하여 현재 시장의 스트레스 수준을 0~3 스케일로 나타냅니다. DVR, Lambda, Amihud, VPIN 등을 가중 평균하여 산출합니다.',
      interpretation: [
        'LSI < 0.5: 건강한 시장 - 유동성 풍부, 안정적',
        'LSI 0.5~1.0: 정상 - 일반적인 시장 상태',
        'LSI 1.0~1.5: 주의 - 스트레스 징후, 모니터링 강화',
        'LSI 1.5~2.0: 경고 - 유동성 악화, 리스크 축소 권장',
        'LSI > 2.0: 위기 - 즉각적인 리스크 관리 필요',
      ],
      tradingUse: [
        '포지션 사이징: LSI에 반비례하여 포지션 크기 조정',
        '전략 전환: LSI > 1.5면 공격적 전략에서 방어적 전략으로',
        '시장 진입/퇴출: LSI 급등 시 신규 진입 자제',
      ],
      warnings: [
        'LSI > 2.0은 시장 패닉의 정량적 신호',
        'LSI 상승 속도가 절대값보다 중요 - 급등에 주목',
        '복합 지표이므로 개별 구성 지표도 함께 확인',
      ],
    },
  },
];

export function TradingAnalyticsDashboard({
  trades,
  orderbook,
  hideHeader: _hideHeader,
}: TradingAnalyticsDashboardProps) {
  const metrics = useTradeMetrics(trades, orderbook);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  if (!metrics) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading metrics...</span>
      </div>
    );
  }

  const selectedConfig = selectedMetric
    ? METRIC_CONFIGS.find((c) => c.key === selectedMetric)
    : null;

  // Calculate overall health score
  const healthScore = METRIC_CONFIGS.reduce((score, config) => {
    const status = metrics[config.key].status;
    return score + (status === 'normal' ? 1 : status === 'warning' ? 0.5 : 0);
  }, 0) / METRIC_CONFIGS.length * 100;

  const healthStatus = healthScore >= 75 ? 'good' : healthScore >= 50 ? 'moderate' : 'poor';

  return (
    <div className={styles.container}>
      {/* Health Score Header */}
      <div className={styles.healthHeader}>
        <div className={styles.healthScore}>
          <div className={`${styles.healthIndicator} ${styles[healthStatus]}`}>
            <span className={styles.healthValue}>{healthScore.toFixed(0)}</span>
            <span className={styles.healthLabel}>Health Score</span>
          </div>
        </div>
        <div className={styles.healthSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryCount}>
              {METRIC_CONFIGS.filter((c) => metrics[c.key].status === 'normal').length}
            </span>
            <span className={styles.summaryLabel}>Normal</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryCount} style={{ color: CHART_COLORS.warning }}>
              {METRIC_CONFIGS.filter((c) => metrics[c.key].status === 'warning').length}
            </span>
            <span className={styles.summaryLabel}>Warning</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryCount} style={{ color: CHART_COLORS.danger }}>
              {METRIC_CONFIGS.filter((c) => metrics[c.key].status === 'danger').length}
            </span>
            <span className={styles.summaryLabel}>Danger</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        {METRIC_CONFIGS.map((config) => (
          <MetricCard
            key={config.key}
            name={config.name}
            shortName={config.shortName}
            description={config.description}
            metric={metrics[config.key]}
            format={config.format}
            thresholds={config.thresholds}
            inverse={config.inverse}
            onClick={() => setSelectedMetric(selectedMetric === config.key ? null : config.key)}
          />
        ))}
      </div>

      {/* Selected Metric Chart */}
      {selectedConfig && (
        <div className={styles.chartSection}>
          <MetricChart
            data={metrics[selectedConfig.historyKey] as { timestamp: string; value: number }[]}
            title={`${selectedConfig.shortName} - ${selectedConfig.name}`}
            color={selectedConfig.color}
            warningThreshold={selectedConfig.thresholds.warning}
            dangerThreshold={selectedConfig.thresholds.danger}
            inverse={selectedConfig.inverse}
            formatValue={selectedConfig.format}
            height={250}
          />
        </div>
      )}

      {/* All Charts Grid with Insights */}
      <div className={styles.chartsGrid}>
        {METRIC_CONFIGS.map((config) => (
          <div key={config.key} className={styles.chartWithInsight}>
            <MetricChart
              data={metrics[config.historyKey] as { timestamp: string; value: number }[]}
              title={config.shortName}
              color={config.color}
              warningThreshold={config.thresholds.warning}
              dangerThreshold={config.thresholds.danger}
              inverse={config.inverse}
              formatValue={config.format}
              height={180}
            />
            <div className={styles.insightSection}>
              <div className={styles.insightHeader}>
                <Info size={14} />
                <span>{config.name}</span>
              </div>
              <p className={styles.insightDefinition}>{config.insights.definition}</p>

              <div className={styles.insightBlock}>
                <div className={styles.insightBlockHeader}>
                  <BarChart2 size={12} />
                  <span>해석 가이드</span>
                </div>
                <ul className={styles.insightList}>
                  {config.insights.interpretation.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.insightBlock}>
                <div className={styles.insightBlockHeader}>
                  <Lightbulb size={12} />
                  <span>트레이딩 활용</span>
                </div>
                <ul className={styles.insightList}>
                  {config.insights.tradingUse.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.insightWarnings}>
                <div className={styles.insightBlockHeader}>
                  <AlertCircle size={12} />
                  <span>주의사항</span>
                </div>
                <ul className={styles.insightList}>
                  {config.insights.warnings.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
