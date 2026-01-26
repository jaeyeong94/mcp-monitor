# Last Trades 데이터 인사이트 분석

> 이 문서는 거래 체결 데이터(Last Trades)에서 도출할 수 있는 인사이트를 체계적으로 정리합니다.

---

## 1. 데이터 소스 개요

### 1.1 MCP API 도구 매핑

| 도구명 | 데이터 소스 | 주요 용도 | 파라미터 |
|--------|------------|----------|----------|
| `query_recent_trades` | 내부 DB | MM 에이전트 체결 내역 | pair, exchange, limit, side |
| `query_s3_trades` | S3 Parquet | 시장 전체 체결 데이터 | exchange, symbol, start/end_time, side, limit |
| `query_s3_trades_paginated` | S3 Parquet | 대량 체결 데이터 페이징 | exchange, symbol, page, page_size |
| `query_s3_trades_summary` | S3 Parquet | 집계된 OHLCV + 매수/매도 | exchange, symbol, interval |
| `query_maker_taker_volume` | 내부 DB | Maker/Taker 비율 | pair, exchange, interval |
| `query_slippage_analysis` | 내부 DB | 체결가 vs mid_price | pair, exchange, interval |
| `query_markout_analysis` | 내부 DB | 역선택 측정 | pair, exchange, intervals |
| `query_metrics_summary` | 내부 DB | 종합 요약 통계 | pair, exchange |
| `query_pair_metrics` | 내부 DB | 다중 페어 비교 | pairs[], exchange |

### 1.2 데이터 구분

```
┌─────────────────────────────────────────────────────────────────┐
│                    Last Trades 데이터 계층                        │
├─────────────────────────────────────────────────────────────────┤
│  Level 1: Raw Trades (개별 체결)                                  │
│  ├── timestamp, price, quantity, side, is_maker                 │
│  └── 용도: 미시 분석, 대형 체결 감지                               │
├─────────────────────────────────────────────────────────────────┤
│  Level 2: Aggregated Trades (집계 체결)                          │
│  ├── OHLCV, buy_volume, sell_volume, trade_count                │
│  └── 용도: 추세 분석, 시계열 차트                                  │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: Derived Metrics (파생 지표)                            │
│  ├── slippage, markout, maker_ratio, CVD                        │
│  └── 용도: 전략 평가, 비용 분석                                    │
├─────────────────────────────────────────────────────────────────┤
│  Level 4: Composite Insights (복합 인사이트)                      │
│  ├── 체결 품질 스코어, 시장 영향력, 최적 타이밍                     │
│  └── 용도: 의사결정 지원, 전략 최적화                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 기본 인사이트 (Level 1-2)

### 2.1 가격 동향 분석

| 지표 | 계산 방법 | 인사이트 |
|------|----------|----------|
| VWAP | Σ(price × volume) / Σvolume | 평균 체결가 - 실행 품질 벤치마크 |
| Price Change % | (close - open) / open × 100 | 기간 내 가격 변동률 |
| High-Low Range | high - low | 변동성 프록시 |
| Close vs VWAP | (close - vwap) / vwap × 100 | 종가 위치 - 방향성 힌트 |

### 2.2 거래량 분석

| 지표 | 계산 방법 | 인사이트 |
|------|----------|----------|
| Total Volume | Σ quantity | 유동성 수준 |
| Buy Ratio | buy_volume / total_volume | 매수 압력 (>0.5 = 강세) |
| Net Volume (CVD) | buy_volume - sell_volume | 누적 순매수 |
| Trade Intensity | trade_count / time_period | 거래 빈도 |
| Avg Trade Size | total_volume / trade_count | 평균 체결 규모 |

### 2.3 시간대별 패턴

```
시간대별 분석 지표:
├── Volume Profile: 시간대별 거래량 분포
├── Spread Profile: 시간대별 스프레드 분포
├── Activity Score: 거래 빈도 × 거래량
└── 최적 시간대 = 높은 Volume + 낮은 Spread
```

---

## 3. 파생 인사이트 (Level 3)

### 3.1 체결 비용 분석 (Trading Cost)

#### 3.1.1 슬리피지 (Slippage)

```
정의: 체결가와 mid_price의 차이

계산:
  slippage_bps = (exec_price - mid_price) / mid_price × 10000

해석:
  - Buy 양수: 불리 (mid보다 비싸게 매수)
  - Buy 음수: 유리 (mid보다 싸게 매수)
  - Sell: 부호 반전하여 해석

분해:
  Total Slippage = Market Impact + Timing Cost + Spread Cost
```

#### 3.1.2 Maker/Taker 비용

```
Maker Fee: 일반적으로 낮음 (0-0.02%)
Taker Fee: 일반적으로 높음 (0.04-0.1%)

