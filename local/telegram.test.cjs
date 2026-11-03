const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname,'../js/telegramNotifier.js'),'utf8');
const target = { botToken:'123:fake_token', chatId:'-100123', threadId:'27', enabled:true };
function client(fetch, config=target) {
  const window = {};
  vm.runInNewContext(src, {window, localStorage:{getItem:()=>JSON.stringify(config)}, fetch, URLSearchParams, FormData, AbortSignal});
  return {client:window.telegramNotifier,window};
}
const response = (status, body) => ({ok:status<400,status,json:async()=>body});
test('missing credentials are reported without contacting Telegram', async()=>{
  const x=client(()=>assert.fail('request without credentials'),{});
  const result=await x.client.sendTestMessage();assert.equal(result.ok,false);assert.match(result.message,/봇 토큰과 Chat ID/);
});
test('text requests use browser-safe form encoding and preserve topic id',async()=>{
  const x=client(async(url, options)=>{
    assert.match(url,/\/sendMessage$/);assert.equal(options.body.get('chat_id'),'-100123');
    assert.equal(options.body.get('message_thread_id'),'27');assert.equal(options.headers,undefined);
    assert.match(options.body.get('text'), /알림 전송 테스트/);
    return response(200,{ok:true});
  });
  assert.equal((await x.client.sendTestMessage()).ok,true);
});
test('Telegram authorization and invalid topic failures are visible',async()=>{
  let calls=0;
  const x=client(async()=>{calls++;return calls===1?response(401,{ok:false,error_code:401}):response(400,{ok:false,error_code:400,description:'Bad Request: message thread not found'});});
  assert.match((await x.client.sendTestMessage()).message,/만료/);
  assert.match((await x.client.sendTestMessage()).message,/Topic ID/);
});
test('a rejected photo falls back to the same template and the event is deduplicated', async () => {
  const requests = [];
  const x = client(async (url, options) => {
    const method = url.split('/').pop();
    requests.push({method, message: options.body.get(method === 'sendPhoto' ? 'caption' : 'text')});
    return requests.length === 1 ? response(400,{ok:false,error_code:400}) : response(200,{ok:true});
  });
  x.window.screenCaptureManager = {captureAlertScreenshot: async () => new Blob(['x'], {type:'image/jpeg'})};
  const detail = '미니맵에서 룬이 감지됐어요.';
  assert.equal((await x.client.sendAlert(detail, 'rune')).ok, true);
  assert.equal((await x.client.sendAlert(detail, 'rune')).skipped, true);
  assert.deepEqual(requests.map(request => request.method), ['sendPhoto','sendMessage']);
  assert.equal(requests[0].message, requests[1].message);
  assert.match(requests[0].message, /룬 발견/);
});

test('Telegram alerts use category titles and preserve detector details', async () => {
  const messages = [];
  const x = client(async (_, options) => {
    messages.push(options.body.get('text'));
    return response(200, {ok:true});
  });
  const cases = [
    ['rune', '룬 발견', '미니맵에서 룬이 감지됐어요.'],
    ['popup', '거짓말 탐지기', '비올레타가 감지되었습니다.'],
    ['buff', '버프 종료 임박', '경험치 쿠폰 종료까지 17초'],
    ['exp', '경험치 정체', '경험치가 10초 동안 오르지 않았어요.'],
  ];
  for (const [category, title, detail] of cases) {
    await x.client.sendAlert(detail, category);
    const message = messages.at(-1);
    assert.ok(message.split('\n')[0].endsWith(title));
    assert.ok(message.includes(detail));
    assert.match(message, /발생 시각 .+/);
    assert.ok(message.endsWith('(한국 시간)'));
  }
});
