const TELEGRAM_ALERT_TEMPLATES = {
  rune: { title: '💎 룬 발견', icon: '📍', action: '미니맵에서 룬 위치를 확인하세요.' },
  popup: { title: '🚨 거짓말 탐지기', icon: '🖥️', action: '게임 화면의 안내를 바로 확인하세요.' },
  buff: { title: '⏳ 버프 종료 임박', icon: '✨', action: '남은 시간과 재사용 가능 여부를 확인하세요.' },
  exp: { title: '📉 경험치 정체', icon: '📊', action: '사냥이 멈췄는지 게임 화면을 확인하세요.' },
  test: { title: '🔔 알림 전송 테스트', icon: '📬', action: '이 메시지가 도착했다면 텔레그램 연결이 정상입니다.' },
};

function formatTelegramAlert(text, category, now = new Date()) {
  const template = Object.hasOwn(TELEGRAM_ALERT_TEMPLATES, category)
    ? TELEGRAM_ALERT_TEMPLATES[category] : { title: '🔔 감지 알림', icon: '📌' };
  const time = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium', hour12: false,
  }).format(now);
  const detail = String(text).replace(/^(?:📍|🚨)\s*\[메이플\]\s*/, '').trim();
  const lines = [template.title, '────────────'];
  if (detail) lines.push(template.icon + ' ' + detail);
  if (template.action) lines.push('👉 ' + template.action);
  lines.push('', '🍁 메이플 사냥 도우미', '🕒 발생 시각 ' + time + ' (한국 시간)');
  return lines.join('\n');
}

function telegramMessageUrl(message) {
  const chatId = /^-100(\d+)$/.exec(String(message?.chat?.id ?? ''))?.[1];
  const messageId = message?.message_id;
  if (!chatId || !Number.isSafeInteger(messageId) || messageId < 1) return undefined;
  const threadId = message.message_thread_id;
  const topic = message.is_topic_message && Number.isSafeInteger(threadId) && threadId > 0
    ? threadId + '/' : '';
  return 'https://t.me/c/' + chatId + '/' + topic + messageId;
}

/** Send alerts through the configured relay or directly to Telegram. */
class TelegramNotifier {
  constructor() {
    this.storageKey = 'maple_timer_telegram_config';
    const defaults = { enabled: true, botToken: '', chatId: '', threadId: '', relayUrl: '', relayKey: '' };
    this.defaults = defaults;
    try { this.storedConfig = localStorage.getItem(this.storageKey); this.config = { ...defaults, ...JSON.parse(this.storedConfig) }; }
    catch { this.config = defaults; }
    this.sent = new Map();
    this.pending = new Set();
  }

  saveConfig(settings) {
    this.syncSavedConfig();
    this.config = { ...this.config, ...settings };
    try { const raw = JSON.stringify(this.config); localStorage.setItem(this.storageKey, raw); this.storedConfig = raw; return true; }
    catch { return false; }
  }

