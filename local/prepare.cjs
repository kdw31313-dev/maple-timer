'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {MirrorCache,discover}=require('./mirror-cache.cjs');
async function prepare(){
 const cache=new MirrorCache(path.resolve(__dirname,'..','local-cache'));await cache.initialize();
 const html=await fs.readFile(path.join(__dirname,'upstream.html'),'utf8'),queue=discover(html,'/');
 for(const version of ['v14','v15'])for(const model of(version==='v14'?['proposal','gate']:['proposal','gate','verifier']))queue.push('/models/rune-cascade-'+version+'/'+model+'.onnx');
 const seen=new Set(),failures=[];let bytes=0;
 while(queue.length){
  const name=queue.shift();if(seen.has(name))continue;seen.add(name);
  if(seen.size>2500||bytes>512*1024*1024)throw Error('준비 용량 한도 초과');
  try{const result=await cache.get(name);bytes+=result.bytes.length;if(/\.(?:js|css|json)$/.test(name))for(const next of discover(result.bytes.toString('utf8'),name))if(!seen.has(next))queue.push(next);console.log((result.cached?'cache ':'saved ')+name+' '+result.bytes.length);}
  catch(e){failures.push({path:name,error:e.message});console.error('missing '+name+': '+e.message);}
  if(seen.size%20===0)await cache.saveManifest();
 }
 await cache.saveManifest();await fs.writeFile(path.join(__dirname,'preparation.json'),JSON.stringify({at:new Date().toISOString(),...cache.status(),scanned:seen.size,failures},null,2));
 console.log('준비 완료: '+cache.records.size+' assets; 실패 '+failures.length);if(failures.length)process.exitCode=1;
}
prepare().catch(e=>{console.error(e);process.exitCode=1;});
