/**
 * 야누스학습수집기 - 실제 사냥 중 다양한 야누스 원본 ROI를 균형 수집해 텔레그램으로 전송한다.
 */
class 야누스학습수집기 {
  constructor() {
    this.isRunning = false;
    this.durationMs = 90 * 60 * 1000;
    this.sampleIntervalMs = 3000;
    this.albumIntervalMs = 2 * 60 * 1000;
    this.queue = [];
    this.sampleTimer = null;
    this.albumTimer = null;
    this.uiTimer = null;
    this.endTimer = null;
    this.endAt = 0;
    this.collectedCount = 0;
    this.sentCount = 0;
    this.failedAlbumCount = 0;
    this.categoryCounts = {};
    this.lastCategoryTime = new Map();
    this.lastSignatureTime = new Map();
    this.previousActive = false;
    this.isSampling = false;
    this.isFlushing = false;
  }

  async start() {
    if (this.isRunning) return true;
    if (!window.screenCaptureManager?.isStreaming) {
      alert('먼저 메이플 화면 공유를 시작해 주세요.');
      return false;
    }
    if (!window.telegramNotifier?.config?.enabled) {
      alert('텔레그램 알림을 먼저 켜 주세요.');
      return false;
    }
    if (
      !window.telegramNotifier.config.botToken?.trim() ||
      !window.telegramNotifier.config.chatId?.trim()
    ) {
      alert('이 컴퓨터에서 텔레그램 봇 토큰과 Chat ID를 입력하고 설정 저장을 먼저 눌러 주세요.');
      return false;
    }

    this.isRunning = true;
    this.queue = [];
    this.collectedCount = 0;
    this.sentCount = 0;
    this.failedAlbumCount = 0;
    this.categoryCounts = {};
    this.lastCategoryTime.clear();
    this.lastSignatureTime.clear();
    this.previousActive = Boolean(window.imageAnalyzer?.janusState?.isBuffActive);
    this.endAt = Date.now() + this.durationMs;

    this.sampleTimer = setInterval(() => this.collectBalancedSample(), this.sampleIntervalMs);
    this.albumTimer = setInterval(() => this.flushAlbum(), this.albumIntervalMs);
    this.uiTimer = setInterval(() => this.updateUi(), 1000);
    this.endTimer = setTimeout(() => this.stop('90분 자동 종료'), this.durationMs);

    this.updateUi();
    await window.telegramNotifier.send(
      '[야누스 학습] 90분 수집을 시작했습니다. 원본 버프 범위를 균형 수집합니다.',
      true
    );
    await this.collectBalancedSample(true);
    return true;
  }

  async stop(reason = '사용자 종료') {
    if (!this.isRunning && this.queue.length === 0) return;
    this.isRunning = false;
    clearInterval(this.sampleTimer);
    clearInterval(this.albumTimer);
    clearInterval(this.uiTimer);
    clearTimeout(this.endTimer);
    this.sampleTimer = null;
    this.albumTimer = null;
    this.uiTimer = null;
    this.endTimer = null;

    while (this.queue.length > 0) {
      const sent = await this.flushAlbum();
      if (!sent) break;
    }

    const breakdown = Object.entries(this.categoryCounts)
      .map(([name, count]) => `${name} ${count}장`)
      .join(' · ') || '수집 없음';
    await window.telegramNotifier?.send(
      `[야누스 학습 완료] ${reason}\n수집 ${this.collectedCount}장 · 전송 ${this.sentCount}장 · 대기 ${this.queue.length}장\n${breakdown}`,
      true
    );
    this.updateUi(reason);
  }

  chooseCategory(now, state, match) {
    const active = Boolean(state?.isBuffActive);
    const shape = match?.shape || {};
    const hasTimer = shape.yellowDigitPixels >= 7 && shape.largestYellowDigitComponent >= 3;
    const score = Number.isFinite(match?.score) ? match.score : 999;

    if (active !== this.previousActive) {
      this.previousActive = active;
      return active ? '가동전환' : '종료전환';
    }

    const candidates = [];
    if (active && match?.found && !hasTimer) candidates.push(['숫자없음', 10000]);
    if (score >= 28 && score <= 36) candidates.push(['애매한점수', 8000]);
    if (active && match?.found && hasTimer) candidates.push(['정상활성', 15000]);
    if (!active && !match?.found) candidates.push(['야누스없음', 30000]);

    for (const [category, cooldown] of candidates) {
      const lastTime = this.lastCategoryTime.get(category) || 0;
      if (now - lastTime >= cooldown) return category;
    }
    return null;
  }

