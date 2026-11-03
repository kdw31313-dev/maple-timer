// Only the encrypted vault is published. The key arrives in a private URL fragment.
export async function unlockTelegram(notifier) {
  const hash = new URLSearchParams(location.hash.slice(1));
  const encoded = hash.get('telegram-key');
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded ?? '')) throw Error('Invalid private link');

  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
  const response = await fetch(new URL('./telegram-vault.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw Error('Connection profile not found');
  const vault = await response.json();
  if (vault.version !== 1) throw Error('Unsupported connection profile');

  const key = await crypto.subtle.importKey('raw', decode(encoded), 'AES-GCM', false, ['decrypt']);
  const bytes = await crypto.subtle.decrypt({ name:'AES-GCM', iv:decode(vault.iv) }, key, decode(vault.ciphertext));
  const config = JSON.parse(new TextDecoder().decode(bytes));
  if (!/^\d+:[\w-]+$/.test(config.botToken) || !/^-\d+$/.test(config.chatId) ||
      (config.threadId && !/^[1-9]\d*$/.test(config.threadId))) {
    throw Error('Invalid connection profile');
  }

  const saved = notifier.saveConfig({
    botToken: config.botToken,
    chatId: config.chatId,
    threadId: config.threadId || '',
    enabled: notifier.config?.botToken ? notifier.config.enabled : true,
  });
  history.replaceState(null, '', location.pathname + location.search);
  return saved;
}
