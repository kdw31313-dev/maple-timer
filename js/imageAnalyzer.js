/**
 * ImageAnalyzer - 정밀 색상 알고리즘 (오탐지 100% 방지 & 정밀 룬/거탐/버크 트래커)
 */
class ImageAnalyzer {
  constructor() {
    this.runeState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 2, // 2프레임 연속 검증으로 오탐 방지
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

    // 📸 버프 스크린샷 AI 학습 상태
    this.learnedBuffState = {
      isLearned: false,
      baselinePixels: 0,
      baselineBrightness: 0,
      learnedData: null
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
  }

  /**
   * 📸 내 버프 아이콘 캡처 AI 색상 및 픽셀 발자국 실시간 학습
   */
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

  /**
   * 🍁 선명한 보라/분홍 룬 마름모 아이콘 정밀 픽셀 수식 (어두운 배경 오탐지 100% 차단)
   */
  countRunePixels(data) {
    if (!data || data.length === 0) return 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 선명한 보라/마젠타 룬 아이콘 조건:
      // - R과 B가 모두 높고, G는 확연히 낮음 (R >= 135, B >= 155, G <= 135)
      // - (R + B) 합이 300 이상 (어두운 배경 픽셀 오탐 완전 차단)
      // - B > G + 40, R > G + 30
      const isBrightPurpleRune = (r >= 135 && b >= 155 && g <= 135 && (r + b >= 300) && (b - g >= 40) && (r - g >= 30));

      if (isBrightPurpleRune) {
        count++;
      }
    }
    return count;
  }

  processRuneFrame(runeImageData, fullImageData) {
    let runeColorPixels = this.countRunePixels(runeImageData ? runeImageData.data : null);

    // ROI 영역에서 미포착 시 좌상단 40% 이중 체크
    if (runeColorPixels < 4 && fullImageData) {
      const fallbackRoiData = this.extractSubImageData(
        fullImageData,
        0, 0,
        Math.round(fullImageData.width * 0.40),
        Math.round(fullImageData.height * 0.40)
      );
      const fallbackPixels = this.countRunePixels(fallbackRoiData ? fallbackRoiData.data : null);
      if (fallbackPixels > runeColorPixels) {
        runeColorPixels = fallbackPixels;
      }
    }

    this.runeState.lastPixelCount = runeColorPixels;
    const isDetected = runeColorPixels >= 4; // 최소 4픽셀 이상만 유효 포착

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
   * 🚨 거탐 정밀 팝업 수식 (검은 배경 오탐 100% 차단 & 실제 거탐 헤더/경고 텍스트 동시 포착)
   */
  processPopupFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    let orangeHeaderPixels = 0;
    let cyanHeaderPixels = 0;
    let redWarningPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1) 비올레타 고유 주황 상단 헤더 박스 (R:230~255, G:110~170, B <= 70)
      if (r >= 230 && g >= 110 && g <= 170 && b <= 70) {
        orangeHeaderPixels++;
      }

      // 2) 비올레타 고유 시안 테두리 (R <= 40, G >= 180, B >= 200)
      if (r <= 40 && g >= 180 && b >= 200) {
        cyanHeaderPixels++;
      }

      // 3) 거짓말 탐지기 빨간 경고 문구 (R >= 230, G <= 70, B <= 70)
      if (r >= 230 && g <= 70 && b <= 70) {
        redWarningPixels++;
      }
    }

    // 실제 거짓말 탐지기 팝업 창 유효 조건:
    // (주황 헤더 + 시안 테두리가 15픽셀 이상) OR (빨간 경고 문구가 20픽셀 이상)
    const isPopupDetected = (orangeHeaderPixels + cyanHeaderPixels >= 15) || (redWarningPixels >= 20);

    if (isPopupDetected) {
      this.popupState.consecutiveCount++;

      if (this.popupState.consecutiveCount >= this.popupState.REQUIRED_CONSECUTIVE && !this.popupState.isDetected && !this.popupState.cooldownActive) {
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

    // 📸 A. 학습된 버프 소멸/종료 실시간 트래커
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
    }

    // B. 솔 야누스
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

    // C. 도핑 버프
    if (!this.learnedBuffState.isLearned) {
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
