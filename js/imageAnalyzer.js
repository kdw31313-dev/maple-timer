/**
 * ImageAnalyzer - 메이플 오피셜 5대 버프 파서 + 매처 + 클러스터링 동시 종료 통합 엔진
 */
class ImageAnalyzer {
  constructor() {
    this.runeState = {
      baselineData: null,
      consecutiveCount: 0,
      // 전투 이펙트와 캐릭터 표식은 짧게 룬과 비슷해질 수 있다.
      // 실제 룬은 같은 미니맵 좌표에 유지되므로 프레임 수가 아닌 실제 시간으로 확인한다.
      REQUIRED_CONSECUTIVE: 2,
      REQUIRED_STABLE_MS: 600,
      isDetected: false,
      cooldownActive: false,
      normReturnFrames: 0,
      lastPixelCount: 0,
      lastCandidateCount: 0,
      lastCandidates: [],
      pendingCandidate: null,
      candidateMissFrames: 0,
      candidateStableSince: 0,
      backgroundLearningFrames: 0,
      // 미니맵의 장식은 색이 미세하게 움직여 도형 후보로 매번 잡히지 않을 수 있다.
      // 충분히 여러 프레임을 합쳐 고정 보라색 위치를 배경으로 기억한다.
      BACKGROUND_LEARNING_REQUIRED: 20,
      backgroundCandidateTracks: [],
      backgroundCandidates: [],
      backgroundColorMask: null,
      backgroundMaskWidth: 0,
      backgroundMaskHeight: 0,
      mapReferenceData: null,
      mapTransitionFrames: 0,
      MAP_TRANSITION_REQUIRED: 6,
      // 이전 아르테리아 표본과 카르시온 '거대 산호 군락 2' 오탐 사진 4장에서
      // 반복된 위치다. 위치만으로 차단하지 않고 형태 점수가 낮은 후보에만 적용한다.
      KNOWN_FALSE_ZONES: [
        { x: 0.22, y: 0.27, radiusX: 0.08, radiusY: 0.16 },
        { x: 0.32, y: 0.65, radiusX: 0.08, radiusY: 0.16 },
        { x: 0.48, y: 0.37, radiusX: 0.09, radiusY: 0.08 },
        { x: 0.79, y: 0.50, radiusX: 0.08, radiusY: 0.48 }
      ]
    };

    this.popupState = {
      baselineData: null,
      consecutiveCount: 0,
      REQUIRED_CONSECUTIVE: 2,
      isDetected: false,
      cooldownActive: false,
      missedCount: 0,
      lastType: '',
      lastConfidence: 0
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
      peakYellowDigitSpan: 0,
      lowDigitFrames: 0,        // 노란 숫자 급감 연속 프레임 수 (10초 이하 감지용)
      endingFrames: 0,
      startEvidenceHistory: [],
      lastTemplateMatch: null,
      confirmedTemplateMatch: null
    };

    this.expBuffState = {
      disabled: true,
      isBuffActive: false,
      consecutiveActiveCount: 0,
      consecutiveInactiveCount: 0,
      alert10Triggered: false,
      alertExpiredTriggered: false,
      // Number Recognizer 카운트다운 추적 (야누스와 동일 방식)
      lastDigitPixelCount: 0,
      peakDigitPixelCount: 0,   // 최초 감지 시 숫자 픽셀 최대치 ("13" = 2자리 = 많음)
      lowDigitFrames: 0,        // 숫자 급감 연속 프레임 수 (1자리 감지용)
      detectedBuffNames: [],    // 감지된 버프 이름 목록
      peakDigitSpan: 0,
      endingFrames: 0,
      lastTemplateMatch: null,
      confirmedTemplateMatch: null
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
    this.runeState.normReturnFrames = 0;
    this.runeState.lastPixelCount = 0;
    this.runeState.lastCandidateCount = 0;
    this.runeState.lastCandidates = [];
    this.runeState.pendingCandidate = null;
    this.runeState.candidateMissFrames = 0;
    this.runeState.candidateStableSince = 0;
    this.runeState.backgroundLearningFrames = 0;
    this.runeState.backgroundCandidateTracks = [];
    this.runeState.backgroundCandidates = [];
    this.runeState.backgroundColorMask = null;
    this.runeState.backgroundMaskWidth = 0;
    this.runeState.backgroundMaskHeight = 0;
    this.runeState.mapReferenceData = null;
    this.runeState.mapTransitionFrames = 0;

    this.popupState.baselineData = null;
    this.popupState.consecutiveCount = 0;
    this.popupState.isDetected = false;
    this.popupState.cooldownActive = false;
    this.popupState.missedCount = 0;
    this.popupState.lastType = '';
    this.popupState.lastConfidence = 0;

    this.janusState.isBuffActive = false;
    this.janusState.consecutiveActiveCount = 0;
    this.janusState.consecutiveInactiveCount = 0;
    this.janusState.alert10Triggered = false;
    this.janusState.alertExpiredTriggered = false;
    this.janusState.lastYellowDigitCount = 0;
    this.janusState.peakYellowDigitCount = 0;
    this.janusState.peakYellowDigitSpan = 0;
    this.janusState.lowDigitFrames = 0;
    this.janusState.endingFrames = 0;
    this.janusState.startEvidenceHistory = [];
    this.janusState.pendingTemplateMatch = null;
    this.janusState.lastTemplateMatch = null;
    this.janusState.confirmedTemplateMatch = null;

    this.expBuffState.isBuffActive = false;
    this.expBuffState.alert10Triggered = false;
    this.expBuffState.alertExpiredTriggered = false;
    this.expBuffState.consecutiveActiveCount = 0;
    this.expBuffState.consecutiveInactiveCount = 0;
    this.expBuffState.peakDigitPixelCount = 0;
    this.expBuffState.peakDigitSpan = 0;
    this.expBuffState.lowDigitFrames = 0;
    this.expBuffState.endingFrames = 0;
    this.expBuffState.lastTemplateMatch = null;
    this.expBuffState.confirmedTemplateMatch = null;

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

  /**
   * 실제 사냥 화면의 미니맵 룬 표식 전용 검출기.
   *
   * 배경에 보라색이 얼마나 많은지는 판정에 사용하지 않는다. 분홍/보라 후보
   * 픽셀을 연결된 작은 덩어리로 묶은 뒤, 룬 표식과 같은 크기의 마름모 형태만
   * 남긴다. 이 방식은 큰 보라색 지형과 작은 원형 캐릭터 표식을 함께 제외한다.
   */
  findRuneDiamondCandidates(imageData) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) return [];

    const { data, width, height } = imageData;
    const pixelTotal = width * height;
    const colorMask = new Uint8Array(pixelTotal);
    const expandedMask = new Uint8Array(pixelTotal);

    // 룬 외곽선의 진한 보라부터 내부의 밝은 분홍까지 포함하되,
    // 파란 미니맵 선과 회색 UI는 제외한다.
    for (let p = 0; p < pixelTotal; p++) {
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const isRuneMagenta = this.isRuneMagentaPixel(r, g, b);
      if (isRuneMagenta) colorMask[p] = 1;
    }

    // JPEG 압축과 안티앨리어싱으로 끊어진 외곽선을 1픽셀만 연결한다.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (!colorMask[p]) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              expandedMask[ny * width + nx] = 1;
            }
          }
        }
      }
    }

    const visited = new Uint8Array(pixelTotal);
    const candidates = [];
    const minSide = Math.max(7, Math.round(Math.min(width, height) * 0.06));
    const maxSide = Math.max(20, Math.round(Math.min(width, height) * 0.24));

    for (let start = 0; start < pixelTotal; start++) {
      if (!expandedMask[start] || visited[start]) continue;

      const queue = [start];
      visited[start] = 1;
      let head = 0;
      let minX = width, maxX = 0, minY = height, maxY = 0;
      const originalPixels = [];

      while (head < queue.length) {
        const p = queue[head++];
        const x = p % width;
        const y = Math.floor(p / width);
        if (colorMask[p]) originalPixels.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const np = ny * width + nx;
            if (expandedMask[np] && !visited[np]) {
              visited[np] = 1;
              queue.push(np);
            }
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / Math.max(1, boxHeight);
      const density = originalPixels.length / Math.max(1, boxWidth * boxHeight);
      let redSum = 0;
      let greenSum = 0;
      let pinkCorePixels = 0;
      for (const pixel of originalPixels) {
        const idx = (pixel.y * width + pixel.x) * 4;
        redSum += data[idx];
        greenSum += data[idx + 1];
        if (this.isRunePinkCorePixel(data[idx], data[idx + 1], data[idx + 2])) {
          pinkCorePixels++;
        }
      }
      const averageRedGreenContrast = originalPixels.length > 0
        ? (redSum - greenSum) / originalPixels.length
        : 0;
      if (
        boxWidth < minSide || boxHeight < minSide ||
        boxWidth > maxSide || boxHeight > maxSide ||
        aspect < 0.62 || aspect > 1.38 ||
        originalPixels.length < 5 ||
        (originalPixels.length <= 8 && aspect > 1.2) ||
        density < 0.055 || density > 0.72 ||
        averageRedGreenContrast < 38
      ) {
        continue;
      }

      // 마름모 외곽선은 중심을 기준으로 위/아래/왼쪽/오른쪽에 색점이 있다.
      // 큰 배경 덩어리나 한쪽으로 치우친 이펙트를 이 단계에서 제거한다.
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const marginX = boxWidth * 0.18;
      const marginY = boxHeight * 0.18;
      let hasLeft = false, hasRight = false, hasTop = false, hasBottom = false;
      let diamondFitPixels = 0;
      let leftPixels = 0, rightPixels = 0, topPixels = 0, bottomPixels = 0;
      const rowMin = new Array(boxHeight).fill(Infinity);
      const rowMax = new Array(boxHeight).fill(-Infinity);
      const columnMin = new Array(boxWidth).fill(Infinity);
      const columnMax = new Array(boxWidth).fill(-Infinity);
      for (const pixel of originalPixels) {
        if (pixel.x <= centerX - marginX) hasLeft = true;
        if (pixel.x >= centerX + marginX) hasRight = true;
        if (pixel.y <= centerY - marginY) hasTop = true;
        if (pixel.y >= centerY + marginY) hasBottom = true;
        if (pixel.x < centerX) leftPixels++; else rightPixels++;
        if (pixel.y < centerY) topPixels++; else bottomPixels++;

        const row = pixel.y - minY;
        const column = pixel.x - minX;
        rowMin[row] = Math.min(rowMin[row], pixel.x);
        rowMax[row] = Math.max(rowMax[row], pixel.x);
        columnMin[column] = Math.min(columnMin[column], pixel.y);
        columnMax[column] = Math.max(columnMax[column], pixel.y);

        // 실제 룬은 대각선 네 변을 가진 마름모 내부에 색이 모인다.
        // 원형/사각형 플레이어 표식과 전투 이펙트는 모서리 쪽 색이 많다.
        const normalizedDistance =
          Math.abs(pixel.x - centerX) / Math.max(1, boxWidth / 2) +
          Math.abs(pixel.y - centerY) / Math.max(1, boxHeight / 2);
        if (normalizedDistance <= 1.16) diamondFitPixels++;
      }
      const diamondFit = diamondFitPixels / Math.max(1, originalPixels.length);

      const rowSpans = rowMin.map((value, index) => (
        Number.isFinite(value) ? rowMax[index] - value + 1 : 0
      ));
      const columnSpans = columnMin.map((value, index) => (
        Number.isFinite(value) ? columnMax[index] - value + 1 : 0
      ));
      const nonEmptyRowIndexes = rowSpans
        .map((span, index) => span > 0 ? index : -1)
        .filter((index) => index >= 0);
      const nonEmptyColumnIndexes = columnSpans
        .map((span, index) => span > 0 ? index : -1)
        .filter((index) => index >= 0);
      const firstRow = nonEmptyRowIndexes[0] ?? 0;
      const lastRow = nonEmptyRowIndexes[nonEmptyRowIndexes.length - 1] ?? firstRow;
      const firstColumn = nonEmptyColumnIndexes[0] ?? 0;
      const lastColumn = nonEmptyColumnIndexes[nonEmptyColumnIndexes.length - 1] ?? firstColumn;
      const middleRowSpan = Math.max(1, ...rowSpans.slice(
        Math.floor(boxHeight * 0.25),
        Math.max(Math.floor(boxHeight * 0.25) + 1, Math.ceil(boxHeight * 0.75))
      ));
      const middleColumnSpan = Math.max(1, ...columnSpans.slice(
        Math.floor(boxWidth * 0.25),
        Math.max(Math.floor(boxWidth * 0.25) + 1, Math.ceil(boxWidth * 0.75))
      ));
      const verticalTipRatio = (rowSpans[firstRow] + rowSpans[lastRow]) / (2 * middleRowSpan);
      const horizontalTipRatio = (columnSpans[firstColumn] + columnSpans[lastColumn]) / (2 * middleColumnSpan);
      const tipSharpness = Math.max(0, Math.min(1,
        1 - (verticalTipRatio + horizontalTipRatio) / 2
      ));
      const horizontalBalance = Math.min(leftPixels, rightPixels) / Math.max(1, Math.max(leftPixels, rightPixels));
      const verticalBalance = Math.min(topPixels, bottomPixels) / Math.max(1, Math.max(topPixels, bottomPixels));
      const axisBalance = (horizontalBalance + verticalBalance) / 2;
      const aspectScore = Math.max(0, 1 - Math.abs(1 - aspect) / 0.38);
      const pinkCoreRatio = pinkCorePixels / Math.max(1, originalPixels.length);
      const densityScore = density <= 0.55
        ? Math.max(0, Math.min(1, (density - 0.10) / 0.14))
        : Math.max(0, Math.min(1, (0.72 - density) / 0.17));
      const shapeConfidence = (
        aspectScore * 0.23
        + diamondFit * 0.20
        + axisBalance * 0.18
        + tipSharpness * 0.17
        + densityScore * 0.15
        + pinkCoreRatio * 0.07
      );

      if (hasLeft && hasRight && hasTop && hasBottom && diamondFit >= 0.76) {
        candidates.push({
          x: minX,
          y: minY,
          centerX,
          centerY,
          width: boxWidth,
          height: boxHeight,
          pixelCount: originalPixels.length,
          density,
          averageRedGreenContrast,
          diamondFit,
          pinkCoreRatio,
          densityScore,
          axisBalance,
          tipSharpness,
          shapeConfidence,
          isStrongRuneShape: shapeConfidence >= 0.74,
          isCertainRuneShape: shapeConfidence >= 0.82
        });
      }
    }

    return candidates;
  }

  isRuneMagentaPixel(r, g, b) {
    return (
      r >= 135 &&
      b >= 145 &&
      g <= 165 &&
      r - g >= 22 &&
      b - g >= 28 &&
      Math.abs(r - b) <= 105
    );
  }

  isRunePinkCorePixel(r, g, b) {
    return (
      r >= 150 &&
      b >= 145 &&
      g <= 155 &&
      r - g >= 35 &&
      b - g >= 32 &&
      Math.abs(r - b) <= 78
    );
  }

  /**
   * 화면 공유를 시작했을 때부터 같은 위치에 반복되는 보라색 표식은
   * 아르테리아 지형/포털 등 미니맵의 고정 장식으로 기록한다.
   * 룬은 이후 새 좌표에 출현하므로 이 배경 목록과 겹치지 않는 후보만 사용한다.
   */
  learnRuneBackgroundCandidates(candidates, imageData, protectedCandidates = []) {
    const state = this.runeState;
    state.backgroundLearningFrames++;

    // 도형 후보 여부와 별개로, 학습 중 보였던 보라색 위치를 모두 배경으로 기록한다.
    // 그러면 맵 구조물이 프레임마다 조금씩 다른 연결 덩어리로 분리되어도 룬으로 바뀌지 않는다.
    const { data, width, height } = imageData;
    if (
      !state.backgroundColorMask ||
      state.backgroundMaskWidth !== width ||
      state.backgroundMaskHeight !== height
    ) {
      state.backgroundColorMask = new Uint8Array(width * height);
      state.backgroundMaskWidth = width;
      state.backgroundMaskHeight = height;
    }
    for (let p = 0; p < width * height; p++) {
      const index = p * 4;
      const x = p % width;
      const y = Math.floor(p / width);
      const isProtected = protectedCandidates.some((candidate) => (
        x >= candidate.x - 2
        && x <= candidate.x + candidate.width + 2
        && y >= candidate.y - 2
        && y <= candidate.y + candidate.height + 2
      ));
      if (isProtected) continue;
      if (this.isRuneMagentaPixel(data[index], data[index + 1], data[index + 2])) {
        state.backgroundColorMask[p] = 1;
      }
    }

    for (const candidate of candidates) {
      const radius = Math.max(4, Math.max(candidate.width, candidate.height) * 0.7);
      let track = state.backgroundCandidateTracks.find((item) => (
        Math.hypot(item.centerX - candidate.centerX, item.centerY - candidate.centerY) <= radius
      ));

      if (!track) {
        track = {
          centerX: candidate.centerX,
          centerY: candidate.centerY,
          width: candidate.width,
          height: candidate.height,
          seenFrames: 0
        };
        state.backgroundCandidateTracks.push(track);
      }

      track.seenFrames++;
      const weight = 1 / track.seenFrames;
      track.centerX += (candidate.centerX - track.centerX) * weight;
      track.centerY += (candidate.centerY - track.centerY) * weight;
      track.width += (candidate.width - track.width) * weight;
      track.height += (candidate.height - track.height) * weight;
    }

    if (state.backgroundLearningFrames >= state.BACKGROUND_LEARNING_REQUIRED) {
      // JPEG 흔들림 때문에 매 프레임 잡히지 않아도 절반 이상 반복되면 고정 표식이다.
      const minimumSeenFrames = Math.ceil(state.BACKGROUND_LEARNING_REQUIRED * 0.5);
      state.backgroundCandidates = state.backgroundCandidateTracks
        .filter((item) => item.seenFrames >= minimumSeenFrames);
      // 학습이 끝난 시점의 미니맵을 저장해, 다른 맵 이동 시 자동으로 재학습한다.
      state.mapReferenceData = new Uint8ClampedArray(imageData.data);
      state.mapTransitionFrames = 0;
    }
  }

  hasRuneMapChanged(imageData) {
    const state = this.runeState;
    const reference = state.mapReferenceData;
    if (!reference || reference.length !== imageData.data.length) return false;

    const { data } = imageData;
    let sampledPixels = 0;
    let changedPixels = 0;
    // 미니맵의 캐릭터/몹 표시 변화는 작다. 일정 간격으로 샘플링해 맵 윤곽 자체가
    // 바뀌었을 때만 재학습하도록 한다.
    for (let index = 0; index < data.length; index += 4 * 4) {
      const difference = Math.abs(data[index] - reference[index])
        + Math.abs(data[index + 1] - reference[index + 1])
        + Math.abs(data[index + 2] - reference[index + 2]);
      if (difference >= 105) changedPixels++;
      sampledPixels++;
    }
    return changedPixels / Math.max(1, sampledPixels) >= 0.34;
  }

  restartRuneBackgroundLearning() {
    const state = this.runeState;
    state.backgroundLearningFrames = 0;
    state.backgroundCandidateTracks = [];
    state.backgroundCandidates = [];
    state.backgroundColorMask = null;
    state.backgroundMaskWidth = 0;
    state.backgroundMaskHeight = 0;
    state.mapReferenceData = null;
    state.mapTransitionFrames = 0;
    state.pendingCandidate = null;
    state.consecutiveCount = 0;
    state.candidateStableSince = 0;
  }

  isRuneBackgroundCandidate(candidate) {
    return this.runeState.backgroundCandidates.some((background) => {
      const radius = Math.max(
        5,
        Math.max(candidate.width, candidate.height, background.width, background.height) * 0.8
      );
      const sizeRatio = Math.max(
        candidate.width / Math.max(1, background.width),
        background.width / Math.max(1, candidate.width),
        candidate.height / Math.max(1, background.height),
        background.height / Math.max(1, candidate.height)
      );
      return (
        sizeRatio <= 1.8 &&
        Math.hypot(background.centerX - candidate.centerX, background.centerY - candidate.centerY) <= radius
      );
    });
  }

  isRuneNovelCandidate(candidate, imageData) {
    const state = this.runeState;
    const baseline = state.backgroundColorMask;
    if (
      !baseline ||
      state.backgroundMaskWidth !== imageData.width ||
      state.backgroundMaskHeight !== imageData.height
    ) return true;

    const { data, width, height } = imageData;
    const xStart = Math.max(0, Math.floor(candidate.x));
    const yStart = Math.max(0, Math.floor(candidate.y));
    const xEnd = Math.min(width, Math.ceil(candidate.x + candidate.width));
    const yEnd = Math.min(height, Math.ceil(candidate.y + candidate.height));
    let coloredPixels = 0;
    let newPixels = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const p = y * width + x;
        const index = p * 4;
        if (!this.isRuneMagentaPixel(data[index], data[index + 1], data[index + 2])) continue;
        coloredPixels++;
        if (!baseline[p]) newPixels++;
      }
    }

    // 기존 구조물의 색조 변화나 가장자리 흔들림은 일부 새 픽셀만 만든다.
    // 룬은 비어 있던 좌표에 표식 전체가 추가되므로 충분한 신규 비율을 요구한다.
    return newPixels >= 6 && newPixels / Math.max(1, coloredPixels) >= 0.32;
  }

  isKnownRuneFalseZone(candidate, imageData) {
    const horizontalRatio = candidate.centerX / Math.max(1, imageData.width);
    const verticalRatio = candidate.centerY / Math.max(1, imageData.height);
    return this.runeState.KNOWN_FALSE_ZONES.some((zone) => {
      const normalizedX = (horizontalRatio - zone.x) / zone.radiusX;
      const normalizedY = (verticalRatio - zone.y) / zone.radiusY;
      return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
    });
  }

  isRuneCandidateAccepted(candidate, imageData, isLearningBackground = false) {
    const horizontalRatio = candidate.centerX / Math.max(1, imageData.width);
    const verticalRatio = candidate.centerY / Math.max(1, imageData.height);
    const isKnownFalseZone = this.isKnownRuneFalseZone(candidate, imageData);

    // 핑크 마름모 형태가 확실하면 기존 배경 마스크나 오른쪽 75% 제한을 우회한다.
    // 실제 룬이 보라색 지형 위나 오른쪽에 생성되어도 놓치지 않기 위한 우선 경로다.
    if (candidate.isStrongRuneShape) {
      const isInsideExpandedMap = (
        horizontalRatio >= 0.08 && horizontalRatio <= 0.92
        && verticalRatio >= 0.08 && verticalRatio <= 0.94
      );
      if (!isInsideExpandedMap) return false;
      // 네 장에서 반복된 두 위치는 아주 확실한 마름모만 통과시킨다.
      return !isKnownFalseZone || candidate.isCertainRuneShape;
    }

    // 배경 학습 중 약한 후보는 고정 구조물로만 학습하고 알림에는 사용하지 않는다.
    if (isLearningBackground || isKnownFalseZone) return false;

    const isInsideLegacyMap = horizontalRatio >= 0.14 && horizontalRatio <= 0.75;
    const isStaticArteriaMiddleCrystal = (
      horizontalRatio >= 0.41 && horizontalRatio <= 0.55
      && verticalRatio >= 0.30 && verticalRatio <= 0.43
    );
    return (
      isInsideLegacyMap
      && !isStaticArteriaMiddleCrystal
      && !this.isRuneBackgroundCandidate(candidate)
      && this.isRuneNovelCandidate(candidate, imageData)
    );
  }

  processRuneFrame(runeImageData, fullImageData) {
    const state = this.runeState;
    if (state.backgroundLearningFrames >= state.BACKGROUND_LEARNING_REQUIRED) {
      state.mapTransitionFrames = this.hasRuneMapChanged(runeImageData)
        ? state.mapTransitionFrames + 1
        : 0;
      if (state.mapTransitionFrames >= state.MAP_TRANSITION_REQUIRED) {
        this.restartRuneBackgroundLearning();
      }
    }

    const allCandidates = this.findRuneDiamondCandidates(runeImageData);
    const isLearningBackground = (
      this.runeState.backgroundLearningFrames < this.runeState.BACKGROUND_LEARNING_REQUIRED
    );

    if (isLearningBackground) {
      const protectedCandidates = allCandidates.filter((candidate) => candidate.isStrongRuneShape);
      const backgroundCandidates = allCandidates.filter((candidate) => !candidate.isStrongRuneShape);
      this.learnRuneBackgroundCandidates(backgroundCandidates, runeImageData, protectedCandidates);
      if (protectedCandidates.length === 0) {
        this.runeState.consecutiveCount = 0;
        this.runeState.lastPixelCount = 0;
        this.runeState.lastCandidateCount = 0;
        this.runeState.lastCandidates = [];
        this.runeState.candidateStableSince = 0;
      }
      const isLive = window.screenCaptureManager?.isStreaming;
      if (this.onRuneStatusChange && isLive && protectedCandidates.length === 0) {
        this.onRuneStatusChange('🟣 미니맵 고정 보라 표식 구분 중', false);
      }
      if (protectedCandidates.length === 0) return;
    }

    const candidates = allCandidates.filter((candidate) => (
      this.isRuneCandidateAccepted(candidate, runeImageData, isLearningBackground)
    ));
    const runeColorPixels = candidates.reduce((sum, candidate) => sum + candidate.pixelCount, 0);

    this.runeState.lastPixelCount = runeColorPixels;
    this.runeState.lastCandidateCount = candidates.length;
    this.runeState.lastCandidates = candidates.map((candidate) => ({ ...candidate }));
    // 프레임마다 다른 보라 점을 이어 붙여 감지하지 않도록 같은 위치·크기의 후보만
    // 연속 감지로 인정한다. 이동/깜빡임이 있는 캐릭터 표식과 전투 이펙트를 제외한다.
    const previousCandidate = this.runeState.pendingCandidate;
    const stableCandidate = previousCandidate
      ? candidates.find((candidate) => {
        const positionTolerance = Math.max(3, Math.max(candidate.width, candidate.height) * 0.45);
        const sizeRatio = Math.max(
          candidate.width / Math.max(1, previousCandidate.width),
          previousCandidate.width / Math.max(1, candidate.width),
          candidate.height / Math.max(1, previousCandidate.height),
          previousCandidate.height / Math.max(1, candidate.height)
        );
        return (
          Math.hypot(candidate.centerX - previousCandidate.centerX, candidate.centerY - previousCandidate.centerY) <= positionTolerance
          && sizeRatio <= 1.35
        );
      })
      : null;
    const isDetected = Boolean(stableCandidate || (!previousCandidate && candidates.length > 0));

    const isLive = window.screenCaptureManager?.isStreaming;

    if (isDetected) {
      const candidate = stableCandidate || candidates[0];
      const now = Date.now();
      this.runeState.candidateMissFrames = 0;
      this.runeState.consecutiveCount = stableCandidate
        ? this.runeState.consecutiveCount + 1
        : 1;
      if (!stableCandidate || !this.runeState.candidateStableSince) {
        this.runeState.candidateStableSince = now;
      }
      this.runeState.pendingCandidate = { ...candidate };
      const stableDuration = now - this.runeState.candidateStableSince;

      if (
        this.runeState.consecutiveCount >= this.runeState.REQUIRED_CONSECUTIVE
        && stableDuration >= this.runeState.REQUIRED_STABLE_MS
        && !this.runeState.isDetected
        && !this.runeState.cooldownActive
      ) {
        this.triggerRuneAlert(runeColorPixels);
      }
    } else {
      // 화면 공유 압축이나 순간 이펙트 때문에 한 프레임만 후보가 끊기는 경우에는
      // 누적 판정을 보존한다. 네 프레임 연속 사라질 때만 처음부터 다시 확인한다.
      if (this.runeState.pendingCandidate && this.runeState.candidateMissFrames < 3) {
        this.runeState.candidateMissFrames++;
        return;
      }
      this.runeState.consecutiveCount = 0;
      this.runeState.pendingCandidate = null;
      this.runeState.candidateMissFrames = 0;
      this.runeState.candidateStableSince = 0;

      if (this.runeState.cooldownActive) {
        this.runeState.normReturnFrames++;
        if (this.runeState.normReturnFrames >= 10) {
          this.runeState.cooldownActive = false;
          this.runeState.isDetected = false;
          this.runeState.normReturnFrames = 0;
          if (this.onRuneStatusChange) {
            this.onRuneStatusChange(isLive ? '🟢 미니맵 스캔 중 (룬 형태 없음)' : '⚪ 대기 중', false);
          }
        }
      } else if (!this.runeState.isDetected) {
        if (this.onRuneStatusChange && isLive) {
          this.onRuneStatusChange('🟢 미니맵 스캔 중 (룬 형태 없음)', false);
        }
      }
    }
  }

  triggerRuneAlert(pixelCount = 0) {
    this.runeState.isDetected = true;
    this.runeState.cooldownActive = true;
    this.runeState.normReturnFrames = 0;

    if (this.onRuneStatusChange) {
      this.onRuneStatusChange(`🚨 룬 감지됨! (마름모 형태, ${pixelCount}픽셀)`, true);
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
  buildPopupIntegralMasks(imageData) {
    const { data, width, height } = imageData;
    const keys = ['dark', 'cyan', 'bright', 'pink', 'yellow', 'tan', 'green', 'blue'];
    const masks = Object.fromEntries(keys.map(key => [key, new Uint32Array((width + 1) * (height + 1))]));

    for (let y = 1; y <= height; y++) {
      const row = Object.fromEntries(keys.map(key => [key, 0]));
      for (let x = 1; x <= width; x++) {
        const idx = ((y - 1) * width + x - 1) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const flags = {
          dark: r < 75 && g < 85 && b < 95,
          cyan: g > 85 && b > 90 && g > r * 1.15 && b > r * 1.15,
          bright: r > 175 && g > 175 && b > 170,
          pink: r > 145 && b > 105 && r > g * 1.25,
          yellow: r > 145 && g > 105 && b < 100 && r > b * 1.6,
          tan: r > 105 && g > 75 && b < 90 && r > b * 1.45,
          green: g > 105 && g > r * 1.25 && g > b * 1.15,
          blue: b > 85 && b > r * 1.25 && g > r * 1.1
        };
        for (const key of keys) {
          if (flags[key]) row[key]++;
          const pos = y * (width + 1) + x;
          masks[key][pos] = masks[key][pos - width - 1] + row[key];
        }
      }
    }
    return masks;
  }

  popupRegionRatio(mask, width, height, x, y, w, h, rx, ry, rw, rh) {
    const stride = width + 1;
    const x1 = Math.max(0, x + Math.floor(w * rx));
    const y1 = Math.max(0, y + Math.floor(h * ry));
    const x2 = Math.min(width, x + Math.max(1, Math.floor(w * (rx + rw))));
    const y2 = Math.min(height, y + Math.max(1, Math.floor(h * (ry + rh))));
    const count = mask[y2 * stride + x2] - mask[y1 * stride + x2]
      - mask[y2 * stride + x1] + mask[y1 * stride + x1];
    return count / Math.max(1, (x2 - x1) * (y2 - y1));
  }

  findPopupStructure(imageData) {
    const { width, height } = imageData;
    const masks = this.buildPopupIntegralMasks(imageData);
    const heights = [36, 44, 54, 66, 80, 94].filter(value => value < height);
    let best = { found: false, type: '', confidence: 0 };

    for (const h of heights) {
      for (const aspect of [0.9, 1.08, 1.25, 1.45]) {
        const w = Math.round(h * aspect);
        if (w >= width) continue;
        for (let y = 0; y <= height - h; y += 3) {
          for (let x = 0; x <= width - w; x += 3) {
            const ratio = (key, rx, ry, rw, rh) =>
              this.popupRegionRatio(masks[key], width, height, x, y, w, h, rx, ry, rw, rh);
            const headerDark = ratio('dark', 0.02, 0.00, 0.96, 0.20);

            const middleCyan = ratio('cyan', 0.05, 0.20, 0.90, 0.38);
            const lowerDark = ratio('dark', 0.05, 0.57, 0.90, 0.38);
            const lowerRightPink = ratio('pink', 0.55, 0.55, 0.42, 0.42);
            const headerYellow = ratio('yellow', 0.03, 0.02, 0.94, 0.18);
            if (headerDark >= 0.24 && middleCyan >= 0.18 && lowerDark >= 0.20 &&
                lowerRightPink >= 0.025 && headerYellow >= 0.006) {
              const confidence = headerDark * 1.2 + middleCyan * 1.8 + lowerDark +
                lowerRightPink * 1.8 + headerYellow;
              if (confidence > best.confidence) {
                best = { found: true, type: '버섯 안내창형 거짓말 탐지기', confidence };
              }
            }

            const upperBright = ratio('bright', 0.05, 0.18, 0.90, 0.30);
            const middleBright = ratio('bright', 0.05, 0.45, 0.90, 0.25);
            const bottomTan = ratio('tan', 0.08, 0.72, 0.84, 0.25);
            const bottomGreen = ratio('green', 0.08, 0.72, 0.84, 0.25);
            if (headerDark >= 0.18 && upperBright >= 0.42 && middleBright >= 0.32 &&
                bottomTan >= 0.07 && bottomGreen >= 0.004) {
              const confidence = headerDark + upperBright * 1.5 + middleBright +
                bottomTan * 1.4 + bottomGreen;
              if (confidence > best.confidence) {
                best = { found: true, type: '도형 선택형 거짓말 탐지기', confidence };
              }
            }

            const topBlue = ratio('blue', 0.04, 0.04, 0.92, 0.25);
            const middleBlue = ratio('blue', 0.04, 0.26, 0.92, 0.42);
            const bottomBlue = ratio('blue', 0.04, 0.68, 0.92, 0.27);
            const middleYellow = ratio('yellow', 0.05, 0.18, 0.90, 0.55);
            if (topBlue >= 0.16 && middleBlue >= 0.20 && bottomBlue >= 0.16 &&
                middleYellow >= 0.012 && headerDark >= 0.10) {
              const confidence = topBlue + middleBlue * 1.3 + bottomBlue +
                middleYellow * 1.8 + headerDark;
              if (confidence > best.confidence) {
                best = { found: true, type: '파란 이미지 선택형 거짓말 탐지기', confidence };
              }
            }
          }
        }
      }
    }
    return best;
  }

  buildPopupRgbIntegrals(imageData) {
    const { data, width, height } = imageData;
    const size = (width + 1) * (height + 1);
    const sums = [new Uint32Array(size), new Uint32Array(size), new Uint32Array(size)];
    for (let y = 1; y <= height; y++) {
      const row = [0, 0, 0];
      for (let x = 1; x <= width; x++) {
        const pixel = ((y - 1) * width + x - 1) * 4;
        const pos = y * (width + 1) + x;
        for (let channel = 0; channel < 3; channel++) {
          row[channel] += data[pixel + channel];
          sums[channel][pos] = sums[channel][pos - width - 1] + row[channel];
        }
      }
    }
    return sums;
  }

  popupRgbCellMean(integral, width, x1, y1, x2, y2) {
    const stride = width + 1;
    const total = integral[y2 * stride + x2] - integral[y1 * stride + x2]
      - integral[y2 * stride + x1] + integral[y1 * stride + x1];
    return total / Math.max(1, (x2 - x1) * (y2 - y1));
  }

  findPopupTemplateMatch(imageData) {
    const templates = window.POPUP_TEMPLATES;
    if (!templates || !imageData?.data?.length) return { found: false, type: '', confidence: 0 };
    const { width, height } = imageData;
    const integrals = this.buildPopupRgbIntegrals(imageData);
    let best = { found: false, type: '', confidence: 0, score: Infinity, normalizedScore: Infinity };

    for (const template of Object.values(templates)) {
      for (const h of [32, 40, 48, 58, 70, 84, 98]) {
        const w = Math.round(h * template.aspect);
        if (w >= width || h >= height) continue;
        for (let y = 0; y <= height - h; y += 3) {
          for (let x = 0; x <= width - w; x += 3) {
            let difference = 0;
            for (let gridY = 0; gridY < 8; gridY++) {
              const y1 = y + Math.floor(h * gridY / 8);
              const y2 = y + Math.floor(h * (gridY + 1) / 8);
              for (let gridX = 0; gridX < 8; gridX++) {
                const x1 = x + Math.floor(w * gridX / 8);
                const x2 = x + Math.floor(w * (gridX + 1) / 8);
                const expected = template.pixels[gridY][gridX];
                for (let channel = 0; channel < 3; channel++) {
                  const actual = this.popupRgbCellMean(integrals[channel], width, x1, y1, x2, y2);
                  difference += Math.abs(actual - expected[channel]);
                }
              }
            }
            const score = difference / (8 * 8 * 3);
            const normalizedScore = score / template.threshold;
            if (normalizedScore < best.normalizedScore) {
              best = {
                found: normalizedScore <= 1,
                type: template.type,
                score,
                normalizedScore,
                confidence: Math.max(0, 1 - normalizedScore)
              };
            }
          }
        }
      }
    }
    return best;
  }

  processPopupStructureFrame(imageData) {
    if (!imageData?.data?.length) return;
    const match = this.findPopupTemplateMatch(imageData);
    this.popupState.lastConfidence = match.confidence;

    if (match.found) {
      this.popupState.missedCount = 0;
      this.popupState.consecutiveCount = this.popupState.lastType === match.type
        ? this.popupState.consecutiveCount + 1
        : 1;
      this.popupState.lastType = match.type;

      if (this.popupState.consecutiveCount >= 3 &&
          !this.popupState.isDetected && !this.popupState.cooldownActive) {
        this.triggerPopupStructureAlert(match.type);
      }
      return;
    }

    this.popupState.consecutiveCount = 0;
    this.popupState.missedCount++;
    if (this.popupState.cooldownActive && this.popupState.missedCount >= 5) {
      this.popupState.cooldownActive = false;
      this.popupState.isDetected = false;
      this.popupState.lastType = '';
      if (this.onPopupStatusChange && window.screenCaptureManager?.isStreaming) {
        this.onPopupStatusChange('🟢 거탐 감시 중 (4종 정밀 인식)', false);
      }
    }
  }

  triggerPopupStructureAlert(detectedType) {
    this.popupState.isDetected = true;
    this.popupState.cooldownActive = true;
    if (this.onPopupStatusChange) {
      this.onPopupStatusChange(`🚨 ${detectedType} 감지`, true);
    }
    if (window.audioNotifier) {
      window.audioNotifier.notify(`🚨 [메이플] ${detectedType}가 감지되었습니다. 화면을 확인하세요!`, 'popup');
    }
  }

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
   * 📌 메이플 버프창 상단/하단 화살표(>) 2중 절대 앵커 포착기
   *   유저 지적 반영: 1열 버프가 길어지면 2줄을 차지(줄바꿈)할 수 있음.
   *   그러나 각 줄(열)의 제일 우측에는 항상 독립된 검은 박스 + 흰색 > 화살표 버튼이 붙어있음!
   *   - topArrowY: 가장 상단의 1번째 화살표 버튼 Y좌표 => 1열(Row 1: 솔 야누스) 절대 앵커
   *   - bottomArrowY: 가장 하단의 마지막 화살표 버튼 Y좌표 => 3열(Row 3: 익스트림 골드) 절대 앵커
   */
  findBuffBarArrowAnchors(data, width, height) {
    let topArrowY = -1;
    let bottomArrowY = -1;
    let arrowX = -1;

    for (let y = 0; y < Math.min(height, 160); y++) {
      for (let x = Math.max(0, width - 50); x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 화살표 > 내부의 강렬한 흰색/밝은 픽셀 (R>=215, G>=215, B>=215)
        if (r >= 215 && g >= 215 && b >= 215) {
          // 주변 2픽셀 내에 검은 배경(R,G,B <= 40)이 인접해 있으면 우측 화살표 앵커로 확정!
          let blackCount = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = (ny * width + nx) * 4;
                if (data[nIdx] <= 40 && data[nIdx + 1] <= 40 && data[nIdx + 2] <= 40) {
                  blackCount++;
                }
              }
            }
          }

          if (blackCount >= 4) {
            arrowX = x;
            if (topArrowY === -1) {
              topArrowY = y; // 가장 첫 번째 발견된 상단 화살표 (1열 앵커)
            }
            bottomArrowY = y; // 가장 마지막으로 발견된 하단 화살표 (3열 앵커)
          }
        }
      }
    }

    return { x: arrowX, topY: topArrowY, bottomY: bottomArrowY };
  }

  /**
   * ⚡ 솔 야누스 새벽(설치기) 전용 스캐너 (상단 화살표 = 1열 절대 앵커 스캔)
   */
  processJanusFrame(imageData) {
    if (!imageData || !imageData.data || imageData.data.length === 0) return;

    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // 상단/하단 화살표 > 앵커 포착
    const anchors = this.findBuffBarArrowAnchors(data, width, height);

    // 1열(Row 1) 스캔 범위: 상단 화살표 topY 기준 Y: -16 ~ +24
    const row1MinY = anchors.topY !== -1 ? Math.max(0, anchors.topY - 16) : 0;
    const row1MaxY = anchors.topY !== -1 ? Math.min(height - 1, anchors.topY + 26) : Math.floor(height * 0.45);

    let janusOrbPixels = 0;
    let orbMinX = width, orbMaxX = 0, orbMinY = height, orbMaxY = 0;

    // ===== 1단계: 1열(Row 1) 내에서 솔 야누스 '새벽' (보라 구체) 포착 =====
    for (let y = row1MinY; y <= row1MaxY; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 유저 첨부 2장 스크린샷 100% 매칭: 솔 야누스 새벽 메카닉 톱니 구체 (어두운 회보라 링 + 4개 도트)
        const isDawnViolet = (
          (r >= 60 && r <= 150 && g >= 50 && g <= 130 && b >= 115 && b <= 220 && (b - g >= 25)) ||
          (r >= 45 && r <= 120 && g >= 45 && g <= 115 && b >= 70 && b <= 170)
        );

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

        // 노란 숫자가 피크 대비 45% 이하로 급감 = 유저 스크린샷 '9'초, '8'초 한 자릿수 진입!
        const peak = this.janusState.peakYellowDigitCount;
        const isLowDigit = (peak > 0 && yellowDigitPixels <= peak * 0.45 && yellowDigitPixels >= 1);

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

    // 상단/하단 화살표 > 앵커 포착
    const anchors = this.findBuffBarArrowAnchors(data, width, height);

    // 3열(Row 3) 스캔 범위: 하단 화살표 bottomY 기준 Y: -16 ~ +24 (가장 마지막 화살표 줄)
    const row3MinY = anchors.bottomY !== -1 ? Math.max(0, anchors.bottomY - 16) : Math.floor(height * 0.40);
    const row3MaxY = anchors.bottomY !== -1 ? Math.min(height - 1, anchors.bottomY + 28) : height - 1;

    // ===== 1. 3열(Row 3) 내에서 익스트림 골드 (황금 물약) 전용 아이콘 픽셀 포착 =====
    let extremeGoldPixels = 0;
    let buffMinX = width, buffMaxX = 0, buffMinY = height, buffMaxY = 0;

    for (let y = row3MinY; y <= row3MaxY; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 유저 첨부 스크린샷 3열 8번째 익스트림 골드 (황금 캡 마개 + 노란빛 물약병) 100% 매칭 픽셀 (R>=180, G>=140, B<=110, R-B>=80)
        const isGoldPotion = (r >= 180 && g >= 140 && b <= 110 && (r - b >= 80));

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
    window.버프영상수집기?.captureEnding?.('janus');
    if (this.onJanusStatusChange) this.onJanusStatusChange('🚨 야누스 종료 임박! 재설치하세요!', true);

    if (window.audioNotifier) {
      window.audioNotifier.notify('솔 야누스 종료가 임박했습니다. 지금 재설치하세요!', 'janus');
    }
  }

  triggerExtremeGoldEndingAlert() {
    this.expBuffState.alert10Triggered = true;
    window.버프영상수집기?.captureEnding?.('gold');
    if (this.onExpBuffStatusChange) {
      this.onExpBuffStatusChange('🚨 익스트림 골드 종료 임박! 재사용하세요!', true);
    }
    if (window.audioNotifier) {
      window.audioNotifier.notify('익스트림 골드 종료가 임박했습니다. 지금 재사용하세요!', 'exp');
    }
  }

  /**
   * 실제 사냥 화면에서 채집한 33px 버프 아이콘 표본을 찾는다.
   * 넓은 색상 픽셀 수가 아니라 아이콘 내부 8x8 RGB 배열을 비교한다.
   */
  findBuffTemplateMatch(imageData, templateName, targetArrowNumber = null, preferredLocation = null) {
    const template = window.BUFF_ICON_TEMPLATES?.[templateName];
    if (!imageData?.data || !template) return { found: false, score: Infinity, x: 0, y: 0 };
    const templateCandidates = templateName === 'janus'
      ? (window.BUFF_ICON_TEMPLATES.janusVariants || [template])
      : templateName === 'janusEnding'
        ? (window.BUFF_ICON_TEMPLATES.janusEndingVariants || [template])
      : templateName === 'extremeGold'
        ? (window.BUFF_ICON_TEMPLATES.extremeGoldVariants || [template])
        : [template];

    const { data, width, height } = imageData;
    // 화면 공유 원본 해상도와 메이플 UI 배율에 따라 같은 아이콘이
    // 약 33px 또는 2배인 66px 전후로 들어온다. 한 크기로 고정하면
    // 템플릿이 정확해도 전혀 다른 영역을 비교하게 되므로 여러 배율을 함께 찾는다.
    const isJanusFamily = templateName === 'janus' || templateName === 'janusEnding';
    const candidateSizes = (isJanusFamily || templateName === 'extremeGold')
      ? [33, 44, 56, 66]
      : [33];
    const usableSizes = candidateSizes.filter((candidateSize) => (
      width >= candidateSize && height >= candidateSize
    ));
    if (!usableSizes.length) {
      return { found: false, score: Infinity, x: 0, y: 0, size: 33 };
    }

    const scoreAt = (left, top, size) => {
      let bestTemplateScore = Infinity;
      for (const candidateTemplate of templateCandidates) {
        let difference = 0;
        let compared = 0;
        for (let gy = 0; gy < 8; gy++) {
          for (let gx = 0; gx < 8; gx++) {
            const t = (gy * 8 + gx) * 3;
            if (candidateTemplate[t] < 0) continue;

            const px = Math.min(width - 1, left + Math.round((gx + 0.5) * size / 8));
            const py = Math.min(height - 1, top + Math.round((gy + 0.5) * size / 8));
            const idx = (py * width + px) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // 야누스 위에 겹쳐진 노란 시간 숫자는 프레임마다 바뀌므로 제외한다.
            if (isJanusFamily && r >= 145 && g >= 135 && b <= 125) continue;

            difference += Math.abs(r - candidateTemplate[t]);
            difference += Math.abs(g - candidateTemplate[t + 1]);
            difference += Math.abs(b - candidateTemplate[t + 2]);
            compared += 3;
          }
        }
        const candidateScore = compared ? difference / compared : Infinity;
        if (candidateScore < bestTemplateScore) bestTemplateScore = candidateScore;
      }
      return bestTemplateScore;
    };

    // 이미 확인한 아이콘은 직전 칸 주변을 먼저 정밀 추적한다.
    // 버프 줄이 그대로인 대부분의 프레임에서 전체 ROI 탐색을 생략해 룬 판정을 막지 않는다.
    if (
      preferredLocation &&
      Number.isFinite(preferredLocation.x) &&
      Number.isFinite(preferredLocation.y) &&
      usableSizes.includes(preferredLocation.size)
    ) {
      const size = preferredLocation.size;
      const areaScale = Math.pow(size / 33, 2);
      const isJanus = templateName === 'janus';
      const isJanusEnding = templateName === 'janusEnding';
      const threshold = isJanus
        ? 20
        : (isJanusEnding ? 30 : 50);
      const localCandidates = [];
      const rememberLocalCandidate = (candidate) => {
        localCandidates.push(candidate);
        localCandidates.sort((a, b) => a.score - b.score);
        if (localCandidates.length > 12) localCandidates.length = 12;
      };
      const radiusX = Math.max(5, Math.round(size * 0.22));
      // 한 화살표 묶음이 1줄↔2줄로 바뀌면 같은 아이콘의 Y가 정확히 한 칸가량 이동한다.
      const radiusY = templateName === 'extremeGold'
        ? Math.max(radiusX, Math.round(size * 1.25))
        : radiusX;
      const minX = Math.max(0, Math.round(preferredLocation.x) - radiusX);
      const maxX = Math.min(width - size, Math.round(preferredLocation.x) + radiusX);
      const minY = Math.max(0, Math.round(preferredLocation.y) - radiusY);
      const maxY = Math.min(height - size, Math.round(preferredLocation.y) + radiusY);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const score = scoreAt(x, y, size);
          if (
            localCandidates.length < 12 ||
            score < localCandidates[localCandidates.length - 1].score
          ) {
            rememberLocalCandidate({ score, x, y, size });
          }
        }
      }

      for (const localBest of localCandidates) {
        const shape = this.measureBuffIconShape(
          imageData,
          localBest.x,
          localBest.y,
          localBest.size
        );
        const shapePassed = isJanus
          ? shape.violetPixels >= 18 * areaScale && shape.darkPixels >= 30 * areaScale
          : isJanusEnding
            ? shape.grayBluePixels >= 90 * areaScale && shape.darkPixels >= 20 * areaScale
            : (
              shape.goldPixels >= 35 * areaScale &&
              shape.goldPixels <= 400 * areaScale &&
              shape.darkPixels >= 140 * areaScale &&
              shape.centerGoldPixels >= 16 * areaScale &&
              shape.upperCenterGoldPixels >= 4 * areaScale &&
              shape.centerGoldVerticalSpan >= size * 0.2
            );
        if (localBest.score <= threshold && shapePassed) {
          return {
            ...localBest,
            found: true,
            shape,
            threshold,
            normalizedScore: localBest.score / threshold,
            searchBand: {
              top: minY,
              bottom: maxY + size,
              anchored: true,
              tracked: true,
              arrowNumber: targetArrowNumber
            },
            inPreferredBand: true
          };
        }
      }
    }

    let best = { score: Infinity, x: 0, y: 0, size: usableSizes[0] };
    const refinedCandidates = [];

    // 메이플 버프 슬롯은 우측 정렬 30px 격자다. 각 슬롯 주변 ±5px만
    // 정밀 탐색하여 전투 화면을 훑는 오인식과 연산량을 함께 줄인다.
    // 화살표 하나에 버프가 한 줄 또는 두 줄로 배치될 수 있다.
    // 화면 높이의 고정 비율을 사용하지 않고 오른쪽 화살표의 실제 Y 군집을 기준으로
    // 해당 묶음의 두 줄까지 검색한다. 화살표 검출이 불확실하면 전체 범위로 복귀한다.
    const arrowHitsByY = new Array(height).fill(0);
    const arrowSearchLeft = Math.max(0, width - Math.max(28, Math.round(width * 0.08)));
    for (let y = 1; y < height - 1; y++) {
      for (let x = arrowSearchLeft; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if (r < 205 || g < 205 || b < 205) continue;

        let darkNeighbors = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const n = (ny * width + nx) * 4;
            if (data[n] < 75 && data[n + 1] < 75 && data[n + 2] < 75) darkNeighbors++;
          }
        }
        if (darkNeighbors >= 3) arrowHitsByY[y]++;
      }
    }

    const arrowRows = [];
    let clusterStart = -1;
    let weightedY = 0;
    let clusterWeight = 0;
    for (let y = 0; y <= height; y++) {
      const weight = y < height ? arrowHitsByY[y] : 0;
      if (weight > 0) {
        if (clusterStart < 0) clusterStart = y;
        weightedY += y * weight;
        clusterWeight += weight;
      } else if (clusterStart >= 0) {
        if (clusterWeight >= 3) arrowRows.push(Math.round(weightedY / clusterWeight));
        clusterStart = -1;
        weightedY = 0;
        clusterWeight = 0;
      }
    }

    const distinctArrowRows = arrowRows.filter((rowY, index) => (
      index === 0 || rowY - arrowRows[index - 1] >= 8
    ));

    const isJanus = templateName === 'janus';
    const isJanusEnding = templateName === 'janusEnding';

    for (const size of usableSizes) {
      const maxIconTop = height - size;
      const anchorY = targetArrowNumber
        ? distinctArrowRows[targetArrowNumber - 1]
        : undefined;
      const hasReliableAnchor = Number.isFinite(anchorY);
      // 화살표가 첫 줄 중앙에 붙는 경우와 두 줄 묶음 중앙에 붙는 경우를 모두 포함한다.
      // 이 범위는 검색을 자르는 용도가 아니라 후보의 신뢰도를 보강하는 용도로만 쓴다.
      // 아이콘은 버프 수 변화로 다른 줄/위치로 이동할 수 있으므로 항상 전체 ROI를 검색한다.
      const preferredTop = hasReliableAnchor
        ? Math.max(0, Math.min(maxIconTop, Math.round(anchorY - size * 0.75)))
        : 0;
      const preferredBottom = hasReliableAnchor
        ? Math.max(preferredTop, Math.min(maxIconTop, Math.round(anchorY + size * 1.35)))
        : maxIconTop;
      const restrictToJanusRow = (isJanus || isJanusEnding) && hasReliableAnchor;
      const searchTop = restrictToJanusRow ? preferredTop : 0;
      const searchBottom = restrictToJanusRow ? preferredBottom : maxIconTop;
      // 이번 1920×1080 사냥 영상의 실제 아이콘은 44px였다.
      // 이 배율은 2px만 어긋나도 외곽 동심원 점수가 크게 변하므로 더 촘촘히 찾는다.
      const coarseStep = restrictToJanusRow
        ? Math.max(8, Math.round(size / 3))
        : Math.max(4, Math.round(size / 9));
      const coarseCandidates = [];
      const rememberCoarseCandidate = (candidate) => {
        coarseCandidates.push(candidate);
        coarseCandidates.sort((a, b) => a.score - b.score);
        if (coarseCandidates.length > 10) coarseCandidates.length = 10;
      };

      for (let y = searchTop; y <= searchBottom; y += coarseStep) {
        for (let x = 0; x <= width - size; x += coarseStep) {
          const score = scoreAt(x, y, size);
          if (
            coarseCandidates.length < 10 ||
            score < coarseCandidates[coarseCandidates.length - 1].score
          ) {
            rememberCoarseCandidate({ score, x, y, size });
          }
        }
      }

      const refineRadius = restrictToJanusRow ? 4 : coarseStep;
      for (const seed of coarseCandidates) {
        let refined = { ...seed };
        for (
          let y = Math.max(searchTop, seed.y - refineRadius);
          y <= Math.min(searchBottom, seed.y + refineRadius);
          y++
        ) {
          for (
            let x = Math.max(0, seed.x - refineRadius);
            x <= Math.min(width - size, seed.x + refineRadius);
            x++
          ) {
            const score = scoreAt(x, y, size);
            if (score < refined.score) refined = { score, x, y, size };
          }
        }

        const candidate = {
          ...refined,
          searchBand: {
            top: preferredTop,
            bottom: Math.min(height, preferredBottom + size),
            anchored: hasReliableAnchor,
            arrowY: hasReliableAnchor ? anchorY : null,
            arrowNumber: targetArrowNumber
          },
          inPreferredBand: !hasReliableAnchor || (
            refined.y >= preferredTop && refined.y <= preferredBottom
          )
        };
        refinedCandidates.push(candidate);
        if (candidate.score < best.score) best = candidate;
      }
    }

    // 야누스는 다른 보라/어두운 버프와 색이 겹치므로 아이콘 유사도를 더 엄격하게 본다.
    // 실제 야누스 사진 33장의 밝기·이펙트 편차(최대 오차 약 30.9)를 포함한다.
    // 실제 사냥 자료 82장으로 만든 외곽 템플릿을 사용한다.
    // 야누스 없음 자료의 최저 점수(약 22.7)보다 낮은 범위에서만 시작 증거로 인정한다.
    const preferredThreshold = isJanus
      ? 21
      : (isJanusEnding ? 30 : 26);
    // 화살표 묶음 밖에서도 아이콘 자체가 충분히 선명하면 이동한 정상 버프로 인정한다.
    // 대신 다른 줄의 유사 아이콘 오탐을 막기 위해 묶음 밖 후보에는 더 엄격한 점수를 요구한다.
    const assessCandidate = (candidate) => {
      const shape = this.measureBuffIconShape(
        imageData,
        candidate.x,
        candidate.y,
        candidate.size
      );
      const threshold = candidate.size === 44 && templateName === 'extremeGold'
        ? (candidate.inPreferredBand ? 32 : 29)
        : (
          candidate.inPreferredBand
            ? preferredThreshold
            : (isJanus ? 19 : (isJanusEnding ? 27 : 24))
        );
      const areaScale = Math.pow(candidate.size / 33, 2);
      const shapePassed = isJanus
        ? shape.violetPixels >= 18 * areaScale && shape.darkPixels >= 30 * areaScale
        : isJanusEnding
          ? shape.grayBluePixels >= 90 * areaScale && shape.darkPixels >= 20 * areaScale
          : (
            shape.goldPixels >= 35 * areaScale &&
            shape.goldPixels <= 400 * areaScale &&
            shape.darkPixels >= 140 * areaScale &&
            shape.centerGoldPixels >= 16 * areaScale &&
            shape.upperCenterGoldPixels >= 4 * areaScale &&
            shape.centerGoldVerticalSpan >= candidate.size * 0.2
          );
      return {
        ...candidate,
        found: candidate.score <= threshold && shapePassed,
        shape,
        threshold,
        normalizedScore: candidate.score / Math.max(1, threshold)
      };
    };

    const assessedCandidates = refinedCandidates.map(assessCandidate);
    const foundCandidates = assessedCandidates
      .filter(candidate => candidate.found)
      .sort((a, b) => {
        if (templateName === 'extremeGold') {
          const aTrustedRow = Boolean(a.searchBand?.anchored && a.inPreferredBand);
          const bTrustedRow = Boolean(b.searchBand?.anchored && b.inPreferredBand);
          if (aTrustedRow !== bTrustedRow) return aTrustedRow ? -1 : 1;
        }
        return a.normalizedScore - b.normalizedScore;
      });
    if (foundCandidates.length) return foundCandidates[0];

    const fallback = assessedCandidates
      .sort((a, b) => a.score - b.score)[0] || assessCandidate(best);
    return fallback;
  }

  measureBuffIconShape(imageData, left, top, size) {
    const { data, width, height } = imageData;
    let goldPixels = 0;
    let violetPixels = 0;
    let darkPixels = 0;
    let yellowDigitPixels = 0;
    let yellowMinX = size;
    let yellowMaxX = -1;
    let lowerLeftYellowPixels = 0;
    let grayBluePixels = 0;
    let centerGoldPixels = 0;
    let upperCenterGoldPixels = 0;
    let centerGoldMinY = size;
    let centerGoldMaxY = -1;
    const yellowMask = new Uint8Array(size * size);

    for (let y = top; y < Math.min(height, top + size); y++) {
      for (let x = left; x < Math.min(width, left + size); x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const localX = x - left;
        const localY = y - top;
        const isGoldPixel = r >= 165 && g >= 120 && b <= 125 && r - b >= 55;
        if (isGoldPixel) {
          goldPixels++;
          const isBottleCenter = (
            localX >= Math.floor(size * 0.24)
            && localX <= Math.ceil(size * 0.78)
            && localY >= Math.floor(size * 0.06)
            && localY <= Math.ceil(size * 0.9)
          );
          if (isBottleCenter) {
            centerGoldPixels++;
            if (localY < centerGoldMinY) centerGoldMinY = localY;
            if (localY > centerGoldMaxY) centerGoldMaxY = localY;
            if (localY <= Math.ceil(size * 0.42)) upperCenterGoldPixels++;
          }
        }
        if (b >= 75 && b - g >= 16 && b - r >= 8 && r <= 175) violetPixels++;
        if (r <= 70 && g <= 70 && b <= 80) darkPixels++;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation <= 55 && b >= r - 5 && b >= g - 8 && r >= 25 && r <= 175) {
          grayBluePixels++;
        }
        const isTimerBand = localY >= Math.floor(size * 0.2) && localY <= Math.ceil(size * 0.82);
        if (isTimerBand && r >= 165 && g >= 150 && b <= 145 && r - b >= 25) {
          yellowDigitPixels++;
          yellowMask[localY * size + localX] = 1;
          if (localX < yellowMinX) yellowMinX = localX;
          if (localX > yellowMaxX) yellowMaxX = localX;
          if (localX <= Math.ceil(size * 0.48) && localY >= Math.floor(size * 0.52)) {
            lowerLeftYellowPixels++;
          }
        }
      }
    }

    // JPEG 압축으로 숫자색이 끊어져도 서로 붙은 실제 글자 획이 있는지 확인한다.
    const visited = new Uint8Array(size * size);
    let largestYellowDigitComponent = 0;
    for (let start = 0; start < yellowMask.length; start++) {
      if (!yellowMask[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let head = 0;
      let componentSize = 0;
      while (head < queue.length) {
        const p = queue[head++];
        componentSize++;
        const px = p % size;
        const py = Math.floor(p / size);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
            const np = ny * size + nx;
            if (yellowMask[np] && !visited[np]) {
              visited[np] = 1;
              queue.push(np);
            }
          }
        }
      }
      if (componentSize > largestYellowDigitComponent) {
        largestYellowDigitComponent = componentSize;
      }
    }

    return {
      goldPixels,
      violetPixels,
      darkPixels,
      yellowDigitPixels,
      lowerLeftYellowPixels,
      grayBluePixels,
      centerGoldPixels,
      upperCenterGoldPixels,
      centerGoldVerticalSpan: centerGoldMaxY >= centerGoldMinY
        ? centerGoldMaxY - centerGoldMinY + 1
        : 0,
      largestYellowDigitComponent,
      yellowDigitSpan: yellowMaxX >= yellowMinX ? yellowMaxX - yellowMinX + 1 : 0
    };
  }

  /**
   * 야누스는 보라색 픽셀 하나가 아니라 동심원 아이콘 전체를 3프레임 확인한다.
   */
  processJanusTemplateFrame(imageData) {
    if (!document.getElementById('toggle-janus-detection')?.checked) return;

    const trackedJanus = this.janusState.confirmedTemplateMatch;
    const match = this.findBuffTemplateMatch(imageData, 'janus', 1, trackedJanus);
    const matchShape = match.shape || {};
    this.janusState.lastTemplateScore = match.score;
    this.janusState.lastTemplateMatch = {
      x: match.x,
      y: match.y,
      score: match.score,
      found: match.found,
      size: match.size,
      searchBand: match.searchBand ? { ...match.searchBand } : null,
      shape: { ...matchShape }
    };

    // 시작은 숫자 모양이 아니라 외곽 아이콘으로 확정한다.
    // 활성 이후에는 숫자가 잠시 비어도 아이콘 외곽이 있으면 계속 유지한다.
    const hasVisibleJanusTimer = (
      matchShape.yellowDigitPixels >= 3 &&
      matchShape.largestYellowDigitComponent >= 2
    );
    const janusScale = Math.pow((match.size || 33) / 33, 2);
    const hasStrongJanusIconEvidence = Boolean(
      match.found &&
      match.score <= Math.min(15, Math.max(1, match.threshold || 21) * 0.75) &&
      matchShape.violetPixels >= 22 * janusScale &&
      matchShape.darkPixels >= 38 * janusScale
    );
    // 실제 영상에서 활성 직후에는 항상 노란 시간이 함께 표시되고,
    // 종료 약 5초 전 회색 위상에서는 숫자가 완전히 사라졌다.
    // 최근 화면에서는 숫자가 이펙트/압축에 잠깐 약해지는 일이 있어,
    // 아이콘 외곽이 아주 강한 프레임도 시작 증거로 인정한다.
    const hasStartEvidence = match.found && (hasVisibleJanusTimer || hasStrongJanusIconEvidence);
    const hasProbableJanusEvidence = (
      match.found ||
      (
        match.score <= 18 &&
        matchShape.violetPixels >= 20 &&
        matchShape.darkPixels >= 35
      )
    );
    const shouldScanEnding = this.janusState.isBuffActive || !hasProbableJanusEvidence;
    const endingMatch = shouldScanEnding
      ? this.findBuffTemplateMatch(imageData, 'janusEnding', 1, trackedJanus)
      : null;
    const endingShape = endingMatch?.shape || {};
    const endingIsSameJanusSlot = Boolean(
      trackedJanus &&
      endingMatch &&
      Math.hypot(endingMatch.x - trackedJanus.x, endingMatch.y - trackedJanus.y)
        <= Math.max(6, trackedJanus.size * 0.35) &&
      Math.max(
        endingMatch.size / Math.max(1, trackedJanus.size),
        trackedJanus.size / Math.max(1, endingMatch.size)
      ) <= 1.35
    );
    const endingIsTrustedRow = Boolean(
      endingMatch?.searchBand?.anchored &&
      endingMatch?.inPreferredBand
    );
    const hasJanusEndingEvidence = Boolean(
      endingMatch?.found &&
      !match.found &&
      (endingIsSameJanusSlot || (!trackedJanus && endingIsTrustedRow)) &&
      endingShape.yellowDigitPixels <= Math.max(3, Math.round(Math.pow(endingMatch.size / 33, 2) * 3))
    );

    if (!this.janusState.isBuffActive) {
      if (hasJanusEndingEvidence) {
        this.janusState.endingFrames = (this.janusState.endingFrames || 0) + 1;
        this.janusState.consecutiveInactiveCount = 0;
        this.janusState.confirmedTemplateMatch = {
          x: endingMatch.x,
          y: endingMatch.y,
          size: endingMatch.size,
          score: endingMatch.score,
          found: true,
          searchBand: endingMatch.searchBand ? { ...endingMatch.searchBand } : null,
          shape: { ...endingShape }
        };
        if (this.janusState.endingFrames >= 2 && !this.janusState.alert10Triggered) {
          this.janusState.isBuffActive = true;
          this.janusState.alertExpiredTriggered = true;
          this.triggerJanus10sAlert();
        } else if (this.onJanusStatusChange) {
          this.onJanusStatusChange('야누스 종료 임박 후보 확인 중', false);
        }
        return;
      }
      const history = this.janusState.startEvidenceHistory;
      history.push(hasStartEvidence ? 1 : 0);
      if (history.length > 3) history.shift();
      const evidenceCount = history.reduce((sum, value) => sum + value, 0);
      this.janusState.consecutiveActiveCount = evidenceCount;

      // 최근 3프레임 중 2프레임에서 아이콘과 숫자가 함께 보이면 활성으로 확정한다.
      if (history.length === 3 && evidenceCount >= 2) {
        this.janusState.isBuffActive = true;
        this.janusState.consecutiveInactiveCount = 0;
        this.janusState.alert10Triggered = false;
        this.janusState.alertExpiredTriggered = false;
        this.janusState.peakYellowDigitCount = matchShape.yellowDigitPixels;
        this.janusState.peakYellowDigitSpan = matchShape.yellowDigitSpan;
        this.janusState.lowDigitFrames = 0;
        this.janusState.confirmedTemplateMatch = { ...this.janusState.lastTemplateMatch };
        window.버프영상수집기?.startJanusCycle?.();
      } else if (this.janusState.consecutiveInactiveCount >= 14 && this.onJanusStatusChange) {
        this.onJanusStatusChange('⚪ 대기 중 (야누스 아이콘 없음)', false);
      }
    }

    if (this.janusState.isBuffActive) {
      if (hasJanusEndingEvidence) {
        this.janusState.consecutiveInactiveCount = 0;
        this.janusState.endingFrames = (this.janusState.endingFrames || 0) + 1;
        this.janusState.confirmedTemplateMatch = {
          x: endingMatch.x,
          y: endingMatch.y,
          size: endingMatch.size,
          score: endingMatch.score,
          found: true,
          searchBand: endingMatch.searchBand ? { ...endingMatch.searchBand } : null,
          shape: { ...endingShape }
        };
        if (this.janusState.endingFrames >= 3 && !this.janusState.alert10Triggered) {
          this.triggerJanus10sAlert();
        }
        if (this.onJanusStatusChange) {
          this.onJanusStatusChange('⚠️ 솔 야누스 종료 임박 상태 감지', false);
        }
        return;
      }
      this.janusState.endingFrames = 0;

      if (hasProbableJanusEvidence) {
        this.janusState.consecutiveInactiveCount = 0;
        this.janusState.pendingTemplateMatch = { x: match.x, y: match.y };
        // 정상 야누스가 실제로 다시 확인됐을 때만 추적 좌표를 갱신한다.
        // 약한 유사 후보로 좌표를 옮기면 옆 아이콘을 종료 상태로 오인할 수 있다.
        if (match.found) {
          const previousMatch = this.janusState.confirmedTemplateMatch;
          const moved = previousMatch && Math.hypot(
            match.x - previousMatch.x,
            match.y - previousMatch.y
          ) >= Math.max(12, match.size * 0.55);
          this.janusState.confirmedTemplateMatch = { ...this.janusState.lastTemplateMatch };
          if (moved) window.버프영상수집기?.captureJanusMove?.();
        }

        if (hasVisibleJanusTimer) {
          const digitCount = matchShape.yellowDigitPixels;
          const digitSpan = matchShape.yellowDigitSpan;
          this.janusState.lastYellowDigitCount = digitCount;
          this.janusState.peakYellowDigitCount = Math.max(this.janusState.peakYellowDigitCount, digitCount);
          this.janusState.peakYellowDigitSpan = Math.max(this.janusState.peakYellowDigitSpan, digitSpan);

          const countDropped = this.janusState.peakYellowDigitCount >= 12
            && digitCount <= this.janusState.peakYellowDigitCount * 0.55;
          const spanDropped = this.janusState.peakYellowDigitSpan >= 15
            && digitSpan <= 11;
          if (digitSpan > 0 && (spanDropped || (digitSpan <= 13 && countDropped))) {
            this.janusState.lowDigitFrames++;
          } else {
            this.janusState.lowDigitFrames = 0;
          }

          // 숫자 폭 변화만으로는 다른 타이머 숫자와 혼동될 수 있어 알리지 않는다.
          // 실제 회색 종료 임박 아이콘이 확인될 때만 위에서 1회 알린다.
        }

        if (this.onJanusStatusChange) {
          const confidence = Math.max(0, Math.min(100, Math.round((1 - match.score / 45) * 100)));
          const timerState = hasVisibleJanusTimer ? '시간 확인' : '아이콘 유지';
          this.onJanusStatusChange(`⚡ 솔 야누스 활성 (${timerState}, ${confidence}%)`, false);
        }
        return;
      }

      this.janusState.consecutiveInactiveCount++;
      // 150ms 주기 기준 약 2초(14프레임) 동안 아이콘과 시간 표시가 모두 없을 때만 종료한다.
      if (this.janusState.consecutiveInactiveCount >= 14) {
        this.janusState.isBuffActive = false;
        this.janusState.startEvidenceHistory = [];
        this.janusState.pendingTemplateMatch = null;
        this.janusState.peakYellowDigitCount = 0;
        this.janusState.peakYellowDigitSpan = 0;
        this.janusState.lowDigitFrames = 0;
        // 최종 설정: 완전 소멸 시에는 추가 알림을 보내지 않는다.
        this.janusState.alertExpiredTriggered = true;
      }
      return;
    }

    if (hasProbableJanusEvidence) {
      this.janusState.consecutiveInactiveCount = 0;
      this.janusState.endingFrames = 0;
    } else {
      this.janusState.consecutiveInactiveCount++;
      if (this.janusState.consecutiveInactiveCount >= 14) {
        this.janusState.alert10Triggered = false;
        this.janusState.alertExpiredTriggered = false;
        this.janusState.endingFrames = 0;
        this.janusState.confirmedTemplateMatch = null;
      }
    }
  }

  /**
   * 익스트림 골드는 모든 버프 줄을 훑어 금색 병의 고정 형태를 확인한다.
   */
  processExpTemplateFrame(imageData) {
    if (this.expBuffState.disabled) return;
    if (!document.getElementById('toggle-exp-detection')?.checked) return;

    const match = this.findBuffTemplateMatch(
      imageData,
      'extremeGold',
      3,
      this.expBuffState.confirmedTemplateMatch
    );
    this.expBuffState.lastTemplateScore = match.score;
    this.expBuffState.lastTemplateMatch = {
      x: match.x,
      y: match.y,
      size: match.size,
      score: match.score,
      found: match.found,
      searchBand: match.searchBand ? { ...match.searchBand } : null,
      shape: { ...matchShape }
    };
    const goldTrustScale = Math.pow((match.size || 33) / 33, 2);
    // 화살표가 이펙트에 가려진 프레임도 놓치지 않되, 다른 줄의 파란 버프는
    // 금색 병으로 승격하지 않는다. 줄 기준이 없거나 어긋났을 때는 템플릿 점수와
    // 병 몸통 특징이 모두 매우 선명한 후보만 예외적으로 허용한다.
    const hasExceptionalBottleEvidence = Boolean(
      match.found
      && match.score <= (match.size === 44 ? 26 : 22)
      && match.shape?.centerGoldPixels >= 16 * goldTrustScale
      && match.shape?.upperCenterGoldPixels >= 4 * goldTrustScale
      && match.shape?.centerGoldVerticalSpan >= (match.size || 33) * 0.2
    );
    const isTrustedGoldMatch = Boolean(
      match.found
      && (
        match.searchBand?.tracked
        || (match.searchBand?.anchored && match.inPreferredBand)
        || hasExceptionalBottleEvidence
      )
    );

    // 익스트림 골드는 종료 약 5초 전에 숫자와 금색이 사라지고 회색 아이콘만 남는다.
    // 직전까지 확정된 같은 칸을 추적해 이 전환을 3프레임 확인한 순간에만 알린다.
    let hasExtremeGoldEndingEvidence = false;
    const tracked = this.expBuffState.confirmedTemplateMatch;
    // 현재 범위 어디에서든 정상 금색 병이 다시 검색되면 버프줄이 이동한 것이다.
    // 이 경우 이전 좌표의 회색/청록 아이콘을 종료 상태로 판단하지 않는다.
    if (this.expBuffState.isBuffActive && tracked && !isTrustedGoldMatch) {
      const trackedShape = this.measureBuffIconShape(
        imageData,
        tracked.x,
        tracked.y,
        tracked.size
      );
      const trackedScale = Math.pow(tracked.size / 33, 2);
      const timerGone = trackedShape.lowerLeftYellowPixels <= Math.max(2, Math.round(2 * trackedScale));
      const mostlyGray = trackedShape.grayBluePixels >= 70 * trackedScale;
      const goldFaded = trackedShape.goldPixels <= 20 * trackedScale;
      hasExtremeGoldEndingEvidence = timerGone && mostlyGray && goldFaded;
    }

    if (hasExtremeGoldEndingEvidence) {
      this.expBuffState.consecutiveInactiveCount = 0;
      this.expBuffState.endingFrames++;
      if (this.expBuffState.endingFrames >= 3 && !this.expBuffState.alert10Triggered) {
        this.triggerExtremeGoldEndingAlert();
      }
      if (this.onExpBuffStatusChange) {
        this.onExpBuffStatusChange('⚠️ 익스트림 골드 종료 임박 상태 감지', false);
      }
      return;
    }
    this.expBuffState.endingFrames = 0;

    if (isTrustedGoldMatch) {
      this.expBuffState.consecutiveActiveCount++;
      this.expBuffState.consecutiveInactiveCount = 0;
      const previousMatch = this.expBuffState.confirmedTemplateMatch;
      const moved = previousMatch && Math.hypot(
        match.x - previousMatch.x,
        match.y - previousMatch.y
      ) >= Math.max(12, match.size * 0.55);
      this.expBuffState.confirmedTemplateMatch = { ...this.expBuffState.lastTemplateMatch };
      if (moved) window.버프영상수집기?.captureExtremeGoldMove?.();

      if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveActiveCount >= 2) {
        this.expBuffState.isBuffActive = true;
        this.expBuffState.alert10Triggered = false;
        this.expBuffState.alertExpiredTriggered = false;
        this.expBuffState.endingFrames = 0;
        this.expBuffState.detectedBuffNames = ['익스트림 골드'];
        window.버프영상수집기?.captureExtremeGoldStart?.();
      }

      if (this.onExpBuffStatusChange) {
        const confidence = Math.max(0, Math.min(100, Math.round((1 - match.score / 48) * 100)));
        this.onExpBuffStatusChange(`🏆 익스트림 골드 활성 (병 아이콘 ${confidence}%)`, false);
      }
      return;
    }

    this.expBuffState.consecutiveActiveCount = 0;
    this.expBuffState.consecutiveInactiveCount++;

    if (this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 14) {
      this.expBuffState.isBuffActive = false;
      this.expBuffState.confirmedTemplateMatch = null;
      this.expBuffState.endingFrames = 0;
      // 최종 설정: 완전 소멸 시에는 추가 알림을 보내지 않는다.
      this.expBuffState.alertExpiredTriggered = true;
    } else if (!this.expBuffState.isBuffActive && this.expBuffState.consecutiveInactiveCount >= 14) {
      if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('⚪ 대기 중 (익스트림 골드 없음)', false);
    }
  }

  analyze4MicroFrames(runeImageData, janusImageData, expImageData, popupImageData) {
    if (runeImageData && document.getElementById('toggle-rune-detection')?.checked) {
      this.processRuneFrame(runeImageData, null);
    }
    if (janusImageData) {
      this.processJanusTemplateFrame(janusImageData);
    }
    if (expImageData) {
      this.processExpTemplateFrame(expImageData);
    }
    if (popupImageData && document.getElementById('toggle-popup-detection')?.checked) {
      this.processPopupStructureFrame(popupImageData);
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

    this.processPopupStructureFrame(imageData);

    if (rois.janusRoi) {
      const jx = Math.round((rois.janusRoi.x / 100) * width);
      const jy = Math.round((rois.janusRoi.y / 100) * height);
      const jw = Math.round((rois.janusRoi.w / 100) * width);
      const jh = Math.round((rois.janusRoi.h / 100) * height);

      const janusImageData = this.extractSubImageData(imageData, jx, jy, jw, jh);
      // 전체 프레임 경로도 색상만 세던 이전 감지기를 쓰지 않는다.
      // 다른 보라색 버프가 야누스 상태를 덮어쓰는 것을 막는다.
      this.processJanusTemplateFrame(janusImageData);
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
