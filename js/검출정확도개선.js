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
  const POPUP_EVIDENCE_WINDOW_MS = 2500;
  const POPUP_MAX_COOLDOWN_MS = 3000;
  const POPUP_REPEAT_ALERT_COUNT = 2;
  const POPUP_REPEAT_WINDOW_MS = POPUP_MAX_COOLDOWN_MS * (POPUP_REPEAT_ALERT_COUNT - 1) + 600;
  const POPUP_EVENT_CLEAR_MS = 15000;
  const POPUP_EVENT_MAX_MS = 120000;
  const POPUP_STATUS_CLEAR_MISSES = 6;

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
    detectedType: match.detectedType,
    structuralEvidence: match.structuralEvidence,
    evidenceBox: match.evidenceBox ? { ...match.evidenceBox } : null,
    structure: match.structure ? { ...match.structure } : null,
    confidence: match.confidence,
    normalizedScore: match.normalizedScore,
    inPreferredBand: match.inPreferredBand,
    searchBand: match.searchBand ? { ...match.searchBand } : null,
    shape: match.shape ? { ...match.shape } : {}
  });

  const popupEvidenceBox = (match) => match?.evidenceBox || match;

  const dimensionRatio = (left, right, key) => Math.max(
    (left?.[key] || 1) / Math.max(1, right?.[key] || 1),
    (right?.[key] || 1) / Math.max(1, left?.[key] || 1)
  );

  const floatingProfileCounts = (match) => {
    const structure = match?.structure;
    if (!structure) return null;
    if (Array.isArray(structure.bandCounts)) return structure.bandCounts;
    if (Array.isArray(structure.clusterCounts)) return structure.clusterCounts;
    return null;
  };

  const floatingProfileDistance = (left, right) => {
    const leftCounts = floatingProfileCounts(left);
    const rightCounts = floatingProfileCounts(right);
    if (!Array.isArray(leftCounts) || !Array.isArray(rightCounts)
      || leftCounts.length !== 5 || rightCounts.length !== 5) return Infinity;
    const leftTotal = leftCounts.reduce((sum, value) => sum + value, 0);
    const rightTotal = rightCounts.reduce((sum, value) => sum + value, 0);
    return leftCounts.reduce((distance, value, index) => (
      distance + Math.abs(
        value / Math.max(1, leftTotal)
        - rightCounts[index] / Math.max(1, rightTotal)
      )
    ), 0);
  };

  const sameFloatingCandidate = (left, right) => {
    if (!left || !right) return false;
    const leftBox = popupEvidenceBox(left);
    const rightBox = popupEvidenceBox(right);
    if (!leftBox || !rightBox) return false;
    const widthRatio = dimensionRatio(leftBox, rightBox, 'width');
    const heightRatio = dimensionRatio(leftBox, rightBox, 'height');
    const leftCenterX = leftBox.x + (leftBox.width || 1) / 2;
    const leftCenterY = leftBox.y + (leftBox.height || 1) / 2;
    const rightCenterX = rightBox.x + (rightBox.width || 1) / 2;
    const rightCenterY = rightBox.y + (rightBox.height || 1) / 2;
    const distance = Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY);
    const travelLimit = Math.max(
      14,
      Math.min(leftBox.width || 1, leftBox.height || 1, rightBox.width || 1, rightBox.height || 1)
        * 0.48
    );
    const sameEvidenceKind = left.structuralEvidence === right.structuralEvidence;
    // 색상 무관 마스크와 따뜻한 글자 마스크는 같은 안내도 픽셀 분포가 다르다.
    // 같은 검출 경로끼리는 줄별 잉크 비율이 유지되어야 하고, 서로 다른 경로가
    // 이어질 때만 조금 넓게 허용한다. 공격 숫자·MISS·몬스터 외곽선은 위치가
    // 비슷해도 이 비율이 매 프레임 크게 달라져 한 사건으로 합쳐지지 않는다.
    const profileLimit = sameEvidenceKind ? 0.30 : 0.50;
    // 전투 이펙트가 글자를 가리면 같은 안내의 검출 상자 폭이 한 프레임 사이
    // 32→50픽셀까지 바뀔 수 있다. 중심 이동·줄 분포는 별도로 엄격히 본다.
    return widthRatio <= 1.65
      && heightRatio <= 1.65
      && distance <= travelLimit
      && floatingProfileDistance(left, right) <= profileLimit;
  };

  const floatingTrackMovement = (entries) => {
    if (!Array.isArray(entries) || entries.length < 2) return 0;
    const first = popupEvidenceBox(entries[0].match);
    const last = popupEvidenceBox(entries[entries.length - 1].match);
    if (!first || !last) return 0;
    return Math.hypot(
      first.x + (first.width || 1) / 2 - last.x - (last.width || 1) / 2,
      first.y + (first.height || 1) / 2 - last.y - (last.height || 1) / 2
    );
  };

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
    // 안정 추적용 type은 모든 거탐을 같은 이름으로 정규화하므로 실제 하위 유형도
    // 반드시 같아야 한다. 몬스터 사망 모션의 색 덩어리와 원형 잔상이 번갈아
    // 잡혀도 한 거탐의 연속 프레임으로 합산하지 않는다.
    if ((left.detectedType || right.detectedType)
      && left.detectedType !== right.detectedType) return false;
    const width = Math.max(1, left.width || 1, right.width || 1);
    const height = Math.max(1, left.height || 1, right.height || 1);
    const sizeRatio = Math.max(
      (left.width || 1) / Math.max(1, right.width || 1),
      (right.width || 1) / Math.max(1, left.width || 1),
      (left.height || 1) / Math.max(1, right.height || 1),
      (right.height || 1) / Math.max(1, left.height || 1)
    );
    const positionDistance = Math.hypot(left.x - right.x, left.y - right.y);
    if (left.structuralEvidence === 'circular-click-game'
      || right.structuralEvidence === 'circular-click-game') {
      const leftCircle = left.structure;
      const rightCircle = right.structure;
      if (!leftCircle || !rightCircle) return false;
      const radiusRatio = Math.max(
        (leftCircle.radius || 1) / Math.max(1, rightCircle.radius || 1),
        (rightCircle.radius || 1) / Math.max(1, leftCircle.radius || 1)
      );
      // 원형 클릭형 거탐은 판 자체가 화면을 떠다닌다. 중심 좌표를 연속성
      // 조건으로 쓰면 실제 거탐이 이동할 때마다 새로운 후보로 초기화된다.
      // 위치는 자유롭게 허용하되, 원의 크기와 고유 구조가 같은 경우만 같은
      // 원형 거탐으로 이어서 센다. 하위 유형 일치 검사는 위에서 별도로 한다.
      return sizeRatio <= 1.25 && radiusRatio <= 1.25;
    }
    if (['floating-activation-text', 'floating-activation-layout'].includes(left.structuralEvidence)
      || ['floating-activation-text', 'floating-activation-layout'].includes(right.structuralEvidence)) {
      // 추적용 큰 상자 대신 실제 다섯 줄 증거 상자를 비교한다. 몬스터 두 곳의
      // 윤곽이 번갈아 잡히는 현상은 끊고, 천천히 떠다니는 안내문은 이어서 센다.
      return sameFloatingCandidate(left, right);
    }
    return sizeRatio <= 1.25
      && positionDistance <= Math.max(6, Math.min(width, height) * 0.22);
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

  const clearPopupCooldown = (analyzerInstance, state, preserveEvidence = false) => {
    state.cooldownActive = false;
    state.isDetected = false;
    state.missedCount = 0;
    state.lastType = '';
    state.lastAlertAt = 0;
    state.cooldownTrackMatch = null;
    if (!preserveEvidence) {
      state.lastMatch = null;
      state.consecutiveCount = 0;
      state.recentPopupEvidence = [];
    }
    if (analyzerInstance.onPopupStatusChange && window.screenCaptureManager?.isStreaming) {
      analyzerInstance.onPopupStatusChange('🟢 거탐 감시 중 (7개 유형 위치·형태 교차 확인)', false);
    }
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
    const now = Date.now();
    if (!Array.isArray(state.recentPopupEvidence)) state.recentPopupEvidence = [];
    if (!Number.isFinite(state.lastAlertAt)) state.lastAlertAt = 0;
    if (!Number.isFinite(state.repeatAlertUntil)) state.repeatAlertUntil = 0;
    if (!Number.isFinite(state.repeatAlertCount)) state.repeatAlertCount = 0;
    if (typeof state.popupEventActive !== 'boolean') state.popupEventActive = false;
    if (!Number.isFinite(state.popupEventStartedAt)) state.popupEventStartedAt = 0;
    if (!Number.isFinite(state.popupEventLastEvidenceAt)) state.popupEventLastEvidenceAt = 0;
    const popupEventExpired = state.popupEventActive && (
      (state.repeatAlertCount >= POPUP_REPEAT_ALERT_COUNT
        && state.popupEventLastEvidenceAt > 0
        && now - state.popupEventLastEvidenceAt >= POPUP_EVENT_CLEAR_MS)
      || (state.popupEventStartedAt > 0
        && now - state.popupEventStartedAt >= POPUP_EVENT_MAX_MS)
    );
    if (popupEventExpired) {
      state.popupEventActive = false;
      state.popupEventStartedAt = 0;
      state.popupEventLastEvidenceAt = 0;
      state.repeatAlertUntil = 0;
      state.repeatAlertCount = 0;
      state.repeatAlertType = '';
      clearPopupCooldown(this, state);
    }
    const repeatAlertDue = state.repeatAlertUntil >= now
      && state.repeatAlertCount > 0
      && state.repeatAlertCount < POPUP_REPEAT_ALERT_COUNT
      && state.lastAlertAt > 0
      && now - state.lastAlertAt >= POPUP_MAX_COOLDOWN_MS;
    if (repeatAlertDue) {
      // 최초 확정 뒤에는 전투 이펙트가 안내를 잠깐 가려도 3초 간격으로
      // 두 번까지 알린다. 10초 안에 풀어야 하는 상황에서 첫 소리를
      // 놓쳐도 다시 들을 수 있게 하되, 절대시간 창이 지나면 반드시 끝낸다.
      const repeatType = state.repeatAlertType || state.lastDetectedSubtype || '거짓말 탐지기';
      clearPopupCooldown(this, state, true);
      state.lastAlertAt = now;
      state.repeatAlertCount++;
      this.triggerPopupStructureAlert(repeatType, { telegram: false });
    } else if (state.cooldownActive
      && (!state.lastAlertAt || now - state.lastAlertAt >= POPUP_MAX_COOLDOWN_MS)) {
      // 다른 전투 이펙트가 계속 후보로 잡혀도 재알림 제한이 영구 연장되지 않는다.
      clearPopupCooldown(this, state);
    }
    if (state.repeatAlertUntil && now > state.repeatAlertUntil) {
      state.repeatAlertUntil = 0;
    }
    // 색상 무관 전 화면 탐색은 대기 중에는 두 프레임마다 한 번만 실행한다.
    // 첫 후보가 보이면 다음 프레임부터 연속 실행해 300ms 뒤 바로 재확인한다.
    // 기존 따뜻한 색 경로와 템플릿 경로는 매 프레임 그대로 검사한다.
    if (!Number.isFinite(state.colorIndependentScanIndex)) state.colorIndependentScanIndex = 0;
    const trackingColorIndependentLayout = state.lastMatch?.structuralEvidence
      === 'floating-activation-layout'
      || state.recentPopupEvidence.some((entry) => (
        now - entry.seenAt <= POPUP_EVIDENCE_WINDOW_MS
        && entry.match?.structuralEvidence === 'floating-activation-layout'
      ));
    const runColorIndependentScan = trackingColorIndependentLayout
      || state.colorIndependentScanIndex % 2 === 0;
    state.colorIndependentScanIndex++;
    const previousSkipColorIndependent = imageData.skipColorIndependentActivation;
    if (!runColorIndependentScan) imageData.skipColorIndependentActivation = true;
    let match;
    try {
      match = this.verifyPopupTemplateMatch(imageData, this.findPopupTemplateMatch(imageData));
    } finally {
      if (previousSkipColorIndependent === undefined) {
        delete imageData.skipColorIndependentActivation;
      } else {
        imageData.skipColorIndependentActivation = previousSkipColorIndependent;
      }
    }
    state.lastConfidence = match.confidence || 0;
    if (match.verified) {
      if (state.popupEventActive) state.popupEventLastEvidenceAt = now;
      const isFloatingActivation = ['floating-activation-text', 'floating-activation-layout']
        .includes(match.structuralEvidence);
      const isColorIndependentLayout = match.structuralEvidence === 'floating-activation-layout';
      const isSame = samePopup(state.lastMatch, match);
      const sameCooldownEvent = state.cooldownActive
        && samePopup(state.cooldownTrackMatch, match);
      if (!state.cooldownActive || sameCooldownEvent) {
        state.missedCount = 0;
      } else {
        // 이미 알린 사건과 다른 후보는 이전 사건의 잠금 시간을 연장하지 않는다.
        state.missedCount++;
      }
      if (sameCooldownEvent) state.cooldownTrackMatch = copyMatch(match);
      state.consecutiveCount = isSame ? state.consecutiveCount + 1 : 1;
      state.lastType = match.type;
      state.lastMatch = copyMatch(match);

      if (isFloatingActivation) {
        const recentFloating = state.recentPopupEvidence.filter((entry) => (
          now - entry.seenAt <= POPUP_EVIDENCE_WINDOW_MS
          && entry.match?.type === match.type
          && entry.match?.detectedType === match.detectedType
          && ['floating-activation-text', 'floating-activation-layout']
            .includes(entry.match?.structuralEvidence)
        ));
        const previousFloating = recentFloating[recentFloating.length - 1]?.match;
        state.recentPopupEvidence = previousFloating
          && sameFloatingCandidate(previousFloating, match)
          ? recentFloating
          : [];
        state.recentPopupEvidence.push({ seenAt: now, match: copyMatch(match) });
      } else {
        state.recentPopupEvidence = [];
      }

      // 원형 몬스터 사망 잔상은 짧게 실제 클릭판과 비슷해질 수 있다. 위치가
      // 움직여도 같은 원 크기·고유 구조가 3회 이어질 때 확정한다. 나머지
      // 유형은 기존 2회 확인을 유지해 알림 반응성을 보존한다.
      const requiredConsecutive = (
        match.structuralEvidence === 'circular-click-game' || isColorIndependentLayout
      ) ? Math.max(3, state.REQUIRED_CONSECUTIVE) : state.REQUIRED_CONSECUTIVE;
      // 떠다니는 발동 안내는 신뢰도가 높아도 한 장만으로 확정하지 않는다.
      // 같은 실제 증거 상자가 2.5초 안에 이어지고 조금이라도 이동해야 한다.
      // 정지한 몬스터 윤곽과 화면 곳곳의 공격 숫자를 이어 붙이는 오탐을 막는다.
      const minimumMovement = Math.max(
        2,
        Math.min(
          popupEvidenceBox(match)?.width || 1,
          popupEvidenceBox(match)?.height || 1
        ) * 0.04
      );
      const confirmedWithinWindow = isFloatingActivation
        && state.recentPopupEvidence.length >= 2
        && floatingTrackMovement(state.recentPopupEvidence) >= minimumMovement
        // 실제 안내는 색이 계속 변하므로 따뜻한 색 횟수를 늘리지 않는다.
        // 대신 직전 후보와의 5줄 잉크 비율 비교를 sameFloatingCandidate에서
        // 반드시 통과시켜 MISS·콤보 숫자·몬스터 윤곽의 형태 변화를 차단한다.
        && state.recentPopupEvidence.some((entry) => (
          entry.match?.structuralEvidence === 'floating-activation-text'
        ));
      const candidateConfirmed = isFloatingActivation
        ? confirmedWithinWindow
        : state.consecutiveCount >= requiredConsecutive;

      if (candidateConfirmed && !state.isDetected && !state.cooldownActive
        && !state.popupEventActive) {
        const alertType = match.detectedType || match.type;
        state.lastAlertAt = now;
        state.cooldownTrackMatch = copyMatch(match);
        state.repeatAlertUntil = now + POPUP_REPEAT_WINDOW_MS;
        state.repeatAlertCount = 1;
        state.repeatAlertType = alertType;
        state.popupEventActive = true;
        state.popupEventStartedAt = now;
        state.popupEventLastEvidenceAt = now;
        this.triggerPopupStructureAlert(alertType);
      }

      if (state.isDetected && !sameCooldownEvent
        && state.missedCount >= POPUP_STATUS_CLEAR_MISSES) {
        state.isDetected = false;
      }
      return;
    }
    state.consecutiveCount = 0;
    state.lastMatch = null;
    state.recentPopupEvidence = state.recentPopupEvidence.filter(
      (entry) => now - entry.seenAt <= POPUP_EVIDENCE_WINDOW_MS
    );
    state.missedCount++;
    // 화면 상태 표시는 약 1.8초 뒤 감시 중으로 되돌리되, 10초 안에 풀어야 하는
    // 상황을 놓치지 않도록 재알림 제한은 절대시간 3초까지만 유지한다.
    if (state.isDetected && state.missedCount >= POPUP_STATUS_CLEAR_MISSES) {
      state.isDetected = false;
      if (this.onPopupStatusChange && window.screenCaptureManager?.isStreaming) {
        this.onPopupStatusChange('🟢 거탐 감시 중 (재알림 제한 중)', false);
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
    this.popupState.lastAlertAt = 0;
    this.popupState.cooldownTrackMatch = null;
    this.popupState.recentPopupEvidence = [];
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
