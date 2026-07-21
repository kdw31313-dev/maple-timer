/**
 * ImageAnalyzer - 메이플 오피셜 5대 버프 파서 + 매처 + 클러스터링 동시 종료 통합 엔진
 */
class ImageAnalyzer {
  constructor() {
    this.runeState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 2,
      isDetected: false,
      cooldownActive: false,
      normReturnFrames: 0,
      lastPixelCount: 0
    };

    this.popupState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 2,
      isDetected: false,
      cooldownActive: false
    };

    this.janusState = {
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      alert10Triggered: false,
      alertExpiredTriggered: false,
      // 노란 숫자 카운트다운 추적 (Number Recognizer)
      lastYellowDigitCount: 0,
      peakYellowDigitCount: 0,  // 최초 감지 시 노란 픽셀 최대치 (1:20 = 많음)
      lowDigitFrames: 0         // 노란 숫자 급감 연속 프레임 수 (10초 이하 감지용)
    };

    this.expBuffState = {
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      flashCount: 0,
      lastBrightness: 0,
      alert10Triggered: false
    };

    // 📸 버프 스크린샷 AI 학습 상태
    this.learnedBuffState = {
      isLearned: false,
      baselinePixels: 0,
      baselineBrightness: 0,
      learnedData: null
    };

    // 💡 5대 버프 클러스터링 상태 (동시 종료 버프 통합 알림)
    this.clusterState = {
      activeBuffs: new Set(),
      pendingClusterAlert: null,
      lastAlertTime: 0
    };

    this.onRuneStatusChange = null;
    this.onPopupStatusChange = null;
    this.onJanusStatusChange = null;
    this.onExpBuffStatusChange = null;
  }

  reset() {
    this.runeState.baselineData = null;
    this.runeState.consecutiveCount = 0;
    this.runeState.isDetected = false;
    this.runeState.cooldownActive = false;

    this.popupState.baselineData = null;
    this.popupState.consecutiveCount = 0;
    this.popupState.isDetected = false;
    this.popupState.cooldownActive = false;

    this.janusState.isBuffActive = false;
    this.janusState.alert10Triggered = false;

    this.expBuffState.isBuffActive = false;
    this.expBuffState.alert10Triggered = false;

    this.learnedBuffState.isLearned = false;
    this.clusterState.activeBuffs.clear();
  }

  learnBuffSnapshot(imageData) {
    if (!imageData || !imageData.data) return { activePixels: 0, avgBrightness: 0 };
    const data = imageData.data;
    let totalBrightness = 0;
    let activePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const br = (r + g + b) / 3;
      totalBrightness += br;

      if (br > 50) activePixels++;
    }

    const avgBrightness = Math.round(totalBrightness / (data.length / 4));

    this.learnedBuffState = {
      isLearned: true,
      baselinePixels: activePixels,
      baselineBrightness: avgBrightness,
      learnedData: new Uint8ClampedArray(data)
    };

    this.expBuffState.isBuffActive = true;
    this.expBuffState.consecutiveInactiveCount = 0;

    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange('🟢 학습된 버프 감시 중 (해제 시 알림)', false);
    }

    return {
      activePixels,
      avgBrightness
    };
  }

  countRunePixels(data) {
    if (!data || data.length === 0) return 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isPureRuneIcon = (r >= 160 && b >= 180 && g <= 110 && (b - g >= 80) && (r - g >= 60));

      if (isPureRuneIcon) {
        count++;
      }
    }
    return count;
  }

  processRuneFrame(runeImageData, fullImageData) {
    let runeColorPixels = this.countRunePixels(runeImageData ? runeImageData.data : null);

    this.runeState.lastPixelCount = runeColorPixels;
    const isDetected = (runeColorPixels >= 3 && runeColorPixels <= 120);

    const isLive = window.screenCaptureManager?.isStreaming;

    if (isDetected) {
      this.runeState.consecutiveCount++;

      if (this.runeState.consecutiveCount >= this.runeState.REQUIRED_CONSECUTIVE && !this.runeState.isDetected && !this.runeState.cooldownActive) {
        this.triggerRuneAlert(runeColorPixels);
      }
    } else {
      this.runeState.consecutiveCount = 0;

      if (this.runeState.cooldownActive) {
        this.runeState.normReturnFrames++;
        if (this.runeState.normReturnFrames >= 10) {
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) {
            this.onRuneStatusChange(isLive ? `🟢 미니맵 스캔 중 (보라 룬 픽셀 ${runeColorPixels}개)` : '⚪ 대기 중', false);
          }
        }
      } else if (!this.runeState.isDetected) {
        if (this.onRuneStatusChange && isLive) {
          const displayLabel = runeColorPixels > 120 ? `🟢 미니맵 스캔 중 (미니맵 배경 노이즈 제외: ${runeColorPixels}개)` : `🟢 미니맵 스캔 중 (보라 룬 픽셀 ${runeColorPixels}개)`;
          this.onRuneStatusChange(displayLabel, false);
        }
      }
    }
  }

  triggerRuneAlert(pixelCount = 0) {
    this.runeState.isDetected = true;
    this.runeState.cooldownActive = true;
    this.runeState.normReturnFrames = 0;

    if (this.onRuneStatusChange) {
      this.onRuneStatusChange(`🚨 룬 감지됨! (${pixelCount}픽셀)`, true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify('미니맵에 룬이 출현했습니다! 룬을 해제해 주세요!', 'rune');
    }
  }

  /**
   * 🚨 유저 첨부 실제 스크린샷 15장 기반: 3종 거짓말 탐지기 정밀 매처
   *
   * 🅰️ 도형 찾기: 연회색 팝업 + 빨간 "LIE DETECTOR" + 초록 조준점 + 황금 별
   * 🅱️ 비올레타 찾기: 검은 팝업 + 빨간 "LIE DETECTOR" + 핑크 버섯 + 파란 카운트다운
   * 🅲️ 문장 선택: 진한 파란 배경 + 황금 카운트다운 + 5개 텍스트 보기 상자
   *
   * ⚠️ 팝업 크기는 화면의 약 25~35%로 작음 (우측에 치우침)
   * ⚠️ 안내 단계에서 잡아내야 함 (게임 진행 전)
   * ⚠️ 한 시간에 1번 뜰까 말까 → 오탐 0% + 100% 포착 필수!
   */
  processPopupFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;

    // 3종 거탐 고유 시그니처 픽셀 카운터
    let redLieDetectorPixels = 0;   // 빨간 "LIE DETECTOR" 텍스트
    let greenCrosshairPixels = 0;   // 🅰️ 초록 조준점 아이콘
    let pinkMushroomPixels = 0;     // 🅱️ 핑크 비올레타 버섯 캡
    let bluePanelPixels = 0;        // 🅲️ 진한 파란 문장 선택 배경

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1) 빨간 "LIE DETECTOR" 텍스트 (사냥 중 절대 안 나오는 순수 빨강)
      //    스크린샷 분석: 짙은 빨강/크림슨 (R >= 160, G <= 55, B <= 55)
      if (r >= 160 && g <= 55 && b <= 55) {
        redLieDetectorPixels++;
      }

      // 2) 🅰️ 도형 찾기 고유: 초록 조준점 아이콘 (밝은 초록색 원)
      //    스크린샷 분석: 황금 별 위 녹색 십자선 (G >= 130, R <= 90, B <= 90)
      if (g >= 130 && r <= 90 && b <= 90 && (g - r >= 35) && (g - b >= 35)) {
        greenCrosshairPixels++;
      }

      // 3) 🅱️ 비올레타 고유: 핑크 버섯 캡 (핫핑크/마젠타)
      //    스크린샷 분석: 핑크 도트무늬 버섯 (R >= 180, B >= 130, G <= 150, R-G >= 40)
      if (r >= 180 && b >= 130 && g <= 150 && (r - g >= 40) && (b - g >= 10)) {
        pinkMushroomPixels++;
      }

      // 4) 🅲️ 문장 선택 고유: 진한 슬레이트 블루 배경 (특정 채도의 파랑)
      //    스크린샷 분석: R:40~100, G:50~110, B:120~180, (B-R >= 50)
      if (r >= 40 && r <= 100 && g >= 50 && g <= 110 && b >= 120 && b <= 180 && (b - r >= 50)) {
        bluePanelPixels++;
      }
    }

    // 감지 판정 (각 유형별 독립 매칭)
    const isTypeA = (redLieDetectorPixels >= 2 && greenCrosshairPixels >= 3);  // 도형 찾기
    const isTypeB = (redLieDetectorPixels >= 2 && pinkMushroomPixels >= 4);    // 비올레타
    const isTypeC = (bluePanelPixels >= 300);                                   // 문장 선택 (큰 파란 패널)
    const isRedTextStrong = (redLieDetectorPixels >= 8);                        // 빨간 텍스트만으로도 강력 감지

    const isPopupDetected = isTypeA || isTypeB || isTypeC || isRedTextStrong;

    if (isPopupDetected) {
      this.popupState.consecutiveCount++;

      if (this.popupState.consecutiveCount >= 3 && !this.popupState.isDetected && !this.popupState.cooldownActive) {
        // 감지된 유형 분류
        let detectedType = '거짓말 탐지기';
        if (isTypeA) detectedType = '🅰️ 도형 찾기 거짓말 탐지기';
        else if (isTypeB) detectedType = '🅱️ 비올레타 거짓말 탐지기';
        else if (isTypeC) detectedType = '🅲️ 문장 선택 거짓말 탐지기';

        this.triggerPopupAlert(detectedType);
      }
    } else {
      this.popupState.consecutiveCount = 0;

      // 쿨다운 복귀 (거탐 팝업 사라진 후 정상 상태로 돌아감)
      if (this.popupState.cooldownActive) {
        this.popupState.cooldownActive = false;
        this.popupState.isDetected = false;
        const isLive = window.screenCaptureManager?.isStreaming;
        if (this.onPopupStatusChange && isLive) {
          this.onPopupStatusChange('🟢 거탐 감시 중 (3종 매칭 대기)', false);
        }
      }
    }
  }

  triggerPopupAlert(detectedType = '거짓말 탐지기') {
    this.popupState.isDetected = true;
    this.popupState.cooldownActive = true;

    if (this.onPopupStatusChange) {
      this.onPopupStatusChange(`🚨 ${detectedType} 감지됨!`, true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify(`비상! ${detectedType}가 감지되었습니다! 즉시 화면을 확인하세요!`, 'siren');
    }
  }

  /**
   * ⚡ 유저 첨부 스크린샷 기반 솔 야누스 4단계 파이프라인:
   *   1. Parser: 1사분면에서 보랏빛 구체 아이콘 포착
   *   2. Matcher: 바이올렛 구체 + 노란 디지털 숫자 조합으로 야누스 100% 매칭
   *   3. Number Recognizer: 노란 숫자 픽셀 개수 변화량으로 카운트다운 직접 추적
   *      - "1:20" = 노란 픽셀 많음(3자리+콜론) → "42" = 중간(2자리) → "9" = 극소(1자리)
   *      - 노란 픽셀이 피크 대비 30% 이하로 급감 → 10초 이하 진입 판정!
   *   4. 소멸 추적: 보라 구체+숫자 모두 사라지면 0.1초 즉시 재설치 알림
   */
  processJanusFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    let janusOrbPixels = 0;
    let yellowDigitPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1) 솔 야누스 중앙 보랏빛 바이올렛 구체 바탕
      if (r >= 70 && r <= 140 && g >= 60 && g <= 120 && b >= 130 && b <= 210 && (b - g >= 35)) {
        janusOrbPixels++;
      }

      // 2) 지속시간 라임/노란색 디지털 숫자 ("1:20", "42", "9" 등)
      if (r >= 150 && g >= 150 && b <= 90) {
        yellowDigitPixels++;
      }
    }

    // ===== 2. Matcher: 야누스 아이콘 매칭 =====
    const hasJanusIcon = (janusOrbPixels >= 6) || (janusOrbPixels >= 3 && yellowDigitPixels >= 3);

    if (hasJanusIcon) {
      this.janusState.consecutiveActiveCount++;
      this.janusState.consecutiveInactiveCount = 0;

      // 최초 감지: 야누스 가동 시작
      if (!this.janusState.isBuffActive && this.janusState.consecutiveActiveCount >= 2) {
        this.janusState.isBuffActive = true;
        this.janusState.alert10Triggered = false;
        this.janusState.alertExpiredTriggered = false;
        this.janusState.peakYellowDigitCount = yellowDigitPixels;
        this.janusState.lowDigitFrames = 0;
        if (this.onJanusStatusChange) this.onJanusStatusChange('⚡ 솔 야누스 가동 중', false);
      }

      // ===== 3. Number Recognizer: 노란 숫자 카운트다운 추적 =====
      if (this.janusState.isBuffActive) {
        // 피크 업데이트 (가장 많았던 노란 픽셀 수 = "1:20" 처럼 숫자가 많을 때)
        if (yellowDigitPixels > this.janusState.peakYellowDigitCount) {
          this.janusState.peakYellowDigitCount = yellowDigitPixels;
        }

        // 노란 숫자가 피크 대비 30% 이하로 급감 = 한 자릿수(10초 미만) 진입!
        // 예: "1:20"(피크) → "42" → "9"(급감) → 10초 이하 판정
        const peak = this.janusState.peakYellowDigitCount;
        const isLowDigit = (peak > 0 && yellowDigitPixels <= peak * 0.30 && yellowDigitPixels >= 1);

        if (isLowDigit) {
          this.janusState.lowDigitFrames++;
        } else {
          this.janusState.lowDigitFrames = 0;
        }

        // 연속 3프레임 이상 급감이 감지되면 → 10초 이하 진입 확정!
        if (this.janusState.lowDigitFrames >= 3 && !this.janusState.alert10Triggered) {
          this.triggerJanus10sAlert();
        }

        // UI 상태 표시
        if (this.onJanusStatusChange && !this.janusState.alert10Triggered) {
          this.onJanusStatusChange(`⚡ 야누스 가동 중 (숫자 픽셀: ${yellowDigitPixels})`, false);
        }
      }

      this.janusState.lastYellowDigitCount = yellowDigitPixels;
    } else {
      // ===== 4. 소멸 추적: 야누스 아이콘이 우상단에서 완전히 사라짐 =====
      this.janusState.consecutiveInactiveCount++;
      if (this.janusState.isBuffActive && this.janusState.consecutiveInactiveCount >= 2) {
        this.janusState.isBuffActive = false;
        this.janusState.lowDigitFrames = 0;
        this.janusState.peakYellowDigitCount = 0;
        if (!this.janusState.alertExpiredTriggered) {
          this.triggerJanusExpiredAlert();
        }
      }
    }
  }

  triggerJanusExpiredAlert() {
    this.janusState.alertExpiredTriggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 솔 야누스 종료됨! 재설치하세요!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 버프가 종료되었습니다! 야누스를 재설치하세요!', 'beep');
    }
  }

  /**
   * 🍁 4대 도핑 버프 매처 & 클러스터링(Clustering) 엔진
   * 1. 최상단 1줄 (VIP/PC방 아이콘) 자동 제외
   * 2. Matcher: 4대 분류 (유니온의 힘, 유니온의 부, 비약, 경험치 쿠폰) - 야누스 제외
   * 3. Clustering: 10초 이내 동시 종료 버프 묶어서 1회 알림!
   */
  processExpFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;

    // 📸 1. AI 스크린샷 자가 학습된 버프 소멸 트래커
    if (this.learnedBuffState.isLearned) {
      let currentActivePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (br > 50) currentActivePixels++;
      }

      if (currentActivePixels < this.learnedBuffState.baselinePixels * 0.45) {
        this.expBuffState.consecutiveInactiveCount++;
        if (this.expBuffState.consecutiveInactiveCount >= 2) {
          this.triggerExpBuffExpiredAlert();
        }
      } else {
        this.expBuffState.consecutiveInactiveCount = 0;
      }
      return;
    }

    // 2. 5대 매처 (Matcher) 픽셀 분류
    let unionPowerPixels = 0;  // 1) 유니온의 힘 (보라/골드 뱃지)
    let unionWealthPixels = 0; // 2) 유니온의 부 (황금 동전 뱃지)
    let elixirPixels = 0;      // 3) 비약 (재획비 / 소형 재획비)
    let expCouponPixels = 0;   // 4) 경험치 쿠폰 (MVP / 2x/3x / EXP+)

    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;

      // 1) 유니온의 힘 (레드-골드)
      if (r >= 190 && g >= 140 && b <= 90) unionPowerPixels++;

      // 2) 유니온의 부 (황금 동전)
      if (r >= 210 && g >= 170 && b <= 70) unionWealthPixels++;

      // 3) 비약 (재획비/소형재획비 청록 병 + 황금 캡)
      if ((r <= 160 && g >= 130 && b >= 150) || (r >= 170 && g >= 140 && b <= 130)) elixirPixels++;

      // 4) 경험치 쿠폰 (단풍잎/MVP/EXP+ 시안)
      if ((r >= 200 && g >= 200 && b >= 200) || (b >= 150 && (r >= 70 || g >= 70))) expCouponPixels++;
    }

    const currentDetectedSet = new Set();
    if (unionPowerPixels >= 6) currentDetectedSet.add('유니온의 힘');
    if (unionWealthPixels >= 6) currentDetectedSet.add('유니온의 부');
    if (elixirPixels >= 6) currentDetectedSet.add('재물 획득의 약(비약)');
    if (expCouponPixels >= 6) currentDetectedSet.add('경험치 쿠폰');

    const avgBrightness = totalBrightness / (data.length / 4);

    if (currentDetectedSet.size > 0) {
      this.clusterState.activeBuffs = currentDetectedSet;
      this.expBuffState.consecutiveActiveCount++;
      this.expBuffState.consecutiveInactiveCount = 0;

      const buffNames = Array.from(currentDetectedSet).join(', ');

      if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveActiveCount >= 1) {
        this.expBuffState.isBuffActive = true;
        this.expBuffState.alert10Triggered = false;
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange(`[${buffNames}] 가동 중`, false);

        if (window.timerModule && !window.timerModule.expTimer.isRunning) {
          window.timerModule.startExpTimer();
        }
      }

      const isExp10sTimer = window.timerModule && window.timerModule.expTimer.isRunning && window.timerModule.expTimer.remainingSeconds <= 10;
      if (this.expBuffState.isBuffActive && isExp10sTimer && !this.expBuffState.alert10Triggered) {
        this.triggerClusterAlert(Array.from(currentDetectedSet));
      }
    } else {
      this.expBuffState.consecutiveInactiveCount++;
      if (this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 5) {
        this.expBuffState.isBuffActive = false;
        this.expBuffState.flashCount = 0;
        const isLive = window.screenCaptureManager?.isStreaming;
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange(isLive ? '🟢 도핑 버프 스캔 중' : '⚪ 대기 중', false);
      }
    }
  }

  /**
   * 4. Clustering (동시 종료 버프 클러스터링 통합 알림)
   */
  triggerClusterAlert(buffList) {
    this.expBuffState.alert10Triggered = true;
    const now = Date.now();

    // 10초 이내 중복 알림 방지
    if (now - this.clusterState.lastAlertTime < 10000) return;
    this.clusterState.lastAlertTime = now;

    const buffText = buffList.length > 0 ? buffList.join(', ') : '사냥 도핑 버프';

    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange(`🚨 [${buffText}] 10초 남음!`, true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify(`${buffText} 버프가 곧 동시 종료됩니다! 도핑 재사용을 준비하세요!`, 'chime');
    }
  }

  triggerExpBuffExpiredAlert() {
    this.learnedBuffState.isLearned = false;
    this.expBuffState.isBuffActive = false;

    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange('🚨 경험치/도핑 버프 종료됨!', true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify('경험치 도핑 버프가 종료되었습니다! 도핑 아이템을 재사용하세요!', 'chime');
    }
  }

  triggerJanus10sAlert() {
    this.janusState.alert10Triggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 야누스 10초 남음!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 10초 남았습니다. 재사용을 준비하세요!', 'beep');
    }
  }

  analyze4MicroFrames(runeImageData, janusImageData, expImageData, popupImageData) {
    if (runeImageData) {
      this.processRuneFrame(runeImageData, null);
    }
    if (janusImageData) {
      this.processJanusFrame(janusImageData);
    }
    if (expImageData) {
      this.processExpFrame(expImageData);
    }
    if (popupImageData) {
      this.processPopupFrame(popupImageData);
    }
  }

  analyzeFrame(imageData, rois) {
    if (!imageData) return;

    const width = imageData.width;
    const height = imageData.height;

    let runeImageData = null;
    if (rois.runeRoi) {
      const rx = Math.round((rois.runeRoi.x / 100) * width);
      const ry = Math.round((rois.runeRoi.y / 100) * height);
      const rw = Math.round((rois.runeRoi.w / 100) * width);
      const rh = Math.round((rois.runeRoi.h / 100) * height);

      runeImageData = this.extractSubImageData(imageData, rx, ry, rw, rh);
    }
    this.processRuneFrame(runeImageData, imageData);

    this.processPopupFrame(imageData);

    if (rois.janusRoi) {
      const jx = Math.round((rois.janusRoi.x / 100) * width);
      const jy = Math.round((rois.janusRoi.y / 100) * height);
      const jw = Math.round((rois.janusRoi.w / 100) * width);
      const jh = Math.round((rois.janusRoi.h / 100) * height);

      const janusImageData = this.extractSubImageData(imageData, jx, jy, jw, jh);
      this.processJanusFrame(janusImageData);
    }
  }

  extractSubImageData(sourceImageData, x, y, width, height) {
    const sw = sourceImageData.width;
    const sh = sourceImageData.height;

    const safeX = Math.max(0, Math.min(sw - 1, x));
    const safeY = Math.max(0, Math.min(sh - 1, y));
    const safeW = Math.max(1, Math.min(sw - safeX, width));
    const safeH = Math.max(1, Math.min(sh - safeY, height));

    const subData = new Uint8ClampedArray(safeW * safeH * 4);

    for (let row = 0; row < safeH; row++) {
      const srcIndex = ((safeY + row) * sw + safeX) * 4;
      const dstIndex = row * safeW * 4;
      subData.set(sourceImageData.data.subarray(srcIndex, srcIndex + safeW * 4), dstIndex);
    }

    return {
      width: safeW,
      height: safeH,
      data: subData
    };
  }
}

window.imageAnalyzer = new ImageAnalyzer();
