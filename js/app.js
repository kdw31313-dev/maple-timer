/**
 * App.js - 메인 애플리케이션 진입점 및 이벤트 바인딩
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. 설정 불러오기 및 적용
  const config = window.storageManager.loadConfig();
  applyConfigToUI(config);

  // 2. 타이머 콜백 바인딩
  window.timerModule.onExpTick = (expState) => {
    updateExpUI(expState);
  };

  window.timerModule.onJanusTick = (janusState) => {
    updateJanusUI(janusState);
  };

  window.timerModule.onDopingTick = (key, itemState) => {
    updateDopingUI(key, itemState);
  };

  // 3. 이미지 분석 콜백 바인딩
  window.imageAnalyzer.onRuneStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('rune-status-pill');
    if (pill) {
      pill.textContent = statusText;
      if (isDetected) {
        pill.className = 'status-pill detected';
      } else {
        pill.className = 'status-pill';
      }
    }
  };

  window.imageAnalyzer.onPopupStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('popup-status-pill');
    if (pill) {
      pill.textContent = statusText;
      if (isDetected) {
        pill.className = 'status-pill detected';
      } else {
        pill.className = 'status-pill';
      }
    }
  };

  window.imageAnalyzer.onJanusStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('janus-status-pill');
    if (pill) {
      pill.textContent = statusText;
      if (isDetected) {
        pill.className = 'status-pill detected';
      } else {
        pill.className = 'status-pill';
      }
    }
  };

  // 4. UI 이벤트 바인딩
  bindEvents();
});

/**
 * UI 이벤트 바인딩 함수
 */
