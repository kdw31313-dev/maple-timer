'use strict';
const {chromium}=require('C:/Users/sch/AppData/Local/Programs/Python/Python312/Lib/site-packages/playwright/driver/package');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.MAPLE_BROWSER_ROOT||path.resolve(__dirname,'..');
const videos=process.argv.slice(2);
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  const file=name.startsWith('/test-video-')?videos[Number(name.match(/test-video-(\d+)/)[1])]:path.join(root,name==='/'?'index.html':name);
  if(!file||(!name.startsWith('/test-video-')&&!path.resolve(file).startsWith(root+path.sep))||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const size=fs.statSync(file).size;
  const type=file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.mp4')?'video/mp4':'application/octet-stream';
  if(req.headers.range){const [a,b]=req.headers.range.replace('bytes=','').split('-');const start=Number(a),end=b?Number(b):size-1;res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res);}
  else{res.writeHead(200,{'Content-Type':type,'Content-Length':size});fs.createReadStream(file).pipe(res);}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 console.error('검증 서버 준비',server.address().port);
 const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 console.error('브라우저 준비');
 try {
  for(let i=0;i<videos.length;i++){
   const page=await browser.newPage();const errors=[],sent=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.route('https://api.telegram.org/**',async route=>{sent.push({url:route.request().url().split('/').at(-1),bytes:route.request().postDataBuffer()?.length});await route.fulfill({json:{ok:true,result:{message_id:1}}});});
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   console.error('사이트 로드',i);
   await page.evaluate(()=>{
    window.testAlerts=[];window.testSounds=0;window.testCosts=[];window.testLongTasks=[];
    new PerformanceObserver(list=>testLongTasks.push(...list.getEntries().map(x=>x.duration))).observe({entryTypes:['longtask']});
    setInterval(()=>{if(imageAnalyzer.janusLastAnalysisMs!==undefined)testCosts.push(imageAnalyzer.janusLastAnalysisMs);},150);
    const original=audioNotifier.notify.bind(audioNotifier);
    audioNotifier.notify=(m,c,o)=>{if(c==='janus')testAlerts.push({time:screenCaptureManager.videoEl.currentTime,message:m});return original(m,c,o);};
    const sound=audioNotifier.playSoundPreset.bind(audioNotifier);
    audioNotifier.playSoundPreset=(...args)=>{testSounds++;return sound(...args);};
    audioNotifier.useTTS=false;audioNotifier.initAudioContext();
    telegramNotifier.config={enabled:true,botToken:'test-token',chatId:'test-chat'};
    document.getElementById('toggle-rune-detection').checked=false;
    document.getElementById('toggle-popup-detection').checked=false;
   });
   if(process.env.JANUS_DISABLED==='1')await page.evaluate(()=>document.getElementById('toggle-janus-detection').checked=false);
   if(process.env.ALL_DETECTORS==='1')await page.evaluate(()=>{document.getElementById('toggle-rune-detection').checked=true;document.getElementById('toggle-popup-detection').checked=true;});
   if(process.env.START_AT)await page.evaluate(t=>window.testStartAt=Number(t),process.env.START_AT);
   await page.evaluate(async i=>{
    const manager=screenCaptureManager,v=manager.videoEl;v.src=`/test-video-${i}.mp4`;v.muted=true;
    if(window.testStartAt)v.currentTime=window.testStartAt;
    await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('영상 재생 시작 지연: '+v.readyState+' / '+v.error?.message)),15000))]);
    if(v.videoWidth!==1920||v.videoHeight!==1080) throw new Error('테스트 영상 디코딩 실패');
    v.classList.remove('hidden');manager.isStreaming=true;manager.startLoop();
   },i);
   console.log(JSON.stringify({video:i,status:'playing'}));
   if(process.env.PROFILE_SECONDS)await page.waitForTimeout(Number(process.env.PROFILE_SECONDS)*1000);
   else await page.waitForFunction(()=>screenCaptureManager.videoEl.ended,null,{timeout:240000});
   await page.waitForTimeout(1800);
   const result=await page.evaluate(()=>{testCosts.sort((a,b)=>a-b);return {alerts:testAlerts,sounds:testSounds,audio:audioNotifier.audioCtx?.state,status:document.getElementById('janus-status-pill').textContent,costs:{p50:testCosts[Math.floor(testCosts.length*.5)],p95:testCosts[Math.floor(testCosts.length*.95)],max:Math.max(...testCosts)},longTasks:testLongTasks};});
   console.log(JSON.stringify({video:i,...result,telegram:sent,errors}));
   if(process.env.PROFILE_SECONDS){assert.equal(errors.length,0);await page.close();continue;}
   assert.equal(errors.length,0);assert.equal(result.alerts.length,1,'실시간 소멸 알림 1회');
   const disappearance=[39.5,86.1,66,161][i];
   assert.ok(result.alerts[0].time>=disappearance+0.8&&result.alerts[0].time<disappearance+2.5,'소멸 전 조기 알림/지연 없음');
   assert.equal(sent.length,1);assert.equal(result.sounds,1);assert.equal(result.audio,'running');
   await page.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
