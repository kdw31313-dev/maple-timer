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
      alert10Triggered: false,
      alertExpiredTriggered: false,
      // Number Recognizer 카운트다운 추적 (야누스와 동일 방식)
      lastDigitPixelCount: 0,
      peakDigitPixelCount: 0,   // 최초 감지 시 숫자 픽셀 최대치 ("13" = 2자리 = 많음)
      lowDigitFrames: 0,        // 숫자 급감 연속 프레임 수 (1자리 감지용)
      detectedBuffNames: []     // 감지된 버프 이름 목록
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
      window.audioNotifier.notify('📍 [메이플] 미니맵 보라 룬 출현! 룬을 해제해 주세요.', 'rune');
    }
  }

  /**
   * 🚨 유저 첨부 실제 스크린샷 20장 기반: 메이플 5대 거짓말 탐지기 전종 정밀 매처
   *
   * 🅰️ 도형 찾기: 연회색 팝업 + 빨간 "LIE DETECTOR" + 초록 조준점 + 황금 별
   * 🅱️ 비올레타 찾기: 검은 팝업 + 빨간 "LIE DETECTOR" + 핑크 버섯 + 파란 카운트다운
   * 🅲️ 문장 선택: 진한 파란 배경 + 황금 카운트다운 + 5개 텍스트 보기 상자
   * 🅳️ 클릭 거탐 (5회/2회 클릭): 황금빛 이탤릭체 "거짓말 탐지기가 발동 되었습니다" + 세그먼트 카운트다운
   * 🅴 일반 텍스트 입력 거탐: 붉은/보라 틴트 팝업 + 하늘색/흰색 캡차 박스 + 시안/연두 카운트다운
   *
   * ⚠️ 팝업 크기는 화면의 약 25~35%로 작음 (무작위 위치 포착)
   * ⚠️ 찍계 클릭 거탐 & 캡차 거탐 100% 비상 포착!
   */
  processPopupFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // 5대 거탐 고유 시그니처 픽셀 카운터 및 바운딩 박스 트래킹
    let redLieDetectorPixels = 0;   // 1) 빨간 "LIE DETECTOR" 텍스트
    let greenCrosshairPixels = 0;   // 2) 🅰️ 초록 조준점 아이콘
    let pinkMushroomPixels = 0;     // 3) 🅱️ 핑크 비올레타 버섯 캡
    let grayBgPixels = 0;           // 4) 🅰️ 연회색 팝업 배경 (도형찾기)
    let blackBgPixels = 0;          // 5) 🅱️ 어두운 검정 팝업 배경 (비올레타)

    let redMinX = 9999, redMaxX = 0, redMinY = 9999, redMaxY = 0;
    let greenMinX = 9999, greenMaxX = 0, greenMinY = 9999, greenMaxY = 0;
    let pinkMinX = 9999, pinkMaxX = 0, pinkMinY = 9999, pinkMaxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 1) 빨간 "LIE DETECTOR" 텍스트 (순수 강렬한 빨강)
        if (r >= 180 && g <= 45 && b <= 45) {
          redLieDetectorPixels++;
          if (x < redMinX) redMinX = x;
          if (x > redMaxX) redMaxX = x;
          if (y < redMinY) redMinY = y;
          if (y > redMaxY) redMaxY = y;
        }

        // 2) 🅰️ 도형 찾기 고유: 초록 조준점 아이콘
        if (g >= 140 && r <= 80 && b <= 80 && (g - r >= 45) && (g - b >= 45)) {
          greenCrosshairPixels++;
          if (x < greenMinX) greenMinX = x;
          if (x > greenMaxX) greenMaxX = x;
          if (y < greenMinY) greenMinY = y;
          if (y > greenMaxY) greenMaxY = y;
        }

        // 3) 🅱️ 비올레타 고유: 핑크 버섯 캡
        if (r >= 195 && b >= 145 && g <= 130 && (r - g >= 60) && (b - g >= 15)) {
          pinkMushroomPixels++;
          if (x < pinkMinX) pinkMinX = x;
          if (x > pinkMaxX) pinkMaxX = x;
          if (y < pinkMinY) pinkMinY = y;
          if (y > pinkMaxY) pinkMaxY = y;
        }

        // 4) 🅰️ 연회색 팝업 배경 (도형찾기 배경: RGB가 200~240 범위로 모여있는 회색)
        if (r >= 190 && r <= 245 && g >= 190 && g <= 245 && b >= 190 && b <= 245 &&
            Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6) {
          grayBgPixels++;
        }

        // 5) 🅱️ 어두운 검정 팝업 배경 (비올레타 배경: RGB가 8~45 범위의 고르고 낮은 검정)
        if (r >= 8 && r <= 45 && g >= 8 && g <= 45 && b >= 8 && b <= 45 &&
            Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6) {
          blackBgPixels++;
        }
      }
    }

    // ===== 감지 판정 (메인 2종: 🅰️도형 찾기 & 🅱️비올레타 집중 감지) =====
    // 투명 배경을 가지는 데미지 스킨은 절대로 가질 수 없는 
    // 불투명 연회색(도형찾기) / 어두운 검정(비올레타) 배경 면적이 충분히(최소 2,500px 이상) 감지될 때만 팝업으로 최종 판단합니다.
    let isTypeA = false;
    let isTypeB = false;

    // 🅰️ 투명도형찾기 판정 (빨강 >= 25 & 초록 >= 20 이며 350px 반경 이내 인접 & 연회색 배경 2,500px 이상 존재)
    if (redLieDetectorPixels >= 25 && greenCrosshairPixels >= 20 && grayBgPixels >= 2500) {
      const redCenterX = (redMinX + redMaxX) / 2;
      const redCenterY = (redMinY + redMaxY) / 2;
      const greenCenterX = (greenMinX + greenMaxX) / 2;
      const greenCenterY = (greenMinY + greenMaxY) / 2;
      const dist = Math.sqrt(Math.pow(redCenterX - greenCenterX, 2) + Math.pow(redCenterY - greenCenterY, 2));
      if (dist <= 350) {
        isTypeA = true;
      }
    }

    // 🅱️ 비올레타 판정 (빨강 >= 25 & 핑크 >= 30 이며 350px 반경 이내 인접 & 검정 배경 3,000px 이상 존재)
    if (redLieDetectorPixels >= 25 && pinkMushroomPixels >= 30 && blackBgPixels >= 3000) {
      const redCenterX = (redMinX + redMaxX) / 2;
      const redCenterY = (redMinY + redMaxY) / 2;
      const pinkCenterX = (pinkMinX + pinkMaxX) / 2;
      const pinkCenterY = (pinkMinY + pinkMaxY) / 2;
      const dist = Math.sqrt(Math.pow(redCenterX - pinkCenterX, 2) + Math.pow(redCenterY - pinkCenterY, 2));
      if (dist <= 350) {
        isTypeB = true;
      }
    }

    const isPopupDetected = isTypeA || isTypeB;

    if (isPopupDetected) {
      this.popupState.consecutiveCount++;

      // 메인 2종은 3프레임(약 0.45초) 만에 빠른 알림!
      const requiredFrames = 3;

      if (this.popupState.consecutiveCount >= requiredFrames && !this.popupState.isDetected && !this.popupState.cooldownActive) {
        // 감지된 유형 분류
        let detectedType = '거짓말 탐지기';
        if (isTypeA) detectedType = '🅰️ 투명도형찾기 거짓말 탐지기';
        else if (isTypeB) detectedType = '🅱️ 비올레타 거짓말 탐지기';

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
          this.onPopupStatusChange('🟢 거탐 감시 중 (비올레타/도형찾기)', false);
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
      window.audioNotifier.notify(`🚨 [메이플] 비상! ${detectedType}가 감지되었습니다! 화면을 확인하세요!`, 'popup');
    }
  }

  /**
   * ⚡ 솔 야누스 새벽(설치기) 전용 4단계 스캐너:
   *   1. Mode Parser: 오직 솔 야누스 '새벽' (설치기 - 보랏빛 몽환 구체 R:65~150, G:50~130, B:120~220)만 전용 감지
   *   2. Dynamic Buff Tracker: 32x32 버프칸 위치 이동 시 실존 바운딩 박스 자동 추적
   *   3. Number Recognizer: 어두운 외곽선(Stroke)을 동반한 타이머 텍스트 픽셀 추적
   *   4. Expired Tracker: 0.1초 소멸 포착 및 재설치 즉시 알림
   */
  processJanusFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let janusOrbPixels = 0;
    let orbMinX = width, orbMaxX = 0, orbMinY = height, orbMaxY = 0;

    // ===== 1단계: 솔 야누스 '새벽' (설치기 보라 구체) 전용 포착 =====
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 오직 새벽 (보랏빛 바이올렛 구체 - 설치기 60초)
        const isDawnViolet = (r >= 65 && r <= 150 && g >= 50 && g <= 130 && b >= 120 && b <= 220 && (b - g >= 30));

        if (isDawnViolet) {
          janusOrbPixels++;
          if (x < orbMinX) orbMinX = x;
          if (x > orbMaxX) orbMaxX = x;
          if (y < orbMinY) orbMinY = y;
          if (y > orbMaxY) orbMaxY = y;
        }
      }
    }

    // ===== 2단계: 32x32 버프 박스 동적 자동 추적 (위치 이동 완벽 대응) =====
    let yellowDigitPixels = 0;

    const scanMinX = janusOrbPixels >= 1 ? Math.max(0, orbMinX - 16) : 0;
    const scanMaxX = janusOrbPixels >= 1 ? Math.min(width - 1, orbMaxX + 16) : width - 1;
    const scanMinY = janusOrbPixels >= 1 ? Math.max(0, orbMinY - 16) : 0;
    const scanMaxY = janusOrbPixels >= 1 ? Math.min(height - 1, orbMaxY + 16) : height - 1;

    // 야누스 구체가 포착된 32x32 주변 영역에서만 타이머 텍스트 스캔
    if (janusOrbPixels >= 1) {
      for (let y = scanMinY; y <= scanMaxY; y++) {
        for (let x = scanMinX; x <= scanMaxX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // 선명한 옐로우/라임/흰색 타이머 폰트 (R>=185, G>=185)
          if (r >= 185 && g >= 185) {
            // 주변 1픽셀에 검은색/어두운 회색 아웃라인 Stroke(R,G,B <= 75)가 있는지 100% 검증
            let hasBlackBorder = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nIdx = (ny * width + nx) * 4;
                  const nr = data[nIdx];
                  const ng = data[nIdx + 1];
                  const nb = data[nIdx + 2];
                  if (nr <= 75 && ng <= 75 && nb <= 75) {
                    hasBlackBorder = true;
                    break;
                  }
                }
              }
              if (hasBlackBorder) break;
            }

            if (hasBlackBorder) {
              yellowDigitPixels++;
            }
          }
        }
      }
    }

    // ===== 3단계: 디지털 시계 타이머 (1:40 -> 59초 -> 9초) 매처 & Recognizer =====
    const hasJanusIcon = (janusOrbPixels >= 1);

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
        if (this.onJanusStatusChange) this.onJanusStatusChange('⚡ 야누스 새벽(설치기) 가동 중', false);
      }

      // ===== 3. Number Recognizer: 노란 숫자 카운트다운 추적 =====
      if (this.janusState.isBuffActive) {
        // 피크 업데이트 (가장 많았던 노란 픽셀 수 = "1:20" 처럼 숫자가 많을 때)
        if (yellowDigitPixels > this.janusState.peakYellowDigitCount) {
          this.janusState.peakYellowDigitCount = yellowDigitPixels;
        }

        // 노란 숫자가 피크 대비 30% 이하로 급감 = 한 자릿수(10초 미만) 진입!
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
          this.onJanusStatusChange(`⚡ 야누스 가동 중 (타이머 픽셀: ${yellowDigitPixels})`, false);
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
      } else if (!this.janusState.isBuffActive && this.janusState.consecutiveInactiveCount >= 3) {
        if (this.onJanusStatusChange) {
          this.onJanusStatusChange('⚪ 대기 중 (인식되지 않음)', false);
        }
      }
    }
  }

  triggerJanusExpiredAlert() {
    this.janusState.alertExpiredTriggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 솔 야누스 종료됨! 재설치하세요!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 버프가 종료되었습니다! 야누스를 재설치하세요!', 'janus');
    }
  }

  /**
   * 🍁 4대 도핑 버프 매처 & Number Recognizer 카운트다운 추적 엔진
   *
   * 유저 첨부 스크린샷 기반 30분 도핑 버프 숫자 변화 패턴:
   *   30분 ~ 10분: "13", "12" (2자리) → 숫자 픽셀 많음
   *   10분 미만:   "9:24"      (1자리+콜론+2자리) → 비슷하거나 약간 적음
   *   1분 미만:    "8"         (1자리) → 극소 → 🚨 종료 임박!
   *
   * 야누스 Number Recognizer와 100% 동일한 로직 적용:
   *   피크 기록 → 변화 추적 → 급감 감지(30% 이하) → 종료 임박 알림!
   *
   * 4대 분류: 유니온의 힘, 유니온의 부, 비약, 경험치 쿠폰
   * Clustering: 10초 이내 동시 종료 버프 묶어서 1회 알림!
   */
  /**
   * 🏆 익스트림 골드 (Extreme Gold - 몬스터파크 황금 물약 30분) 전용 초정밀 스캐너
   *
   * 유저 지정 사냥 필수 도핑: 몬스터파크 익스트림 골드 물약 전용 1:1 파싱
   *   1. Potion Parser: 익스트림 골드 특유의 선명한 황금 물약 픽셀 (R:205~255, G:155~220, B:0~65)
   *   2. Dynamic Tracker: 32x32 버프칸 위치 이동 시 황금 물약 아이콘 동적 1:1 자동 추적
   *   3. Number Recognizer: 어두운 Stroke 외곽선이 둘러싸인 타이머 폰트 픽셀 추적
   *   4. Expired Tracker: 0.1초 소멸 포착 및 익스트림 골드 재도핑 알림 발송
   */
  processExpFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // ===== 1. 익스트림 골드 (황금 물약) 전용 아이콘 픽셀 포착 =====
    let extremeGoldPixels = 0;
    let buffMinX = width, buffMaxX = 0, buffMinY = height, buffMaxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 익스트림 골드 황금 물약병 픽셀 (R>=205, G>=155, G<=220, B<=65)
        const isGoldPotion = (r >= 205 && g >= 155 && g <= 220 && b <= 65 && (r - b >= 135));

        if (isGoldPotion) {
          extremeGoldPixels++;
          if (x < buffMinX) buffMinX = x;
          if (x > buffMaxX) buffMaxX = x;
          if (y < buffMinY) buffMinY = y;
          if (y > buffMaxY) buffMaxY = y;
        }
      }
    }

    // ===== 2. 익스트림 골드 32x32 버프 아이콘 박스 동적 자동 추적 =====
    let digitPixels = 0;

    const scanMinX = extremeGoldPixels >= 3 ? Math.max(0, buffMinX - 16) : 0;
    const scanMaxX = extremeGoldPixels >= 3 ? Math.min(width - 1, buffMaxX + 16) : width - 1;
    const scanMinY = extremeGoldPixels >= 3 ? Math.max(0, buffMinY - 16) : 0;
    const scanMaxY = extremeGoldPixels >= 3 ? Math.min(height - 1, buffMaxY + 16) : height - 1;

    if (extremeGoldPixels >= 3) {
      for (let y = scanMinY; y <= scanMaxY; y++) {
        for (let x = scanMinX; x <= scanMaxX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // 밝은 노란색/연두색/흰색 타이머 폰트 (R>=180, G>=180)
          if (r >= 180 && g >= 180) {
            // 주변 1픽셀에 검은색/어두운 회색 아웃라인 Stroke(R,G,B <= 75)가 있는지 100% 검증
            let hasBlackBorder = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nIdx = (ny * width + nx) * 4;
                  const nr = data[nIdx];
                  const ng = data[nIdx + 1];
                  const nb = data[nIdx + 2];
                  if (nr <= 75 && ng <= 75 && nb <= 75) {
                    hasBlackBorder = true;
                    break;
                  }
                }
              }
              if (hasBlackBorder) break;
            }

            if (hasBlackBorder) {
              digitPixels++;
            }
          }
        }
      }
    }

    // ===== 3. 익스트림 골드 버프 상태 및 타이머 관리 =====
    const hasGoldBuff = (extremeGoldPixels >= 4);

    if (hasGoldBuff) {
      this.expBuffState.consecutiveActiveCount++;
      this.expBuffState.consecutiveInactiveCount = 0;

      // 최초 감지: 익스트림 골드 버프 가동 시작
      if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveActiveCount >= 2) {
        this.expBuffState.isBuffActive = true;
        this.expBuffState.alert10Triggered = false;
        this.expBuffState.alertExpiredTriggered = false;
        this.expBuffState.peakDigitPixelCount = digitPixels;
        this.expBuffState.lowDigitFrames = 0;
        this.expBuffState.detectedBuffNames = ['익스트림 골드'];

        if (this.onExpBuffStatusChange) {
          this.onExpBuffStatusChange('🏆 익스트림 골드 가동 중', false);
        }
      }

      // ===== Number Recognizer: 익스트림 골드 카운트다운 추적 =====
      if (this.expBuffState.isBuffActive) {
        // 피크 업데이트
        if (digitPixels > this.expBuffState.peakDigitPixelCount) {
          this.expBuffState.peakDigitPixelCount = digitPixels;
        }

        // 숫자가 피크 대비 30% 이하로 급감 = 1자리(1분 미만) 진입!
        const peak = this.expBuffState.peakDigitPixelCount;
        const isLowDigit = (peak > 0 && digitPixels <= peak * 0.30 && digitPixels >= 1);

        if (isLowDigit) {
          this.expBuffState.lowDigitFrames++;
        } else {
          this.expBuffState.lowDigitFrames = 0;
        }

        // 연속 3프레임 이상 급감 → 익스트림 골드 종료 임박 알림!
        if (this.expBuffState.lowDigitFrames >= 3 && !this.expBuffState.alert10Triggered) {
          this.triggerClusterAlert(['익스트림 골드']);
        }

        // UI 상태 표시
        if (this.onExpBuffStatusChange && !this.expBuffState.alert10Triggered) {
          this.onExpBuffStatusChange(`🏆 익스트림 골드 가동 중 (타이머: ${digitPixels})`, false);
        }
      }
    } else {
      // ===== 소멸 추적: 익스트림 골드 아이콘 소멸 =====
      this.expBuffState.consecutiveInactiveCount++;

      if (this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 2) {
        this.expBuffState.isBuffActive = false;
        this.expBuffState.lowDigitFrames = 0;
        this.expBuffState.peakDigitPixelCount = 0;

        if (!this.expBuffState.alertExpiredTriggered) {
          this.expBuffState.alertExpiredTriggered = true;
          if (this.onExpBuffStatusChange) {
            this.onExpBuffStatusChange('🚨 익스트림 골드 만료! 재도핑하세요!', true);
          }
          if (window.audioNotifier) {
            window.audioNotifier.notify('🏆 [메이플] 익스트림 골드 버프가 종료되었습니다! 물약을 재사용하세요.', 'exp');
          }
        }
      } else if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 3) {
        if (this.onExpBuffStatusChange) {
          this.onExpBuffStatusChange('⚪ 대기 중 (인식되지 않음)', false);
        }
      }
    }
  }

  /**
   * 4. Clustering (동시 종료 버프 클러스터링 통합 알림)
   *    10초 이내 비슷한 시기에 끝나는 버프들을 묶어서 1회만 알림!
   *    ⚠️ 야누스는 30분짜리가 아니므로 클러스터링에서 제외!
   */
  triggerClusterAlert(buffList) {
    this.expBuffState.alert10Triggered = true;
    const now = Date.now();

    // 10초 이내 중복 알림 방지
    if (now - this.clusterState.lastAlertTime < 10000) return;
    this.clusterState.lastAlertTime = now;

    const buffText = buffList.length > 0 ? buffList.join(', ') : '사냥 도핑 버프';

    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange(`🚨 [${buffText}] 종료 임박!`, true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify(`${buffText} 버프가 곧 종료됩니다! 도핑 재사용을 준비하세요!`, 'exp');
    }
  }

  triggerExpBuffExpiredAlert() {
    this.expBuffState.alertExpiredTriggered = true;
    this.expBuffState.isBuffActive = false;

    const buffText = this.expBuffState.detectedBuffNames.length > 0
      ? this.expBuffState.detectedBuffNames.join(', ')
      : '도핑 버프';

    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange(`🚨 [${buffText}] 종료됨! 재사용하세요!`, true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify(`${buffText} 버프가 종료되었습니다! 도핑 아이템을 재사용하세요!`, 'exp');
    }
  }

  triggerJanus10sAlert() {
    this.janusState.alert10Triggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 야누스 10초 남음!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 10초 남았습니다. 재사용을 준비하세요!', 'janus');
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
