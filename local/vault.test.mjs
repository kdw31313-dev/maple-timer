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
  getTarget() { if (!this.config.botToken || !this.config.chatId) throw Error('Not connected'); },
  async sendTestMessage() { sent++; this.onStatus({ok:true, message:'Test sent'}); return {ok:true}; },
};
globalThis.location = { hash: '', pathname: '/maple-timer/', search: '' };
globalThis.history = { replaceState() { cleared = true; location.hash = ''; } };
globalThis.document = { getElementById(id) { return elements.get(id); } };
globalThis.window = { telegramNotifier: notifier, addEventListener(name, fn) { browserEvents[name] = fn; } };
globalThis.fetch = async () => ({ok:true, json:async () => vault});

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
  assert.match(status.textContent, /연결 완료/);
  await test.events.click();
  assert.equal(sent, 1);
  assert.equal(status.textContent, 'Test sent');
}
console.log('Private link bootstrap, hash navigation and settings-free UI verified with a simulated send.');
