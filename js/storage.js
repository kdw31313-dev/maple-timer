/**
 * StorageManager - 브라우저 LocalStorage 설정 저장 및 복원 모듈
 */
class StorageManager {
  constructor() {
    this.STORAGE_KEY = 'maple_hunter_timer_config_v1';
    this.defaultConfig = {
      volume: 80,
      soundPreset: 'chime',
      ttsVoice: true,
      visualFlash: true,
      expPresetMinutes: 30,
      expAlert60: true,
      expAlert30: true,
      expAlertEnd: true,
      janusCycle: 80,
      janusPreAlert: true,
      janusEndAlert: true,
      runeDetectionEnabled: true,
      popupDetectionEnabled: true,
      janusAutoDetectionEnabled: true,
      // 항목별 커스텀 효과음
      customSounds: {
        rune: 'rune',
        popup: 'siren',
        janus: 'beep',
        exp: 'chime'
      },
      // 감지 영역 기본 비율 (%)
      runeRoi: { x: 0.3, y: 8.3, w: 14.5, h: 13 }, // 실제 미니맵 내부 전체(제목줄 제외)
      popupRoi: { x: 0, y: 0, w: 100, h: 100 }, // 메이플 전체 사냥 화면 범위 (거탐 무작위 위치 포착)
      janusRoi: { x: 55, y: 0, w: 44, h: 24 }   // 최상단부터 여러 줄의 우측 버프 영역
    };
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return { ...this.defaultConfig };
      const parsed = JSON.parse(raw);
      return { ...this.defaultConfig, ...parsed };
    } catch (e) {
      console.warn('설정 불러오기 실패, 기본값 사용:', e);
      return { ...this.defaultConfig };
    }
  }

  saveConfig(config) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('설정 저장 실패:', e);
    }
  }

  exportConfig() {
    const config = this.loadConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maple_timer_settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importConfig(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const merged = { ...this.defaultConfig, ...parsed };
      this.saveConfig(merged);
      return merged;
    } catch (e) {
      console.error('설정 복원 실패:', e);
      return null;
    }
  }

  resetConfig() {
    localStorage.removeItem(this.STORAGE_KEY);
    return { ...this.defaultConfig };
  }
}

window.storageManager = new StorageManager();
