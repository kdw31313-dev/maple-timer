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
test('a rejected photo falls back to text; a successful notification is deduplicated',async()=>{
  const methods=[];
  const x=client(async url=>{methods.push(url.split('/').pop());return methods.length===1?response(400,{ok:false,error_code:400}):response(200,{ok:true});});
  x.window.screenCaptureManager={captureAlertScreenshot:async()=>new Blob(['x'],{type:'image/jpeg'})};
  assert.equal((await x.client.sendAlert('rune')).ok,true);
  assert.equal((await x.client.sendAlert('rune')).skipped,true);
  assert.deepEqual(methods,['sendPhoto','sendMessage']);
});