비용 계산:
  Total Fee Cost = (maker_volume × maker_fee) + (taker_volume × taker_fee)

목표:
  Maker Ratio > 70% → 수수료 최적화
```

#### 3.1.3 총 거래 비용 (Total Trading Cost)

```
TTC = Slippage Cost + Fee Cost + Adverse Selection Cost

where:
  Slippage Cost = avg_slippage_bps × total_notional / 10000
  Fee Cost = maker_fee × maker_notional + taker_fee × taker_notional
  Adverse Selection = markout_loss (음수 markout의 합)
```

### 3.2 역선택 분석 (Adverse Selection)

#### 3.2.1 Markout 분석

```
정의: 체결 후 일정 시간 뒤 가격 변화

계산:
  Buy Markout = (future_mid - exec_price) / exec_price × 10000 (bps)
  Sell Markout = (exec_price - future_mid) / exec_price × 10000 (bps)

해석:
  양수: 유리한 체결 (가격이 내 방향으로 움직임)
  음수: 불리한 체결 (역선택 - 정보거래자에게 당함)

시간 간격별 의미:
  1초: 마이크로 구조 / HFT 문제
  5초: 단기 모멘텀 역선택
  30초: 중기 정보 비대칭
  60초: 장기 방향성 역선택
```

#### 3.2.2 Toxic Flow 감지

```
Toxic Flow 지표:
  - 연속 음수 markout (3회 이상)
  - 대형 체결 후 급격한 가격 이동
  - 특정 시간대 집중된 역선택

대응:
  - 스프레드 확대
  - 호가 수량 축소
  - 해당 시간대 회피
```

### 3.3 시장 영향력 분석 (Market Impact)

```
정의: 우리 거래가 시장 가격에 미치는 영향

측정:
  Impact = (post_trade_price - pre_trade_price) / pre_trade_price

요인:
  - 주문 크기 (size)
  - 시장 유동성 (liquidity)
  - 주문 긴급성 (urgency)
  - 정보 비대칭 (information)

Square-Root Model:
  Impact ≈ σ × √(Q / ADV)
  where σ = 변동성, Q = 주문량, ADV = 일평균거래량
```

---

## 4. 복합 인사이트 (Level 4)

### 4.1 체결 품질 스코어 (Execution Quality Score)

```
EQS = w1 × Slippage_Score + w2 × Markout_Score + w3 × Maker_Score + w4 × Speed_Score

where:
  Slippage_Score = normalize(avg_slippage, lower_is_better)
  Markout_Score = normalize(avg_markout, higher_is_better)
  Maker_Score = maker_ratio × 100
  Speed_Score = normalize(fill_rate, higher_is_better)

가중치 예시:
  w1 = 0.3 (슬리피지)
  w2 = 0.3 (마크아웃)
  w3 = 0.25 (메이커 비율)
  w4 = 0.15 (체결 속도)
```

### 4.2 유동성 품질 지표 (Liquidity Quality Index)

```
LQI = f(Spread, Depth, Resilience, Trade_Activity)

구성요소:
  1. Tightness: 평균 스프레드 (낮을수록 좋음)
  2. Depth: 호가 물량 (높을수록 좋음)
  3. Resilience: 충격 후 회복 속도 (빠를수록 좋음)
  4. Activity: 거래 빈도 (적당히 높을수록 좋음)

계산:
  LQI = α/spread + β×depth + γ×resilience + δ×activity
```

### 4.3 정보 비대칭 지표 (Information Asymmetry Index)

```
IAI = |Markout_1s| + |Markout_5s| × 0.5 + |Markout_30s| × 0.25

해석:
  IAI < 5 bps: 낮은 정보 비대칭 (안전)
  IAI 5-15 bps: 중간 수준
  IAI > 15 bps: 높은 정보 비대칭 (위험)

대응 전략:
  높은 IAI → 스프레드 확대, 호가량 축소, 비대칭 호가
