import assert from 'node:assert/strict';
import fs from 'node:fs';

const privatePath = process.env.MAPLE_PRIVATE_LINK;
const vault = JSON.parse(fs.readFileSync(new URL('../js/monitors/telegram-vault.json', import.meta.url), 'utf8'));
const elements = new Map(['toggle-telegram-alert', 'telegram-status-pill', 'btn-telegram-test']
  .map(id => [id, { disabled: true, events: {}, addEventListener(name, fn) { this.events[name] = fn; } }]));
const browserEvents = {};
let sent = 0;
let cleared = false;
const notifier = {
  config: {},
  saveConfig(update) { this.config = { ...this.config, ...update }; return true; },
  getTarget(config = this.config) {
    if (!config.relayUrl && (!config.botToken || !config.chatId)) throw Error('Not connected');
    return config;
  },
  async sendTestMessage() { sent++; this.onStatus({ok:true, message:'Test sent'}); return {ok:true}; },
};
globalThis.location = { hash: '', pathname: '/maple-timer/', search: '' };
globalThis.history = { replaceState() { cleared = true; location.hash = ''; } };
globalThis.document = { getElementById(id) { return elements.get(id); } };
globalThis.window = { telegramNotifier: notifier, addEventListener(name, fn) { browserEvents[name] = fn; } };
let activeVault = vault;
globalThis.fetch = async () => ({ok:true, json:async () => activeVault});

await import('../js/telegramSettings.js');
const status = elements.get('telegram-status-pill');
const test = elements.get('btn-telegram-test');
assert.equal(test.disabled, true);
assert.equal(sent, 0);
location.hash = '#telegram-key=' + 'A'.repeat(43);
await browserEvents.hashchange();
assert.equal(test.disabled, true);
assert.match(status.textContent, /연결하지 못했습니다/);
if (privatePath) {
  const privateLink = new URL(fs.readFileSync(privatePath, 'utf8').split(/\r?\n/)[0]);
  location.hash = privateLink.hash;
  await browserEvents.hashchange();
  assert.equal(cleared, true);
  assert.equal(test.disabled, false);
  assert.match(status.textContent, /설정 완료/);
  await test.events.click();
  assert.equal(sent, 1);
  assert.equal(status.textContent, 'Test sent');
}
const profile = {relayUrl:'https://maple-test.workers.dev/telegram', relayKey:'R'.repeat(43)};
const rawKey = crypto.getRandomValues(new Uint8Array(32));
const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const data = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(profile)));
const base64url = value => Buffer.from(value).toString('base64url');
activeVault = {version:1,iv:base64url(iv),ciphertext:base64url(data)};
notifier.config = {botToken:'123:fixture',chatId:'-100123',threadId:'27',enabled:false};
location.hash = '#telegram-key=' + base64url(rawKey);
await browserEvents.hashchange();
assert.equal(location.hash, '');
assert.equal(notifier.config.relayUrl, profile.relayUrl);
assert.equal(notifier.config.relayKey, profile.relayKey);
assert.equal(notifier.config.botToken, '');
assert.equal(notifier.config.chatId, '');
assert.equal(notifier.config.threadId, '');
assert.equal(notifier.config.enabled, false);
assert.equal(test.disabled, false);
console.log('Private link bootstraps direct and relay profiles and preserves the user toggle.');
