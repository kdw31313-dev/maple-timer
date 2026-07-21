/**
 * ImageAnalyzer - Canvas 영상 분석기 (룬 감지 & 4종 팝업/거짓말 탐지기 감지)
 */
class ImageAnalyzer {
  constructor() {
    // 룬 감지 관련 상태
    this.runeState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 3,
      isDetected: false,
      cooldownActive: false,
      normReturnFrames: 0
    };

    // 팝업 감지 관련 상태
    this.popupState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 2,
      isDetected: false,
      cooldownActive: false
    };

    // 솔 야누스 버프 감지 상태
    this.janusState = {
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      flashCount: 0,
      lastBrightness: 0,
      alert10Triggered: false
    };

    // 이벤트 콜백
    this.onRuneStatusChange = null;
    this.onPopupStatusChange = null;
    this.onJanusStatusChange = null;
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
  }

  /**
   * 룬 영역 분석 (미니맵 분홍/보라 다이아몬드 색상 및 차분 통합 분석)
   * @param {ImageData} imageData 
   */
  processRuneFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    const pixelCount = data.length / 4;

    // 1. 미니맵 룬 특유의 분홍/보라색(Magenta/Purple: R, B는 높고 G는 상대적으로 낮은 보랏빛 RGB) 픽셀 카운트
    let runeColorPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 미니맵 룬 아이콘 색상 조건:
      // - R과 B가 모두 높음 (R >= 160, B >= 180)
      // - G는 R/B에 비해 낮음 (G < 140)
      // - R과 B의 차이가 크지 않으며, 분홍~보라색 계열 (R:B 비율 우수)
      const isMagentaPurple = (r >= 160 && b >= 180 && g <= 140 && Math.abs(r - b) < 70);

      if (isMagentaPurple) {
        runeColorPixels++;
      }
    }

    // 미니맵 영역 내 분홍/보라 룬 아이콘 픽셀 뭉치(최소 12픽셀 이상) 발견 여부
    const isColorMatched = runeColorPixels >= 12;

    // 2. 기준 이미지(Baseline) 차분 분석
    if (!this.runeState.baselineData || this.runeState.baselineData.length !== data.length) {
      this.runeState.baselineData = new Uint8ClampedArray(data);
      return;
    }

    let totalDiff = 0;
    const base = this.runeState.baselineData;

    for (let i = 0; i < data.length; i += 16) {
      const rDiff = Math.abs(data[i] - base[i]);
      const gDiff = Math.abs(data[i + 1] - base[i + 1]);
      const bDiff = Math.abs(data[i + 2] - base[i + 2]);
      totalDiff += (rDiff + gDiff + bDiff) / 3;
    }

    const avgDiff = totalDiff / (pixelCount / 4);
    const isDiffMatched = avgDiff > 25;

    // 3. 미니맵 룬 색상 일치 OR 프레임 차분 유의미 조건 만족 시
    if (isColorMatched || isDiffMatched) {
      this.runeState.consecutiveCount++;

      // 연속 2~3회 이상 감지 시 알림
      if (this.runeState.consecutiveCount >= this.runeState.REQUIRED_CONSECUTIVE) {
        if (!this.runeState.isDetected && !this.runeState.cooldownActive) {
          this.triggerRuneAlert();
        }
      }
    } else {
      // 감지 안됨
      this.runeState.consecutiveCount = Math.max(0, this.runeState.consecutiveCount - 1);

      if (this.runeState.cooldownActive) {
        this.runeState.normReturnFrames++;
        if (this.runeState.normReturnFrames >= 15) { // 약 3초 유지
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) this.onRuneStatusChange('대기 중', false);
        }
      }

      if (!this.runeState.cooldownActive) {
        for (let i = 0; i < data.length; i += 16) {
          base[i] = base[i] * 0.95 + data[i] * 0.05;
          base[i + 1] = base[i + 1] * 0.95 + data[i + 1] * 0.05;
          base[i + 2] = base[i + 2] * 0.95 + data[i + 2] * 0.05;
        }
      }
    }
  }

  triggerRuneAlert() {
    this.runeState.isDetected = true;
    this.runeState.cooldownActive = true;
    this.runeState.normReturnFrames = 0;

    if (this.onRuneStatusChange) {
      this.onRuneStatusChange('룬 감지됨!', true);
    }

    // 알림 발송
    window.audioNotifier.notify('룬이 출현했습니다! 룬을 확인하세요.', 'rune');
  }

  /**
   * 팝업 영역 분석 (5종 실물 거짓말 탐지기 고유 시각 패턴 정밀 탐지)
   * 1. 비올레타 예고 모달 (주황/시안 헤더 박스)
   * 2. 흑백 착시 기하학 비올레타 (고주파 흑백 엣지)
   * 3. 한글 문자 입력형 (블루/레드 반투명 박스 + 빨간 글씨 박스)
   * 4. 한글 문자 입력형 (레드 반투명 박스 + 붓글씨 텍스트)
   * 5. 금빛 글씨 클릭형 거탐 (양양지/금빛 텍스트 + 클릭 지시문)
   * @param {ImageData} imageData 
   */
  processPopupFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    const pixelCount = data.length / 4;

    if (!this.popupState.baselineData || this.popupState.baselineData.length !== data.length) {
      this.popupState.baselineData = new Uint8ClampedArray(data);
      return;
    }

    let highContrastPixels = 0;
    let dimmingPixels = 0;
    let lieDetectorColorPixels = 0;
    let totalDiff = 0;
    const base = this.popupState.baselineData;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const rBase = base[i];
      const gBase = base[i + 1];
      const bBase = base[i + 2];

      const rDiff = Math.abs(r - rBase);
      const gDiff = Math.abs(g - gBase);
      const bDiff = Math.abs(b - bBase);
      const diff = (rDiff + gDiff + bDiff) / 3;

      totalDiff += diff;

      // 1) 고대비 엣지/텍스트 픽셀
      if (diff > 40) {
        highContrastPixels++;
      }

      // 2) 배경 어두워짐/디밍 픽셀
      const curLuma = (r + g + b) / 3;
      const baseLuma = (rBase + gBase + bBase) / 3;
      if (baseLuma - curLuma > 25) {
        dimmingPixels++;
      }

      // 3) 실물 거탐 9종 통합 고유 시각 특성 검사:
      // - LIE DETECTOR 타이틀 및 금빛/주황색 글씨 (R>=190, G>=130, B<=80) [이미지 1, 5, 6, 8]
      // - 거탐 시안/네온 그린 카운트다운 글씨 (G>=180, R<=100) [이미지 1, 3, 4]
      // - 붉은색 한글 박스 텍스트 & 비올레타 무대 커튼 붉은색 (R>=140, G<=55, B<=60) [이미지 3, 4, 9]
      // - 투명도형 모달 회색 UI 패널 (R>=200, G>=205, B>=210 & 차분 유의미) [이미지 7]
      // - 무지개 폭발형 형광 아우라 (R>=210, G>=180, B<=80 & 차분 스파이크) [이미지 8]
      const isGoldOrTitleText = (r >= 190 && g >= 130 && b <= 80);
      const isCyanNeon = (g >= 180 && r <= 100 && b >= 110);
      const isRedTextOrCurtain = (r >= 140 && g <= 55 && b <= 60);
      const isGreyModalUi = (r >= 200 && g >= 205 && b >= 210 && diff > 30);

      if (isGoldOrTitleText || isCyanNeon || isRedTextOrCurtain || isGreyModalUi) {
        lieDetectorColorPixels++;
      }
    }

    const avgDiff = totalDiff / (pixelCount / 4);
    const contrastRatio = highContrastPixels / (pixelCount / 4);
    const dimmingRatio = dimmingPixels / (pixelCount / 4);
    const colorRatio = lieDetectorColorPixels / (pixelCount / 4);

    // 5종 거탐 종합 탐지 조건:
    // - 고유 색상 픽셀 등장 (colorRatio > 0.04) OR
    // - 평균 차분 변동 > 24 OR
    // - 고대비 비율 > 10% OR 디밍 비율 > 15%
    const isPopupTriggered = (colorRatio > 0.04 || avgDiff > 24 || contrastRatio > 0.10 || dimmingRatio > 0.15);

    if (isPopupTriggered) {
      this.popupState.consecutiveCount++;

      if (this.popupState.consecutiveCount >= this.popupState.REQUIRED_CONSECUTIVE) {
        if (!this.popupState.isDetected && !this.popupState.cooldownActive) {
          this.triggerPopupAlert();
        }
      }
    } else {
      this.popupState.consecutiveCount = Math.max(0, this.popupState.consecutiveCount - 1);

      if (this.popupState.cooldownActive) {
        this.popupState.cooldownActive = false;
        this.popupState.isDetected = false;
        if (this.onPopupStatusChange) this.onPopupStatusChange('대기 중', false);
      }

      if (!this.popupState.cooldownActive) {
        for (let i = 0; i < data.length; i += 16) {
          base[i] = base[i] * 0.9 + data[i] * 0.1;
          base[i + 1] = base[i + 1] * 0.9 + data[i + 1] * 0.1;
          base[i + 2] = base[i + 2] * 0.9 + data[i + 2] * 0.1;
        }
      }
    }
  }

  triggerPopupAlert() {
    this.popupState.isDetected = true;
    this.popupState.cooldownActive = true;

    if (this.onPopupStatusChange) {
      this.onPopupStatusChange('팝업/거탐 감지!', true);
    }

    // 강력 알림 (사이렌 + TTS)
    window.audioNotifier.notify('경고! 화면에 팝업 또는 거탐 창이 감지되었습니다.', 'siren');
  }

  /**
   * 솔 야누스 버프 영역 분석 (아이콘 감지, 자동 타이머 싱크 & 10초 이하 감지)
   * @param {ImageData} imageData 
   */
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

      // 솔 야누스 특유의 보라색 기하학 원형 패턴 (R: 60~150, G: 30~110, B: 120~230)
      const isJanusPurple = (r >= 55 && r <= 165 && g >= 25 && g <= 120 && b >= 110 && b <= 245);
      if (isJanusPurple) {
        janusIconPixels++;
      }
    }

    const avgBrightness = totalBrightness / (data.length / 4);
    const hasIcon = janusIconPixels >= 15;

    // 아이콘 깜빡임(10초 이하) 진동 감지
    const brightnessDiff = Math.abs(avgBrightness - this.janusState.lastBrightness);
    this.janusState.lastBrightness = avgBrightness;

    if (hasIcon) {
      this.janusState.consecutiveActiveCount++;
      this.janusState.consecutiveInactiveCount = 0;

      // 야누스 버프 활성화 포착 (타이머 자동 시동)
      if (!this.janusState.isBuffActive && this.janusState.consecutiveActiveCount >= 2) {
        this.janusState.isBuffActive = true;
        this.janusState.alert10Triggered = false;
        
        if (this.onJanusStatusChange) this.onJanusStatusChange('야누스 가동 중', false);

        // 타이머 자동 시작
        if (window.timerModule && !window.timerModule.janusTimer.isRunning) {
          window.timerModule.startJanusTimer();
        }
      }

      // 버프 아이콘이 깜빡거리거나(밝기 변동 > 12) 잔여 10초 이하 시점
      if (this.janusState.isBuffActive && brightnessDiff > 12) {
        this.janusState.flashCount++;
        if (this.janusState.flashCount >= 3 && !this.janusState.alert10Triggered) {
          this.triggerJanus10sAlert();
        }
      }
    } else {
      this.janusState.consecutiveInactiveCount++;
      if (this.janusState.isBuffActive && this.janusState.consecutiveInactiveCount >= 5) {
        // 야누스 버프 종료
        this.janusState.isBuffActive = false;
        this.janusState.flashCount = 0;
        if (this.onJanusStatusChange) this.onJanusStatusChange('대기 중', false);
      }
    }
  }

  triggerJanus10sAlert() {
    this.janusState.alert10Triggered = true;
    if (this.onJanusStatusChange) this.onJanusStatusChange('10초 이하! 재사용 준비', true);

    window.audioNotifier.notify('솔 야누스 10초 남았습니다. 재사용을 준비하세요!', 'beep');
  }
}

window.imageAnalyzer = new ImageAnalyzer();