```

---

## 5. 크로스 분석 인사이트

### 5.1 가격-거래량 관계

```
Volume-Price Analysis:
┌─────────────┬──────────────┬─────────────────────────────┐
│ 가격 변화    │ 거래량 변화   │ 해석                         │
├─────────────┼──────────────┼─────────────────────────────┤
│ ↑ 상승      │ ↑ 증가       │ 강한 상승 추세 (확인)          │
│ ↑ 상승      │ ↓ 감소       │ 약한 상승 (조정 가능성)        │
│ ↓ 하락      │ ↑ 증가       │ 강한 하락 추세 (패닉 가능)     │
│ ↓ 하락      │ ↓ 감소       │ 약한 하락 (바닥 근접)          │
└─────────────┴──────────────┴─────────────────────────────┘
```

### 5.2 스프레드-거래량 관계

```
Spread-Volume Analysis:
- 거래량 ↑ + 스프레드 ↓ = 건강한 유동성
- 거래량 ↑ + 스프레드 ↑ = 변동성 증가 / 스트레스
- 거래량 ↓ + 스프레드 ↑ = 유동성 고갈 (위험)
- 거래량 ↓ + 스프레드 ↓ = 저활동 구간 (관망)
```

### 5.3 Buy Ratio-Markout 관계

```
Flow-Markout Analysis:
┌───────────────┬──────────────┬─────────────────────────────┐
│ Buy Ratio     │ Markout      │ 해석                         │
├───────────────┼──────────────┼─────────────────────────────┤
│ > 0.6 (매수)  │ 양수         │ 추세 추종 성공                │
│ > 0.6 (매수)  │ 음수         │ 늦은 진입 / 고점 매수         │
│ < 0.4 (매도)  │ 양수         │ 추세 추종 성공                │
│ < 0.4 (매도)  │ 음수         │ 늦은 청산 / 저점 매도         │
│ 0.4-0.6      │ -            │ 균형 상태                     │
└───────────────┴──────────────┴─────────────────────────────┘
```

### 5.4 Maker Ratio-Slippage 관계

```
Maker-Slippage Analysis:
┌───────────────┬──────────────┬─────────────────────────────┐
│ Maker Ratio   │ Slippage     │ 진단                         │
├───────────────┼──────────────┼─────────────────────────────┤
│ 높음 (>70%)   │ 낮음         │ 최적 상태                     │
│ 높음 (>70%)   │ 높음         │ 호가 위치 문제 (가격 설정)    │
│ 낮음 (<50%)   │ 낮음         │ 긴급 주문이지만 효율적        │
│ 낮음 (<50%)   │ 높음         │ 긴급 + 비효율 (개선 필요)     │
└───────────────┴──────────────┴─────────────────────────────┘
```

---

## 6. 실시간 모니터링 지표

### 6.1 알림 트리거 조건

```yaml
alerts:
  # 대형 체결 감지
  large_trade:
    condition: size > avg_size * 10
    action: "고래 활동 감지"

  # 거래량 급증
  volume_spike:
    condition: volume_1m > ma_volume_1h * 3
    action: "거래량 이상 급증"

  # 스프레드 급등
  spread_spike:
    condition: spread > ma_spread * 5
    action: "유동성 스트레스"

  # 연속 역선택
  consecutive_adverse:
    condition: markout < 0 for 5 consecutive trades
    action: "Toxic Flow 의심"

  # CVD 급변
  cvd_extreme:
    condition: |cvd_change_1m| > threshold
    action: "강한 방향성 압력"
```

### 6.2 실시간 대시보드 지표

```
┌─────────────────────────────────────────────────────────────┐
│  REAL-TIME METRICS                                          │
├─────────────────────────────────────────────────────────────┤
│  Price         │ $0.02456 (+2.3%)    │ VWAP: $0.02441       │
│  Volume (1h)   │ 1.2M tokens         │ Buy Ratio: 58%       │
│  Trade Count   │ 3,847               │ Avg Size: 312        │
├─────────────────────────────────────────────────────────────┤
│  Spread        │ 2.3 bps             │ Depth: $45K          │
│  Maker Ratio   │ 72%                 │ Fill Rate: 94%       │
├─────────────────────────────────────────────────────────────┤
│  Markout 1s    │ +0.5 bps            │ Slippage: 1.2 bps    │
│  Markout 60s   │ -2.1 bps            │ EQ Score: 78/100     │
├─────────────────────────────────────────────────────────────┤
│  CVD           │ ████████░░ +180K    │ Trend: BULLISH       │
│  Flow Toxicity │ ██░░░░░░░░ LOW      │ Info Asymmetry: 4bps │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 전략 최적화 인사이트

### 7.1 최적 거래 시간대 식별

```
Score(hour) = w1 × Volume(hour)
            + w2 × (1/Spread(hour))
            + w3 × Maker_Ratio(hour)
            - w4 × Adverse_Selection(hour)

최적 시간대 = argmax(Score)
```

### 7.2 동적 파라미터 조정

```python
# 의사 코드: 시장 상황별 파라미터 조정
def adjust_parameters(market_state):
    if market_state.volatility > HIGH:
        spread_multiplier *= 1.5
        quoting_size *= 0.7

    if market_state.adverse_selection > THRESHOLD:
        spread_multiplier *= 1.3
        skew_adjustment = True

    if market_state.liquidity < LOW:
        quoting_size *= 0.5
        min_spread_from_mid *= 1.5
```

### 7.3 페어별 특성 프로파일

