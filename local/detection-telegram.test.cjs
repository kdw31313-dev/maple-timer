const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const main=read('js/monitors/main.js');
const slice=(start,end)=>main.slice(main.indexOf(start),main.indexOf(end));
function harness() {
  let saved=JSON.stringify({enabled:true,botToken:'111:old_token',chatId:'-100123',threadId:'27'});
  const requests=[],results=[],sounds=[];
  const config={items:{rune:{enabled:true,telegram:true,mode:'combined'},popup:{enabled:true,telegram:true}}};
  const window={audioNotifier:{notify(){},presentAlert(){}},screenCaptureManager:{isStreaming:true}};
  const c=vm.createContext({window,config,URL,URLSearchParams,FormData,AbortSignal,Date,Map,Set,
    localStorage:{getItem:()=>saved,setItem:(_,v)=>{saved=v;}},
    fetch:async(url,options)=>{requests.push({url,body:options.body}); const ok=url.includes('222:new_token');return {ok,status:ok?200:401,json:async()=>ok?{ok:true,result:{chat:{id:-100123},message_id:99}}:{ok:false,error_code:401}};},
    gate:{accept:()=>true,reset(){}},lastRune:0,lastLegacyRune:0,
    LABELS:{rune:'룬',popup:'거탐'},play:(_,key)=>sounds.push(key),setStatus(){},setTimeout(){},
    popupRecording:{record(){}},captureManager:{isStreaming:true},
  });
  vm.runInContext(read('js/telegramNotifier.js'),c);
  window.telegramNotifier.onStatus=r=>results.push(r);
  vm.runInContext(read('js/imageAnalyzer.js'),c);
  vm.runInContext(slice('function notify(', 'function stable('),c);
  vm.runInContext(slice('const originalNotify =','const originalStop ='),c);
  return {window,requests,results,sounds,update(value){saved=JSON.stringify(value);}};
}
test('real rune and popup alert functions use refreshed credentials, not the stale hunting-tab token',async()=>{
  const h=harness();
  h.update({enabled:true,botToken:'222:new_token',chatId:'-100123',threadId:'27'});
  h.window.imageAnalyzer.triggerRuneAlert(42);
  h.window.imageAnalyzer.triggerPopupStructureAlert('비올레타');
  await new Promise(setImmediate);
  assert.deepEqual(h.sounds,['rune','popup']);
  assert.equal(h.requests.length,2);
  for(const r of h.requests){assert.match(r.url,/bot222:new_token\/sendMessage$/);assert.equal(r.body.get('chat_id'),'-100123');}
  assert.match(h.requests[0].body.get('text'),/룬 발견/);
  assert.match(h.requests[1].body.get('text'),/거짓말 탐지기/);
  assert.equal(h.results.filter(r=>r.ok).length,2);
  h.window.imageAnalyzer.triggerPopupStructureAlert('비올레타',{telegram:false,repeat:true});
  await new Promise(setImmediate);
  assert.equal(h.requests.length,2,'repeat sound must not send duplicate messages');
});
test('an old tab changing the enabled toggle cannot overwrite newly saved bot credentials',()=>{
  const h=harness();
  h.update({enabled:true,botToken:'222:new_token',chatId:'-100123',threadId:'27'});
  h.window.telegramNotifier.saveConfig({enabled:false});
  assert.equal(h.window.telegramNotifier.config.botToken,'222:new_token');
  assert.equal(h.window.telegramNotifier.config.enabled,false);
});