  async collectBalancedSample(force = false) {
    if ((!this.isRunning && !force) || this.isSampling) return;
    const captureManager = window.screenCaptureManager;
    const analyzer = window.imageAnalyzer;
    if (!captureManager?.isStreaming || !analyzer) return;

    const state = analyzer.janusState;
    const match = state?.lastTemplateMatch;
    if (!match?.shape) return;

    const now = Date.now();
    const category = force ? '수집시작' : this.chooseCategory(now, state, match);
    if (!category) return;

    const score = Number.isFinite(match.score) ? match.score : 999;
    const signature = [
      category,
      Math.round(score / 2),
      Math.round((match.x || 0) / 15),
      Math.round((match.y || 0) / 15),
      Math.round((match.shape.yellowDigitPixels || 0) / 5)
    ].join(':');
    const previousSignatureAt = this.lastSignatureTime.get(signature) || 0;
    if (!force && now - previousSignatureAt < 30000) return;

    this.isSampling = true;
    try {
      const capture = await captureManager.captureJanusLearningRoi();
      if (!capture?.blob) return;

      const id = new Date(now).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const activeText = state.isBuffActive ? '활성' : '비활성';
      const caption = [
        `[야누스 학습 · ${category}]`,
        `시간: ${new Date(now).toLocaleString('ko-KR', { hour12: false })}`,
        `자동 판정: ${activeText} · 템플릿 발견: ${match.found ? '예' : '아니오'}`,
        `점수: ${score === 999 ? '측정 불가' : score.toFixed(2)}`,
        `노란 숫자: ${match.shape.yellowDigitPixels || 0}px · 연결 획: ${match.shape.largestYellowDigitComponent || 0}px`,
        `보라색: ${match.shape.violetPixels || 0}px · 어두운색: ${match.shape.darkPixels || 0}px`,
        `후보 좌표: x=${Math.round(match.x || 0)}, y=${Math.round(match.y || 0)} · ROI: ${capture.width}x${capture.height}`,
        '분류 상태: 자동 수집 · 원본 확인 필요'
      ].join('\n');

      this.queue.push({ id: `${id}-${this.collectedCount + 1}`, blob: capture.blob, caption });
      if (this.queue.length > 60) this.queue.shift();
      this.collectedCount++;
      this.categoryCounts[category] = (this.categoryCounts[category] || 0) + 1;
      this.lastCategoryTime.set(category, now);
      this.lastSignatureTime.set(signature, now);
      this.updateUi();
    } finally {
      this.isSampling = false;
    }
  }

  async flushAlbum() {
    if (this.isFlushing || this.queue.length === 0) return false;
    this.isFlushing = true;
    const album = this.queue.splice(0, 10);
    try {
      const success = await window.telegramNotifier?.sendJanusLearningAlbum(album);
      if (!success) {
        this.queue.unshift(...album);
        this.failedAlbumCount++;
        return false;
      }
      this.sentCount += album.length;
      this.failedAlbumCount = 0;
      this.updateUi();
      return true;
    } finally {
      this.isFlushing = false;
    }
  }

  updateUi(finalReason = '') {
    const status = document.getElementById('janus-learning-status');
    const count = document.getElementById('janus-learning-count');
    const startButton = document.getElementById('btn-janus-learning-start');
    const stopButton = document.getElementById('btn-janus-learning-stop');

    if (this.isRunning) {
      const remaining = Math.max(0, this.endAt - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      if (status) {
        status.textContent = `🟣 수집 중 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        status.className = 'status-pill active';
      }
    } else if (status) {
      status.textContent = finalReason ? `✅ ${finalReason}` : '⚪ 수집 대기';
      status.className = 'status-pill';
    }

    if (count) count.textContent = `수집 ${this.collectedCount}장 · 전송 ${this.sentCount}장 · 대기 ${this.queue.length}장`;
    startButton?.classList.toggle('hidden', this.isRunning);
    stopButton?.classList.toggle('hidden', !this.isRunning);
  }
}

window.야누스학습수집기 = new 야누스학습수집기();