function bindEvents() {
  // --- 화면 공유 관련 ---
  const startBtn = document.getElementById('btn-start-share');
  const stopBtn = document.getElementById('btn-stop-share');

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      window.audioNotifier.initAudioContext(); // 사운드 컨텍스트 잠금 해제
      await window.screenCaptureManager.startCapture();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      window.screenCaptureManager.stopCapture();
    });
  }

  // --- ROI 드래그 영역 지정 버튼 ---
  document.getElementById('btn-select-rune-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.setSelectionMode('rune');
  });

  document.getElementById('btn-select-popup-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.setSelectionMode('popup');
  });

  document.getElementById('btn-select-janus-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.setSelectionMode('janus');
  });

  // --- 경험치 쿠폰 타이머 버튼 ---
  const expStartBtn = document.getElementById('btn-exp-start');
  const expPauseBtn = document.getElementById('btn-exp-pause');
  const expResetBtn = document.getElementById('btn-exp-reset');

  expStartBtn?.addEventListener('click', () => {
    window.audioNotifier.initAudioContext();
    window.timerModule.startExpTimer();
    expStartBtn.classList.add('hidden');
    expPauseBtn.classList.remove('hidden');
  });

  expPauseBtn?.addEventListener('click', () => {
    window.timerModule.pauseExpTimer();
    expPauseBtn.classList.add('hidden');
    expStartBtn.classList.remove('hidden');
  });

  expResetBtn?.addEventListener('click', () => {
    window.timerModule.resetExpTimer();
    expPauseBtn.classList.add('hidden');
    expStartBtn.classList.remove('hidden');
  });

  // 쿠폰 프리셋 (15m, 30m, 60m)
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const mins = parseInt(e.target.getAttribute('data-minutes'), 10);
      window.timerModule.setExpPresetMinutes(mins);

      // 설정 저장
      saveCurrentConfig();
    });
  });

  // 쿠폰 시간 퀵 추가
  document.getElementById('btn-exp-add1')?.addEventListener('click', () => {
    window.timerModule.addExpMinutes(1);
  });
  document.getElementById('btn-exp-add5')?.addEventListener('click', () => {
    window.timerModule.addExpMinutes(5);
  });


  // --- 솔 야누스 타이머 버튼 ---
  const janusStartBtn = document.getElementById('btn-janus-start');
  const janusResetBtn = document.getElementById('btn-janus-reset');

  janusStartBtn?.addEventListener('click', () => {
    window.audioNotifier.initAudioContext();
    window.timerModule.startJanusTimer();
  });

  janusResetBtn?.addEventListener('click', () => {
    window.timerModule.resetJanusTimer();
  });

  // 솔 야누스 주기 선택 라디오
  document.querySelectorAll('input[name="janus-cycle"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const secs = parseInt(e.target.value, 10);
      window.timerModule.setJanusCycle(secs);
      saveCurrentConfig();
    });
  });

  // 단축키 (Spacebar 누르면 솔 야누스 타이머 재시작)
  window.addEventListener('keydown', (e) => {
    // 텍스트 입력 중일 때는 제외
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      window.audioNotifier.initAudioContext();
      window.timerModule.startJanusTimer();
    }
  });


  // --- 사냥 필수 도핑 타이머 버튼 (재획비, MVP, 익스골드) ---
  ['wealth', 'mvp', 'exgold'].forEach(key => {
    const startBtn = document.getElementById(`btn-${key}-start`);
    const pauseBtn = document.getElementById(`btn-${key}-pause`);
    const resetBtn = document.getElementById(`btn-${key}-reset`);

    startBtn?.addEventListener('click', () => {
      window.audioNotifier.initAudioContext();
      window.timerModule.startDopingTimer(key);
      startBtn.classList.add('hidden');
      pauseBtn?.classList.remove('hidden');
    });

    pauseBtn?.addEventListener('click', () => {
      window.timerModule.pauseDopingTimer(key);
      pauseBtn.classList.add('hidden');
      startBtn?.classList.remove('hidden');
    });

    resetBtn?.addEventListener('click', () => {
      window.timerModule.resetDopingTimer(key);
      pauseBtn?.classList.add('hidden');
      startBtn?.classList.remove('hidden');
    });
  });

  // --- 알림 & 사운드 설정 바인딩 ---
  const soundSelect = document.getElementById('select-sound-preset');
  const volRange = document.getElementById('range-volume');
  const volText = document.getElementById('volume-val-text');
  const ttsToggle = document.getElementById('toggle-tts-voice');
  const flashToggle = document.getElementById('toggle-visual-flash');

  soundSelect?.addEventListener('change', (e) => {
    window.audioNotifier.setPreset(e.target.value);
    saveCurrentConfig();
  });

  volRange?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (volText) volText.textContent = `${val}%`;
    window.audioNotifier.setVolume(val);
    saveCurrentConfig();
  });

  ttsToggle?.addEventListener('change', (e) => {
    window.audioNotifier.setTTS(e.target.checked);
    saveCurrentConfig();
  });

  flashToggle?.addEventListener('change', (e) => {
    window.audioNotifier.setFlash(e.target.checked);
    saveCurrentConfig();
  });

  // 소리 테스트 버튼
  document.getElementById('btn-test-sound')?.addEventListener('click', () => {
    window.audioNotifier.notify('알림 테스트입니다', soundSelect ? soundSelect.value : 'chime');
  });

  // PIP 버튼
  document.getElementById('btn-pip-toggle')?.addEventListener('click', () => {
    window.pipController.togglePip();
  });

  // 백업 및 복원 버튼
  document.getElementById('btn-export-settings')?.addEventListener('click', () => {
    window.storageManager.exportConfig();
  });

  const importFileBtn = document.getElementById('btn-import-settings');
  const importFileInput = document.getElementById('file-import-settings');

  importFileBtn?.addEventListener('click', () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imported = window.storageManager.importConfig(event.target.result);
      if (imported) {
        applyConfigToUI(imported);
        alert('설정이 성공적으로 복원되었습니다!');
      } else {
        alert('올바르지 않은 설정 파일입니다.');
      }
    };
    reader.readAsText(file);
  });

  // 설정 초기화 버튼
  document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    if (confirm('모든 감지 영역 및 알림 설정을 초기화하시겠습니까?')) {
      const def = window.storageManager.resetConfig();
      applyConfigToUI(def);
      alert('설정이 초기화되었습니다.');
    }
  });
}

/**
 * 시간 포맷 변환 (초 -> MM:SS)
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 경험치 쿠폰 UI 업데이트
 */
