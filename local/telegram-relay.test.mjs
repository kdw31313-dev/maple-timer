import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import relay from '../relay/worker.mjs';

const site = 'https://kdw31313-dev.github.io';
const relayUrl = 'https://maple-test.workers.dev/telegram';
const relayKey = 'R'.repeat(43);
const env = {
  MAPLE_RELAY_KEY: relayKey,
  TELEGRAM_BOT_TOKEN: '123:fixture_token',
  TELEGRAM_CHAT_ID: '-1002468',
  TELEGRAM_THREAD_ID: '27',
};

function browserRequest(body, headers = {}) {
  return new Request(relayUrl, {
    method: 'POST',
    headers: {Origin:site, Authorization:'Bearer '+relayKey, 'Content-Type':'application/json', ...headers},
    body: JSON.stringify(body),
  });
}

test('relay requires the private key and origin and allows only text and diagnostics', async () => {
  for (const [request, status] of [
    [browserRequest({method:'sendMessage',text:'test'},{Authorization:'Bearer wrong'}),401],
    [browserRequest({method:'sendMessage',text:'test'},{Origin:'https://unrelated.example'}),404],
    [browserRequest({method:'sendPhoto'}),400],
    [browserRequest({method:'sendMessage',text:' '.repeat(40)}),400],
  ]) {
    assert.equal((await relay.fetch(request, env)).status, status);
  }
  const preflight = await relay.fetch(new Request(relayUrl,{method:'OPTIONS',headers:{Origin:site}}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),site);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
});

test('browser test and all detector alerts use the relay and receive the Telegram receipt', async t => {
  const calls = [];
  const messages = [];
  const alerts = [
    ['rune','모의 룬 감지','💎 룬 발견'],
    ['popup','모의 거탐 감지','🚨 거짓말 탐지기'],
    ['buff','경험치 쿠폰 종료까지 10초','⏳ 버프 종료 임박'],
    ['exp','경험치가 10초 동안 오르지 않았어요.','📉 경험치 정체'],
  ];
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.telegram.org');
    assert.equal(options.redirect, 'manual');
    assert.ok(url.pathname.startsWith('/bot'+env.TELEGRAM_BOT_TOKEN+'/'));
    const method = url.pathname.split('/').at(-1);
    calls.push(method);
    if (method === 'getMe') return Response.json({ok:true,result:{id:123}});
    if (method === 'getChat') {
      assert.equal(options.method,'GET');
      assert.equal(url.searchParams.get('chat_id'),env.TELEGRAM_CHAT_ID);
      assert.equal(url.searchParams.has('message_thread_id'),false);
      return Response.json({ok:true,result:{type:'supergroup',is_forum:true}});
    }
    assert.equal(options.method,'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id,env.TELEGRAM_CHAT_ID);
    assert.equal(body.message_thread_id,env.TELEGRAM_THREAD_ID);
    messages.push(body.text);
    return Response.json({ok:true,result:{
      chat:{id:-1002468},message_id:42,is_topic_message:true,message_thread_id:27,
    }});
  });

  const window = {};
  runInNewContext(readFileSync(new URL('../js/telegramNotifier.js', import.meta.url),'utf8'),{
    window, URL, URLSearchParams, AbortSignal,
    localStorage:{getItem:()=>JSON.stringify({relayUrl,relayKey})},
    fetch: async (address, options) => {
      assert.equal(address,relayUrl);
      assert.equal(options.headers.Authorization,'Bearer '+relayKey);
      assert.doesNotMatch(options.body,/chat_id|thread_id|fixture_token/);
      return relay.fetch(new Request(address,{...options,headers:{...options.headers,Origin:site}}),env);
    },
  });
  const testResult = await window.telegramNotifier.sendTestMessage();
  assert.equal(testResult.messageUrl,'https://t.me/c/2468/27/42');
  assert.match(messages[0],/^🔔 알림 전송 테스트/);
  for (const [category,detail,title] of alerts) {
    const result = await window.telegramNotifier.sendAlert(detail,category);
    assert.equal(result.messageUrl,testResult.messageUrl);
    assert.equal(messages.at(-1).split('\n')[0],title);
    assert.ok(messages.at(-1).includes(detail));
    assert.match(messages.at(-1),/🕒 발생 시각/);
  }
  assert.deepEqual(calls,['getMe','getChat',...Array(5).fill('sendMessage')]);
});

test('relay controls the destination and marks upstream timeouts as uncertain', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id,env.TELEGRAM_CHAT_ID);
    assert.equal(body.message_thread_id,env.TELEGRAM_THREAD_ID);
    throw new DOMException('timeout','TimeoutError');
  });
  const response = await relay.fetch(browserRequest({
    method:'sendMessage',text:'test',chat_id:'-1000000',message_thread_id:'1',
  }),env);
  assert.equal(response.status,504);
  assert.equal((await response.json()).relay_error,'telegram_timeout');
});