```
Pair Profile Template:
┌─────────────────────────────────────────────────────────────┐
│  PAIR: KYO-USDT-SPOT @ gate.io                              │
├─────────────────────────────────────────────────────────────┤
│  유동성 등급      │ B+ (중상)                                │
│  평균 스프레드    │ 3.2 bps                                  │
│  일평균 거래량    │ $2.1M                                    │
│  변동성 (일)     │ 8.5%                                     │
├─────────────────────────────────────────────────────────────┤
│  최적 시간대      │ 09:00-11:00 KST, 21:00-23:00 KST        │
│  회피 시간대      │ 04:00-06:00 KST (저유동성)              │
├─────────────────────────────────────────────────────────────┤
│  추천 전략        │                                          │
│  - Spread: 4-6 bps                                          │
│  - Quote Size: $500-1000                                    │
│  - Maker Target: 75%+                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 구현 로드맵

### Phase 1: 기본 지표 (현재 구현됨)
- [x] OHLCV 차트
- [x] 거래량 / CVD
- [x] Buy Ratio
- [x] Markout Analysis

### Phase 2: 체결 품질 (구현 필요)
- [ ] Maker/Taker 비율 대시보드
- [ ] 슬리피지 분석 패널
- [ ] 총 거래 비용 계산기

### Phase 3: 고급 분석 (향후)
- [ ] 체결 품질 스코어 (EQS)
- [ ] 정보 비대칭 지표 (IAI)
- [ ] 대형 체결 알림

### Phase 4: 최적화 도구 (향후)
- [ ] 최적 시간대 추천
- [ ] 동적 파라미터 제안
- [ ] 페어별 프로파일 자동 생성

---

## 9. 참고 자료

### 9.1 용어 정의

| 용어 | 정의 |
|------|------|
| VWAP | Volume Weighted Average Price - 거래량 가중 평균가 |
| CVD | Cumulative Volume Delta - 누적 순매수 거래량 |
| Markout | 체결 후 일정 시간 뒤 가격 변화 측정 |
| Slippage | 의도한 가격과 실제 체결가의 차이 |
| Adverse Selection | 역선택 - 정보 비대칭으로 인한 손실 |
| Maker | 유동성 공급자 (지정가 주문) |
| Taker | 유동성 소비자 (시장가/크로싱 주문) |
| Toxic Flow | 정보거래자의 주문 흐름 |

### 9.2 관련 API 엔드포인트

```
GET /api/market-data          - 시장 데이터 (현재)
GET /api/pnl/recent          - 최근 PnL
GET /api/markout             - 마크아웃 분석
GET /api/agents              - 에이전트 목록

[추가 필요]
GET /api/trades/recent       - 최근 체결 내역
GET /api/trades/maker-taker  - Maker/Taker 분석
GET /api/trades/slippage     - 슬리피지 분석
GET /api/trades/quality      - 체결 품질 스코어
```

---

## 10. 실제 데이터 기반 고급 인사이트

> 이 섹션은 실제 MCP API 데이터 분석에서 도출된 유니크한 인사이트입니다.

### 10.1 Volume Spike 패턴 분석

#### 발견된 패턴 (Binance BTCUSDT 2026-01-23 09:00-10:00 KST)

```
Volume Spike Events:
┌──────────────────┬──────────────┬─────────┬───────────────────────────────┐
│ Timestamp        │ Volume (BTC) │ Z-Score │ 특징                           │
├──────────────────┼──────────────┼─────────┼───────────────────────────────┤
│ 09:19 KST        │ 42.17        │ 6.22    │ 평균의 11배, Buy Ratio 5.1%   │
│ 09:59 KST        │ 20.61        │ 2.73    │ 평균의 5배, Buy Ratio 10.2%   │
└──────────────────┴──────────────┴─────────┴───────────────────────────────┘

인사이트:
- 두 스파이크 모두 극단적 매도 (buy_ratio < 11%)
- 이후 가격 하락 (89,630 → 89,520)
- 대형 매도 물량 = 정보거래자 또는 청산 가능성
```

#### Volume Spike 분류 체계

```python
def classify_volume_spike(spike):
    """Volume Spike 유형 분류"""

    if spike.z_score > 5:
        intensity = "EXTREME"
    elif spike.z_score > 3:
        intensity = "HIGH"
    else:
        intensity = "MODERATE"

    if spike.buy_ratio > 0.7:
        direction = "AGGRESSIVE_BUY"
        signal = "BULLISH"
    elif spike.buy_ratio < 0.3:
        direction = "AGGRESSIVE_SELL"
        signal = "BEARISH"
    else:
        direction = "MIXED"
        signal = "NEUTRAL"

    # 복합 해석
    if intensity == "EXTREME" and direction == "AGGRESSIVE_SELL":
        return "PANIC_SELL / LARGE_LIQUIDATION"
    elif intensity == "EXTREME" and direction == "AGGRESSIVE_BUY":
        return "FOMO / SHORT_SQUEEZE"
    elif intensity == "HIGH" and direction != "MIXED":
        return "INSTITUTIONAL_FLOW"
    else:
        return "RETAIL_ACTIVITY"
