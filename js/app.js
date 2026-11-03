/**
 * App.js - 메인 애플리케이션 진입점 및 이벤트 바인딩
 */
document.addEventListener('DOMContentLoaded', () => {
  // 4. 설정 불러오기 및 적용
  const config = window.storageManager.loadConfig();
  applyConfigToUI(config);

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

  bindTelegramSettings();

  document.getElementById('toggle-tts-voice')?.addEventListener('change', e => {
    window.audioNotifier.setTTS(e.target.checked);
    saveCurrentConfig();
  });
  document.getElementById('toggle-visual-flash')?.addEventListener('change', e => {
    window.audioNotifier.setFlash(e.target.checked);
    saveCurrentConfig();
  });
  // PIP 버튼
  document.getElementById('btn-pip-toggle')?.addEventListener('click', () => {
    window.pipController.togglePip();
  });

  // 설정 초기화 버튼
  document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    if (confirm('공통 알림과 감시 설정을 초기화할까요?')) {
      window.storageManager.resetConfig();
      window.mapleNativeMonitors?.resetSettings();
      location.reload();
    }
  });

}

function applyConfigToUI(cfg) {
  const ttsToggle = document.getElementById('toggle-tts-voice');
  const flashToggle = document.getElementById('toggle-visual-flash');
  if (ttsToggle) ttsToggle.checked = cfg.ttsVoice;
  if (flashToggle) flashToggle.checked = cfg.visualFlash;
  window.audioNotifier.setVolume(cfg.volume);
  window.audioNotifier.setTTS(cfg.ttsVoice);
  window.audioNotifier.setFlash(cfg.visualFlash);
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
  window.storageManager.saveConfig({
    ...window.storageManager.loadConfig(),
    ttsVoice: document.getElementById('toggle-tts-voice').checked,
    visualFlash: document.getElementById('toggle-visual-flash').checked,
    runeRoi: window.screenCaptureManager.runeRoi,
  });
}
