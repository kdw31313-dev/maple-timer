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

    // 이벤트 콜백
    this.onRuneStatusChange = null;
    this.onPopupStatusChange = null;
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
  }

  /**
   * 룬 영역 분석
   * @param {ImageData} imageData 
   */
  processRuneFrame(imageData) {
    if (!imageData || imageData.data.length === 0) return;

    const data = imageData.data;
    const pixelCount = data.length / 4;

    // 1. 기준 이미지(Baseline)가 없으면 초기화
    if (!this.runeState.baselineData || this.runeState.baselineData.length !== data.length) {
      this.runeState.baselineData = new Uint8ClampedArray(data);
      return;
    }

    // 2. 프레임간 차분(Diff) 계산
    let totalDiff = 0;
    const base = this.runeState.baselineData;

    // 4픽셀 간격 샘플링 (연산 속도 최적화)
    for (let i = 0; i < data.length; i += 16) {
      const rDiff = Math.abs(data[i] - base[i]);
      const gDiff = Math.abs(data[i + 1] - base[i + 1]);
      const bDiff = Math.abs(data[i + 2] - base[i + 2]);
      
      // 색상 차이 합산
      totalDiff += (rDiff + gDiff + bDiff) / 3;
    }

    const avgDiff = totalDiff / (pixelCount / 4);

    // 3. 차분 임계치 검사 (30 이상 변동 시 유의미한 변화로 판단)
    const DIFF_THRESHOLD = 32;

    if (avgDiff > DIFF_THRESHOLD) {
      this.runeState.consecutiveCount++;

      // 연속 3회 이상 변화 감지 시
      if (this.runeState.consecutiveCount >= this.runeState.REQUIRED_CONSECUTIVE) {
        if (!this.runeState.isDetected && !this.runeState.cooldownActive) {
          this.triggerRuneAlert();
        }
      }
    } else {
      // 변동이 일정 수준 이하로 떨어졌을 때 (복원 단계)
      this.runeState.consecutiveCount = Math.max(0, this.runeState.consecutiveCount - 1);

      // 룬이 감지된 상태에서 평소 화면으로 복귀 시 쿨다운 해제
      if (this.runeState.cooldownActive) {
        this.runeState.normReturnFrames++;
        if (this.runeState.normReturnFrames >= 15) { // 약 3초 유지
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) this.onRuneStatusChange('대기 중', false);
        }
      }

      // 평소 상태이면 기준 배경 서서히 업데이트 (학습)
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
   * 팝업 영역 분석 (일반 팝업, 정답 선택형, 비올레타, 투명 도형형)
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
    let totalDiff = 0;
    const base = this.popupState.baselineData;

    // 픽셀 밝기 및 차분 + 엣지 검사
    for (let i = 0; i < data.length; i += 16) {
      const rDiff = Math.abs(data[i] - base[i]);
      const gDiff = Math.abs(data[i + 1] - base[i + 1]);
      const bDiff = Math.abs(data[i + 2] - base[i + 2]);
      const diff = (rDiff + gDiff + bDiff) / 3;

      totalDiff += diff;

      // 팝업 창 고대비 텍스트/테두리 특성 픽셀
      if (diff > 50) {
        highContrastPixels++;
      }
    }

    const avgDiff = totalDiff / (pixelCount / 4);
    const contrastRatio = highContrastPixels / (pixelCount / 4);

    // 팝업 출현 임계치
    if (avgDiff > 28 || contrastRatio > 0.15) {
      this.popupState.consecutiveCount++;

      if (this.popupState.consecutiveCount >= this.popupState.REQUIRED_CONSECUTIVE) {
        if (!this.popupState.isDetected && !this.popupState.cooldownActive) {
          this.triggerPopupAlert();
        }
      }
    } else {
      this.popupState.consecutiveCount = Math.max(0, this.popupState.consecutiveCount - 1);

      if (this.popupState.cooldownActive) {
        // 화면이 정상으로 돌아오면 리셋
        this.popupState.cooldownActive = false;
        this.popupState.isDetected = false;
        if (this.onPopupStatusChange) this.onPopupStatusChange('대기 중', false);
      }

      // 점진적 배경 업데이트
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
}

window.imageAnalyzer = new ImageAnalyzer();
