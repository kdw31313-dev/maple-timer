import { unlockTelegram } from './monitors/telegram-vault.js?v=20261103-link';

/** Connect and test the private Telegram destination. */
async function bindTelegramSettings() {
  const notifier = window.telegramNotifier;
  const toggle = document.getElementById('toggle-telegram-alert');
  const status = document.getElementById('telegram-status-pill');
  const test = document.getElementById('btn-telegram-test');
  const messageLink = document.getElementById('telegram-message-link');
  if (!notifier || !toggle || !status || !test) return;

  const show = (message, ok = false, messageUrl) => {
    if (messageLink) {
      if (messageUrl) messageLink.href = messageUrl;
      else messageLink.removeAttribute('href');
      messageLink.hidden = !messageUrl;
    }
    status.textContent = message;
    status.className = 'status-pill' + (ok ? ' active' : '');
  };

  const refresh = (message, ok) => {
    let connected = true;
    try { notifier.getTarget(); }
    catch { connected = false; }
    toggle.checked = connected && Boolean(notifier.config.enabled);
    toggle.disabled = test.disabled = !connected;
    show(message ?? (connected
      ? (toggle.checked ? '설정 저장됨 · 테스트로 수신 확인' : '자동 알림 꺼짐')
      : '개인 실행 링크를 열면 알림 설정을 불러옵니다.'), ok);
  };

  notifier.onStatus = result => show(result.message, result.ok, result.messageUrl);
  toggle.addEventListener('change', () => {
    if (notifier.saveConfig({ enabled: toggle.checked })) refresh();
    else refresh('이 브라우저에 알림 설정을 저장하지 못했습니다.', false);
  });
  test.addEventListener('click', async () => {
    test.disabled = true;
    show('봇과 채팅 확인 중…');
    try {
      const result = await notifier.sendTestMessage();
      if (result.skipped) show('같은 메시지를 전송 중입니다.');
    } catch {
      show('테스트 메시지 전송 중 오류가 발생했습니다.');
    } finally {
      test.disabled = false;
    }
  });

  let connecting = false;
  async function connectFromLink() {
    if (connecting || !new URLSearchParams(location.hash.slice(1)).has('telegram-key')) return;
    connecting = true;
    toggle.disabled = test.disabled = true;
    show('개인 링크로 연결 중…');
    try {
      const saved = await unlockTelegram(notifier);
      refresh(saved ? '개인 링크 설정 완료 · 테스트로 수신 확인' : '임시 설정 완료 · 브라우저를 닫으면 다시 연결해야 합니다.');
    } catch {
      refresh('개인 링크를 연결하지 못했습니다. 원본 개인 실행 링크로 다시 열어주세요.', false);
    } finally {
      connecting = false;
    }
  }

  refresh();
  window.addEventListener('hashchange', connectFromLink);
  await connectFromLink();
}

await bindTelegramSettings();
