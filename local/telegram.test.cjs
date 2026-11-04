const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname,'../js/telegramNotifier.js'),'utf8');
const target = { botToken:'123:fake_token', chatId:'-100123', threadId:'27', enabled:true };
function client(fetch, config=target) {
  const window = {};
  vm.runInNewContext(src, {window, localStorage:{getItem:()=>JSON.stringify(config)}, fetch, URL, URLSearchParams, FormData, AbortSignal});
  return {client:window.telegramNotifier,window};
}
const response = (status, body) => ({ok:status<400,status,json:async()=>body});
test('missing credentials are reported without contacting Telegram', async()=>{
  const x=client(()=>assert.fail('request without credentials'),{});
  const result=await x.client.sendTestMessage();assert.equal(result.ok,false);assert.match(result.message,/봇 토큰과 Chat ID/);
});
test('a successful test validates the bot and chat, then links to the sent message', async () => {
  const calls = [];
  const x = client(async (url, options) => {
    const endpoint = new URL(url);
    const method = endpoint.pathname.split('/').at(-1);
    calls.push(method);
    if (method === 'getMe') {
      assert.equal(options.method, 'GET');
      assert.equal(endpoint.search, '');
      return response(200, {ok:true, result:{id:123}});
    }
    if (method === 'getChat') {
      assert.equal(options.method, 'GET');
      assert.equal(endpoint.searchParams.get('chat_id'), '-100123');
      assert.equal(endpoint.searchParams.has('message_thread_id'), false);
      return response(200, {ok:true, result:{type:'supergroup', is_forum:true}});
    }
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('chat_id'), '-100123');
    assert.equal(options.body.get('message_thread_id'), '27');
    assert.equal(options.headers, undefined);
    assert.match(options.body.get('text'), /알림 전송 테스트/);
    return response(200, {ok:true, result:{
      chat:{id:-100123}, message_id:98, is_topic_message:true, message_thread_id:27
    }});
  });
  const result = await x.client.sendTestMessage();
  assert.equal(result.ok, true);
  assert.equal(result.messageUrl, 'https://t.me/c/123/27/98');
  assert.deepEqual(calls, ['getMe', 'getChat', 'sendMessage']);
});

test('the test stops at bot authentication if Telegram returns an error', async () => {
  for (const code of [401, 502]) {
    let calls = 0;
    const x = client(async (url) => {
      assert.match(url, /\/getMe$/);
      calls++;
      return response(code, {ok:false, error_code:code});
    });
    const result = await x.client.sendTestMessage();
    assert.match(result.message, /봇 인증 확인 실패/);
    assert.match(result.message, code === 401 ? /봇 인증 실패/ : /HTTP 502/);
    assert.equal(result.uncertain, false);
    assert.equal(calls, 1);
  }
});

test('a configured topic is rejected on a non-forum chat before sending', async () => {
  const x = client(async (url) => {
    const method = new URL(url).pathname.split('/').at(-1);
    if (method === 'getMe') return response(200, {ok:true});
    assert.equal(method, 'getChat');
    return response(200, {ok:true, result:{type:'supergroup'}});
  });
  const result = await x.client.sendTestMessage();
  assert.equal(result.ok, false);
  assert.match(result.message, /토픽이 없는 채팅/);
});

test('an invalid topic is reported at the message stage', async () => {
  const x = client(async (url) => {
    if (!url.endsWith('/sendMessage')) return response(200, {ok:true});
    return response(400, {ok:false, error_code:400, description:'Bad Request: message thread not found'});
  });
  const result = await x.client.sendTestMessage();
  assert.match(result.message, /테스트 메시지 전송 확인 실패.*Topic ID/);
});

test('duplicate detector events send one message', async () => {
  let requests = 0;
  const x = client(async () => {
    requests++;
    return response(200, {ok:true});
  });
  const detail = '미니맵에서 룬이 감지됐어요.';
  assert.equal((await x.client.sendAlert(detail, 'rune')).ok, true);
  assert.equal((await x.client.sendAlert(detail, 'rune')).skipped, true);
  assert.equal(requests, 1);
});

test('a gateway error reports uncertain delivery without retrying', async () => {
  let requests = 0;
  const x = client(async () => {
    requests++;
    return response(502, null);
  });
  const result = await x.client.sendAlert('룬이 감지됐어요.', 'rune');
  assert.equal(result.ok, false);
  assert.equal(result.uncertain, true);
  assert.match(result.message, /HTTP 502/);
  assert.equal(requests, 1);
});

test('all detection categories send only text and preserve detector details', async () => {
  const messages = [];
  const x = client(async (url, options) => {
    assert.match(url, /\/sendMessage$/);
    assert.equal(options.body.has('photo'), false);
    messages.push(options.body.get('text'));
    return response(200, {ok:true});
  });
  let screenshots = 0;
  x.window.screenCaptureManager = {captureAlertScreenshot: () => { screenshots++; }};
  const cases = [
    ['rune', '룬 발견', '미니맵에서 룬이 감지됐어요.'],
    ['popup', '거짓말 탐지기', '비올레타가 감지되었습니다.'],
    ['buff', '버프 종료 임박', '경험치 쿠폰 종료까지 17초'],
    ['exp', '경험치 정체', '경험치가 10초 동안 오르지 않았어요.'],
  ];
  for (const [category, title, detail] of cases) {
    await x.client.sendAlert(detail, category);
    const message = messages.at(-1);
    const [heading, divider, detailLine, actionLine, gap, brand] = message.split('\n');
    assert.ok(heading.endsWith(title));
    assert.equal(divider, '────────────');
    assert.ok(detailLine.endsWith(detail));
    assert.match(actionLine, /^👉 /);
    assert.equal(gap, '');
    assert.equal(brand, '🍁 메이플 사냥 도우미');
    assert.match(message, /🕒 발생 시각 .+/);
    assert.ok(message.endsWith('(한국 시간)'));
  }
  assert.equal(screenshots, 0);
  assert.equal(messages.length, cases.length);
});

test('automatic delivery reports disabled while connection tests still work', async () => {
  let requests = 0;
  const x = client(async () => { requests++; return response(200, {ok:true, result:{type:'supergroup',is_forum:true}}); }, {...target, enabled:false});
  let reported;
  x.client.onStatus = result => { reported=result; };
  const result = await x.client.sendAlert('룬 감지', 'rune');
  assert.equal(result.skipped,true);
  assert.equal(result.reason,'disabled');
  assert.equal(reported,result);
  assert.equal(requests,0);
  assert.equal((await x.client.sendTestMessage()).ok,true);
  assert.equal(requests,3);
});
