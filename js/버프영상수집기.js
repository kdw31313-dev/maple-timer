/**
 * 버프영상수집기
 * 화면 공유 스트림을 저용량으로 순환 녹화하고 중요한 버프 사건만 텔레그램으로 보낸다.
 */
class 버프영상수집기 {
  constructor() {
    this.recorder = null;
    this.isRunning = false;
    this.recentChunks = [];
    this.pendingEvents = [];
    this.headerChunk = null;
    this.chunkIntervalMs = 2000;
    this.recentWindowMs = 16000;
    this.lastEventAt = new Map();
    this.sentCount = 0;
    this.startedAt = 0;
    this.statusTimer = null;
    this.periodicTimer = null;
  }

  getSupportedMimeType() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  }

  start() {
    if (this.isRunning) return true;
    const stream = window.screenCaptureManager?.mediaStream;
    const videoTrack = stream?.getVideoTracks?.()[0];
    if (!stream || !videoTrack || videoTrack.readyState !== 'live') {
      alert('먼저 위의 화면 공유 시작 버튼으로 메이플 게임 화면을 공유해 주세요.');
      return false;
    }
    if (!window.MediaRecorder) {
      alert('현재 브라우저에서는 영상 수집 기능을 지원하지 않습니다.');
      return false;
    }

    const mimeType = this.getSupportedMimeType();
    try {
      this.recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 650000
      });
    } catch (error) {
      console.error('버프 영상 녹화 시작 실패:', error);
      alert('영상 녹화를 시작하지 못했습니다: ' + error.message);
      return false;
    }

    this.recentChunks = [];
    this.pendingEvents = [];
    this.headerChunk = null;
    this.startedAt = Date.now();
    this.isRunning = true;

    this.recorder.ondataavailable = event => {
      if (!event.data || event.data.size === 0) return;
      const item = { blob: event.data, at: Date.now() };
      if (!this.headerChunk) this.headerChunk = item;
      this.recentChunks.push(item);
      const cutoff = Date.now() - this.recentWindowMs;
      this.recentChunks = this.recentChunks.filter(chunk => chunk.at >= cutoff);

      for (const pending of this.pendingEvents) {
        if (item.at >= pending.startedAt) pending.chunks.push(item);
      }
      this.finishReadyEvents();
      this.updateUi();
    };

    this.recorder.onerror = event => {
      console.error('버프 영상 녹화 오류:', event.error || event);
      this.stop('녹화 오류');
    };
    this.recorder.start(this.chunkIntervalMs);
    this.statusTimer = setInterval(() => this.updateUi(), 1000);
    // 인식기가 야누스/익스트림 골드를 전혀 못 잡아도 원본 표본이 남도록
    // 시작 직후 한 번의 야누스 전체 주기와 이후 주기 표본은 판정 결과와 독립적으로 수집한다.
    this.captureEvent(
      'blind-initial',
      '인식 결과와 무관한 시작 직후 원본 (야누스 전체 주기 포함)',
      150,
      180
    );
    this.periodicTimer = setInterval(() => {
      this.captureEvent(
        'blind-periodic',
        '인식 결과와 무관한 5분 주기 원본 표본',
        15,
        270
      );
    }, 5 * 60 * 1000);
    this.updateUi();
    return true;
  }

  stop(reason = '사용자 종료') {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.statusTimer = null;
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    this.periodicTimer = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch (_) {}
    }
    this.recorder = null;
    this.pendingEvents = [];
    this.recentChunks = [];
    this.headerChunk = null;
    this.updateUi(reason);
  }

  captureEvent(type, label, postSeconds = 12, cooldownSeconds = 25) {
    if (!this.isRunning) return false;
    const now = Date.now();
    const last = this.lastEventAt.get(type) || 0;
    if (now - last < cooldownSeconds * 1000) return false;
    this.lastEventAt.set(type, now);

    const before = this.recentChunks.slice();
    this.pendingEvents.push({
      id: `${type}-${now}`,
      type,
      label,
      startedAt: before.length ? before[0].at : now,
      finishAt: now + postSeconds * 1000,
      chunks: before.slice()
    });
    this.updateUi();
    return true;
  }

  startJanusCycle() {
    return this.captureEvent(
      'janus-cycle',
      '솔 야누스 전체 주기 (활성부터 종료까지)',
      135,
      150
    );
  }

  captureJanusMove() {
    return this.captureEvent('janus-move', '솔 야누스 위치 또는 버프줄 이동', 12, 20);
  }

  captureExtremeGoldStart() {
    return this.captureEvent('gold-start', '익스트림 골드 사용 직후', 25, 120);
  }

  captureExtremeGoldMove() {
    return this.captureEvent('gold-move', '익스트림 골드 위치 또는 버프줄 이동', 12, 30);
  }

  captureEnding(type) {
    const isJanus = type === 'janus';
    return this.captureEvent(
      `${type}-ending`,
      isJanus ? '솔 야누스 종료 임박' : '익스트림 골드 종료 임박',
      12,
      30
    );
  }

  captureNow() {
    return this.captureEvent(
      `manual-${Date.now()}`,
      '사용자가 직접 저장한 버프 인식 확인 구간',
      15,
      0
    );
  }

  async finishReadyEvents() {
    const now = Date.now();
    const ready = this.pendingEvents.filter(event => now >= event.finishAt);
    this.pendingEvents = this.pendingEvents.filter(event => now < event.finishAt);
    for (const event of ready) {
      const unique = [];
      const seen = new Set();
      const source = this.headerChunk ? [this.headerChunk, ...event.chunks] : event.chunks;
      for (const chunk of source) {
        const key = `${chunk.at}-${chunk.blob.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(chunk.blob);
      }
      if (!unique.length) continue;
      const blob = new Blob(unique, {
        type: this.recorder?.mimeType || unique[0].type || 'video/webm'
      });
      const seconds = Math.max(1, Math.round((event.finishAt - event.startedAt) / 1000));
      const caption = `🎥 [메이플 버프 영상]\n${event.label}\n약 ${seconds}초 · ${(blob.size / 1024 / 1024).toFixed(1)}MB`;
      const sent = await window.telegramNotifier?.sendVideo?.(blob, caption);
      if (sent) this.sentCount++;
    }
    this.updateUi();
  }

  updateUi(extra = '') {
    const start = document.getElementById('btn-buff-video-start');
    const stop = document.getElementById('btn-buff-video-stop');
    const status = document.getElementById('buff-video-status');
    const count = document.getElementById('buff-video-count');
    start?.classList.toggle('hidden', this.isRunning);
    stop?.classList.toggle('hidden', !this.isRunning);
    if (status) {
      status.className = this.isRunning ? 'status-pill active' : 'status-pill';
      status.textContent = this.isRunning
        ? `🔴 자동 수집 중${this.pendingEvents.length ? ` · 영상 ${this.pendingEvents.length}개 완성 대기` : ''}`
        : `⚪ 수집 대기${extra ? ` · ${extra}` : ''}`;
    }
    if (count) {
      const elapsed = this.isRunning ? Math.floor((Date.now() - this.startedAt) / 1000) : 0;
      count.textContent = `수집 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} · 전송 ${this.sentCount}개`;
    }
  }
}

window.버프영상수집기 = new 버프영상수집기();
