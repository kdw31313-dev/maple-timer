/** Settings UI shared by both Pages modes. */
function bindTelegramSettings() {
  const find = id => document.getElementById(id);
  const notifier = window.telegramNotifier;
  const token = find('telegram-bot-token'), chat = find('telegram-chat-id'), topic = find('telegram-thread-id');
  const toggle = find('toggle-telegram-alert'), status = find('telegram-status-pill'), test = find('btn-telegram-test');
  if (!notifier || !status || !token || !chat || !topic || !toggle) return;
  const show = (text, ok = false) => {
    status.textContent = text;
    status.className = 'status-pill' + (ok ? ' active' : '');
  };
  notifier.onStatus = result => show(result.message, result.ok);
  token.value = notifier.config.botToken || '';
  chat.value = notifier.config.chatId || '';
  topic.value = notifier.config.threadId || '';
  toggle.checked = Boolean(notifier.config.enabled);
  const refresh = () => {
    if (!toggle.checked) return show('알림 끔');
    try { notifier.getTarget(); show('설정됨 · 테스트로 확인', true); }
    catch (e) { show(e.message); }
  };
  refresh();
  const save = () => {
    const stored = notifier.saveConfig({ enabled: toggle.checked, botToken: token.value.trim(), chatId: chat.value.trim(), threadId: topic.value.trim() });
    if (!stored) show('이 브라우저에 설정을 저장하지 못했습니다.');
    else refresh();
    return stored;
  };
  find('btn-telegram-save')?.addEventListener('click', save);
  toggle.addEventListener('change', save);
  test?.addEventListener('click', async () => {
    save();
    test.disabled = true;
    show('테스트 전송 중…');
    try {
      const result = await notifier.sendTestMessage();
      if (result.skipped) show('같은 메시지를 전송 중입니다.');
    } catch { show('전송 중 오류가 발생했습니다.'); }
    finally { test.disabled = false; }
  });
}