```

### 10.2 Orderbook-Trades 상관 분석

#### Imbalance-Flow 매트릭스

```
┌─────────────────────────────────────────────────────────────────────────┐
│         ORDERBOOK-TRADES CORRELATION MATRIX                              │
├─────────────────────────────────────────────────────────────────────────┤
│                    │ OB Imbalance > 0    │ OB Imbalance < 0              │
│                    │ (Bid Heavy)         │ (Ask Heavy)                   │
├────────────────────┼─────────────────────┼───────────────────────────────┤
│ Trade Buy Ratio    │ CONFIRMATION        │ ABSORPTION                    │
│ > 0.55             │ 매수 지속 가능       │ 저항대 테스트 중               │
│ (Buy Dominant)     │ → Long 유지         │ → 돌파 또는 반전 대기          │
├────────────────────┼─────────────────────┼───────────────────────────────┤
│ Trade Buy Ratio    │ HIDDEN SUPPLY       │ CONFIRMATION                  │
│ < 0.45             │ 지지대 테스트 중      │ 매도 지속 가능                │
│ (Sell Dominant)    │ → 지지 또는 붕괴 대기 │ → Short 유지                 │
├────────────────────┼─────────────────────┼───────────────────────────────┤
│ Trade Buy Ratio    │ ACCUMULATION        │ DISTRIBUTION                  │
│ 0.45-0.55          │ 조용한 매집          │ 조용한 매도                   │
│ (Balanced)         │ → 추후 상승 가능     │ → 추후 하락 가능              │
└────────────────────┴─────────────────────┴───────────────────────────────┘
```

#### 실제 데이터 예시

```
09:03 KST 분석:
- OB Imbalance: -0.34 (Ask Heavy)
- Trade Buy Ratio: 0.18 (Strong Sell)
- 결론: CONFIRMATION (매도 지속)
- 실제 결과: 가격 하락 (89,512 → 89,497)

09:17 KST 분석:
- OB Imbalance: +0.13 (Bid Heavy)
- Trade Buy Ratio: 0.97 (Extreme Buy)
- 결론: CONFIRMATION (매수 지속)
- 실제 결과: 가격 상승 (89,550 → 89,605)
```

### 10.3 Depth-Volume 비율 지표 (DVR)

```
정의: Depth-to-Volume Ratio
DVR = (avg_bid_depth + avg_ask_depth) / volume_per_minute

해석:
- DVR > 1.0: 충분한 유동성 (안정적)
- DVR 0.5-1.0: 적정 유동성
- DVR < 0.5: 유동성 부족 (변동성 위험)
- DVR < 0.2: 위험 구간 (스프레드 확대 권장)

계산 예시 (09:00 KST):
  bid_depth = 2.68 BTC
  ask_depth = 4.67 BTC
  volume = 5.83 BTC
  DVR = (2.68 + 4.67) / 5.83 = 1.26 ✓ 안정적
```

### 10.4 Trade Intensity Index (TII)

```
정의: 단위 가격 변화당 거래량

TII = trade_count / |price_change_bps|

해석:
- 높은 TII + 작은 가격 변화 = 유동성 풍부 (거래 용이)
- 낮은 TII + 큰 가격 변화 = 유동성 부족 (주의)
- 급격히 낮아지는 TII = 시장 스트레스 신호

계산 예시:
  09:02: trade_count=1734, price_change=-30bps
  TII = 1734 / 30 = 57.8

  09:19: trade_count=2781, price_change=-5bps (스파이크 후)
  TII = 2781 / 5 = 556.2 (높은 유동성 흡수)
```

### 10.5 Flow Persistence Indicator (FPI)

```
정의: 거래 흐름의 지속성 측정

계산:
1. 연속된 동일 방향 (buy_ratio > 0.5 또는 < 0.5) 분 카운트
2. 해당 기간의 누적 순거래량

FPI = (consecutive_minutes × cumulative_net_volume) / total_volume

해석:
- FPI > 0.3: 강한 추세 (추세 추종 유리)
- FPI 0.1-0.3: 중간 추세
- FPI < 0.1: 약한 추세 / 횡보 (마켓메이킹 유리)

