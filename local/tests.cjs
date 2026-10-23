'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {assetPath,MirrorCache,discover}=require('./mirror-cache.cjs'),{sanitizeHtml,createServer}=require('./server.cjs');
test('static dependency discovery preserves root asset paths and worker imports',()=>{
 const found=discover('"assets/dialog.js"; import "./worker.js"; "/models/demo/best.onnx"','/assets/main.js');
 assert.deepEqual(found,['/assets/dialog.js','/assets/worker.js','/models/demo/best.onnx']);
 const json=discover('{"files":{"onnx":"model.onnx"}}','/models/demo/policy.json');assert.deepEqual(json,['/models/demo/model.onnx']);
});
test('paths cannot escape cache or proxy API endpoints',()=>{
 for(const p of ['/api/detect','//evil.test/assets/x.js','/assets/../secret','/assets/%2e%2e/x','/assets/a%5cb','/assets/a%00','/assets/c:d'])assert.throws(()=>assetPath(p));
 assert.equal(assetPath('/models/test/model.onnx?v=123'),'/models/test/model.onnx');
});
test('HTML retains module entry and removes third party execution',()=>{
 const result=sanitizeHtml('<head><script src="https://tracker.test/x"></script><script>fetch("https://tracker.test")</script><script type="module" src="/assets/main.js"></script></head><body></body>');
 assert.ok(!result.includes('tracker.test'));assert.ok(result.includes('/assets/main.js'));assert.ok(result.includes('/legacy/index.html'));
});
test('cache combines requests, verifies hashes, and reports offline misses',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'maple-cache-test-'));let calls=0;
 try{
  const c=new MirrorCache(dir,{fetcher:async()=>{calls++;return new Response('export const ready=true',{headers:{'content-type':'text/javascript'}});}});await c.initialize();
  const [a,b]=await Promise.all([c.get('/assets/demo.js'),c.get('/assets/demo.js')]);assert.equal(calls,1);assert.deepEqual(a.bytes,b.bytes);await c.saveManifest();
  const offline=new MirrorCache(dir,{offline:true,fetcher:()=>{throw Error('network attempted');}});await offline.initialize();
  assert.equal((await offline.get('/assets/demo.js')).cached,true);await assert.rejects(offline.get('/assets/missing.js'),/offline cache miss/);
  await fs.writeFile(path.join(dir,'assets','demo.js'),'tampered');await assert.rejects(offline.get('/assets/demo.js'),/integrity mismatch/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('HTTP server blocks foreign hosts, mutations, traversal, APIs and repository metadata',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'maple-http-test-')),instance=await createServer({offline:true,cacheRoot:dir});
 await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));const port=instance.server.address().port;
 const request=(url,method='GET',host='127.0.0.1:8765')=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{host}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
 try{
  assert.equal((await request('/','GET','evil.test')).status,403);assert.equal((await request('/','POST')).status,405);
  assert.equal((await request('/assets/%2e%2e/secret')).status,400);assert.equal((await request('/legacy/.git/config')).status,404);assert.equal((await request('/api/detect')).status,403);
  const home=await request('/');assert.equal(home.status,200);assert.match(home.body,/정밀 감지/);
  const precise=await request('/precise');assert.equal(precise.status,200);assert.match(precise.headers['content-security-policy'],/connect-src 'self' blob:/);
  const legacy=await request('/legacy/index.html');assert.equal(legacy.status,200);assert.match(legacy.body,/룬·거탐/);
 }finally{await new Promise(r=>instance.server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

const {PopupBridge,wrapCapture}=require('./popup-bridge.js');
test('capture adapter returns the same stream, preserves cancellation and restores original',async()=>{
 const stream={},seen=[],original=async function(value){if(value==='cancel')throw Error('cancelled');return stream;},devices={getDisplayMedia:original};
 const restore=wrapCapture(devices,s=>seen.push(s));assert.equal(await devices.getDisplayMedia('ok'),stream);assert.deepEqual(seen,[stream]);
 await assert.rejects(devices.getDisplayMedia('cancel'),/cancelled/);assert.equal(seen.length,1);restore();assert.equal(devices.getDisplayMedia,original);
});
test('popup loop samples once per 300ms, resets on replacement, and never stops original tracks',async()=>{
 let samples=0,stops=0,reset=0,delay=null,callback=null;
 const track={addEventListener(){},stop(){stops++;}},stream={getVideoTracks:()=>[track]},video={srcObject:null,readyState:2,play:async()=>{},pause(){}};
 const canvas={getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array(4)})})};
 const bridge=new PopupBridge({video,canvas,analyzer:{reset(){reset++;},processPopupStructureFrame(){samples++;}},onStatus(){},schedule(fn,ms){callback=fn;delay=ms;return 1;},cancel(){}});
 bridge.attach(stream);await new Promise(r=>setImmediate(r));assert.equal(samples,1);assert.equal(delay,300);
 bridge.setEnabled(false);callback();assert.equal(samples,1);bridge.detach();callback();assert.equal(samples,1);assert.equal(stops,0);assert.ok(reset>=3);
});
