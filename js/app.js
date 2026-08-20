/**
 * App.js - 메인 애플리케이션 진입점 및 이벤트 바인딩
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. 상단 탭 (Tab) 네비게이션 전환 이벤트
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 4. 설정 불러오기 및 적용
  const config = window.storageManager.loadConfig();
  applyConfigToUI(config);

  // 5. 타이머 콜백 바인딩
  window.timerModule.onExpTick = (expState) => {
    updateExpUI(expState);
  };

  window.timerModule.onDopingTick = (key, itemState) => {
    updateDopingUI(key, itemState);
  };

  // 3. 이미지 분석 콜백 바인딩
  window.imageAnalyzer.onRuneStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('rune-status-pill');
    if (pill) {
      if (isDetected) {
        pill.textContent = statusText;
        pill.className = 'status-pill detected';
      } else {
        const isLive = window.screenCaptureManager?.isStreaming;
        pill.textContent = isLive ? '🟢 미니맵 스캔 중 (인식되지 않음)' : statusText;
        pill.className = isLive ? 'status-pill active' : 'status-pill';
      }
    }
  };

  window.imageAnalyzer.onPopupStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('popup-status-pill');
    if (pill) {
      if (isDetected) {
        pill.textContent = statusText;
        pill.className = 'status-pill detected';
      } else {
        const isLive = window.screenCaptureManager?.isStreaming;
        pill.textContent = isLive ? '🟢 거탐 감시 중 (7개 유형 정밀 인식)' : statusText;
        pill.className = isLive ? 'status-pill active' : 'status-pill';
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
    startBtn.onclick = () => {
      if (window.screenCaptureManager) {
        window.screenCaptureManager.startCapture();
      }
    };
  }

  if (stopBtn) {
    stopBtn.onclick = () => {
      if (window.screenCaptureManager) {
        window.screenCaptureManager.stopCapture();
      }
    };
  }

  // --- 200% 정밀 확대 ROI 영역 지정 모달 오픈 ---
  document.getElementById('btn-select-rune-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.openRoiModal('rune');
  });

  // --- 📲 텔레그램 봇 알림 이벤트 바인딩 ---
  const btnTelegramTest = document.getElementById('btn-telegram-test');
  const btnTelegramSave = document.getElementById('btn-telegram-save');
  const toggleTelegram = document.getElementById('toggle-telegram-alert');
  const pillTelegram = document.getElementById('telegram-status-pill');
  const telegramBotToken = document.getElementById('telegram-bot-token');
  const telegramChatId = document.getElementById('telegram-chat-id');
  const telegramThreadId = document.getElementById('telegram-thread-id');

  if (window.telegramNotifier?.config) {
    if (telegramBotToken) telegramBotToken.value = window.telegramNotifier.config.botToken || '';
    if (telegramChatId) telegramChatId.value = window.telegramNotifier.config.chatId || '';
    if (telegramThreadId) telegramThreadId.value = window.telegramNotifier.config.threadId || '';
  }

  if (toggleTelegram) {
    toggleTelegram.checked = window.telegramNotifier?.config?.enabled ?? true;
    toggleTelegram.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      window.telegramNotifier?.saveConfig({ enabled: isEnabled });
      if (pillTelegram) {
        pillTelegram.textContent = isEnabled ? '🟢 연동 완료' : '⚪ 알림 끔';
        pillTelegram.className = isEnabled ? 'status-pill active' : 'status-pill';
      }
    });
  }

  btnTelegramTest?.addEventListener('click', () => {
    if (window.telegramNotifier) {
      window.telegramNotifier.sendTestMessage();
    }
  });

  btnTelegramSave?.addEventListener('click', () => {
    const botToken = telegramBotToken?.value.trim() || '';
    const chatId = telegramChatId?.value.trim() || '';
    const threadId = telegramThreadId?.value.trim() || '';
    if (!botToken || !chatId) {
      alert('봇 토큰과 Chat ID를 입력해 주세요.');
      return;
    }
    window.telegramNotifier?.saveConfig({ botToken, chatId, threadId });
    if (pillTelegram) {
      pillTelegram.textContent = '🟢 설정 저장됨';
      pillTelegram.className = 'status-pill active';
    }
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

  // --- 사냥 필수 도핑 타이머 버튼 (재획비, MVP) ---
  ['wealth', 'mvp'].forEach(key => {
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

  // 메인 소리 테스트 버튼 (상단/설정 탭)
  document.getElementById('btn-test-sound')?.addEventListener('click', () => {
    if (window.audioNotifier) {
      window.audioNotifier.initAudioContext();
      window.audioNotifier.notify('알림 테스트입니다', soundSelect ? soundSelect.value : 'chime');
    }
  });

  // 🔊 항목별 개별 사운드 선택 및 미리듣기 테스트 버튼 이벤트 바인딩
  ['rune', 'popup'].forEach(cat => {
    const selectEl = document.getElementById(`select-sound-${cat}`);
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        const val = e.target.value;
        if (window.audioNotifier) {
          window.audioNotifier.initAudioContext();
          window.audioNotifier.setCustomSound(cat, val);
          window.audioNotifier.playSoundPreset(val); // 선택 변경 시 바로 1회 미리듣기!
        }
        saveCurrentConfig();
      });
    }
  });

  document.querySelectorAll('.btn-test-sound').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = btn.getAttribute('data-sound-cat');
      const selectEl = document.getElementById(`select-sound-${cat}`);
      const soundVal = selectEl ? selectEl.value : 'chime';
      if (window.audioNotifier) {
        window.audioNotifier.initAudioContext();
        window.audioNotifier.playSoundPreset(soundVal);
      }
    });
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
  const importFileInput = document.getElementById('file-import-input');

  importFileBtn?.addEventListener('click', () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const restored = window.storageManager.importConfig(evt.target.result);
      if (restored) {
        alert('✅ 설정이 성공적으로 복원되었습니다!');
        applyConfigToUI(restored);
      } else {
        alert('❌ 올바르지 않은 설정 파일입니다.');
      }
    };
    reader.readAsText(file);
  });

  // 설정 초기화 버튼
  document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    if (confirm('모든 사냥 타이머 및 ROI 설정이 초기화됩니다. 계속 진행할까요?')) {
      window.storageManager.resetConfig();
      location.reload();
    }
  });

  // 타이머 알림 설정 체크박스들 저장 연동
  ['chk-exp-alert-10', 'chk-exp-alert-end', 'chk-doping-10s', 'chk-doping-end'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      saveCurrentConfig();
    });
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

  // 항목별 커스텀 사운드 설정 반영
  if (cfg.customSounds) {
    window.audioNotifier.customSounds = { ...cfg.customSounds };
    ['rune', 'popup'].forEach(cat => {
      const selectEl = document.getElementById(`select-sound-${cat}`);
      if (selectEl && cfg.customSounds[cat]) {
        selectEl.value = cfg.customSounds[cat];
      }
    });
  }

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

  // 타이머 세부 체크박스 반영
  const chkExp10 = document.getElementById('chk-exp-alert-10');
  const chkExpEnd = document.getElementById('chk-exp-alert-end');
  const chkDoping10 = document.getElementById('chk-doping-10s');
  const chkDopingEnd = document.getElementById('chk-doping-end');

  if (chkExp10 && cfg.expAlert10 !== undefined) chkExp10.checked = cfg.expAlert10;
  if (chkExpEnd && cfg.expAlertEnd !== undefined) chkExpEnd.checked = cfg.expAlertEnd;
  if (chkDoping10 && cfg.dopingAlert10 !== undefined) chkDoping10.checked = cfg.dopingAlert10;
  if (chkDopingEnd && cfg.dopingAlertEnd !== undefined) chkDopingEnd.checked = cfg.dopingAlertEnd;

  // ROI 좌표
  if (window.screenCaptureManager) {
    if (cfg.runeRoi) {
      const roi = cfg.runeRoi;
      const isOldDefaultRoi = (
        (roi.x === 1.5 && roi.y === 1.5 && roi.w === 14 && roi.h === 14) ||
        (roi.x === 1 && roi.y === 1 && roi.w === 22 && roi.h === 22)
      );
      // 예전 기본 좌표만 실제 미니맵 위치로 이전한다.
      // 사용자가 직접 드래그해 저장한 좌표는 그대로 유지한다.
      window.screenCaptureManager.runeRoi = isOldDefaultRoi
        ? { x: 0.3, y: 8.3, w: 14.5, h: 13 }
        : roi;
    }
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

  const customSounds = {};
  ['rune', 'popup'].forEach(cat => {
    const selectEl = document.getElementById(`select-sound-${cat}`);
    if (selectEl) customSounds[cat] = selectEl.value;
  });

  const cfg = {
    volume: volRange ? parseInt(volRange.value, 10) : 80,
    soundPreset: soundSelect ? soundSelect.value : 'chime',
    ttsVoice: ttsToggle ? ttsToggle.checked : false,
    visualFlash: flashToggle ? flashToggle.checked : true,
    expPresetMinutes: activePresetBtn ? parseInt(activePresetBtn.getAttribute('data-minutes'), 10) : 30,
    expAlert10: document.getElementById('chk-exp-alert-10')?.checked ?? true,
    expAlertEnd: document.getElementById('chk-exp-alert-end')?.checked ?? true,
    dopingAlert10: document.getElementById('chk-doping-10s')?.checked ?? true,
    dopingAlertEnd: document.getElementById('chk-doping-end')?.checked ?? true,
    customSounds: customSounds,
    runeRoi: window.screenCaptureManager ? window.screenCaptureManager.runeRoi : { x: 0.3, y: 8.3, w: 14.5, h: 13 },
    popupRoi: window.screenCaptureManager ? window.screenCaptureManager.popupRoi : { x: 0, y: 0, w: 100, h: 100 }
  };

  window.storageManager.saveConfig(cfg);
}
