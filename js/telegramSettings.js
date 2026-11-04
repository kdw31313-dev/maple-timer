import { unlockTelegram } from './monitors/telegram-vault.js?v=20261103-relay';

/** Connect and test the private Telegram destination. */
async function bindTelegramSettings() {
  const notifier = window.telegramNotifier;
  const toggle = document.getElementById('toggle-telegram-alert');
  const status = document.getElementById('telegram-status-pill');
  const test = document.getElementById('btn-telegram-test');
  const enableAll = document.getElementById('btn-telegram-enable-all');
  const detectorTest = document.getElementById('btn-telegram-detectors-test');
  const autoSummary = document.getElementById('telegram-auto-summary');
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
    refreshAutomatic();
  };

  function refreshAutomatic() {
    const monitors = window.mapleNativeMonitors;
    let connected = true;
    try { notifier.getTarget(); } catch { connected = false; }
    if (enableAll) enableAll.disabled = !connected || !monitors;
    if (detectorTest && !detectorTest.dataset.running) detectorTest.disabled = !connected || !monitors;
    if (!autoSummary) return;
    const names = { rune: '룬', popup: '거탐', buff: '버프', exp: '경험치' };
    autoSummary.textContent = !connected ? '이 기기의 연결 설정이 필요합니다.'
      : !notifier.config.enabled ? '자동 전송 꺼짐 · 연결 테스트만 전송됩니다.'
      : '자동 전송 설정 · ' + Object.entries(monitors?.config.items || {}).map(([key,item]) =>
          names[key] + (item.telegram ? ' 켜짐' : ' 꺼짐')).join(' / ');
  }
  enableAll?.addEventListener('click', () => {
    notifier.saveConfig({ enabled: true });
    window.mapleNativeMonitors?.enableTelegramAlerts();
    refresh('네 항목의 자동 전송을 켰습니다. 감시 중인 항목이 감지되면 보냅니다.');
    refreshAutomatic();
  });
  detectorTest?.addEventListener('click', async () => {
    detectorTest.dataset.running = 'true';
    detectorTest.disabled = true;
    show('실제 자동 전송 설정으로 모의 감지 4종 확인 중…');
    try {
      const results = await window.mapleNativeMonitors.testTelegramAlerts();
      const failed = results.filter(result => !result.ok);
      show(failed.length ? failed.map(result => result.message || '전송하지 못했습니다.').join(' / ')
        : '모의 감지 4종 전송 성공 · 실제 게임 화면 감지 테스트는 아닙니다.', !failed.length);
    } catch { show('모의 감지 테스트 중 오류가 발생했습니다.'); }
    finally { delete detectorTest.dataset.running; refreshAutomatic(); }
  });
  window.addEventListener('maple-monitors-ready', refreshAutomatic);
  document.getElementById('monitor-toolbox')?.addEventListener('change', refreshAutomatic);
  toggle.addEventListener('change', () => queueMicrotask(refreshAutomatic));
  refreshAutomatic();

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
