/*
 * 룬 검출 정확도 보강.
 *
 * 진한 분홍 픽셀을 seed로 삼고 인접한 연보라 외곽만 이어 마름모를
 * 복원한다. 공유 시작부터 룬이 떠 있으면 매우 엄격한 공간 특징을 만족한
 * 단일 마름모만 600ms 연속 확인해 먼저 알린다. 그 외 후보는 배경으로
 * 학습하고, 학습 뒤에는 보라색 배경과 겹치지 않는 신규 seed만 룬으로
 * 확정한다.
 */
(() => {
  const analyzer = window.imageAnalyzer;
  if (!analyzer) return;

  const proto = analyzer.constructor.prototype;
  const previousProcessRuneFrame = proto.processRuneFrame;
  const baseProcessRuneFrame = proto.__baseProcessRuneFrame || previousProcessRuneFrame;
  const previousRestartRuneLearning = proto.restartRuneBackgroundLearning;
  const previousReset = proto.reset;
  const STARTUP_REQUIRED_CONSECUTIVE = 5;
  const STARTUP_REQUIRED_STABLE_MS = 600;
  // 기본 ROI의 아래쪽 약 16%는 미니맵 밖 전투 UI다. 실제 영상의 룬은 모두
  // 이 경계 안쪽에 있었고, 아래쪽 후보는 스킬·단축키 이펙트에서만 나타났다.
  const RUNE_MAP_INTERIOR_MAX_Y = 0.84;

  const isWeakRuneViolet = (r, g, b) => (
    r >= 75
    && b >= 105
    && g <= 190
    && r - g >= 5
    && b - g >= 15
    && b >= r - 18
  );

  const buildMasks = (analyzerInstance, imageData) => {
    const { data, width, height } = imageData;
    const total = width * height;
    const strict = new Uint8Array(total);
    const weak = new Uint8Array(total);

    for (let pixel = 0; pixel < total; pixel++) {
      const index = pixel * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (analyzerInstance.isRuneMagentaPixel(r, g, b)) strict[pixel] = 1;
      if (strict[pixel] || isWeakRuneViolet(r, g, b)) weak[pixel] = 1;
    }
    return { strict, weak };
  };

  const ratio = (small, large) => Math.min(small, large) / Math.max(1, Math.max(small, large));

  const componentShape = (points, minX, minY, maxX, maxY) => {
    // JPEG 경계가 끊겨도 룬의 원래 외곽을 평가할 수 있게 1px 여유를 둔다.
    const x = minX - 1;
    const y = minY - 1;
    const width = maxX - minX + 3;
    const height = maxY - minY + 3;
    const centerX = x + (width - 1) / 2;
    const centerY = y + (height - 1) / 2;
    const rowMin = new Array(height).fill(Infinity);
    const rowMax = new Array(height).fill(-Infinity);
    const columnMin = new Array(width).fill(Infinity);
    const columnMax = new Array(width).fill(-Infinity);
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let diamondPixels = 0;

    for (const point of points) {
      if (point.x < centerX) left++; else right++;
      if (point.y < centerY) top++; else bottom++;
      const row = point.y - y;
      const column = point.x - x;
      rowMin[row] = Math.min(rowMin[row], point.x);
      rowMax[row] = Math.max(rowMax[row], point.x);
      columnMin[column] = Math.min(columnMin[column], point.y);
      columnMax[column] = Math.max(columnMax[column], point.y);
      const diamondDistance = Math.abs(point.x - centerX) / Math.max(1, width / 2)
        + Math.abs(point.y - centerY) / Math.max(1, height / 2);
      if (diamondDistance <= 1.16) diamondPixels++;
    }

    const rowSpans = rowMin.map((value, index) => (
      Number.isFinite(value) ? rowMax[index] - value + 1 : 0
    ));
    const columnSpans = columnMin.map((value, index) => (
      Number.isFinite(value) ? columnMax[index] - value + 1 : 0
    ));
    const rows = rowSpans.map((span, index) => span > 0 ? index : -1).filter((index) => index >= 0);
    const columns = columnSpans.map((span, index) => span > 0 ? index : -1).filter((index) => index >= 0);
    const middleRows = rowSpans.slice(
      Math.floor(height * 0.25),
      Math.max(Math.floor(height * 0.25) + 1, Math.ceil(height * 0.75))
    );
    const middleColumns = columnSpans.slice(
      Math.floor(width * 0.25),
      Math.max(Math.floor(width * 0.25) + 1, Math.ceil(width * 0.75))
    );
    const middleRowSpan = Math.max(1, ...middleRows);
    const middleColumnSpan = Math.max(1, ...middleColumns);
    const verticalTipRatio = (
      rowSpans[rows[0]] + rowSpans[rows[rows.length - 1]]
    ) / (2 * middleRowSpan);
    const horizontalTipRatio = (
      columnSpans[columns[0]] + columnSpans[columns[columns.length - 1]]
    ) / (2 * middleColumnSpan);

    return {
      x,
      y,
      width,
      height,
      centerX,
      centerY,
      diamondFit: diamondPixels / Math.max(1, points.length),
      axisBalance: (ratio(left, right) + ratio(top, bottom)) / 2,
      tipSharpness: Math.max(0, Math.min(1, 1 - (verticalTipRatio + horizontalTipRatio) / 2))
    };
  };

  proto.findRuneDiamondCandidates = function findHysteresisRuneDiamonds(imageData) {
    if (!imageData?.data?.length || !imageData.width || !imageData.height) return [];

    const { data, width, height } = imageData;
    const { strict, weak } = buildMasks(this, imageData);
    const visited = new Uint8Array(width * height);
    const candidates = [];

    for (let start = 0; start < weak.length; start++) {
      if (!weak[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let head = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      const points = [];
      const strictPoints = [];
      let strictRedSum = 0;
      let strictGreenSum = 0;
      let pinkCorePixels = 0;

      while (head < queue.length) {
        const pixel = queue[head++];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        const index = pixel * 4;
        const point = { x, y, pixel };
        points.push(point);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        if (strict[pixel]) {
          strictPoints.push(point);
          strictRedSum += data[index];
          strictGreenSum += data[index + 1];
          if (this.isRunePinkCorePixel(data[index], data[index + 1], data[index + 2])) {
            pinkCorePixels++;
          }
        }

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            const next = nextY * width + nextX;
            if (!weak[next] || visited[next]) continue;
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      // 4번 양성은 캐릭터 표식에 가려 진한 seed가 8px만 남는다.
      if (strictPoints.length < 4 || points.length < 10) continue;
      const shape = componentShape(points, minX, minY, maxX, maxY);
      const aspect = shape.width / Math.max(1, shape.height);
      const density = points.length / Math.max(1, shape.width * shape.height);
      const averageRedGreenContrast = (
        strictRedSum - strictGreenSum
      ) / Math.max(1, strictPoints.length);
      const pinkCoreRatio = pinkCorePixels / Math.max(1, strictPoints.length);
      if (
        shape.width < 7 || shape.height < 7
        || shape.width > 24 || shape.height > 24
        || aspect < 0.58 || aspect > 1.50
        || density < 0.08 || density > 0.68
        || averageRedGreenContrast < 37
        || pinkCoreRatio < 0.55
        || shape.diamondFit < 0.76
        || shape.axisBalance < 0.52
        || shape.tipSharpness < 0.45
      ) continue;

      const aspectScore = Math.max(0, 1 - Math.abs(1 - aspect) / 0.42);
      const densityScore = Math.max(0, 1 - Math.abs(density - 0.38) / 0.38);
      const shapeConfidence = (
        aspectScore * 0.20
        + shape.diamondFit * 0.20
        + shape.axisBalance * 0.20
        + shape.tipSharpness * 0.15
        + densityScore * 0.10
        + pinkCoreRatio * 0.15
      );
      candidates.push({
        ...shape,
        pixelCount: points.length,
        strictSeedCount: strictPoints.length,
        density,
        averageRedGreenContrast,
        pinkCoreRatio,
        shapeConfidence,
        isStrongRuneShape: shapeConfidence >= 0.70,
        isCertainRuneShape: shapeConfidence >= 0.80,
        isHysteresisRune: true
      });
    }

    for (const candidate of candidates) {
      candidate.repeatedStructureCount = candidates.filter((other) => {
        if (candidate === other) return false;
        const widthRatio = ratio(candidate.width, other.width);
        const heightRatio = ratio(candidate.height, other.height);
        return widthRatio >= 0.74
          && heightRatio >= 0.74
          && Math.abs(candidate.centerY - other.centerY) <= Math.max(4, candidate.height * 0.60)
          && Math.abs(candidate.averageRedGreenContrast - other.averageRedGreenContrast) <= 16;
      }).length + 1;
      const edge = candidate.centerX / width < 0.07
        || candidate.centerX / width > 0.93
        || candidate.centerY / height < 0.07
        || candidate.centerY / height > RUNE_MAP_INTERIOR_MAX_Y;
      candidate.runeRank = candidate.shapeConfidence * 0.48
        + Math.min(1, candidate.averageRedGreenContrast / 90) * 0.20
        + candidate.pinkCoreRatio * 0.20
        + candidate.axisBalance * 0.12
        - Math.max(0, candidate.repeatedStructureCount - 1) * 0.18
        - (edge ? 0.30 : 0);
    }
    return candidates.sort((left, right) => right.runeRank - left.runeRank);
  };

  const resetTracking = (state) => {
    state.consecutiveCount = 0;
    state.pendingCandidate = null;
    state.candidateMissFrames = 0;
    state.candidateStableSince = 0;
    state.lastPixelCount = 0;
    state.lastCandidateCount = 0;
    state.lastCandidates = [];
  };

  const ensureLearningCounts = (state, imageData) => {
    const total = imageData.width * imageData.height;
    if (
      !state.runeHysteresisLearningCounts
      || state.runeHysteresisLearningCounts.length !== total
    ) {
      state.runeHysteresisLearningCounts = new Uint16Array(total);
      state.runeHysteresisBackgroundMask = null;
      state.runeHysteresisWidth = imageData.width;
      state.runeHysteresisHeight = imageData.height;
    }
  };

  const learnHysteresisBackground = (analyzerInstance, imageData, protectedCandidates = []) => {
    const state = analyzerInstance.runeState;
    ensureLearningCounts(state, imageData);
    const { weak } = buildMasks(analyzerInstance, imageData);
    for (let pixel = 0; pixel < weak.length; pixel++) {
      const x = pixel % imageData.width;
      const y = Math.floor(pixel / imageData.width);
      const isProtected = protectedCandidates.some((candidate) => (
        x >= candidate.x - 2
        && x <= candidate.x + candidate.width + 2
        && y >= candidate.y - 2
        && y <= candidate.y + candidate.height + 2
      ));
      if (isProtected) continue;
      if (weak[pixel] && state.runeHysteresisLearningCounts[pixel] < 65535) {
        state.runeHysteresisLearningCounts[pixel]++;
      }
    }
  };

  const overlapsProtectedCandidate = (item, candidate) => {
    const radius = Math.max(
      4,
      Math.max(item.width, item.height, candidate.width, candidate.height) * 0.75
    );
    return Math.hypot(
      item.centerX - candidate.centerX,
      item.centerY - candidate.centerY
    ) <= radius;
  };

  const removeProtectedCandidatesFromLegacyBackground = (state, imageData, candidates) => {
    if (candidates.length === 0) return;
    state.backgroundCandidateTracks = (state.backgroundCandidateTracks || []).filter((item) => (
      !candidates.some((candidate) => overlapsProtectedCandidate(item, candidate))
    ));
    state.backgroundCandidates = (state.backgroundCandidates || []).filter((item) => (
      !candidates.some((candidate) => overlapsProtectedCandidate(item, candidate))
    ));

    const mask = state.backgroundColorMask;
    if (!mask || state.backgroundMaskWidth !== imageData.width) return;
    for (const candidate of candidates) {
      const startX = Math.max(0, Math.floor(candidate.x - 2));
      const startY = Math.max(0, Math.floor(candidate.y - 2));
      const endX = Math.min(imageData.width, Math.ceil(candidate.x + candidate.width + 2));
      const endY = Math.min(imageData.height, Math.ceil(candidate.y + candidate.height + 2));
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) mask[y * imageData.width + x] = 0;
      }
    }
  };

  const finishHysteresisBackground = (state) => {
    if (state.runeHysteresisBackgroundMask || !state.runeHysteresisLearningCounts) return;
    const minimumSeen = Math.max(3, Math.ceil(state.BACKGROUND_LEARNING_REQUIRED * 0.35));
    const mask = new Uint8Array(state.runeHysteresisLearningCounts.length);
    for (let pixel = 0; pixel < mask.length; pixel++) {
      if (state.runeHysteresisLearningCounts[pixel] >= minimumSeen) mask[pixel] = 1;
    }
    state.runeHysteresisBackgroundMask = mask;
  };

  proto.isRuneNovelCandidate = function isHysteresisRuneNovel(candidate, imageData) {
    const state = this.runeState;
    const background = state.runeHysteresisBackgroundMask;
    if (
      !background
      || state.runeHysteresisWidth !== imageData.width
      || state.runeHysteresisHeight !== imageData.height
    ) return false;

    const { data, width, height } = imageData;
    const startX = Math.max(0, Math.floor(candidate.x));
    const startY = Math.max(0, Math.floor(candidate.y));
    const endX = Math.min(width, Math.ceil(candidate.x + candidate.width));
    const endY = Math.min(height, Math.ceil(candidate.y + candidate.height));
    let strictSeeds = 0;
    let newStrictSeeds = 0;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const pixel = y * width + x;
        const index = pixel * 4;
        if (!this.isRuneMagentaPixel(data[index], data[index + 1], data[index + 2])) continue;
        strictSeeds++;
        if (!background[pixel]) newStrictSeeds++;
      }
    }
    candidate.newStrictSeedCount = newStrictSeeds;
    candidate.newStrictSeedRatio = newStrictSeeds / Math.max(1, strictSeeds);
    return newStrictSeeds >= 4 && candidate.newStrictSeedRatio >= 0.36;
  };

  proto.isRuneCandidateAccepted = function acceptNovelHysteresisRune(
    candidate,
    imageData,
    isLearningBackground = false
  ) {
    if (isLearningBackground || !candidate?.isHysteresisRune) return false;
    const horizontal = candidate.centerX / Math.max(1, imageData.width);
    const vertical = candidate.centerY / Math.max(1, imageData.height);
    if (
      horizontal < 0.07
      || horizontal > 0.93
      || vertical < 0.07
      || vertical > RUNE_MAP_INTERIOR_MAX_Y
    ) {
      return false;
    }
    if (candidate.repeatedStructureCount > 1
      && !(candidate.averageRedGreenContrast >= 72 && candidate.pinkCoreRatio >= 0.78)) {
      return false;
    }
    if (this.isRuneBackgroundCandidate(candidate)) return false;
    return this.isRuneNovelCandidate(candidate, imageData);
  };

  proto.isConservativeStartupRuneCandidate = function isConservativeStartupRune(
    candidate,
    imageData
  ) {
    if (!candidate?.isHysteresisRune || !imageData?.width || !imageData?.height) return false;
    const horizontal = candidate.centerX / imageData.width;
    const vertical = candidate.centerY / imageData.height;
    const aspect = candidate.width / Math.max(1, candidate.height);

    /*
     * 시작 양성 5장은 diamondFit=1.000, axisBalance>=0.671이었다.
     * 시작 음성 19장 중 후보가 생긴 3장의 최대 diamondFit은 0.920이었다.
     * 그 사이에 여유를 둔 0.96과 축 균형·밀도·끝점 조건을 함께 써서,
     * 배경 학습을 우회하는 경로가 단순 분홍색 덩어리에 열리지 않게 한다.
     */
    return candidate.repeatedStructureCount === 1
      && candidate.diamondFit >= 0.96
      && candidate.axisBalance >= 0.66
      && candidate.tipSharpness >= 0.60
      && candidate.pinkCoreRatio >= 0.60
      && candidate.density >= 0.30
      && candidate.density <= 0.56
      && aspect >= 0.62
      && aspect <= 1.35
      && horizontal >= 0.10
      && horizontal <= 0.90
      && vertical >= 0.10
      && vertical <= RUNE_MAP_INTERIOR_MAX_Y;
  };

  const sameStartupCandidate = (candidate, previous) => {
    if (!candidate || !previous) return false;
    const positionTolerance = Math.max(
      3,
      Math.max(candidate.width, candidate.height, previous.width, previous.height) * 0.50
    );
    const sizeRatio = Math.max(
      candidate.width / Math.max(1, previous.width),
      previous.width / Math.max(1, candidate.width),
      candidate.height / Math.max(1, previous.height),
      previous.height / Math.max(1, candidate.height)
    );
    return Math.hypot(
      candidate.centerX - previous.centerX,
      candidate.centerY - previous.centerY
    ) <= positionTolerance && sizeRatio <= 1.35;
  };

  const clearStartupCandidateTrack = (state, keepAlerted = true) => {
    state.startupRuneCandidate = null;
    state.startupRuneConsecutiveCount = 0;
    state.startupRuneStableSince = 0;
    state.startupRuneMissFrames = 0;
    state.lastStartupRuneCandidates = [];
    if (!keepAlerted) state.startupRuneAlerted = false;
  };

  const trackStartupRune = (analyzerInstance, candidates, imageData) => {
    const state = analyzerInstance.runeState;
    const startupCandidates = candidates.filter((candidate) => (
      analyzerInstance.isConservativeStartupRuneCandidate(candidate, imageData)
    ));
    state.lastStartupRuneCandidates = startupCandidates.map((candidate) => ({ ...candidate }));

    if (state.startupRuneAlerted) return startupCandidates;
    const previous = state.startupRuneCandidate;
    const candidate = previous
      ? startupCandidates.find((item) => sameStartupCandidate(item, previous))
      : startupCandidates[0];

    if (!candidate) {
      // 화면 공유 압축으로 한 틱만 외곽선이 끊긴 경우에는 누적 근거를 보존한다.
      if (previous && state.startupRuneMissFrames < 1) {
        state.startupRuneMissFrames++;
        return startupCandidates;
      }
      clearStartupCandidateTrack(state);
      return startupCandidates;
    }

    const stable = sameStartupCandidate(candidate, previous);
    const now = Date.now();
    state.startupRuneMissFrames = 0;
    state.startupRuneConsecutiveCount = stable
      ? state.startupRuneConsecutiveCount + 1
      : 1;
    if (!stable || !state.startupRuneStableSince) state.startupRuneStableSince = now;
    state.startupRuneCandidate = { ...candidate };

    if (
      state.startupRuneConsecutiveCount >= STARTUP_REQUIRED_CONSECUTIVE
      && now - state.startupRuneStableSince >= STARTUP_REQUIRED_STABLE_MS
      && !state.isDetected
      && !state.cooldownActive
    ) {
      state.startupRuneAlerted = true;
      state.startupRuneAlertLearningFrame = state.backgroundLearningFrames;
      analyzerInstance.triggerRuneAlert(candidate.pixelCount);
    }
    return startupCandidates;
  };

  proto.processRuneFrame = function processNovelHysteresisRune(runeImageData, fullImageData) {
    if (!runeImageData?.data?.length) return;
    const state = this.runeState;
    const learning = state.backgroundLearningFrames < state.BACKGROUND_LEARNING_REQUIRED;

    if (learning) {
      const candidates = this.findRuneDiamondCandidates(runeImageData);
      const startupCandidates = trackStartupRune(this, candidates, runeImageData);
      learnHysteresisBackground(this, runeImageData, startupCandidates);
      // 엄격 시작 후보는 한번 알린 뒤 같은 좌표에 재출현한 룬까지 검출할 수
      // 있도록 배경에 흡수하지 않는다. 나머지 후보만 고정 구조물로 학습한다.
      const startupCandidateSet = new Set(startupCandidates);
      this.learnRuneBackgroundCandidates(
        candidates.filter((candidate) => !startupCandidateSet.has(candidate)),
        runeImageData,
        startupCandidates
      );
      // 앞 단계 호환 래퍼가 낮은 대비의 실제 룬을 다시 학습 후보로 돌리는
      // 경우까지 제거해, 시작 룬 좌표가 어떤 배경 저장소에도 남지 않게 한다.
      removeProtectedCandidatesFromLegacyBackground(state, runeImageData, startupCandidates);
      resetTracking(state);
      if (state.backgroundLearningFrames >= state.BACKGROUND_LEARNING_REQUIRED) {
        finishHysteresisBackground(state);
      }
      if (!state.isDetected && this.onRuneStatusChange && window.screenCaptureManager?.isStreaming) {
        this.onRuneStatusChange('🟣 미니맵 고정 보라 표식 구분 중', false);
      }
      return;
    }

    finishHysteresisBackground(state);
    // 맵이 바뀌는 동안 새 구조물을 룬으로 알리지 않는다. 이동이 6회
    // 확인되면 배경 학습을 처음부터 다시 시작한다.
    if (this.hasRuneMapChanged(runeImageData)) {
      // 큰 전투 이펙트가 미니맵을 덮으면 맵 전환처럼 보일 수 있다. 이때도
      // 신규성·형태·미니맵 내부 위치를 모두 통과한 룬은 600ms 추적을 계속한다.
      const verifiedRuneVisible = this.findRuneDiamondCandidates(runeImageData).some((candidate) => (
        this.isRuneCandidateAccepted(candidate, runeImageData, false)
      ));
      if (!verifiedRuneVisible) {
        state.mapTransitionFrames++;
        resetTracking(state);
        if (state.mapTransitionFrames >= state.MAP_TRANSITION_REQUIRED) {
          this.restartRuneBackgroundLearning();
        }
        return;
      }
    }
    state.mapTransitionFrames = 0;
    return baseProcessRuneFrame.call(this, runeImageData, fullImageData);
  };

  proto.restartRuneBackgroundLearning = function restartHysteresisRuneLearning() {
    const state = this.runeState;
    state.runeHysteresisLearningCounts = null;
    state.runeHysteresisBackgroundMask = null;
    state.runeHysteresisWidth = 0;
    state.runeHysteresisHeight = 0;
    clearStartupCandidateTrack(state, false);
    state.startupRuneAlertLearningFrame = null;
    return previousRestartRuneLearning.call(this);
  };

  proto.reset = function resetHysteresisRuneLearning() {
    const result = previousReset.call(this);
    const state = this.runeState;
    state.runeHysteresisLearningCounts = null;
    state.runeHysteresisBackgroundMask = null;
    state.runeHysteresisWidth = 0;
    state.runeHysteresisHeight = 0;
    clearStartupCandidateTrack(state, false);
    state.startupRuneAlertLearningFrame = null;
    return result;
  };
})();
