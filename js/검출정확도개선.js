/*
 * 스크린샷/사냥 영상 회귀 자료를 기준으로 검출기의 상태 판정을 보강한다.
 * 단일 프레임의 색상 유사도만으로 알리지 않고, 같은 위치에서 반복 확인된
 * 후보만 룬·거탐·야누스·익스트림 골드로 확정한다.
 */
(() => {
  const analyzer = window.imageAnalyzer;
  if (!analyzer) return;

  const Analyzer = analyzer.constructor;
  const proto = Analyzer.prototype;

  const copyMatch = (match) => ({
    x: match.x,
    y: match.y,
    size: match.size,
    width: match.width,
    height: match.height,
    score: match.score,
    threshold: match.threshold,
    found: Boolean(match.found),
    type: match.type,
    confidence: match.confidence,
    normalizedScore: match.normalizedScore,
    inPreferredBand: match.inPreferredBand,
    searchBand: match.searchBand ? { ...match.searchBand } : null,
    shape: match.shape ? { ...match.shape } : {}
  });

  const sameBuffSlot = (left, right, positionRatio = 0.42) => {
    if (!left || !right || !Number.isFinite(left.x) || !Number.isFinite(right.x)) return false;
    const leftSize = Math.max(1, left.size || left.width || 33);
    const rightSize = Math.max(1, right.size || right.width || 33);
    const sizeRatio = Math.max(leftSize / rightSize, rightSize / leftSize);
    const distance = Math.hypot(left.x - right.x, left.y - right.y);
    return sizeRatio <= 1.35 && distance <= Math.max(7, Math.min(leftSize, rightSize) * positionRatio);
  };

  const samePopup = (left, right) => {
    if (!left || !right || left.type !== right.type) return false;
    const width = Math.max(1, left.width || 1, right.width || 1);
    const height = Math.max(1, left.height || 1, right.height || 1);
    const sizeRatio = Math.max(
      (left.width || 1) / Math.max(1, right.width || 1),
      (right.width || 1) / Math.max(1, left.width || 1),
      (left.height || 1) / Math.max(1, right.height || 1),
      (right.height || 1) / Math.max(1, left.height || 1)
    );
    return sizeRatio <= 1.25
      && Math.hypot(left.x - right.x, left.y - right.y) <= Math.max(6, Math.min(width, height) * 0.22);
  };

  const pushHistory = (history, evidence, limit = 3) => {
    history.push(evidence ? copyMatch(evidence) : null);
    while (history.length > limit) history.shift();
  };

  const consistentLatest = (history, required = 2) => {
    const latest = [...history].reverse().find(Boolean);
    if (!latest) return null;
    const count = history.filter((candidate) => candidate && sameBuffSlot(candidate, latest)).length;
    return count >= required ? latest : null;
  };

  const ensureJanusState = (state) => {
    if (!Array.isArray(state.startEvidenceHistory)) state.startEvidenceHistory = [];
    if (!Array.isArray(state.moveEvidenceHistory)) state.moveEvidenceHistory = [];
    if (!Number.isFinite(state.lastConfirmedAt)) state.lastConfirmedAt = 0;
    if (!Number.isFinite(state.endingFrames)) state.endingFrames = 0;
  };

  const ensureGoldState = (state) => {
    if (!Array.isArray(state.startEvidenceHistory)) state.startEvidenceHistory = [];
    if (!Array.isArray(state.moveEvidenceHistory)) state.moveEvidenceHistory = [];
    if (!Number.isFinite(state.lastConfirmedAt)) state.lastConfirmedAt = 0;
    if (!Number.isFinite(state.endingFrames)) state.endingFrames = 0;
  };

  // 기본 템플릿도 변형 목록에 포함한다. 기존 코드는 변형이 하나라도 있으면
  // 기본 표본을 완전히 제외해, 해상도/압축률이 달라질 때 양성을 놓칠 수 있었다.
  const templates = window.BUFF_ICON_TEMPLATES;
  if (templates) {
    if (templates.janus && Array.isArray(templates.janusVariants)) {
      templates.janusVariants = [templates.janus, ...templates.janusVariants];
    }
    if (templates.janusEnding && Array.isArray(templates.janusEndingVariants)) {
      templates.janusEndingVariants = [templates.janusEnding, ...templates.janusEndingVariants];
    }
    if (templates.extremeGold && Array.isArray(templates.extremeGoldVariants)) {
      templates.extremeGoldVariants = [templates.extremeGold, ...templates.extremeGoldVariants];
    }
  }

  const originalBuffMatch = proto.findBuffTemplateMatch;
  proto.findBuffTemplateMatch = function improvedBuffMatch(
    imageData,
    templateName,
    targetArrowNumber = null,
    preferredLocation = null
  ) {
    const endingLimit = templateName === 'janusEnding' ? 14 : Infinity;
    const goldLimit = templateName === 'extremeGold' ? 32 : Infinity;
    const isAllowed = (match) => Boolean(
      match?.found && match.score <= endingLimit && match.score <= goldLimit
    );
    const markAllowed = (match) => {
      if (!match) return match;
      if (!isAllowed(match)) match.found = false;
      return match;
    };

    let best = markAllowed(originalBuffMatch.call(
      this,
      imageData,
      templateName,
      targetArrowNumber,
      preferredLocation
    ));

    // 우측 화살표를 전투 이펙트로 잘못 잡으면 실제 버프 줄이 검색 우선순위에서
    // 빠질 수 있다. 추적 좌표가 아직 없는 최초 탐색에 한해 전체 ROI를 한 번 더
    // 훑고, 더 좋은 결과만 사용한다. 이미 확인된 슬롯은 위의 근접 탐색만 쓴다.
    if (!best.found && targetArrowNumber != null && !preferredLocation) {
      const unanchored = markAllowed(originalBuffMatch.call(
        this,
        imageData,
        templateName,
        null,
        null
      ));
      if (unanchored?.found || unanchored?.score < best.score) best = unanchored;
    }

    return best;
  };

  // 같은 줄에 반복되는 보라 마름모는 새 맵의 고정 구조물일 가능성이 높다.
  // 색 순도가 높은 단일 마름모는 공유 시작 시 이미 떠 있어도 보호해 미탐을 줄인다.
  const originalRuneCandidates = proto.findRuneDiamondCandidates;
  const findSoftPinkRuneCandidates = (imageData, isMagentaPixel) => {
    const { data, width, height } = imageData;
    const mask = new Uint8Array(width * height);
    for (let pixel = 0; pixel < width * height; pixel++) {
      const index = pixel * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      // 확실한 분홍 seed와 맞닿은 연보라 외곽까지 잇는 hysteresis 후보.
      if (r >= 75 && b >= 105 && g <= 190 && r - g >= 5 && b - g >= 15 && b >= r - 18) {
        mask[pixel] = 1;
      }
    }
    const visited = new Uint8Array(mask.length);
    const candidates = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let head = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let pixelCount = 0;
      let contrast = 0;
      let strictSeeds = 0;
      while (head < queue.length) {
        const pixel = queue[head++];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        const index = pixel * 4;
        pixelCount++;
        contrast += data[index] - data[index + 1];
        if (isMagentaPixel(data[index], data[index + 1], data[index + 2])) strictSeeds++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const next = ny * width + nx;
            if (mask[next] && !visited[next]) {
              visited[next] = 1;
              queue.push(next);
            }
          }
        }
      }
      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const aspect = boxWidth / Math.max(1, boxHeight);
      if (boxWidth < 5 || boxHeight < 5 || boxWidth > 18 || boxHeight > 18
        || aspect < 0.55 || aspect > 1.55 || pixelCount < 10 || strictSeeds < 4) continue;
      candidates.push({
        x: minX,
        y: minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        width: boxWidth,
        height: boxHeight,
        pixelCount,
        density: pixelCount / (boxWidth * boxHeight),
        averageRedGreenContrast: contrast / pixelCount,
        diamondFit: 0.8,
        pinkCoreRatio: 0.55,
        shapeConfidence: 0.64,
        isStrongRuneShape: false,
        isCertainRuneShape: false,
        strictSeeds,
        isSoftPinkRune: true
      });
    }
    return candidates;
  };
  proto.findRuneDiamondCandidates = function rankedRuneCandidates(imageData) {
    const strict = originalRuneCandidates.call(this, imageData);
    const soft = findSoftPinkRuneCandidates(
      imageData,
      this.isRuneMagentaPixel.bind(this)
    ).filter((candidate) => !strict.some((existing) => (
      Math.hypot(existing.centerX - candidate.centerX, existing.centerY - candidate.centerY) <= 5
    )));
    const candidates = [...strict, ...soft];
    for (const candidate of candidates) {
      candidate.repeatedStructureCount = candidates.filter((other) => {
        if (candidate === other) return false;
        const sizeRatio = Math.max(
          candidate.width / Math.max(1, other.width),
          other.width / Math.max(1, candidate.width),
          candidate.height / Math.max(1, other.height),
          other.height / Math.max(1, candidate.height)
        );
        return sizeRatio <= 1.35
          && Math.abs(candidate.centerY - other.centerY) <= Math.max(3, candidate.height * 0.55)
          && Math.abs(candidate.averageRedGreenContrast - other.averageRedGreenContrast) <= 16;
      }).length + 1;
      const edge = candidate.centerX / imageData.width < 0.07
        || candidate.centerX / imageData.width > 0.93
        || candidate.centerY / imageData.height < 0.07
        || candidate.centerY / imageData.height > 0.95;
      candidate.runeRank = candidate.shapeConfidence * 0.50
        + Math.min(1, candidate.averageRedGreenContrast / 90) * 0.24
        + candidate.pinkCoreRatio * 0.22
        - Math.max(0, candidate.repeatedStructureCount - 1) * 0.18
        - (edge ? 0.25 : 0);
    }
    return candidates.sort((left, right) => right.runeRank - left.runeRank);
  };

  const isLiveRuneQuality = (candidate) => Boolean(
    candidate
    && candidate.shapeConfidence >= 0.78
    && candidate.averageRedGreenContrast >= 52
    && candidate.pinkCoreRatio >= 0.60
    && candidate.repeatedStructureCount <= 1
  );

  const originalLearnRuneBackground = proto.learnRuneBackgroundCandidates;
  proto.learnRuneBackgroundCandidates = function learnStrongStaticRuneShapes(
    candidates,
    imageData,
    protectedCandidates = []
  ) {
    const trulyProtected = protectedCandidates.filter(isLiveRuneQuality);
    const learnableStrong = protectedCandidates.filter((candidate) => !isLiveRuneQuality(candidate));
    return originalLearnRuneBackground.call(
      this,
      [...candidates, ...learnableStrong],
      imageData,
      trulyProtected
    );
  };

  const originalRuneAccepted = proto.isRuneCandidateAccepted;
  proto.isRuneCandidateAccepted = function improvedRuneAccepted(
    candidate,
    imageData,
    isLearningBackground = false
  ) {
    const horizontal = candidate.centerX / Math.max(1, imageData.width);
    const vertical = candidate.centerY / Math.max(1, imageData.height);
    if (horizontal < 0.07 || horizontal > 0.93 || vertical < 0.07 || vertical > 0.95) return false;
    if (candidate.isSoftPinkRune) {
      return candidate.repeatedStructureCount <= 1
        && candidate.strictSeeds >= 4
        && candidate.averageRedGreenContrast >= 20
        && candidate.density >= 0.10
        && candidate.density <= 0.58;
    }
    if (isLearningBackground && !isLiveRuneQuality(candidate)) return false;
    if (candidate.repeatedStructureCount > 1
      && !(candidate.averageRedGreenContrast >= 72 && candidate.pinkCoreRatio >= 0.78)) {
      return false;
    }
    if (this.isRuneBackgroundCandidate(candidate) && !isLiveRuneQuality(candidate)) return false;
    return originalRuneAccepted.call(this, candidate, imageData, isLearningBackground);
  };

  const originalProcessRuneFrame = proto.processRuneFrame;
  // 뒤에서 로드되는 룬 전용 모듈이 공통 호환 래퍼를 다시 거치며 후보를
  // 중복 계산하지 않도록, 실제 기본 처리기를 명시적으로 보관한다.
  proto.__baseProcessRuneFrame = originalProcessRuneFrame;
  proto.processRuneFrame = function preserveVisibleRuneDuringLearning(runeImageData, fullImageData) {
    const state = this.runeState;
    const candidates = this.findRuneDiamondCandidates(runeImageData);
    // 사용자가 공유를 시작할 때 룬이 이미 떠 있는 경우 20프레임 배경학습에
    // 흡수되면 안 된다. 같은 단일 마름모가 600ms 유지되면 위치 하드코딩과
    // 무관하게 먼저 알리고, 반복 구조물은 기존 배경학습으로 넘긴다.
    const liveCandidate = candidates.find((candidate) => (
      candidate.repeatedStructureCount <= 1
      && candidate.shapeConfidence >= 0.63
      && candidate.pinkCoreRatio >= 0.50
      && candidate.averageRedGreenContrast >= (candidate.isSoftPinkRune ? 20 : 40)
      && candidate.centerX / runeImageData.width >= 0.10
      && candidate.centerX / runeImageData.width <= 0.90
      && candidate.centerY / runeImageData.height >= 0.10
      && candidate.centerY / runeImageData.height <= 0.92
    )) || candidates.find((candidate) => (
      candidate.isSoftPinkRune
      && candidate.repeatedStructureCount <= 1
      && candidate.strictSeeds >= 4
      && candidate.averageRedGreenContrast >= 20
      && candidate.centerX / runeImageData.width >= 0.10
      && candidate.centerX / runeImageData.width <= 0.90
      && candidate.centerY / runeImageData.height >= 0.10
      && candidate.centerY / runeImageData.height <= 0.92
    ));
    if (state.backgroundLearningFrames < state.BACKGROUND_LEARNING_REQUIRED && !state.initialRuneSnapshot) {
      state.initialRuneSnapshot = candidates.map((candidate) => ({ ...candidate }));
    }
    const appearedAfterStart = liveCandidate && !(state.initialRuneSnapshot || []).some((initial) => (
      Math.hypot(initial.centerX - liveCandidate.centerX, initial.centerY - liveCandidate.centerY)
        <= Math.max(4, Math.max(initial.width, initial.height, liveCandidate.width, liveCandidate.height) * 0.65)
    ));
    if (state.backgroundLearningFrames < state.BACKGROUND_LEARNING_REQUIRED && liveCandidate) {
      // 공유 첫 프레임부터 있던 마름모는 맵 장식일 수도 있어 배경 학습을 우선한다.
      // 학습 중 새로 출현한 후보만 즉시 경로로 알리고, 초기 후보는 학습 완료 후 신규성으로 판단한다.
      if (!appearedAfterStart) return originalProcessRuneFrame.call(this, runeImageData, fullImageData);
      const previous = state.pendingCandidate;
      const stable = previous && sameBuffSlot(
        { x: liveCandidate.centerX, y: liveCandidate.centerY, size: Math.max(liveCandidate.width, liveCandidate.height) },
        { x: previous.centerX, y: previous.centerY, size: Math.max(previous.width, previous.height) },
        0.55
      );
      const now = Date.now();
      state.consecutiveCount = stable ? state.consecutiveCount + 1 : 1;
      if (!stable || !state.candidateStableSince) state.candidateStableSince = now;
      state.pendingCandidate = { ...liveCandidate };
      state.lastCandidateCount = 1;
      state.lastCandidates = [{ ...liveCandidate }];
      if (state.consecutiveCount >= state.REQUIRED_CONSECUTIVE
        && now - state.candidateStableSince >= state.REQUIRED_STABLE_MS
        && !state.isDetected && !state.cooldownActive) {
        this.triggerRuneAlert(liveCandidate.pixelCount);
      }
      this.learnRuneBackgroundCandidates([], runeImageData, [liveCandidate]);
      return;
    }
    return originalProcessRuneFrame.call(this, runeImageData, fullImageData);
  };

  const originalRestartRuneLearning = proto.restartRuneBackgroundLearning;
  proto.restartRuneBackgroundLearning = function resetRuneLearningMemory() {
    this.runeState.initialRuneSnapshot = null;
    return originalRestartRuneLearning.call(this);
  };

  proto.processPopupStructureFrame = function improvedPopupState(imageData) {
    if (!imageData?.data?.length) return;
    const state = this.popupState;
    const match = this.verifyPopupTemplateMatch(imageData, this.findPopupTemplateMatch(imageData));
    state.lastConfidence = match.confidence || 0;
    if (match.verified) {
      state.missedCount = 0;
      const isSame = samePopup(state.lastMatch, match);
      state.consecutiveCount = isSame ? state.consecutiveCount + 1 : 1;
      state.lastType = match.type;
      state.lastMatch = copyMatch(match);
      if (state.consecutiveCount >= state.REQUIRED_CONSECUTIVE
        && !state.isDetected && !state.cooldownActive) {
        this.triggerPopupStructureAlert(match.type);
      }
      return;
    }
    state.consecutiveCount = 0;
    state.lastMatch = null;
    state.missedCount++;
    if (state.cooldownActive && state.missedCount >= 5) {
      state.cooldownActive = false;
      state.isDetected = false;
      state.lastType = '';
      if (this.onPopupStatusChange && window.screenCaptureManager?.isStreaming) {
        this.onPopupStatusChange('🟢 거탐 감시 중 (6개 유형 위치·형태 교차 확인)', false);
      }
    }
  };

  proto.processJanusTemplateFrame = function improvedJanusState(imageData) {
    if (!document.getElementById('toggle-janus-detection')?.checked) return;
    const state = this.janusState;
    ensureJanusState(state);
    const tracked = state.confirmedTemplateMatch;
    let match = this.findBuffTemplateMatch(imageData, 'janus', 1, tracked);
    // 전역 화살표 앵커가 흔들려도 이전 성공 후보 주변부터 복구한다.
    const pending = [...state.startEvidenceHistory].reverse().find(Boolean);
    if (!match.found && !tracked && pending) {
      const local = this.findBuffTemplateMatch(imageData, 'janus', 1, pending);
      if (local.found) match = local;
    }
    const shape = match.shape || {};
    state.lastTemplateScore = match.score;
    state.lastTemplateMatch = copyMatch(match);

    const timerVisible = shape.yellowDigitPixels >= 3
      && shape.largestYellowDigitComponent >= 2;
    const normalAtTracked = Boolean(match.found && tracked && sameBuffSlot(match, tracked));

    if (!state.isBuffActive) {
      const evidence = match.found && timerVisible ? match : null;
      pushHistory(state.startEvidenceHistory, evidence);
      const confirmed = evidence ? consistentLatest(state.startEvidenceHistory, 2) : null;
      state.consecutiveActiveCount = confirmed
        ? state.startEvidenceHistory.filter((item) => item && sameBuffSlot(item, confirmed)).length
        : 0;
      if (confirmed) {
        state.isBuffActive = true;
        state.consecutiveInactiveCount = 0;
        state.alert10Triggered = false;
        state.alertExpiredTriggered = false;
        state.endingFrames = 0;
        state.confirmedTemplateMatch = copyMatch(confirmed);
        state.lastConfirmedAt = Date.now();
        state.peakYellowDigitCount = confirmed.shape?.yellowDigitPixels || 0;
        state.peakYellowDigitSpan = confirmed.shape?.yellowDigitSpan || 0;
        window['버프영상수집기']?.startJanusCycle?.();
        if (this.onJanusStatusChange) this.onJanusStatusChange('🟣 솔 야누스 가동 중 (동일 슬롯 2회 확인)', false);
      } else if (this.onJanusStatusChange && window.screenCaptureManager?.isStreaming) {
        this.onJanusStatusChange('🟢 솔 야누스 감시 중', false);
      }
      return;
    }

    const ending = tracked
      ? this.findBuffTemplateMatch(imageData, 'janusEnding', 1, tracked)
      : null;
    const endingShape = ending?.shape || {};
    const endingAtTracked = Boolean(ending?.found && sameBuffSlot(ending, tracked));
    const timerLimit = Math.max(3, Math.round(Math.pow((ending?.size || 33) / 33, 2) * 3));
    const movedTimedCandidate = Boolean(match.found && timerVisible && !normalAtTracked);
    const endingBeatsNormal = !normalAtTracked
      || !timerVisible
      || ending.score + 4 < match.score;
    const endingEvidence = endingAtTracked
      && endingShape.yellowDigitPixels <= timerLimit
      && !movedTimedCandidate
      && endingBeatsNormal;

    if (endingEvidence) {
      state.consecutiveInactiveCount = 0;
      state.endingFrames++;
      if (state.endingFrames >= 3 && !state.alert10Triggered) this.triggerJanus10sAlert();
      if (this.onJanusStatusChange) this.onJanusStatusChange('🟠 솔 야누스 종료 임박 위상 확인', false);
      return;
    }
    state.endingFrames = 0;

    if (normalAtTracked) {
      state.consecutiveInactiveCount = 0;
      state.moveEvidenceHistory = [];
      state.confirmedTemplateMatch = copyMatch(match);
      state.lastConfirmedAt = Date.now();
      if (timerVisible) {
        state.lastYellowDigitCount = shape.yellowDigitPixels;
        state.peakYellowDigitCount = Math.max(state.peakYellowDigitCount || 0, shape.yellowDigitPixels);
        state.peakYellowDigitSpan = Math.max(state.peakYellowDigitSpan || 0, shape.yellowDigitSpan || 0);
      }
      if (this.onJanusStatusChange) this.onJanusStatusChange('🟣 솔 야누스 가동 중 (추적 확인)', false);
      return;
    }

    const movedEvidence = match.found && timerVisible ? match : null;
    pushHistory(state.moveEvidenceHistory, movedEvidence);
    const moved = movedEvidence ? consistentLatest(state.moveEvidenceHistory, 2) : null;
    if (moved) {
      const previous = state.confirmedTemplateMatch;
      state.confirmedTemplateMatch = copyMatch(moved);
      state.lastConfirmedAt = Date.now();
      state.consecutiveInactiveCount = 0;
      state.moveEvidenceHistory = [];
      if (!sameBuffSlot(previous, moved, 0.55)) window['버프영상수집기']?.captureJanusMove?.();
      return;
    }

    state.consecutiveInactiveCount++;
    if (state.consecutiveInactiveCount >= 14) {
      const alreadyWarned = state.alert10Triggered || state.alertExpiredTriggered;
      state.isBuffActive = false;
      state.startEvidenceHistory = [];
      state.moveEvidenceHistory = [];
      state.confirmedTemplateMatch = null;
      state.endingFrames = 0;
      // 종료 임박 회색 위상이 이펙트에 가려져도 완전 소멸을 14회 확인하면
      // 조용히 상태만 해제하지 않는다. 이미 임박 알림을 낸 주기에는 중복
      // 음성을 내지 않고, 그렇지 않은 주기에만 종료 알림을 한 번 보낸다.
      if (!alreadyWarned) {
        this.triggerJanusExpiredAlert();
      } else {
        state.alertExpiredTriggered = true;
        if (this.onJanusStatusChange) this.onJanusStatusChange('🟢 솔 야누스 감시 중', false);
      }
    }
  };

  proto.processExpTemplateFrame = function improvedExtremeGoldState(imageData) {
    if (!document.getElementById('toggle-exp-detection')?.checked) return;
    const state = this.expBuffState;
    ensureGoldState(state);
    if (state.disabled) return;
    const tracked = state.confirmedTemplateMatch;
    let match = this.findBuffTemplateMatch(imageData, 'extremeGold', 3, tracked);
    const pending = [...state.startEvidenceHistory].reverse().find(Boolean);
    if (!match.found && !tracked && pending) {
      const local = this.findBuffTemplateMatch(imageData, 'extremeGold', 3, pending);
      if (local.found) match = local;
    }
    const shape = match.shape || {};
    state.lastTemplateScore = match.score;
    state.lastTemplateMatch = copyMatch(match);

    const scale = Math.pow((match.size || 33) / 33, 2);
    const bottleEvidence = Boolean(
      match.found
      && match.score <= 10
      && shape.goldPixels >= 35 * scale
      && shape.darkPixels >= 95 * scale
      && shape.centerGoldPixels >= 16 * scale
      && shape.upperCenterGoldPixels >= 4 * scale
      && shape.centerGoldVerticalSpan >= (match.size || 33) * 0.2
    );
    const trusted = Boolean(
      match.found
      && (
        (tracked && sameBuffSlot(match, tracked))
        || (match.searchBand?.anchored && match.inPreferredBand)
        || bottleEvidence
      )
    );

    if (!state.isBuffActive) {
      pushHistory(state.startEvidenceHistory, trusted ? match : null);
      const confirmed = trusted ? consistentLatest(state.startEvidenceHistory, 2) : null;
      state.consecutiveActiveCount = confirmed
        ? state.startEvidenceHistory.filter((item) => item && sameBuffSlot(item, confirmed)).length
        : 0;
      if (confirmed) {
        state.isBuffActive = true;
        state.confirmedTemplateMatch = copyMatch(confirmed);
        state.lastConfirmedAt = Date.now();
        state.consecutiveInactiveCount = 0;
        state.alert10Triggered = false;
        state.alertExpiredTriggered = false;
        state.endingFrames = 0;
        state.detectedBuffNames = ['익스트림 골드'];
        window['버프영상수집기']?.captureExtremeGoldStart?.();
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('🏆 익스트림 골드 가동 중 (동일 슬롯 2회 확인)', false);
      }
      return;
    }

    const atTracked = Boolean(trusted && sameBuffSlot(match, tracked));
    if (atTracked) {
      state.confirmedTemplateMatch = copyMatch(match);
      state.lastConfirmedAt = Date.now();
      state.consecutiveInactiveCount = 0;
      state.endingFrames = 0;
      state.moveEvidenceHistory = [];
      if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('🏆 익스트림 골드 가동 중 (병 모양 추적)', false);
      return;
    }

    pushHistory(state.moveEvidenceHistory, trusted ? match : null);
    const moved = trusted ? consistentLatest(state.moveEvidenceHistory, 2) : null;
    if (moved) {
      const previous = state.confirmedTemplateMatch;
      state.confirmedTemplateMatch = copyMatch(moved);
      state.lastConfirmedAt = Date.now();
      state.consecutiveInactiveCount = 0;
      state.endingFrames = 0;
      state.moveEvidenceHistory = [];
      if (!sameBuffSlot(previous, moved, 0.55)) window['버프영상수집기']?.captureExtremeGoldMove?.();
      return;
    }

    let endingEvidence = false;
    if (!trusted && tracked) {
      const trackedShape = this.measureBuffIconShape(imageData, tracked.x, tracked.y, tracked.size);
      const trackedScale = Math.pow(tracked.size / 33, 2);
      endingEvidence = trackedShape.lowerLeftYellowPixels <= Math.max(2, Math.round(2 * trackedScale))
        && trackedShape.grayBluePixels >= 70 * trackedScale
        && trackedShape.goldPixels <= 20 * trackedScale;
    }
    if (endingEvidence) {
      state.consecutiveInactiveCount = 0;
      state.endingFrames++;
      if (state.endingFrames >= 3 && !state.alert10Triggered) this.triggerExtremeGoldEndingAlert();
      if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('🟠 익스트림 골드 종료 임박 위상 확인', false);
      return;
    }

    state.endingFrames = 0;
    state.consecutiveInactiveCount++;
    if (state.consecutiveInactiveCount >= 14) {
      const alreadyWarned = state.alert10Triggered || state.alertExpiredTriggered;
      state.isBuffActive = false;
      state.startEvidenceHistory = [];
      state.moveEvidenceHistory = [];
      state.confirmedTemplateMatch = null;
      // 운영 기능은 현재 꺼져 있지만 다시 켤 때도 종료 위상을 놓친 뒤
      // 완전 소멸을 확인하면 반드시 한 번은 종료 알림을 보낸다.
      if (!alreadyWarned) {
        this.triggerExpBuffExpiredAlert();
      } else {
        state.alertExpiredTriggered = true;
        if (this.onExpBuffStatusChange) this.onExpBuffStatusChange('🟢 익스트림 골드 감시 중', false);
      }
    }
  };

  // 화면 공유를 끊었다 다시 시작할 때 보조 이력이 이전 세션의 첫 프레임과
  // 이어지지 않게, 기본 reset이 알지 못하는 정확도 보강 상태도 함께 비운다.
  const originalReset = proto.reset;
  proto.reset = function resetDetectorEvidenceHistory() {
    const result = originalReset.call(this);
    this.popupState.lastMatch = null;
    ensureJanusState(this.janusState);
    this.janusState.moveEvidenceHistory = [];
    this.janusState.lastConfirmedAt = 0;
    ensureGoldState(this.expBuffState);
    this.expBuffState.startEvidenceHistory = [];
    this.expBuffState.moveEvidenceHistory = [];
    this.expBuffState.lastConfirmedAt = 0;
    this.expBuffState.detectedBuffNames = [];
    return result;
  };

  ensureJanusState(analyzer.janusState);
  ensureGoldState(analyzer.expBuffState);
})();
