/* 야누스 전용 상태 기계. 이전 임박 경고/숫자 폭 추정/14프레임 종료 로직을 사용하지 않는다. */
(() => {
  'use strict';
  class JanusPresenceTracker {
    constructor(onExpired, onStatus = () => {}) {
      this.onExpired = onExpired;
      this.onStatus = onStatus;
      this.reset();
    }
    reset() {
      this.active = false;
      this.startAt = null;
      this.startCount = 0;
      this.missingAt = null;
      this.missingCount = 0;
      this.lastAt = null;
      this.lastMatch = null;
    }
    update({ present = false, canStart = false, valid = true, match = null }, now) {
      // 명시적인 공유 중단은 초기화하지만, 분석 지연만으로 이미 본 아이콘을 잊지 않는다.
      if (!valid || !Number.isFinite(now)) {
        this.pause();
        this.onStatus('⚪ 화면 확인 대기');
        return;
      }
      if (this.lastAt !== null && now <= this.lastAt) this.reset();
      else if (this.lastAt !== null && now - this.lastAt > 2500) {
        this.missingAt = null;
        this.missingCount = 0;
        this.startAt = null;
        this.startCount = 0;
      }
      this.lastAt = now;
      if (!this.active) {
        if (!present || !canStart) {
          this.startAt = null;
          this.startCount = 0;
          this.lastMatch = null;
          this.onStatus('⚪ 야누스 아이콘 대기');
          return;
        }
        if (this.startAt === null) this.startAt = now;
        this.startCount++;
        this.lastMatch = match;
        if (this.startCount >= 3 && now - this.startAt >= 600) {
          this.active = true;
          this.onStatus('🟣 야누스 유지 확인');
        } else this.onStatus('🟡 야누스 확인 중');
        return;
      }
      if (present) {
        this.missingAt = null;
        this.missingCount = 0;
        if (match) this.lastMatch = match;
        this.onStatus('🟣 야누스 유지 확인');
        return;
      }
      if (this.missingAt === null) this.missingAt = now;
      this.missingCount++;
      this.onStatus('🟡 야누스 소멸 확인 중');
      // 최소 3장의 새 프레임과 1초 부재. 분석이 멎은 시간은 부재로 누적하지 않는다.
      if (this.missingCount >= 3 && now - this.missingAt >= 1000) {
        this.reset(); // 알림 실패/재진입에도 동일 주기를 중복 발송하지 않는다.
        this.onStatus('🔔 야누스 소멸 감지 · 재사용 대기');
        this.onExpired();
      }
    }
    pause() {
      this.missingAt = null;
      this.missingCount = 0;
      this.startAt = null;
      this.startCount = 0;
      this.lastAt = null;
    }
  }
  window.JanusPresenceTracker = JanusPresenceTracker;
  const proto = window.imageAnalyzer?.constructor.prototype;
  if (!proto) return;
  const status = text => {
    const pill = document.getElementById('janus-status-pill');
    if (pill) pill.textContent = text;
  };
  proto.resetJanusPresence = function () {
    this.janusPresenceTracker?.reset();
    this.janusFrameSize = null;
    status('⚪ 야누스 아이콘 대기');
  };
  proto.pauseJanusPresence = function () {
    this.janusPresenceTracker?.pause();
    status('⚪ 화면 확인 대기 · 추적 보존');
  };
  proto.processJanusPresenceFrame = function (frame, now = performance.now()) {
    if (!this.janusPresenceTracker) this.janusPresenceTracker = new JanusPresenceTracker(
      () => window.audioNotifier?.notify('솔 야누스 아이콘이 사라졌습니다. 다시 사용해 주세요.', 'janus', { telegram: true }),
      status
    );
    const tracker = this.janusPresenceTracker;
    if (!document.getElementById('toggle-janus-detection')?.checked || !frame?.data?.length) {
      this.resetJanusPresence();
      return;
    }
    const size = `${frame.width}:${frame.height}`;
    if (this.janusFrameSize !== size) tracker.reset();
    this.janusFrameSize = size;
    // 검은 화면/최소화는 버프 만료가 아니다. ROI의 충분한 유효 화소를 요구한다.
    let visible = 0, samples = 0;
    for (let i = 0; i < frame.data.length; i += 64) {
      samples++;
      if (Math.max(frame.data[i], frame.data[i + 1], frame.data[i + 2]) > 35) visible++;
    }
    if (visible < samples * .08) {
      tracker.update({ valid: false }, now);
      return;
    }
    // 새 야누스 전용 판별기에 과거/추가 영상의 숫자 제외 표본을 전달한다.
    // 이전 버프 판별·상태 처리 함수는 호출하지 않는다.
    const match = window.findJanusIcon(frame, tracker.lastMatch);
    const shape = match?.found ? this.measureBuffIconShape(frame, match.x, match.y, match.size) : {};
    const canStart = Boolean(match?.found && match.kind !== 'ending' && shape.yellowDigitPixels >= 3 && shape.largestYellowDigitComponent >= 2);
    let present = Boolean(match?.found);
    if (!present && tracker.active && tracker.lastMatch) {
      const ending = window.findJanusIcon(frame, tracker.lastMatch, true);
      const sameSlot = ending?.found && Math.hypot(ending.x - tracker.lastMatch.x, ending.y - tracker.lastMatch.y) <= Math.max(6, ending.size * .35);
      // 회색 종료 위상도 아이콘이 아직 존재하는 동안은 알리지 않는다.
      present = Boolean(sameSlot);
    }
    tracker.update({ present, canStart, match: match?.found ? match : null }, now);
  };
  const reset = proto.reset;
  proto.reset = function (...args) {
    const result = reset.apply(this, args);
    this.resetJanusPresence();
    return result;
  };
})();