활용:
- 높은 FPI: 스프레드 축소, 추세 방향 편향
- 낮은 FPI: 스프레드 유지, 양방향 호가
```

---

## 11. 유니크 복합 지표

### 11.1 Market Regime Detector

```python
def detect_market_regime(data):
    """
    시장 레짐 자동 감지

    Returns: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE
    """

    # 지표 계산
    price_change = (data.close - data.open) / data.open
    volatility = (data.high - data.low) / data.open
    volume_ratio = data.volume / data.ma_volume_20
    buy_ratio = data.buy_volume / data.total_volume
    spread_expansion = data.spread / data.ma_spread_20

    # 레짐 분류
    if abs(price_change) > 0.01 and volume_ratio > 1.5:
        if price_change > 0:
            return "TRENDING_UP"
        else:
            return "TRENDING_DOWN"

    elif volatility > 0.02 and spread_expansion > 2:
        return "VOLATILE"

    else:
        return "RANGING"
```

### 11.2 Whale Activity Score (WAS)

```
목적: 대형 거래자 활동 감지

계산:
1. large_trade_ratio = Σ(trades > 10x avg) / total_volume
2. concentration_score = HHI of trade sizes
3. timing_pattern = variance of large trade timestamps

WAS = 0.5 × large_trade_ratio
    + 0.3 × concentration_score
    + 0.2 × (1 / timing_pattern)

해석:
- WAS > 0.7: 높은 고래 활동 (주의 필요)
- WAS 0.4-0.7: 중간 수준
- WAS < 0.4: 주로 소매 거래
```

### 11.3 Liquidity Stress Index (LSI)

```
목적: 유동성 스트레스 수준 측정

구성요소:
1. spread_deviation = current_spread / ma_spread
2. depth_depletion = 1 - (current_depth / ma_depth)
3. trade_urgency = taker_ratio / historical_taker_ratio
4. price_volatility = current_volatility / ma_volatility

LSI = w1×spread_deviation + w2×depth_depletion
    + w3×trade_urgency + w4×price_volatility

where w1=0.3, w2=0.3, w3=0.2, w4=0.2

해석:
- LSI < 1.0: 정상 상태
- LSI 1.0-1.5: 경미한 스트레스
- LSI 1.5-2.0: 중간 스트레스 (스프레드 확대 권장)
- LSI > 2.0: 심각한 스트레스 (호가 철회 고려)
```

### 11.4 Predictive Fill Rate (PFR)

```
목적: 호가 체결 확률 예측

요인:
1. distance_from_mid: 호가와 mid_price의 거리 (bps)
2. orderbook_imbalance: 해당 방향의 압력
3. recent_trade_flow: 최근 거래 방향
4. volatility_state: 현재 변동성 수준

모델:
PFR(bid) = σ(β0 + β1×distance + β2×imbalance + β3×sell_flow + β4×volatility)
PFR(ask) = σ(β0 + β1×distance + β2×imbalance + β3×buy_flow + β4×volatility)

활용:
- PFR > 80%: 공격적 호가 위치
- PFR 50-80%: 적정 호가 위치
- PFR < 50%: 보수적 호가 위치 (체결 느림)
```

---

## 12. 실행 가능한 트레이딩 시그널

### 12.1 Entry/Exit Signal Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRADING SIGNAL DECISION MATRIX                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Signal Type       │ Condition                │ Action                   │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ STRONG_BUY        │ buy_ratio>0.7 AND        │ Increase bid size        │
│                   │ CVD rising AND           │ Reduce ask size          │
│                   │ imbalance>0.3            │ Tighten bid spread       │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ STRONG_SELL       │ buy_ratio<0.3 AND        │ Reduce bid size          │
│                   │ CVD falling AND          │ Increase ask size        │
│                   │ imbalance<-0.3           │ Tighten ask spread       │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ STRESS_ALERT      │ LSI>1.5 OR               │ Widen spreads            │
│                   │ spread_spike OR          │ Reduce sizes             │
│                   │ depth_depletion>50%      │ Consider pulling quotes  │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ WHALE_ALERT       │ WAS>0.7 OR               │ Monitor closely          │
│                   │ single_trade>10x_avg     │ Prepare to adjust        │
│                   │                          │ Follow whale direction   │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ REGIME_CHANGE     │ volatility_spike OR      │ Re-evaluate parameters   │
│                   │ volume_regime_shift OR   │ Wait for stabilization   │
│                   │ spread_regime_shift      │ Reduce exposure          │
└───────────────────┴──────────────────────────┴──────────────────────────┘
```

### 12.2 Dynamic Parameter Adjustment Rules

