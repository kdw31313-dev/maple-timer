/** Browser-side Telegram Bot API client. Credentials stay in this browser. */
class TelegramNotifier {
  constructor() {
    this.storageKey = 'maple_timer_telegram_config';
    const defaults = { enabled: true, botToken: '', chatId: '', threadId: '' };
    try { this.config = { ...defaults, ...JSON.parse(localStorage.getItem(this.storageKey)) }; }
    catch { this.config = defaults; }
    this.sent = new Map();
    this.pending = new Set();
  }

  saveConfig(settings) {
    this.config = { ...this.config, ...settings };
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.config)); return true; }
    catch { return false; }
  }

  getTarget() {
    const botToken = String(this.config.botToken ?? '').trim();
    const chatId = String(this.config.chatId ?? '').trim();
    const threadId = String(this.config.threadId ?? '').trim();
    if (!botToken || !chatId) throw Error('봇 토큰과 Chat ID를 입력하세요.');
    if (!/^\d+:[\w-]+$/.test(botToken)) throw Error('봇 토큰 형식을 확인하세요.');
    if (threadId && (!/^[1-9]\d*$/.test(threadId) || !Number.isSafeInteger(Number(threadId)))) {
      throw Error('Topic ID는 양의 정수만 입력하세요. 일반 채팅이면 비워두세요.');
    }
    return { botToken, chatId, threadId };
  }

  async request(method, target, body) {
    body.set('chat_id', target.chatId);
    if (target.threadId) body.set('message_thread_id', target.threadId);
    let response;
    try {
      response = await fetch('https://api.telegram.org/bot' + target.botToken + '/' + method, {
        method: 'POST', body, credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(method === 'sendMessage' ? 15000 : 45000)
      });
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      return { ok: false, uncertain: true, message: timeout ? '전송 시간 초과. 채팅에 도착했는지 먼저 확인하세요.' : 'Telegram 연결 실패. 네트워크 또는 브라우저 차단 설정을 확인하세요.' };
    }
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) return { ok: true, message: '텔레그램 전송 성공' };
    const code = data?.error_code ?? response.status;
    const description = String(data?.description ?? '').toLowerCase();
    let message;
    if (code === 401 || code === 404) message = '봇 토큰이 올바르지 않거나 만료되었습니다.';
    else if (data?.parameters?.migrate_to_chat_id != null) message = '그룹이 변경되었습니다. 새 Chat ID: ' + data.parameters.migrate_to_chat_id;
    else if (code === 403) message = '봇이 차단되었거나 채팅에 보낼 권한이 없습니다. 개인 채팅에서는 봇을 열어 시작을 누르세요.';
    else if (code === 429) message = '전송이 너무 잦습니다. 잠시 뒤 다시 시도하세요.';
    else if (/thread|topic/.test(description)) message = 'Topic ID가 잘못되었거나 토픽이 닫혀 있습니다.';
    else if (/chat not found|chat_id/.test(description)) message = 'Chat ID를 확인하고 봇을 채팅에 추가하세요.';
    else message = 'Telegram이 전송을 거부했습니다 (HTTP ' + code + ').';
    return { ok: false, message, uncertain: !data || code >= 500 };
  }

  async deliver(text, force, action) {
    if (!this.config.enabled && !force) return { ok: false, skipped: true };
    let target;
    try { target = this.getTarget(); }
    catch (error) { return this.report({ ok: false, message: error.message }); }
    const key = target.chatId + ':' + target.threadId + ':' + text;
    const now = Date.now();
    for (const [entry, at] of this.sent) if (now - at >= 3000) this.sent.delete(entry);
    if (this.pending.has(key) || (!force && this.sent.has(key))) return { ok: false, skipped: true };
    this.pending.add(key);
    try {
      const result = await action(target);
      if (result.ok) this.sent.set(key, Date.now());
      return this.report(result);
    } finally { this.pending.delete(key); }
  }

  report(result) {
    this.onStatus?.(result);
    return result;
  }

  sendText(target, text) {
    return this.request('sendMessage', target, new URLSearchParams({ text: String(text) }));
  }

  send(text, force = false) {
    return this.deliver(text, force, target => this.sendText(target, text));
  }

  sendAlert(text, category = 'chime', force = false) {
    return this.deliver(text, force, async target => {
      let photo;
      try { photo = await window.screenCaptureManager?.captureAlertScreenshot?.(category, text); }
      catch { /* Capture failure still permits the text alert. */ }
      if (!photo) return this.sendText(target, text);
      const form = new FormData();
      form.set('caption', String(text).slice(0, 1024));
      form.set('photo', photo, 'maple-alert.jpg');
      const result = await this.request('sendPhoto', target, form);
      return result.ok || result.uncertain ? result : this.sendText(target, text);
    });
  }

  async sendVideo(videoBlob, caption) {
    if (!videoBlob?.size) return false;
    const result = await this.deliver(String(caption), false, async target => {
      const send = field => {
        const form = new FormData();
        form.set('caption', String(caption || '').slice(0, 1024));
        form.set(field, videoBlob, 'maple-alert.webm');
        if (field === 'video') form.set('supports_streaming', 'true');
        return this.request(field === 'video' ? 'sendVideo' : 'sendDocument', target, form);
      };
      const first = await send('video');
      return first.ok || first.uncertain ? first : send('document');
    });
    return result.ok;
  }

  sendTestMessage() {
    return this.send('[메이플 타이머] 🔔 텔레그램 알림 테스트입니다.', true);
  }
}

window.telegramNotifier = new TelegramNotifier();
