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

  // 2. 사냥 효율 계산기 (Mapleroad Style) 초기화
  initCalculatorUI();

  // 4. 설정 불러오기 및 적용
  const config = window.storageManager.loadConfig();
  applyConfigToUI(config);

  // 5. 타이머 콜백 바인딩
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
        pill.textContent = isLive ? '🟢 거탐 감시 중 (인식되지 않음)' : statusText;
        pill.className = isLive ? 'status-pill active' : 'status-pill';
      }
    }
  };

  window.imageAnalyzer.onJanusStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('janus-status-pill');
    if (pill) {
      if (isDetected) {
        pill.textContent = statusText;
        pill.className = 'status-pill detected';
      } else {
        pill.textContent = statusText || '⚪ 대기 중 (인식되지 않음)';
        pill.className = statusText?.includes('가동 중') ? 'status-pill active' : 'status-pill';
      }
    }
  };

  window.imageAnalyzer.onExpBuffStatusChange = (statusText, isDetected) => {
    const pill = document.getElementById('exp-status-pill');
    if (pill) {
      if (isDetected) {
        pill.textContent = statusText;
        pill.className = 'status-pill detected';
      } else {
        pill.textContent = statusText || '⚪ 대기 중 (인식되지 않음)';
        pill.className = statusText?.includes('가동 중') ? 'status-pill active' : 'status-pill';
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

  document.getElementById('btn-select-janus-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.openRoiModal('janus');
  });

  document.getElementById('btn-select-exp-roi')?.addEventListener('click', () => {
    window.screenCaptureManager.openRoiModal('exp');
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

  // 메인 소리 테스트 버튼 (상단/설정 탭)
  document.getElementById('btn-test-sound')?.addEventListener('click', () => {
    if (window.audioNotifier) {
      window.audioNotifier.initAudioContext();
      window.audioNotifier.notify('알림 테스트입니다', soundSelect ? soundSelect.value : 'chime');
    }
  });

  // 🔊 항목별 개별 사운드 선택 및 미리듣기 테스트 버튼 이벤트 바인딩
  ['rune', 'popup', 'janus', 'exp'].forEach(cat => {
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
  ['chk-exp-alert-10', 'chk-exp-alert-end', 'chk-janus-prealert', 'chk-janus-endalert', 'chk-doping-10s', 'chk-doping-end'].forEach(id => {
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
 * 도핑 버프 타이머 UI 업데이트
 */
/**
 * 사냥 효율 계산기 UI 바인딩 & 100% 동적 실시간 연산 (재획비 1.2배 곱연산 엔진)
 */
function initCalculatorUI() {
  const mapSelect = document.getElementById('calc-map-select');
  const levelInput = document.getElementById('calc-user-level');
  const killRatioInput = document.getElementById('calc-kill-ratio');
  const kills6minInput = document.getElementById('calc-6min-kills');
  const expBuffInput = document.getElementById('calc-exp-buff');
  const mesoRateInput = document.getElementById('calc-meso-rate');
  const dropRateInput = document.getElementById('calc-drop-rate');
  const useWealthChk = document.getElementById('chk-calc-use-wealth');

  if (!mapSelect || !window.huntingCalculator) return;

  let isManual6MinKills = false;

  // 1) 맵 목록 셀렉트 채우기 (Optgroup 지역별 그룹화로 UI 시독성 극대화)
  mapSelect.innerHTML = '';
  const regionGroups = {};

  window.huntingCalculator.mapDatabase.forEach((item, idx) => {
    if (!regionGroups[item.region]) {
      const group = document.createElement('optgroup');
      group.label = `📍 ${item.region} (Lv.${item.mobLevel}~`;
      regionGroups[item.region] = group;
      mapSelect.appendChild(group);
    }

    const opt = document.createElement('option');
    opt.value = idx;
    const max6m = Math.round(item.hourlyMax / 10);
    opt.textContent = `${item.name} (젠당 ${item.spawnPerWave}마리 | 6분 ${max6m.toLocaleString()}마리 | 1시간 ${item.hourlyMax.toLocaleString()}마리)`;
    if (item.name.includes('최하층 통로 2')) opt.selected = true;
    regionGroups[item.region].appendChild(opt);
  });

  const currentExpInput = document.getElementById('calc-current-exp');
  const targetLevelInput = document.getElementById('calc-target-level');
  const dailyHoursInput = document.getElementById('calc-daily-hours');

  const updateCalculations = () => {
    const userLevel = parseInt(levelInput.value, 10) || 280;
    const mapIndex = parseInt(mapSelect.value, 10) || 0;
    const killRatio = parseInt(killRatioInput.value, 10) || 100;
    const expBuffPct = parseFloat(expBuffInput.value) || 200;
    const mesoRatePct = parseFloat(mesoRateInput.value) || 0;
    const dropRatePct = parseFloat(dropRateInput.value) || 100;
    const useWealthPotion = useWealthChk ? useWealthChk.checked : true;

    const currentExpPct = parseFloat(currentExpInput?.value) || 0;
    const targetLevel = parseInt(targetLevelInput?.value, 10) || (userLevel + 1);
    const dailyPlayHours = parseFloat(dailyHoursInput?.value) || 2;

    const custom6min = isManual6MinKills ? (parseInt(kills6minInput.value, 10) || null) : null;

    document.getElementById('val-kill-ratio').textContent = `${killRatio}%`;

    const res = window.huntingCalculator.calculate({
      userLevel,
      mapIndex,
      userCustomKills6min: custom6min,
      killRatio,
      expBuffPct,
      mesoRatePct,
      dropRatePct,
      useWealthPotion,
      currentExpPct,
      targetLevel,
      dailyPlayHours
    });

    // --- 📸 맵 배너 이미지 및 상세 스펙 카드 업데이트 ---
    const selectedMap = res.mapInfo;
    const imgEl = document.getElementById('map-preview-img');
    const titleEl = document.getElementById('map-preview-title');
    const specEl = document.getElementById('map-preview-spec');

    if (imgEl && selectedMap.imgUrl) imgEl.src = selectedMap.imgUrl;
    if (titleEl) titleEl.textContent = `📍 [${selectedMap.region}] ${selectedMap.name}`;
    if (specEl) specEl.textContent = `몬스터 Lv.${selectedMap.mobLevel} | 젠당 ${selectedMap.spawnPerWave}마리 | 1시간 최대 ${selectedMap.hourlyMax.toLocaleString()}마리`;

    if (!isManual6MinKills) {
      kills6minInput.value = res.actual6MinKills;
    }

    // --- 🚀 Mapleroad 정밀 리포트 결과 렌더링 ---
    const goalMesoEok = (res.totalGoalMesoExpected / 100000000).toFixed(1);
    document.getElementById('res-goal-dday').textContent = `약 ${res.daysNeededForGoal} 일 (D-${res.daysNeededForGoal}) - 총 ${res.totalGoalHoursNeeded}시간`;
    document.getElementById('res-goal-rehoek-total').textContent = `약 ${res.totalGoalRehoekCount} 개 (${res.targetLevel}레벨 달성까지)`;
    document.getElementById('res-goal-meso-total').textContent = `약 ${goalMesoEok} 억 메소`;
    document.getElementById('res-goal-erda-total').textContent = `약 ${res.totalGoalErdaExpected.toLocaleString()} 개`;

    // --- 100% 동적 결과 카드 렌더링 ---
    // 1) 일일 메소 제한 & 필요 재획량
    document.getElementById('res-req-kills').textContent = `${res.requiredKillsForCap.toLocaleString()} 마리`;
    document.getElementById('res-req-rehoek').textContent = `약 ${res.requiredRehoekCount} 개`;
    document.getElementById('res-cap-time-needed').textContent = `약 ${res.timeToCapFormatted}`;

    // 2) 기본 상한 및 메획% 반영 상한선 (d) & 주머니 평균값 (a)
    const baseCapEok = (res.baseCapMeso / 100000000).toFixed(1);
    const totalCapEok = (res.totalCapMesoWithRate / 100000000).toFixed(3);

    document.getElementById('res-base-cap').textContent = `${baseCapEok} 억 메소`;
    document.getElementById('res-total-cap-meso').textContent = `약 ${totalCapEok} 억 메소 (최종메획 ${res.displayFinalMesoPct}%)`;
    document.getElementById('res-meso-per-bag').textContent = `약 ${res.actualMesoPerBag.toLocaleString()} 메소`;

    // 3) 시간별 획득 메소
    const thirtyMinMan = Math.round(res.thirtyMinMeso / 10000);
    const hourlyMesoMan = Math.round(res.hourlyMesoTotal / 10000);
    const hourlyMesoEok = (res.hourlyMesoTotal / 100000000).toFixed(2);
    const twoHrMesoEok = (res.twoHourMesoTotal / 100000000).toFixed(2);

    document.getElementById('res-30min-meso').textContent = `약 ${thirtyMinMan.toLocaleString()} 만 메소`;
    document.getElementById('res-hourly-meso').textContent = `약 ${hourlyMesoEok} 억 (${hourlyMesoMan.toLocaleString()} 만) 메소`;
    document.getElementById('res-2hr-meso').textContent = `약 ${twoHrMesoEok} 억 메소`;

    // 4) 마릿수 & 경험치/조각
    document.getElementById('res-hourly-kills').textContent = `${res.hourlyKills.toLocaleString()} 마리 / ${res.twoHourKills.toLocaleString()} 마리`;

    const expPctHourly = ((res.hourlyExpTotal / (userLevel * 250000000000)) * 100).toFixed(3);
    const expPct2Hr = (expPctHourly * 2).toFixed(3);
    document.getElementById('res-2hr-exp').textContent = `약 +${expPct2Hr}%`;
    document.getElementById('res-2hr-erda').textContent = `약 ${res.solErdaPieces2Hr} 개`;
  };

  // 이벤트 바인딩
  mapSelect.addEventListener('change', () => { isManual6MinKills = false; updateCalculations(); });
  killRatioInput.addEventListener('input', () => { isManual6MinKills = false; updateCalculations(); });
  kills6minInput.addEventListener('input', () => { isManual6MinKills = true; updateCalculations(); });

  levelInput.addEventListener('input', updateCalculations);
  expBuffInput.addEventListener('input', updateCalculations);
  mesoRateInput.addEventListener('input', updateCalculations);
  dropRateInput.addEventListener('input', updateCalculations);
  if (currentExpInput) currentExpInput.addEventListener('input', updateCalculations);
  if (targetLevelInput) targetLevelInput.addEventListener('input', updateCalculations);
  if (dailyHoursInput) dailyHoursInput.addEventListener('input', updateCalculations);
  if (useWealthChk) useWealthChk.addEventListener('change', updateCalculations);

  updateCalculations();
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
    ['rune', 'popup', 'janus', 'exp'].forEach(cat => {
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

  // 야누스 주기
  const janusRadio = document.querySelector(`input[name="janus-cycle"][value="${cfg.janusCycle}"]`);
  if (janusRadio) janusRadio.checked = true;
  window.timerModule.setJanusCycle(cfg.janusCycle);

  // 타이머 세부 체크박스 반영
  const chkExp10 = document.getElementById('chk-exp-alert-10');
  const chkExpEnd = document.getElementById('chk-exp-alert-end');
  const chkJanusPre = document.getElementById('chk-janus-prealert');
  const chkJanusEnd = document.getElementById('chk-janus-endalert');
  const chkDoping10 = document.getElementById('chk-doping-10s');
  const chkDopingEnd = document.getElementById('chk-doping-end');

  if (chkExp10 && cfg.expAlert10 !== undefined) chkExp10.checked = cfg.expAlert10;
  if (chkExpEnd && cfg.expAlertEnd !== undefined) chkExpEnd.checked = cfg.expAlertEnd;
  if (chkJanusPre && cfg.janusPreAlert !== undefined) chkJanusPre.checked = cfg.janusPreAlert;
  if (chkJanusEnd && cfg.janusEndAlert !== undefined) chkJanusEnd.checked = cfg.janusEndAlert;
  if (chkDoping10 && cfg.dopingAlert10 !== undefined) chkDoping10.checked = cfg.dopingAlert10;
  if (chkDopingEnd && cfg.dopingAlertEnd !== undefined) chkDopingEnd.checked = cfg.dopingAlertEnd;

  // ROI 좌표
  if (window.screenCaptureManager) {
    if (cfg.runeRoi) window.screenCaptureManager.runeRoi = cfg.runeRoi;
    if (cfg.popupRoi) window.screenCaptureManager.popupRoi = cfg.popupRoi;
    if (cfg.janusRoi) window.screenCaptureManager.janusRoi = cfg.janusRoi;
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

  const customSounds = {};
  ['rune', 'popup', 'janus', 'exp'].forEach(cat => {
    const selectEl = document.getElementById(`select-sound-${cat}`);
    if (selectEl) customSounds[cat] = selectEl.value;
  });

  const cfg = {
    volume: volRange ? parseInt(volRange.value, 10) : 80,
    soundPreset: soundSelect ? soundSelect.value : 'chime',
    ttsVoice: ttsToggle ? ttsToggle.checked : false,
    visualFlash: flashToggle ? flashToggle.checked : true,
    expPresetMinutes: activePresetBtn ? parseInt(activePresetBtn.getAttribute('data-minutes'), 10) : 30,
    janusCycle: janusRadio ? parseInt(janusRadio.value, 10) : 80,
    expAlert10: document.getElementById('chk-exp-alert-10')?.checked ?? true,
    expAlertEnd: document.getElementById('chk-exp-alert-end')?.checked ?? true,
    janusPreAlert: document.getElementById('chk-janus-prealert')?.checked ?? true,
    janusEndAlert: document.getElementById('chk-janus-endalert')?.checked ?? true,
    dopingAlert10: document.getElementById('chk-doping-10s')?.checked ?? true,
    dopingAlertEnd: document.getElementById('chk-doping-end')?.checked ?? true,
    customSounds: customSounds,
    runeRoi: window.screenCaptureManager ? window.screenCaptureManager.runeRoi : { x: 1, y: 1, w: 22, h: 22 },
    popupRoi: window.screenCaptureManager ? window.screenCaptureManager.popupRoi : { x: 0, y: 0, w: 100, h: 100 },
    janusRoi: window.screenCaptureManager ? window.screenCaptureManager.janusRoi : { x: 55, y: 1.5, w: 44, h: 22 }
  };

  window.storageManager.saveConfig(cfg);
}
