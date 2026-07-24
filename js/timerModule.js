/**
 * TimerModule - 경험치 쿠폰 & 솔 야누스 타이머 엔진
 */
class TimerModule {
  constructor() {
    // 경험치 쿠폰 타이머 상태
    this.expTimer = {
      totalSeconds: 1800, // 기본 30분
      remainingSeconds: 1800,
      isRunning: false,
      intervalId: null,
      alert60Triggered: false,
      alert30Triggered: false,
      alertEndTriggered: false,
      endRepeatInterval: null
    };

    // 솔 야누스 타이머 상태
    this.janusTimer = {
      cycleSeconds: 80, // 기본 80초
      remainingSeconds: 80,
      isRunning: false,
      intervalId: null,
      preAlertTriggered: false
    };

    // 도핑 버프 타이머 상태 (재획비 2시간, MVP 30분, 익스골드 30분)
    this.dopingTimers = {
      wealth: { totalSecs: 7200, remSecs: 7200, isRunning: false, intervalId: null, alert5m: false, alert1m: false, name: '재획비' },
      mvp: { totalSecs: 1800, remSecs: 1800, isRunning: false, intervalId: null, alert5m: false, alert1m: false, name: 'MVP 뿌리기' },
      exgold: { totalSecs: 1800, remSecs: 1800, isRunning: false, intervalId: null, alert5m: false, alert1m: false, name: '익스트림 골드' }
    };

    // 이벤트 콜백
    this.onExpTick = null;
    this.onJanusTick = null;
    this.onDopingTick = null;
  }

  /* ===================================================
   * 1. 경험치 쿠폰 타이머 메서드
   * =================================================== */
  setExpPresetMinutes(mins) {
    const secs = mins * 60;
    this.expTimer.totalSeconds = secs;
    this.expTimer.remainingSeconds = secs;
    this.resetExpFlags();
    if (this.onExpTick) this.onExpTick(this.expTimer);
  }

  addExpMinutes(mins) {
    const addSecs = mins * 60;
    this.expTimer.remainingSeconds += addSecs;
    this.expTimer.totalSeconds = Math.max(this.expTimer.totalSeconds, this.expTimer.remainingSeconds);
    
    // 시간 늘어났으면 알림 플래그 재조정
    if (this.expTimer.remainingSeconds > 60) this.expTimer.alert60Triggered = false;
    if (this.expTimer.remainingSeconds > 30) this.expTimer.alert30Triggered = false;

    if (this.onExpTick) this.onExpTick(this.expTimer);
  }