  syncSavedConfig() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw === this.storedConfig) return false;
      const saved = JSON.parse(raw);
      if (saved !== null && (typeof saved !== 'object' || Array.isArray(saved))) return false;
      this.config = { ...this.defaults, ...saved };
      this.storedConfig = raw;
      return true;
    } catch { return false; }
  }

  getTarget(config = this.config) {
    const relayUrl = String(config.relayUrl ?? '').trim();
    const relayKey = String(config.relayKey ?? '').trim();
    if (relayUrl || relayKey) {
      let url;
      try { url = new URL(relayUrl); } catch { /* The profile needs a valid endpoint. */ }
      if (url?.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
          url.pathname !== '/telegram' || !/^[A-Za-z0-9_-]{43}$/.test(relayKey)) {
        throw Error('개인 링크의 텔레그램 중계 설정을 확인하세요.');
      }
      return { relayUrl: url.href, relayKey };
    }

    const botToken = String(config.botToken ?? '').trim();
    const chatId = String(config.chatId ?? '').trim();
    const threadId = String(config.threadId ?? '').trim();
    if (!botToken || !chatId) throw Error('봇 토큰과 Chat ID를 입력하세요.');
    if (!/^\d+:[\w-]+$/.test(botToken)) throw Error('봇 토큰 형식을 확인하세요.');
    if (threadId && (!/^[1-9]\d*$/.test(threadId) || !Number.isSafeInteger(Number(threadId)))) {
      throw Error('Topic ID는 양의 정수만 입력하세요. 일반 채팅이면 비워두세요.');
    }
    return { botToken, chatId, threadId };
  }

  async request(method, target, body) {
    const sending = Boolean(body);
    const relay = Boolean(target.relayUrl);
    let url, options;
    if (relay) {
      if (sending && method !== 'sendMessage') {
        return { ok: false, message: '텔레그램 중계는 텍스트 메시지를 지원합니다.' };
      }
      url = new URL(target.relayUrl);
      options = {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + target.relayKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, text: body?.get('text') }),
      };
    } else {
      url = new URL('https://api.telegram.org/bot' + target.botToken + '/' + method);
      if (sending) {
        body.set('chat_id', target.chatId);
        if (target.threadId) body.set('message_thread_id', target.threadId);
      } else if (method === 'getChat') {
        url.searchParams.set('chat_id', target.chatId);
      }
      options = { method: sending ? 'POST' : 'GET', body };
    }

    let response;
    try {
      response = await fetch(url.href, {
        ...options, credentials: 'omit', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(relay ? 18000 : (!sending || method === 'sendMessage' ? 15000 : 45000))
      });
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      let message;
      if (relay) message = timeout ? '중계 서버 응답 시간 초과.' : '중계 서버에 연결하지 못했습니다.';
      else if (timeout) message = sending ? '전송 시간 초과. 채팅에 도착했는지 먼저 확인하세요.' : 'Telegram API 응답 시간 초과.';
      else message = 'Telegram 연결 실패. 네트워크 또는 브라우저 차단 설정을 확인하세요.';
      return { ok: false, uncertain: sending, message };
    }
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) {
      return sending
        ? { ok: true, message: '텔레그램 전송 성공', messageUrl: telegramMessageUrl(data.result) }
        : { ok: true, data: data.result };
    }
    if (relay && data?.relay_error) {
      const errors = {
        unauthorized: '중계 인증 실패. 개인 실행 링크를 다시 열어주세요.',
        configuration: '중계 서버의 텔레그램 설정을 확인하세요.',
        bad_request: '중계 서버가 요청 형식을 받지 못했습니다.',
        telegram_timeout: '중계 서버에서 Telegram API 응답 시간이 초과됐습니다.',
        telegram_network: '중계 서버에서 Telegram API에 연결하지 못했습니다.',
        telegram_response: '중계 서버가 Telegram API에서 예상과 다른 응답을 받았습니다.',
      };
      return {
        ok: false,
        message: Object.hasOwn(errors, data.relay_error) ? errors[data.relay_error] : '중계 서버 오류가 발생했습니다.',
        uncertain: sending && ['telegram_timeout', 'telegram_network', 'telegram_response'].includes(data.relay_error),
      };
    }
    const code = data?.error_code ?? response.status;
    const description = String(data?.description ?? '').toLowerCase();
    let message;
    if (relay && (code === 401 || code === 404)) message = '이 브라우저에 예전 중계 서버 설정이 남아 있습니다. 최신 개인 실행 링크로 연결을 갱신하세요.';
    else if ((code === 401 || code === 404) && data?.ok === false) message = 'Telegram 봇 인증 실패. 이 브라우저의 연결 설정을 최신 개인 실행 링크로 갱신하세요.';
    else if (!data) message = '전송 경로에서 Telegram 응답이 아닌 HTTP ' + code + ' 응답을 받았습니다. 네트워크 경로를 확인하세요.';
    else if (data?.parameters?.migrate_to_chat_id != null) message = '그룹이 변경되었습니다. 새 Chat ID: ' + data.parameters.migrate_to_chat_id;
    else if (code === 403) message = '봇이 차단되었거나 채팅에 보낼 권한이 없습니다. 개인 채팅에서는 봇을 열어 시작을 누르세요.';
    else if (code >= 500) {
      message = 'Telegram 연결 경로에 오류가 발생했습니다 (HTTP ' + code + ').';
      if (sending) message += ' 채팅에서 수신 여부를 확인하세요.';
    }
    else if (code === 429) message = '전송이 너무 잦습니다. 잠시 뒤 다시 시도하세요.';
    else if (/thread|topic/.test(description)) message = 'Topic ID가 잘못되었거나 토픽이 닫혀 있습니다.';
    else if (/chat not found|chat_id/.test(description)) message = 'Chat ID를 확인하고 봇을 채팅에 추가하세요.';
    else message = 'Telegram이 전송을 거부했습니다 (HTTP ' + code + ').';
    return { ok: false, message, uncertain: sending && (!data || code >= 500) };
  }

  async deliver(text, force, action) {
    this.syncSavedConfig();
    if (!this.config.enabled && !force) return this.report({ ok: false, skipped: true, reason: 'disabled', message: '자동 텔레그램 알림이 꺼져 있습니다. 자동 알림 모두 켜기를 눌러주세요.' });
    let target;
    try { target = this.getTarget(); }
    catch (error) { return this.report({ ok: false, message: error.message }); }
    const destination = target.relayUrl || (target.chatId + ':' + target.threadId);
    const key = destination + ':' + text;
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
    const detail = '실제 감지 알림과 같은 형식의 테스트입니다.';
    return this.deliver(detail, true, async target => {
      const bot = await this.request('getMe', target);
      if (!bot.ok) return { ...bot, message: '봇 인증 확인 실패 · ' + bot.message };
      const chat = await this.request('getChat', target);
      if (!chat.ok) return { ...chat, message: '채팅 확인 실패 · ' + chat.message };
      const chatType = chat.data?.type;
      if (target.threadId && chatType && chatType !== 'private' && !chat.data.is_forum) {
        return { ok: false, message: '채팅은 연결됐지만 토픽이 없는 채팅입니다. 개인 링크의 Topic ID를 확인하세요.' };
      }
      const result = await this.sendText(target, formatTelegramAlert(detail, 'test'));
      if (result.ok) return result;
      return { ...result, message: '테스트 메시지 전송 확인 실패 · ' + result.message };
    });
  }
}

window.telegramNotifier = new TelegramNotifier();