```yaml
parameter_rules:
  spread_adjustment:
    increase_by_20%:
      - condition: "LSI > 1.5"
      - condition: "consecutive_adverse_markout >= 3"
      - condition: "volatility > 2x_historical"

    decrease_by_10%:
      - condition: "LSI < 0.8 AND maker_ratio > 0.8"
      - condition: "spread > competitor_spread * 1.5"

  size_adjustment:
    reduce_by_50%:
      - condition: "LSI > 2.0"
      - condition: "WAS > 0.8"
      - condition: "depth_depletion > 60%"

    increase_by_30%:
      - condition: "maker_ratio > 0.9 AND LSI < 1.0"
      - condition: "FPI < 0.1 (ranging market)"

  skew_adjustment:
    skew_towards_buy:
      - condition: "CVD_trend = positive AND imbalance > 0.2"

    skew_towards_sell:
      - condition: "CVD_trend = negative AND imbalance < -0.2"
```

### 12.3 Risk Management Triggers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RISK MANAGEMENT TRIGGERS                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Level   │ Trigger Condition              │ Action                       │
├─────────┼────────────────────────────────┼──────────────────────────────┤
│ LEVEL 1 │ Unrealized PnL < -$X           │ Alert only                   │
│ (Watch) │ OR markout_60s < -5bps         │ Increase monitoring          │
├─────────┼────────────────────────────────┼──────────────────────────────┤
│ LEVEL 2 │ Unrealized PnL < -$2X          │ Reduce quote sizes by 50%    │
│ (Caution)│ OR LSI > 2.0                  │ Widen spreads by 30%         │
├─────────┼────────────────────────────────┼──────────────────────────────┤
│ LEVEL 3 │ Unrealized PnL < -$3X          │ Pull all quotes              │
│ (Danger)│ OR consecutive_losses > 5      │ Manual review required       │
│         │ OR extreme_market_event        │                              │
└─────────┴────────────────────────────────┴──────────────────────────────┘
```

---

## 13. 시간대별 최적화 가이드

### 13.1 암호화폐 시장 시간대 특성

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    24H CRYPTO MARKET CHARACTERISTICS (KST)              │
├─────────────────────────────────────────────────────────────────────────┤
│ Time (KST)  │ Characteristic          │ Strategy Recommendation        │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 00:00-04:00 │ US Market Active        │ Tight spreads, high volume     │
│             │ High volatility         │ Active trading                 │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 04:00-08:00 │ Low liquidity           │ Wider spreads                  │
│             │ Dead zone               │ Reduced sizes                  │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 08:00-12:00 │ Asia opening            │ Moderate activity              │
│             │ Korea/Japan active      │ Normal parameters              │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 12:00-16:00 │ Asia mid-day            │ Moderate activity              │
│             │ Europe preparing        │ Normal parameters              │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 16:00-20:00 │ Europe active           │ Increasing volume              │
│             │ Asia closing            │ Tight spreads                  │
├─────────────┼─────────────────────────┼─────────────────────────────────┤
│ 20:00-24:00 │ US + Europe overlap     │ Highest liquidity              │
│             │ Peak volatility         │ Most active trading            │
└─────────────┴─────────────────────────┴─────────────────────────────────┘
```

### 13.2 이벤트 기반 조정

```yaml
event_based_adjustment:
  scheduled_events:
    - type: "FOMC_meeting"
      pre_event: "reduce_size_50%, widen_spread_30%"
      during: "pause_quoting"
      post_event: "gradual_return_over_5min"

    - type: "major_coin_unlock"
      pre_event: "monitor_whale_activity"
      during: "widen_spread_20%"

    - type: "funding_rate_settlement"
      pre_event: "check_funding_rate_direction"
      during: "adjust_skew_accordingly"

  unscheduled_events:
    - type: "exchange_outage"
      action: "pause_quoting_on_affected_exchange"

    - type: "price_flash_crash"
      action: "immediate_quote_pull, wait_for_stability"

    - type: "news_event"
      action: "widen_spread_50%, reduce_size_70%"
```

---

## 14. 학술 기반 고급 지표

> 시장 미시구조 이론에서 파생된 학술적 지표들입니다.

### 14.1 VPIN (Volume-Synchronized Probability of Informed Trading)

```
목적: 정보거래자 활동 확률 측정 (Flow Toxicity)

정의:
VPIN = Σ|V_buy - V_sell| / V_total

계산 방식:
1. 동일 거래량 버킷으로 데이터 분할 (예: 10,000 USDT씩)
2. 각 버킷에서 |매수량 - 매도량| 계산
3. 최근 N개 버킷의 평균

해석:
- VPIN < 0.2: 낮은 독성 (안전)
- VPIN 0.2-0.4: 중간 수준
- VPIN > 0.4: 높은 독성 (스프레드 확대 권장)

활용:
- Flash Crash 예측
- 실시간 스프레드 조정
- 역선택 비용 추정
```