  startExpTimer() {
    if (this.expTimer.isRunning) return;
    if (this.expTimer.remainingSeconds <= 0) {
      this.expTimer.remainingSeconds = this.expTimer.totalSeconds;
      this.resetExpFlags();
    }

    this.expTimer.isRunning = true;
    const startTime = Date.now();
    const initialRem = this.expTimer.remainingSeconds;

    this.expTimer.intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const currentRem = Math.max(0, initialRem - elapsed);

      this.expTimer.remainingSeconds = currentRem;
      if (currentRem > 0) {
        this.checkExpAlerts();
      } else {
        this.handleExpEnd();
      }
      if (this.onExpTick) this.onExpTick(this.expTimer);
    }, 1000);
  }

  pauseExpTimer() {
    this.expTimer.isRunning = false;
    if (this.expTimer.intervalId) {
      clearInterval(this.expTimer.intervalId);
      this.expTimer.intervalId = null;
    }
    this.stopExpEndRepeat();
  }

  resetExpTimer() {
    this.pauseExpTimer();
    this.expTimer.remainingSeconds = this.expTimer.totalSeconds;
    this.resetExpFlags();
    if (this.onExpTick) this.onExpTick(this.expTimer);
  }

  resetExpFlags() {
    this.expTimer.alert10Triggered = false;
    this.expTimer.alertEndTriggered = false;
    this.stopExpEndRepeat();
  }

  checkExpAlerts() {
    const rem = this.expTimer.remainingSeconds;
    const chk10 = document.getElementById('chk-exp-alert-10')?.checked;

    if (rem === 10 && chk10 && !this.expTimer.alert10Triggered) {
      this.expTimer.alert10Triggered = true;
      window.audioNotifier.notify('🧪 [메이플] 경험치 쿠폰 종료 10초 전입니다.', 'chime');
    }
  }

  handleExpEnd() {
    if (!this.expTimer.alertEndTriggered) {
      this.expTimer.alertEndTriggered = true;
      const chkEnd = document.getElementById('chk-exp-alert-end')?.checked;
      
      window.audioNotifier.notify('🧪 [메이플] 경험치 쿠폰 타이머가 만료되었습니다!', 'siren');

      if (chkEnd) {
        // 종료 후 10초마다 반복 알림
        this.expTimer.endRepeatInterval = setInterval(() => {
          if (!this.expTimer.isRunning && this.expTimer.remainingSeconds <= 0) {
            window.audioNotifier.notify('🧪 [메이플] 경험치 쿠폰 재사용이 필요합니다!', 'siren');
          } else {
            this.stopExpEndRepeat();
          }
        }, 10000);
      }
    }
    this.pauseExpTimer();
  }

  stopExpEndRepeat() {
    if (this.expTimer.endRepeatInterval) {
      clearInterval(this.expTimer.endRepeatInterval);
      this.expTimer.endRepeatInterval = null;
    }
  }


  /* ===================================================
   * 2. 솔 야누스 주기 타이머 메서드
   * =================================================== */
  setJanusCycle(secs) {
    this.janusTimer.cycleSeconds = secs;
    this.janusTimer.remainingSeconds = secs;
    this.janusTimer.preAlertTriggered = false;
    if (this.onJanusTick) this.onJanusTick(this.janusTimer);
  }

  startJanusTimer() {
    // 기존 작동 중이어도 즉시 시작(재시작) 기능
    if (this.janusTimer.intervalId) {
      clearInterval(this.janusTimer.intervalId);
    }

    this.janusTimer.remainingSeconds = this.janusTimer.cycleSeconds;
    this.janusTimer.preAlertTriggered = false;
    this.janusTimer.isRunning = true;

    if (this.onJanusTick) this.onJanusTick(this.janusTimer);

    const startTime = Date.now();
    const initialRem = this.janusTimer.remainingSeconds;

    this.janusTimer.intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const currentRem = Math.max(0, initialRem - elapsed);

      this.janusTimer.remainingSeconds = currentRem;
      if (currentRem > 0) {
        this.checkJanusAlerts();
      } else {
        this.handleJanusEnd();
      }
      if (this.onJanusTick) this.onJanusTick(this.janusTimer);
    }, 1000);
  }

  resetJanusTimer() {
    if (this.janusTimer.intervalId) {
      clearInterval(this.janusTimer.intervalId);
      this.janusTimer.intervalId = null;
    }
    this.janusTimer.isRunning = false;
    this.janusTimer.remainingSeconds = this.janusTimer.cycleSeconds;
    this.janusTimer.preAlertTriggered = false;
    if (this.onJanusTick) this.onJanusTick(this.janusTimer);
  }

  checkJanusAlerts() {
    const rem = this.janusTimer.remainingSeconds;
    const chkPre = document.getElementById('chk-janus-prealert')?.checked;

    if (rem === 5 && chkPre && !this.janusTimer.preAlertTriggered) {
      this.janusTimer.preAlertTriggered = true;
      window.audioNotifier.notify('⚡ [메이플] 솔 야누스 5초 전', 'beep');
    }
  }

  handleJanusEnd() {
    this.resetJanusTimer();
    const chkEnd = document.getElementById('chk-janus-endalert')?.checked;
    if (chkEnd) {
      window.audioNotifier.notify('⚡ [메이플] 솔 야누스 만료! 구체를 재설치하세요.', 'beep');
    }
  }

  /* ===================================================
   * 3. 사냥 필수 도핑 버프 타이머 메서드 (재획비, MVP, 익스골드)
   * =================================================== */
  startDopingTimer(key) {
    const item = this.dopingTimers[key];
    if (!item) return;

    if (item.isRunning) return;
    if (item.remSecs <= 0) {
      item.remSecs = item.totalSecs;
      item.alert5m = false;
      item.alert1m = false;
    }

    item.isRunning = true;
    if (this.onDopingTick) this.onDopingTick(key, item);

    const startTime = Date.now();
    const initialRem = item.remSecs;

    item.intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const currentRem = Math.max(0, initialRem - elapsed);

      item.remSecs = currentRem;
      if (currentRem > 0) {
        this.checkDopingAlerts(key, item);
      } else {
        this.handleDopingEnd(key, item);
      }
      if (this.onDopingTick) this.onDopingTick(key, item);
    }, 1000);
  }

  pauseDopingTimer(key) {
    const item = this.dopingTimers[key];
    if (!item) return;

    item.isRunning = false;
    if (item.intervalId) {
      clearInterval(item.intervalId);
      item.intervalId = null;
    }
  }

  resetDopingTimer(key) {
    const item = this.dopingTimers[key];
    if (!item) return;

    this.pauseDopingTimer(key);
    item.remSecs = item.totalSecs;
    item.alert5m = false;
    item.alert1m = false;
    if (this.onDopingTick) this.onDopingTick(key, item);
  }

  checkDopingAlerts(key, item) {
    const rem = item.remSecs;
    const chk10s = document.getElementById('chk-doping-10s')?.checked;

    if (rem === 10 && chk10s && !item.alert10s) {
      item.alert10s = true;
      window.audioNotifier.notify(`💰 [메이플] ${item.name} 버프 종료 10초 전입니다.`, 'chime');
    }
  }

  handleDopingEnd(key, item) {
    this.pauseDopingTimer(key);
    window.audioNotifier.notify(`💰 [메이플] ${item.name} 버프가 종료되었습니다!`, 'siren');
  }
}

window.timerModule = new TimerModule();
