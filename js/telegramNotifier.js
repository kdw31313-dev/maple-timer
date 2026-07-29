/**
 * TelegramNotifier - 메이플 사냥 타이머 텔레그램 봇 알림 연동 모듈
 */
class TelegramNotifier {
  constructor() {
    this.storageKey = 'maple_timer_telegram_config';

    // 기본 설정값 (유저 제공 토큰, Chat ID, Thread ID 연동)
    const defaultConfig = {
      enabled: true,
      botToken: '8817805999:AAHTRnudXPArrW7TGtTxuABSJydlchGu6nc',
      chatId: '-1004469995076',
      threadId: '627'
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
   * 테스트 메세지 보내기
   */
  async sendTestMessage() {
    await this.send('[메이플 타이머] 🔔 텔레그램 알림 연동 테스트 성공!', true);
  }
}

window.telegramNotifier = new TelegramNotifier();