```python
def calculate_vpin(trades, bucket_size_usd=10000, n_buckets=50):
    """VPIN 계산"""
    buckets = []
    current_notional = 0
    buy_notional = 0
    sell_notional = 0

    for trade in trades:
        notional = trade.price * trade.quantity
        if trade.side == 'buy':
            buy_notional += notional
        else:
            sell_notional += notional
        current_notional += notional

        if current_notional >= bucket_size_usd:
            imbalance = abs(buy_notional - sell_notional) / current_notional
            buckets.append(imbalance)
            current_notional = buy_notional = sell_notional = 0

    return sum(buckets[-n_buckets:]) / min(len(buckets), n_buckets)
```

### 14.2 Kyle's Lambda (가격 영향 계수)

```
목적: 단위 주문 흐름당 가격 영향 측정

정의:
λ = ΔP / V_net

where:
- ΔP = 가격 변화
- V_net = 순 주문 흐름 (signed volume)

추정 방법: OLS 회귀
Price_Change = λ × Signed_Volume + ε

해석:
- 높은 λ: 낮은 유동성, 높은 가격 영향
- 낮은 λ: 높은 유동성, 낮은 가격 영향

활용:
- 시장 영향 비용 추정
- 최적 주문 크기 결정
- 유동성 비교
```

### 14.3 Amihud Illiquidity Measure

```
목적: 거래량 대비 가격 영향 측정

정의:
ILLIQ = (1/N) × Σ(|R_t| / V_t)

where:
- R_t = 기간 t의 수익률
- V_t = 기간 t의 거래량 (USD)
- N = 기간 수

암호화폐 적용 (시간별):
ILLIQ_crypto = mean(|return_1h| / volume_1h_usd) × 10^6

해석:
- 높은 ILLIQ: 비유동적 (주의)
- 낮은 ILLIQ: 유동적 (유리)

활용:
- 페어 간 유동성 비교
- 포지션 사이징
- 리스크 관리
```

### 14.4 스프레드 분해 (Spread Decomposition)

```
목적: 스프레드 구성 요소 분석

구성요소:
1. Quoted Spread: 호가 스프레드 (ask - bid)
2. Effective Spread: 실효 스프레드 (2 × |exec_price - mid|)
3. Realized Spread: 실현 스프레드 (체결 후 일정 시간 뒤 측정)
4. Price Impact: 가격 영향 (Effective - Realized)

관계:
Effective Spread = Realized Spread + Price Impact

해석:
- 높은 Realized Spread: MM 수익
- 높은 Price Impact: 역선택 비용 (정보거래자에게 당함)

활용:
- 수익성 분석
- 역선택 비용 분리
- 호가 전략 최적화
```

### 14.5 Implementation Shortfall (실행 부족)

```
목적: 의사결정 시점 대비 실제 체결 비용 측정

정의:
IS = (P_decision - P_execution) / P_decision × 10000 (bps)

구성요소:
1. Market Impact Cost: 시장 영향 비용
2. Timing Cost: 지연 비용
3. Opportunity Cost: 미체결 비용
4. Commission Cost: 수수료

총 비용:
Total IS = Executed IS + Opportunity Cost + Commissions

활용:
- 실행 품질 벤치마크
- 전략 성과 분리
- 알고리즘 성능 평가
```

---

## 15. 구현 우선순위 매트릭스

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PRIORITY MATRIX                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Priority │ Feature                    │ Impact │ Effort │ Dependencies │
├──────────┼────────────────────────────┼────────┼────────┼──────────────┤
│ P0       │ Volume Spike Alerts        │ HIGH   │ LOW    │ None         │
│ (Now)    │ Large Trade Detection      │ HIGH   │ LOW    │ None         │
├──────────┼────────────────────────────┼────────┼────────┼──────────────┤
│ P1       │ Maker/Taker Dashboard      │ HIGH   │ MEDIUM │ API endpoint │
│ (Soon)   │ Slippage Analysis Panel    │ HIGH   │ MEDIUM │ API endpoint │
│          │ LSI (Liquidity Stress)     │ HIGH   │ MEDIUM │ Orderbook    │
├──────────┼────────────────────────────┼────────┼────────┼──────────────┤
│ P2       │ WAS (Whale Activity)       │ MEDIUM │ MEDIUM │ Trade data   │
│ (Later)  │ FPI (Flow Persistence)     │ MEDIUM │ LOW    │ None         │
│          │ Market Regime Detection    │ MEDIUM │ HIGH   │ ML model     │
├──────────┼────────────────────────────┼────────┼────────┼──────────────┤
│ P3       │ Predictive Fill Rate       │ LOW    │ HIGH   │ ML model     │
│ (Future) │ Auto Parameter Adjustment  │ HIGH   │ HIGH   │ All above    │
│          │ Time-of-Day Optimization   │ MEDIUM │ HIGH   │ Historical   │
└──────────┴────────────────────────────┴────────┴────────┴──────────────┘
```

---

*Last Updated: 2026-01-23*
*Author: MCP Monitor Team*
