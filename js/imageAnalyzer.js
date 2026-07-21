/**
 * ImageAnalyzer - 메이플스토리 오피셜 규격 룬(보라 마름모/소용돌이) & 거탐 & 버프 실시간 알고리즘
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
   * 🍁 메이플스토리 공식 규격 룬(Rune) 미니맵 픽셀 알고리즘
   * - 룬 모양: 미니맵 상에 보라색 마름모(Diamond) 또는 소용돌이(Swirl) 모양 아이콘으로 단일 규격 고정
   * - 맵 테마(배경)에 따른 착시 대비: 테마 착시와 관계없이 보라색(R: 60~220, G: 0~160, B: 110~255) 픽셀 뭉치 포착
   */
  countRunePixels(data) {
    if (!data || data.length === 0) return 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1) 표준 보라색/마젠타 룬 아이콘 (B가 R/G보다 우세한 메이플 고유 룬 컬러)
      const isStandardPurpleRune = (b >= 110 && b - g >= 15 && r >= 50 && r <= 220 && g <= 165);
      // 2) 네온/딥 바이올렛 룬 아이콘
      const isNeonPurpleRune = (r >= 100 && b >= 140 && g <= 130);

      if (isStandardPurpleRune || isNeonPurpleRune) {
        count++;
      }
    }
    return count;
  }

  /**
   * 룬 영역 분석 (기본 ROI + 상단 45% 이중 안전 폴백 스캔)
   */
  processRuneFrame(runeImageData, fullImageData) {
    let runeColorPixels = this.countRunePixels(runeImageData ? runeImageData.data : null);

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
        if (this.runeState.normReturnFrames >= 10) {
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) {
            this.onRuneStatusChange(isLive ? `🟢 인식 중 (보라 룬 픽셀 ${runeColorPixels}개)` : '⚪ 대기 중', false);
          }
        }
      } else if (!this.runeState.isDetected) {
        if (this.onRuneStatusChange && isLive) {
          this.onRuneStatusChange(`🟢 인식 중 (보라 룬 픽셀 ${runeColorPixels}개)`, false);
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

      if (r >= 40 && r <= 185 && g >= 10 && g <= 140 && b >= 90 && b <= 255) {
        janusIconPixels++;
      }

      const isWhiteLeaf = (r >= 200 && g >= 200 && b >= 200);
      const isLeafBg = (b >= 150 && (r >= 70 || g >= 70));
      if (isWhiteLeaf || isLeafBg) {
        mapleLeafCouponPixels++;
      }

      const isMvpPurpleOrCyan = ((r >= 120 && g <= 160 && b >= 170) || (r <= 140 && g >= 140 && b >= 190));
      if (isMvpPurpleOrCyan) {
        mvpCouponPixels++;
      }

      const isExpPlus = (r <= 160 && g >= 145 && b >= 170);
      if (isExpPlus) {
        expPlusPixels++;
      }

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
