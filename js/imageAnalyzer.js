/**
 * ImageAnalyzer - Canvas 영상 분석기 (초광범위 룬/거탐/버프 실시간 픽셀 트래커)
 */
class ImageAnalyzer {
  constructor() {
    this.runeState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 1,
      isDetected: false,
      cooldownActive: false,
      normReturnFrames: 0,
      lastPixelCount: 0
    };

    this.popupState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 1,
      isDetected: false,
      cooldownActive: false
    };

    this.janusState = {
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      flashCount: 0,
      lastBrightness: 0,
      alert10Triggered: false
    };

    this.expBuffState = {
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      flashCount: 0,
      lastBrightness: 0,
      alert10Triggered: false
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
  }

  /**
   * 룬 픽셀 카운트 함수 (보라/분홍/마젠타/딥퍼플 계열)
   */
  countRunePixels(data) {
    if (!data || data.length === 0) return 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1) 딥퍼플 / 보라색 룬 (B가 높고 G는 상대적으로 낮음)
      const isPurpleRune = (b >= 115 && g <= 180 && (b - g > 12) && r >= 40);
      // 2) 분홍색 / 마젠타 룬 (R과 B가 높음)
      const isPinkRune = (r >= 115 && b >= 105 && (r - g > 15));

      if (isPurpleRune || isPinkRune) {
        count++;
      }
    }
    return count;
  }

  /**
   * 룬 영역 분석 (기본 ROI + 상단 40% 이중 안전 폴백 스캔)
   */
  processRuneFrame(runeImageData, fullImageData) {
    let runeColorPixels = this.countRunePixels(runeImageData ? runeImageData.data : null);

    // 🚨 2차 안전 장치: ROI 영역에서 놓쳤을 경우, 화면 좌상단 45% x 45% 영역 이중 폴백 스캔!
    if (runeColorPixels < 3 && fullImageData) {
      const fallbackRoiData = this.extractSubImageData(
        fullImageData,
        0, 0,
        Math.round(fullImageData.width * 0.45),
        Math.round(fullImageData.height * 0.45)
      );
      const fallbackPixels = this.countRunePixels(fallbackRoiData ? fallbackRoiData.data : null);
      if (fallbackPixels > runeColorPixels) {
        runeColorPixels = fallbackPixels;
      }
    }

    this.runeState.lastPixelCount = runeColorPixels;
    const isDetected = runeColorPixels >= 3;

    const isLive = window.screenCaptureManager?.isStreaming;

    if (isDetected) {
      this.runeState.consecutiveCount++;

      if (this.runeState.consecutiveCount >= 1 && !this.runeState.isDetected && !this.runeState.cooldownActive) {
        this.triggerRuneAlert(runeColorPixels);
      }
    } else {
      this.runeState.consecutiveCount = 0;

      if (this.runeState.cooldownActive) {
        this.runeState.normReturnFrames++;
        if (this.runeState.normReturnFrames >= 10) { // 약 2초 후 쿨다운 해제
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) {
            this.onRuneStatusChange(isLive ? `🟢 인식 중 (보라픽셀 ${runeColorPixels}개)` : '⚪ 대기 중', false);
          }
        }
      } else if (!this.runeState.isDetected) {
        if (this.onRuneStatusChange && isLive) {
          this.onRuneStatusChange(`🟢 인식 중 (보라픽셀 ${runeColorPixels}개)`, false);
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

    // 알림 발송 (음성 TTS + 룬 전용 사운드 + 화면 깜빡임)
    if (window.audioNotifier) {
      window.audioNotifier.notify('미니맵에 룬이 출현했습니다! 룬을 해제해 주세요!', 'rune');
    }
  }

  /**
   * 팝업 영역 분석 (5종 실물 거짓말 탐지기 고유 시각 패턴 정밀 탐지)
   */
  processPopupFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    let violetaHeaderPixels = 0;
    let geometricEdgePixels = 0;
    let lieTextPixels = 0;

    for (let i = 0; i < data.length; i += 8) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r >= 220 && g >= 110 && g <= 170 && b <= 80) violetaHeaderPixels++;
      if (r <= 30 && g >= 170 && b >= 190) violetaHeaderPixels++;

      if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
        if (r <= 20 || r >= 240) geometricEdgePixels++;
      }

      if (r >= 220 && g >= 50 && g <= 100 && b <= 70) lieTextPixels++;
    }

    const isPopupDetected = (violetaHeaderPixels >= 12) || (geometricEdgePixels >= 120) || (lieTextPixels >= 15);

    if (isPopupDetected) {
      this.popupState.consecutiveCount++;

      if (this.popupState.consecutiveCount >= 1 && !this.popupState.isDetected && !this.popupState.cooldownActive) {
        this.triggerPopupAlert();
      }
    } else {
      this.popupState.consecutiveCount = 0;
    }
  }

  triggerPopupAlert() {
    this.popupState.isDetected = true;
    this.popupState.cooldownActive = true;

    if (this.onPopupStatusChange) {
      this.onPopupStatusChange('🚨 거짓말 탐지기 감지됨!', true);
    }

    if (window.audioNotifier) {
      window.audioNotifier.notify('비상! 거짓말 탐지기 팝업이 감지되었습니다! 화면을 확인하세요!', 'siren');
    }
  }

  /**
   * 솔 야누스 및 5종 경험치 쿠폰/소형재획비 버프 영역 처리
   */
  processJanusFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    let janusIconPixels = 0;
    let mapleLeafCouponPixels = 0;
    let mvpCouponPixels = 0;
    let expPlusPixels = 0;
    let smallWealthPixels = 0;
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      // 1. 솔 야누스 (보라 원형 아이콘)
      if (r >= 40 && r <= 185 && g >= 10 && g <= 140 && b >= 90 && b <= 255) {
        janusIconPixels++;
      }

      // 2. 단풍잎 경쿠 (중앙 단풍잎 + 시안/블루 배경)
      const isWhiteLeaf = (r >= 200 && g >= 200 && b >= 200);
      const isLeafBg = (b >= 150 && (r >= 70 || g >= 70));
      if (isWhiteLeaf || isLeafBg) {
        mapleLeafCouponPixels++;
      }

      // 3. MVP 경험치 쿠폰 (보라/시안/핑크 뱃지)
      const isMvpPurpleOrCyan = ((r >= 120 && g <= 160 && b >= 170) || (r <= 140 && g >= 140 && b >= 190));
      if (isMvpPurpleOrCyan) {
        mvpCouponPixels++;
      }

      // 4. EXP+ 및 몬스터파크 익스트림 골드 포션
      const isExpPlus = (r <= 160 && g >= 145 && b >= 170);
      if (isExpPlus) {
        expPlusPixels++;
      }

      // 5. 소형 재물 획득의 약 / 재물 획득의 약 (청록/황금 포션 병)
      const isTealFlask = (r <= 160 && g >= 130 && b >= 150);
      const isGoldCap = (r >= 170 && g >= 140 && b <= 130);
      if (isTealFlask || isGoldCap) {
        smallWealthPixels++;
      }
    }

    const avgBrightness = totalBrightness / (data.length / 4);

    // A. 솔 야누스
    const hasJanusIcon = janusIconPixels >= 6;
    const janusBrightnessDiff = Math.abs(avgBrightness - this.janusState.lastBrightness);
    this.janusState.lastBrightness = avgBrightness;

    if (hasJanusIcon) {
      this.janusState.consecutiveActiveCount++;
      this.janusState.consecutiveInactiveCount = 0;

      if (!this.janusState.isBuffActive && this.janusState.consecutiveActiveCount >= 1) {
        this.janusState.isBuffActive = true;
        this.janusState.alert10Triggered = false;
        if (this.onJanusStatusChange) this.onJanusStatusChange('야누스 가동 중', false);

        if (window.timerModule && !window.timerModule.janusTimer.isRunning) {
          window.timerModule.startJanusTimer();
        }
      }

      const isJanus10sTimer = window.timerModule && window.timerModule.janusTimer.isRunning && window.timerModule.janusTimer.remainingSeconds <= 10;
      if (this.janusState.isBuffActive && (janusBrightnessDiff > 6 || isJanus10sTimer)) {
        this.janusState.flashCount++;
        if (this.janusState.flashCount >= 1 && !this.janusState.alert10Triggered) {
          this.triggerJanus10sAlert();
        }
      }
    } else {
      this.janusState.consecutiveInactiveCount++;
      if (this.janusState.isBuffActive && this.janusState.consecutiveInactiveCount >= 5) {
        this.janusState.isBuffActive = false;
        this.janusState.flashCount = 0;
        const isLive = window.screenCaptureManager?.isStreaming;
        if (this.onJanusStatusChange) this.onJanusStatusChange(isLive ? '🟢 인식 중 (실시간 감지)' : '⚪ 대기 중', false);
      }
    }

    // B. 도핑 버프
    const detectedBuffName = smallWealthPixels >= 6 ? '소형 재물 획득의 약 (30분)' :
                             mvpCouponPixels >= 6 ? 'R+ MVP 경험치 쿠폰' :
                             expPlusPixels >= 6 ? 'EXP+ 추가 경험치 쿠폰' :
                             mapleLeafCouponPixels >= 6 ? '단풍잎 경험치 쿠폰 (2x/3x/4x)' : null;

    const hasExpBuffIcon = detectedBuffName !== null;
    const expBrightnessDiff = Math.abs(avgBrightness - this.expBuffState.lastBrightness);
    this.expBuffState.lastBrightness = avgBrightness;

    if (hasExpBuffIcon) {
      this.expBuffState.consecutiveActiveCount++;
      this.expBuffState.consecutiveInactiveCount = 0;

      if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveActiveCount >= 1) {
        this.expBuffState.isBuffActive = true;
        this.expBuffState.alert10Triggered = false;
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange(`${detectedBuffName} 가동 중`, false);

        if (window.timerModule && !window.timerModule.expTimer.isRunning) {
          window.timerModule.startExpTimer();
        }
      }

      const isExp10sTimer = window.timerModule && window.timerModule.expTimer.isRunning && window.timerModule.expTimer.remainingSeconds <= 10;
      if (this.expBuffState.isBuffActive && (expBrightnessDiff > 5 || isExp10sTimer)) {
        this.expBuffState.flashCount++;
        if (this.expBuffState.flashCount >= 1 && !this.expBuffState.alert10Triggered) {
          this.triggerExpBuff10sAlert(detectedBuffName || '도핑 버프');
        }
      }
    } else {
      this.expBuffState.consecutiveInactiveCount++;
      if (this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 5) {
        this.expBuffState.isBuffActive = false;
        this.expBuffState.flashCount = 0;
        const isLive = window.screenCaptureManager?.isStreaming;
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange(isLive ? '🟢 인식 중 (실시간 감지)' : '⚪ 대기 중', false);
      }
    }
  }

  triggerJanus10sAlert() {
    this.janusState.alert10Triggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 야누스 10초 남음!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 10초 남았습니다. 재사용을 준비하세요!', 'beep');
    }
  }

  triggerExpBuff10sAlert(buffName) {
    this.expBuffState.alert10Triggered = true;
    if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('🚨 도핑 10초 남음!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('사냥 도핑 버프 종료 10초 전입니다. 도핑 재사용을 준비하세요!', 'chime');
    }
  }

  /**
   * ⚡ 0% 렉 사냥 스캐너: 마이크로 ROI + 전체 화면 240x135 다운샘플링 데이터를 직접 수급받아 0% 렉 감지!
   */
  analyzeMicroFrame(runeImageData, janusImageData, popupImageData) {
    if (runeImageData) {
      this.processRuneFrame(runeImageData, null);
    }
    if (janusImageData) {
      this.processJanusFrame(janusImageData);
    }
    if (popupImageData) {
      this.processPopupFrame(popupImageData);
    }
  }

  analyzeFrame(imageData, rois) {
    if (!imageData) return;

    const width = imageData.width;
    const height = imageData.height;

    // A. 룬 미니맵 영역 ROI 슬라이싱
    let runeImageData = null;
    if (rois.runeRoi) {
      const rx = Math.round((rois.runeRoi.x / 100) * width);
      const ry = Math.round((rois.runeRoi.y / 100) * height);
      const rw = Math.round((rois.runeRoi.w / 100) * width);
      const rh = Math.round((rois.runeRoi.h / 100) * height);

      runeImageData = this.extractSubImageData(imageData, rx, ry, rw, rh);
    }
    this.processRuneFrame(runeImageData, imageData);

    // B. 거짓말 탐지기 전체 화면 ROI
    this.processPopupFrame(imageData);

    // C. 버프 영역 ROI 슬라이싱
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
