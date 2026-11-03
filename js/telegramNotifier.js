const TELEGRAM_ALERT_TEMPLATES = {
  rune: { title: '◆ 룬 발견', action: '미니맵에서 룬 위치를 확인하세요.' },
  popup: { title: '🚨 거짓말 탐지기', action: '게임 화면의 안내를 바로 확인하세요.' },
  buff: { title: '⏳ 버프 종료 임박', action: '남은 시간과 재사용 가능 여부를 확인하세요.' },
  exp: { title: '📉 경험치 정체', action: '사냥이 멈췄는지 게임 화면을 확인하세요.' },
  test: { title: '🔔 알림 전송 테스트', action: '이 메시지를 받았다면 텔레그램 연결이 정상입니다.' },
};

function formatTelegramAlert(text, category, now = new Date()) {
  const template = Object.hasOwn(TELEGRAM_ALERT_TEMPLATES, category)
    ? TELEGRAM_ALERT_TEMPLATES[category] : { title: '🔔 감지 알림' };
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium', hour12: false,
  }).format(now);
  const detail = String(text).replace(/^(?:📍|🚨)\s*\[메이플\]\s*/, '').trim();
  const lines = ['[메이플 사냥 도우미] ' + template.title, detail];
  if (template.action) lines.push(template.action);
  lines.push('발생 시각 ' + time + ' (한국 시간)');
  return lines.join('\n');
}

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
    else if (code >= 500) message = 'Telegram 연결 경로에 오류가 발생했습니다 (HTTP ' + code + '). 채팅에서 수신 여부를 확인하세요.';
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
    const message = formatTelegramAlert(text, category);
    // Deduplicate by the original event text so the timestamp does not affect it.
    return this.deliver(text, force, target => this.sendText(target, message));
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
    return this.send(formatTelegramAlert('실제 감지 알림과 같은 형식의 테스트입니다.', 'test'), true);
  }
}

window.telegramNotifier = new TelegramNotifier();
