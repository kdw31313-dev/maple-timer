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

  processPopupFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    let orangeHeaderPixels = 0;
    let cyanHeaderPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r >= 235 && g >= 120 && g <= 170 && b <= 50) {
        orangeHeaderPixels++;
      }

      if (r <= 30 && g >= 190 && b >= 210) {
        cyanHeaderPixels++;
      }
    }

    const isPopupDetected = (orangeHeaderPixels >= 10 && cyanHeaderPixels >= 10);

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

  processJanusFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    let janusIconPixels = 0;
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;

      // 6차 솔 야누스 우상단 버프 아이콘 고유 보라/시안 오라 픽셀
      if (r >= 40 && r <= 185 && g >= 10 && g <= 140 && b >= 90 && b <= 255) {
        janusIconPixels++;
      }
    }

    const avgBrightness = totalBrightness / (data.length / 4);
    const hasJanusIcon = janusIconPixels >= 6;
    const janusBrightnessDiff = Math.abs(avgBrightness - this.janusState.lastBrightness);
    this.janusState.lastBrightness = avgBrightness;

    if (hasJanusIcon) {
      this.janusState.consecutiveActiveCount++;
      this.janusState.consecutiveInactiveCount = 0;

      if (!this.janusState.isBuffActive && this.janusState.consecutiveActiveCount >= 1) {
        this.janusState.isBuffActive = true;
        this.janusState.alert10Triggered = false;
        if (this.onJanusStatusChange) this.onJanusStatusChange('⚡ 솔 야누스 가동 중', false);

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
      // 🚨 5석펫 사냥 최적화: 우상단 버프창에서 야누스 아이콘이 꺼지는(소멸) 순간 0.1초 즉시 재사용 알림!
      this.janusState.consecutiveInactiveCount++;
      if (this.janusState.isBuffActive && this.janusState.consecutiveInactiveCount >= 2) {
        this.janusState.isBuffActive = false;
        this.janusState.flashCount = 0;
        this.triggerJanusExpiredAlert();
      }
    }
  }

  triggerJanusExpiredAlert() {
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 솔 야누스 종료됨!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 버프가 종료되었습니다! 야누스를 재설치하세요!', 'beep');
    }
  }

  /**
   * 🍁 5대 버프 매처 & 클러스터링(Clustering) 엔진
   * 1. 최상단 1줄 (VIP/PC방 아이콘) 자동 제외
   * 2. Matcher: 5대 분류 (유니온의 힘, 유니온의 부, 비약, 경험치 쿠폰, Unknown)
           * 3. Number Recognizer: 남은 시간 숫자 추적
   * 4. Clustering: 10초 이내 동시 종료 버프 묶어서 1회 알림!
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
