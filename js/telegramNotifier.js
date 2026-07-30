/**
 * TelegramNotifier - 메이플 사냥 타이머 텔레그램 봇 알림 연동 모듈
 */
class TelegramNotifier {
  constructor() {
    this.storageKey = 'maple_timer_telegram_config';

    // 비밀키는 소스에 넣지 않고 사용자의 브라우저에만 저장한다.
    const defaultConfig = {
      enabled: true,
      botToken: '',
      chatId: '',
      threadId: ''
    };

    this.config = this.loadConfig(defaultConfig);
    this.lastSentTimeMap = new Map(); // 동일 메시지 도배 방지 쿨다운 (3초)
  }

  loadConfig(defaultConfig) {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return { ...defaultConfig, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Telegram config load error:', e);
    }
    return defaultConfig;
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Telegram config save error:', e);
    }
  }

  /**
   * 텔레그램 메세지 전송
   * @param {string} text - 전송할 메세지 내용 (간결한 문구)
   * @param {boolean} force - 쿨다운 무시 여부 (테스트 버튼 등)
   */
  async send(text, force = false) {
    if (!this.config.enabled && !force) return;
    if (!this.config.botToken || !this.config.chatId) return;

    const now = Date.now();
    const lastSent = this.lastSentTimeMap.get(text) || 0;
    if (!force && now - lastSent < 3000) {
      // 3초 내 중복 메시지는 전송 억제
      return;
    }
    this.lastSentTimeMap.set(text, now);

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    const payload = {
      chat_id: this.config.chatId,
      text: text
    };

    if (this.config.threadId && this.config.threadId.trim() !== '') {
      payload.message_thread_id = parseInt(this.config.threadId.trim(), 10);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      if (!resData.ok) {
        console.warn('Telegram send failed:', resData);
      } else {
        console.log('📱 Telegram alert sent successfully:', text);
      }
    } catch (err) {
      console.error('Telegram notification network error:', err);
    }
  }

  /**
   * 탐지 순간의 화면을 사진으로 전송한다.
   * 화면 캡처가 불가능하면 기존 문자 알림으로 자동 대체한다.
   */
  async sendAlert(text, category = 'chime', force = false) {
    if (!this.config.enabled && !force) return;
    if (!this.config.botToken || !this.config.chatId) return;

    const now = Date.now();
    const lastSent = this.lastSentTimeMap.get(text) || 0;
    if (!force && now - lastSent < 3000) return;
    this.lastSentTimeMap.set(text, now);

    try {
      const captureManager = window.screenCaptureManager;
      const photoBlob = await captureManager?.captureAlertScreenshot?.(category, text);
      if (!photoBlob) {
        this.lastSentTimeMap.delete(text);
        await this.send(text, force);
        return;
      }

      const formData = new FormData();
      formData.append('chat_id', this.config.chatId);
      formData.append('caption', text.slice(0, 1024));
      formData.append('photo', photoBlob, `메이플-탐지-${Date.now()}.jpg`);

      if (this.config.threadId && this.config.threadId.trim() !== '') {
        formData.append('message_thread_id', String(parseInt(this.config.threadId.trim(), 10)));
      }

      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendPhoto`,
        { method: 'POST', body: formData }
      );
      const resData = await response.json();
      if (!resData.ok) {
        console.warn('Telegram photo send failed:', resData);
        this.lastSentTimeMap.delete(text);
        await this.send(text, force);
      } else {
        console.log('Telegram alert photo sent successfully:', text);
      }
    } catch (err) {
      console.error('Telegram photo notification error:', err);
      this.lastSentTimeMap.delete(text);
      await this.send(text, force);
    }
  }

  /**
   * 야누스 학습용 원본 ROI 사진을 최대 10장씩 앨범으로 전송한다.
   */
  async sendJanusLearningAlbum(samples) {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) return false;
    if (!Array.isArray(samples) || samples.length === 0) return true;

    const album = samples.slice(0, 10);
    const formData = new FormData();
    formData.append('chat_id', this.config.chatId);
    if (this.config.threadId && this.config.threadId.trim() !== '') {
      formData.append('message_thread_id', String(parseInt(this.config.threadId.trim(), 10)));
    }

    // Telegram 앨범은 최소 2장이 필요하므로 마지막 1장은 일반 사진으로 보낸다.
    if (album.length === 1) {
      const sample = album[0];
      formData.append('caption', sample.caption.slice(0, 1024));
      formData.append('photo', sample.blob, `야누스-학습-${sample.id}.jpg`);
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${this.config.botToken}/sendPhoto`,
          { method: 'POST', body: formData }
        );
        const result = await response.json();
        if (!result.ok) console.warn('Telegram Janus learning photo failed:', result);
        return Boolean(result.ok);
      } catch (error) {
        console.error('Telegram Janus learning photo network error:', error);
        return false;
      }
    }

    const media = album.map((sample, index) => {
      const fieldName = `photo${index}`;
      formData.append(fieldName, sample.blob, `야누스-학습-${sample.id}.jpg`);
      return {
        type: 'photo',
        media: `attach://${fieldName}`,
        caption: sample.caption.slice(0, 1024)
      };
    });
    formData.append('media', JSON.stringify(media));

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMediaGroup`,
        { method: 'POST', body: formData }
      );
      const result = await response.json();
      if (!result.ok) {
        console.warn('Telegram Janus learning album failed:', result);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Telegram Janus learning album network error:', error);
      return false;
    }
  }

  async sendVideo(videoBlob, caption) {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) return false;
    if (!videoBlob || videoBlob.size === 0) return false;

    const makeFormData = (fieldName) => {
      const formData = new FormData();
      formData.append('chat_id', this.config.chatId);
      formData.append('caption', String(caption || '').slice(0, 1024));
      formData.append(fieldName, videoBlob, `메이플-버프-${Date.now()}.webm`);
      if (fieldName === 'video') formData.append('supports_streaming', 'true');
      if (this.config.threadId && this.config.threadId.trim() !== '') {
        formData.append('message_thread_id', String(parseInt(this.config.threadId.trim(), 10)));
      }
      return formData;
    };

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendVideo`,
        { method: 'POST', body: makeFormData('video') }
      );
      const result = await response.json();
      if (result.ok) return true;

      // Chrome의 MediaRecorder는 WebM을 생성한다. Telegram이 동영상으로
      // 받지 않는 환경에서는 같은 파일을 문서로 다시 보내 수집물이 유실되지 않게 한다.
      console.warn('Telegram buff video failed; retrying as document:', result);
      const fallbackResponse = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendDocument`,
        { method: 'POST', body: makeFormData('document') }
      );
      const fallbackResult = await fallbackResponse.json();
      if (!fallbackResult.ok) console.warn('Telegram buff document failed:', fallbackResult);
      return Boolean(fallbackResult.ok);
    } catch (error) {
      console.error('Telegram buff video network error:', error);
      return false;
    }
  }

  /**
   * 테스트 메세지 보내기
   */
  async sendTestMessage() {
    await this.send('[메이플 타이머] 🔔 텔레그램 알림 연동 테스트 성공!', true);
  }
}

window.telegramNotifier = new TelegramNotifier();