function updateExpUI(state) {
  const clock = document.getElementById('exp-timer-clock');
  const progressBar = document.getElementById('exp-progress-bar');

  if (clock) clock.textContent = formatTime(state.remainingSeconds);
  if (progressBar && state.totalSeconds > 0) {
    const pct = Math.max(0, (state.remainingSeconds / state.totalSeconds) * 100);
    progressBar.style.width = `${pct}%`;
  }
}

/**
 * 시:분:초 포맷 변환 (초 -> HH:MM:SS 또는 MM:SS)
 */
function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 도핑 버프 타이머 UI 업데이트
 */
function updateDopingUI(key, itemState) {
  const clock = document.getElementById(`doping-${key}-clock`);
  if (clock) {
    clock.textContent = formatHMS(itemState.remSecs);
  }
}

/**
 * 저장된 설정을 UI에 반영
 */
function applyConfigToUI(cfg) {
  // 사운드 설정
  const soundSelect = document.getElementById('select-sound-preset');
  const volRange = document.getElementById('range-volume');
  const volText = document.getElementById('volume-val-text');
  const ttsToggle = document.getElementById('toggle-tts-voice');
  const flashToggle = document.getElementById('toggle-visual-flash');

  if (soundSelect) soundSelect.value = cfg.soundPreset;
  if (volRange) volRange.value = cfg.volume;
  if (volText) volText.textContent = `${cfg.volume}%`;
  if (ttsToggle) ttsToggle.checked = cfg.ttsVoice;
  if (flashToggle) flashToggle.checked = cfg.visualFlash;

  window.audioNotifier.setPreset(cfg.soundPreset);
  window.audioNotifier.setVolume(cfg.volume);
  window.audioNotifier.setTTS(cfg.ttsVoice);
  window.audioNotifier.setFlash(cfg.visualFlash);

  // 경험치 타이머 프리셋
  document.querySelectorAll('.btn-preset').forEach(btn => {
    const mins = parseInt(btn.getAttribute('data-minutes'), 10);
    if (mins === cfg.expPresetMinutes) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  window.timerModule.setExpPresetMinutes(cfg.expPresetMinutes);

  // 야누스 주기
  const janusRadio = document.querySelector(`input[name="janus-cycle"][value="${cfg.janusCycle}"]`);
  if (janusRadio) janusRadio.checked = true;
  window.timerModule.setJanusCycle(cfg.janusCycle);

  // ROI 좌표
  if (window.screenCaptureManager) {
    if (cfg.runeRoi) window.screenCaptureManager.runeRoi = cfg.runeRoi;
    if (cfg.popupRoi) window.screenCaptureManager.popupRoi = cfg.popupRoi;
  }
}

/**
 * 현재 UI 상태를 LocalStorage에 저장
 */
function saveCurrentConfig() {
  const soundSelect = document.getElementById('select-sound-preset');
  const volRange = document.getElementById('range-volume');
  const ttsToggle = document.getElementById('toggle-tts-voice');
  const flashToggle = document.getElementById('toggle-visual-flash');
  const activePresetBtn = document.querySelector('.btn-preset.active');
  const janusRadio = document.querySelector('input[name="janus-cycle"]:checked');

  const cfg = {
    volume: volRange ? parseInt(volRange.value, 10) : 80,
    soundPreset: soundSelect ? soundSelect.value : 'chime',
    ttsVoice: ttsToggle ? ttsToggle.checked : true,
    visualFlash: flashToggle ? flashToggle.checked : true,
    expPresetMinutes: activePresetBtn ? parseInt(activePresetBtn.getAttribute('data-minutes'), 10) : 30,
    janusCycle: janusRadio ? parseInt(janusRadio.value, 10) : 80,
    runeRoi: window.screenCaptureManager ? window.screenCaptureManager.runeRoi : { x: 35, y: 20, w: 30, h: 40 },
    popupRoi: window.screenCaptureManager ? window.screenCaptureManager.popupRoi : { x: 25, y: 25, w: 50, h: 50 }
  };

  window.storageManager.saveConfig(cfg);
}
