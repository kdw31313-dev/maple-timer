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
      // 감지 영역 기본 비율 (%)
      runeRoi: { x: 35, y: 20, w: 30, h: 40 }, // 화면 중앙 부근
      popupRoi: { x: 25, y: 25, w: 50, h: 50 } // 화면 넓은 범위
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

  resetConfig() {
    localStorage.removeItem(this.STORAGE_KEY);
    return { ...this.defaultConfig };
  }
}

window.storageManager = new StorageManager();
